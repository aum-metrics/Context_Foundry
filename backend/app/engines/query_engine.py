# engines/query_engine.py - UNIVERSAL FIXED VERSION
import pandas as pd
from typing import Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)

class QueryExecutor:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()

    def _apply_filters(self, df: pd.DataFrame, filters):
        """Apply filters to dataframe"""
        out = df
        if not filters:
            return out
        
        for f in filters:
            try:
                if '==' in f:
                    col, val = f.split('==', 1)
                    out = out[out[col.strip()] == self._coerce_value(val.strip())]
                elif '=' in f:
                    col, val = f.split('=', 1)
                    out = out[out[col.strip()] == self._coerce_value(val.strip())]
                elif '>=' in f:
                    col, val = f.split('>=', 1)
                    out = out[pd.to_numeric(out[col.strip()], errors='coerce') >= float(val.strip())]
                elif '<=' in f:
                    col, val = f.split('<=', 1)
                    out = out[pd.to_numeric(out[col.strip()], errors='coerce') <= float(val.strip())]
                elif '>' in f:
                    col, val = f.split('>', 1)
                    out = out[pd.to_numeric(out[col.strip()], errors='coerce') > float(val.strip())]
                elif '<' in f:
                    col, val = f.split('<', 1)
                    out = out[pd.to_numeric(out[col.strip()], errors='coerce') < float(val.strip())]
            except Exception as e:
                logger.warning(f"Filter failed: {f} - {e}")
                continue
        return out

    def _coerce_value(self, v: str):
        """Coerce string value to appropriate type"""
        v = v.strip().strip("'").strip('"')
        try:
            if '.' in v:
                return float(v)
            return int(v)
        except:
            return v

    def execute(self, spec: Dict[str, Any]) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Universal query executor - handles ALL query types
        """
        task = spec.get('task', 'explore')
        metrics = spec.get('metrics', [])[:3]
        dims = spec.get('dimensions', [])[:2]
        top_n = spec.get('top_n', 100)
        agg = spec.get('agg', 'sum')
        filters = spec.get('filters', [])
        
        df = self.df.copy()
        df = self._apply_filters(df, filters)
        
        logger.info(f"Executing task={task}, metrics={metrics}, dims={dims}, agg={agg}")
        
        try:
            # ============ GROUP COUNT (count X by Y) ============
            if task == 'group_count' and dims:
                if metrics and metrics[0] != '*':
                    # Count specific column by dimension
                    result = df.groupby(dims, as_index=False)[metrics[0]].count()
                    result.rename(columns={metrics[0]: f'count_of_{metrics[0]}'}, inplace=True)
                else:
                    # Count rows by dimension
                    result = df.groupby(dims, as_index=False).size()
                    result.rename(columns={'size': 'count'}, inplace=True)
                
                # Sort by count descending
                count_col = result.columns[-1]
                result = result.sort_values(by=count_col, ascending=False).head(top_n)
                
                logger.info(f"GROUP COUNT: {len(result)} groups")
                return result, spec
            
            # ============ AGGREGATE BY (sum/avg X by Y) ============
            if task == 'aggregate_by' and metrics and dims:
                # Convert metrics to numeric
                for m in metrics:
                    if m in df.columns:
                        df[m] = pd.to_numeric(df[m], errors='coerce')
                
                # Group and aggregate
                agg_dict = {m: agg for m in metrics}
                result = df.groupby(dims, as_index=False).agg(agg_dict)
                
                # Sort by first metric descending
                result = result.sort_values(by=metrics[0], ascending=False).head(top_n)
                
                logger.info(f"AGGREGATE BY: {len(result)} groups")
                return result, spec
            
            # ============ GROUP BY (show X by Y) ============
            if task == 'group_by' and dims:
                if metrics:
                    # Convert metrics to numeric
                    for m in metrics:
                        if m in df.columns:
                            df[m] = pd.to_numeric(df[m], errors='coerce')
                    
                    # Group and sum
                    result = df.groupby(dims, as_index=False)[metrics].sum()
                    result = result.sort_values(by=metrics[0], ascending=False).head(top_n)
                else:
                    # Just group and count
                    result = df.groupby(dims, as_index=False).size()
                    result.rename(columns={'size': 'count'}, inplace=True)
                    result = result.sort_values(by='count', ascending=False).head(top_n)
                
                logger.info(f"GROUP BY: {len(result)} groups")
                return result, spec
            
            # ============ RANK (top N X by Y) ============
            if task == 'rank' and metrics and dims:
                # Convert metrics to numeric
                for m in metrics:
                    if m in df.columns:
                        df[m] = pd.to_numeric(df[m], errors='coerce')
                
                # Group and aggregate
                result = df.groupby(dims, as_index=False)[metrics].sum()
                result = result.sort_values(by=metrics[0], ascending=False).head(top_n)
                
                logger.info(f"RANK: top {len(result)}")
                return result, spec
            
            # ============ SIMPLE AGGREGATE (total/avg X) ============
            if task == 'aggregate' and metrics:
                # Convert metrics to numeric
                for m in metrics:
                    if m in df.columns:
                        df[m] = pd.to_numeric(df[m], errors='coerce')
                
                # Calculate aggregates
                aggs = {m: agg for m in metrics}
                result = df.agg(aggs).to_frame().T
                
                logger.info(f"AGGREGATE: {agg} computed")
                return result, spec
            
            # ============ DISTRIBUTION ============
            if task == 'distribution' and dims:
                result = df.groupby(dims[0], as_index=False).size()
                result.rename(columns={'size': 'count'}, inplace=True)
                result = result.sort_values(by='count', ascending=False).head(top_n)
                
                logger.info(f"DISTRIBUTION: {len(result)} categories")
                return result, spec
            
            # ============ FALLBACK: PREVIEW ============
            logger.warning(f"Falling back to preview for task={task}")
            result = df.head(top_n)
            return result, spec
        
        except Exception as e:
            logger.exception(f"Query execution error: {e}")
            # Return preview on error
            return df.head(10), {**spec, 'error': str(e)}