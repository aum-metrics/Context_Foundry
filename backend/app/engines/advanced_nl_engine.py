# backend/app/engines/advanced_nl_engine.py
"""
ADVANCED NATURAL LANGUAGE TO SQL ENGINE
Semantic query understanding with intent classification and entity extraction
NO EXTERNAL LLMs - Pure algorithmic approach
"""

from typing import Dict, List, Any, Optional, Tuple
import re
from dataclasses import dataclass
from enum import Enum
import pandas as pd
from difflib import SequenceMatcher

class QueryIntent(Enum):
    """Query intent classification"""
    AGGREGATE = "aggregate"  # sum, count, average, etc.
    FILTER = "filter"  # where conditions
    SORT = "sort"  # order by
    GROUP_BY = "group_by"  # group by with aggregation
    TOP_N = "top_n"  # limit with order
    DISTRIBUTION = "distribution"  # value counts
    COMPARISON = "comparison"  # compare two metrics
    TREND = "trend"  # time-based analysis
    CORRELATION = "correlation"  # relationship between columns
    OUTLIER = "outlier"  # anomaly detection

@dataclass
class QueryEntity:
    """Extracted entity from natural language"""
    type: str  # column, value, operator, aggregation, number
    value: str
    confidence: float
    original_text: str

@dataclass
class ParsedQuery:
    """Structured representation of parsed query"""
    intent: QueryIntent
    entities: List[QueryEntity]
    columns: List[str]
    aggregations: List[Dict[str, str]]  # [{func: 'sum', column: 'revenue'}]
    filters: List[Dict[str, Any]]  # [{column: 'status', op: '==', value: 'active'}]
    group_by: List[str]
    order_by: List[Dict[str, str]]  # [{column: 'revenue', direction: 'desc'}]
    limit: Optional[int]
    confidence: float

class AdvancedNLEngine:
    """
    Advanced Natural Language to SQL Engine
    Uses semantic patterns, entity extraction, and intent classification
    """
    
    def __init__(self):
        # Aggregation function mappings
        self.aggregation_patterns = {
            'sum': ['sum', 'total', 'add up', 'combined', 'altogether'],
            'avg': ['average', 'mean', 'avg', 'typical'],
            'count': ['count', 'number of', 'how many', 'quantity'],
            'max': ['maximum', 'max', 'highest', 'largest', 'biggest', 'top', 'peak'],
            'min': ['minimum', 'min', 'lowest', 'smallest', 'least', 'bottom'],
            'std': ['standard deviation', 'std', 'variance', 'spread'],
            'median': ['median', 'middle', '50th percentile']
        }
        
        # Comparison operators
        self.operator_patterns = {
            '==': ['is', 'equals', 'equal to', 'is equal to', '='],
            '!=': ['is not', 'not equal', 'not equal to', '!=', '<>'],
            '>': ['greater than', 'more than', 'above', 'over', 'exceeds', '>'],
            '>=': ['greater than or equal', 'at least', 'minimum of', '>='],
            '<': ['less than', 'below', 'under', 'fewer than', '<'],
            '<=': ['less than or equal', 'at most', 'maximum of', '<='],
            'in': ['in', 'one of', 'among', 'within'],
            'like': ['contains', 'includes', 'has', 'with', 'like']
        }
        
        # Sort direction
        self.sort_patterns = {
            'desc': ['descending', 'desc', 'highest first', 'largest first', 'decreasing'],
            'asc': ['ascending', 'asc', 'lowest first', 'smallest first', 'increasing']
        }
        
        # Intent patterns
        self.intent_patterns = {
            QueryIntent.TOP_N: [
                r'top\s+(\d+)',
                r'(\d+)\s+(?:highest|largest|biggest)',
                r'best\s+(\d+)',
                r'first\s+(\d+)'
            ],
            QueryIntent.DISTRIBUTION: [
                r'distribution\s+of',
                r'breakdown\s+(?:of|by)',
                r'how\s+many\s+(?:in|per|by)',
                r'count\s+(?:of|by|per)'
            ],
            QueryIntent.TREND: [
                r'trend\s+(?:of|in|over)',
                r'over\s+time',
                r'by\s+(?:month|quarter|year|week|day)',
                r'time\s+series'
            ],
            QueryIntent.COMPARISON: [
                r'compare\s+(\w+)\s+(?:and|vs|versus)\s+(\w+)',
                r'difference\s+between',
                r'(\w+)\s+vs\s+(\w+)'
            ],
            QueryIntent.CORRELATION: [
                r'correlation\s+between',
                r'relationship\s+between',
                r'how\s+does\s+(\w+)\s+affect\s+(\w+)'
            ],
            QueryIntent.OUTLIER: [
                r'outlier',
                r'anomal',
                r'unusual',
                r'abnormal'
            ]
        }
    
    def parse_query(self, question: str, df: pd.DataFrame) -> ParsedQuery:
        """
        Parse natural language question into structured query
        
        Args:
            question: Natural language question
            df: DataFrame to query against
            
        Returns:
            ParsedQuery object with extracted entities and intent
        """
        question_lower = question.lower().strip()
        
        # Extract entities
        entities = self._extract_entities(question_lower, df)
        
        # Classify intent
        intent = self._classify_intent(question_lower, entities)
        
        # Extract query components
        columns = self._extract_columns(entities, df)
        aggregations = self._extract_aggregations(entities, question_lower)
        filters = self._extract_filters(entities, question_lower, df)
        group_by = self._extract_group_by(entities, question_lower, df)
        order_by = self._extract_order_by(entities, question_lower, df)
        limit = self._extract_limit(question_lower)
        
        # Calculate confidence
        confidence = self._calculate_confidence(entities, columns, df)
        
        return ParsedQuery(
            intent=intent,
            entities=entities,
            columns=columns,
            aggregations=aggregations,
            filters=filters,
            group_by=group_by,
            order_by=order_by,
            limit=limit,
            confidence=confidence
        )
    
    def _extract_entities(self, question: str, df: pd.DataFrame) -> List[QueryEntity]:
        """Extract entities from question"""
        entities = []
        
        # Extract column names (fuzzy matching)
        for col in df.columns:
            # Direct match
            if col.lower() in question:
                entities.append(QueryEntity(
                    type='column',
                    value=col,
                    confidence=1.0,
                    original_text=col.lower()
                ))
            else:
                # Fuzzy match
                words = question.split()
                for word in words:
                    similarity = SequenceMatcher(None, col.lower(), word).ratio()
                    if similarity > 0.7:
                        entities.append(QueryEntity(
                            type='column',
                            value=col,
                            confidence=similarity,
                            original_text=word
                        ))
        
        # Extract aggregation functions
        for func, patterns in self.aggregation_patterns.items():
            for pattern in patterns:
                if pattern in question:
                    entities.append(QueryEntity(
                        type='aggregation',
                        value=func,
                        confidence=1.0,
                        original_text=pattern
                    ))
                    break
        
        # Extract operators
        for op, patterns in self.operator_patterns.items():
            for pattern in patterns:
                if pattern in question:
                    entities.append(QueryEntity(
                        type='operator',
                        value=op,
                        confidence=1.0,
                        original_text=pattern
                    ))
                    break
        
        # Extract numbers
        numbers = re.findall(r'\b\d+(?:\.\d+)?\b', question)
        for num in numbers:
            entities.append(QueryEntity(
                type='number',
                value=num,
                confidence=1.0,
                original_text=num
            ))
        
        # Extract quoted values
        quoted = re.findall(r'["\']([^"\']+)["\']', question)
        for val in quoted:
            entities.append(QueryEntity(
                type='value',
                value=val,
                confidence=1.0,
                original_text=val
            ))
        
        return entities
    
    def _classify_intent(self, question: str, entities: List[QueryEntity]) -> QueryIntent:
        """Classify query intent"""
        # Check pattern-based intents
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, question):
                    return intent
        
        # Fallback to entity-based classification
        has_aggregation = any(e.type == 'aggregation' for e in entities)
        has_filter = any(e.type == 'operator' for e in entities)
        has_limit = 'top' in question or 'first' in question
        
        if has_limit and has_aggregation:
            return QueryIntent.TOP_N
        elif has_aggregation and not has_filter:
            return QueryIntent.AGGREGATE
        elif has_filter:
            return QueryIntent.FILTER
        elif 'group' in question or 'by' in question:
            return QueryIntent.GROUP_BY
        elif 'sort' in question or 'order' in question:
            return QueryIntent.SORT
        else:
            return QueryIntent.AGGREGATE
    
    def _extract_columns(self, entities: List[QueryEntity], df: pd.DataFrame) -> List[str]:
        """Extract column names from entities"""
        columns = [e.value for e in entities if e.type == 'column']
        
        # Remove duplicates while preserving order
        seen = set()
        unique_columns = []
        for col in columns:
            if col not in seen:
                seen.add(col)
                unique_columns.append(col)
        
        return unique_columns
    
    def _extract_aggregations(self, entities: List[QueryEntity], question: str) -> List[Dict[str, str]]:
        """Extract aggregation functions"""
        aggregations = []
        agg_entities = [e for e in entities if e.type == 'aggregation']
        col_entities = [e for e in entities if e.type == 'column']
        
        if agg_entities and col_entities:
            # Match aggregations to columns
            for agg in agg_entities:
                for col in col_entities:
                    aggregations.append({
                        'function': agg.value,
                        'column': col.value
                    })
        
        return aggregations
    
    def _extract_filters(self, entities: List[QueryEntity], question: str, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Extract filter conditions"""
        filters = []
        
        op_entities = [e for e in entities if e.type == 'operator']
        col_entities = [e for e in entities if e.type == 'column']
        val_entities = [e for e in entities if e.type in ['value', 'number']]
        
        if op_entities and col_entities and val_entities:
            for op in op_entities:
                for col in col_entities:
                    for val in val_entities:
                        filters.append({
                            'column': col.value,
                            'operator': op.value,
                            'value': val.value
                        })
        
        return filters
    
    def _extract_group_by(self, entities: List[QueryEntity], question: str, df: pd.DataFrame) -> List[str]:
        """Extract group by columns"""
        group_by = []
        
        # Look for "by <column>" pattern
        by_match = re.search(r'by\s+(\w+)', question)
        if by_match:
            col_name = by_match.group(1)
            # Find matching column
            for col in df.columns:
                if col.lower() == col_name.lower() or SequenceMatcher(None, col.lower(), col_name).ratio() > 0.8:
                    group_by.append(col)
                    break
        
        return group_by
    
    def _extract_order_by(self, entities: List[QueryEntity], question: str, df: pd.DataFrame) -> List[Dict[str, str]]:
        """Extract order by clauses"""
        order_by = []
        
        # Determine direction
        direction = 'desc'  # default
        for dir_key, patterns in self.sort_patterns.items():
            if any(p in question for p in patterns):
                direction = dir_key
                break
        
        # Find columns to sort by
        col_entities = [e for e in entities if e.type == 'column']
        if col_entities:
            order_by.append({
                'column': col_entities[0].value,
                'direction': direction
            })
        
        return order_by
    
    def _extract_limit(self, question: str) -> Optional[int]:
        """Extract limit from question"""
        # Look for "top N" or "first N"
        top_match = re.search(r'top\s+(\d+)', question)
        if top_match:
            return int(top_match.group(1))
        
        first_match = re.search(r'first\s+(\d+)', question)
        if first_match:
            return int(first_match.group(1))
        
        return None
    
    def _calculate_confidence(self, entities: List[QueryEntity], columns: List[str], df: pd.DataFrame) -> float:
        """Calculate overall confidence score"""
        if not entities:
            return 0.0
        
        # Base confidence on entity confidence scores
        avg_entity_confidence = sum(e.confidence for e in entities) / len(entities)
        
        # Boost if we found valid columns
        column_boost = 0.2 if columns and all(c in df.columns for c in columns) else 0.0
        
        # Cap at 0.99
        return min(0.99, avg_entity_confidence + column_boost)
    
    def execute_query(self, parsed_query: ParsedQuery, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Execute parsed query on DataFrame
        
        Args:
            parsed_query: Parsed query object
            df: DataFrame to query
            
        Returns:
            Query result with data and metadata
        """
        result_df = df.copy()
        
        # Apply filters
        for filter_cond in parsed_query.filters:
            col = filter_cond['column']
            op = filter_cond['operator']
            val = filter_cond['value']
            
            if col in result_df.columns:
                if op == '==':
                    result_df = result_df[result_df[col] == val]
                elif op == '!=':
                    result_df = result_df[result_df[col] != val]
                elif op == '>':
                    result_df = result_df[result_df[col] > float(val)]
                elif op == '>=':
                    result_df = result_df[result_df[col] >= float(val)]
                elif op == '<':
                    result_df = result_df[result_df[col] < float(val)]
                elif op == '<=':
                    result_df = result_df[result_df[col] <= float(val)]
                elif op == 'like':
                    result_df = result_df[result_df[col].astype(str).str.contains(val, case=False)]
        
        # Apply group by and aggregations
        if parsed_query.group_by and parsed_query.aggregations:
            agg_dict = {}
            for agg in parsed_query.aggregations:
                col = agg['column']
                func = agg['function']
                if col in result_df.columns:
                    agg_dict[col] = func
            
            if agg_dict:
                result_df = result_df.groupby(parsed_query.group_by).agg(agg_dict).reset_index()
        
        # Apply aggregations without group by
        elif parsed_query.aggregations and not parsed_query.group_by:
            agg_results = {}
            for agg in parsed_query.aggregations:
                col = agg['column']
                func = agg['function']
                if col in result_df.columns:
                    if func == 'sum':
                        agg_results[f'{func}_{col}'] = result_df[col].sum()
                    elif func == 'avg':
                        agg_results[f'{func}_{col}'] = result_df[col].mean()
                    elif func == 'count':
                        agg_results[f'{func}_{col}'] = result_df[col].count()
                    elif func == 'max':
                        agg_results[f'{func}_{col}'] = result_df[col].max()
                    elif func == 'min':
                        agg_results[f'{func}_{col}'] = result_df[col].min()
                    elif func == 'std':
                        agg_results[f'{func}_{col}'] = result_df[col].std()
                    elif func == 'median':
                        agg_results[f'{func}_{col}'] = result_df[col].median()
            
            result_df = pd.DataFrame([agg_results])
        
        # Apply sorting
        if parsed_query.order_by:
            for order in parsed_query.order_by:
                col = order['column']
                direction = order['direction']
                if col in result_df.columns:
                    result_df = result_df.sort_values(by=col, ascending=(direction == 'asc'))
        
        # Apply limit
        if parsed_query.limit:
            result_df = result_df.head(parsed_query.limit)
        
        # Convert to dict
        return {
            'data': result_df.to_dict('records'),
            'columns': list(result_df.columns),
            'row_count': len(result_df),
            'intent': parsed_query.intent.value,
            'confidence': parsed_query.confidence
        }
