# engines/domain_engine.py
import numpy as np
from typing import Dict, Tuple, List
from .benchmarks import DOMAIN_SIGNATURES as _SIG  # later fallback
# We'll embed signatures locally for independence
DOMAIN_SIGNATURES = {
    "ecommerce": {
        "file_keywords": ["order","cart","product","sku","ecom","marketplace","seller"],
        "column_keywords": ["sku","asin","product_id","gmv","order_value","cart","conversion","returns"],
        "metrics":["gmv","orders","revenue","aov","conversion_rate"],
        "dimensions":["category","brand","channel","region","sku"],
        "value_patterns":{"sku": r"^[A-Z0-9\-]{3,}$"},
        "weight":1.0, "icon":"🛒", "color":"#FF6B35"
    },
    # other domains simplified - keep same structure as earlier
    "automotive": {"file_keywords":["dealer","vehicle","auto","car"], "column_keywords":["dealer","vin","model","booking"], "metrics":["sales","units"], "dimensions":["dealer","region"], "value_patterns":{}, "weight":1.2, "icon":"🚗","color":"#004E89"},
    "manufacturing": {"file_keywords":["plant","production","batch"], "column_keywords":["plant","line","throughput","defect"], "metrics":["throughput","defect_rate"], "dimensions":["plant","line"], "value_patterns":{}, "weight":1.3, "icon":"🏭","color":"#6C757D"},
    "retail": {"file_keywords":["store","pos","receipt"], "column_keywords":["store","footfall","aov","inventory"], "metrics":["sales","footfall"], "dimensions":["store","category"], "value_patterns":{}, "weight":1.0, "icon":"🏪","color":"#F77F00"},
    "finance": {"file_keywords":["loan","account"], "column_keywords":["loan","npa","interest"], "metrics":["revenue","npa_rate"], "dimensions":["branch","product"], "value_patterns":{}, "weight":1.2, "icon":"💰","color":"#06A77D"},
    "healthcare": {"file_keywords":["patient","hospital"], "column_keywords":["patient","diagnosis","admission"], "metrics":["patient_count","bed_occupancy"], "dimensions":["hospital","department"], "value_patterns":{}, "weight":1.4, "icon":"🏥","color":"#E63946"},
    "generic": {"file_keywords":[], "column_keywords":["amount","value","quantity","date","id"], "metrics":["amount","value"], "dimensions":["category","type"], "value_patterns":{}, "weight":0.5, "icon":"📊", "color":"#6C757D"}
}

class AdvancedDomainIntelligence:
    @staticmethod
    def detect_domain(dfs: Dict[str, 'pd.DataFrame']) -> Tuple[str, float, Dict[str,float]]:
        scores = {d:0.0 for d in DOMAIN_SIGNATURES.keys()}
        details = {d: {'file':0,'col':0,'pattern':0,'stats':0} for d in DOMAIN_SIGNATURES.keys()}

        for name, df in dfs.items():
            name_l = name.lower()
            for d, sig in DOMAIN_SIGNATURES.items():
                for kw in sig.get('file_keywords', []):
                    if kw in name_l:
                        s = 3.0 * sig['weight']; scores[d]+=s; details[d]['file']+=s

        for name, df in dfs.items():
            cols = [c.lower() for c in df.columns]
            for d, sig in DOMAIN_SIGNATURES.items():
                for kw in sig.get('column_keywords', []):
                    matches = sum(1 for c in cols if kw in c)
                    if matches:
                        s = matches * 2.0 * sig['weight']; scores[d]+=s; details[d]['col']+=s

        # simple stats layer
        for name, df in dfs.items():
            total = max(1, len(df.columns))
            numeric = len(df.select_dtypes(include=[np.number]).columns)
            ratio = numeric/total
            for d, sig in DOMAIN_SIGNATURES.items():
                if d=='ecommerce' and 0.25<=ratio<=0.7:
                    scores[d]+=1.0; details[d]['stats']+=1.0
                if d=='manufacturing' and ratio>0.6:
                    scores[d]+=1.5; details[d]['stats']+=1.5

        top = max(scores, key=scores.get)
        total_score = sum(scores.values()) or 1.0
        conf = scores[top]/total_score
        if details[top]['file']>0 and details[top]['col']>0:
            conf = min(conf*1.2, 1.0)
        return top, conf, scores

    @staticmethod
    def get_domain_config(domain: str) -> Dict:
        cfg = DOMAIN_SIGNATURES.get(domain, DOMAIN_SIGNATURES['generic'])
        return {
            "name": domain,
            "icon": cfg.get('icon','📊'),
            "color": cfg.get('color','#6C757D'),
            "primary_metrics": cfg.get('metrics',[])[:3],
            "primary_dimensions": cfg.get('dimensions',[])[:3],
            "all_metrics": cfg.get('metrics',[]),
            "all_dimensions": cfg.get('dimensions',[])
        }
    @staticmethod
    def get_suggested_queries(domain: str, columns: list):
        """
        Generate contextual natural-language queries based
        on domain signature and actual columns in the dataset.
        """
        from .domain_engine import DOMAIN_SIGNATURES
        sig = DOMAIN_SIGNATURES.get(domain, DOMAIN_SIGNATURES['generic'])

        metrics = []
        dims = []

        # Match actual df columns to domain metrics
        for m in sig.get("metrics", []):
            for col in columns:
                if m in col.lower():
                    metrics.append(col)

        # Match actual dims
        for d in sig.get("dimensions", []):
            for col in columns:
                if d in col.lower():
                    dims.append(col)

        queries = []
        if metrics and dims:
            queries.append(f"top 10 {dims[0]} by {metrics[0]}")
            if len(metrics) > 1:
                queries.append(f"compare {metrics[0]} across {dims[0]}")
            queries.append(f"trend {metrics[0]} over time")
            queries.append(f"show {metrics[0]} where {dims[0]} is highest")

        # fallback
        if not queries:
            queries = ["top 10 rows", "summarize dataset"]

        return queries[:5]
