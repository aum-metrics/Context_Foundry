# engines/nl_engine.py - UNIVERSAL FIXED VERSION
import re
import difflib
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class HybridNLInterpreter:
    """Universal natural language query interpreter"""
    
    def __init__(self):
        # Enhanced regex patterns for GROUP BY queries
        self.re_count_by = re.compile(
            r'(?:count|total|number\s+of)\s+(?:of\s+)?(\w+)?\s+(?:by|per|group\s+by|grouped\s+by)\s+([\w\s,]+)',
            re.IGNORECASE
        )
        
        self.re_agg_by = re.compile(
            r'(sum|total|average|mean|count|min|max|median)\s+(?:of\s+)?([\w\s\_]+)\s+(?:by|per|group\s+by)\s+([\w\s,]+)',
            re.IGNORECASE
        )
        
        self.re_top = re.compile(
            r'(?:top|bottom|best|worst|highest|lowest)\s+(\d+)\s+(?:of\s+)?([\w\-\_\s]+)(?:\s+by\s+([\w\-\_\s]+))?',
            re.IGNORECASE
        )
        
        self.re_simple_agg = re.compile(
            r'(sum|total|average|mean|count|min|max)\s+(?:of\s+)?([\w\s\_]+)',
            re.IGNORECASE
        )
        
        self.re_show_by = re.compile(
            r'(?:show|display|list)\s+([\w\s\_]+)\s+(?:by|per|group\s+by)\s+([\w\s,]+)',
            re.IGNORECASE
        )
        
        self.re_distribution = re.compile(
            r'(?:distribution|breakdown)\s+(?:of\s+)?([\w\s\_]+)(?:\s+by\s+([\w\s\_]+))?',
            re.IGNORECASE
        )

        # ADDED: Rank/Sort pattern
        self.re_rank = re.compile(
            r'(?:rank|order|sort)\s+(?:of\s+)?([\w\s\_]+)\s+(?:by|per|according\s+to|on)\s+([\w\s\_]+)',
            re.IGNORECASE
        )
        
        self.common_aggs = {
            'sum': 'sum', 'total': 'sum', 'average': 'mean', 'avg': 'mean',
            'mean': 'mean', 'count': 'count', 'min': 'min', 'max': 'max',
            'median': 'median', 'number': 'count', 'total': 'sum'
        }

    def _fuzzy_col(self, token: str, columns: List[str], threshold: float = 0.5) -> Optional[str]:
        """Enhanced fuzzy column matching with plural support"""
        if not token or not columns:
            return None
        
        token_l = token.lower().strip()
        
        # 1. Exact match
        for c in columns:
            if token_l == str(c).lower():
                return c
        
        # 2. Plural/Singular check
        token_singular = token_l[:-1] if token_l.endswith('s') else token_l
        for c in columns:
            c_lower = str(c).lower()
            if token_singular == c_lower:
                return c
        
        # 3. Substring match
        for c in columns:
            c_lower = str(c).lower()
            if token_l in c_lower: return c
            if token_singular in c_lower: return c
        
        # 4. Word boundary match
        for c in columns:
            c_lower = str(c).lower()
            if f"_{token_l}" in c_lower or f"{token_l}_" in c_lower:
                return c
        
        # 5. Fuzzy match
        matches = difflib.get_close_matches(
            token_l,
            [str(c).lower() for c in columns],
            n=1,
            cutoff=threshold
        )
        
        if matches:
            idx = [str(c).lower() for c in columns].index(matches[0])
            return columns[idx]
        
        return None

    def parse(self, prompt: str, columns: List[str]) -> Dict[str, Any]:
        """
        Universal query parser - handles ALL query types generically
        """
        if not prompt or not prompt.strip():
            return {'task': 'error', 'error': 'Empty query', 'raw': prompt}
        
        if not columns:
            return {'task': 'error', 'error': 'No columns available', 'raw': prompt}
        
        spec = {
            'task': 'explore',
            'metrics': [],
            'dimensions': [],
            'top_n': 10,
            'agg': 'sum',
            'filters': [],
            'raw': prompt,
            'confidence': 0.0,
            'matched_patterns': []
        }
        
        p = prompt.strip()
        confidence = 0.0
        
        try:
            # ============ PATTERN 1: COUNT/TOTAL BY (GROUP BY) ============
            m = self.re_count_by.search(p)
            if m:
                entity = m.group(1)  # Optional - what to count
                dim_tok = m.group(2)  # Dimension to group by
                
                # Parse dimension (can be comma-separated)
                dim_parts = [d.strip() for d in dim_tok.split(',')]
                for dim_part in dim_parts[:2]:  # Max 2 dimensions
                    col = self._fuzzy_col(dim_part, columns)
                    if col and col not in spec['dimensions']:
                        spec['dimensions'].append(col)
                        confidence += 0.4
                        spec['matched_patterns'].append(f'dimension:{col}')
                
                # If entity specified, try to find it as a metric
                if entity:
                    col = self._fuzzy_col(entity, columns)
                    if col:
                        spec['metrics'].append(col)
                        confidence += 0.3
                
                # Default to count if no metric found
                if not spec['metrics']:
                    spec['metrics'] = ['*']  # Count rows
                
                spec['task'] = 'group_count'
                spec['agg'] = 'count'
                spec['confidence'] = min(confidence, 0.95)
                
                logger.info(f"Matched COUNT BY: dims={spec['dimensions']}")
                return spec
            
            # ============ PATTERN 2: AGG BY (SUM/AVG BY) ============
            m = self.re_agg_by.search(p)
            if m:
                agg = m.group(1).lower()
                metric_tok = m.group(2)
                dim_tok = m.group(3)
                
                # Parse metric
                col = self._fuzzy_col(metric_tok, columns)
                if col:
                    spec['metrics'].append(col)
                    confidence += 0.4
                    spec['matched_patterns'].append(f'metric:{col}')
                
                # Parse dimension
                dim_parts = [d.strip() for d in dim_tok.split(',')]
                for dim_part in dim_parts[:2]:
                    col = self._fuzzy_col(dim_part, columns)
                    if col and col not in spec['dimensions']:
                        spec['dimensions'].append(col)
                        confidence += 0.4
                        spec['matched_patterns'].append(f'dimension:{col}')
                
                spec['task'] = 'aggregate_by'
                spec['agg'] = self.common_aggs.get(agg, 'sum')
                spec['confidence'] = min(confidence, 0.95)
                
                logger.info(f"Matched AGG BY: {spec['agg']} of {spec['metrics']} by {spec['dimensions']}")
                return spec
            
            # ============ PATTERN 3: TOP N ============
            m = self.re_top.search(p)
            if m:
                try:
                    spec['top_n'] = int(m.group(1))
                except:
                    spec['top_n'] = 10
                
                entity_tok = m.group(2)
                metric_tok = m.group(3) if len(m.groups()) >= 3 else None
                
                # Parse entity as dimension
                col = self._fuzzy_col(entity_tok, columns)
                if col:
                    spec['dimensions'].append(col)
                    confidence += 0.4
                
                # Parse metric
                if metric_tok:
                    col = self._fuzzy_col(metric_tok, columns)
                    if col:
                        spec['metrics'].append(col)
                        confidence += 0.4
                else:
                    # Try to infer metric from query
                    for word in p.lower().split():
                        col = self._fuzzy_col(word, columns)
                        if col and col not in spec['dimensions']:
                            spec['metrics'].append(col)
                            confidence += 0.2
                            break
                
                spec['task'] = 'rank'
                spec['confidence'] = min(confidence, 0.9)
                
                logger.info(f"Matched TOP: top {spec['top_n']} {spec['dimensions']} by {spec['metrics']}")
                return spec

            # ============ PATTERN 4: RANK/SORT (ADDED) ============
            m = self.re_rank.search(p)
            if m:
                entity_tok = m.group(1)
                metric_tok = m.group(2)
                
                # Entity -> Dimension
                col = self._fuzzy_col(entity_tok, columns)
                if col:
                    spec['dimensions'].append(col)
                    confidence += 0.4
                
                # Metric -> Metric
                col = self._fuzzy_col(metric_tok, columns)
                if col:
                    spec['metrics'].append(col)
                    confidence += 0.4
                
                spec['task'] = 'rank'
                spec['agg'] = 'sum' # Default agg for ranking
                spec['confidence'] = min(confidence, 0.95)
                return spec
            
            # ============ PATTERN 5: SIMPLE AGGREGATION ============
            m = self.re_simple_agg.search(p)
            if m:
                agg = m.group(1).lower()
                metric_tok = m.group(2)
                
                col = self._fuzzy_col(metric_tok, columns)
                if col:
                    spec['metrics'].append(col)
                    confidence += 0.5
                    spec['matched_patterns'].append(f'simple_agg:{col}')
                
                spec['task'] = 'aggregate'
                spec['agg'] = self.common_aggs.get(agg, 'sum')
                spec['confidence'] = confidence
                
                logger.info(f"Matched SIMPLE AGG: {spec['agg']} of {spec['metrics']}")
                return spec
            
            # ============ PATTERN 6: SHOW BY ============
            m = self.re_show_by.search(p)
            if m:
                metric_tok = m.group(1)
                dim_tok = m.group(2)
                
                col = self._fuzzy_col(metric_tok, columns)
                if col:
                    spec['metrics'].append(col)
                    confidence += 0.3
                
                dim_parts = [d.strip() for d in dim_tok.split(',')]
                for dim_part in dim_parts[:2]:
                    col = self._fuzzy_col(dim_part, columns)
                    if col and col not in spec['dimensions']:
                        spec['dimensions'].append(col)
                        confidence += 0.3
                
                spec['task'] = 'group_by'
                spec['confidence'] = confidence
                
                logger.info(f"Matched SHOW BY: {spec['metrics']} by {spec['dimensions']}")
                return spec
            
            # ============ PATTERN 7: DISTRIBUTION ============
            m = self.re_distribution.search(p)
            if m:
                metric_tok = m.group(1)
                dim_tok = m.group(2) if len(m.groups()) >= 2 else None
                
                col = self._fuzzy_col(metric_tok, columns)
                if col:
                    spec['dimensions'].append(col)  # Distribution OF something
                    confidence += 0.4
                
                if dim_tok:
                    col = self._fuzzy_col(dim_tok, columns)
                    if col:
                        spec['dimensions'].append(col)
                        confidence += 0.3
                if col:
                    # Determine if it's a metric or dimension
                    if any(x in str(col).lower() for x in ['id', 'name', 'type', 'category', 'status', 'department', 'specialization', 'qualification']):
                        if col not in spec['dimensions']:
                            spec['dimensions'].append(col)
                            confidence += 0.15
                    else:
                        if col not in spec['metrics']:
                            spec['metrics'].append(col)
                            confidence += 0.15
            
            # If we found something, return it
            if spec['metrics'] or spec['dimensions']:
                if spec['dimensions'] and not spec['metrics']:
                    spec['task'] = 'group_count'
                    spec['agg'] = 'count'
                elif spec['metrics'] and spec['dimensions']:
                    spec['task'] = 'group_by'
                else:
                    spec['task'] = 'explore'
                
                spec['confidence'] = min(confidence, 0.6)
                logger.info(f"Fallback match: task={spec['task']}, metrics={spec['metrics']}, dims={spec['dimensions']}")
                return spec
            
            # ============ COMPLETE FALLBACK ============
            return {
                'task': 'error',
                'error': 'Could not understand query. Try: "count X by Y" or "show top 10 X by Y"',
                'raw': prompt,
                'confidence': 0.0,
                'suggestions': self._generate_suggestions(columns)
            }
        
        except Exception as e:
            logger.exception(f"Parse error for query: {prompt}")
            return {
                'task': 'error',
                'error': f'Parse failed: {str(e)}',
                'raw': prompt,
                'confidence': 0.0
            }
    
    def _generate_suggestions(self, columns: List[str]) -> List[str]:
        """Generate helpful suggestions"""
        suggestions = []
        
        # Find likely categorical columns
        cat_like = [c for c in columns if any(x in str(c).lower() 
                   for x in ['name', 'id', 'type', 'category', 'department', 'status', 'specialization', 'qualification'])]
        
        # Find likely numeric columns
        num_like = [c for c in columns if any(x in str(c).lower() 
                   for x in ['amount', 'count', 'total', 'revenue', 'sales', 'age', 'experience', 'year', 'payment'])]
        
        if cat_like:
            suggestions.append(f"count by {cat_like[0]}")
            if len(cat_like) > 1:
                suggestions.append(f"count by {cat_like[0]} and {cat_like[1]}")
        
        if num_like and cat_like:
            suggestions.append(f"total {num_like[0]} by {cat_like[0]}")
            suggestions.append(f"average {num_like[0]} by {cat_like[0]}")
        
        if not suggestions and columns:
            suggestions.append(f"show top 10 {columns[0]}")
        
        return suggestions[:3]