# backend/app/engines/join_engine.py
from typing import Dict, List, Optional
import pandas as pd
import numpy as np
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class EnhancedJoinEngine:
    """
    SMART JOIN ENGINE
    ------------------
    Provides:
    - Exact match detection
    - Fuzzy match detection
    - Value-overlap matching
    - Join quality scoring
    - Cardinality analysis
    - Recommended join type
    - Estimated output size
    - Execute & preview joins
    """

    # ============================================================
    # PUBLIC API METHODS
    # ============================================================

    @staticmethod
    def find_smart_joins(
        dfs: Dict[str, pd.DataFrame],
        min_confidence: float = 0.30
    ) -> List[Dict]:
        """
        Analyze 2+ dataframes and produce structured join suggestions.
        Includes:
        - exact name matches
        - fuzzy name matches
        - value-overlap based matches
        """
        if len(dfs) < 2:
            return []

        suggestions = []
        names = list(dfs.keys())

        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                left_name = names[i]
                right_name = names[j]

                left_df = dfs[left_name]
                right_df = dfs[right_name]

                # combine multiple techniques
                suggestions.extend(
                    EnhancedJoinEngine._find_join_columns(
                        left_df, right_df, left_name, right_name
                    )
                )

        # sort by confidence
        suggestions.sort(key=lambda x: x["confidence"], reverse=True)

        # dedupe
        seen = set()
        unique = []

        for s in suggestions:
            key = (s["left"], s["right"], s["left_on"], s["right_on"])
            if key not in seen and s["confidence"] >= min_confidence:
                seen.add(key)
                unique.append(s)

        logger.info(f"Found {len(unique)} smart joins.")
        return unique[:15]

    @staticmethod
    def execute_join(
        dfs: Dict[str, pd.DataFrame],
        left_name: str,
        right_name: str,
        left_on: str,
        right_on: str,
        how: str = "left",
    ) -> pd.DataFrame:
        """Perform a real join between two named DataFrames."""
        try:
            left_df = dfs[left_name]
            right_df = dfs[right_name]

            if left_on not in left_df.columns:
                raise ValueError(f"{left_name}: column '{left_on}' not found")
            if right_on not in right_df.columns:
                raise ValueError(f"{right_name}: column '{right_on}' not found")

            result = left_df.merge(
                right_df,
                left_on=left_on,
                right_on=right_on,
                how=how,
                suffixes=("", f"_{right_name}"),
            )

            return result

        except Exception as e:
            logger.error(f"Join failed: {e}")
            raise

    @staticmethod
    def get_join_preview(
        dfs: Dict[str, pd.DataFrame],
        left_name: str,
        right_name: str,
        left_on: str,
        right_on: str,
        how: str = "left",
        limit: int = 10,
    ) -> Dict:
        """Return small sample preview of join result."""
        try:
            result = EnhancedJoinEngine.execute_join(
                dfs, left_name, right_name, left_on, right_on, how
            )

            return {
                "success": True,
                "total_rows": len(result),
                "columns": list(result.columns),
                "preview": result.head(limit).fillna("").to_dict("records"),
                "null_counts": result.isnull().sum().to_dict(),
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    # ============================================================
    # INTERNAL JOIN ANALYSIS METHODS
    # ============================================================

    @staticmethod
    def _find_join_columns(
        left_df: pd.DataFrame,
        right_df: pd.DataFrame,
        left_name: str,
        right_name: str,
    ) -> List[Dict]:
        """Combine exact, fuzzy, value-based matching."""
        joins = []

        joins += EnhancedJoinEngine._exact_name_matches(
            left_df, right_df, left_name, right_name
        )

        joins += EnhancedJoinEngine._fuzzy_name_matches(
            left_df, right_df, left_name, right_name
        )

        joins += EnhancedJoinEngine._value_overlap_matches(
            left_df, right_df, left_name, right_name
        )

        return joins

    @staticmethod
    def _exact_name_matches(left_df, right_df, left_name, right_name):
        joins = []

        left_cols = {c.lower().strip(): c for c in left_df.columns}
        right_cols = {c.lower().strip(): c for c in right_df.columns}

        common = set(left_cols.keys()) & set(right_cols.keys())

        # ignore useless generic keys
        ignore = {"id", "index", "name", "value", "key"}
        common = {c for c in common if c not in ignore}

        for base_col in common:
            lcol = left_cols[base_col]
            rcol = right_cols[base_col]

            analysis = EnhancedJoinEngine._analyze_join_quality(
                left_df[lcol], right_df[rcol], lcol, rcol
            )

            joins.append(
                {
                    "left": left_name,
                    "right": right_name,
                    "left_on": lcol,
                    "right_on": rcol,
                    "confidence": analysis["confidence"],
                    "overlap_pct": analysis["overlap_pct"],
                    "join_type": analysis["recommended_join"],
                    "match_type": "exact",
                    "estimated_rows": analysis["estimated_rows"],
                    "description": f"Exact column name match: {lcol}",
                }
            )

        return joins

    @staticmethod
    def _fuzzy_name_matches(left_df, right_df, left_name, right_name):
        joins = []
        for lcol in left_df.columns:
            lc = lcol.lower()
            for rcol in right_df.columns:
                rc = rcol.lower()

                # simple similarity via shared chars
                sim = EnhancedJoinEngine._string_similarity(lc, rc)

                if sim > 0.68:  # sweet spot
                    analysis = EnhancedJoinEngine._analyze_join_quality(
                        left_df[lcol], right_df[rcol], lcol, rcol
                    )

                    joins.append(
                        {
                            "left": left_name,
                            "right": right_name,
                            "left_on": lcol,
                            "right_on": rcol,
                            "confidence": analysis["confidence"] * 0.85,
                            "overlap_pct": analysis["overlap_pct"],
                            "join_type": analysis["recommended_join"],
                            "match_type": "fuzzy",
                            "estimated_rows": analysis["estimated_rows"],
                            "description": f"Fuzzy name match: {lcol} ↔ {rcol}",
                        }
                    )
        return joins

    @staticmethod
    def _value_overlap_matches(left_df, right_df, left_name, right_name):
        joins = []

        left_candidates = [
            c for c in left_df.columns if 5 < left_df[c].nunique() < len(left_df) * 0.8
        ]
        right_candidates = [
            c for c in right_df.columns if 5 < right_df[c].nunique() < len(right_df) * 0.8
        ]

        combinations = 0

        for lcol in left_candidates[:8]:
            for rcol in right_candidates[:8]:

                combinations += 1
                if combinations > 40:
                    break

                analysis = EnhancedJoinEngine._analyze_join_quality(
                    left_df[lcol], right_df[rcol], lcol, rcol
                )

                if analysis["confidence"] > 0.45 and analysis["overlap_pct"] > 15:
                    joins.append(
                        {
                            "left": left_name,
                            "right": right_name,
                            "left_on": lcol,
                            "right_on": rcol,
                            "confidence": analysis["confidence"],
                            "overlap_pct": analysis["overlap_pct"],
                            "join_type": analysis["recommended_join"],
                            "match_type": "value_overlap",
                            "estimated_rows": analysis["estimated_rows"],
                            "description": f"High value overlap: {lcol} ↔ {rcol}",
                        }
                    )
        return joins

    # ============================================================
    # JOIN QUALITY ANALYSIS
    # ============================================================

    @staticmethod
    def _analyze_join_quality(left_series, right_series, left_col, right_col):
        left_vals = set(left_series.dropna().astype(str).head(500))
        right_vals = set(right_series.dropna().astype(str).head(500))

        if not left_vals or not right_vals:
            return {
                "confidence": 0.0,
                "overlap_pct": 0.0,
                "recommended_join": "inner",
                "estimated_rows": 0,
                "cardinality_ratio": 0,
            }

        intersection = left_vals & right_vals
        overlap_pct = len(intersection) / max(1, min(len(left_vals), len(right_vals))) * 100

        card_ratio = min(len(left_vals), len(right_vals)) / max(len(left_vals), len(right_vals))

        confidence = overlap_pct / 100

        # ID-like boost
        if any(k in left_col.lower() for k in ["id", "code", "num", "key"]):
            confidence = min(confidence * 1.15, 1)

        # cardinality match
        if card_ratio > 0.7:
            confidence = min(confidence * 1.12, 1)

        # penalize low overlap
        if overlap_pct < 12:
            confidence *= 0.55

        if overlap_pct > 80:
            recommended = "inner"
        elif overlap_pct > 50:
            recommended = "left"
        else:
            recommended = "left"

        est_rows = (
            int(len(intersection) * 1.15)
            if recommended == "inner"
            else len(left_series)
        )

        return {
            "confidence": round(confidence, 3),
            "overlap_pct": round(overlap_pct, 2),
            "recommended_join": recommended,
            "estimated_rows": est_rows,
            "cardinality_ratio": round(card_ratio, 2),
        }

    @staticmethod
    def _string_similarity(a: str, b: str) -> float:
        set1 = set(a)
        set2 = set(b)
        if not set1 or not set2:
            return 0
        return len(set1 & set2) / len(set1 | set2)
