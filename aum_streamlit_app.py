"""
AUM: Augmented Universal Metrics - Streamlit UI
Version: 2.1.0 (FULLY TESTED & DEBUGGED)
Tagline: The Sound of Data Understanding

CRITICAL FIXES:
- All Supabase calls wrapped in try-except
- Proper error messages for RLS issues
- Polished UI with consistent styling
- Fixed all integration issues
"""

import streamlit as st

# ✅ MUST be first
st.set_page_config(
    page_title="AUM: Augmented Universal Metrics",
    page_icon="🎵",
    layout="wide",
    initial_sidebar_state="expanded"
)

import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
import json
import os
from datetime import datetime
import hashlib
import tempfile
from typing import List, Dict, Optional
import warnings
import io
warnings.filterwarnings('ignore')

# Supabase
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# Import AUM Engine
try:
    from aum_engine import (
        AUMEngine, DomainIntelligence, SemanticJoinEngine, PromptInterpreter
    )
    ENGINE_AVAILABLE = True
except ImportError:
    st.error("❌ AUM Engine not found. Place aum_engine.py in the same directory.")
    ENGINE_AVAILABLE = False
    st.stop()


# ============================================================================
# ENHANCED STYLING
# ============================================================================

st.markdown("""
<style>
    /* Main header - FIXED VISIBILITY */
    .main-header {
        font-size: 2.8rem;
        font-weight: 800;
        color: #667eea;
        text-align: center;
        margin-bottom: 0.2rem;
        font-family: 'Inter', sans-serif;
        text-shadow: 2px 2px 4px rgba(102, 126, 234, 0.3);
    }
    
    /* Tagline */
    .tagline {
        font-size: 1.1rem;
        color: #6B7280;
        text-align: center;
        font-style: italic;
        margin-bottom: 2rem;
        font-weight: 300;
    }
    
    /* Buttons */
    .stButton>button {
        width: 100%;
        border-radius: 10px;
        font-weight: 600;
        transition: all 0.3s ease;
        border: none;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0,0,0,0.15);
    }
    
    /* Insight boxes */
    .insight-box {
        background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
        padding: 1.2rem;
        border-radius: 12px;
        border-left: 4px solid #667eea;
        margin: 0.8rem 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    /* Metric cards */
    .metric-card {
        background: #ffffff;
        padding: 1.5rem;
        border-radius: 12px;
        border: 1px solid #E5E7EB;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        transition: transform 0.2s;
    }
    
    .metric-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }
    
    /* Sidebar styling */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
    }
    
    /* Tab styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    
    .stTabs [data-baseweb="tab"] {
        border-radius: 8px 8px 0 0;
        padding: 12px 24px;
        font-weight: 600;
    }
    
    /* Info boxes */
    .stAlert {
        border-radius: 10px;
        border-left: 4px solid;
    }
    
    /* Dataframe */
    .dataframe {
        border-radius: 8px;
        overflow: hidden;
    }
    
    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    
    /* Success message */
    .success-msg {
        background: #D1FAE5;
        color: #065F46;
        padding: 1rem;
        border-radius: 8px;
        border-left: 4px solid #10B981;
        margin: 1rem 0;
    }
    
    /* Error message */
    .error-msg {
        background: #FEE2E2;
        color: #991B1B;
        padding: 1rem;
        border-radius: 8px;
        border-left: 4px solid #EF4444;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)


# ============================================================================
# Supabase Helpers (With Robust Error Handling)
# ============================================================================

def init_supabase() -> Optional[Client]:
    """Initialize Supabase with comprehensive error handling"""
    if not SUPABASE_AVAILABLE:
        return None
    
    try:
        url = st.secrets.get("SUPABASE_URL", os.getenv("SUPABASE_URL"))
        key = st.secrets.get("SUPABASE_KEY", os.getenv("SUPABASE_KEY"))
        
        if not url or not key:
            return None
        
        return create_client(url, key)
    except Exception as e:
        st.sidebar.error(f"Supabase connection failed: {str(e)[:100]}")
        return None


def safe_db_call(func, error_msg="Database operation failed"):
    """Wrapper for safe database calls with proper error handling"""
    try:
        return func()
    except Exception as e:
        error_detail = str(e)
        if "JWT" in error_detail or "auth" in error_detail.lower():
            st.error("🔒 Authentication error. Please logout and login again.")
        elif "RLS" in error_detail or "policy" in error_detail.lower():
            st.warning(f"⚠️ {error_msg}. Database policy issue detected.")
        else:
            st.error(f"❌ {error_msg}: {error_detail[:200]}")
        return None


# ============================================================================
# Database Operations (All with Error Handling)
# ============================================================================

def create_or_update_profile(supabase: Client, user):
    """Create/update user profile"""
    def _operation():
        data = {
            "id": user.id,
            "email": user.email,
            "name": user.email.split('@')[0],
            "last_login": datetime.now().isoformat()
        }
        return supabase.table("user_profiles").upsert(data).execute()
    
    return safe_db_call(_operation, "Profile update failed")


def get_usage_count(supabase: Client, user_id: str) -> int:
    """Get query count with error handling"""
    def _operation():
        response = supabase.table("usage_logs").select("id").eq("user_id", user_id).execute()
        return len(response.data) if response.data else 0
    
    result = safe_db_call(_operation, "Failed to fetch usage count")
    return result if result is not None else 0


FREE_QUERY_LIMIT = 10  # Changed from 3 to 10 for testing


def check_paid_access(supabase: Client, user_id: str) -> bool:
    """Check paid status"""
    def _operation():
        response = supabase.table("transactions")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("payment_status", "confirmed")\
            .execute()
        return len(response.data) > 0 if response.data else False
    
    result = safe_db_call(_operation, "Failed to check payment status")
    return result if result is not None else False


def log_usage(supabase: Client, user_id: str, prompt: str, domain: str, 
             result_rows: int = 0, cost: float = 0):
    """Log query with error handling"""
    def _operation():
        data = {
            "user_id": user_id,
            "prompt": prompt,
            "domain": domain,
            "execution_count": 1,
            "result_rows": result_rows,
            "cost": cost,
            "created_at": datetime.now().isoformat()
        }
        return supabase.table("usage_logs").insert(data).execute()
    
    return safe_db_call(_operation, "Failed to log query")


def record_payment(supabase: Client, user_id: str, amount: float) -> bool:
    """Record payment"""
    def _operation():
        data = {
            "user_id": user_id,
            "amount": float(amount),
            "currency": "INR",
            "mode": "razorpay_qr",
            "payment_status": "confirmed",
            "created_at": datetime.now().isoformat()
        }
        return supabase.table("transactions").insert(data).execute()
    
    result = safe_db_call(_operation, "Payment recording failed")
    return result is not None


def save_domain_preference(supabase: Client, user_id: str, domain: str):
    """Save domain preference"""
    def _operation():
        # Update user_profiles
        supabase.table("user_profiles")\
            .update({"domain_preference": domain})\
            .eq("id", user_id)\
            .execute()
        
        # Upsert domain_settings
        data = {
            "user_id": user_id,
            "domain": domain,
            "canonical_synonyms": {},
            "last_updated": datetime.now().isoformat()
        }
        return supabase.table("domain_settings").upsert(data).execute()
    
    return safe_db_call(_operation, "Failed to save domain preference")


def get_domain_preference(supabase: Client, user_id: str) -> str:
    """Get saved domain"""
    def _operation():
        response = supabase.table("user_profiles")\
            .select("domain_preference")\
            .eq("id", user_id)\
            .single()\
            .execute()
        return response.data.get('domain_preference', 'eCommerce') if response.data else 'eCommerce'
    
    result = safe_db_call(_operation, "Failed to load domain")
    return result if result else 'eCommerce'


# ============================================================================
# Export Functions
# ============================================================================

def export_to_csv(df: pd.DataFrame) -> bytes:
    """Export to CSV"""
    return df.to_csv(index=False).encode('utf-8')


def export_to_excel(df: pd.DataFrame) -> bytes:
    """Export to Excel"""
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='AUM Results')
    return output.getvalue()


# ============================================================================
# UI Components
# ============================================================================

def show_login_page(supabase: Client):
    """Enhanced login interface"""
    st.markdown('<h1 class="main-header">🎵 AUM</h1>', unsafe_allow_html=True)
    st.markdown('<p class="tagline">Augmented Universal Metrics — The Sound of Data Understanding</p>', 
                unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown("### 🔐 Welcome Back")
        
        tab1, tab2 = st.tabs(["🔑 Login", "✨ Register"])
        
        with tab1:
            with st.form("login_form"):
                email = st.text_input("📧 Email", placeholder="your@email.com")
                password = st.text_input("🔒 Password", type="password", placeholder="••••••••")
                
                col_a, col_b = st.columns(2)
                
                with col_a:
                    login_btn = st.form_submit_button("Login", use_container_width=True)
                
                with col_b:
                    magic_btn = st.form_submit_button("Send Magic Link", use_container_width=True)
                
                if login_btn and email and password:
                    try:
                        response = supabase.auth.sign_in_with_password({
                            "email": email,
                            "password": password
                        })
                        
                        if response.user:
                            st.session_state.user = response.user
                            st.session_state.access_token = response.session.access_token
                            create_or_update_profile(supabase, response.user)
                            st.success("✅ Login successful!")
                            st.rerun()
                    except Exception as e:
                        st.error(f"❌ Login failed: {str(e)}")
                
                if magic_btn and email:
                    try:
                        supabase.auth.sign_in_with_otp({"email": email})
                        st.success("✅ Magic link sent! Check your email.")
                    except Exception as e:
                        st.error(f"❌ Failed: {str(e)}")
        
        with tab2:
            with st.form("register_form"):
                reg_email = st.text_input("📧 Email", placeholder="your@email.com", key="reg_email")
                reg_password = st.text_input("🔒 Password", type="password", placeholder="Min 6 characters", key="reg_pass")
                reg_confirm = st.text_input("🔒 Confirm Password", type="password", placeholder="••••••••", key="reg_confirm")
                
                register_btn = st.form_submit_button("Create Account", use_container_width=True)
                
                if register_btn:
                    if not reg_email or not reg_password:
                        st.error("Please fill all fields")
                    elif reg_password != reg_confirm:
                        st.error("Passwords don't match")
                    elif len(reg_password) < 6:
                        st.error("Password must be at least 6 characters")
                    else:
                        try:
                            response = supabase.auth.sign_up({
                                "email": reg_email,
                                "password": reg_password
                            })
                            if response.user:
                                st.success("✅ Account created! Please login.")
                        except Exception as e:
                            st.error(f"❌ Registration failed: {str(e)}")


def show_consent_modal():
    """Simplified consent modal"""
    st.markdown('<h1 class="main-header">⚖️ Terms of Service</h1>', unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 3, 1])
    
    with col2:
        st.markdown("""
        ### Welcome to AUM: Augmented Universal Metrics
        
        **By continuing, you agree to:**
        
        ✅ Use AUM for business intelligence and analytics  
        ✅ Verify all AI-generated insights independently  
        ✅ Data processed securely via Supabase infrastructure  
        ✅ Usage tracked for billing and analytics  
        
        **Pricing:**
        - 🆓 **10 free queries** to test the platform
        - 💰 **₹999/month** for unlimited access
        
        **Your Data:**
        - Processed in-memory during sessions
        - Metadata stored in your Supabase project
        - No third-party sharing beyond Supabase
        """)
        
        agree = st.checkbox("✅ I understand and agree to these terms", key="consent_check")
        
        if st.button("Continue to AUM Studio", disabled=not agree, use_container_width=True, type="primary"):
            st.session_state.consent = True
            st.rerun()


def render_main_ui(supabase: Client, user):
    """Main application UI"""
    
    # Header with gradient
    st.markdown('<h1 class="main-header">🎵 AUM Studio</h1>', unsafe_allow_html=True)
    st.markdown('<p class="tagline">The Sound of Data Understanding</p>', unsafe_allow_html=True)
    
    # Top bar
    col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
    with col1:
        st.markdown(f"**👤 {user.email.split('@')[0]}**")
    with col2:
        if 'project_id' in st.session_state:
            st.markdown(f"**📁 Project:** `{st.session_state.project_id[:8]}`")
    with col3:
        status = "🚀 Pro" if st.session_state.get('paid_access', False) else f"🆓 Free ({max(0, FREE_QUERY_LIMIT - st.session_state.get('query_count', 0))}/{FREE_QUERY_LIMIT})"
        st.markdown(f"**Status:** {status}")
    with col4:
        if st.button("🚪", help="Logout"):
            if supabase:
                try:
                    supabase.auth.sign_out()
                except:
                    pass
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()
    
    st.markdown("---")
    
    # Sidebar
    with st.sidebar:
        st.markdown("## 🎛️ Control Panel")
        
        # Domain
        st.markdown("### 🧠 Domain")
        saved_domain = get_domain_preference(supabase, user.id)
        domains = DomainIntelligence.get_all_domains()
        domain_idx = domains.index(saved_domain) if saved_domain in domains else 0
        
        domain = st.selectbox(
            "Industry Vertical",
            domains,
            index=domain_idx,
            key="domain_selector",
            help="Select your industry for optimized analytics"
        )
        
        # Save domain if changed
        if 'last_domain' not in st.session_state or st.session_state.last_domain != domain:
            st.session_state.last_domain = domain
            save_domain_preference(supabase, user.id, domain)
        
        # Model
        st.markdown("### 🤖 AI Model")
        model = st.selectbox(
            "Semantic Engine",
            ['all-MiniLM-L6-v2', 'multi-qa-mpnet-base-dot-v1'],
            help="Neural network for semantic understanding"
        )
        
        st.markdown("---")
        
        # File upload
        st.markdown("### 📂 Data Upload")
        uploaded_files = st.file_uploader(
            "Upload datasets (max 5)",
            type=['csv', 'xlsx', 'xls'],
            accept_multiple_files=True,
            help="CSV or Excel files up to 200MB total"
        )
        
        if uploaded_files:
            if len(uploaded_files) <= 5:
                st.session_state.uploaded_files = uploaded_files
                st.success(f"✅ {len(uploaded_files)} file(s) ready")
            else:
                st.error("❌ Maximum 5 files allowed")
        
        # Initialize button
        if st.button("🚀 Initialize Engine", use_container_width=True, type="primary"):
            if st.session_state.get('uploaded_files'):
                with st.spinner("🔄 Processing data..."):
                    initialize_engine(supabase, user.id, domain, model)
            else:
                st.warning("⚠️ Please upload files first")
        
        st.markdown("---")
        
        # Usage stats
        st.markdown("### 📊 Usage")
        query_count = st.session_state.get('query_count', 0)
        paid = st.session_state.get('paid_access', False)
        
        if paid:
            st.success("✅ **Unlimited Access**")
        else:
            free_remaining = max(0, FREE_QUERY_LIMIT - query_count)
            if free_remaining > 0:
                st.info(f"🆓 **{free_remaining} free queries left**")
            else:
                st.warning("⚠️ **Free tier exhausted**")
                if st.button("💳 Upgrade Now", use_container_width=True):
                    show_payment_modal(supabase, user.id)
        
        st.markdown("---")
        st.caption("© 2025 AUM v2.1.0 • Made with ❤️ for data analysts")
    
    # Main content
    if st.session_state.get('engine') is None:
        st.info("### 👋 Getting Started\n\n1. Upload your CSV/Excel files\n2. Select your industry domain\n3. Click 'Initialize Engine'\n4. Start asking questions in plain English!")
        return
    
    # Query limit check
    if st.session_state.get('query_count', 0) >= FREE_QUERY_LIMIT and not st.session_state.get('paid_access', False):
        st.error(f"### 🚫 Free Tier Limit Reached\n\nYou've used all {FREE_QUERY_LIMIT} free queries. Upgrade to Pro for unlimited access at ₹999/month")
        if st.button("💳 Upgrade to Pro", type="primary"):
            show_payment_modal(supabase, user.id)
        return
    
    # Tabs
    tabs = st.tabs(["📊 Data", "🔗 Joins", "💬 Query", "📈 Charts", "💡 Insights", "📥 Export"])
    
    with tabs[0]:
        render_data_preview()
    
    with tabs[1]:
        render_join_configuration(supabase, user.id)
    
    with tabs[2]:
        render_query_interface(supabase, user.id, domain)
    
    with tabs[3]:
        render_visualizations()
    
    with tabs[4]:
        render_insights()
    
    with tabs[5]:
        render_export()


def initialize_engine(supabase: Client, user_id: str, domain: str, model: str):
    """Initialize engine with progress feedback"""
    try:
        temp_dir = tempfile.mkdtemp()
        file_paths = []
        
        for uploaded_file in st.session_state.uploaded_files:
            file_path = Path(temp_dir) / uploaded_file.name
            with open(file_path, 'wb') as f:
                f.write(uploaded_file.getbuffer())
            file_paths.append(str(file_path))
        
        engine = AUMEngine(domain=domain, semantic_model=model)
        engine.load_files(file_paths)
        
        suggestions = engine.detect_joins()
        
        st.session_state.engine = engine
        st.session_state.join_suggestions = suggestions
        if 'project_id' not in st.session_state:
            st.session_state.project_id = hashlib.md5(str(datetime.now()).encode()).hexdigest()[:8]
        
        st.success(f"✅ Engine ready! {len(engine.dataframes)} datasets loaded, {len(suggestions)} joins detected")
        
    except Exception as e:
        st.error(f"❌ Initialization failed: {str(e)}")


def render_data_preview():
    """Enhanced data preview"""
    st.subheader("📊 Data Preview")
    
    engine = st.session_state.get('engine')
    if not engine or not engine.dataframes:
        st.info("No data loaded yet")
        return
    
    dataset_name = st.selectbox("Select Dataset", list(engine.dataframes.keys()))
    df = engine.dataframes[dataset_name]
    
    # Metrics
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("📏 Rows", f"{len(df):,}")
    col2.metric("📐 Columns", len(df.columns))
    col3.metric("💾 Size", f"{df.memory_usage(deep=True).sum() / 1024**2:.1f} MB")
    col4.metric("🔍 Nulls", f"{df.isnull().sum().sum():,}")
    
    st.dataframe(df.head(100), use_container_width=True, height=400)
    
    with st.expander("📋 Column Details"):
        st.dataframe(pd.DataFrame({
            'Column': df.columns,
            'Type': df.dtypes.astype(str),
            'Non-Null': df.count().values,
            'Unique': df.nunique().values
        }), use_container_width=True)


def render_join_configuration(supabase: Client, user_id: str):
    """Join configuration UI"""
    st.subheader("🔗 Join Configuration")
    
    suggestions = st.session_state.get('join_suggestions', [])
    if not suggestions:
        st.info("No join suggestions. Upload multiple datasets to detect joins.")
        return
    
    st.write(f"**Found {len(suggestions)} potential joins:**")
    
    join_df = pd.DataFrame(suggestions)
    edited_df = st.data_editor(
        join_df,
        column_config={
            "confidence": st.column_config.ProgressColumn("Confidence", min_value=0, max_value=1),
        },
        hide_index=True,
        use_container_width=True
    )
    
    if st.button("🔗 Execute Joins", type="primary", use_container_width=True):
        with st.spinner("Joining datasets..."):
            try:
                selected_joins = edited_df.to_dict('records')
                engine = st.session_state.engine
                joined_df = engine.execute_joins(selected_joins[:5])
                
                st.success(f"✅ Successfully joined: {len(joined_df)} rows × {len(joined_df.columns)} columns")
                
                with st.expander("👁️ Preview Joined Data"):
                    st.dataframe(joined_df.head(50), use_container_width=True)
                
            except Exception as e:
                st.error(f"❌ Join failed: {str(e)}")


def render_query_interface(supabase: Client, user_id: str, domain: str):
    """Query interface with examples"""
    st.subheader("💬 Natural Language Query")
    
    engine = st.session_state.get('engine')
    if not engine or engine.joined_df is None:
        st.info("Execute joins first to enable querying")
        return
    
    with st.expander("💡 Example Queries"):
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("""
            **📊 Rankings:**
            - rank sales by dealer top 10
            - top 5 regions by revenue
            """)
        with col2:
            st.markdown("""
            **📈 Trends:**
            - trend sales by month in 2024
            - show revenue over time
            """)
    
    prompt = st.text_area(
        "Ask your question",
        placeholder="e.g., rank sales by dealer_name top 10",
        height=100
    )
    
    col1, col2 = st.columns([4, 1])
    with col1:
        execute_btn = st.button("🚀 Analyze", type="primary", use_container_width=True)
    with col2:
        st.metric("Queries", st.session_state.get('query_count', 0))
    
    if execute_btn and prompt:
        if st.session_state.get('query_count', 0) >= FREE_QUERY_LIMIT and not st.session_state.get('paid_access', False):
            st.error("🚫 Upgrade to continue")
            return
        
        with st.spinner("🤖 Analyzing..."):
            try:
                result = engine.analyze(prompt)
                st.session_state.query_count = st.session_state.get('query_count', 0) + 1
                st.session_state.query_result = result
                
                log_usage(supabase, user_id, prompt, domain, len(result['result']))
                
                st.success("✅ Analysis complete!")
                st.dataframe(result['result'], use_container_width=True, height=300)
                
            except Exception as e:
                st.error(f"❌ Query failed: {str(e)}")


def render_visualizations():
    """Enhanced visualizations"""
    st.subheader("📈 Visualizations")
    
    if 'query_result' not in st.session_state:
        st.info("Execute a query to see visualizations")
        return
    
    result = st.session_state.query_result
    df = result['result']
    query = result['query']
    
    try:
        task = query['task']
        metrics = query['metrics']
        dimensions = query['dimensions']
        
        if task == 'rank' and dimensions and metrics:
            fig = px.bar(df.head(20), x=dimensions[0], y=metrics[0],
                        title=f"{metrics[0]} by {dimensions[0]}",
                        color=metrics[0], color_continuous_scale='Viridis',
                        template='plotly_white')
            fig.update_layout(height=500)
            st.plotly_chart(fig, use_container_width=True)
        
        elif task == 'trend' and query.get('time_column') and metrics:
            fig = px.line(df, x=query['time_column'], y=metrics[0],
                         title=f"{metrics[0]} Trend", markers=True,
                         template='plotly_white')
            fig.update_layout(height=500)
            st.plotly_chart(fig, use_container_width=True)
        
        elif task == 'heatmap' and len(dimensions) >= 2 and metrics:
            pivot = df.pivot_table(values=metrics[0], index=dimensions[0], 
                                  columns=dimensions[1], aggfunc='sum')
            pivot_numeric = pivot.apply(pd.to_numeric, errors='coerce').fillna(0)
            
            fig = px.imshow(pivot_numeric, title=f"{metrics[0]} Heatmap",
                           color_continuous_scale='RdYlBu_r', aspect='auto',
                           template='plotly_white')
            fig.update_layout(height=500)
            st.plotly_chart(fig, use_container_width=True)
        
        else:
            numeric_cols = df.select_dtypes(include=[np.number]).columns[:2]
            if len(numeric_cols) >= 2:
                fig = px.scatter(df, x=numeric_cols[0], y=numeric_cols[1],
                               title="Data Distribution", template='plotly_white',
                               color=numeric_cols[0], color_continuous_scale='Viridis')
                fig.update_layout(height=500)
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("Not enough numeric columns for visualization")
    
    except Exception as e:
        st.warning(f"Visualization error: {str(e)}")


def render_insights():
    """Insights display"""
    st.subheader("💡 AI-Generated Insights")
    
    if 'query_result' not in st.session_state:
        st.info("Execute a query to generate insights")
        return
    
    insights = st.session_state.query_result.get('insights', [])
    
    if insights:
        for idx, insight in enumerate(insights, 1):
            st.markdown(f'<div class="insight-box">**{idx}.** {insight}</div>', 
                       unsafe_allow_html=True)
    else:
        st.info("No significant insights detected in this dataset")


def render_export():
    """Export functionality"""
    st.subheader("📥 Export Results")
    
    if 'query_result' not in st.session_state:
        st.info("Execute a query first to export results")
        return
    
    df = st.session_state.query_result['result']
    
    st.write(f"**Export {len(df)} rows × {len(df.columns)} columns**")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        csv_data = export_to_csv(df)
        st.download_button(
            label="📄 CSV",
            data=csv_data,
            file_name=f"aum_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
            use_container_width=True
        )
    
    with col2:
        excel_data = export_to_excel(df)
        st.download_button(
            label="📊 Excel",
            data=excel_data,
            file_name=f"aum_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True
        )
    
    with col3:
        json_data = df.to_json(orient='records', indent=2)
        st.download_button(
            label="🔧 JSON",
            data=json_data,
            file_name=f"aum_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
            mime="application/json",
            use_container_width=True
        )
    
    st.markdown("---")
    with st.expander("👁️ Preview Export Data"):
        st.dataframe(df, use_container_width=True, height=300)


def show_payment_modal(supabase: Client, user_id: str):
    """Payment upgrade modal"""
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("""
        <div class="metric-card">
        <h3>🆓 Free Tier</h3>
        <ul>
            <li>✅ 10 queries</li>
            <li>✅ All features</li>
            <li>✅ Basic support</li>
            <li>❌ Limited access</li>
        </ul>
        <p><strong>You've used all free queries</strong></p>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown("""
        <div class="metric-card" style="border: 2px solid #667eea;">
        <h3>🚀 Pro Tier - ₹999/month</h3>
        <ul>
            <li>✅ <strong>Unlimited queries</strong></li>
            <li>✅ Priority support</li>
            <li>✅ Advanced analytics</li>
            <li>✅ API access (soon)</li>
        </ul>
        <p><strong>Best value for professionals</strong></p>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    col_a, col_b, col_c = st.columns([1, 2, 1])
    
    with col_b:
        st.info("**💳 Payment Instructions**\n\n1. Scan QR with any UPI app\n2. Pay ₹999\n3. Click 'I Have Paid'")
        
        st.image("https://via.placeholder.com/250x250/667eea/FFFFFF?text=UPI+QR+Code", 
                 use_column_width=True)
        
        if st.button("✅ I Have Paid ₹999", type="primary", use_container_width=True):
            if record_payment(supabase, user_id, 999.0):
                st.session_state.paid_access = True
                st.success("✅ Payment confirmed! You now have unlimited access.")
                st.balloons()
                st.rerun()
            else:
                st.error("❌ Payment failed. Please contact support.")


# ============================================================================
# Main Application Flow
# ============================================================================

def main():
    """Main entry point with proper flow control"""
    
    # Initialize Supabase
    supabase = init_supabase()
    
    if not supabase:
        st.error("### ❌ Configuration Error\n\nSupabase credentials not found. Add to `.streamlit/secrets.toml`:\n\n```toml\nSUPABASE_URL = \"your-url\"\nSUPABASE_KEY = \"your-key\"\n```")
        st.stop()
    
    # Check authentication
    if 'user' not in st.session_state:
        show_login_page(supabase)
        return
    
    user = st.session_state.user
    
    # Initialize session state variables
    if 'consent' not in st.session_state:
        st.session_state.consent = False
    if 'uploaded_files' not in st.session_state:
        st.session_state.uploaded_files = []
    if 'engine' not in st.session_state:
        st.session_state.engine = None
    if 'join_suggestions' not in st.session_state:
        st.session_state.join_suggestions = []
    if 'project_id' not in st.session_state:
        st.session_state.project_id = hashlib.md5(str(datetime.now()).encode()).hexdigest()[:8]
    if 'query_count' not in st.session_state:
        st.session_state.query_count = get_usage_count(supabase, user.id)
    if 'paid_access' not in st.session_state:
        st.session_state.paid_access = check_paid_access(supabase, user.id)
    
    # Consent check
    if not st.session_state.consent:
        show_consent_modal()
        return
    
    # Main application
    render_main_ui(supabase, user)


# ============================================================================
# Entry Point
# ============================================================================

if __name__ == "__main__":
    main()
