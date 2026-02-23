# backend/app/api/query.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose of this code: Natural Language Query Engine for converting text to pandas operations.
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Dict, Any, Optional
import pandas as pd
import io
import json
import logging
from app.engines.nl_engine import HybridNLInterpreter

router = APIRouter()
logger = logging.getLogger(__name__)

def load_dataframe(file: UploadFile) -> pd.DataFrame:
    """Load CSV or Excel file into DataFrame"""
    try:
        content = file.file.read()
        filename = file.filename.lower()
        
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
        else:
            raise ValueError(f"Unsupported file format: {filename}")
        
        df.columns = [str(col).strip() for col in df.columns]
        return df
        
    except Exception as e:
        logger.error(f"File load error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to load file: {str(e)}")

def execute_query(df: pd.DataFrame, prompt: str, columns: List[str]) -> Dict[str, Any]:
    """Execute natural language query on dataframe using HybridNLInterpreter"""
    try:
        interpreter = HybridNLInterpreter()
        spec = interpreter.parse(prompt, columns)
        
        if spec['task'] == 'error':
            raise ValueError(spec.get('error', 'Unknown error'))
            
        result_df = df.copy()
        query_type = 'filter'
        
        # Execute based on spec
        if spec['task'] == 'group_count':
            dims = spec['dimensions']
            if dims:
                result_df = df.groupby(dims).size().reset_index(name='count')
                query_type = 'groupby'
            else:
                # Just count total
                result_df = pd.DataFrame([{'total_count': len(df)}])
                query_type = 'aggregate'
                
        elif spec['task'] == 'aggregate_by':
            dims = spec['dimensions']
            metrics = spec['metrics']
            agg = spec['agg']
            
            if dims and metrics:
                # Map agg name to pandas function
                agg_map = {'mean': 'mean', 'sum': 'sum', 'min': 'min', 'max': 'max', 'count': 'count', 'median': 'median'}
                pd_agg = agg_map.get(agg, 'sum')
                
                # Handle multiple metrics if needed, for now take first
                metric = metrics[0]
                result_df = df.groupby(dims)[metric].agg(pd_agg).reset_index()
                query_type = 'groupby'
            
        elif spec['task'] == 'rank': # Top N
            top_n = spec['top_n']
            metrics = spec['metrics']
            dims = spec['dimensions']
            
            if metrics:
                sort_col = metrics[0]
                result_df = df.sort_values(by=sort_col, ascending=False).head(top_n)
            elif dims:
                 result_df = df.head(top_n)
            else:
                result_df = df.head(top_n)
            query_type = 'filter'
            
        elif spec['task'] == 'aggregate':
            metrics = spec['metrics']
            agg = spec['agg']
            
            if metrics:
                agg_map = {'mean': 'mean', 'sum': 'sum', 'min': 'min', 'max': 'max', 'count': 'count', 'median': 'median'}
                pd_agg = agg_map.get(agg, 'sum')
                
                res = {}
                for m in metrics:
                    if pd.api.types.is_numeric_dtype(df[m]):
                        res[f"{agg}_{m}"] = df[m].agg(pd_agg)
                
                result_df = pd.DataFrame([res])
                query_type = 'aggregate'
                
        elif spec['task'] == 'explore':
            # Default exploration
            result_df = df.head(10)
            query_type = 'filter'
            
        # Prepare result
        result = {
            'columns': result_df.columns.tolist(),
            'data': result_df.fillna('').to_dict('records'),
            'total_rows': len(result_df),
            'query_type': query_type
        }
        
        # Generate comprehensive insights based on query results
        insights = []
        
        if query_type == 'aggregate':
            if result['data']:
                for col, val in result['data'][0].items():
                    if isinstance(val, (int, float)):
                        insights.append({
                            'type': 'result',
                            'insight': f'{col}: {val:,.2f}',
                            'importance': 0.9
                        })
                    else:
                        insights.append({
                            'type': 'result',
                            'insight': f'{col}: {val}',
                            'importance': 0.9
                        })
                        
        elif query_type == 'groupby':
            insights.append({
                'type': 'result',
                'insight': f'Found {len(result_df)} groups in the data',
                'importance': 0.8
            })
            
            # Add top groups if applicable
            if len(result_df) > 0 and len(result_df.columns) > 1:
                # Find the numeric column (likely the aggregated value)
                num_cols = result_df.select_dtypes(include=['number']).columns
                if len(num_cols) > 0:
                    sort_col = num_cols[0]
                    top_3 = result_df.nlargest(min(3, len(result_df)), sort_col)
                    for idx, row in top_3.iterrows():
                        group_name = row[result_df.columns[0]] if len(result_df.columns) > 0 else idx
                        value = row[sort_col]
                        insights.append({
                            'type': 'highlight',
                            'insight': f'Top group: {group_name} with {sort_col} = {value:,.2f}',
                            'importance': 0.7
                        })
                        
        else:  # filter or other
            insights.append({
                'type': 'result',
                'insight': f'Returned {len(result_df)} rows matching your query',
                'importance': 0.8
            })
            
            # Add statistical insights for numeric columns
            numeric_cols = result_df.select_dtypes(include=['number']).columns.tolist()
            for col in numeric_cols[:2]:  # Top 2 numeric columns
                if len(result_df) > 0:
                    mean_val = result_df[col].mean()
                    max_val = result_df[col].max()
                    min_val = result_df[col].min()
                    insights.append({
                        'type': 'statistical',
                        'insight': f'{col}: avg={mean_val:,.2f}, range=[{min_val:,.2f} to {max_val:,.2f}]',
                        'importance': 0.6
                    })
        
        # Suggest visualizations
        viz_suggestions = []
        numeric_cols = result_df.select_dtypes(include=['number']).columns.tolist()
        categorical_cols = result_df.select_dtypes(include=['object']).columns.tolist()
        
        if len(categorical_cols) > 0 and len(numeric_cols) > 0:
            viz_suggestions.append({
                'type': 'bar',
                'x': categorical_cols[0],
                'y': numeric_cols[0],
                'description': f'Bar chart of {numeric_cols[0]} by {categorical_cols[0]}'
            })
        
        if len(numeric_cols) >= 2:
            viz_suggestions.append({
                'type': 'scatter',
                'x': numeric_cols[0],
                'y': numeric_cols[1],
                'description': f'Scatter plot of {numeric_cols[1]} vs {numeric_cols[0]}'
            })
        
        return {
            'success': True,
            'result': result,
            'insights': insights,
            'visualization_suggestions': viz_suggestions
        }
        
    except Exception as e:
        logger.error(f"Query execution failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }

@router.post("/natural-language")
async def natural_language_query(
    question: str = Form(...),
    dataset_id: str = Form(...),
    data: str = Form(...)
):
    """Execute natural language query on JSON data"""
    try:
        logger.info(f"🔍 NL Query request: {question}")
        
        # Parse data
        try:
            json_data = json.loads(data)
            df = pd.DataFrame(json_data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid data format: {str(e)}")
            
        prompt_lower = question.lower()
        
        # STATISTICAL ANALYSIS
        if 'correlation' in prompt_lower:
            numeric_df = df.select_dtypes(include=['number'])
            if numeric_df.empty:
                raise ValueError("No numeric columns for correlation")
            corr_matrix = numeric_df.corr().to_dict()
            return {
                "success": True,
                "statistical_analysis": {
                    "correlation": corr_matrix
                }
            }
            
        elif 'covariance' in prompt_lower:
            numeric_df = df.select_dtypes(include=['number'])
            if numeric_df.empty:
                raise ValueError("No numeric columns for covariance")
            cov_matrix = numeric_df.cov().to_dict()
            return {
                "success": True,
                "statistical_analysis": {
                    "covariance": cov_matrix
                }
            }
            
        elif 'anova' in prompt_lower:
            # Expecting "ANOVA between col1 and col2"
            # This is a simplified ANOVA for 2 columns
            import scipy.stats as stats
            
            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            cat_cols = df.select_dtypes(include=['object']).columns.tolist()
            
            results = []
            
            # Try to find mentioned columns
            target_num = None
            target_cat = None
            
            for col in numeric_cols:
                if col.lower() in prompt_lower:
                    target_num = col
                    break
            
            for col in cat_cols:
                if col.lower() in prompt_lower:
                    target_cat = col
                    break
            
            if target_num and target_cat:
                groups = [group[target_num].values for name, group in df.groupby(target_cat)]
                f_val, p_val = stats.f_oneway(*groups)
                results.append({
                    "f_statistic": round(f_val, 4),
                    "p_value": round(p_val, 4),
                    "significant": p_val < 0.05,
                    "columns": f"{target_num} by {target_cat}"
                })
            else:
                # Fallback: Try all num/cat combinations
                pass

            return {
                "success": True,
                "statistical_analysis": {
                    "anova": results
                }
            }

        # STANDARD QUERY EXECUTION
        result = execute_query(df, question, df.columns.tolist())
        
        if result['success']:
            logger.info(f"✅ Query executed successfully")
        else:
            logger.error(f"❌ Query failed: {result.get('error')}")
        
        return result
        
    except Exception as e:
        logger.exception(f"NL Query endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def query_health():
    """Check query service health"""
    return {
        "status": "healthy",
        "service": "query",
        "endpoints": ["/natural-language"]
    }