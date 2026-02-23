# backend/app/api/statistics.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose: Cross-dataset statistical analysis

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from scipy import stats
import logging

from core.dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

class CrossDatasetStatsRequest(BaseModel):
    dataset_a_data: List[dict]
    column_a: str
    dataset_b_data: List[dict]
    column_b: str
    analysis_type: str  # "correlation", "covariance", "anova"

class SingleDatasetStatsRequest(BaseModel):
    dataset_data: List[dict]
    column_a: str
    column_b: str
    analysis_type: str

@router.post("/cross-dataset")
async def cross_dataset_statistics(
    request: CrossDatasetStatsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Perform statistical analysis across two different datasets
    Supports: correlation, covariance, ANOVA
    """
    try:
        # Convert to DataFrames
        df_a = pd.DataFrame(request.dataset_a_data)
        df_b = pd.DataFrame(request.dataset_b_data)
        
        # Extract columns
        if request.column_a not in df_a.columns:
            raise HTTPException(
                status_code=400,
                detail=f"Column '{request.column_a}' not found in dataset A"
            )
        
        if request.column_b not in df_b.columns:
            raise HTTPException(
                status_code=400,
                detail=f"Column '{request.column_b}' not found in dataset B"
            )
        
        series_a = pd.to_numeric(df_a[request.column_a], errors='coerce').dropna()
        series_b = pd.to_numeric(df_b[request.column_b], errors='coerce').dropna()
        
        if len(series_a) == 0 or len(series_b) == 0:
            raise HTTPException(
                status_code=400,
                detail="Columns must contain numeric data"
            )
        
        # Perform analysis
        result = {}
        
        if request.analysis_type == "correlation":
            # For cross-dataset correlation, we need equal length series
            min_len = min(len(series_a), len(series_b))
            correlation = np.corrcoef(series_a[:min_len], series_b[:min_len])[0, 1]
            
            result = {
                "analysis_type": "correlation",
                "value": float(correlation),
                "interpretation": get_correlation_interpretation(correlation),
                "dataset_a_stats": {
                    "mean": float(series_a.mean()),
                    "std": float(series_a.std()),
                    "count": int(len(series_a))
                },
                "dataset_b_stats": {
                    "mean": float(series_b.mean()),
                    "std": float(series_b.std()),
                    "count": int(len(series_b))
                },
                "note": f"Correlation calculated on {min_len} paired observations"
            }
            
        elif request.analysis_type == "covariance":
            min_len = min(len(series_a), len(series_b))
            covariance = np.cov(series_a[:min_len], series_b[:min_len])[0, 1]
            
            result = {
                "analysis_type": "covariance",
                "value": float(covariance),
                "interpretation": "Positive covariance indicates variables tend to move together" if covariance > 0 else "Negative covariance indicates variables move inversely",
                "dataset_a_stats": {
                    "mean": float(series_a.mean()),
                    "std": float(series_a.std()),
                    "count": int(len(series_a))
                },
                "dataset_b_stats": {
                    "mean": float(series_b.mean()),
                    "std": float(series_b.std()),
                    "count": int(len(series_b))
                },
                "note": f"Covariance calculated on {min_len} paired observations"
            }
            
        elif request.analysis_type == "anova":
            # ANOVA: Test if means are significantly different
            f_stat, p_value = stats.f_oneway(series_a, series_b)
            
            result = {
                "analysis_type": "anova",
                "f_statistic": float(f_stat),
                "p_value": float(p_value),
                "significant": p_value < 0.05,
                "interpretation": get_anova_interpretation(p_value),
                "dataset_a_stats": {
                    "mean": float(series_a.mean()),
                    "std": float(series_a.std()),
                    "count": int(len(series_a))
                },
                "dataset_b_stats": {
                    "mean": float(series_b.mean()),
                    "std": float(series_b.std()),
                    "count": int(len(series_b))
                }
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown analysis type: {request.analysis_type}"
            )
        
        logger.info(f"✅ Cross-dataset {request.analysis_type} completed")
        return {"success": True, "result": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Statistical analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

@router.post("/single-dataset")
async def single_dataset_statistics(
    request: SingleDatasetStatsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Perform statistical analysis within a single dataset (two columns)
    """
    try:
        df = pd.DataFrame(request.dataset_data)
        
        if request.column_a not in df.columns or request.column_b not in df.columns:
            raise HTTPException(
                status_code=400,
                detail="One or both columns not found in dataset"
            )
        
        series_a = pd.to_numeric(df[request.column_a], errors='coerce').dropna()
        series_b = pd.to_numeric(df[request.column_b], errors='coerce').dropna()
        
        # Align the series (use only rows where both have values)
        valid_indices = df[[request.column_a, request.column_b]].dropna().index
        series_a = pd.to_numeric(df.loc[valid_indices, request.column_a])
        series_b = pd.to_numeric(df.loc[valid_indices, request.column_b])
        
        if len(series_a) == 0:
            raise HTTPException(
                status_code=400,
                detail="No valid numeric data found in selected columns"
            )
        
        result = {}
        
        if request.analysis_type == "correlation":
            correlation = series_a.corr(series_b)
            result = {
                "analysis_type": "correlation",
                "value": float(correlation),
                "interpretation": get_correlation_interpretation(correlation),
                "sample_size": int(len(series_a))
            }
            
        elif request.analysis_type == "covariance":
            covariance = series_a.cov(series_b)
            result = {
                "analysis_type": "covariance",
                "value": float(covariance),
                "interpretation": "Positive covariance" if covariance > 0 else "Negative covariance",
                "sample_size": int(len(series_a))
            }
            
        elif request.analysis_type == "anova":
            # For single dataset ANOVA, we'd typically need groups
            # Here we'll do a t-test instead
            t_stat, p_value = stats.ttest_ind(series_a, series_b)
            result = {
                "analysis_type": "t-test",
                "t_statistic": float(t_stat),
                "p_value": float(p_value),
                "significant": p_value < 0.05,
                "interpretation": get_anova_interpretation(p_value),
                "note": "T-test performed (comparing two columns)"
            }
        
        return {"success": True, "result": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Statistical analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

def get_correlation_interpretation(corr: float) -> str:
    """Interpret correlation coefficient"""
    abs_corr = abs(corr)
    strength = ""
    
    if abs_corr >= 0.9:
        strength = "Very strong"
    elif abs_corr >= 0.7:
        strength = "Strong"
    elif abs_corr >= 0.5:
        strength = "Moderate"
    elif abs_corr >= 0.3:
        strength = "Weak"
    else:
        strength = "Very weak"
    
    direction = "positive" if corr > 0 else "negative"
    
    return f"{strength} {direction} correlation (r = {corr:.3f})"

def get_anova_interpretation(p_value: float) -> str:
    """Interpret ANOVA/t-test p-value"""
    if p_value < 0.001:
        return "Highly significant difference (p < 0.001) - means are very different"
    elif p_value < 0.01:
        return "Very significant difference (p < 0.01) - means are clearly different"
    elif p_value < 0.05:
        return "Significant difference (p < 0.05) - means are different"
    else:
        return f"No significant difference (p = {p_value:.3f}) - means are similar"
