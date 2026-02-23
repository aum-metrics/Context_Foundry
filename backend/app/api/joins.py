# backend/app/api/joins.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose of this code: Intelligent fuzzy join engine for merging multiple datasets.
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Dict, Any, Optional
import pandas as pd
import io
import json
import logging
from engines.join_engine import EnhancedJoinEngine

logger = logging.getLogger(__name__)
router = APIRouter()

# -------------------------
# Helper: load dataframe
# -------------------------
def _load_df_from_upload(file: UploadFile) -> pd.DataFrame:
    try:
        content = file.file.read()
        if len(content) > 2 * 1024 * 1024: # 2MB limit
             raise HTTPException(status_code=413, detail="File too large. Max size is 2MB.")
        filename = (file.filename or "").lower()
        if filename.endswith(".csv") or filename.endswith(".txt"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
        else:
            # fallback to csv parse attempt
            df = pd.read_csv(io.BytesIO(content))
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="File empty")
    except Exception as e:
        logger.exception("Failed to load file")
        raise HTTPException(status_code=400, detail=f"Failed to load file {getattr(file,'filename', '')}: {str(e)}")

    # normalize column names
    df.columns = [str(c).strip() for c in df.columns]
    return df

def _df_preview_dict(df: pd.DataFrame, max_rows: int = 50) -> Dict[str, Any]:
    """Convert DataFrame to dict. If max_rows is None, return ALL rows."""
    df_subset = df if max_rows is None else df.head(max_rows)
    df_clean = df_subset.fillna('').replace([float('inf'), float('-inf')], '')
    return {
        "columns": df.columns.tolist(),
        "data": df_clean.to_dict("records"),
        "total_rows": len(df),
    }

# -------------------------
# Two-file preview
# -------------------------
@router.post("/join-preview")
async def join_preview(
    left_file: UploadFile = File(...),
    right_file: UploadFile = File(...),
    left_column: str = Form(...),
    right_column: str = Form(...),
    join_type: str = Form("inner"),
):
    """
    Preview a join between two uploaded files. Returns top-50 rows.
    """
    try:
        left_df = _load_df_from_upload(left_file)
        right_df = _load_df_from_upload(right_file)

        how = join_type.lower()
        if how not in {"inner", "left", "right", "outer", "full"}:
            how = "inner"
            logger.debug("Unsupported join_type, defaulting to inner")

        # attempt the merge
        joined = pd.merge(
            left_df,
            right_df,
            left_on=left_column,
            right_on=right_column,
            how=("outer" if how == "full" else how),
            suffixes=("_left", "_right"),
        )

        preview = _df_preview_dict(joined, max_rows=50)
        return {
            "success": True,
            "join_type": how,
            "columns": preview["columns"],
            "data": preview["data"],
            "total_rows": preview["total_rows"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("join-preview failed")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------
# Two-file complete (commit)
# -------------------------
@router.post("/join-complete")
async def join_complete(
    left_file: UploadFile = File(...),
    right_file: UploadFile = File(...),
    left_column: str = Form(...),
    right_column: str = Form(...),
    join_type: str = Form("inner"),
    name: Optional[str] = Form("Joined Dataset"),
):
    """
    Perform full join and return metadata + preview (frontend can keep data in-memory).
    """
    try:
        left_df = _load_df_from_upload(left_file)
        right_df = _load_df_from_upload(right_file)

        how = join_type.lower()
        if how not in {"inner", "left", "right", "outer", "full"}:
            how = "inner"

        joined = pd.merge(
            left_df,
            right_df,
            left_on=left_column,
            right_on=right_column,
            how=("outer" if how == "full" else how),
            suffixes=("_left", "_right"),
        )

        # Return FULL dataset for complete join (not just preview)
        # Frontend can handle pagination if needed
        preview = _df_preview_dict(joined, max_rows=None)  # None = all rows
        return {
            "success": True,
            "name": name,
            "columns": preview["columns"],
            "data": preview["data"],
            "row_count": preview["total_rows"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("join-complete failed")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------
# Auto-join multiple files (2..5)
# -------------------------
@router.post("/join-auto")
async def join_auto(
    files: List[UploadFile] = File(...),
    strategy: str = Form("sequential"),  # 'sequential' or 'auto'
    join_type: str = Form("inner"),
    name: Optional[str] = Form("Auto Joined Dataset"),
):
    """
    Attempt to automatically join 2..5 files. Returns preview + row_count.
    strategy:
      - sequential: join in the order files were uploaded (using EnhancedJoinEngine suggestions for each step)
      - auto: greedy best-pair-first using EnhancedJoinEngine across all files
    """
    try:
        if len(files) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 files to join")

        # load dataframes into dict keyed by filename (unique fallback)
        dfs: Dict[str, pd.DataFrame] = {}
        for f in files:
            key = f.filename or f"file_{len(dfs)}"
            dfs[key] = _load_df_from_upload(f)

        how = join_type.lower()
        if how not in {"inner", "left", "right", "outer", "full"}:
            how = "inner"

        # sequential strategy
        if strategy == "sequential":
            names = list(dfs.keys())
            result = dfs[names[0]]
            for nxt in names[1:]:
                # ask engine for best suggestion between current result and next
                suggestions = EnhancedJoinEngine.find_smart_joins({"left": result, "right": dfs[nxt]})
                if suggestions and len(suggestions) > 0:
                    best = suggestions[0]
                    left_on = best["left_on"]
                    right_on = best["right_on"]
                    # Since "result" uses key 'left' in suggestions, execute by direct merge
                    result = result.merge(dfs[nxt], left_on=left_on, right_on=right_on, how=("outer" if how=="full" else how), suffixes=("_left", f"_{nxt}"))
                else:
                    # fallback: outer join on index to avoid cross join
                    result = pd.merge(result.reset_index(), dfs[nxt].reset_index(), left_index=True, right_index=True, how="outer").drop(columns=["index", "index_right"], errors="ignore")
        else:
            # greedy auto: repeatedly pick highest-confidence suggested pair across all remaining dfs
            working = {k: v.copy() for k, v in dfs.items()}

            # helper to compute suggestions over current working set
            def compute_all_pair_suggestions(work_map: Dict[str, pd.DataFrame]):
                # prepare dict for engine with names
                ret = EnhancedJoinEngine.find_smart_joins(work_map, min_confidence=0.01)
                return ret

            while len(working) > 1:
                pair_suggestions = compute_all_pair_suggestions(working)
                if not pair_suggestions:
                    # no pair with a measurable confidence — fallback combine by index
                    keys = list(working.keys())
                    merged = working.pop(keys[0])
                    for k in keys[1:]:
                        merged = pd.merge(merged.reset_index(), working.pop(k).reset_index(), left_index=True, right_index=True, how="outer").drop(columns=["index", "index_right"], errors="ignore")
                    result = merged
                    break

                best = pair_suggestions[0]
                left_name = best["left"]
                right_name = best["right"]
                left_on = best["left_on"]
                right_on = best["right_on"]

                # Execute the join
                result_df = EnhancedJoinEngine.execute_join(working, left_name, right_name, left_on, right_on, how=("outer" if how=="full" else how))

                # replace two with merged
                del working[left_name]
                del working[right_name]
                merged_name = f"{left_name}+{right_name}"
                working[merged_name] = result_df

            # if loop ended with one remaining, it's our result
            if len(working) == 1:
                result = list(working.values())[0]

        preview = _df_preview_dict(result, max_rows=None)  # Return all rows
        return {
            "success": True,
            "name": name,
            "columns": preview["columns"],
            "data": preview["data"],
            "row_count": preview["total_rows"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("join-auto failed")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------
# Smart join suggestions for UI (2..5 files)
# -------------------------
@router.post("/join-suggestions")
async def join_suggestions(files: List[UploadFile] = File(...)):
    """
    Analyze 2..5 datasets and return a ranked list of suggested joins.
    Each suggestion contains: left, right, left_on, right_on, confidence, overlap_pct, description, join_type
    """
    try:
        if len(files) < 2:
            return {"success": True, "suggestions": []}

        dfs = {}
        for f in files:
            key = f.filename or f"file_{len(dfs)}"
            dfs[key] = _load_df_from_upload(f)

        suggestions = EnhancedJoinEngine.find_smart_joins(dfs)
        return {"success": True, "suggestions": suggestions}

    except Exception as e:
        logger.exception("join-suggestions failed")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------
# JSON-based Join (for Canvas Data)
# -------------------------
@router.post("/join-json")
async def join_json(
    left_data: str = Form(...),
    right_data: str = Form(...),
    left_column: str = Form(...),
    right_column: str = Form(...),
    join_type: str = Form("inner")
):
    """
    Perform a join on two JSON datasets (sent as strings).
    Useful for joining data already loaded in the frontend canvas.
    """
    try:
        # Parse JSON data
        left_list = json.loads(left_data)
        right_list = json.loads(right_data)
        
        left_df = pd.DataFrame(left_list)
        right_df = pd.DataFrame(right_list)
        
        # Normalize columns
        left_df.columns = [str(c).strip() for c in left_df.columns]
        right_df.columns = [str(c).strip() for c in right_df.columns]
        
        how = join_type.lower()
        if how not in {"inner", "left", "right", "outer", "full"}:
            how = "inner"
            
        # Perform join
        joined = pd.merge(
            left_df,
            right_df,
            left_on=left_column,
            right_on=right_column,
            how=("outer" if how == "full" else how),
            suffixes=("_left", "_right")
        )
        
        # Return result
        preview = _df_preview_dict(joined, max_rows=None)
        return {
            "success": True,
            "columns": preview["columns"],
            "data": preview["data"],
            "total_rows": preview["total_rows"]
        }
        
    except Exception as e:
        logger.exception("join-json failed")
        raise HTTPException(status_code=500, detail=str(e))
