# app/engines/insight_engine.py

import numpy as np
import pandas as pd

class AutoInsightsEngine:
    """
    Generates automated insights from DataFrames:
    - column summaries
    - correlations
    - anomalies
    - trend detection
    """

    def __init__(self):
        pass

    def analyze(self, df: pd.DataFrame):
        insights = []

        # ============================
        # 1. Column Summaries
        # ============================
        for col in df.select_dtypes(include=[np.number]).columns:
            mean_val = df[col].mean()
            max_val = df[col].max()
            min_val = df[col].min()

            insights.append({
                "type": "summary",
                "column": col,
                "insight": f"Column '{col}' has average {mean_val:.2f}, min {min_val}, max {max_val}",
                "importance": 0.6,
            })

        # ============================
        # 2. Correlations
        # ============================
        if df.select_dtypes(include=[np.number]).shape[1] >= 2:
            corr = df.corr(numeric_only=True)

            for c1 in corr.columns:
                for c2 in corr.columns:
                    if c1 != c2:
                        value = corr.loc[c1, c2]
                        if abs(value) > 0.7:
                            insights.append({
                                "type": "correlation",
                                "insight": f"'{c1}' strongly correlates with '{c2}' (corr={value:.2f})",
                                "importance": abs(value),
                            })

        # ============================
        # 3. Detect Outliers
        # ============================
        for col in df.select_dtypes(include=[np.number]).columns:
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            outlier_mask = (df[col] < (q1 - 1.5 * iqr)) | (df[col] > (q3 + 1.5 * iqr))
            outlier_count = outlier_mask.sum()

            if outlier_count > 0:
                insights.append({
                    "type": "anomaly",
                    "column": col,
                    "insight": f"Column '{col}' contains {outlier_count} outlier values.",
                    "importance": 0.8,
                })

        # Sort insights by importance
        insights.sort(key=lambda x: x.get("importance", 0), reverse=True)

        return insights
