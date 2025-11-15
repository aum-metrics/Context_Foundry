# engines/utils.py
import tempfile, os
from datetime import datetime
import pandas as pd

TMPDIR = tempfile.gettempdir()

def save_uploaded_to_temp(uf) -> str:
    unique_name = f"{int(datetime.utcnow().timestamp()*1000)}_{uf.name}"
    path = os.path.join(TMPDIR, unique_name)
    with open(path, "wb") as fh:
        fh.write(uf.getbuffer())
    return path

def load_dataframe_from_path(path: str) -> pd.DataFrame:
    try:
        if path.lower().endswith('.csv'):
            return pd.read_csv(path)
        else:
            return pd.read_excel(path)
    except Exception:
        return pd.DataFrame()

def _coerce_value(v: str):
    v = v.strip().strip("'").strip('"')
    try:
        if '.' in v:
            return float(v)
        return int(v)
    except:
        return v
