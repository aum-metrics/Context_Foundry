# engines/query_engine.py
import pandas as pd
from typing import Dict, Any, Tuple
from .utils import _coerce_value

class QueryExecutor:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()

    def _apply_filters(self, df: pd.DataFrame, filters):
        out = df
        if not filters: return out
        for f in filters:
            try:
                if '==' in f:
                    col, val = f.split('==',1); out = out[out[col.strip()]==_coerce_value(val.strip())]
                elif '=' in f:
                    col, val = f.split('=',1); out = out[out[col.strip()]==_coerce_value(val.strip())]
                elif '>' in f:
                    col, val = f.split('>',1); out = out[pd.to_numeric(out[col.strip()], errors='coerce')>float(val.strip())]
                elif '<' in f:
                    col, val = f.split('<',1); out = out[pd.to_numeric(out[col.strip()], errors='coerce')<float(val.strip())]
            except Exception:
                continue
        return out

    def execute(self, spec: Dict[str,Any]) -> Tuple[pd.DataFrame, Dict[str,Any]]:
        task = spec.get('task','rank'); metrics = spec.get('metrics',[])[:3]; dims = spec.get('dimensions',[])[:2]
        top_n = spec.get('top_n',10); agg = spec.get('agg','sum'); filters = spec.get('filters',[])
        df = self.df.copy()
        df = self._apply_filters(df, filters)
        for m in metrics:
            if m in df.columns:
                df[m] = pd.to_numeric(df[m], errors='coerce')
        try:
            if task=='rank' and metrics and dims:
                res = df.groupby(dims, as_index=False)[metrics].sum()
                res = res.sort_values(by=metrics[0], ascending=False).head(top_n)
                return res, spec
            if task=='aggregate' and metrics:
                aggs = {m:agg for m in metrics}
                res = df.agg(aggs).to_frame().T
                return res, spec
            if task=='trend' and metrics:
                date_col = next((c for c in df.columns if 'date' in c.lower() or 'month' in c.lower()), None)
                if date_col:
                    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                    res = df.set_index(date_col).resample('M')[metrics].sum().reset_index()
                    return res, spec
            if task=='compare' and metrics and dims:
                res = df.groupby(dims, as_index=False)[metrics].sum()
                return res, spec
            return df.head(top_n), spec
        except Exception as e:
            return df.head(10), spec
