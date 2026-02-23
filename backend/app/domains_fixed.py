# backend/app/domains_fixed.py
"""
FIXED: Secure Formula Parser with proper expression handling
Fixes the SecurityError: Expression contains unsafe characters
"""

import re
import logging
from typing import Dict, Optional, Any
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

class SecureFormulaEvaluator:
    """
    Enhanced secure formula evaluator that handles SQL-like expressions
    """
    
    # Whitelist of safe SQL functions we'll convert to pandas operations
    SAFE_SQL_FUNCTIONS = {
        'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'MEAN',
        'DISTINCT', 'NULLIF', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
    }
    
    @classmethod
    def evaluate(cls, expr: str, context: Dict[str, float]) -> Optional[float]:
        """
        Safely evaluate formula expression with SQL function support
        
        Args:
            expr: Formula expression (may contain SQL functions)
            context: Variable values from data
            
        Returns:
            Computed value or None if evaluation fails
        """
        try:
            # Clean and prepare expression
            expr_clean = expr.strip()
            
            # Check if this is a SQL-style expression
            if cls._is_sql_expression(expr_clean):
                return cls._evaluate_sql_expression(expr_clean, context)
            
            # Otherwise, handle as arithmetic expression
            return cls._evaluate_arithmetic(expr_clean, context)
            
        except Exception as e:
            logger.warning(f"Formula evaluation failed for '{expr}': {e}")
            return None
    
    @classmethod
    def _is_sql_expression(cls, expr: str) -> bool:
        """Check if expression contains SQL functions"""
        expr_upper = expr.upper()
        return any(func in expr_upper for func in cls.SAFE_SQL_FUNCTIONS)
    
    @classmethod
    def _evaluate_sql_expression(cls, expr: str, context: Dict[str, float]) -> Optional[float]:
        """
        Handle SQL-style expressions by converting to Python operations
        
        Examples:
            (COUNT(DISTINCT customer_id) / NULLIF(COUNT(DISTINCT session_id),0)) * 100
            -> (distinct_customer_count / max(distinct_session_count, 0.0001)) * 100
        """
        expr_work = expr
        
        # Handle COUNT(DISTINCT column)
        count_distinct_pattern = r'COUNT\s*\(\s*DISTINCT\s+(\w+)\s*\)'
        for match in re.finditer(count_distinct_pattern, expr_work, re.IGNORECASE):
            col_name = match.group(1)
            # Get the distinct count from context (should be pre-computed)
            value = context.get(f'distinct_{col_name}', context.get(col_name, 0))
            expr_work = expr_work.replace(match.group(0), str(float(value)))
        
        # Handle COUNT(column)
        count_pattern = r'COUNT\s*\(\s*(\w+)\s*\)'
        for match in re.finditer(count_pattern, expr_work, re.IGNORECASE):
            col_name = match.group(1)
            value = context.get(f'count_{col_name}', context.get(col_name, 0))
            expr_work = expr_work.replace(match.group(0), str(float(value)))
        
        # Handle NULLIF(x, 0) - convert to max(x, 0.0001) to avoid division by zero
        nullif_pattern = r'NULLIF\s*\(\s*([^,]+)\s*,\s*0\s*\)'
        for match in re.finditer(nullif_pattern, expr_work, re.IGNORECASE):
            inner_expr = match.group(1).strip()
            # Replace with safe division protection
            expr_work = expr_work.replace(match.group(0), f'max({inner_expr}, 0.0001)')
        
        # Handle CASE WHEN expressions
        case_pattern = r'CASE\s+WHEN\s+(.+?)\s+THEN\s+(.+?)\s+(?:ELSE\s+(.+?)\s+)?END'
        for match in re.finditer(case_pattern, expr_work, re.IGNORECASE):
            condition = match.group(1).strip()
            then_val = match.group(2).strip()
            else_val = match.group(3).strip() if match.group(3) else '0'
            
            # Evaluate condition
            try:
                # Simple condition evaluation
                if 'THEN' in condition.upper():
                    result_val = then_val
                else:
                    result_val = else_val
                expr_work = expr_work.replace(match.group(0), result_val)
            except:
                expr_work = expr_work.replace(match.group(0), '0')
        
        # Now evaluate as arithmetic expression
        return cls._evaluate_arithmetic(expr_work, context)
    
    @classmethod
    def _evaluate_arithmetic(cls, expr: str, context: Dict[str, float]) -> Optional[float]:
        """
        Safely evaluate arithmetic expression
        """
        # Substitute variables with their values
        expr_work = expr
        for var, val in context.items():
            if val is None:
                val = 0.0
            # Use word boundaries to avoid partial matches
            expr_work = re.sub(r'\b' + re.escape(var) + r'\b', str(float(val)), expr_work)
        
        # Remove percentage signs
        expr_work = expr_work.replace('%', '')
        
        # Validate the expression contains only safe characters
        if not cls._is_safe_expression(expr_work):
            logger.warning(f"Expression contains potentially unsafe characters: {expr_work}")
            return None
        
        try:
            # Use eval with restricted namespace
            safe_dict = {
                '__builtins__': {},
                'max': max,
                'min': min,
                'abs': abs,
                'round': round,
                'pow': pow,
            }
            result = eval(expr_work, safe_dict, {})
            
            if isinstance(result, (int, float)) and not (np.isnan(result) or np.isinf(result)):
                return float(result)
            return None
            
        except Exception as e:
            logger.debug(f"Arithmetic evaluation failed for '{expr_work}': {e}")
            return None
    
    @classmethod
    def _is_safe_expression(cls, expr: str) -> bool:
        """
        Check if expression contains only safe characters
        Allow: numbers, operators, parentheses, decimal points, basic functions
        """
        # Allow alphanumeric, operators, parentheses, dots, commas, spaces
        safe_pattern = re.compile(r'^[a-zA-Z0-9\+\-\*\/\(\)\.\,\s]+$')
        return bool(safe_pattern.match(expr))


class EnhancedFormulaParser:
    """
    Enhanced formula parser that handles complex KPI formulas
    """
    
    @classmethod
    def parse(cls, formula: str, dfs: Dict[str, pd.DataFrame]) -> Optional[float]:
        """
        Parse and compute formula value from dataframes
        
        Args:
            formula: KPI formula (may contain SQL-like syntax)
            dfs: Dictionary of dataframes (usually {'main': df})
            
        Returns:
            Computed value or None
        """
        if not formula or not formula.strip():
            return None
        
        try:
            # Pre-compute common aggregations from dataframes
            context = cls._build_context(formula, dfs)
            
            # Evaluate using secure evaluator
            result = SecureFormulaEvaluator.evaluate(formula, context)
            
            return result
            
        except Exception as e:
            logger.error(f"Formula parsing failed: {e}")
            return None
    
    @classmethod
    def _build_context(cls, formula: str, dfs: Dict[str, pd.DataFrame]) -> Dict[str, float]:
        """
        Build context dictionary with pre-computed values
        """
        context = {}
        
        # Get the main dataframe
        df = dfs.get('main', next(iter(dfs.values())) if dfs else pd.DataFrame())
        
        if df.empty:
            return context
        
        # Extract column names referenced in formula
        # Look for patterns like: column_name, COUNT(column), COUNT(DISTINCT column)
        columns = cls._extract_column_names(formula, df)
        
        # Pre-compute aggregations for each column
        for col in columns:
            if col not in df.columns:
                continue
            
            try:
                # Basic aggregations
                context[col] = float(df[col].sum()) if pd.api.types.is_numeric_dtype(df[col]) else float(df[col].count())
                context[f'count_{col}'] = float(df[col].count())
                context[f'sum_{col}'] = float(df[col].sum()) if pd.api.types.is_numeric_dtype(df[col]) else 0.0
                
                # Distinct count
                context[f'distinct_{col}'] = float(df[col].nunique())
                
                # Mean/average
                if pd.api.types.is_numeric_dtype(df[col]):
                    context[f'avg_{col}'] = float(df[col].mean())
                    context[f'mean_{col}'] = float(df[col].mean())
                
            except Exception as e:
                logger.debug(f"Failed to compute aggregations for column '{col}': {e}")
                continue
        
        return context
    
    @classmethod
    def _extract_column_names(cls, formula: str, df: pd.DataFrame) -> list:
        """
        Extract column names referenced in the formula
        """
        columns = []
        
        # Find all word-like tokens in formula
        tokens = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', formula)
        
        # SQL keywords to exclude
        sql_keywords = {
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'NULLIF',
            'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR', 'NOT'
        }
        
        # Check which tokens are actual column names
        for token in tokens:
            if token.upper() not in sql_keywords:
                # Fuzzy match against dataframe columns
                for col in df.columns:
                    if token.lower() in str(col).lower():
                        columns.append(col)
                        break
        
        return list(set(columns))  # Remove duplicates


# Example usage for testing
if __name__ == "__main__":
    # Test case 1: Conversion rate formula
    formula1 = "(COUNT(DISTINCT order_id) / NULLIF(COUNT(DISTINCT session_id),0)) * 100"
    
    # Simulate context
    context1 = {
        'distinct_order_id': 150,
        'distinct_session_id': 1000
    }
    
    result1 = SecureFormulaEvaluator.evaluate(formula1, context1)
    print(f"Conversion Rate: {result1}%")  # Should output: 15.0%
    
    # Test case 2: Repeat purchase rate
    formula2 = "(COUNT(DISTINCT CASE WHEN repeat_customer THEN customer_id END) / NULLIF(COUNT(DISTINCT customer_id),0)) * 100"
    
    context2 = {
        'distinct_customer_id': 500,
        'count_repeat_customers': 150
    }
    
    result2 = SecureFormulaEvaluator.evaluate(formula2, context2)
    print(f"Repeat Rate: {result2}%")