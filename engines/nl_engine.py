# engines/nl_engine.py
import re, difflib
from typing import List, Dict, Any
from .utils import _coerce_value

class HybridNLInterpreter:
    def __init__(self):
        self.re_top = re.compile(r'top\s+(\d+)\s+(?:by\s+)?(?P<metric>[\w\-\_]+)(?:\s+by\s+(?P<dim>[\w\-,\s]+))?', re.I)
        self.re_agg = re.compile(r'(sum|total|average|mean|count|min|max|median)\s+of\s+([\w\_]+)', re.I)
        self.re_trend = re.compile(r'(trend|over time|by month|monthly|last\s+\d+\s+months)', re.I)
        self.common_aggs = {'sum':'sum','total':'sum','average':'mean','avg':'mean','mean':'mean','count':'count','min':'min','max':'max','median':'median'}

    def _fuzzy_col(self, token: str, columns: List[str]) -> str:
        token_l = token.lower()
        for c in columns:
            if token_l == c.lower():
                return c
        for c in columns:
            if token_l in c.lower() or c.lower() in token_l:
                return c
        close = difflib.get_close_matches(token_l, [c.lower() for c in columns], n=1, cutoff=0.6)
        if close:
            idx = [c.lower() for c in columns].index(close[0]); return columns[idx]
        return None

    def parse(self, prompt: str, columns: List[str]) -> Dict[str,Any]:
        spec = {'task':'rank','metrics':[],'dimensions':[],'top_n':10,'agg':'sum','filters':[],'raw':prompt}
        p = prompt.strip()
        m = self.re_top.search(p)
        if m:
            try: spec['top_n']=int(m.group(1))
            except: spec['top_n']=10
            metric_tok = m.group('metric') or ''
            dim_tok = m.group('dim') or ''
            if metric_tok:
                col = self._fuzzy_col(metric_tok, columns)
                if col: spec['metrics']=[col]
            if dim_tok:
                first_dim = dim_tok.split(',')[0].strip()
                col = self._fuzzy_col(first_dim, columns)
                if col: spec['dimensions']=[col]
            spec['task']='rank'; return spec

        m = self.re_agg.search(p)
        if m:
            agg = m.group(1).lower(); metric_tok = m.group(2)
            col = self._fuzzy_col(metric_tok, columns)
            spec['agg'] = self.common_aggs.get(agg, 'sum')
            if col: spec['metrics']=[col]
            spec['task']='aggregate'; return spec

        if self.re_trend.search(p.lower()):
            tokens = re.split(r'[\s,]+', p.lower())
            for t in tokens:
                c = self._fuzzy_col(t, columns)
                if c and c not in spec['metrics']: spec['metrics'].append(c)
            spec['task']='trend'; return spec

        # fallback heuristics
        for kw in ['revenue','gmv','sales','orders','count','amount','price','value','returns','margin','units']:
            for c in columns:
                if kw in c.lower() and c not in spec['metrics']:
                    spec['metrics'].append(c)
        for c in columns:
            if any(x in c.lower() for x in ['id','name','sku','dealer','store','city','state','category','brand']):
                spec['dimensions']=[c]; break
        return spec
