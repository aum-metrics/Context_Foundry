# engines/join_engine.py
from typing import Dict, List, Optional
import pandas as pd

class EnhancedJoinEngine:
    @staticmethod
    def find_smart_joins(dfs: Dict[str, pd.DataFrame]) -> List[Dict]:
        suggestions = []
        names = list(dfs.keys())
        for i in range(len(names)):
            for j in range(i+1, len(names)):
                l = names[i]; r = names[j]
                left = dfs[l]; right = dfs[r]
                left_cols = {c.lower().strip(): c for c in left.columns}
                right_cols = {c.lower().strip(): c for c in right.columns}
                common = set(left_cols.keys()) & set(right_cols.keys())
                for common_col in common:
                    if common_col in ['index','unnamed']: continue
                    lcol = left_cols[common_col]; rcol = right_cols[common_col]
                    lv = set(left[lcol].dropna().astype(str).head(200))
                    rv = set(right[rcol].dropna().astype(str).head(200))
                    if not lv or not rv: continue
                    overlap = len(lv & rv) / min(len(lv), len(rv))
                    if overlap > 0.05:
                        confidence = 0.6 + (overlap * 0.4)
                        if any(k in common_col for k in ['id','code','sku']):
                            confidence = min(confidence*1.2, 0.99)
                        suggestions.append({'left':l,'right':r,'left_on':lcol,'right_on':rcol,'confidence':round(confidence,2),'overlap':round(overlap*100,1)})
        suggestions.sort(key=lambda x: x['confidence'], reverse=True)
        # dedupe
        seen=set(); out=[]
        for s in suggestions:
            key=(s['left'],s['right'],s['left_on'],s['right_on'])
            if key not in seen:
                seen.add(key); out.append(s)
        return out[:10]

    @staticmethod
    def execute_joins(dfs: Dict[str, pd.DataFrame], suggestions: List[Dict]) -> Optional[pd.DataFrame]:
        if not suggestions: return None
        try:
            first = suggestions[0]
            result = dfs[first['left']].copy()
            for s in suggestions:
                if s['right'] in dfs:
                    right_df = dfs[s['right']]
                    result = result.merge(right_df, left_on=s['left_on'], right_on=s['right_on'], how='left', suffixes=('','_'+s['right']))
            return result
        except Exception:
            return None
