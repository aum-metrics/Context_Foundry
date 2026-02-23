# backend/app/api/intelligence.py
"""
PURE-PLAY BUSINESS INTELLIGENCE ENGINE
Leverages heavyweight domains.py for enterprise-grade analysis
No GPT, No Tokens - Just Pure Algorithmic Intelligence
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Dict, Any, Optional, Literal
import pandas as pd
from pydantic import BaseModel
import numpy as np
import io
import json
import logging
from datetime import datetime
import scipy.stats as stats
from domains_fixed import EnhancedFormulaParser

# Import the heavyweight domain intelligence system
from domains import CompleteDomainDetector, build_complete_registry

# Import existing engines
from engines.nl_engine import HybridNLInterpreter
from engines.query_engine import QueryExecutor
from engines.insight_engine import AutoInsightsEngine

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize the enterprise domain registry
DOMAIN_REGISTRY = build_complete_registry()
DOMAIN_DETECTOR = CompleteDomainDetector(DOMAIN_REGISTRY)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
class JoinRequest(BaseModel):
    left_data: List[Dict[str, Any]]
    right_data: List[Dict[str, Any]]
    left_on: str
    right_on: str
    how: Literal['inner', 'left', 'right', 'full'] = 'inner'

@router.post("/join")
async def join_tables(request: JoinRequest):
    """
    Join two datasets based on specified columns
    """
    try:
        # Convert to pandas DataFrames
        left_df = pd.DataFrame(request.left_data)
        right_df = pd.DataFrame(request.right_data)
        
        # Validate columns exist
        if request.left_on not in left_df.columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Column '{request.left_on}' not found in left table"
            )
        
        if request.right_on not in right_df.columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Column '{request.right_on}' not found in right table"
            )
        
        # Perform the join
        # Map join type to pandas merge how parameter
        how_mapping = {
            'inner': 'inner',
            'left': 'left',
            'right': 'right',
            'full': 'outer'
        }
        
        joined_df = pd.merge(
            left_df,
            right_df,
            left_on=request.left_on,
            right_on=request.right_on,
            how=how_mapping[request.how],
            suffixes=('_left', '_right')
        )
        
        # Convert back to list of dicts
        joined_data = joined_df.to_dict('records')
        
        # Replace NaN with None for JSON serialization
        for record in joined_data:
            for key, value in record.items():
                if pd.isna(value):
                    record[key] = None
        
        return {
            "success": True,
            "joined_data": joined_data,
            "row_count": len(joined_data),
            "column_count": len(joined_df.columns),
            "columns": list(joined_df.columns)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Join failed: {str(e)}")

def _to_python(val: Any) -> Any:
    """Convert numpy types to Python native types"""
    if isinstance(val, (np.integer, np.floating)):
        return val.item()
    if isinstance(val, np.ndarray):
        return val.tolist()
    if pd.isna(val):
        return None
    return val

def load_dataframe(file: UploadFile) -> pd.DataFrame:
    """Load CSV or Excel file"""
    try:
        content = file.file.read()
        if len(content) > 10 * 1024 * 1024: # 10MB limit
             raise HTTPException(status_code=413, detail="File too large. Max size is 10MB.")
        filename = file.filename.lower()
        
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
        else:
            raise ValueError(f"Unsupported format: {filename}")
        
        df.columns = [str(col).strip() for col in df.columns]
        return df
    
    except Exception as e:
        logger.error(f"File load error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to load file: {str(e)}")

def dataframe_to_dict(df: pd.DataFrame, max_rows: Optional[int] = None) -> Dict[str, Any]:
    """Convert dataframe to dictionary with proper type conversion"""
    if max_rows is None:
        preview_df = df
    else:
        preview_df = df.head(max_rows)
    
    return {
        "columns": df.columns.tolist(),
        "data": preview_df.fillna('').applymap(_to_python).to_dict('records'),
        "total_rows": len(df)
    }

# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/analyze")
async def comprehensive_analysis(
    files: List[UploadFile] = File(...),
    user_email: str = Form(...),
    subscription_type: str = Form(...),
):
    """
    COMPREHENSIVE BUSINESS INTELLIGENCE ANALYSIS
    Uses enterprise-grade domains.py for detection and KPI computation
    Returns: Domain, KPIs, Insights, Trends, Anomalies, Action Items, Join Recommendations
    """
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        # Load data
        df = load_dataframe(files[0])
        logger.info(f"📊 Loaded {len(df)} rows, {len(df.columns)} columns")
        
        # Use the heavyweight domain detection system
        dfs = {"main": df}
        detection_result = DOMAIN_DETECTOR.detect(
            dfs,
            validate_input=True,
            compute_kpis=True,
            detect_insights=True
        )
        
        domain = detection_result.get("domain", "generic")
        logger.info(f"Detected domain: {domain} (confidence: {detection_result.get('confidence', 0):.2%})")
        
        # Extract KPIs from detection result
        kpis_raw = detection_result.get("kpis", {})
        kpis = {}
        for kpi_id, kpi_data in kpis_raw.items():
            if kpi_id.startswith('_'):  # Skip metadata
                continue
            if isinstance(kpi_data, dict):
                kpis[kpi_id] = {
                    "name": kpi_data.get("name", kpi_id),
                    "value": _to_python(kpi_data.get("value")),
                    "formatted_value": kpi_data.get("formatted_value", str(kpi_data.get("value", ""))),
                    "status": kpi_data.get("status", "unknown"),
                    "description": kpi_data.get("description", ""),
                    "priority": kpi_data.get("priority", 1)
                }
        
        # Extract insights
        insights_raw = detection_result.get("insights", [])
        insights = []
        for insight in insights_raw:
            insights.append({
                "type": insight.get("pattern_id", "insight"),
                "insight": insight.get("message", ""),
                "importance": 0.9 if insight.get("severity") == "critical" else 0.7 if insight.get("severity") == "high" else 0.5,
                "severity": insight.get("severity", "info"),
                "actions": insight.get("actions", [])
            })
        
        # Use AutoInsightsEngine for additional insights
        insight_engine = AutoInsightsEngine()
        auto_insights = insight_engine.analyze(df)
        insights.extend(auto_insights[:5])  # Add top 5 auto insights
        
        # Sort by importance
        insights.sort(key=lambda x: x.get('importance', 0), reverse=True)
        
        # Generate action items from insights
        action_items = []
        for insight in insights[:5]:
            if insight.get('actions'):
                for action in insight['actions']:
                    action_items.append({
                        "priority": "high" if insight.get('severity') == 'critical' else "medium",
                        "category": insight.get('type', 'general'),
                        "action": action,
                        "impact": insight.get('insight', '')
                    })
        
        # Get join recommendations
        join_recommendations = detection_result.get("join_recommendations", [])
        
        # Get suggested queries from domain signature
        sig = DOMAIN_REGISTRY.get(domain)
        suggested_queries = []
        if sig and sig.query_templates:
            for template in sig.query_templates[:6]:
                suggested_queries.append(template.get("query", ""))
        
        # Data quality assessment
        data_quality = detection_result.get("data_quality", {})
        
        # Prepare response
        analysis = {
            "domain": domain,
            "domain_name": detection_result.get("domain_name", domain.title()),
            "confidence": _to_python(detection_result.get("confidence", 0)),
            "icon": detection_result.get("icon", "📊"),
            "color": detection_result.get("color", "#6C757D"),
            "kpis": kpis,
            "insights": insights[:10],
            "action_items": action_items[:5],
            "join_recommendations": join_recommendations[:5],
            "suggested_queries": suggested_queries,
            "data_quality": data_quality,
            "data_preview": dataframe_to_dict(df, max_rows=100),
            "metadata": {
                "detection_id": detection_result.get("detection_id"),
                "detected_at": detection_result.get("detected_at"),
                "total_kpis": len(kpis),
                "total_insights": len(insights)
            }
        }
        
        logger.info(f"Analysis complete: {len(kpis)} KPIs, {len(insights)} insights, {len(action_items)} actions")
        
        return {
            "success": True,
            **analysis
        }
        
    except Exception as e:
        logger.exception(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query")
async def intelligent_query(
    question: str = Form(...),
    data: str = Form(...),
    domain: str = Form("generic"),
    is_voice: bool = Form(False)
):
    """
    INTELLIGENT NATURAL LANGUAGE QUERY
    Supports both text and voice input (transcribed)
    Uses HybridNLInterpreter and QueryExecutor engines
    Includes Statistical Analysis Moat (Correlation, Covariance, ANOVA)
    """
    try:
        logger.info(f"Query ({'voice' if is_voice else 'text'}): {question}")
        
        # Parse data
        json_data = json.loads(data)
        df = pd.DataFrame(json_data)
        
        prompt_lower = question.lower()
        
        # ============================================================================
        # STATISTICAL ANALYSIS MOAT
        # ============================================================================
        if 'correlation' in prompt_lower:
            numeric_df = df.select_dtypes(include=['number'])
            if numeric_df.empty:
                raise ValueError("No numeric columns for correlation")
            
            corr_matrix = numeric_df.corr()
            
            # Generate insights for strong correlations
            insights = []
            for i in range(len(corr_matrix.columns)):
                for j in range(i+1, len(corr_matrix.columns)):
                    col1 = corr_matrix.columns[i]
                    col2 = corr_matrix.columns[j]
                    val = corr_matrix.iloc[i, j]
                    if abs(val) > 0.5:
                        strength = "Strong" if abs(val) > 0.7 else "Moderate"
                        direction = "positive" if val > 0 else "negative"
                        insights.append({
                            "type": "correlation",
                            "insight": f"{strength} {direction} correlation between {col1} and {col2} (r={val:.2f})",
                            "importance": 0.8 if abs(val) > 0.7 else 0.6
                        })
            
            return {
                "success": True,
                "result": {
                    "type": "correlation",
                    "matrix": corr_matrix.to_dict(),
                    "columns": numeric_df.columns.tolist()
                },
                "insights": insights,
                "query_type": "statistical_correlation"
            }

        elif 'covariance' in prompt_lower:
            numeric_df = df.select_dtypes(include=['number'])
            if numeric_df.empty:
                raise ValueError("No numeric columns for covariance")
            cov_matrix = numeric_df.cov()
            
            return {
                "success": True,
                "result": {
                    "type": "covariance",
                    "matrix": cov_matrix.to_dict(),
                    "columns": numeric_df.columns.tolist()
                },
                "insights": [{
                    "type": "covariance",
                    "insight": "Covariance matrix calculated. Positive values indicate variables move together.",
                    "importance": 0.5
                }],
                "query_type": "statistical_covariance"
            }

        elif 'anova' in prompt_lower:
            # Simplified ANOVA detection
            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            cat_cols = df.select_dtypes(include=['object']).columns.tolist()
            
            anova_results = []
            insights = []
            
            # Heuristic: Check all numeric vs categorical combinations
            for num in numeric_cols:
                for cat in cat_cols:
                    try:
                        groups = [group[num].values for name, group in df.groupby(cat)]
                        if len(groups) > 1:
                            f_val, p_val = stats.f_oneway(*groups)
                            if p_val < 0.05:
                                sig = "Highly significant" if p_val < 0.001 else "Significant"
                                insights.append({
                                    "type": "anova",
                                    "insight": f"{sig} difference in {num} across {cat} groups (p={p_val:.4f})",
                                    "importance": 0.9
                                })
                                anova_results.append({
                                    "numeric": num,
                                    "categorical": cat,
                                    "f_statistic": f_val,
                                    "p_value": p_val
                                })
                    except Exception:
                        continue
            
            if not anova_results:
                insights.append({
                    "type": "anova",
                    "insight": "No significant differences found between groups.",
                    "importance": 0.3
                })

            return {
                "success": True,
                "result": {
                    "type": "anova",
                    "results": anova_results
                },
                "insights": insights,
                "query_type": "statistical_anova"
            }

        # ============================================================================
        # STANDARD NL QUERY
        # ============================================================================
        
        # Parse query using NL engine
        nl_engine = HybridNLInterpreter()
        spec = nl_engine.parse(question, df.columns.tolist())
        
        if spec['task'] == 'error':
            return {
                "success": False,
                "error": spec.get('error'),
                "suggestions": spec.get('suggestions', []),
                "query_spec": spec
            }
        
        # Execute query
        query_executor = QueryExecutor(df)
        result_df, final_spec = query_executor.execute(spec)
        
        # Generate comprehensive insights
        insights = []
        query_type = spec['task']
        
        if query_type == 'aggregate':
            # Simple aggregation
            for col, val in result_df.iloc[0].items():
                formatted_val = f'{_to_python(val):,.2f}' if isinstance(val, (int, float)) else str(val)
                insights.append({
                    'type': 'result',
                    'insight': f'{col}: {formatted_val}',
                    'importance': 0.9
                })
        
        elif query_type in ['group_count', 'aggregate_by', 'group_by', 'rank']:
            # Group by operations
            total_groups = len(result_df)
            insights.append({
                'type': 'summary',
                'insight': f'Found {total_groups} groups',
                'importance': 0.8
            })
            
            # Show top 3 groups
            if total_groups > 0:
                num_cols = result_df.select_dtypes(include=['number']).columns.tolist()
                if num_cols:
                    sort_col = num_cols[0]
                    top_3 = result_df.nlargest(min(3, total_groups), sort_col)
                    
                    for idx, row in top_3.iterrows():
                        group_name = row[result_df.columns[0]]
                        value = row[sort_col]
                        insights.append({
                            'type': 'highlight',
                            'insight': f'Top: {group_name} = {_to_python(value):,.2f}',
                            'importance': 0.7
                        })
                    
                    # Statistical summary
                    total_value = result_df[sort_col].sum()
                    avg_value = result_df[sort_col].mean()
                    insights.append({
                        'type': 'statistics',
                        'insight': f'Total: {_to_python(total_value):,.2f}, Average: {_to_python(avg_value):,.2f}',
                        'importance': 0.6
                    })
        
        elif query_type == 'distribution':
            # Distribution analysis
            if len(result_df) > 0:
                insights.append({
                    'type': 'distribution',
                    'insight': f'Distribution shows {len(result_df)} distinct categories',
                    'importance': 0.8
                })
        
        else:
            # Generic result
            insights.append({
                'type': 'result',
                'insight': f'Query returned {len(result_df)} rows',
                'importance': 0.8
            })
            
            # Add column statistics for numeric columns
            num_cols = result_df.select_dtypes(include=['number']).columns.tolist()
            for col in num_cols[:2]:
                mean_val = result_df[col].mean()
                min_val = result_df[col].min()
                max_val = result_df[col].max()
                insights.append({
                    'type': 'statistics',
                    'insight': f'{col}: min={_to_python(min_val):,.2f}, max={_to_python(max_val):,.2f}, avg={_to_python(mean_val):,.2f}',
                    'importance': 0.6
                })
        
        # Prepare result
        result = dataframe_to_dict(result_df, max_rows=1000)
        
        return {
            'success': True,
            'result': result,
            'insights': insights,
            'query_spec': final_spec,
            'query_type': query_type,
            'confidence': spec.get('confidence', 0),
            'is_voice': is_voice
        }
        
    except Exception as e:
        logger.exception(f"❌ Query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/voice-transcribe")
async def transcribe_voice(
    audio: UploadFile = File(...)
):
    """
    VOICE TRANSCRIPTION ENDPOINT
    Accepts audio file and returns transcribed text
    Note: This is a placeholder - implement with Web Speech API on frontend
    or use a lightweight transcription library
    """
    try:
        # For now, return a message indicating this should be handled client-side
        return {
            "success": True,
            "message": "Voice transcription should be handled client-side using Web Speech API",
            "recommendation": "Use browser's SpeechRecognition API for real-time transcription"
        }
    except Exception as e:
        logger.exception(f"❌ Voice transcription failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/domains")
async def get_available_domains():
    """Get list of all available domains with their metadata"""
    domains = []
    for domain_id, sig in DOMAIN_REGISTRY.items():
        if sig.enabled:
            domains.append({
                "id": domain_id,
                "name": sig.name,
                "icon": sig.icon,
                "color": sig.color,
                "description": sig.description,
                "kpi_count": len(sig.critical_kpis) + len(sig.secondary_kpis),
                "entity_count": len(sig.entities)
            })
    
    return {
        "success": True,
        "domains": domains,
        "total_count": len(domains)
    }

@router.get("/health")
async def intelligence_health():
    """Health check"""
    return {
        "status": "healthy",
        "service": "business_intelligence",
        "engine": "enterprise_domain_intelligence_v2",
        "capabilities": [
            "15_domain_detection",
            "automated_kpi_computation",
            "insight_generation",
            "join_recommendations",
            "entity_mapping",
            "natural_language_query",
            "voice_query_support",
            "data_quality_assessment",
            "action_item_generation",
            "statistical_analysis_moat"
        ],
        "domains_loaded": len(DOMAIN_REGISTRY),
        "registry_version": "2.0"
    }
