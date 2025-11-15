# engines/viz_engine.py
import plotly.express as px
import pandas as pd

class VizEngine:
    @staticmethod
    def bar(df: pd.DataFrame, x, y, title=None):
        fig = px.bar(df, x=x, y=y, title=title or f"{y} by {x}", template='plotly_white')
        fig.update_layout(height=500, xaxis_tickangle=-45)
        return fig

    @staticmethod
    def line(df: pd.DataFrame, x, y, title=None):
        fig = px.line(df, x=x, y=y, title=title or f"{y} trend", template='plotly_white', markers=True)
        fig.update_layout(height=500)
        return fig

    @staticmethod
    def scatter(df: pd.DataFrame, x, y, title=None):
        fig = px.scatter(df, x=x, y=y, title=title or f"{y} vs {x}", template='plotly_white')
        fig.update_layout(height=500)
        return fig

    @staticmethod
    def heatmap_corr(df):
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        if not numeric_cols:
            return None
        corr = df[numeric_cols].corr()
        fig = px.imshow(corr, title="Correlation Heatmap")
        return fig
    @staticmethod
    def pie(df, names_col, values_col):
        import plotly.express as px
        try:
            fig = px.pie(
                df,
                names=names_col,
                values=values_col,
                title=f"{values_col} distribution by {names_col}",
                hole=0.0
            )
            fig.update_traces(textinfo='percent+label')
            fig.update_layout(height=500)
            return fig
        except Exception:
            return None