# backend/app/engines/domain_engine.py - MASSIVELY IMPROVED VERSION
import numpy as np
import pandas as pd
from typing import Dict, Tuple, List, Set
import re
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Enhanced domain signatures with more comprehensive patterns
DOMAIN_SIGNATURES = {
    "ecommerce": {
        "file_keywords": [
            "order", "cart", "product", "sku", "ecom", "marketplace", "seller", 
            "amazon", "shopify", "sales", "customer", "checkout", "transaction",
            "purchase", "payment", "shipping", "delivery", "invoice"
        ],
        "column_keywords": [
            "sku", "asin", "product", "item", "gmv", "order", "cart", "conversion",
            "returns", "revenue", "sales", "price", "quantity", "customer",
            "shipping", "payment", "checkout", "total", "subtotal", "discount",
            "coupon", "refund", "category", "brand", "rating", "review"
        ],
        "metrics": ["gmv", "orders", "revenue", "aov", "conversion_rate", "units_sold", "cart_value"],
        "dimensions": ["category", "brand", "channel", "region", "sku", "seller_id", "customer_segment"],
        "value_patterns": {
            "sku": r"^[A-Z0-9\-_]{3,}$",
            "order_id": r"^(ORD|ORDER|INV)[-_]?\d+$",
            "product_id": r"^(PROD|ITEM|SKU)[-_]?\d+$"
        },
        "required_columns": [["order", "product", "sku"], ["revenue", "sales", "amount"]],
        "weight": 1.2,
        "icon": "🛒",
        "color": "#FF6B35"
    },
    "automotive": {
        "file_keywords": [
            "dealer", "vehicle", "auto", "car", "booking", "showroom", "test_drive",
            "automobile", "automotive", "registration", "inventory", "dealership"
        ],
        "column_keywords": [
            "dealer", "vin", "model", "booking", "vehicle", "registration", "chassis",
            "engine", "variant", "color", "manufacturer", "showroom", "test_drive",
            "delivery", "invoice", "insurance", "finance", "loan"
        ],
        "metrics": ["sales", "units", "bookings", "revenue", "test_drives"],
        "dimensions": ["dealer", "region", "model", "variant", "manufacturer"],
        "value_patterns": {
            "vin": r"^[A-HJ-NPR-Z0-9]{17}$",
            "registration": r"^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$"
        },
        "required_columns": [["dealer", "vehicle", "model"], ["booking", "sales"]],
        "weight": 1.3,
        "icon": "🚗",
        "color": "#004E89"
    },
    "manufacturing": {
        "file_keywords": [
            "plant", "production", "batch", "assembly", "factory", "oee",
            "manufacturing", "line", "machine", "equipment", "process", "quality"
        ],
        "column_keywords": [
            "plant", "line", "throughput", "defect", "batch", "shift", "downtime",
            "oee", "availability", "performance", "quality", "yield", "scrap",
            "machine", "equipment", "operator", "cycle_time", "setup_time",
            "maintenance", "production", "output", "units"
        ],
        "metrics": ["throughput", "defect_rate", "oee", "units_produced", "yield", "availability"],
        "dimensions": ["plant", "line", "shift", "operator", "machine", "batch"],
        "value_patterns": {
            "batch": r"^BATCH[-_]?\d+$",
            "plant": r"^(PLT|PLANT)[-_]?\d+$"
        },
        "required_columns": [["plant", "line", "machine"], ["production", "throughput", "output"]],
        "weight": 1.4,
        "icon": "🏭",
        "color": "#6C757D"
    },
    "retail": {
        "file_keywords": [
            "store", "pos", "receipt", "footfall", "inventory", "retail",
            "shop", "outlet", "branch", "location", "transaction", "till"
        ],
        "column_keywords": [
            "store", "footfall", "aov", "inventory", "stock", "transaction",
            "basket", "receipt", "pos", "cashier", "counter", "location",
            "branch", "outlet", "customer_count", "traffic", "conversion",
            "units_per_transaction", "category", "department"
        ],
        "metrics": ["sales", "footfall", "basket_size", "inventory_turnover", "aov"],
        "dimensions": ["store", "category", "location", "department", "cashier"],
        "value_patterns": {
            "store_id": r"^(STR|STORE)[-_]?\d+$",
            "receipt": r"^(RCT|RCPT)[-_]?\d+$"
        },
        "required_columns": [["store", "location", "branch"], ["sales", "transaction"]],
        "weight": 1.2,
        "icon": "🏪",
        "color": "#F77F00"
    },
    "finance": {
        "file_keywords": [
            "loan", "account", "branch", "npa", "interest", "bank", "credit",
            "debit", "transaction", "balance", "payment", "disbursement"
        ],
        "column_keywords": [
            "loan", "npa", "interest", "account", "principal", "emi", "balance",
            "credit", "debit", "transaction", "payment", "disbursement",
            "outstanding", "branch", "customer", "product", "tenor", "rate",
            "default", "overdue", "recovery"
        ],
        "metrics": ["revenue", "npa_rate", "disbursements", "outstanding", "interest_income"],
        "dimensions": ["branch", "product", "customer_segment", "loan_type"],
        "value_patterns": {
            "account": r"^\d{10,16}$",
            "loan_id": r"^(LN|LOAN)[-_]?\d+$"
        },
        "required_columns": [["loan", "account"], ["amount", "balance", "interest"]],
        "weight": 1.3,
        "icon": "💰",
        "color": "#06A77D"
    },
    "healthcare": {
        "file_keywords": [
            "patient", "hospital", "diagnosis", "admission", "doctor", "medical",
            "clinic", "healthcare", "treatment", "appointment", "ward"
        ],
        "column_keywords": [
            "patient", "diagnosis", "admission", "bed", "appointment", "doctor",
            "physician", "department", "ward", "treatment", "procedure", "visit",
            "discharge", "medical", "insurance", "claim", "icd", "cpt"
        ],
        "metrics": ["patient_count", "bed_occupancy", "appointments", "revenue", "los"],
        "dimensions": ["hospital", "department", "doctor", "ward", "diagnosis"],
        "value_patterns": {
            "patient_id": r"^(PAT|PT)[-_]?\d+$",
            "mrn": r"^\d{6,10}$"
        },
        "required_columns": [["patient"], ["admission", "appointment", "visit"]],
        "weight": 1.4,
        "icon": "🏥",
        "color": "#E63946"
    },
    "generic": {
        "file_keywords": ["data", "report", "export", "file"],
        "column_keywords": ["id", "name", "date", "time", "value", "amount", "total", "count"],
        "metrics": ["amount", "value", "total", "count"],
        "dimensions": ["category", "type", "status", "group"],
        "value_patterns": {},
        "required_columns": [],
        "weight": 0.3,
        "icon": "📊",
        "color": "#6C757D"
    }
}

class AdvancedDomainIntelligence:
    
    @staticmethod
    def detect_domain(dfs: Dict[str, pd.DataFrame]) -> Tuple[str, float, Dict[str, float], Dict[str, any]]:
        """
        MASSIVELY IMPROVED domain detection with:
        - Multi-layer analysis
        - Statistical validation
        - Pattern recognition
        - Semantic understanding
        """
        if not dfs or all(df.empty for df in dfs.values()):
            return "generic", 0.0, {"generic": 0.0}, {"error": "No data provided"}
        
        scores = {d: 0.0 for d in DOMAIN_SIGNATURES.keys()}
        details = {
            d: {
                'file': 0, 'col': 0, 'pattern': 0, 'stats': 0, 
                'semantic': 0, 'required': 0, 'matched_keywords': []
            } 
            for d in DOMAIN_SIGNATURES.keys()
        }
        
        # Combine all dataframes for comprehensive analysis
        all_columns = []
        for df in dfs.values():
            all_columns.extend([str(c).lower() for c in df.columns])
        
        # LAYER 1: Enhanced File Name Analysis (Weight: 3.0)
        for name, df in dfs.items():
            name_lower = name.lower()
            name_tokens = set(re.findall(r'\w+', name_lower))
            
            for domain, sig in DOMAIN_SIGNATURES.items():
                matches = name_tokens.intersection(set(sig['file_keywords']))
                if matches:
                    score = len(matches) * 3.0 * sig['weight']
                    scores[domain] += score
                    details[domain]['file'] += score
                    details[domain]['matched_keywords'].extend([f"file:{m}" for m in matches])
        
        # LAYER 2: Deep Column Analysis (Weight: 2.5)
        for domain, sig in DOMAIN_SIGNATURES.items():
            col_matches = set()
            for kw in sig['column_keywords']:
                for col in all_columns:
                    if kw in col or AdvancedDomainIntelligence._fuzzy_match(kw, col):
                        col_matches.add(kw)
            
            if col_matches:
                score = len(col_matches) * 2.5 * sig['weight']
                scores[domain] += score
                details[domain]['col'] += score
                details[domain]['matched_keywords'].extend([f"col:{m}" for m in list(col_matches)[:5]])
        
        # LAYER 3: Pattern Recognition (Weight: 4.0)
        for name, df in dfs.items():
            for domain, sig in DOMAIN_SIGNATURES.items():
                for col_pattern, regex in sig.get('value_patterns', {}).items():
                    for col in df.columns:
                        if col_pattern in str(col).lower():
                            try:
                                sample = df[col].dropna().astype(str).head(50)
                                matches = sample.str.match(regex, na=False).sum()
                                if matches > 10:  # Higher threshold
                                    score = 4.0 * sig['weight']
                                    scores[domain] += score
                                    details[domain]['pattern'] += score
                            except:
                                pass
        
        # LAYER 4: Statistical Analysis (Weight: 2.0)
        for name, df in dfs.items():
            if df.empty:
                continue
                
            numeric_cols = len(df.select_dtypes(include=[np.number]).columns)
            text_cols = len(df.select_dtypes(include=['object']).columns)
            total_cols = len(df.columns)
            
            if total_cols > 0:
                numeric_ratio = numeric_cols / total_cols
                
                for domain, sig in DOMAIN_SIGNATURES.items():
                    # Domain-specific ratio preferences
                    if domain == 'ecommerce' and 0.3 <= numeric_ratio <= 0.6:
                        scores[domain] += 2.0 * sig['weight']
                        details[domain]['stats'] += 2.0
                    elif domain == 'manufacturing' and numeric_ratio > 0.6:
                        scores[domain] += 2.5 * sig['weight']
                        details[domain]['stats'] += 2.5
                    elif domain == 'finance' and numeric_ratio > 0.5:
                        scores[domain] += 2.2 * sig['weight']
                        details[domain]['stats'] += 2.2
                    elif domain == 'retail' and 0.4 <= numeric_ratio <= 0.7:
                        scores[domain] += 2.0 * sig['weight']
                        details[domain]['stats'] += 2.0
        
        # LAYER 5: Semantic Column Group Analysis (Weight: 3.0)
        for domain, sig in DOMAIN_SIGNATURES.items():
            metrics_found = sum(1 for m in sig['metrics'] if any(m in col for col in all_columns))
            dims_found = sum(1 for d in sig['dimensions'] if any(d in col for col in all_columns))
            
            if metrics_found > 0 and dims_found > 0:
                semantic_score = (metrics_found + dims_found) * 1.5 * sig['weight']
                scores[domain] += semantic_score
                details[domain]['semantic'] += semantic_score
        
        # LAYER 6: Required Columns Check (Weight: 5.0 - CRITICAL)
        for domain, sig in DOMAIN_SIGNATURES.items():
            required_groups = sig.get('required_columns', [])
            if required_groups:
                for group in required_groups:
                    if any(any(req in col for col in all_columns) for req in group):
                        score = 5.0 * sig['weight']
                        scores[domain] += score
                        details[domain]['required'] += score
        
        # Calculate confidence with improvements
        if sum(scores.values()) == 0:
            return "generic", 0.0, scores, {"warning": "No domain patterns detected"}
        
        top_domain = max(scores, key=scores.get)
        second_best = sorted(scores.values(), reverse=True)[1] if len(scores) > 1 else 0
        
        # Refined confidence calculation
        total_score = sum(scores.values())
        base_confidence = scores[top_domain] / total_score
        
        # Boost confidence if top domain significantly better than second
        margin = scores[top_domain] - second_best
        if margin > 5.0:
            base_confidence = min(base_confidence * 1.2, 1.0)
        
        # Penalize if confidence is too low
        if base_confidence < 0.4:
            logger.warning(f"Low confidence ({base_confidence:.2f}), using generic")
            return "generic", base_confidence, scores, {
                **details,
                "warning": f"Low confidence. Top candidate: {top_domain}",
                "suggestion": "Consider reviewing column names for clarity"
            }
        
        confidence = min(base_confidence, 0.99)
        
        logger.info(f"✅ Domain: {top_domain}, Confidence: {confidence:.2%}, Score: {scores[top_domain]:.1f}")
        
        return top_domain, confidence, scores, details
    
    @staticmethod
    def _fuzzy_match(keyword: str, column: str, threshold: float = 0.75) -> bool:
        """Enhanced fuzzy matching with Levenshtein-like logic"""
        keyword = keyword.lower()
        column = column.lower()
        
        # Exact match
        if keyword == column:
            return True
        
        # Substring match
        if keyword in column or column in keyword:
            return True
        
        # Check word boundaries
        col_words = set(re.findall(r'\w+', column))
        if keyword in col_words:
            return True
        
        # Simple edit distance
        if len(keyword) > 3 and len(column) > 3:
            matches = sum(a == b for a, b in zip(keyword, column))
            ratio = matches / max(len(keyword), len(column))
            return ratio >= threshold
        
        return False
    
    @staticmethod
    def get_domain_config(domain: str) -> Dict:
        """Get comprehensive domain configuration"""
        if domain not in DOMAIN_SIGNATURES:
            logger.warning(f"Unknown domain '{domain}', using generic")
            domain = "generic"
        
        cfg = DOMAIN_SIGNATURES[domain]
        return {
            "name": domain.title(),
            "icon": cfg['icon'],
            "color": cfg['color'],
            "primary_metrics": cfg['metrics'][:4],
            "primary_dimensions": cfg['dimensions'][:4],
            "all_metrics": cfg['metrics'],
            "all_dimensions": cfg['dimensions'],
            "description": AdvancedDomainIntelligence._get_domain_description(domain)
        }
    
    @staticmethod
    def _get_domain_description(domain: str) -> str:
        descriptions = {
            "ecommerce": "E-commerce and online marketplace analytics",
            "automotive": "Automotive dealership and vehicle sales tracking",
            "manufacturing": "Production line and factory operations monitoring",
            "retail": "Physical store and point-of-sale analytics",
            "finance": "Banking, loans, and financial services tracking",
            "healthcare": "Hospital, clinic, and patient care management",
            "generic": "General business data analysis"
        }
        return descriptions.get(domain, "Business data analysis")
    
    @staticmethod
    def get_suggested_queries(domain: str, columns: List[str], max_suggestions: int = 6) -> List[Dict[str, str]]:
        """Generate highly contextual queries based on actual data"""
        sig = DOMAIN_SIGNATURES.get(domain, DOMAIN_SIGNATURES['generic'])
        suggestions = []
        
        # Find actual matching columns
        cols_lower = [str(c).lower() for c in columns]
        
        metrics = []
        dims = []
        date_cols = []
        
        # Match metrics
        for m in sig['metrics']:
            matches = [col for col in columns if m.lower() in str(col).lower()]
            metrics.extend(matches[:2])  # Max 2 per metric type
        
        # Match dimensions
        for d in sig['dimensions']:
            matches = [col for col in columns if d.lower() in str(col).lower()]
            dims.extend(matches[:2])
        
        # Find date columns
        date_keywords = ['date', 'time', 'month', 'year', 'day', 'week', 'quarter']
        for col in columns:
            if any(kw in str(col).lower() for kw in date_keywords):
                date_cols.append(col)
        
        # Remove duplicates
        metrics = list(dict.fromkeys(metrics))[:3]
        dims = list(dict.fromkeys(dims))[:3]
        date_cols = list(dict.fromkeys(date_cols))[:2]
        
        # Generate contextual suggestions
        if metrics and dims:
            suggestions.append({
                "query": f"top 10 {dims[0]} by {metrics[0]}",
                "description": f"Identify top performers in {dims[0]}",
                "category": "ranking"
            })
        
        if len(metrics) >= 2 and dims:
            suggestions.append({
                "query": f"compare {metrics[0]} and {metrics[1]} by {dims[0]}",
                "description": f"Side-by-side metric comparison",
                "category": "comparison"
            })
        
        if date_cols and metrics:
            suggestions.append({
                "query": f"trend of {metrics[0]} over time",
                "description": f"Analyze {metrics[0]} trends",
                "category": "trend"
            })
        
        if metrics:
            suggestions.append({
                "query": f"total {metrics[0]}",
                "description": f"Calculate total {metrics[0]}",
                "category": "aggregate"
            })
        
        if dims and len(dims) >= 2:
            metric = metrics[0] if metrics else "count"
            suggestions.append({
                "query": f"{metric} by {dims[0]} and {dims[1]}",
                "description": "Multi-dimensional breakdown",
                "category": "grouping"
            })
        
        if dims:
            suggestions.append({
                "query": f"count by {dims[0]}",
                "description": f"Distribution across {dims[0]}",
                "category": "distribution"
            })
        
        # Fallback suggestions
        if not suggestions:
            suggestions = [
                {"query": "show top 10 rows", "description": "Preview your data", "category": "exploration"},
                {"query": "count all rows", "description": "Total record count", "category": "aggregate"}
            ]
        
        return suggestions[:max_suggestions]