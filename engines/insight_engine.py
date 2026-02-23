# engines/insight_engine.py
import pandas as pd
import numpy as np
from typing import Dict, List, Any

class AutoInsightsEngine:
    def __init__(self, domain: str = "generic", sku_price_map: Dict[str,float]=None):
        self.domain = domain or "generic"
        self.sku_price_map = sku_price_map or {}
        self.insights: List[Dict[str,Any]] = []

    def analyze_on_upload(self, df: pd.DataFrame) -> List[Dict[str,Any]]:
        self.insights=[]
        if df is None or df.empty:
            return [{"severity":"INFO","title":"No data","impact":"No rows","action":"Upload a dataset","financial_impact":"N/A"}]
        self._data_quality_checks(df)
        roles = self._detect_roles(df)
        self._top_level_metrics(df, roles)
        self._outlier_detection(df, roles)
        self._domain_rules(df, roles)
        self._sku_price_requirement(df, roles)
        # sort severity
        order={'CRITICAL':3,'WARNING':2,'OPPORTUNITY':1,'INFO':0}
        self.insights.sort(key=lambda x:order.get(x.get('severity','INFO'),0), reverse=True)
        return self.insights

    def interpret_and_run(self, df: pd.DataFrame, prompt: str):
        from .nl_engine import HybridNLInterpreter
        from .query_engine import QueryExecutor
        interp = HybridNLInterpreter()
        spec = interp.parse(prompt, df.columns.tolist())
        execer = QueryExecutor(df)
        result, exe_spec = execer.execute(spec)
        insights = self.analyze_on_query_result(result, exe_spec)
        return {"result": result, "query": exe_spec, "insights": insights}

    def _add(self, severity, title, impact, action, financial="N/A", details=""):
        self.insights.append({"severity":severity,"title":title,"impact":impact,"action":action,"financial_impact":financial,"details":details})

    def _data_quality_checks(self, df):
        total = len(df) * max(1, len(df.columns))
        nulls = df.isna().sum().sum()
        pct_null = (nulls/total)*100 if total>0 else 0
        if pct_null > 20:
            self._add("WARNING","High missing data","Data quality degraded","Review and fill missing values","N/A",f"{pct_null:.1f}% missing")
        else:
            self._add("INFO","Missing data","Data completeness acceptable","Keep monitoring","N/A",f"{pct_null:.1f}% missing")
        cols = df.columns[df.isna().mean() > 0.3].tolist()
        if cols:
            self._add("WARNING","Columns >30% missing","Data quality","Investigate these columns","N/A",", ".join(cols))

    def _detect_roles(self, df):
        roles={}
        for col in df.columns:
            low=col.lower()
            if any(k in low for k in ['gmv','revenue','amount','price','cost','value','sales','total']):
                roles[col]='metric'
            elif any(k in low for k in ['qty','quantity','units','orders']):
                roles[col]='metric'
            elif any(k in low for k in ['sku','product','asin','item']):
                roles[col]='sku'
            elif any(k in low for k in ['date','month','timestamp']):
                roles[col]='time'
            elif any(k in low for k in ['lat','lon','city','state','region']):
                roles[col]='geo'
            elif any(k in low for k in ['id','code','name','dealer','store','customer','agent','policy']):
                roles[col]='entity'
            else:
                try:
                    sample = pd.to_numeric(df[col].dropna().head(10), errors='coerce')
                    roles[col]='metric' if sample.notna().sum()>3 else 'dimension'
                except:
                    roles[col]='dimension'
        return roles

    def _top_level_metrics(self, df, roles):
        numeric = [c for c,t in roles.items() if t=='metric']
        if not numeric:
            self._add("INFO","No numeric metrics","Overview","Add numeric KPI columns for insights","N/A","")
            return
        for c in numeric[:3]:
            total = pd.to_numeric(df[c], errors='coerce').sum(skipna=True)
            self._add("OPPORTUNITY",f"Metric: {c}",f"Overview of {c}",f"Total {c}: {total:,.2f}",f"{total:,.2f}","")

        entities = [c for c,t in roles.items() if t in ('entity','sku','dimension')]
        if entities and numeric:
            e = entities[0]; m = numeric[0]
            group = df.groupby(e)[m].sum().sort_values(ascending=False)
            top_contrib = group.head(10).sum(); total = group.sum() if group.sum()!=0 else 1
            pct = (top_contrib/total)*100
            if pct>50:
                self._add("WARNING","Concentration risk",f"Top 10 {e} contribute {pct:.1f}% of {m}","Diversify top contributors",f"{pct:.1f}%","")

    def _outlier_detection(self, df, roles):
        numeric = [c for c,t in roles.items() if t=='metric']
        for c in numeric:
            s = pd.to_numeric(df[c], errors='coerce').dropna()
            if len(s)<10: continue
            z = (s - s.mean())/(s.std() if s.std()!=0 else 1)
            high = (z>3).sum(); low=(z<-3).sum()
            if high+low>0:
                self._add("OPPORTUNITY",f"Outliers in {c}",f"{high+low} extreme values","Investigate outliers", "N/A", f"{high} high, {low} low")

    def _domain_rules(self, df, roles):
        d = self.domain.lower()
        if d=='ecommerce':
            col_returns = next((c for c in df.columns if 'return' in c.lower()), None)
            col_orders = next((c for c in df.columns if 'order' in c.lower()), None)
            if col_returns and col_orders:
                r = df[col_returns].sum(); o = df[col_orders].sum() if df[col_orders].sum()!=0 else 1
                rr = (r/o)*100
                if rr>15: self._add("CRITICAL","High return rate",f"{rr:.1f}%","Investigate returns by SKU/category",f"{rr:.1f}%","")
                else: self._add("INFO","Return rate",f"{rr:.1f}%","Monitor",f"{rr:.1f}%","")
        if d=='manufacturing':
            def_col = next((c for c in df.columns if 'defect' in c.lower()), None)
            out_col = next((c for c in df.columns if any(x in c.lower() for x in ['throughput','output'])), None)
            if def_col and out_col:
                defects = df[def_col].sum(); out = df[out_col].sum() if df[out_col].sum()!=0 else 1
                dr = (defects/out)*100
                if dr>3: self._add("WARNING","High defect rate",f"{dr:.2f}% defects","Investigate root causes",f"{dr:.2f}%","")

    def _sku_price_requirement(self, df, roles):
        sku_col = next((c for c,t in roles.items() if t=='sku' or 'sku' in c.lower()), None)
        stock_col = next((c for c in df.columns if any(k in c.lower() for k in ['stock','inventory','on_hand','qty','quantity']) ), None)
        if sku_col and stock_col:
            if not self.sku_price_map:
                self._add("INFO","Unit Price Required","Valuation requires SKU price mapping","Upload CSV with headers 'sku,unit_price'","N/A",f"Detected sku:{sku_col} and qty:{stock_col}")
            else:
                merged = df[[sku_col, stock_col]].copy()
                merged[sku_col] = merged[sku_col].astype(str).str.strip()
                merged['unit_price'] = merged[sku_col].map(self.sku_price_map).fillna(0)
                merged[stock_col] = pd.to_numeric(merged[stock_col], errors='coerce').fillna(0)
                merged['value'] = merged['unit_price'] * merged[stock_col]
                total_val = merged['value'].sum()
                if total_val>0:
                    self._add("OPPORTUNITY","Inventory valuation",f"Estimated inventory value ₹{total_val:,.2f}","Use for working capital analysis",f"₹{total_val:,.2f}","")

    def analyze_on_query_result(self, result_df, spec):
        out=[]
        if result_df is None or result_df.empty:
            return out
        num = result_df.select_dtypes(include=[np.number]).columns.tolist()
        cat = result_df.select_dtypes(include=['object']).columns.tolist()
        if num and cat:
            out.append({"severity":"OPPORTUNITY","title":f"Top {cat[0]} by {num[0]}","impact":"Top contributors","action":"Investigate further","financial_impact":"N/A","details":result_df.head(5).to_dict(orient='records')})
        cols_low = [c.lower() for c in result_df.columns]
        if 'returns' in cols_low and any('order' in c for c in cols_low):
            try:
                r = result_df.iloc[:, cols_low.index('returns')].sum()
                o = result_df.iloc[:, next(i for i,c in enumerate(cols_low) if 'order' in c)].sum() or 1
                rr = (r/o)*100
                out.append({"severity":"WARNING","title":"Return ratio in results","impact":f"{rr:.1f}%","action":"Deep dive","financial_impact":"N/A","details":""})
            except Exception:
                pass
        return out
