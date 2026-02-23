# FULLY REGENERATED AUM STUDIO app.py
# NOTE: This completely replaces the previous content.
# Stable, clean, consistent, with correct Help tab + Pie chart + layout.

import streamlit as st
import pandas as pd
import numpy as np
import hashlib
import tempfile
import json
import io
from pathlib import Path
from datetime import datetime
import os

# ------------------------------------------------------------
# LOAD MODULAR ENGINES
# ------------------------------------------------------------
ENGINES_AVAILABLE = True
try:
    from engines.domain_engine import AdvancedDomainIntelligence
    from engines.join_engine import EnhancedJoinEngine
    from engines.insight_engine import AutoInsightsEngine
    from engines.nl_engine import HybridNLInterpreter
    from engines.query_engine import QueryExecutor
    from engines.viz_engine import VizEngine
    from engines.report_engine import PDFReportGenerator
except Exception as e:
    ENGINES_AVAILABLE = False
    load_error = str(e)

# ------------------------------------------------------------
# PAGE CONFIG
# ------------------------------------------------------------
st.set_page_config(page_title="AUM Studio", layout="wide", initial_sidebar_state="expanded")

# ------------------------------------------------------------
# HEADER BRANDING
# ------------------------------------------------------------
st.markdown(
    """
    <style>
    .aum-header {
        font-size: 2.8rem; font-weight: 900;
        text-align: center;
        background: linear-gradient(90deg, #4F46E5, #7C3AED);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.25rem;
        font-family: 'Inter', sans-serif;
    }
    .aum-tagline {
        text-align: center;
        font-size: 1.1rem;
        color: #6B7280;
        margin-bottom: 1.5rem;
        font-style: italic;
    }
    .metric-card {
        background: #ffffff;
        padding: 12px;
        border-radius: 10px;
        border: 1px solid #E5E7EB;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    </style>

    <div class="aum-header">🎵 AUM</div>
    <div class="aum-tagline">Augmented Universal Metrics — The Sound of Data Understanding</div>
    """,
    unsafe_allow_html=True
)

# ------------------------------------------------------------
# SESSION STATE DEFAULTS
# ------------------------------------------------------------
defaults = {
    'user_id': None,
    'user_email': None,
    'uploaded_files': [],
    'dataframes': {},
    'joined_df': None,
    'domain': None,
    'domain_confidence': 0.0,
    'domain_scores': {},
    'insights': [],
    'sku_price_map': None,
    'last_result': None,
    'query_count': 0,
    'temp_query': ''
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ------------------------------
# Welcome Modal / First-run Guide
# ------------------------------
if 'seen_welcome' not in st.session_state:
    st.session_state.seen_welcome = False

if not st.session_state.seen_welcome:
    with st.expander("🎉 Welcome to AUM Studio — Quick Start", expanded=True):
        st.markdown("""
        **Welcome!** This short walkthrough will help you get started:
        1. Upload 1-5 CSV/Excel files using the **Upload** button in the sidebar.
        2. (Optional) Upload SKU price map to compute financial impact automatically.
        3. Click **🔬 Analyze Now** — the system will detect your domain and generate instant insights.
        4. Use the **Natural Query** tab to ask plain-English questions (e.g., "top 10 dealers by sales").
        5. Use **Visualizations** to make charts and **Data Explorer** to inspect raw tables.

        Click **Got it — hide this** when you're ready.
        """, unsafe_allow_html=True)
        if st.button("Got it — hide this"):
            st.session_state.seen_welcome = True
            st.rerun()

# ------------------------------
# Sidebar Quick Guide (persistent)
# ------------------------------
st.session_state.setdefault('show_quick_guide_box', True)

def render_quick_guide_box():
    """Renders a small helpful box in the sidebar to make the Analyze button obvious."""
    st.markdown(
        """
        <div style='background:#eef2ff;border:1px solid #c7d2fe;padding:10px;border-radius:8px;margin-top:10px;'>
          <strong>Quick Start</strong>
          <ul style='margin:6px 0 0 16px;padding:0;'>
            <li>Upload CSV / Excel</li>
            <li>Click <strong>🔬 Analyze Now</strong></li>
            <li>Open <em>Domain Insights</em> & <em>Natural Query</em></li>
          </ul>
        </div>
        """,
        unsafe_allow_html=True
    )
    # Streamlit native button to open Help tab
    if st.button("Show Help", key='show_help_sidebar'):
        st.session_state.temp_query = ''
        st.session_state.show_help_tab = True
        st.rerun()

# The actual injection in the sidebar happens later where the sidebar block runs; we expose the helper here.


# ------------------------------------------------------------
# SIMPLE ONBOARDING
# ------------------------------------------------------------
if not st.session_state.user_id:
    st.markdown("## 👋 Welcome to AUM Studio")
    with st.form("login"):
        email = st.text_input("Enter your email to continue")
        start = st.form_submit_button("Start")
        if start:
            if not email or '@' not in email:
                st.error("Please enter a valid email address.")
            else:
                st.session_state.user_email = email.strip().lower()
                st.session_state.user_id = hashlib.md5(email.encode()).hexdigest()[:24]
                st.rerun()
    st.stop()

# ------------------------------------------------------------
# HEADER METRICS
# ------------------------------------------------------------
col1, col2, col3 = st.columns([2,1,1])
with col1:
    st.write(f"**User:** {st.session_state.user_email.split('@')[0]}")
with col2:
    if st.session_state.domain:
        try:
            cfg = AdvancedDomainIntelligence.get_domain_config(st.session_state.domain)
            st.markdown(
                f"<div style='padding:6px;border-radius:8px;background:{cfg['color']}22;color:{cfg['color']};display:inline-block'>{cfg.get('icon','📊')} {st.session_state.domain.title()}</div>",
                unsafe_allow_html=True
            )
        except:
            st.write(st.session_state.domain)
with col3:
    st.metric("Queries", st.session_state.query_count)

st.markdown("---")

# ------------------------------------------------------------
# SIDEBAR — FILES, SKU MAP, ANALYZE
# ------------------------------------------------------------
with st.sidebar:
    st.header("📂 Upload Your Data")

    uploaded_files = st.file_uploader(
        "Upload CSV/Excel (Max 5 Files)",
        type=["csv","xlsx","xls"],
        accept_multiple_files=True
    )

    st.markdown("---")
    st.markdown("**Optional:** SKU Price Map (CSV with columns: sku, unit_price)")
    sku_map_file = st.file_uploader("Upload SKU Map", type=['csv'], key='sku_map')

    if sku_map_file:
        try:
            df_sku = pd.read_csv(sku_map_file)
            cols = [c.lower() for c in df_sku.columns]
            if 'sku' in cols and 'unit_price' in cols:
                skuc = df_sku.columns[cols.index('sku')]
                pricec = df_sku.columns[cols.index('unit_price')]
                st.session_state.sku_price_map = dict(zip(df_sku[skuc].astype(str), df_sku[pricec].astype(float)))
                st.success("SKU price map loaded.")
        except Exception as e:
            st.error(f"Failed to load SKU map: {e}")

    st.markdown("---")
    # Sidebar quick guide (persistent)
    try:
        render_quick_guide_box()
    except Exception:
        pass

    if uploaded_files:
        st.session_state.uploaded_files = uploaded_files
        st.success(f"{len(uploaded_files)} file(s) ready")

    if st.button("🔬 Analyze Now", type='primary'):
        if not uploaded_files:
            st.warning("Please upload at least one data file.")
        else:
            tmp = tempfile.mkdtemp()
            dfs = {}
            for uf in uploaded_files:
                try:
                    path = Path(tmp) / uf.name
                    with open(path, "wb") as f:
                        f.write(uf.getbuffer())
                    df = pd.read_csv(path) if path.suffix.lower() == '.csv' else pd.read_excel(path)
                    df.columns = [c.strip() for c in df.columns]
                    dfs[path.stem] = df
                except Exception as e:
                    st.error(f"Failed to load {uf.name}: {e}")

            if dfs:
                st.session_state.dataframes = dfs
                try:
                    domain, conf, scores = AdvancedDomainIntelligence.detect_domain(dfs)
                except:
                    domain, conf, scores = "generic", 0.5, {}

                st.session_state.domain = domain
                st.session_state.domain_confidence = conf
                st.session_state.domain_scores = scores
                st.session_state.joined_df = list(dfs.values())[0]

                try:
                    auto = AutoInsightsEngine(domain, st.session_state.sku_price_map)
                    insights = auto.analyze_on_upload(st.session_state.joined_df)
                    st.session_state.insights = insights
                    st.session_state.last_result = st.session_state.joined_df.head(200)
                    st.success(f"Analysis complete — {domain.title()} detected with {conf*100:.0f}% confidence.")
                except Exception as e:
                    st.error(f"Auto insights error: {e}")

                st.rerun()

    st.markdown("---")
    if st.button("Reset Session"):
        for k in list(st.session_state.keys()): del st.session_state[k]
        st.rerun()

# ------------------------------------------------------------
# IF NO DATA LOADED
# ------------------------------------------------------------
if not st.session_state.dataframes:
    st.info("Upload files in the sidebar and click Analyze Now.")
    st.stop()

# ------------------------------------------------------------
# SMART JOIN SUGGESTIONS (NOW PROMINENT IN MAIN AREA)
# ------------------------------------------------------------

if len(st.session_state.uploaded_files) > 1 and st.session_state.dataframes:
    st.markdown("## 🔗 **Smart Join Suggestions — Auto‑Detected Relationships**")

# --- New prominent join display ---
if len(st.session_state.uploaded_files) > 1 and st.session_state.dataframes:
    suggestions = []
    try:
        suggestions = EnhancedJoinEngine.find_smart_joins(st.session_state.dataframes)
    except Exception as e:
        st.error(f"Join detection failed: {e}")

    st.markdown("<div style='padding:18px; border-radius:12px; background:#ecfdf5; border:1px solid #6ee7b7; margin-bottom:18px;'>", unsafe_allow_html=True)
    st.markdown("### 🔍 Automatically Detected File Relationships")

    if suggestions:
        for i, s in enumerate(suggestions, start=1):
            st.markdown(f"**{i}.** `{s['left']}.{s['left_on']}` ⇄ `{s['right']}.{s['right_on']}` — **Confidence:** {s['confidence']*100:.1f}% — **Overlap:** {s.get('overlap',0)}%")

        if st.button("🔗 Apply Best Join", key="apply_best_join_top"):
            try:
                result = EnhancedJoinEngine.execute_joins(st.session_state.dataframes, [suggestions[0]])
                if result is not None:
                    st.session_state.joined_df = result
                    st.success(f"Joined {suggestions[0]['left']} + {suggestions[0]['right']}")
                    st.rerun()
            except Exception as e:
                st.error(f"Join execution failed: {e}")
    else:
        st.info("No relationships detected — upload files with matching keys (e.g., sku, id, state_code).")

    st.markdown("</div>", unsafe_allow_html=True)

# ------------------------------------------------------------
# MAIN TABS
# ------------------------------------------------------------

tabs = st.tabs(["Domain Insights", "Natural Query", "Data Explorer", "Visualizations", "Help / How To Use"])

# TAB: Domain Insights
with tabs[0]:
    st.subheader(f"Domain: {st.session_state.domain.title()} — Confidence: {st.session_state.domain_confidence*100:.0f}%")
    df = st.session_state.joined_df
    cfg = None
    try:
        cfg = AdvancedDomainIntelligence.get_domain_config(st.session_state.domain)
    except Exception:
        cfg = {'icon':'📊','color':'#6C757D'}

    c1, c2, c3, c4 = st.columns(4)
    with c1: st.metric("Records", f"{len(df):,}")
    with c2: st.metric("Columns", len(df.columns))
    with c3: st.metric("Numeric fields", len(df.select_dtypes(include=['number']).columns))
    with c4: st.metric("Missing %", f"{(df.isna().sum().sum()/(len(df)*len(df.columns))*100 if len(df)>0 else 0):.1f}%")

    st.markdown("---")
    st.subheader("Key Insights")
    if st.session_state.insights:
        for ins in st.session_state.insights:
            color = '#10B981' if ins.get('severity','INFO')=='OPPORTUNITY' else ('#F59E0B' if ins.get('severity','INFO')=='WARNING' else ('#DC2626' if ins.get('severity','INFO')=='CRITICAL' else '#3B82F6'))
            st.markdown(f"<div class='metric-card' style='border-left:4px solid {color}; padding:8px;'> <b>[{ins.get('severity','INFO')}] {ins.get('title')}</b><br>📊 Impact: {ins.get('impact')}<br>✅ Action: {ins.get('action')}<br>💰 Financial: {ins.get('financial_impact','N/A')}</div>", unsafe_allow_html=True)
    else:
        st.info("No insights generated yet. Click Analyze Now to run AutoInsights.")

    st.markdown("---")
    if st.button("Download PDF Report"):
        try:
            pdf = PDFReportGenerator.generate_report(st.session_state.domain, st.session_state.insights, st.session_state.last_result or df.head(100), cfg, st.session_state.user_email)
            if pdf:
                st.download_button("⬇️ Download PDF", data=pdf, file_name=f"aum_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf", mime='application/pdf')
            else:
                st.error("PDF generation failed — ensure reportlab is installed on the environment.")
        except Exception as e:
            st.error(f"PDF export failed: {e}")

# TAB: Natural Query
with tabs[1]:
    st.subheader("Ask (Natural Language)")
    df = st.session_state.joined_df
    suggested = []
    try:
        if hasattr(AdvancedDomainIntelligence, 'get_suggested_queries'):
            suggested = AdvancedDomainIntelligence.get_suggested_queries(st.session_state.domain, df.columns.tolist())
    except Exception:
        suggested = []

    if not suggested:
        # fallback simple suggestions: pick first categorical and numeric columns if available
        cat_cols = df.select_dtypes(include=['object']).columns.tolist()
        num_cols = df.select_dtypes(include=['number']).columns.tolist()
        if cat_cols and num_cols:
            suggested = [f"top 10 {cat_cols[0]} by {num_cols[0]}", f"trend {num_cols[0]} over time", f"show {num_cols[0]} where {cat_cols[0]} is highest"]
        elif cat_cols:
            suggested = [f"top 10 {cat_cols[0]}", "show top 10 rows", "summarize data"]
        elif num_cols:
            suggested = [f"top 10 by {num_cols[0]}", "summarize data"]
        else:
            suggested = ["show top 10 rows", "summarize data"]

    with st.expander("Suggested Queries", expanded=True):
        cols = st.columns(2)
        for i, q in enumerate(suggested):
            with cols[i % 2]:
                if st.button(q, key=f"sugg_{i}"):
                    st.session_state.temp_query = q

    prompt = st.text_input("Your question:", value=st.session_state.get('temp_query',''), placeholder="e.g., top 10 sku by gmv")
    if st.button("Execute Query") and prompt:
        try:
            nl = HybridNLInterpreter()
            spec = nl.parse(prompt, df.columns.tolist())
            executor = QueryExecutor(df)
            result, executed_spec = executor.execute(spec)
            st.session_state.last_result = result
            st.session_state.query_count += 1
            with st.expander("Query Interpretation"):
                st.json(executed_spec)
            if result is not None and not result.empty:
                st.success(f"Found {len(result)} rows")
                st.dataframe(result.head(200))
                # Auto viz
                num_cols = result.select_dtypes(include=['number']).columns.tolist()
                cat_cols = result.select_dtypes(include=['object']).columns.tolist()
                if num_cols and cat_cols:
                    st.plotly_chart(VizEngine.bar(result.head(20), cat_cols[0], num_cols[0]), use_container_width=True)
                # insights on result
                try:
                    auto2 = AutoInsightsEngine(st.session_state.domain, st.session_state.sku_price_map)
                    res_ins = auto2.analyze_on_query_result(result, executed_spec)
                    if res_ins:
                        st.subheader("Insights on result")
                        for r in res_ins:
                            st.info(f"{r.get('title')}: {r.get('action')}")
                except Exception:
                    pass
            else:
                st.warning("No results. Try a different prompt or inspect the Data Explorer.")
        except Exception as e:
            st.error(f"Query failed: {e}")

# TAB: Data Explorer
with tabs[2]:
    st.subheader("Data Explorer")
    ds = st.selectbox("Select dataset", list(st.session_state.dataframes.keys()))
    ddf = st.session_state.dataframes[ds]
    st.dataframe(ddf.head(200))
    with st.expander("Column details"):
        col_info = pd.DataFrame({
            'column': ddf.columns.astype(str),
            'dtype': ddf.dtypes.astype(str),
            'non_null': ddf.count().values,
            'null_count': ddf.isna().sum().values,
            'unique': ddf.nunique().values,
            'sample': [str(ddf[c].dropna().head(3).tolist()) for c in ddf.columns]
        })
        st.dataframe(col_info)

# TAB: Visualizations
with tabs[3]:
    st.subheader("Visualizations")
    dfv = st.session_state.joined_df
    numeric = dfv.select_dtypes(include=['number']).columns.tolist()
    categorical = dfv.select_dtypes(include=['object']).columns.tolist()
    datecols = [c for c in dfv.columns if 'date' in c.lower()]

    viz_type = st.selectbox("Chart type", ["Bar", "Line", "Scatter", "Heatmap", "Pie"])
    x = st.selectbox("X axis", categorical + datecols + numeric)
    y = None
    if viz_type != 'Pie':
        y = st.selectbox("Y axis", numeric if numeric else [None])

    if st.button("Generate Visualization"):
        try:
            if viz_type == "Bar" and x and y:
                agg = dfv.groupby(x)[y].sum().reset_index().sort_values(y, ascending=False).head(50)
                st.plotly_chart(VizEngine.bar(agg, x, y), use_container_width=True)
            elif viz_type == "Line" and x and y:
                agg = dfv.groupby(x)[y].sum().reset_index().sort_values(x)
                st.plotly_chart(VizEngine.line(agg, x, y), use_container_width=True)
            elif viz_type == "Scatter" and x and y:
                st.plotly_chart(VizEngine.scatter(dfv.head(2000), x, y), use_container_width=True)
            elif viz_type == "Heatmap":
                fig = VizEngine.heatmap_corr(dfv)
                if fig:
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.info("Heatmap requires numeric columns")
            elif viz_type == "Pie" and x:
                pv = dfv[x].value_counts().reset_index().head(10)
                pv.columns = [x, 'count']
                fig = VizEngine.pie(pv, x, 'count')
                if fig:
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.warning("Pie chart could not be generated.")
        except Exception as e:
            st.error(f"Visualization failed: {e}")

# TAB: Help / How To Use
with tabs[4]:
    st.markdown("""
    <h2>📘 How to Use AUM Studio</h2>
    <p>This guide shows the core workflow.</p>
    <ol>
      <li>Upload CSV/Excel files in the sidebar (1-5 files).</li>
      <li>Optional: upload SKU price map for financial impact.</li>
      <li>Click <strong>🔬 Analyze Now</strong> to run domain detection and auto-insights.</li>
      <li>Explore results in Domain Insights, ask in Natural Query, or build charts in Visualizations.</li>
    </ol>
    <h4>Tips</h4>
    <ul>
      <li>Rename columns meaningfully for better NLP results.</li>
      <li>Use small sample files for faster iteration on Streamlit Cloud free tier.</li>
      <li>If ideas are missing, manually override domain in code or extensions.</li>
    </ul>
    """, unsafe_allow_html=True)

# ------------------------------------------------------------
# FOOTER ACTIONS
# ------------------------------------------------------------
st.markdown("---")
col1, col2 = st.columns([2,1])
with col1:
    st.caption(f"© {datetime.now().year} AUM Studio | User: {st.session_state.user_email}")
with col2:
    if st.button("Refresh Insights"):
        try:
            auto = AutoInsightsEngine(st.session_state.domain, st.session_state.sku_price_map)
            st.session_state.insights = auto.analyze_on_upload(st.session_state.joined_df)
            st.rerun()
        except Exception as e:
            st.error(f"Refresh failed: {e}")

# DEBUG
with st.expander("Debug & Session"):
    st.json({
        'user': st.session_state.user_email,
        'domain': st.session_state.domain,
        'confidence': st.session_state.domain_confidence,
        'files_loaded': list(st.session_state.dataframes.keys()),
        'insights': len(st.session_state.insights)
    })

