# engines/forecast_engine.py
import pandas as pd

class TimeSeriesForecaster:
    @staticmethod
    def forecast(df: pd.DataFrame, date_col: str, value_col: str, periods: int = 3):
        df2 = df[[date_col, value_col]].copy()
        df2[date_col] = pd.to_datetime(df2[date_col], errors='coerce')
        df2 = df2.dropna(subset=[date_col])
        ts = df2.set_index(date_col).resample('M')[value_col].sum()
        if len(ts) < 3:
            return pd.DataFrame()
        alpha = 0.3
        forecast_vals = []
        last = ts.iloc[-1]
        for i in range(periods):
            forecast_vals.append(last)
        future_dates = pd.date_range(start=ts.index[-1] + pd.DateOffset(months=1), periods=periods, freq='M')
        out = pd.DataFrame({date_col: future_dates, value_col: forecast_vals})
        out['type'] = 'forecast'
        hist = ts.reset_index().rename(columns={0:value_col})
        return pd.concat([ts.reset_index().rename(columns={value_col:value_col}), out], ignore_index=True)
