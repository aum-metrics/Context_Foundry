# backend/app/api/data.py
"""
Data upload and analysis endpoints
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import List, Dict, Any, Optional
import pandas as pd
import io
import logging
import numpy as np
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Try importing domain engine
try:
    from engines.domain_engine import AdvancedDomainIntelligence
    DOMAIN_ENGINE_AVAILABLE = True
except ImportError:
    logger.warning("⚠️ Domain engine not available, using fallback")
    DOMAIN_ENGINE_AVAILABLE = False


# ============================================================================
# MODELS
# ============================================================================

class AnalysisResult(BaseModel):
    """Data analysis result"""
    domain: str
    confidence: float
    domain_scores: Dict[str, float]
    insights: List[Dict[str, Any]]
    kpis: Optional[Dict[str, Any]] = {}
    data_preview: Dict[str, Any]
    domain_config: Dict[str, Any]
    alerts: List[Dict[str, Any]]
    upgrade_required: Optional[bool] = False
    upgrade_message: Optional[str] = None
    domain_selection_required: Optional[bool] = False
    
    class Config:
        extra = "allow"


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _to_python(val: Any) -> Any:
    """Convert numpy types to native Python types"""
    if isinstance(val, (np.integer, np.floating)):
        return val.item()
    return val


def load_dataframe(file: UploadFile) -> pd.DataFrame:
    """Load CSV or Excel file"""
    try:
        content = file.file.read()
        filename = file.filename.lower() if file.filename else ""
        
        logger.info(f"📂 Loading file: {file.filename} ({len(content)} bytes)")
        
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
        else:
            raise ValueError(f"Unsupported file format: {filename}")
        
        df.columns = [str(col).strip() for col in df.columns]
        logger.info(f"✅ Loaded {len(df)} rows, {len(df.columns)} columns")
        return df
        
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="File is empty")
    except pd.errors.ParserError as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
    except Exception as e:
        logger.error(f"File load error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to load file: {str(e)}")


def dataframe_to_dict(df: pd.DataFrame, max_rows: Optional[int] = None) -> Dict:
    """Convert DataFrame to dict"""
    try:
        df_subset = df if max_rows is None else df.head(max_rows)
        df_clean = df_subset.fillna('')
        df_clean = df_clean.replace([float('inf'), float('-inf')], '')
        
        # Convert numpy types
        df_clean = df_clean.applymap(_to_python)
        
        return {
            "columns": df.columns.tolist(),
            "data": df_clean.to_dict('records'),
            "total_rows": len(df),
            "dtypes": df.dtypes.astype(str).to_dict()
        }
    except Exception as e:
        logger.error(f"DataFrame conversion error: {e}")
        return {
            "columns": [],
            "data": [],
            "total_rows": 0,
            "dtypes": {},
            "error": str(e)
        }


def generate_insights(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Generate basic insights from data"""
    insights = []
    try:
        numeric_cols = df.select_dtypes(include=['number']).columns
        
        for col in numeric_cols[:3]:
            try:
                min_val = _to_python(df[col].min())
                max_val = _to_python(df[col].max())
                mean_val = _to_python(df[col].mean())
                
                insights.append({
                    "type": "statistical",
                    "insight": f"{col} ranges from {min_val:.2f} to {max_val:.2f} with average {mean_val:.2f}",
                    "importance": 0.7,
                    "column": col
                })
            except Exception as e:
                logger.debug(f"Failed to analyze {col}: {e}")
        
        # Missing values
        missing = df.isnull().sum()
        missing = missing[missing > 0]
        if len(missing) > 0:
            insights.append({
                "type": "data_quality",
                "insight": f"Found missing values in {len(missing)} columns",
                "importance": 0.6,
                "columns": missing.index.tolist()
            })
        
        # Overview
        insights.append({
            "type": "overview",
            "insight": f"Dataset has {len(df):,} records across {len(df.columns)} columns",
            "importance": 0.8
        })
        
    except Exception as e:
        logger.error(f"Insight generation error: {e}")
    
    return insights


def generate_alerts(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Generate data quality alerts"""
    alerts = []
    try:
        # Duplicates
        duplicates = df.duplicated().sum()
        if duplicates > 0:
            alerts.append({
                "type": "WARNING",
                "title": f"{duplicates} duplicate rows detected",
                "impact": "May affect analysis accuracy",
                "recommendation": "Review and remove duplicates if necessary"
            })
        
        # High missing values
        missing_pct = (df.isnull().sum() / len(df)) * 100
        high_missing = missing_pct[missing_pct > 20]
        if len(high_missing) > 0:
            alerts.append({
                "type": "CRITICAL",
                "title": f"{len(high_missing)} columns with >20% missing data",
                "impact": "High missing data may skew results",
                "recommendation": "Consider imputation or removal of affected columns"
            })
        
        # Zero variance
        for col in df.select_dtypes(include=['number']).columns:
            try:
                if df[col].std() == 0:
                    alerts.append({
                        "type": "INFO",
                        "title": f"Column {col} has zero variance",
                        "impact": "All values are identical",
                        "recommendation": "Consider removing this column from analysis"
                    })
            except:
                pass
                
    except Exception as e:
        logger.error(f"Alert generation error: {e}")
    
    return alerts


def generate_kpis(df: pd.DataFrame, domain: str) -> Dict[str, Any]:
    """Generate KPIs for domain"""
    kpis = {}
    try:
        numeric_cols = df.select_dtypes(include=['number']).columns
        
        # Total records
        kpis["total_records"] = {
            "name": "Total Records",
            "value": _to_python(len(df)),
            "formatted_value": f"{len(df):,}",
            "status": "good"
        }
        
        # Primary metric
        if len(numeric_cols) > 0:
            primary_col = numeric_cols[0]
            try:
                total_val = _to_python(df[primary_col].sum())
                avg_val = _to_python(df[primary_col].mean())
                
                kpis["primary_metric"] = {
                    "name": f"Total {primary_col}",
                    "value": total_val,
                    "formatted_value": f"{total_val:,.2f}",
                    "status": "excellent"
                }
                kpis["average_metric"] = {
                    "name": f"Avg {primary_col}",
                    "value": avg_val,
                    "formatted_value": f"{avg_val:,.2f}",
                    "status": "good"
                }
            except Exception as e:
                logger.debug(f"Failed to compute metric for {primary_col}: {e}")
        
    except Exception as e:
        logger.error(f"KPI generation error: {e}")
    
    return kpis


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/upload")
async def upload_data(
    files: List[UploadFile] = File(...),
    user_email: str = Form(...),
    subscription_type: str = Form(...),
    unlocked_domains: str = Form(...)
) -> AnalysisResult:
    """Upload and analyze data file"""
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        # Load first file
        df = load_dataframe(files[0])
        
        # Generate insights and alerts
        insights = generate_insights(df)
        alerts = generate_alerts(df)
        
        # Detect domain
        domain = "generic"
        if DOMAIN_ENGINE_AVAILABLE:
            try:
                detector = AdvancedDomainIntelligence()
                domain, confidence, scores, details = detector.detect_domain({"data": df})
                logger.info(f"🎯 Detected domain: {domain} ({confidence:.1%})")
            except Exception as e:
                logger.warning(f"Domain detection failed: {e}")
        
        # Generate KPIs
        kpis = generate_kpis(df, domain)
        
        # Data preview (return all rows, not just 100)
        data_preview = dataframe_to_dict(df, max_rows=None)
        
        result = AnalysisResult(
            domain=domain,
            confidence=0.85,
            domain_scores={domain: 0.85},
            insights=insights,
            kpis=kpis,
            data_preview=data_preview,
            domain_config={
                "name": domain.title(),
                "icon": "📊",
                "color": "#6C757D"
            },
            alerts=alerts,
            upgrade_required=False,
            upgrade_message=None,
            domain_selection_required=False
        )
        
        logger.info(f"✅ Upload successful: {len(df)} rows analyzed")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/column-info")
async def get_column_info(file: UploadFile = File(...)):
    """Get detailed column metadata"""
    try:
        logger.info(f"📋 Column info request: {file.filename}")
        df = load_dataframe(file)
        
        column_info = []
        for col in df.columns:
            info: Dict[str, Any] = {
                "name": col,
                "dtype": str(df[col].dtype),
                "non_null": int(df[col].count()),
                "null_count": int(df[col].isnull().sum()),
                "unique_count": int(df[col].nunique()),
                "sample_values": df[col].dropna().head(5).astype(str).tolist()
            }
            
            # Statistics for numeric columns
            if pd.api.types.is_numeric_dtype(df[col]):
                try:
                    info["statistics"] = {
                        "mean": _to_python(df[col].mean()),
                        "median": _to_python(df[col].median()),
                        "std": _to_python(df[col].std()),
                        "min": _to_python(df[col].min()),
                        "max": _to_python(df[col].max())
                    }
                except Exception:
                    pass
            
            column_info.append(info)
        
        logger.info(f"✅ Column info generated for {len(column_info)} columns")
        return {
            "columns": column_info,
            "total_rows": len(df),
            "total_columns": len(df.columns)
        }
        
    except Exception as e:
        logger.exception(f"Column info failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def data_health():
    """Health check for data service"""
    return {
        "status": "healthy",
        "service": "data",
        "endpoints": ["/upload", "/column-info", "/health"]
    }