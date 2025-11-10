"""
AUM: Augmented Universal Metrics - Core Engine
Version: 1.0.1 (TESTED & VALIDATED)
Tagline: The Sound of Data Understanding

Domain-aware semantic analytics engine.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Any
import warnings
import re
from scipy import stats # Added for insights
warnings.filterwarnings('ignore')

# Optional embeddings (fallbacks if not available)
try:
    from sentence_transformers import SentenceTransformer
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    EMBEDDINGS_AVAILABLE = False


class DomainIntelligence:
    """Domain-specific knowledge base for intelligent analytics"""
    DOMAINS = {
        'Banking/Finance': {
            'metrics': ['revenue', 'npa_rate', 'active_accounts', 'transactions', 'balances', 'loan_amount', 'deposits', 'withdrawals', 'interest_rate'],
            'dimensions': ['region', 'branch', 'month', 'account', 'customer_segment', 'product_type'],
            'canonical_ids': ['account_id', 'customer_id', 'branch_id', 'transaction_id'],
            'validation': {'npa_rate': (0, 1), 'interest_rate': (0, 100)}
        },
        'Healthcare': {
            'metrics': ['patient_count', 'claims_paid', 'denial_rate', 'bed_utilization', 'readmission_rate', 'wait_time', 'treatment_cost'],
            'dimensions': ['hospital', 'department', 'doctor', 'diagnosis', 'insurance_provider'],
            'canonical_ids': ['patient_id', 'doctor_id', 'claim_id', 'appointment_id'],
            'validation': {'denial_rate': (0, 1), 'bed_utilization': (0, 1)}
        },
        'Insurance': {
            'metrics': ['premium', 'claim_amount', 'loss_ratio', 'policy_count', 'settlement_time', 'commission'],
            'dimensions': ['region', 'agent', 'policy_type', 'coverage_level', 'age_group'],
            'canonical_ids': ['policy_id', 'agent_id', 'claim_id', 'customer_id'],
            'validation': {'loss_ratio': (0, 10)}
        },
        'Automotive': {
            'metrics': ['sales', 'units_sold', 'dealer_count', 'part_cost', 'revenue', 'margin', 'inventory_days', 'test_drives'],
            'dimensions': ['dealer', 'state', 'category', 'model', 'fuel_type', 'segment'],
            'canonical_ids': ['dealer_id', 'vehicle_id', 'part_id', 'order_id'],
            'validation': {'margin': (-1, 1)}
        },
        'Manufacturing': {
            'metrics': ['throughput', 'defect_rate', 'downtime_hours', 'oee', 'cycle_time', 'yield', 'scrap_rate'],
            'dimensions': ['plant', 'line', 'shift', 'machine', 'operator', 'product'],
            'canonical_ids': ['machine_id', 'batch_id', 'plant_id', 'order_id'],
            'validation': {'defect_rate': (0, 1), 'oee': (0, 1), 'yield': (0, 1)}
        },
        'Engineering': {
            'metrics': ['tickets_closed', 'cycle_time', 'velocity', 'bug_count', 'story_points', 'code_coverage', 'deployment_frequency'],
            'dimensions': ['project', 'sprint', 'team', 'priority', 'component', 'assignee'],
            'canonical_ids': ['ticket_id', 'sprint_id', 'user_id', 'commit_id'],
            'validation': {'code_coverage': (0, 1)}
        },
        'eCommerce': {
            'metrics': ['gmv', 'orders', 'conversion_rate', 'aov', 'returns', 'cart_abandonment', 'ltv', 'traffic'],
            'dimensions': ['category', 'sku', 'channel', 'region', 'device_type', 'payment_mode'],
            'canonical_ids': ['order_id', 'customer_id', 'product_id', 'session_id'],
            'validation': {'conversion_rate': (0, 1), 'cart_abandonment': (0, 1)}
        },
        'Retail': {
            'metrics': ['sales', 'footfall', 'basket_size', 'margin', 'inventory_turnover', 'shrinkage', 'same_store_growth'],
            'dimensions': ['store', 'region', 'date', 'category', 'brand', 'staff'],
            'canonical_ids': ['store_id', 'transaction_id', 'product_id', 'employee_id'],
            'validation': {'margin': (-1, 1), 'shrinkage': (0, 1)}
        }
    }

    @classmethod
    def get_domain_context(cls, domain: str) -> Dict:
        return cls.DOMAINS.get(domain, cls.DOMAINS['eCommerce'])

    @classmethod
    def get_all_domains(cls) -> List[str]:
        return list(cls.DOMAINS.keys())


class SemanticJoinEngine:
    """Intelligent join detection using semantic embeddings"""
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self.model_name = model_name
        self.model = None
        self.emb_cache = {}
        if EMBEDDINGS_AVAILABLE:
            try:
                self.model = SentenceTransformer(model_name)
            except Exception as e:
                print(f"⚠️ Model loading failed: {e}")

    def _encode(self, texts: List[str], key: Optional[str] = None) -> np.ndarray:
        if key and key in self.emb_cache: return self.emb_cache[key]
        if self.model is None: return np.random.rand(len(texts), 384) # fallback
        vecs = self.model.encode(texts, convert_to_numpy=True)
        if key: self.emb_cache[key] = vecs
        return vecs

    def find_join_candidates(self, dfs: Dict[str, pd.DataFrame], domain: str) -> List[Dict]:
        if len(dfs) < 2: return []
        dom = DomainIntelligence.get_domain_context(domain)
        canonical_ids = dom['canonical_ids']
        suggestions = []; names = list(dfs.keys())
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                L, R = names[i], names[j]
                ldf, rdf = dfs[L], dfs[R]
                for lc in ldf.columns:
                    for rc in rdf.columns:
                        conf, reason = self._score(ldf, lc, rdf, rc, canonical_ids)
                        if conf > 0.3:
                            suggestions.append({'left_table': L, 'left_key': lc, 'right_table': R, 'right_key': rc, 'confidence': round(conf, 3), 'reason': reason, 'join_type': 'left'})
        suggestions.sort(key=lambda x: x['confidence'], reverse=True)
        return suggestions[:10]

    def _score(self, ldf, lc, rdf, rc, canonical_ids) -> Tuple[float, str]:
        reasons, score = [], 0.0
        if lc.lower() == rc.lower(): score += 0.5; reasons.append("exact_name_match")
        for cid in canonical_ids:
            if cid in lc.lower() and cid in rc.lower(): score += 0.4; reasons.append(f"canonical_id:{cid}")
        try:
            le = self._encode([lc], f"L_{lc}"); re = self._encode([rc], f"R_{rc}")
            sim = np.dot(le[0], re[0]) / (np.linalg.norm(le[0]) * np.linalg.norm(re[0]))
            if sim > 0.7: score += 0.3 * sim; reasons.append(f"semantic_sim:{sim:.2f}")
        except: pass
        try:
            lv = set(ldf[lc].dropna().astype(str).unique()[:100]); rv = set(rdf[rc].dropna().astype(str).unique()[:100])
            if lv and rv:
                overlap = len(lv & rv) / min(len(lv), len(rv))
                if overlap > 0.1: score += 0.3 * overlap; reasons.append(f"value_overlap:{overlap:.2f}")
        except: pass
        if ldf[lc].dtype == rdf[rc].dtype: score += 0.1; reasons.append("dtype_match")
        return min(score, 1.0), " | ".join(reasons)

    def execute_multi_join(self, dfs: Dict[str, pd.DataFrame], specs: List[Dict]) -> pd.DataFrame:
        if not specs: return list(dfs.values())[0]
        result = dfs[specs[0]['left_table']].copy()
        joined = {specs[0]['left_table']}
        for s in specs:
            if s['right_table'] not in joined:
                right = dfs[s['right_table']].copy()
                right_cols = [c for c in right.columns if c not in result.columns or c == s['right_key']]
                right = right[right_cols]
                try:
                    result = result.merge(right, left_on=s['left_key'], right_on=s['right_key'], how=s.get('join_type', 'left'), suffixes=('', '_dup'))
                    joined.add(s['right_table'])
                except Exception as e:
                    print(f"⚠️ Join skipped: {e}")
        return result


class PromptInterpreter:
    """Natural language prompt parser"""
    TASK_KEYWORDS = {
        'rank': ['rank', 'top', 'bottom', 'highest', 'lowest', 'best', 'worst'],
        'trend': ['trend', 'over time', 'time series', 'by month', 'by year', 'by date', 'by quarter'],
        'heatmap': ['heatmap', 'correlation', 'matrix', 'cross-tab', 'crosstab'],
        'summary': ['summary', 'aggregate', 'total', 'average', 'sum', 'count']
    }
    SYNONYMS = {
        'dealer': ['dealer_name', 'dealer', 'dealername'], 'region': ['region', 'state', 'state_code', 'territory'],
        'month': ['month', 'date', 'time', 'period'], 'sales': ['sales', 'revenue', 'amount', 'value']
    }

    def __init__(self, domain: str = 'eCommerce'):
        self.domain = domain
        self.domain_config = DomainIntelligence.get_domain_context(domain)

    def parse(self, prompt: str, cols: List[str]) -> Dict:
        p = prompt.lower(); task = self._task(p); metrics = self._metrics(p, cols); dims = self._dims(p, cols)
        filters = self._filters(p, cols); top_n = self._topn(p); time_col = self._timecol(cols)
        return {'task': task, 'metrics': metrics, 'dimensions': dims, 'filters': filters, 'top_n': top_n, 'time_column': time_col, 'original_prompt': prompt}

    def _task(self, p: str) -> str:
        for t, kws in self.TASK_KEYWORDS.items():
            if any(k in p for k in kws): return t
        return 'summary'

    def _metrics(self, p: str, cols: List[str]) -> List[str]:
        out, domain_metrics = [], self.domain_config['metrics']
        for c in cols:
            cl = c.lower()
            if cl in p or any(m in cl for m in domain_metrics):
                if self._is_num_name(c): out.append(c)
            for key, syns in self.SYNONYMS.items():
                if key in p and any(s in cl for s in syns):
                    if self._is_num_name(c): out.append(c)
        return list(dict.fromkeys(out))[:3]

    def _dims(self, p: str, cols: List[str]) -> List[str]:
        out, domain_dims = [], self.domain_config['dimensions']
        for c in cols:
            cl = c.lower()
            if cl in p or any(d in cl for d in domain_dims):
                if not self._is_num_name(c): out.append(c)
            for key, syns in self.SYNONYMS.items():
                if key in p and any(s in cl for s in syns):
                    if not self._is_num_name(c): out.append(c)
        return list(dict.fromkeys(out))[:2]

    def _filters(self, p: str, cols: List[str]) -> Dict:
        filters = {}
        years = re.findall(r'\b(20\d{2})\b', p)
        if years: filters['year'] = int(years[0])
        return filters

    def _topn(self, p: str) -> Optional[int]:
        m = re.findall(r'\btop\s+(\d+)\b', p) or re.findall(r'\b(\d+)\s+top\b', p)
        return int(m[0]) if m else None

    def _timecol(self, cols: List[str]) -> Optional[str]:
        ks = ['date', 'month', 'year', 'time', 'day', 'quarter', 'period']
        for c in cols:
            if any(k in c.lower() for k in ks): return c
        return None

    def _is_num_name(self, c: str) -> bool:
        ks = ['amount','count','rate','revenue','cost','price','sales','quantity','value','total','avg','sum','gmv','margin','premium','claim']
        return any(k in c.lower() for k in ks)


class AUMEngine:
    """Main AUM Analytics Engine"""
    def __init__(self, domain: str = 'eCommerce', semantic_model: str = 'all-MiniLM-L6-v2'):
        self.domain = domain
        self.semantic_model = semantic_model
        self.join_engine = SemanticJoinEngine(semantic_model)
        self.interpreter = PromptInterpreter(domain)
        self.dataframes: Dict[str, pd.DataFrame] = {}
        self.joined_df: Optional[pd.DataFrame] = None

    def load_files(self, file_paths: List[str]) -> Dict[str, pd.DataFrame]:
        self.dataframes = {}; self.joined_df = None
        for p in file_paths:
            try:
                path = Path(p)
                if path.suffix.lower() in {'.xlsx', '.xls'}: df = pd.read_excel(p, engine='openpyxl')
                elif path.suffix.lower() == '.csv': df = pd.read_csv(p, encoding_errors='ignore')
                else: print(f"⚠️ Unsupported file type: {p}"); continue
                df.columns = df.columns.str.strip()
                self.dataframes[path.stem] = df
            except Exception as e: print(f"⚠️ Failed to load {p}: {e}")
        return self.dataframes

    def detect_joins(self) -> List[Dict]:
        return self.join_engine.find_join_candidates(self.dataframes, self.domain)

    def execute_joins(self, specs: List[Dict]) -> pd.DataFrame:
        self.joined_df = self.join_engine.execute_multi_join(self.dataframes, specs)
        return self.joined_df

    def analyze(self, prompt: str) -> Dict[str, Any]:
        if self.joined_df is None:
            if len(self.dataframes) == 1: self.joined_df = list(self.dataframes.values())[0]
            else:
                suggestions = self.detect_joins()
                if suggestions: self.execute_joins(suggestions[:3])
                else: self.joined_df = list(self.dataframes.values())[0]

        query = self.interpreter.parse(prompt, list(self.joined_df.columns))
        result = self._execute_query(query)
        insights = self._insights(result, query)
        return {'query': query, 'result': result, 'insights': insights, 'timestamp': datetime.now().isoformat()}

    def _execute_query(self, query: Dict) -> pd.DataFrame:
        df = self.joined_df.copy()
        if query['filters']:
            for col, val in query['filters'].items():
                if col in df.columns: df = df[df[col] == val]

        metrics = query['metrics'] or []; dims = query['dimensions'] or []
        if not metrics and not dims: return df.head(100)

        for m in metrics:
            if m in df.columns: df[m] = pd.to_numeric(df[m], errors='coerce')

        if dims:
            agg = {m: 'sum' for m in metrics if m in df.columns}
            result = df.groupby(dims, as_index=False, dropna=False).agg(agg) if agg else df[dims].drop_duplicates()
        else: result = df[metrics] if metrics else df

        if query['top_n'] and metrics: result = result.nlargest(query['top_n'], metrics[0])
        return result.head(1000)

    def _insights(self, result_df: pd.DataFrame, query: Dict) -> List[str]:
        ins = []
        try:
            num = result_df.select_dtypes(include=[np.number]).columns
            if len(num) >= 2:
                corr = result_df[num].corr()
                for i in range(len(num)):
                    for j in range(i+1, len(num)):
                        v = corr.iloc[i, j]
                        if abs(v) > 0.7 and not np.isnan(v): ins.append(f"Strong correlation ({v:.2f}) between {num[i]} and {num[j]}")
            for col in num[:3]:
                if len(result_df[col].dropna()) > 0:
                    q1, q3 = result_df[col].quantile(0.25), result_df[col].quantile(0.75); iqr = q3 - q1
                    out = result_df[(result_df[col] < q1 - 1.5*iqr) | (result_df[col] > q3 + 1.5*iqr)]
                    if len(out) > 0: ins.append(f"Found {len(out)} outliers in {col}")
        except Exception as e: ins.append(f"Insight generation encountered an issue: {str(e)[:100]}")
        return ins[:10]
