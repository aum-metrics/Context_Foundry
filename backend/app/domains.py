# enterprise_domain_intel_v2_full_registry.py
"""
Enterprise Domain Intelligence System (v2.0) - Full 15-domain registry
=====================================================================

Comprehensive, production-grade domain detection and KPI computation system.
Includes 15 fully defined domains with KPIs, insights, entities, and query templates.

Author: Enhanced for Enterprise Use
License: MIT
Python: 3.9+
"""

from __future__ import annotations

import re
import json
import logging
import ast
import operator
import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Tuple, Union, Callable, Set
from functools import lru_cache, wraps
from collections import defaultdict
from contextlib import contextmanager
import time

import pandas as pd
import numpy as np

# ============================================================================
# CONFIGURATION & CONSTANTS
# ============================================================================

class Config:
    """Central configuration management"""
    CONFIDENCE_THRESHOLD: float = 0.45
    FUZZY_MATCH_THRESHOLD: float = 0.6
    MIN_DETECTION_SCORE: float = 5.0

    MAX_FORMULA_LENGTH: int = 2000
    FORMULA_TIMEOUT_SECONDS: float = 5.0
    MAX_FORMULA_COMPLEXITY: int = 50

    CACHE_SIZE: int = 256
    MAX_SAMPLE_SIZE: int = 10000
    PATTERN_MATCH_SAMPLE_SIZE: int = 50

    MAX_NULL_RATE: float = 0.2
    MIN_ROW_COUNT: int = 1
    MAX_COLUMN_COUNT: int = 1000

    WEIGHT_FILE_KEYWORDS: float = 3.0
    WEIGHT_COLUMN_KEYWORDS: float = 2.5
    WEIGHT_REQUIRED_COLUMNS: float = 5.0
    WEIGHT_METRICS_DIMS: float = 1.8
    WEIGHT_VALUE_PATTERNS: float = 4.0

    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    @classmethod
    def validate(cls) -> None:
        assert 0 <= cls.CONFIDENCE_THRESHOLD <= 1
        assert 0 <= cls.FUZZY_MATCH_THRESHOLD <= 1
        assert cls.MAX_FORMULA_LENGTH > 0
        assert cls.CACHE_SIZE > 0

Config.validate()

# ============================================================================
# LOGGING
# ============================================================================

def setup_logging(name: str, level: str = Config.LOG_LEVEL) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(Config.LOG_FORMAT))
        logger.addHandler(handler)
    return logger

logger = setup_logging(__name__)

# ============================================================================
# EXCEPTIONS & UTILITIES
# ============================================================================

class DomainDetectionError(Exception): pass
class FormulaParseError(DomainDetectionError): pass
class DataValidationError(DomainDetectionError): pass
class KPIComputationError(DomainDetectionError): pass
class SecurityError(DomainDetectionError): pass

def timing_decorator(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            result = func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            logger.debug(f"{func.__name__} completed in {elapsed:.4f}s")
            return result
        except Exception as e:
            elapsed = time.perf_counter() - start
            logger.error(f"{func.__name__} failed after {elapsed:.4f}s: {e}")
            raise
    return wrapper

def safe_execution(default_return: Any = None, log_exception: bool = True):
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if log_exception:
                    logger.warning(f"{func.__name__} failed: {e}", exc_info=True)
                return default_return
        return wrapper
    return decorator

@contextmanager
def timeout_context(seconds: float):
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        if elapsed > seconds:
            logger.warning(f"Operation exceeded timeout ({elapsed:.2f}s > {seconds}s)")

# ============================================================================
# MODELS & DATACLASSES
# ============================================================================

class InsightSeverity(Enum):
    CRITICAL="critical"; HIGH="high"; MEDIUM="medium"; LOW="low"; OPPORTUNITY="opportunity"; INFO="info"

class KPIStatus(Enum):
    EXCELLENT="excellent"; GOOD="good"; WARNING="warning"; CRITICAL="critical"; UNKNOWN="unknown"; ERROR="error"

class DataQualityStatus(Enum):
    EXCELLENT="excellent"; GOOD="good"; FAIR="fair"; POOR="poor"

@dataclass(frozen=True)
class ValidationResult:
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)
    def to_dict(self): return asdict(self)

@dataclass
class KPIDefinition:
    id: str
    name: str
    formula: str
    format: str = "number"
    benchmark: Dict[str, float] = field(default_factory=dict)
    description: str = ""
    priority: int = 1
    grain: str = "aggregate"
    dependencies: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    def __post_init__(self):
        if not self.id or not self.name or not self.formula:
            raise ValueError("id, name, and formula required")
        if self.priority < 1: raise ValueError("priority must be >=1")
        if self.format not in {"number","currency","percent","ratio","days","hours","count","units"}:
            raise ValueError("invalid format")

@dataclass
class DimensionDefinition:
    id: str; name: str; dtype: str="categorical"; priority: int=1
    taxonomy: List[str]=field(default_factory=list); description: str=""; cardinality_hint: Optional[int]=None
    def __post_init__(self):
        if self.dtype not in {"categorical","numeric","temporal","geographic","boolean"}:
            raise ValueError("invalid dtype")

@dataclass
class InsightPattern:
    id: str; expression: str; severity: InsightSeverity
    message_template: str; actions: List[str]=field(default_factory=list)
    topic: str=""; threshold: Optional[float]=None; enabled: bool=True
    def __post_init__(self):
        if not self.id or not self.expression: raise ValueError("id & expression required")

@dataclass
class EntityDefinition:
    name: str; canonical_keys: List[str]; description: str=""; entity_type: str="dimension"
    def __post_init__(self):
        if not self.canonical_keys: raise ValueError("canonical_keys cannot be empty")

@dataclass
class JoinPath:
    from_entity: str; to_entity: str; join_condition: str; join_type: str="inner"; confidence: float=1.0
    def __post_init__(self):
        if self.join_type not in {"inner","left","right","full","cross"}: raise ValueError("invalid join")
        if not 0 <= self.confidence <= 1: raise ValueError("confidence must be 0..1")

@dataclass
class DomainSignature:
    id: str; name: str; icon: str; color: str; description: str
    file_keywords: List[str]=field(default_factory=list)
    column_keywords: List[str]=field(default_factory=list)
    value_patterns: Dict[str,str]=field(default_factory=dict)
    required_columns: List[List[str]]=field(default_factory=list)
    metrics: List[str]=field(default_factory=list)
    dimensions: List[str]=field(default_factory=list)
    critical_kpis: List[KPIDefinition]=field(default_factory=list)
    secondary_kpis: List[KPIDefinition]=field(default_factory=list)
    entities: List[EntityDefinition]=field(default_factory=list)
    join_paths: List[JoinPath]=field(default_factory=list)
    dimensions_def: List[DimensionDefinition]=field(default_factory=list)
    insight_patterns: List[InsightPattern]=field(default_factory=list)
    benchmarks: Dict[str,Any]=field(default_factory=dict)
    query_templates: List[Dict[str,Any]]=field(default_factory=list)
    weight: float=1.0; enabled: bool=True
    _compiled_patterns: Dict[str,re.Pattern]=field(default_factory=dict, init=False, repr=False)
    def __post_init__(self):
        if not self.id or not self.name: raise ValueError("id & name required")
        if not 0 <= self.weight <= 10: raise ValueError("weight between 0 and 10")
        for pname, pstr in self.value_patterns.items():
            try:
                self._compiled_patterns[pname] = re.compile(pstr)
            except re.error as e:
                logger.warning(f"Invalid regex '{pname}': {e}")
    def get_compiled_pattern(self, name: str)->Optional[re.Pattern]:
        return self._compiled_patterns.get(name)

# ============================================================================
# REGEX PATTERNS / UTILITIES
# ============================================================================

class RegexPatterns:
    DATEDIFF = re.compile(r'datediff\s*\(', re.IGNORECASE)
    AVG_DATEDIFF = re.compile(r'avg\s*\(\s*datediff\s*\(\s*([a-zA-Z0-9_\-\.\s]+)\s*,\s*([a-zA-Z0-9_\-\.\s]+)\s*\)\s*\)', re.IGNORECASE)
    SIMPLE_DATEDIFF = re.compile(r'datediff\s*\(\s*([a-zA-Z0-9_\-\.\s]+)\s*,\s*([a-zA-Z0-9_\-\.\s]+)\s*\)', re.IGNORECASE)
    SUM_CASE = re.compile(r'sum\s*\(\s*case\s+when\s+([a-zA-Z0-9_\-\.\s]+)\s*=\s*([\'"]?[A-Za-z0-9_\-\.\s]+[\'"]?)\s+then\s+([a-zA-Z0-9_\-\.\s]+)\s+else\s+0\s+end\s*\)', re.IGNORECASE)
    SIMPLE_AGG = re.compile(r'^(sum|avg|mean|count|min|max)\s*\(\s*([a-zA-Z0-9_\.\-]+)\s*\)\s*$', re.IGNORECASE)
    COUNT_DISTINCT = re.compile(r'^count\s*\(\s*distinct\s+([a-zA-Z0-9_\.\-]+)\s*\)\s*$', re.IGNORECASE)
    IDENTIFIERS = re.compile(r'\b[A-Za-z_][A-Za-z0-9_\.\-]*\b')
    NUMERIC_ONLY = re.compile(r'^[\d\.\+\-\*\/\(\)\s]+$')

    RESERVED_WORDS = {'sum','avg','mean','count','distinct','case','when','then','else','end','datediff','and','or','not','null','nullif','coalesce','if'}

    @classmethod
    @lru_cache(maxsize=Config.CACHE_SIZE)
    def is_reserved_word(cls, word: str) -> bool:
        return word.lower() in cls.RESERVED_WORDS

# ============================================================================
# SECURE FORMULA EVALUATOR
# ============================================================================

class SecureFormulaEvaluator:
    OPERATORS = {
        ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod, ast.Pow: operator.pow,
        ast.USub: operator.neg, ast.UAdd: operator.pos
    }

    @classmethod
    def evaluate(cls, expr: str, context: Dict[str, float]) -> Optional[float]:
        if not expr or not expr.strip(): return None
        expr_work = expr
        for var, val in context.items():
            if val is None: val = 0.0
            expr_work = re.sub(r'\b' + re.escape(var) + r'\b', str(float(val)), expr_work)
        expr_work = expr_work.replace('%', '')
        if not cls._is_safe_expression(expr_work):
            raise SecurityError(f"Expression contains unsafe characters: {expr_work}")
        try:
            tree = ast.parse(expr_work, mode='eval')
            if cls._count_nodes(tree) > Config.MAX_FORMULA_COMPLEXITY:
                raise SecurityError("Expression too complex")
            result = cls._eval_node(tree.body)
            if isinstance(result, (int,float,np.number)): return float(result)
            return None
        except (SyntaxError, ValueError, TypeError, ZeroDivisionError) as e:
            logger.debug(f"Formula evaluation failed for '{expr_work}': {e}")
            return None

    @classmethod
    def _is_safe_expression(cls, expr: str) -> bool:
        safe_pattern = re.compile(r'^[\d\.\+\-\*\/\(\)\s]+$')
        return bool(safe_pattern.match(expr))

    @classmethod
    def _count_nodes(cls, tree: ast.AST) -> int:
        count = 1
        for child in ast.iter_child_nodes(tree): count += cls._count_nodes(child)
        return count

    @classmethod
    def _eval_node(cls, node: ast.AST) -> Union[float,int]:
        if isinstance(node, ast.Num): return node.n
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int,float)): return node.value
            raise ValueError(f"Unsupported constant type: {type(node.value)}")
        if isinstance(node, ast.BinOp):
            left = cls._eval_node(node.left); right = cls._eval_node(node.right)
            op = cls.OPERATORS.get(type(node.op))
            if op is None: raise ValueError(f"Unsupported operator: {type(node.op)}")
            return op(left, right)
        if isinstance(node, ast.UnaryOp):
            operand = cls._eval_node(node.operand)
            op = cls.OPERATORS.get(type(node.op))
            if op is None: raise ValueError(f"Unsupported unary operator: {type(node.op)}")
            return op(operand)
        raise ValueError(f"Unsupported AST node: {type(node)}")

# ============================================================================
# DATA VALIDATOR
# ============================================================================

class DataValidator:
    @staticmethod
    def validate_dataframes(dfs: Dict[str,pd.DataFrame]) -> ValidationResult:
        errors, warnings = [], []
        metrics = {}
        if not isinstance(dfs, dict):
            errors.append(f"Input must be dict, got {type(dfs)}"); return ValidationResult(False, errors, warnings, metrics)
        if not dfs:
            errors.append("No dataframes provided"); return ValidationResult(False, errors, warnings, metrics)

        total_rows = 0; total_cols = 0
        for table_name, df in dfs.items():
            if not isinstance(df, pd.DataFrame):
                errors.append(f"Table '{table_name}' is not a DataFrame"); continue
            if df.empty:
                warnings.append(f"Table '{table_name}' is empty"); continue
            if len(df) < Config.MIN_ROW_COUNT:
                warnings.append(f"Table '{table_name}' has only {len(df)} rows")
            if len(df.columns) > Config.MAX_COLUMN_COUNT:
                errors.append(f"Table '{table_name}' has too many columns ({len(df.columns)})")
            total_rows += len(df); total_cols += len(df.columns)
            try:
                null_rates = df.isnull().sum() / max(len(df),1)
                high_null_cols = null_rates[null_rates > Config.MAX_NULL_RATE].index.tolist()
                if high_null_cols:
                    warnings.append(f"Table '{table_name}' has high null rates in: {', '.join(high_null_cols[:5])}")
            except Exception:
                pass
            try:
                if df.duplicated().any():
                    dup_count = int(df.duplicated().sum()); warnings.append(f"Table '{table_name}' has {dup_count} duplicate rows")
            except Exception:
                pass

        metrics = {"total_tables": len(dfs), "total_rows": total_rows, "total_columns": total_cols, "valid_tables": len([df for df in dfs.values() if isinstance(df,pd.DataFrame) and not df.empty])}
        is_valid = len(errors) == 0 and total_rows > 0
        return ValidationResult(is_valid, errors, warnings, metrics)

    @staticmethod
    def assess_data_quality(dfs: Dict[str,pd.DataFrame]) -> Dict[str,Any]:
        quality_scores = []; table_scores = {}
        for tname, df in dfs.items():
            if not isinstance(df,pd.DataFrame) or df.empty:
                table_scores[tname] = 0.0; continue
            try:
                null_rate = df.isnull().sum().sum() / max((len(df) * max(len(df.columns),1)),1)
                completeness = max(0.0, 1 - null_rate)
            except Exception:
                completeness = 0.0
            uniqueness_scores = []
            for col in df.columns:
                try:
                    if df[col].dtype == object or pd.api.types.is_string_dtype(df[col]):
                        unique_ratio = float(df[col].nunique())/max(len(df),1)
                        uniqueness_scores.append(unique_ratio)
                except Exception:
                    continue
            uniqueness = float(np.mean(uniqueness_scores)) if uniqueness_scores else 0.5
            consistency = 1.0
            score = (completeness*0.5 + uniqueness*0.3 + consistency*0.2)*100
            table_scores[tname] = round(score,2); quality_scores.append(score)
        avg_score = float(np.mean(quality_scores)) if quality_scores else 0.0
        if avg_score >= 90: status = DataQualityStatus.EXCELLENT
        elif avg_score >= 75: status = DataQualityStatus.GOOD
        elif avg_score >= 60: status = DataQualityStatus.FAIR
        else: status = DataQualityStatus.POOR
        completeness_vals = []
        for df in dfs.values():
            if isinstance(df,pd.DataFrame) and not df.empty:
                denom = max((len(df) * max(len(df.columns),1)),1)
                completeness_vals.append(max(0.0, 1 - df.isnull().sum().sum()/denom))
        completeness_percent = round(np.mean(completeness_vals)*100,2) if completeness_vals else 0.0
        return {"overall_score": round(avg_score,2), "status": status.value, "completeness": completeness_percent, "table_scores": table_scores}

# ============================================================================
# FORMULA PARSER
# ============================================================================
class FormulaParser:
    @classmethod
    @timing_decorator
    @lru_cache(maxsize=Config.CACHE_SIZE)
    def parse_cached(cls, formula: str, df_hash: str) -> Optional[float]:
        return None

    @classmethod
    def parse(cls, formula: str, dfs: Dict[str,pd.DataFrame]) -> Optional[float]:
        if not formula or not formula.strip(): return None
        if len(formula) > Config.MAX_FORMULA_LENGTH:
            raise FormulaParseError("Formula exceeds maximum length")
        formula = re.sub(r'\s+',' ',formula).strip()
        with timeout_context(Config.FORMULA_TIMEOUT_SECONDS):
            if RegexPatterns.DATEDIFF.search(formula):
                r = cls._handle_datediff(formula, dfs)
                if r is not None: return r
            if RegexPatterns.SUM_CASE.search(formula):
                r = cls._handle_sum_case(formula, dfs)
                if r is not None: return r
            m = RegexPatterns.SIMPLE_AGG.match(formula)
            if m:
                func, col = m.groups(); return cls._aggregate_column(col, func.lower(), dfs)
            m = RegexPatterns.COUNT_DISTINCT.match(formula)
            if m:
                col = m.group(1); return cls._aggregate_column(col, 'count', dfs, distinct=True)
            return cls._evaluate_arithmetic_expr(formula, dfs)

    @classmethod
    def _handle_datediff(cls, expr: str, dfs: Dict[str,pd.DataFrame]) -> Optional[float]:
        try:
            m = RegexPatterns.AVG_DATEDIFF.search(expr)
            if m:
                c1, c2 = m.groups(); return cls._compute_datediff(c1,c2,dfs)
            m = RegexPatterns.SIMPLE_DATEDIFF.search(expr)
            if m:
                c1, c2 = m.groups(); return cls._compute_datediff(c1,c2,dfs)
        except Exception as e:
            logger.debug(f"DATEDIFF parse failed: {e}")
        return None

    @classmethod
    def _handle_sum_case(cls, expr: str, dfs: Dict[str,pd.DataFrame]) -> Optional[float]:
        try:
            m = RegexPatterns.SUM_CASE.search(expr)
            if not m: return None
            cond_col, cond_val, val_col = m.groups(); cond_val = cond_val.strip("'\"")
            total = 0.0
            for df in dfs.values():
                if not isinstance(df,pd.DataFrame) or df.empty: continue
                cond_matches = cls._find_column(df, cond_col)
                val_matches = cls._find_column(df, val_col)
                if cond_matches and val_matches:
                    ccol, vcol = cond_matches[0], val_matches[0]
                    try:
                        mask = df[ccol].astype(str) == str(cond_val)
                        total += pd.to_numeric(df.loc[mask, vcol], errors='coerce').sum()
                    except Exception as e:
                        logger.debug(f"SUM CASE compute failed: {e}"); continue
            return float(total)
        except Exception as e:
            logger.debug(f"SUM CASE parse failed: {e}")
        return None

    @classmethod
    def _preprocess_formula(cls, expr: str, dfs: Dict[str,pd.DataFrame]) -> str:
        # Handle NULLIF(x, 0) -> x (avoid div by zero handled by evaluator returning None/Inf)
        expr = re.sub(r'NULLIF\s*\(\s*(.+?)\s*,\s*0\s*\)', r'\1', expr, flags=re.IGNORECASE)
        
        # Handle COUNT(DISTINCT col)
        def replace_count_distinct(match):
            col = match.group(1)
            val = cls._aggregate_column(col, 'count', dfs, distinct=True)
            return str(val) if val is not None else "0.0"
        expr = re.sub(r'COUNT\s*\(\s*DISTINCT\s+([a-zA-Z0-9_\-\.\s]+)\s*\)', replace_count_distinct, expr, flags=re.IGNORECASE)

        # Handle SUM(col), AVG(col), COUNT(col), MIN(col), MAX(col)
        def replace_agg(match):
            func = match.group(1).lower()
            col = match.group(2)
            agg_map = {'sum':'sum', 'avg':'mean', 'mean':'mean', 'count':'count', 'min':'min', 'max':'max'}
            val = cls._aggregate_column(col, agg_map.get(func,'count'), dfs)
            return str(val) if val is not None else "0.0"
        expr = re.sub(r'(SUM|AVG|MEAN|COUNT|MIN|MAX)\s*\(\s*([a-zA-Z0-9_\-\.\s]+)\s*\)', replace_agg, expr, flags=re.IGNORECASE)
        
        return expr

    @classmethod
    def _evaluate_arithmetic_expr(cls, expr: str, dfs: Dict[str,pd.DataFrame]) -> Optional[float]:
        try:
            # Preprocess aggregations and SQL functions
            expr = cls._preprocess_formula(expr, dfs)

            tokens = set(RegexPatterns.IDENTIFIERS.findall(expr))
            identifiers = [t for t in tokens if not RegexPatterns.is_reserved_word(t) and not t.isdigit()]
            context = {}
            for ident in identifiers:
                val = cls._aggregate_column(ident, 'sum', dfs)
                if val is None: val = cls._aggregate_column(ident, 'count', dfs, distinct=True)
                if val is None: val = cls._aggregate_column(ident, 'mean', dfs)
                if val is None: val = 0.0
                context[ident] = float(val)
            return SecureFormulaEvaluator.evaluate(expr, context)
        except SecurityError:
            raise
        except Exception as e:
            logger.debug(f"Arithmetic eval failed for '{expr}': {e}")
            return None

    @classmethod
    def _aggregate_column(cls, col: str, agg: str, dfs: Dict[str,pd.DataFrame], distinct: bool=False) -> Optional[float]:
        col_lower = col.lower()
        for df in dfs.values():
            if not isinstance(df,pd.DataFrame) or df.empty: continue
            matches = cls._find_column(df, col)
            if not matches: continue
            actual_col = matches[0]; series = df[actual_col].dropna()
            if series.empty: continue
            try:
                if agg == 'sum':
                    numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                    return float(numeric_series.sum()) if not numeric_series.empty else 0.0
                if agg in ('avg','mean'):
                    numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                    return float(numeric_series.mean()) if not numeric_series.empty else 0.0
                if agg == 'count':
                    return float(series.nunique() if distinct else series.count())
                if agg == 'min':
                    numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                    return float(numeric_series.min()) if not numeric_series.empty else None
                if agg == 'max':
                    numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                    return float(numeric_series.max()) if not numeric_series.empty else None
            except Exception as e:
                logger.debug(f"Aggregation failed for {actual_col}: {e}"); continue
        return None

    @classmethod
    def _find_column(cls, df_or_cols: Union[pd.DataFrame, Tuple[str,...]], col_name: str) -> List[str]:
        if isinstance(df_or_cols, pd.DataFrame):
            columns = tuple(df_or_cols.columns)
        elif isinstance(df_or_cols, (list,tuple)):
            columns = tuple(df_or_cols)
        else:
            columns = tuple()
        return cls._find_column_impl(columns, col_name)

    @staticmethod
    @lru_cache(maxsize=Config.CACHE_SIZE)
    def _find_column_impl(columns: Tuple[str,...], col_name: str) -> List[str]:
        col_lower = col_name.lower()
        columns_list = list(columns)
        matches = [c for c in columns_list if col_lower in str(c).lower()]
        if matches: return matches
        words = re.findall(r'\w+', col_lower)
        if words:
            def score(c: str) -> int:
                c_lower = str(c).lower()
                return sum(1 for w in words if w in c_lower)
            scored = sorted(columns_list, key=score, reverse=True)
            matches = [c for c in scored if score(c) > 0]
            if matches: return matches
        return []

    @classmethod
    def _compute_datediff(cls, col1: str, col2: str, dfs: Dict[str,pd.DataFrame]) -> Optional[float]:
        for df in dfs.values():
            if not isinstance(df,pd.DataFrame) or df.empty: continue
            cols1 = cls._find_column(df, col1); cols2 = cls._find_column(df, col2)
            if cols1 and cols2:
                try:
                    date1 = pd.to_datetime(df[cols1[0]], errors='coerce'); date2 = pd.to_datetime(df[cols2[0]], errors='coerce')
                    diff = (date1 - date2).dt.days; diff_clean = diff.dropna()
                    if not diff_clean.empty: return float(diff_clean.mean())
                except Exception as e:
                    logger.debug(f"Date diff compute failed: {e}"); continue
        return None

# ============================================================================
# KPI ENGINE
# ============================================================================

class KPIEngine:
    def __init__(self, registry: Dict[str,DomainSignature]):
        self.registry = registry; self.computation_cache = {}; self.audit_trail = []

    @timing_decorator
    def compute_for_domain(self, domain: str, dfs: Dict[str,pd.DataFrame], include_secondary: bool=True) -> Dict[str,Any]:
        sig = self.registry.get(domain, self.registry.get("generic"))
        if not sig or not sig.enabled:
            logger.warning(f"Domain '{domain}' not found or disabled"); return {}
        results = {}
        kpis_to_compute = sig.critical_kpis.copy()
        if include_secondary: kpis_to_compute.extend(sig.secondary_kpis)
        start = time.perf_counter()
        for kpi in kpis_to_compute:
            try:
                r = self.compute_single(kpi, dfs); results[kpi.id] = r
                self.audit_trail.append({"timestamp": datetime.now().isoformat(), "kpi_id": kpi.id, "domain": domain, "status": r.get("status"), "value": r.get("value")})
            except Exception as e:
                logger.error(f"KPI computation failed for {kpi.id}: {e}", exc_info=True)
                results[kpi.id] = {"status": KPIStatus.ERROR.value, "error": str(e), "formula": kpi.formula}
        computation_time = time.perf_counter() - start
        results["_metadata"] = {"domain": domain, "total_kpis": len(kpis_to_compute), "successful": sum(1 for r in results.values() if isinstance(r,dict) and r.get("status") != KPIStatus.ERROR.value), "computation_time_seconds": round(computation_time,3)}
        return results

    def compute_single(self, kpi: KPIDefinition, dfs: Dict[str,pd.DataFrame]) -> Dict[str,Any]:
        comp_id = hashlib.md5(f"{kpi.id}_{kpi.formula}_{datetime.now().isoformat()}".encode()).hexdigest()[:8]
        try:
            value = FormulaParser.parse(kpi.formula, dfs)
            if value is None:
                return {"id":kpi.id,"name":kpi.name,"status":KPIStatus.ERROR.value,"error":"unable_to_compute","formula":kpi.formula,"dependencies":kpi.dependencies,"computation_id":comp_id}
            if not isinstance(value,(int,float,np.number)) or np.isnan(value) or np.isinf(value):
                return {"id":kpi.id,"name":kpi.name,"status":KPIStatus.ERROR.value,"error":"invalid_result","raw_value":str(value),"computation_id":comp_id}
            status = self._assess_status(value, kpi.benchmark)
            formatted = self._format_value(value, kpi.format)
            return {"id":kpi.id,"name":kpi.name,"value":round(float(value),2),"formatted_value":formatted,"format":kpi.format,"status":status.value,"benchmark":kpi.benchmark,"description":kpi.description,"formula":kpi.formula,"priority":kpi.priority,"tags":kpi.tags,"grain":kpi.grain,"computation_id":comp_id,"computed_at":datetime.now().isoformat()}
        except FormulaParseError as e:
            logger.error(f"Formula parse error for {kpi.id}: {e}")
            return {"id":kpi.id,"name":kpi.name,"status":KPIStatus.ERROR.value,"error":"formula_parse_error","error_detail":str(e),"formula":kpi.formula,"computation_id":comp_id}
        except Exception as e:
            logger.error(f"Unexpected error computing {kpi.id}: {e}", exc_info=True)
            return {"id":kpi.id,"name":kpi.name,"status":KPIStatus.ERROR.value,"error":"computation_error","error_detail":str(e),"formula":kpi.formula,"computation_id":comp_id}

    def _assess_status(self, value: float, benchmark: Dict[str,float]) -> KPIStatus:
        if not benchmark: return KPIStatus.UNKNOWN
        good = benchmark.get("good") or benchmark.get("p50")
        excellent = benchmark.get("excellent") or benchmark.get("p75")
        warning = benchmark.get("warning") or benchmark.get("p25")
        critical = benchmark.get("critical") or benchmark.get("p10")
        if good is None: return KPIStatus.UNKNOWN
        higher_is_better = True
        if warning and warning > good: higher_is_better = False
        if higher_is_better:
            if excellent and value >= excellent: return KPIStatus.EXCELLENT
            if value >= good: return KPIStatus.GOOD
            if warning and value >= warning: return KPIStatus.WARNING
            return KPIStatus.CRITICAL
        else:
            if excellent and value <= excellent: return KPIStatus.EXCELLENT
            if value <= good: return KPIStatus.GOOD
            if warning and value <= warning: return KPIStatus.WARNING
            return KPIStatus.CRITICAL

    def _format_value(self, value: float, format_type: str) -> str:
        if format_type == "currency": return f"${value:,.2f}"
        if format_type == "percent": return f"{value:.2f}%"
        if format_type == "ratio": return f"{value:.2f}x"
        if format_type in ("days","hours"): return f"{value:.1f} {format_type}"
        if format_type == "count": return f"{int(value):,}"
        return f"{value:,.2f}"

    def get_audit_trail(self, limit: int=100): return self.audit_trail[-limit:]
    def clear_cache(self): self.computation_cache.clear(); logger.info("KPI computation cache cleared")

# ============================================================================
# ENTITY INTELLIGENCE
# ============================================================================

class EntityIntelligence:
    def __init__(self, registry: Dict[str,DomainSignature]): self.registry = registry

    @timing_decorator
    def map_entities(self, domain: str, dfs: Dict[str,pd.DataFrame]) -> Dict[str,Any]:
        sig = self.registry.get(domain, self.registry.get("generic"))
        if not sig: return {}
        mapping = {}
        for entity in sig.entities:
            detected = {}
            for table_name, df in dfs.items():
                if not isinstance(df,pd.DataFrame) or df.empty: continue
                columns = list(df.columns); matches = []
                for canonical_key in entity.canonical_keys:
                    for col in columns:
                        confidence = self._compute_match_confidence(canonical_key, col, df)
                        if confidence > 0.5:
                            matches.append({"detected_column": col, "canonical_key": canonical_key, "confidence": round(confidence,2), "sample_values": df[col].dropna().head(3).tolist(), "cardinality": int(df[col].nunique()) if len(df)>0 else 0, "null_rate": round(df[col].isnull().sum()/max(len(df),1),3)})
                if matches:
                    matches.sort(key=lambda x: x["confidence"], reverse=True)
                    detected[table_name] = matches
            if detected:
                mapping[entity.name] = {"description": entity.description, "entity_type": entity.entity_type, "canonical_keys": entity.canonical_keys, "detected_in": detected, "total_occurrences": sum(len(v) for v in detected.values())}
        return mapping

    def recommend_joins(self, domain: str, dfs: Dict[str,pd.DataFrame]) -> List[Dict[str,Any]]:
        sig = self.registry.get(domain, self.registry.get("generic"))
        if not sig: return []
        entity_mapping = self.map_entities(domain, dfs); recommendations = []
        for entity_name, entity_data in entity_mapping.items():
            detected = entity_data["detected_in"]; tables = list(detected.keys())
            if len(tables) < 2: continue
            for i in range(len(tables)):
                for j in range(i+1, len(tables)):
                    t1, t2 = tables[i], tables[j]
                    matches1 = detected[t1]; matches2 = detected[t2]
                    if not matches1 or not matches2: continue
                    col1 = matches1[0]["detected_column"]; col2 = matches2[0]["detected_column"]
                    predefined = self._find_predefined_join(sig, t1, t2)
                    join_quality = self._assess_join_quality(dfs.get(t1, pd.DataFrame()), col1, dfs.get(t2, pd.DataFrame()), col2)
                    recommendations.append({"entity": entity_name, "from_table": t1, "to_table": t2, "from_column": col1, "to_column": col2, "join_type": predefined["join_type"] if predefined else "inner", "confidence": "high" if predefined else join_quality["confidence"], "sql": f"{t1}.{col1} = {t2}.{col2}", "estimated_cardinality": join_quality["estimated_rows"], "join_quality_score": join_quality["score"], "warnings": join_quality["warnings"]})
        recommendations.sort(key=lambda x: (x["confidence"] == "high", x.get("join_quality_score",0)), reverse=True)
        return recommendations

    def _compute_match_confidence(self, canonical: str, detected: str, df: pd.DataFrame) -> float:
        canonical_lower = canonical.lower(); detected_lower = detected.lower()
        if canonical_lower == detected_lower: name_score = 0.5
        elif canonical_lower in detected_lower or detected_lower in canonical_lower: name_score = 0.4
        else:
            canon_words = set(re.findall(r'\w+', canonical_lower)); detect_words = set(re.findall(r'\w+', detected_lower))
            overlap = len(canon_words & detect_words); name_score = min(0.3, overlap * 0.15)
        type_score = 0.1
        try:
            if 'id' in canonical_lower:
                if pd.api.types.is_integer_dtype(df[detected]) or pd.api.types.is_string_dtype(df[detected]):
                    type_score = 0.2
        except Exception:
            type_score = 0.1
        try:
            cardinality_ratio = float(df[detected].nunique())/max(len(df),1)
        except Exception:
            cardinality_ratio = 0.0
        card_score = 0.2 if ('id' in canonical_lower and cardinality_ratio > 0.5) else 0.1
        try:
            null_rate = df[detected].isnull().sum()/max(len(df),1); null_score = 0.1*(1-null_rate)
        except Exception:
            null_score = 0.05
        total = name_score + type_score + card_score + null_score
        return min(1.0, total)

    def _assess_join_quality(self, df1: pd.DataFrame, col1: str, df2: pd.DataFrame, col2: str) -> Dict[str,Any]:
        warnings = []
        if col1 not in df1.columns or col2 not in df2.columns:
            return {"score":0.0, "confidence":"low", "estimated_rows":0, "warnings":["Join columns not present"]}
        null_rate1 = df1[col1].isnull().sum()/max(len(df1),1); null_rate2 = df2[col2].isnull().sum()/max(len(df2),1)
        if null_rate1 > 0.1 or null_rate2 > 0.1: warnings.append(f"High null rate ({null_rate1:.1%},{null_rate2:.1%})")
        dup_rate1 = df1[col1].duplicated().sum()/max(len(df1),1); dup_rate2 = df2[col2].duplicated().sum()/max(len(df2),1)
        if dup_rate1 > 0.5 or dup_rate2 > 0.5: warnings.append("High duplicate rate")
        try:
            values1 = set(df1[col1].dropna().astype(str).unique()[:1000]); values2 = set(df2[col2].dropna().astype(str).unique()[:1000])
            overlap = len(values1 & values2); denom = max(len(values1), len(values2), 1); overlap_ratio = overlap/denom
            if overlap_ratio < 0.1: warnings.append("Low overlap")
        except Exception:
            overlap_ratio = 0.5
        score = ((1-null_rate1)*0.25 + (1-null_rate2)*0.25 + overlap_ratio*0.5)
        estimated_rows = int(max(1,len(df1))*max(1,len(df2))*max(dup_rate1,dup_rate2,0.1))
        confidence = "high" if score>0.7 else "medium" if score>0.5 else "low"
        return {"score":round(score,2), "confidence":confidence, "estimated_rows":estimated_rows, "warnings":warnings}

    def _find_predefined_join(self, sig: DomainSignature, table1: str, table2: str) -> Optional[Dict[str,Any]]:
        for jp in sig.join_paths:
            if ((table1 in jp.from_entity and table2 in jp.to_entity) or (table2 in jp.from_entity and table1 in jp.to_entity)):
                return {"join_type": jp.join_type, "condition": jp.join_condition, "confidence": jp.confidence}
        return None

# ============================================================================
# INSIGHT EVALUATOR
# ============================================================================

class InsightEvaluator:
    @staticmethod
    @safe_execution(default_return=[], log_exception=True)
    def evaluate_patterns(sig: DomainSignature, kpi_results: Dict[str,Any]) -> List[Dict[str,Any]]:
        findings = []
        context = {}
        for kpi_id, result in kpi_results.items():
            if isinstance(result, dict) and "value" in result: context[kpi_id] = result["value"]
            elif isinstance(result, (int,float)): context[kpi_id] = result
        if not context: logger.debug("No KPI values"); return findings
        for pattern in sig.insight_patterns:
            if not pattern.enabled: continue
            try:
                triggered = InsightEvaluator._evaluate_single_pattern(pattern, context)
                if triggered:
                    findings.append({"pattern_id": pattern.id, "severity": pattern.severity.value, "message": pattern.message_template, "actions": pattern.actions, "topic": pattern.topic, "threshold": pattern.threshold, "evaluated_at": datetime.now().isoformat(), "context_values": {k:v for k,v in context.items() if k in pattern.expression}})
            except Exception as e:
                logger.debug(f"Pattern eval failed for {pattern.id}: {e}"); continue
        severity_order = {"critical":0,"high":1,"medium":2,"low":3,"opportunity":4,"info":5}
        findings.sort(key=lambda x: severity_order.get(x["severity"],99))
        return findings

    @staticmethod
    def _evaluate_single_pattern(pattern: InsightPattern, context: Dict[str,float]) -> bool:
        expr = pattern.expression; expr_eval = expr
        for key,val in context.items():
            if val is None: val = 0.0
            expr_eval = re.sub(r'\b' + re.escape(key) + r'\b', str(float(val)), expr_eval)
        expr_eval = expr_eval.replace(' AND ',' and ').replace(' OR ',' or ').replace(' NOT ',' not ')
        unresolved_tokens = set(re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', expr_eval))
        operators = {'and','or','not'}; unresolved = unresolved_tokens - operators
        if unresolved:
            logger.debug(f"Unresolved in pattern '{pattern.id}': {unresolved}"); return False
        try:
            allowed_pattern = re.compile(r'^[\d\.\+\-\*\/\(\)\s<>=!a-zA-Z]+$')
            if not allowed_pattern.match(expr_eval): logger.debug("Pattern contains invalid chars"); return False
            alpha_words = set(re.findall(r'[A-Za-z]+', expr_eval)); alpha_words = {w.lower() for w in alpha_words}
            if not alpha_words.issubset({'and','or','not'}): logger.debug(f"Non-logical tokens remain: {alpha_words - {'and','or','not'}}"); return False
            result = eval(expr_eval, {"__builtins__": {}})
            return bool(result)
        except Exception as e:
            logger.debug(f"Pattern eval exception: {e}"); return False

# ============================================================================
# DOMAIN DETECTOR
# ============================================================================

class CompleteDomainDetector:
    def __init__(self, registry: Dict[str,DomainSignature]):
        self.registry = registry; self.confidence_threshold = Config.CONFIDENCE_THRESHOLD
        self.validator = DataValidator(); self.kpi_engine = KPIEngine(registry); self.entity_intel = EntityIntelligence(registry)
        self.detection_history = []

    @timing_decorator
    def detect(self, dfs: Dict[str,pd.DataFrame], validate_input: bool=True, compute_kpis: bool=True, detect_insights: bool=True) -> Dict[str,Any]:
        detection_id = hashlib.md5(f"{datetime.now().isoformat()}".encode()).hexdigest()[:8]
        start_time = time.perf_counter()
        try:
            if validate_input:
                validation = self.validator.validate_dataframes(dfs)
                if not validation.is_valid:
                    return self._error_result("validation_failed", validation.errors, detection_id)
                if validation.warnings:
                    logger.warning(f"Data validation warnings: {validation.warnings}")
            if not dfs or all(df.empty for df in dfs.values()): return self._empty_result(detection_id)
            scores = self._score_domains(dfs)
            domain, confidence, evidence = self._select_domain(scores)
            sig = self.registry.get(domain, self.registry.get("generic"))
            result = {"detection_id": detection_id, "domain": domain, "domain_name": sig.name, "confidence": round(confidence,4), "icon": sig.icon, "color": sig.color, "description": sig.description, "evidence": evidence, "scores_top5": {k: round(v,2) for k,v in sorted(scores.items(), key=lambda x: x[1], reverse=True)[:5]}, "detected_at": datetime.now().isoformat()}
            if compute_kpis:
                kpis = self.kpi_engine.compute_for_domain(domain, dfs); result["kpis"] = kpis
            else: result["kpis"] = {}
            entity_map = self.entity_intel.map_entities(domain, dfs); result["entity_mapping"] = entity_map
            join_recs = self.entity_intel.recommend_joins(domain, dfs); result["join_recommendations"] = join_recs
            if detect_insights and compute_kpis:
                insights = InsightEvaluator.evaluate_patterns(sig, result["kpis"]); result["insights"] = insights
            else: result["insights"] = []
            quality = self.validator.assess_data_quality(dfs); result["data_quality"] = quality
            suggestions = self._generate_suggestions(sig, dfs); result["query_suggestions"] = suggestions
            result["config"] = {"metrics": sig.metrics, "dimensions": sig.dimensions, "total_kpis": len(sig.critical_kpis)+len(sig.secondary_kpis), "total_entities": len(sig.entities), "domain_weight": sig.weight}
            elapsed = time.perf_counter() - start_time
            result["performance"] = {"detection_time_seconds": round(elapsed,3), "tables_analyzed": len(dfs), "total_rows": sum(len(df) for df in dfs.values()), "total_columns": sum(len(df.columns) for df in dfs.values())}
            self.detection_history.append({"detection_id": detection_id, "domain": domain, "confidence": confidence, "timestamp": datetime.now().isoformat()})
            return result
        except Exception as e:
            logger.error(f"Detection failed: {e}", exc_info=True)
            return self._error_result("detection_error", [str(e)], detection_id)

    def _score_domains(self, dfs: Dict[str,pd.DataFrame]) -> Dict[str,float]:
        scores = {domain_id: 0.0 for domain_id in self.registry.keys()}
        all_columns = []
        for df in dfs.values():
            all_columns.extend([str(c).lower() for c in df.columns])
        for table_name in dfs.keys():
            tokens = set(re.findall(r'\w+', table_name.lower()))
            for domain_id, sig in self.registry.items():
                if not sig.enabled: continue
                matches = tokens.intersection(set(sig.file_keywords))
                if matches:
                    score_increment = len(matches) * Config.WEIGHT_FILE_KEYWORDS * sig.weight
                    scores[domain_id] += score_increment
                    logger.debug(f"Domain {domain_id} +{score_increment:.1f} from table '{table_name}'")
        for domain_id, sig in self.registry.items():
            if not sig.enabled: continue
            col_matches = 0
            for keyword in sig.column_keywords:
                keyword_lower = keyword.lower()
                for col in all_columns:
                    if keyword_lower in col:
                        col_matches += 1; break
            if col_matches > 0:
                score_increment = col_matches * Config.WEIGHT_COLUMN_KEYWORDS * sig.weight
                scores[domain_id] += score_increment
                logger.debug(f"Domain {domain_id} +{score_increment:.1f} from {col_matches} column matches")
        for domain_id, sig in self.registry.items():
            if not sig.enabled: continue
            for required_group in sig.required_columns:
                if any(any(req.lower() in col for col in all_columns) for req in required_group):
                    score_increment = Config.WEIGHT_REQUIRED_COLUMNS * sig.weight
                    scores[domain_id] += score_increment
                    logger.debug(f"Domain {domain_id} +{score_increment:.1f} from required columns")
        for domain_id, sig in self.registry.items():
            if not sig.enabled: continue
            metrics_found = sum(1 for metric in sig.metrics if any(metric.lower() in col for col in all_columns))
            dims_found = sum(1 for dim in sig.dimensions if any(dim.lower() in col for col in all_columns))
            if metrics_found > 0 and dims_found > 0:
                score_increment = (metrics_found + dims_found) * Config.WEIGHT_METRICS_DIMS * sig.weight
                scores[domain_id] += score_increment
                logger.debug(f"Domain {domain_id} +{score_increment:.1f} from {metrics_found} metrics + {dims_found} dims")
        for df in dfs.values():
            if df.empty: continue
            sample_df = df.head(Config.PATTERN_MATCH_SAMPLE_SIZE)
            for domain_id, sig in self.registry.items():
                if not sig.enabled: continue
                for pattern_name, pattern_regex in sig.value_patterns.items():
                    matching_cols = [col for col in sample_df.columns if pattern_name.lower() in str(col).lower()]
                    for col in matching_cols:
                        try:
                            compiled_pattern = sig.get_compiled_pattern(pattern_name)
                            if not compiled_pattern: continue
                            sample_values = sample_df[col].dropna().astype(str)
                            if len(sample_values) == 0: continue
                            matches = sample_values.str.match(compiled_pattern, na=False).sum()
                            match_rate = matches / max(len(sample_values),1)
                            if match_rate > 0.2:
                                score_increment = Config.WEIGHT_VALUE_PATTERNS * match_rate * sig.weight
                                scores[domain_id] += score_increment
                                logger.debug(f"Domain {domain_id} +{score_increment:.1f} from pattern '{pattern_name}'")
                        except Exception as e:
                            logger.debug(f"Pattern matching failed for {pattern_name}: {e}"); continue
        return scores

    def _select_domain(self, scores: Dict[str,float]) -> Tuple[str,float,Dict[str,Any]]:
        total_score = sum(scores.values())
        if total_score < Config.MIN_DETECTION_SCORE:
            return "generic", 0.0, {"reason":"insufficient_evidence","total_score":round(total_score,2)}
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_domain, top_score = sorted_scores[0]; second_score = sorted_scores[1][1] if len(sorted_scores)>1 else 0.0
        base_confidence = top_score / total_score if total_score>0 else 0.0
        margin = top_score - second_score
        if margin > 8.0: base_confidence = min(base_confidence * 1.25, 0.99)
        elif margin < 3.0: base_confidence *= 0.85
        if top_score > 50: base_confidence = min(base_confidence * 1.1, 0.99)
        confidence = min(max(base_confidence, 0.0), 0.99)
        if confidence < self.confidence_threshold:
            return "generic", confidence, {"warning":"low_confidence", "top_candidate": top_domain, "top_score": round(top_score,2), "confidence": round(confidence,4)}
        evidence = {"top_score": round(top_score,2), "second_score": round(second_score,2), "margin": round(margin,2), "runner_up": sorted_scores[1][0] if len(sorted_scores)>1 else None, "total_score": round(total_score,2), "score_distribution": {k: round(v,2) for k,v in sorted_scores[:3]}}
        return top_domain, confidence, evidence

    def _generate_suggestions(self, sig: DomainSignature, dfs: Dict[str,pd.DataFrame]) -> List[Dict[str,Any]]:
        suggestions = []; all_columns = []
        for df in dfs.values(): all_columns.extend(df.columns.tolist())
        metrics = []; dims = []
        for metric in sig.metrics:
            found = [c for c in all_columns if metric.lower() in str(c).lower()]; metrics.extend(found[:2])
        for dim in sig.dimensions:
            found = [c for c in all_columns if dim.lower() in str(c).lower()]; dims.extend(found[:2])
        metrics = list(dict.fromkeys(metrics))[:3]; dims = list(dict.fromkeys(dims))[:3]
        if metrics and dims:
            suggestions.append({"query": f"Top 10 {dims[0]} by {metrics[0]}", "category":"ranking","complexity":"simple"})
        if len(metrics) >= 2 and dims:
            suggestions.append({"query": f"{metrics[0]} vs {metrics[1]} by {dims[0]}", "category":"comparison","complexity":"medium"})
        if metrics:
            suggestions.append({"query": f"Total {metrics[0]}", "category":"aggregate","complexity":"simple"})
        if metrics and dims:
            suggestions.append({"query": f"{metrics[0]} trend over time", "category":"trend","complexity":"medium"})
        if len(dims) >= 2 and metrics:
            suggestions.append({"query": f"{metrics[0]} breakdown by {dims[0]} and {dims[1]}", "category":"breakdown","complexity":"medium"})
        for template in sig.query_templates[:3]:
            suggestions.append({"query": template.get("query"), "category": template.get("category","template"), "complexity": "simple"})
        return suggestions[:8]

    def _empty_result(self, detection_id: str) -> Dict[str,Any]:
        return {"detection_id": detection_id, "domain":"generic", "domain_name":"General Business Data", "confidence":0.0, "icon":"📊", "color":"#6C757D", "error":"no_data", "message":"No valid data provided for analysis", "kpis":{}, "entity_mapping":{}, "join_recommendations":[], "insights":[], "query_suggestions":[], "detected_at": datetime.now().isoformat()}

    def _error_result(self, error_type: str, errors: List[str], detection_id: str) -> Dict[str,Any]:
        return {"detection_id": detection_id, "domain":"generic", "domain_name":"Error", "confidence":0.0, "icon":"⚠️", "color":"#DC3545", "error":error_type, "errors": errors, "kpis":{}, "entity_mapping":{}, "join_recommendations":[], "insights":[], "query_suggestions":[], "detected_at": datetime.now().isoformat()}

    def get_detection_history(self, limit: int=50): return self.detection_history[-limit:]
    def export_configuration(self):
        return {"confidence_threshold": self.confidence_threshold, "domains_enabled":[domain_id for domain_id,sig in self.registry.items() if sig.enabled], "total_domains": len(self.registry), "config": {"cache_size": Config.CACHE_SIZE, "max_formula_length": Config.MAX_FORMULA_LENGTH, "formula_timeout": Config.FORMULA_TIMEOUT_SECONDS}}

# ============================================================================
# DOMAIN REGISTRY: 15 DOMAINS (FULL)
# ============================================================================

def build_complete_registry() -> Dict[str, DomainSignature]:
    registry: Dict[str, DomainSignature] = {}

    # 1. E-COMMERCE
    registry["ecommerce"] = DomainSignature(
        id="ecommerce", name="E-Commerce & Marketplace", icon="🛒", color="#FF6B35",
        description="Online retail, marketplace operations, digital commerce",
        file_keywords=["order","cart","product","sku","asin","marketplace","shopify","amazon","checkout","payment","shipping","fulfillment","returns"],
        column_keywords=["order_id","sku","asin","product_id","customer_id","cart_id","session_id","price","quantity","gmv","revenue","aov","conversion_rate","utm_source","discount","refund"],
        value_patterns={"order_id": r"^(ORD|ORDER|#)\d{4,}$", "sku": r"^[A-Z0-9\-_]{5,20}$", "asin": r"^B[0-9A-Z]{9}$"},
        required_columns=[["order_id","order_value"], ["sku","product_id"]],
        metrics=["gmv","revenue","orders","aov","conversion_rate","ltv"],
        dimensions=["category","brand","channel","region","device"],
        critical_kpis=[
            KPIDefinition("gmv","Gross Merchandise Value","SUM(order_value)","currency",{"good":1000000,"warning":500000},"Total order value",1,"aggregate",["order_value"]),
            KPIDefinition("conversion_rate","Conversion Rate","(COUNT(DISTINCT order_id) / NULLIF(COUNT(DISTINCT session_id),0)) * 100","percent",{"good":2.5,"warning":1.5},"Session to order conversion",1,"percent",["order_id","session_id"])
        ],
        secondary_kpis=[
            KPIDefinition("aov","Average Order Value","AVG(order_value)","currency",{"good":75,"warning":50},"Average value per order",2,"average",["order_value"]),
            KPIDefinition("repeat_rate","Repeat Purchase Rate","(COUNT(DISTINCT CASE WHEN repeat_customer THEN customer_id END) / NULLIF(COUNT(DISTINCT customer_id),0)) * 100","percent",{"good":30,"warning":20},"Repeat purchase rate",3,"percent",["customer_id"])
        ],
        entities=[EntityDefinition("order",["order_id"],"Customer order"), EntityDefinition("product",["sku","product_id"],"Product catalog"), EntityDefinition("customer",["customer_id"],"Customer profile")],
        join_paths=[JoinPath("order_items","orders","order_items.order_id = orders.order_id"), JoinPath("orders","customers","orders.customer_id = customers.customer_id")],
        insight_patterns=[InsightPattern("conversion_drop","conversion_rate < 1.5", InsightSeverity.CRITICAL, "Conversion rate critically low", ["Check checkout","Review payment gateway"], "conversion", 1.5)],
        benchmarks={"conversion_rate":{"p25":1.5,"p50":2.5,"p75":4.0}, "aov":{"p25":75,"p50":125,"p75":200}},
        query_templates=[{"query":"Top 10 products by revenue","category":"ranking","complexity":"simple"},{"query":"Conversion rate trend over time","category":"temporal","complexity":"medium"},{"query":"Customer segments by lifetime value","category":"segmentation","complexity":"medium"}],
        weight=1.5
    )

    # 2. HEALTHCARE
    registry["healthcare"] = DomainSignature(
        id="healthcare", name="Healthcare & Clinical Operations", icon="🏥", color="#00796B",
        description="Hospital operations, clinical analytics, patient care",
        file_keywords=["patient","hospital","clinical","ehr","admission","discharge","diagnosis","medication","lab","claims"],
        column_keywords=["patient_id","mrn","encounter_id","admission_ts","discharge_ts","diagnosis_code","icd10","cpt_code","los","readmission","provider_id","npi"],
        value_patterns={"mrn": r"^[A-Z0-9]{6,12}$", "npi": r"^\d{10}$", "icd10": r"^[A-TV-Z][0-9][A-Z0-9](\.[A-Z0-9]{1,4})?$"},
        required_columns=[["patient_id","mrn"], ["admission_ts","discharge_ts"], ["diagnosis_code"]],
        metrics=["alos","readmission_rate","bed_occupancy","mortality_rate"],
        dimensions=["hospital","department","provider","diagnosis","payer"],
        critical_kpis=[
            KPIDefinition("alos","Average Length of Stay","AVG(DATEDIFF(discharge_ts, admission_ts))","days",{"good":3.5,"warning":5.0},"Average patient stay",1,"days",["admission_ts","discharge_ts"]),
            KPIDefinition("readmission_30d","30-Day Readmission Rate","(COUNT(readmissions_within_30d)/NULLIF(COUNT(discharges),0))*100","percent",{"good":8.0,"warning":12.0},"30-day readmission rate",1,"percent",["readmission_flag","discharge_date"])
        ],
        secondary_kpis=[KPIDefinition("bed_occupancy","Bed Occupancy Rate","(SUM(beds_occupied)/NULLIF(SUM(bed_capacity),0))*100","percent",{"good":80,"warning":60},"Occupancy",3,"percent",["beds_occupied","bed_capacity"])],
        entities=[EntityDefinition("patient",["patient_id","mrn"],"Patient master"), EntityDefinition("encounter",["encounter_id"],"Hospital visit"), EntityDefinition("provider",["provider_id","npi"],"Provider")],
        join_paths=[JoinPath("encounters","patients","encounters.patient_id = patients.patient_id"), JoinPath("encounters","providers","encounters.provider_id = providers.provider_id")],
        insight_patterns=[InsightPattern("high_los","alos > 7", InsightSeverity.HIGH, "ALOS above 7 days", ["Review discharge planning","Check care pathways"], "capacity", 7)],
        benchmarks={"alos":{"p25":3.0,"p50":4.0,"p75":6.0},"readmission_30d":{"p25":6,"p50":8,"p75":12}},
        query_templates=[{"query":"Average LOS by diagnosis","category":"analytical","complexity":"medium"},{"query":"Readmission cohort analysis","category":"cohort","complexity":"complex"}],
        weight=1.8
    )

    # 3. FINTECH
    registry["fintech"] = DomainSignature(
        id="fintech", name="Financial Services & FinTech", icon="💳", color="#0033A0",
        description="Digital payments, banking, lending, fraud detection",
        file_keywords=["transaction","payment","bank","account","card","wallet","loan","credit","fraud","merchant","settlement"],
        column_keywords=["transaction_id","account_id","customer_id","merchant_id","amount","balance","currency","txn_type","payment_method","fraud_flag","kyc_status"],
        value_patterns={"transaction_id": r"^(TXN|TRX|PAY)[-_]?\d{6,}$", "iban": r"^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$"},
        required_columns=[["transaction_id","amount"], ["account_id","customer_id"]],
        metrics=["tpv","transaction_count","fraud_rate","approval_rate","npa_rate"],
        dimensions=["account","merchant","region","channel","payment_method"],
        critical_kpis=[KPIDefinition("tpv","Total Payment Volume","SUM(amount)","currency",{"good":10000000,"warning":3000000},"Total transaction volume",1,"currency",["amount"]),
                       KPIDefinition("fraud_rate","Fraud Rate","(SUM(CASE WHEN fraud_flag THEN amount ELSE 0 END) / NULLIF(SUM(amount),0)) * 100","percent",{"good":0.1,"warning":0.5},"Fraudulent %",1,"percent",["fraud_flag","amount"])],
        secondary_kpis=[KPIDefinition("transaction_count","Transaction Count","COUNT(transaction_id)","count",{"good":100000,"warning":50000},"Total transactions",3,"count",["transaction_id"])],
        entities=[EntityDefinition("transaction",["transaction_id"],"Payment transaction"), EntityDefinition("account",["account_id"],"Bank account"), EntityDefinition("customer",["customer_id"],"Customer")],
        join_paths=[JoinPath("transactions","accounts","transactions.account_id = accounts.account_id"), JoinPath("transactions","customers","transactions.customer_id = customers.customer_id")],
        insight_patterns=[InsightPattern("spike_fraud","fraud_rate > 0.5", InsightSeverity.HIGH, "High fraud rate detected", ["Investigate suspicious merchants","Pause flows"], "fraud", 0.5)],
        benchmarks={"fraud_rate":{"p25":0.05,"p50":0.1,"p75":0.3},"tpv":{"p25":1000000,"p50":5000000,"p75":20000000}},
        query_templates=[{"query":"Top merchants by TPV","category":"ranking","complexity":"simple"},{"query":"Fraud trends by region","category":"analytical","complexity":"complex"}],
        weight=1.6
    )

    # 4. SAAS
    registry["saas"] = DomainSignature(
        id="saas", name="SaaS & Subscription", icon="💻", color="#7C3AED",
        description="Subscription software, user engagement, churn analysis",
        file_keywords=["user","subscription","mrr","arr","churn","signup","activation","engagement","feature_usage","trial"],
        column_keywords=["user_id","subscription_id","mrr","arr","plan","churn_date","ltv","cac","activation_date","dau","mau","nps"],
        value_patterns={"user_id": r"^(USR|USER)[-_]?[A-Z0-9]{6,}$"},
        required_columns=[["user_id"], ["subscription_id"]],
        metrics=["mrr","arr","churn_rate","ltv","dau","mau"],
        dimensions=["plan","cohort","region","industry"],
        critical_kpis=[KPIDefinition("mrr","Monthly Recurring Revenue","SUM(mrr)","currency",{"good":100000,"warning":50000},"Total MRR",1,"currency",["mrr"]),
                       KPIDefinition("churn_rate","Monthly Churn Rate","(COUNT(churned)/NULLIF(COUNT(active),0))*100","percent",{"good":3,"warning":7},"Monthly churn %",1,"percent",["churned","active"])],
        secondary_kpis=[KPIDefinition("ltv_cac","LTV:CAC Ratio","NULLIF(AVG(ltv),0) / NULLIF(AVG(cac),1)","ratio",{"good":3,"warning":1.5},"LTV to CAC",3,"ratio",["ltv","cac"])],
        entities=[EntityDefinition("user",["user_id"],"User account"), EntityDefinition("subscription",["subscription_id"],"Subscription")],
        join_paths=[JoinPath("subscriptions","users","subscriptions.user_id = users.user_id")],
        insight_patterns=[InsightPattern("churn_spike","churn_rate > 7", InsightSeverity.HIGH, "Churn above threshold", ["Investigate onboarding","Check product changes"], "retention", 7)],
        benchmarks={"churn_rate":{"p25":2,"p50":4,"p75":8},"ltv_cac":{"p25":1.5,"p50":3,"p75":5}},
        query_templates=[{"query":"MRR trend by plan","category":"trend","complexity":"medium"},{"query":"Cohort retention over 12 months","category":"cohort","complexity":"complex"}],
        weight=1.7
    )

    # 5. MANUFACTURING
    registry["manufacturing"] = DomainSignature(
        id="manufacturing", name="Manufacturing & Production", icon="🏭", color="#6C757D",
        description="Factory operations, production lines, quality control",
        file_keywords=["production","plant","batch","oee","downtime","throughput","assembly","line","machine","equipment","shift","quality","defect","yield","scrap","maintenance"],
        column_keywords=["plant_id","line_id","batch_id","machine_id","shift","oee","availability","performance","quality_rate","throughput","defect_rate","yield","scrap_rate","downtime_minutes","cycle_time","units_produced","target"],
        value_patterns={"batch_id": r"^BATCH[-_]?\d{4,}$", "plant_id": r"^(PLT|PLANT)[-_]?\d{3,}$"},
        required_columns=[["plant_id","line_id"], ["throughput","units_produced"]],
        metrics=["oee","throughput","defect_rate","yield","downtime"],
        dimensions=["plant","line","shift","machine","operator"],
        critical_kpis=[
            KPIDefinition("oee","Overall Equipment Effectiveness","(availability * performance * quality) * 100","percent",{"good":85,"warning":70},"OEE composite",1,"percent",["availability","performance","quality"]),
            KPIDefinition("defect_rate","Defect Rate","(SUM(defects)/NULLIF(SUM(units_produced),0))*100","percent",{"good":2,"warning":5},"Defect percentage",1,"percent",["defects","units_produced"])
        ],
        secondary_kpis=[KPIDefinition("downtime_hours","Downtime Hours","SUM(downtime_minutes)/60","hours",{"good":10,"warning":30},"Total downtime hours",3,"hours",["downtime_minutes"])],
        entities=[EntityDefinition("plant",["plant_id"],"Manufacturing facility"), EntityDefinition("batch",["batch_id"],"Production batch"), EntityDefinition("machine",["machine_id"],"Equipment")],
        join_paths=[JoinPath("batches","plants","batches.plant_id = plants.plant_id"), JoinPath("machine_logs","machines","machine_logs.machine_id = machines.machine_id")],
        insight_patterns=[InsightPattern("oee_drop","oee < 70", InsightSeverity.HIGH, "OEE below 70%", ["Investigate downtime","Review maintenance"], "production", 70)],
        benchmarks={"oee":{"p25":70,"p50":85,"p75":92},"defect_rate":{"p25":1,"p50":2,"p75":4}},
        query_templates=[{"query":"OEE trend by line","category":"trend","complexity":"medium"},{"query":"Top batches by defect rate","category":"ranking","complexity":"medium"}],
        weight=1.4
    )

    # 6. RENEWABLE ENERGY
    registry["renewable_energy"] = DomainSignature(
        id="renewable_energy", name="Renewable Energy & Cleantech", icon="⚡", color="#0E9A45",
        description="Solar, wind, battery storage, grid operations",
        file_keywords=["solar","wind","turbine","inverter","scada","generation","irradiance","ghi","dni","capacity_factor","pr","availability","battery","bess","soc","soh"],
        column_keywords=["site_id","asset_id","turbine_id","inverter_id","active_power","reactive_power","wind_speed","irradiance","ghi","dni","pr","capacity_factor","availability","downtime","curtailment","soc_pct","soh_pct","energy_yield"],
        value_patterns={"asset_id": r"^(TURB|INV|BESS|WTG)[-_]?[A-Z0-9]{4,8}$"},
        required_columns=[["active_power","timestamp"], ["site_id","asset_id"]],
        metrics=["pr","capacity_factor","availability","energy_yield"],
        dimensions=["site","asset","turbine","inverter","weather"],
        critical_kpis=[KPIDefinition("pr","Performance Ratio","(actual_energy / NULLIF(theoretical_energy,0)) * 100","percent",{"good":80,"warning":65},"Plant efficiency",1,"percent",["actual_energy","theoretical_energy"]),
                       KPIDefinition("availability","System Availability","(uptime_hours / NULLIF(total_hours,0)) * 100","percent",{"good":97,"warning":90},"Asset uptime",1,"percent",["uptime_hours","total_hours"])],
        secondary_kpis=[KPIDefinition("capacity_factor","Capacity Factor","(SUM(actual_energy) / NULLIF(SUM(nameplate_capacity*hours),0)) * 100","percent",{"good":30,"warning":20},"Utilization of capacity",3,"percent",["actual_energy","nameplate_capacity"])],
        entities=[EntityDefinition("site",["site_id"],"Power plant"), EntityDefinition("asset",["asset_id","turbine_id"],"Generation asset")],
        join_paths=[JoinPath("telemetry","assets","telemetry.asset_id = assets.asset_id"), JoinPath("assets","sites","assets.site_id = sites.site_id")],
        insight_patterns=[InsightPattern("low_pr","pr < 65", InsightSeverity.HIGH, "Performance Ratio low", ["Check soiling","Inspect inverters"], "performance", 65)],
        benchmarks={"pr":{"p25":65,"p50":75,"p75":85},"availability":{"p25":90,"p50":95,"p75":98}},
        query_templates=[{"query":"PR trend by site","category":"temporal","complexity":"medium"},{"query":"Energy yield forecast","category":"predictive","complexity":"complex"}],
        weight=2.0
    )

    # 7. AUTOMOTIVE
    registry["automotive"] = DomainSignature(
        id="automotive", name="Automotive Dealerships & Mobility", icon="🚗", color="#004E89",
        description="Vehicle sales, inventory, bookings, and mobility analytics",
        file_keywords=["dealer","vehicle","auto","car","booking","showroom","test_drive","automobile","registration","inventory","vin","model","manufacturer","sale","delivery"],
        column_keywords=["dealer_id","vin","model","make","manufacturer","booking_id","vehicle_id","registration","price","showroom","test_drive","delivery_date","invoice"],
        value_patterns={"vin": r"^[A-HJ-NPR-Z0-9]{17}$", "dealer_id": r"^DLR[-_]?\d+$"},
        required_columns=[["dealer","vehicle","model"], ["vin","registration"]],
        metrics=["units_sold","bookings","test_drives","inventory_days","avg_selling_price"],
        dimensions=["dealer","model","region","manufacturer","segment"],
        critical_kpis=[KPIDefinition("units_sold","Units Sold","COUNT(DISTINCT vehicle_id)","count",{"good":100,"warning":50},"Total vehicles sold",1,"count",["vehicle_id"]),
                       KPIDefinition("conversion_rate","Booking to Sale Conversion","(SUM(sales)/NULLIF(SUM(bookings),0))*100","percent",{"good":80,"warning":60},"Bookings -> Sales",1,"percent",["sales","bookings"])],
        secondary_kpis=[KPIDefinition("inventory_days","Days in Inventory","AVG(DATEDIFF(sale_date, arrival_date))","days",{"good":30,"warning":60},"Average days in inventory",3,"days",["sale_date","arrival_date"])],
        entities=[EntityDefinition("vehicle",["vin"],"Vehicle unit"), EntityDefinition("dealer",["dealer_id"],"Dealership")],
        join_paths=[JoinPath("bookings","vehicles","bookings.vin = vehicles.vin"), JoinPath("bookings","dealers","bookings.dealer_id = dealers.dealer_id")],
        insight_patterns=[InsightPattern("aging_inventory","inventory_days > 50", InsightSeverity.MEDIUM, "Inventory aging high", ["Discount older units","Review model mix"], "inventory", 50)],
        benchmarks={"conversion_rate":{"p25":65,"p50":75,"p75":85},"inventory_days":{"p25":25,"p50":40,"p75":60}},
        query_templates=[{"query":"Top dealers by units sold","category":"ranking","complexity":"simple"},{"query":"Inventory aging by model","category":"inventory","complexity":"medium"}],
        weight=1.3
    )

    # 8. RETAIL
    registry["retail"] = DomainSignature(
        id="retail", name="Retail & Store Operations", icon="🏪", color="#F77F00",
        description="Physical stores, POS, inventory, footfall",
        file_keywords=["store","pos","retail","footfall","inventory","stock","transaction","receipt","cashier","outlet","branch"],
        column_keywords=["store_id","pos_id","transaction_id","footfall","aov","inventory","stock_on_hand","basket_size","conversion","cashier_id","receipt","department","category"],
        value_patterns={"store_id": r"^(STR|STORE)[-_]?\d{3,}$"},
        required_columns=[["store","transaction"], ["transaction_id","receipt"]],
        metrics=["sales","footfall","aov","conversion","inventory_turnover"],
        dimensions=["store","category","location","department"],
        critical_kpis=[KPIDefinition("store_conversion","Store Conversion Rate","(SUM(purchases)/NULLIF(SUM(footfall),0))*100","percent",{"good":20,"warning":10},"Visitor -> Purchase",1,"percent",["purchases","footfall"])],
        secondary_kpis=[KPIDefinition("inventory_turnover","Inventory Turnover","SUM(cost_of_goods_sold)/NULLIF(AVG(stock_on_hand),0)","ratio",{"good":6,"warning":3},"Inventory turns per period",3,"ratio",["cost_of_goods_sold","stock_on_hand"])],
        entities=[EntityDefinition("store",["store_id"],"Retail location"), EntityDefinition("transaction",["transaction_id"],"POS transaction")],
        join_paths=[JoinPath("transactions","stores","transactions.store_id = stores.store_id")],
        insight_patterns=[InsightPattern("footfall_drop","footfall < previous_period * 0.8", InsightSeverity.MEDIUM, "Footfall dropped significantly", ["Check promotions","Review opening hours"], "traffic", 0.8)],
        benchmarks={"conversion":{"p25":10,"p50":20,"p75":30},"aov":{"p25":20,"p50":50,"p75":100}},
        query_templates=[{"query":"Sales by store and category","category":"breakdown","complexity":"medium"},{"query":"Footfall vs conversion","category":"comparison","complexity":"medium"}],
        weight=1.2
    )

    # 9. TELECOM
    registry["telecom"] = DomainSignature(
        id="telecom", name="Telecommunications & Networks", icon="📡", color="#283593",
        description="Mobile networks, CDRs, subscriber analytics",
        file_keywords=["cdr","call","subscriber","msisdn","imsi","cell","tower","throughput","latency","network","billing","call_drop"],
        column_keywords=["msisdn","imsi","imei","cell_id","throughput","latency","call_drop_rate","subscriber_id","arpu","churn_rate"],
        value_patterns={"msisdn": r"^[0-9]{10,15}$", "imsi": r"^[0-9]{14,16}$"},
        required_columns=[["msisdn","subscriber_id"]],
        metrics=["arpu","churn","call_drop_rate","data_usage"],
        dimensions=["region","cell","subscriber_segment"],
        critical_kpis=[KPIDefinition("churn_rate","Monthly Churn Rate","(COUNT(churned)/NULLIF(COUNT(active),0))*100","percent",{"good":1.5,"warning":3.5},"Subscriber churn",1,"percent",["churned","active"])],
        secondary_kpis=[KPIDefinition("arpu","Average Revenue per User","SUM(revenue)/NULLIF(COUNT(DISTINCT subscriber_id),0)","currency",{"good":10,"warning":5},"ARPU",3,"currency",["revenue","subscriber_id"])],
        entities=[EntityDefinition("subscriber",["msisdn","imsi"],"Network subscriber")],
        join_paths=[JoinPath("cdr","subscribers","cdr.msisdn = subscribers.msisdn")],
        insight_patterns=[InsightPattern("high_call_drop","call_drop_rate > 2.0", InsightSeverity.HIGH, "Call drop rate high", ["Investigate cell issues","Check load"], "network", 2.0)],
        benchmarks={"churn_rate":{"p25":1.0,"p50":1.5,"p75":3.0},"arpu":{"p25":5,"p50":10,"p75":20}},
        query_templates=[{"query":"Churn by region","category":"comparison","complexity":"medium"},{"query":"Top cells by throughput","category":"ranking","complexity":"simple"}],
        weight=1.7
    )

    # 10. LOGISTICS & SUPPLY CHAIN
    registry["logistics"] = DomainSignature(
        id="logistics", name="Logistics & Supply Chain", icon="🚚", color="#0B6E4F",
        description="Freight, delivery, warehousing, tracking",
        file_keywords=["shipment","tracking","awb","logistics","warehouse","inventory","pickup","delivery","carrier","freight","etl"],
        column_keywords=["shipment_id","tracking_id","awb","warehouse_id","carrier","eta","etd","pickup_date","delivery_date","lead_time","on_time_delivery","shipment_status"],
        value_patterns={"awb": r"^[A-Z0-9\-]{8,20}$", "shipment_id": r"^(SHP|SHIP)[-_]?\d{5,}$"},
        required_columns=[["shipment_id","tracking_id"], ["warehouse_id","carrier"]],
        metrics=["on_time_delivery","lead_time","delivery_cost","fill_rate"],
        dimensions=["warehouse","carrier","route","region"],
        critical_kpis=[KPIDefinition("on_time_delivery","On-time Delivery Rate","(SUM(CASE WHEN delivery_date <= eta THEN 1 ELSE 0 END)/NULLIF(COUNT(shipment_id),0))*100","percent",{"good":95,"warning":85},"OTD %",1,"percent",["delivery_date","eta"])],
        secondary_kpis=[KPIDefinition("avg_lead_time","Average Lead Time","AVG(DATEDIFF(delivery_date,pickup_date))","days",{"good":2,"warning":5},"Average transit time",3,"days",["delivery_date","pickup_date"])],
        entities=[EntityDefinition("shipment",["shipment_id","tracking_id"],"Shipment record"), EntityDefinition("warehouse",["warehouse_id"],"Warehouse")],
        join_paths=[JoinPath("shipments","warehouses","shipments.warehouse_id = warehouses.warehouse_id"), JoinPath("shipments","carriers","shipments.carrier = carriers.carrier_code")],
        insight_patterns=[InsightPattern("otd_drop","on_time_delivery < 85", InsightSeverity.HIGH, "On-time delivery below threshold", ["Check carrier performance","Investigate routes"], "delivery", 85)],
        benchmarks={"on_time_delivery":{"p25":85,"p50":92,"p75":97},"avg_lead_time":{"p25":1,"p50":2,"p75":4}},
        query_templates=[{"query":"OTD by carrier","category":"comparison","complexity":"medium"},{"query":"Shipments delayed beyond ETA","category":"analytical","complexity":"complex"}],
        weight=1.5
    )

    # 11. REAL_ESTATE
    registry["real_estate"] = DomainSignature(
        id="real_estate", name="Real Estate & Property Operations", icon="🏢", color="#2D6A4F",
        description="Property listings, leasing, occupancy, investments",
        file_keywords=["property","lease","tenant","unit","occupancy","rental","listing","sqft","cap_rate","valuation"],
        column_keywords=["property_id","unit_id","tenant_id","lease_start","lease_end","rent","sqft","occupancy_rate","asking_price","cap_rate"],
        value_patterns={"property_id": r"^PROP[-_]?\d{4,}$", "tenant_id": r"^TNT[-_]?\d{4,}$"},
        required_columns=[["property_id","unit_id"], ["lease_start","lease_end"]],
        metrics=["occupancy_rate","rent_roll","average_rent","cap_rate"],
        dimensions=["property","unit","region","segment"],
        critical_kpis=[KPIDefinition("occupancy_rate","Occupancy Rate","(SUM(occupied_units)/NULLIF(SUM(total_units),0))*100","percent",{"good":95,"warning":85},"Percent occupied",1,"percent",["occupied_units","total_units"]),
                       KPIDefinition("rent_roll","Rent Roll","SUM(monthly_rent)","currency",{"good":100000,"warning":50000},"Total recurring rent",1,"currency",["monthly_rent"])],
        secondary_kpis=[KPIDefinition("avg_rent_per_sqft","Average Rent per Sqft","SUM(monthly_rent)/NULLIF(SUM(sqft),0)","currency",{"good":2,"warning":1},"Rent per sqft",3,"currency",["monthly_rent","sqft"])],
        entities=[EntityDefinition("property",["property_id"],"Property"), EntityDefinition("unit",["unit_id"],"Unit"), EntityDefinition("tenant",["tenant_id"],"Tenant")],
        join_paths=[JoinPath("units","properties","units.property_id = properties.property_id"), JoinPath("leases","tenants","leases.tenant_id = tenants.tenant_id")],
        insight_patterns=[InsightPattern("low_occupancy","occupancy_rate < 85", InsightSeverity.MEDIUM, "Low occupancy detected", ["Review leasing terms","Adjust marketing"], "occupancy",85)],
        benchmarks={"occupancy_rate":{"p25":85,"p50":92,"p75":98},"avg_rent_per_sqft":{"p25":1,"p50":2,"p75":3}},
        query_templates=[{"query":"Occupancy by property and region","category":"breakdown","complexity":"medium"},{"query":"Lease expirations next 90 days","category":"temporal","complexity":"medium"}],
        weight=1.3
    )

    # 12. EDTECH
    registry["edtech"] = DomainSignature(
        id="edtech", name="EdTech & Learning Platforms", icon="🎓", color="#0EA5A6",
        description="Student engagement, course metrics, completion and learning outcomes",
        file_keywords=["student","course","enrollment","completion","grade","assessment","cohort","lms","learning","activity"],
        column_keywords=["student_id","course_id","enrollment_date","completion_date","grade","score","dau","mau","engagement_score","cohort"],
        value_patterns={"student_id": r"^(STU|S)[-_]?\d{4,}$", "course_id": r"^(CRS|COURSE)[-_]?\d{3,}$"},
        required_columns=[["student_id","course_id"], ["enrollment_date"]],
        metrics=["enrollments","completion_rate","engagement","avg_score"],
        dimensions=["course","instructor","cohort","region"],
        critical_kpis=[KPIDefinition("completion_rate","Course Completion Rate","(COUNT(completions)/NULLIF(COUNT(enrollments),0))*100","percent",{"good":70,"warning":40},"Percent completed",1,"percent",["completions","enrollments"]),
                       KPIDefinition("engagement","Engagement Score Average","AVG(engagement_score)","number",{"good":70,"warning":40},"Average engagement",1,"number",["engagement_score"])],
        secondary_kpis=[KPIDefinition("avg_score","Average Assessment Score","AVG(score)","number",{"good":75,"warning":50},"Avg assessment score",3,"number",["score"])],
        entities=[EntityDefinition("student",["student_id"],"Learner"), EntityDefinition("course",["course_id"],"Course")],
        join_paths=[JoinPath("enrollments","students","enrollments.student_id = students.student_id"), JoinPath("enrollments","courses","enrollments.course_id = courses.course_id")],
        insight_patterns=[InsightPattern("low_completion","completion_rate < 40", InsightSeverity.HIGH, "Low course completion", ["Review course content","Enhance onboarding"], "retention",40)],
        benchmarks={"completion_rate":{"p25":40,"p50":60,"p75":80},"engagement":{"p25":40,"p50":60,"p75":80}},
        query_templates=[{"query":"Course completion by cohort","category":"cohort","complexity":"complex"},{"query":"Top performing instructors by avg score","category":"ranking","complexity":"medium"}],
        weight=1.2
    )

    # 13. BIOTECH & PHARMA
    registry["biotech"] = DomainSignature(
        id="biotech", name="Biotech & Pharmaceuticals", icon="🧪", color="#7B2CBF",
        description="Clinical trials, lab results, sample tracking, regulatory metrics",
        file_keywords=["clinical","trial","patient","sample","drug","protocol","arm","adverse_event","lab_result"],
        column_keywords=["trial_id","subject_id","arm","visit_date","adverse_event","lab_value","drug_batch","sample_id","site_id"],
        value_patterns={"sample_id": r"^SMP[-_]?\d{6,}$", "trial_id": r"^(TRIAL|CT)[-_]?\d{4,}$"},
        required_columns=[["trial_id","subject_id"], ["visit_date"]],
        metrics=["enrollment_rate","adverse_event_rate","protocol_deviations","query_resolution_time"],
        dimensions=["trial","site","arm","visit"],
        critical_kpis=[KPIDefinition("enrollment_rate","Enrollment Rate","(COUNT(enrolled)/NULLIF(target_enrollment,0))*100","percent",{"good":90,"warning":60},"Enrollment progress",1,"percent",["enrolled","target_enrollment"]),
                       KPIDefinition("adverse_event_rate","Adverse Event Rate","(COUNT(adverse_event)/NULLIF(COUNT(subjects),0))*100","percent",{"good":1,"warning":5},"Safety signal",1,"percent",["adverse_event","subjects"])],
        secondary_kpis=[KPIDefinition("avg_query_resolution_days","Avg Query Resolution (days)","AVG(DATEDIFF(query_resolved_date, query_raised_date))","days",{"good":7,"warning":14},"Time to resolve clinical queries",3,"days",["query_resolved_date","query_raised_date"])],
        entities=[EntityDefinition("trial",["trial_id"],"Clinical trial"), EntityDefinition("subject",["subject_id"],"Trial subject")],
        join_paths=[JoinPath("visits","subjects","visits.subject_id = subjects.subject_id"), JoinPath("labs","visits","labs.visit_id = visits.visit_id")],
        insight_patterns=[InsightPattern("slow_enrollment","enrollment_rate < 60", InsightSeverity.MEDIUM, "Enrollment slower than expected", ["Open new sites","Increase outreach"], "enrollment",60)],
        benchmarks={"enrollment_rate":{"p25":60,"p50":80,"p75":95},"adverse_event_rate":{"p25":0.5,"p50":1.0,"p75":2.0}},
        query_templates=[{"query":"Enrollment by site and arm","category":"breakdown","complexity":"medium"},{"query":"Adverse events by system organ class","category":"analytical","complexity":"complex"}],
        weight=1.9
    )

    # 14. CYBERSECURITY & IT OPS
    registry["cybersec"] = DomainSignature(
        id="cybersec", name="Cybersecurity & IT Operations", icon="🔒", color="#D00000",
        description="Alerts, incidents, uptime, vulnerability management",
        file_keywords=["alert","incident","vulnerability","scan","uptime","uptime_check","patch","threat","siem","log"],
        column_keywords=["alert_id","incident_id","severity","vuln_id","cvss","host","timestamp","uptime_percent","response_time","mean_time_to_resolve"],
        value_patterns={"vuln_id": r"^CVE-\d{4}-\d{4,}$"},
        required_columns=[["alert_id","incident_id"], ["timestamp"]],
        metrics=["mttr","alert_count","mean_time_to_detect","uptime"],
        dimensions=["host","service","environment","severity"],
        critical_kpis=[KPIDefinition("mttr","Mean Time to Resolve (hrs)","AVG(DATEDIFF(resolved_ts,opened_ts))/24","hours",{"good":4,"warning":24},"Average resolution time",1,"hours",["resolved_ts","opened_ts"]),
                       KPIDefinition("uptime","Service Uptime %","(SUM(uptime_minutes)/NULLIF(SUM(total_minutes),0))*100","percent",{"good":99.9,"warning":99.0},"Availability",1,"percent",["uptime_minutes","total_minutes"])],
        secondary_kpis=[KPIDefinition("alert_volume","Alert Volume","COUNT(alert_id)","count",{"good":1000,"warning":5000},"Alerts in period",3,"count",["alert_id"])],
        entities=[EntityDefinition("host",["host"],"Compute host"), EntityDefinition("vulnerability",["vuln_id"],"Vulnerability record")],
        join_paths=[JoinPath("alerts","hosts","alerts.host = hosts.host"), JoinPath("vulns","hosts","vulns.host = hosts.host")],
        insight_patterns=[InsightPattern("mttr_spike","mttr > 24", InsightSeverity.HIGH, "MTTR spike detected", ["Prioritize incident response","Add runbooks"], "ops",24)],
        benchmarks={"mttr":{"p25":4,"p50":8,"p75":24},"uptime":{"p25":99,"p50":99.5,"p75":99.9}},
        query_templates=[{"query":"Top hosts by alert count","category":"ranking","complexity":"simple"},{"query":"MTTR trend by service","category":"trend","complexity":"medium"}],
        weight=1.8
    )

    # 15. MEDIA & ENTERTAINMENT
    registry["media"] = DomainSignature(
        id="media", name="Media & Entertainment (Streaming & Content)", icon="🎬", color="#FF006E",
        description="Streaming metrics, content performance, ad monetization",
        file_keywords=["view","stream","session","content","impression","ad","play","watch_time","subscriber","subscription"],
        column_keywords=["content_id","user_id","view_id","watch_time","impression","ad_impression","play_start","play_end","subscriber_id","stream_id","completion_rate"],
        value_patterns={"content_id": r"^CNT[-_]?\d{4,}$", "view_id": r"^VIEW[-_]?\d{6,}$"},
        required_columns=[["content_id","view_id"], ["user_id","watch_time"]],
        metrics=["watch_time","views","completion_rate","ad_impressions","arpu"],
        dimensions=["content","genre","region","device"],
        critical_kpis=[KPIDefinition("avg_watch_time","Average Watch Time (min)","AVG(watch_time)/60","hours",{"good":30,"warning":10},"Average watch time per view (minutes)",1,"hours",["watch_time"]),
                       KPIDefinition("completion_rate","Completion Rate","(SUM(CASE WHEN play_end >= duration THEN 1 ELSE 0 END)/NULLIF(COUNT(view_id),0))*100","percent",{"good":50,"warning":25},"% of views completed",1,"percent",["play_end","duration"])],
        secondary_kpis=[KPIDefinition("ad_ctr","Ad Click Through Rate","(SUM(clicks)/NULLIF(SUM(impressions),0))*100","percent",{"good":1.5,"warning":0.5},"Ad CTR",3,"percent",["clicks","impressions"])],
        entities=[EntityDefinition("content",["content_id"],"Content item"), EntityDefinition("view",["view_id"],"View/session")],
        join_paths=[JoinPath("views","content","views.content_id = content.content_id"), JoinPath("views","users","views.user_id = users.user_id")],
        insight_patterns=[InsightPattern("completion_drop","completion_rate < 25", InsightSeverity.HIGH, "Completion rate low", ["Review content length","Test thumbnails"], "engagement",25)],
        benchmarks={"avg_watch_time":{"p25":10,"p50":20,"p75":35},"completion_rate":{"p25":25,"p50":50,"p75":70}},
        query_templates=[{"query":"Top content by watch time","category":"ranking","complexity":"simple"},{"query":"Ad revenue by region","category":"breakdown","complexity":"complex"}],
        weight=1.4
    )

    # Generic fallback
    registry["generic"] = DomainSignature(
        id="generic", name="General Business Data", icon="📊", color="#6C757D",
        description="Generic business analytics",
        file_keywords=["data","report","export"],
        column_keywords=["id","name","date","value"],
        value_patterns={},
        required_columns=[],
        metrics=["total","count","average"],
        dimensions=["category","type"],
        weight=0.3,
        enabled=True
    )

    return registry

# ============================================================================
# EXAMPLE USAGE
# ============================================================================

def example_usage():
    print("="*80); print("Enterprise Domain Intelligence System - Example"); print("="*80)
    registry = build_complete_registry()
    orders = pd.DataFrame({
        "order_id": ["ORD0001","ORD0002","ORD0003","ORD0004"],
        "customer_id": ["C001","C002","C001","C003"],
        "order_value": [150.0,200.0,75.0,300.0],
        "session_id": ["sess_"+str(i) for i in range(4)],
        "order_date": pd.date_range("2024-01-01", periods=4)
    })
    products = pd.DataFrame({
        "sku": ["PROD-123","PROD-456","PROD-789"],
        "product_name": ["Widget A","Widget B","Widget C"],
        "category": ["Electronics","Home","Electronics"],
        "price": [50.0,75.0,100.0]
    })
    detector = CompleteDomainDetector(registry)
    try:
        result = detector.detect({"orders": orders, "products": products}, validate_input=True, compute_kpis=True, detect_insights=True)
        print(f"\n✓ Detection completed successfully!")
        print(f"  Detection ID: {result['detection_id']}")
        print(f"  Domain: {result['domain_name']} ({result['domain']})")
        print(f"  Confidence: {result['confidence']:.2%}")
        print(f"  Icon: {result['icon']}")
        print(f"\n📊 Top Domain Scores:")
        for domain, score in list(result['scores_top5'].items())[:3]:
            print(f"  {domain}: {score}")
        print(f"\n💡 KPIs Computed: {result['kpis'].get('_metadata', {}).get('successful', 0)}")
        for kpi_id, kpi_data in result['kpis'].items():
            if kpi_id.startswith('_'): continue
            if isinstance(kpi_data, dict) and 'value' in kpi_data:
                print(f"  {kpi_data['name']}: {kpi_data.get('formatted_value', kpi_data['value'])} [{kpi_data['status']}]")
        print(f"\n🔗 Join Recommendations: {len(result['join_recommendations'])}")
        for rec in result['join_recommendations'][:2]:
            print(f"  {rec['from_table']}.{rec['from_column']} = {rec['to_table']}.{rec['to_column']}")
        print(f"\n🎯 Insights: {len(result['insights'])}")
        for insight in result['insights'][:2]:
            print(f"  [{insight['severity'].upper()}] {insight['message']}")
        print(f"\n📈 Data Quality: {result['data_quality']['overall_score']}/100 ({result['data_quality']['status']})")
        print(f"\n⚡ Performance:")
        perf = result['performance']
        print(f"  Detection Time: {perf['detection_time_seconds']}s")
        print(f"  Tables Analyzed: {perf['tables_analyzed']}")
        print(f"  Total Rows: {perf['total_rows']:,}")
        print(f"\n📄 Full Result (JSON) preview:")
        print(json.dumps(result, indent=2, default=str)[:800] + "...")
    except DomainDetectionError as e:
        print(f"\n✗ Detection failed: {e}")
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        logger.exception("Unexpected error in example")

if __name__ == "__main__":
    example_usage()
    print("\n" + "="*80)
    print("✓ Enterprise Domain Intelligence System Ready")
    print("="*80)
