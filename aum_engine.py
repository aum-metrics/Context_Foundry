"""
AUM: Augmented Universal Metrics - Core Engine
Version: 1.0.2 (PROMPT PARSING FIXES)
Tagline: The Sound of Data Understanding

FIXES:
- Improved prompt parsing to better extract metrics and dimensions
- Enhanced synonym matching for common column variations
- Better handling of "by" keyword in prompts
- Fixed metric detection to include all numeric-like columns
"""

import pandas as pd
import numpy as np
import hashlib
import json
import os
import re
from scipy import stats
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Any
import warnings
warnings.filterwarnings('ignore')

# ML/AI Libraries
try:
    from sentence_transformers import SentenceTransformer
    import torch
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    print("⚠️ SentenceTransformers not installed. Run: pip install sentence-transformers torch")
    EMBEDDINGS_AVAILABLE = False

# Database
try:
    import duckdb
    DUCKDB_AVAILABLE = True
except ImportError:
    print("⚠️ DuckDB not installed. Run: pip install duckdb")
    DUCKDB_AVAILABLE = False


class DomainIntelligence:
    """Domain-specific knowledge base for intelligent analytics"""
    
    DOMAINS = {
        'Banking/Finance': {
            'metrics': ['revenue', 'npa_rate', 'active_accounts', 'transactions', 'balances', 
                       'loan_amount', 'deposits', 'withdrawals', 'interest_rate'],
            'dimensions': ['region', 'branch', 'month', 'account', 'customer_segment', 'product_type'],
            'canonical_ids': ['account_id', 'customer_id', 'branch_id', 'transaction_id'],
            'validation': {'npa_rate': (0, 1), 'interest_rate': (0, 100)}
        },
        'Healthcare': {
            'metrics': ['patient_count', 'claims_paid', 'denial_rate', 'bed_utilization',
                       'readmission_rate', 'wait_time', 'treatment_cost'],
            'dimensions': ['hospital', 'department', 'doctor', 'diagnosis', 'insurance_provider'],
            'canonical_ids': ['patient_id', 'doctor_id', 'claim_id', 'appointment_id'],
            'validation': {'denial_rate': (0, 1), 'bed_utilization': (0, 1)}
        },
        'Insurance': {
            'metrics': ['premium', 'claim_amount', 'loss_ratio', 'policy_count', 
                       'settlement_time', 'commission'],
            'dimensions': ['region', 'agent', 'policy_type', 'coverage_level', 'age_group'],
            'canonical_ids': ['policy_id', 'agent_id', 'claim_id', 'customer_id'],
            'validation': {'loss_ratio': (0, 10)}
        },
        'Automotive': {
            'metrics': ['sales', 'units_sold', 'dealer_count', 'part_cost', 'revenue',
                       'margin', 'inventory_days', 'test_drives'],
            'dimensions': ['dealer', 'state', 'category', 'model', 'fuel_type', 'segment'],
            'canonical_ids': ['dealer_id', 'vehicle_id', 'part_id', 'order_id'],
            'validation': {'margin': (-1, 1)}
        },
        'Manufacturing': {
            'metrics': ['throughput', 'defect_rate', 'downtime_hours', 'oee', 
                       'cycle_time', 'yield', 'scrap_rate'],
            'dimensions': ['plant', 'line', 'shift', 'machine', 'operator', 'product'],
            'canonical_ids': ['machine_id', 'batch_id', 'plant_id', 'order_id'],
            'validation': {'defect_rate': (0, 1), 'oee': (0, 1), 'yield': (0, 1)}
        },
        'Engineering': {
            'metrics': ['tickets_closed', 'cycle_time', 'velocity', 'bug_count',
                       'story_points', 'code_coverage', 'deployment_frequency'],
            'dimensions': ['project', 'sprint', 'team', 'priority', 'component', 'assignee'],
            'canonical_ids': ['ticket_id', 'sprint_id', 'user_id', 'commit_id'],
            'validation': {'code_coverage': (0, 1)}
        },
        'eCommerce': {
            'metrics': ['gmv', 'orders', 'conversion_rate', 'aov', 'returns',
                       'cart_abandonment', 'ltv', 'traffic'],
            'dimensions': ['category', 'sku', 'channel', 'region', 'device_type', 'payment_mode'],
            'canonical_ids': ['order_id', 'customer_id', 'product_id', 'session_id'],
            'validation': {'conversion_rate': (0, 1), 'cart_abandonment': (0, 1)}
        },
        'Retail': {
            'metrics': ['sales', 'footfall', 'basket_size', 'margin', 'inventory_turnover',
                       'shrinkage', 'same_store_growth'],
            'dimensions': ['store', 'region', 'date', 'category', 'brand', 'staff'],
            'canonical_ids': ['store_id', 'transaction_id', 'product_id', 'employee_id'],
            'validation': {'margin': (-1, 1), 'shrinkage': (0, 1)}
        }
    }
    
    @classmethod
    def get_domain_context(cls, domain: str) -> Dict:
        """Get full domain configuration"""
        return cls.DOMAINS.get(domain, cls.DOMAINS['eCommerce'])
    
    @classmethod
    def get_all_domains(cls) -> List[str]:
        """Return list of available domains"""
        return list(cls.DOMAINS.keys())
    
    @classmethod
    def suggest_domain(cls, columns: List[str]) -> str:
        """Auto-detect domain from column names"""
        columns_lower = [c.lower() for c in columns]
        scores = {}
        
        for domain, config in cls.DOMAINS.items():
            score = 0
            all_keywords = (config['metrics'] + config['dimensions'] + 
                          config['canonical_ids'])
            
            for keyword in all_keywords:
                if any(keyword in col for col in columns_lower):
                    score += 1
            
            scores[domain] = score
        
        return max(scores, key=scores.get) if scores else 'eCommerce'


class SemanticJoinEngine:
    """Intelligent join detection using semantic embeddings"""
    
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        """Initialize with SentenceTransformer model"""
        self.model_name = model_name
        self.model = None
        self.embeddings_cache = {}
        
        if EMBEDDINGS_AVAILABLE:
            try:
                self.model = SentenceTransformer(model_name)
            except Exception as e:
                print(f"⚠️ Model loading failed: {e}")
    
    def compute_embeddings(self, texts: List[str], cache_key: str = None) -> np.ndarray:
        """Compute embeddings with caching"""
        if cache_key and cache_key in self.embeddings_cache:
            return self.embeddings_cache[cache_key]
        
        if self.model is None:
            return np.random.rand(len(texts), 384)
        
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        
        if cache_key:
            self.embeddings_cache[cache_key] = embeddings
        
        return embeddings
    
    def find_join_candidates(self, 
                            dfs: Dict[str, pd.DataFrame],
                            domain: str = 'eCommerce') -> List[Dict]:
        """Find potential join keys across dataframes"""
        if len(dfs) < 2:
            return []
        
        domain_config = DomainIntelligence.get_domain_context(domain)
        canonical_ids = domain_config['canonical_ids']
        
        suggestions = []
        df_names = list(dfs.keys())
        
        for i in range(len(df_names)):
            for j in range(i + 1, len(df_names)):
                left_name = df_names[i]
                right_name = df_names[j]
                left_df = dfs[left_name]
                right_df = dfs[right_name]
                
                for left_col in left_df.columns:
                    for right_col in right_df.columns:
                        confidence, reason = self._score_join_pair(
                            left_df, left_col, right_df, right_col, canonical_ids
                        )
                        
                        if confidence > 0.3:
                            suggestions.append({
                                'left_table': left_name,
                                'left_key': left_col,
                                'right_table': right_name,
                                'right_key': right_col,
                                'confidence': round(confidence, 3),
                                'reason': reason,
                                'join_type': 'left'
                            })
        
        suggestions.sort(key=lambda x: x['confidence'], reverse=True)
        return suggestions[:10]
    
    def _score_join_pair(self, 
                        left_df: pd.DataFrame, left_col: str,
                        right_df: pd.DataFrame, right_col: str,
                        canonical_ids: List[str]) -> Tuple[float, str]:
        """Score a potential join pair"""
        reasons = []
        score = 0.0
        
        # Exact name match
        if left_col.lower() == right_col.lower():
            score += 0.5
            reasons.append("exact_name_match")
        
        # Canonical ID match
        for canonical in canonical_ids:
            if canonical in left_col.lower() and canonical in right_col.lower():
                score += 0.4
                reasons.append(f"canonical_id:{canonical}")
        
        # Semantic similarity
        if self.model is not None:
            try:
                left_emb = self.compute_embeddings([left_col], f"left_{left_col}")
                right_emb = self.compute_embeddings([right_col], f"right_{right_col}")
                
                similarity = np.dot(left_emb[0], right_emb[0]) / (
                    np.linalg.norm(left_emb[0]) * np.linalg.norm(right_emb[0])
                )
                
                if similarity > 0.7:
                    score += 0.3 * similarity
                    reasons.append(f"semantic_sim:{similarity:.2f}")
            except:
                pass
        
        # Value overlap
        try:
            left_vals = set(left_df[left_col].dropna().astype(str).unique()[:100])
            right_vals = set(right_df[right_col].dropna().astype(str).unique()[:100])
            
            if left_vals and right_vals:
                overlap = len(left_vals & right_vals) / min(len(left_vals), len(right_vals))
                if overlap > 0.1:
                    score += 0.3 * overlap
                    reasons.append(f"value_overlap:{overlap:.2f}")
        except:
            pass
        
        # Data type compatibility
        if left_df[left_col].dtype == right_df[right_col].dtype:
            score += 0.1
            reasons.append("dtype_match")
        
        return min(score, 1.0), " | ".join(reasons)
    
    def execute_join(self, 
                     dfs: Dict[str, pd.DataFrame],
                     join_spec: Dict) -> pd.DataFrame:
        """Execute a single join operation"""
        left_name = join_spec['left_table']
        right_name = join_spec['right_table']
        left_key = join_spec['left_key']
        right_key = join_spec['right_key']
        how = join_spec.get('join_type', 'left')
        
        left_df = dfs[left_name].copy()
        right_df = dfs[right_name].copy()
        
        # Avoid duplicate columns
        right_cols = [c for c in right_df.columns if c not in left_df.columns or c == right_key]
        right_df = right_df[right_cols]
        
        try:
            result = pd.merge(
                left_df, right_df,
                left_on=left_key,
                right_on=right_key,
                how=how,
                suffixes=('', '_right')
            )
            return result
        except Exception as e:
            print(f"⚠️ Join failed: {e}")
            return left_df
    
    def execute_multi_join(self,
                          dfs: Dict[str, pd.DataFrame],
                          join_specs: List[Dict]) -> pd.DataFrame:
        """Execute multiple joins sequentially"""
        if not join_specs:
            return list(dfs.values())[0]
        
        result = dfs[join_specs[0]['left_table']].copy()
        joined_tables = {join_specs[0]['left_table']}
        
        for spec in join_specs:
            if spec['right_table'] not in joined_tables:
                right_df = dfs[spec['right_table']].copy()
                
                right_cols = [c for c in right_df.columns 
                            if c not in result.columns or c == spec['right_key']]
                right_df = right_df[right_cols]
                
                try:
                    result = pd.merge(
                        result, right_df,
                        left_on=spec['left_key'],
                        right_on=spec['right_key'],
                        how=spec.get('join_type', 'left'),
                        suffixes=('', '_dup')
                    )
                    joined_tables.add(spec['right_table'])
                except Exception as e:
                    print(f"⚠️ Join skipped: {e}")
        
        return result


class PromptInterpreter:
    """Natural language prompt parser with improved extraction"""
    
    TASK_KEYWORDS = {
        'rank': ['rank', 'top', 'bottom', 'highest', 'lowest', 'best', 'worst'],
        'trend': ['trend', 'over time', 'time series', 'by month', 'by year', 'by date', 'by quarter'],
        'heatmap': ['heatmap', 'correlation', 'matrix', 'cross-tab', 'crosstab'],
        'summary': ['summary', 'aggregate', 'total', 'average', 'sum', 'count']
    }
    
    # Enhanced synonym mapping
    SYNONYMS = {
        'dealer': ['dealer_name', 'dealer', 'dealername', 'dealer_id'],
        'state': ['state_code', 'region', 'state', 'territory'],
        'month': ['month', 'date', 'time', 'period'],
        'sales': ['sales', 'revenue', 'amount', 'value'],
        'quantity': ['quantity', 'qty', 'units', 'count'],
        'price': ['price', 'unit_price', 'cost'],
    }
    
    def __init__(self, domain: str = 'eCommerce'):
        self.domain = domain
        self.domain_config = DomainIntelligence.get_domain_context(domain)
    
    def parse(self, prompt: str, available_columns: List[str]) -> Dict:
        """Parse natural language prompt into structured query - IMPROVED"""
        prompt_lower = prompt.lower()
        
        # Detect task type
        task = self._detect_task(prompt_lower)
        
        # Extract metrics and dimensions with improved logic
        metrics = self._extract_metrics(prompt_lower, available_columns)
        dimensions = self._extract_dimensions(prompt_lower, available_columns)
        
        # Extract filters
        filters = self._extract_filters(prompt_lower, available_columns)
        
        # Extract top-N
        top_n = self._extract_top_n(prompt_lower)
        
        # Time column detection
        time_col = self._detect_time_column(available_columns)
        
        return {
            'task': task,
            'metrics': metrics,
            'dimensions': dimensions,
            'filters': filters,
            'top_n': top_n,
            'time_column': time_col,
            'original_prompt': prompt
        }
    
    def _detect_task(self, prompt: str) -> str:
        """Detect primary task type"""
        for task, keywords in self.TASK_KEYWORDS.items():
            if any(kw in prompt for kw in keywords):
                return task
        return 'rank'  # Default to rank for most queries
    
    def _extract_metrics(self, prompt: str, columns: List[str]) -> List[str]:
        """Extract metric columns - IMPROVED"""
        metrics = []
        domain_metrics = self.domain_config['metrics']
        
        # Get all numeric columns first
        numeric_indicators = ['sales', 'revenue', 'amount', 'price', 'cost', 'quantity', 
                            'count', 'total', 'value', 'sum', 'avg', 'rate', 'margin']
        
        # PRIORITY: Direct exact mention in prompt (e.g., "by sales" should find "sales" column)
        for col in columns:
            col_lower = col.lower()
            
            # Exact match has highest priority
            if col_lower in prompt.split():
                if self._is_numeric_column_name(col):
                    metrics.insert(0, col)  # Add to front
                    continue
        
        # Secondary: Partial matches and indicators
        for col in columns:
            col_lower = col.lower()
            
            # Skip if already added
            if col in metrics:
                continue
            
            # Check domain metrics
            for metric in domain_metrics:
                if metric in col_lower and self._is_numeric_column_name(col):
                    metrics.append(col)
                    break
            
            # Check numeric indicators only if column name suggests it's numeric
            if any(indicator in col_lower for indicator in numeric_indicators):
                if self._is_numeric_column_name(col):
                    metrics.append(col)
            
            # Check synonyms
            for key, synonyms in self.SYNONYMS.items():
                if key in prompt and any(syn in col_lower for syn in synonyms):
                    if self._is_numeric_column_name(col):
                        metrics.append(col)
                        break
        
        # Remove duplicates while preserving order
        seen = set()
        unique_metrics = []
        for m in metrics:
            if m not in seen:
                seen.add(m)
                unique_metrics.append(m)
        
        # If no metrics found, default to first numeric-looking column
        if not unique_metrics:
            for col in columns:
                if self._is_numeric_column_name(col):
                    unique_metrics.append(col)
                    break
        
        return unique_metrics[:3]  # Limit to 3
    
    def _extract_dimensions(self, prompt: str, columns: List[str]) -> List[str]:
        """Extract dimension columns - IMPROVED"""
        dimensions = []
        domain_dims = self.domain_config['dimensions']
        
        # Parse "by" keyword - this is the most important signal
        by_pattern = r'\bby\s+(\w+(?:\s+\w+)?)'
        by_matches = re.findall(by_pattern, prompt)
        
        # Priority 1: Columns mentioned after "by"
        for match in by_matches:
            match_normalized = match.replace(' ', '_').lower()
            for col in columns:
                col_lower = col.lower()
                # Skip ID columns unless explicitly mentioned
                if match == 'dealers' or match == 'dealer':
                    # For "dealers", prefer "dealer_name" over "dealer_id"
                    if 'name' in col_lower and 'dealer' in col_lower:
                        if not self._is_numeric_column_name(col):
                            dimensions.insert(0, col)  # Add to front
                            break
                    elif 'dealer' in col_lower and 'id' not in col_lower:
                        if not self._is_numeric_column_name(col):
                            dimensions.append(col)
                elif match_normalized in col_lower or match.replace(' ', '') in col_lower:
                    if not self._is_numeric_column_name(col):
                        dimensions.append(col)
        
        # Priority 2: Direct column name mention (but not after "by")
        for col in columns:
            col_lower = col.lower()
            
            # Skip if already added
            if col in dimensions:
                continue
            
            # Skip metric-like columns
            if self._is_numeric_column_name(col):
                continue
            
            # Check if column name appears in prompt (not after "by")
            if col_lower in prompt and col not in dimensions:
                dimensions.append(col)
        
        # Priority 3: Domain dimensions
        for col in columns:
            if col in dimensions:
                continue
            if self._is_numeric_column_name(col):
                continue
                
            col_lower = col.lower()
            for dim in domain_dims:
                if dim in col_lower:
                    dimensions.append(col)
                    break
        
        # Remove duplicates while preserving order
        seen = set()
        unique_dims = []
        for d in dimensions:
            if d not in seen:
                seen.add(d)
                unique_dims.append(d)
        
        return unique_dims[:2]  # Limit to 2
    
    def _extract_filters(self, prompt: str, columns: List[str]) -> Dict:
        """Extract filter conditions"""
        filters = {}
        
        # Year extraction
        years = re.findall(r'\b(20\d{2})\b', prompt)
        if years:
            filters['year'] = int(years[0])
        
        return filters
    
    def _extract_top_n(self, prompt: str) -> Optional[int]:
        """Extract top-N value"""
        matches = re.findall(r'\btop\s+(\d+)\b', prompt)
        if matches:
            return int(matches[0])
        matches = re.findall(r'\b(\d+)\s+top\b', prompt)
        if matches:
            return int(matches[0])
        return None
    
    def _detect_time_column(self, columns: List[str]) -> Optional[str]:
        """Detect time-series column"""
        time_keywords = ['date', 'month', 'year', 'time', 'day', 'quarter', 'period']
        for col in columns:
            if any(kw in col.lower() for kw in time_keywords):
                return col
        return None
    
    def _is_numeric_column_name(self, col: str) -> bool:
        """Heuristic to detect if column is likely numeric"""
        numeric_keywords = ['amount', 'count', 'rate', 'revenue', 'cost', 'price',
                          'sales', 'quantity', 'value', 'total', 'avg', 'sum', 'gmv',
                          'margin', 'premium', 'claim', 'units', 'qty']
        return any(kw in col.lower() for kw in numeric_keywords)


class AUMEngine:
    """Main AUM Analytics Engine"""
    
    def __init__(self, domain: str = 'eCommerce', semantic_model: str = 'all-MiniLM-L6-v2'):
        self.domain = domain
        self.semantic_model = semantic_model
        self.join_engine = SemanticJoinEngine(semantic_model)
        self.interpreter = PromptInterpreter(domain)
        self.dataframes: Dict[str, pd.DataFrame] = {}
        self.joined_df: Optional[pd.DataFrame] = None
        self.metadata = {}
    
    def load_files(self, file_paths: List[str]) -> Dict[str, pd.DataFrame]:
        """Load multiple CSV/XLSX files"""
        self.dataframes = {}
        self.joined_df = None
        
        for path in file_paths:
            try:
                path_obj = Path(path)
                
                if path_obj.suffix.lower() in {'.xlsx', '.xls'}:
                    df = pd.read_excel(path, engine='openpyxl')
                elif path_obj.suffix.lower() == '.csv':
                    df = pd.read_csv(path, encoding_errors='ignore')
                else:
                    print(f"⚠️ Unsupported file type: {path}")
                    continue
                
                df.columns = df.columns.str.strip()
                name = path_obj.stem
                self.dataframes[name] = df
                
            except Exception as e:
                print(f"⚠️ Failed to load {path}: {e}")
        
        return self.dataframes
    
    def detect_joins(self) -> List[Dict]:
        """Detect possible joins"""
        return self.join_engine.find_join_candidates(self.dataframes, self.domain)
    
    def execute_joins(self, join_specs: List[Dict]) -> pd.DataFrame:
        """Execute selected joins"""
        self.joined_df = self.join_engine.execute_multi_join(self.dataframes, join_specs)
        return self.joined_df
    
    def analyze(self, prompt: str) -> Dict[str, Any]:
        """Main analysis pipeline"""
        if self.joined_df is None:
            if len(self.dataframes) == 1:
                self.joined_df = list(self.dataframes.values())[0]
            else:
                suggestions = self.detect_joins()
                if suggestions:
                    self.execute_joins(suggestions[:3])
                else:
                    self.joined_df = list(self.dataframes.values())[0]
        
        # Parse prompt
        query = self.interpreter.parse(prompt, list(self.joined_df.columns))
        
        # Execute analysis
        result = self._execute_query(query)
        
        # Generate insights
        insights = self._generate_insights(result, query)
        
        return {
            'query': query,
            'result': result,
            'insights': insights,
            'timestamp': datetime.now().isoformat()
        }
    
    def _execute_query(self, query: Dict) -> pd.DataFrame:
        """Execute parsed query on joined data"""
        df = self.joined_df.copy()
        
        # Apply filters
        if query['filters']:
            for col, val in query['filters'].items():
                if col == 'year' and query.get('time_column'):
                    time_col = query['time_column']
                    try:
                        df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
                        df = df[df[time_col].dt.year == val]
                    except Exception as e:
                        print(f"Could not apply year filter: {e}")
                elif col in df.columns:
                    df = df[df[col] == val]
        
        metrics = query['metrics'] if query['metrics'] else []
        dimensions = query['dimensions'] if query['dimensions'] else []
        
        # If no metrics or dimensions, return sample
        if not metrics and not dimensions:
            return df.head(100)
        
        # Ensure numeric metrics
        for m in metrics:
            if m in df.columns:
                df[m] = pd.to_numeric(df[m], errors='coerce')
        
        # CRITICAL FIX: Aggregate properly when dimensions exist
        if dimensions:
            # Ensure dimensions exist in dataframe
            valid_dims = [d for d in dimensions if d in df.columns]
            valid_metrics = [m for m in metrics if m in df.columns]
            
            if valid_dims and valid_metrics:
                # Aggregate all metrics by summing
                agg_dict = {m: 'sum' for m in valid_metrics}
                result = df.groupby(valid_dims, as_index=False, dropna=False).agg(agg_dict)
            elif valid_dims:
                # Only dimensions, no metrics - return unique combinations
                result = df[valid_dims].drop_duplicates()
            else:
                result = df
        else:
            # No dimensions - just sum metrics
            if metrics:
                valid_metrics = [m for m in metrics if m in df.columns]
                if valid_metrics:
                    result = df[valid_metrics].sum().to_frame().T
                else:
                    result = df
            else:
                result = df
        
        # Apply top-N sorting
        if query['top_n'] and metrics and len(metrics) > 0:
            # Sort by first metric descending
            if metrics[0] in result.columns:
                result = result.nlargest(query['top_n'], metrics[0])
        
        return result.head(1000)  # Safety limit
    
    def _generate_insights(self, result_df: pd.DataFrame, query: Dict) -> List[str]:
        """Generate human-readable insights"""
        insights = []
        
        try:
            # Correlation insights
            numeric_cols = result_df.select_dtypes(include=[np.number]).columns
            if len(numeric_cols) >= 2:
                corr = result_df[numeric_cols].corr()
                for i in range(len(numeric_cols)):
                    for j in range(i+1, len(numeric_cols)):
                        val = corr.iloc[i, j]
                        if abs(val) > 0.7 and not np.isnan(val):
                            insights.append(
                                f"Strong correlation ({val:.2f}) between "
                                f"{numeric_cols[i]} and {numeric_cols[j]}"
                            )
            
            # Outlier detection
            for col in numeric_cols[:3]:
                if len(result_df[col].dropna()) > 0:
                    q1 = result_df[col].quantile(0.25)
                    q3 = result_df[col].quantile(0.75)
                    iqr = q3 - q1
                    if iqr > 0:
                        outliers = result_df[(result_df[col] < q1 - 1.5*iqr) | 
                                            (result_df[col] > q3 + 1.5*iqr)]
                        if len(outliers) > 0:
                            insights.append(f"Found {len(outliers)} outliers in {col}")
            
            # Domain validations
            domain_config = DomainIntelligence.get_domain_context(self.domain)
            for col, (min_val, max_val) in domain_config.get('validation', {}).items():
                if col in result_df.columns:
                    violations = result_df[(result_df[col] < min_val) | 
                                          (result_df[col] > max_val)]
                    if len(violations) > 0:
                        insights.append(
                            f"⚠️ {len(violations)} records violate {col} "
                            f"expected range [{min_val}, {max_val}]"
                        )
        
        except Exception as e:
            insights.append(f"Insight generation encountered an issue: {str(e)[:100]}")
        
        return insights[:10]
    
    def export_results(self, output_dir: str, project_id: str) -> Dict[str, str]:
        """Export analysis results"""
        output_path = Path(output_dir) / project_id
        output_path.mkdir(parents=True, exist_ok=True)
        
        files = {}
        
        if self.joined_df is not None:
            csv_path = output_path / f"joined_{project_id}.csv"
            self.joined_df.to_csv(csv_path, index=False)
            files['joined_data'] = str(csv_path)
        
        meta_path = output_path / "metadata.json"
        self.metadata['timestamp'] = datetime.now().isoformat()
        with open(meta_path, 'w') as f:
            json.dump(self.metadata, f, indent=2, default=str)
        files['metadata'] = str(meta_path)
        
        return files


if __name__ == "__main__":
    print("🎵 AUM Engine v1.0.2 - The Sound of Data Understanding")
    print("=" * 60)
    
    engine = AUMEngine(domain='Automotive')
    print(f"✅ Engine initialized with domain: {engine.domain}")
    print(f"✅ Available domains: {', '.join(DomainIntelligence.get_all_domains())}")
