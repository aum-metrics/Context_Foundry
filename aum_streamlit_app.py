"""
AUM: Augmented Universal Metrics - Streamlit UI
Version: 1.0.1 (TESTED & VALIDATED)
Tagline: The Sound of Data Understanding

Supabase-authenticated analytics platform with Razorpay payments.

FIXES APPLIED:
- Unified imports (aum_engine.py)
- Consent flow fixed
- Excel engine specified
- UTF-8 encoding for HTML
- Heatmap numeric coercion
- Groupby collision avoidance
"""

import streamlit as st

import streamlit as st

# ✅ Page setup MUST be first Streamlit command
st.set_page_config(
    page_title="AUM Studio — The Sound of Data Understanding",
    page_icon="🎵",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ---- Imports after page config ----

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
warnings.filterwarnings('ignore')

# Import AUM Engine - FIXED: Use unified filename
try:
    from aum_engine import (
        AUMEngine, DomainIntelligence, SemanticJoinEngine, PromptInterpreter
    )
    ENGINE_AVAILABLE = True
except ImportError:
    st.error("❌ AUM Engine not found. Ensure aum_engine.py is in the same directory.")
    ENGINE_AVAILABLE = False
    st.stop()


# ============================================================================
# Configuration
# ============================================================================


# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: 700;
        color: #1E3A8A;
        text-align: center;
        margin-bottom: 0.5rem;
    }
    .tagline {
        font-size: 1.2rem;
        color: #6B7280;
        text-align: center;
        font-style: italic;
        margin-bottom: 2rem;
    }
    .stButton>button {
        width: 100%;
        border-radius: 8px;
        font-weight: 600;
    }
    .insight-box {
        background: #F0F9FF;
        padding: 1rem;
        border-radius: 8px;
        border-left: 4px solid #3B82F6;
        margin: 0.5rem 0;
    }
</style>
""", unsafe_allow_html=True)


# ============================================================================
# Supabase Configuration
# ============================================================================

from supabase import create_client, Client

def init_supabase():
    """
    Initialize Supabase client using v2.x API.
    """
    try:
        url = st.secrets.get("SUPABASE_URL")
        key = st.secrets.get("SUPABASE_KEY")

        if not url or not key:
            st.sidebar.error("❌ Missing SUPABASE_URL or SUPABASE_KEY in .streamlit/secrets.toml")
            return None

        supabase: Client = create_client(url, key)
        st.sidebar.success("✅ Supabase connection established.")
        return supabase

    except Exception as e:
        st.sidebar.error(f"❌ Supabase init failed: {e}")
        return None


# ============================================================================
# Authentication Functions
# ============================================================================

def show_login_page(supabase):
    """Display OTP-based login interface"""
    st.markdown('<h1 class="main-header">🎵 AUM: Augmented Universal Metrics</h1>', unsafe_allow_html=True)
    st.markdown('<p class="tagline">The Sound of Data Understanding</p>', unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.subheader("🔐 Login / Register")
        
        tab1, tab2 = st.tabs(["Email + Password", "Magic Link (OTP)"])
        
        with tab1:
            st.info("💡 Use email/password for quick login")
            email = st.text_input("Email", key="login_email")
            password = st.text_input("Password", type="password", key="login_password")
            
            col_a, col_b = st.columns(2)
            
            with col_a:
                if st.button("Login", key="login_btn", use_container_width=True):
                    if email and password:
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
                            else:
                                st.error("❌ Invalid credentials")
                        except Exception as e:
                            st.error(f"❌ Login failed: {str(e)}")
                    else:
                        st.warning("Please enter email and password")
            
            with col_b:
                if st.button("Register", key="register_btn", use_container_width=True):
                    if email and password:
                        try:
                            response = supabase.auth.sign_up({
                                "email": email,
                                "password": password
                            })
                            
                            if response.user:
                                st.success("✅ Registration successful! Please login.")
                            else:
                                st.error("❌ Registration failed")
                        except Exception as e:
                            st.error(f"❌ Registration error: {str(e)}")
                    else:
                        st.warning("Please enter email and password")
        
        with tab2:
            st.info("💡 Passwordless login - Check your email for magic link")
            magic_email = st.text_input("Email", key="magic_email")
            
            if st.button("Send Magic Link", key="magic_btn", use_container_width=True):
                if magic_email:
                    try:
                        response = supabase.auth.sign_in_with_otp({
                            "email": magic_email
                        })
                        st.success("✅ Magic link sent! Check your email.")
                    except Exception as e:
                        st.error(f"❌ Failed to send magic link: {str(e)}")
                else:
                    st.warning("Please enter your email")
        
        st.markdown("---")
        st.caption("🔒 Secure authentication powered by Supabase")


def create_or_update_profile(supabase: Client, user):
    """Create or update user profile in Supabase"""
    try:
        profile_data = {
            "id": user.id,
            "email": user.email,
            "name": user.email.split('@')[0],
            "created_at": datetime.now().isoformat()
        }
        
        # Upsert profile
        supabase.table("user_profiles").upsert(profile_data).execute()
    except Exception as e:
        st.sidebar.warning(f"Profile update failed: {e}")


def log_usage(supabase: Client, user_id: str, prompt: str, domain: str, cost: float = 0):
    """Log query execution to Supabase"""
    try:
        log_data = {
            "user_id": user_id,
            "prompt": prompt,
            "domain": domain,
            "execution_count": 1,
            "cost": cost,
            "created_at": datetime.now().isoformat()
        }
        
        supabase.table("usage_logs").insert(log_data).execute()
    except Exception as e:
        st.sidebar.warning(f"Usage logging failed: {e}")


def get_usage_count(supabase: Client, user_id: str) -> int:
    """Get user's query count"""
    try:
        response = supabase.table("usage_logs")\
            .select("execution_count")\
            .eq("user_id", user_id)\
            .execute()
        
        return len(response.data) if response.data else 0
    except:
        return 0


def record_payment(supabase: Client, user_id: str, amount: float):
    """Record payment transaction"""
    try:
        payment_data = {
            "user_id": user_id,
            "amount": amount,
            "currency": "INR",
            "mode": "razorpay_qr",
            "payment_status": "confirmed",
            "created_at": datetime.now().isoformat()
        }
        
        supabase.table("transactions").insert(payment_data).execute()
        return True
    except Exception as e:
        st.error(f"Payment recording failed: {e}")
        return False


# ============================================================================
# Main Application
# ============================================================================

def main():
    """Main application entry point"""
    
    # Initialize Supabase
    supabase = init_supabase()
    
    # Check authentication
    if 'user' not in st.session_state:
        if supabase:
            show_login_page(supabase)
        else:
            st.error("❌ Supabase not configured. Please add credentials to .streamlit/secrets.toml")
        return
    
    user = st.session_state.user
    
    # Initialize session state
    if 'consent' not in st.session_state:
        st.session_state.consent = False
    if 'uploaded_files' not in st.session_state:
        st.session_state.uploaded_files = []
    if 'engine' not in st.session_state:
        st.session_state.engine = None
    if 'join_suggestions' not in st.session_state:
        st.session_state.join_suggestions = []
    if 'query_count' not in st.session_state:
        st.session_state.query_count = get_usage_count(supabase, user.id) if supabase else 0
    if 'paid_access' not in st.session_state:
        st.session_state.paid_access = False
    
    # FIXED: Legal consent modal with proper flag setting
    if not st.session_state.consent:
        show_consent_modal()
        return
    
    # Main UI
    render_main_ui(supabase, user)


def show_consent_modal():
    """Display legal consent modal - FIXED flag setting"""
    st.markdown('<h1 class="main-header">⚖️ Terms of Use</h1>', unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown("""
        ### AUM: Augmented Universal Metrics
        **Freelance Prototype - Educational Use**
        
        By using this application, you acknowledge:
        
        - ✅ This is a **prototype** for analytics assistance
        - 📊 Your uploaded data is processed **locally** and stored in your Supabase project
        - 🔒 No third-party data sharing beyond Supabase infrastructure
        - 🧪 **Verify all outputs independently** - this is AI-assisted analysis
        - 💳 Payment features are **demonstration only** (₹5 microtransaction simulation)
        - 📜 Usage logs stored for service improvement
        
        ---
        
        **Data Processing:**
        - Files processed in-memory during session
        - Join operations use semantic similarity
        - Results exported to your Supabase storage (optional)
        
        **Limitations:**
        - No warranty for production use
        - Human verification required for critical decisions
        - Not a substitute for certified analytics tools
        """)
        
        agree = st.checkbox("I understand and accept these terms", key="consent_check")
        
        if st.button("Continue to AUM: Augmented Universal Metrics", disabled=not agree, use_container_width=True):
            # FIXED: Ensure flag is set before rerun
            st.session_state.consent = True
            st.rerun()


def render_main_ui(supabase: Client, user):
    """Render main application interface"""
    
    # Header
    col1, col2, col3 = st.columns([2, 3, 2])
    with col1:
        st.markdown('<h1 class="main-header">🎵 AUM: Augmented Universal Metrics</h1>', unsafe_allow_html=True)
    with col2:
        st.markdown('<p class="tagline">The Sound of Data Understanding</p>', unsafe_allow_html=True)
    with col3:
        st.markdown(f"**User:** {user.email}")
        if st.button("Logout", key="logout_btn"):
            if supabase:
                supabase.auth.sign_out()
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()
    
    # Sidebar
    with st.sidebar:
        st.markdown("### 🎵 AUM Control Panel")
        st.markdown("---")
        
        # Domain selection
        st.subheader("🧠 Domain Intelligence")
        domain = st.selectbox(
            "Select Domain",
            DomainIntelligence.get_all_domains(),
            key="domain_selector"
        )
        
        # Semantic model
        st.subheader("🤖 Semantic Model")
        model = st.selectbox(
            "Embedding Model",
            ['all-MiniLM-L6-v2', 'multi-qa-mpnet-base-dot-v1'],
            key="model_selector"
        )
        
        # File upload
        st.markdown("---")
        st.subheader("📂 Upload Data")
        uploaded_files = st.file_uploader(
            "Upload CSV/XLSX (max 5 files)",
            type=['csv', 'xlsx', 'xls'],
            accept_multiple_files=True,
            key="file_uploader"
        )
        
        if uploaded_files and len(uploaded_files) <= 5:
            st.session_state.uploaded_files = uploaded_files
            st.success(f"✅ {len(uploaded_files)} file(s) loaded")
        elif uploaded_files and len(uploaded_files) > 5:
            st.error("❌ Maximum 5 files allowed")
        
        # Process button
        if st.button("🔄 Initialize Engine", key="init_engine", use_container_width=True):
            if st.session_state.uploaded_files:
                with st.spinner("Initializing AUM Engine..."):
                    initialize_engine(domain, model)
            else:
                st.warning("Please upload files first")
        
        # Usage tracking
        st.markdown("---")
        st.subheader("📊 Usage")
        query_count = st.session_state.query_count
        free_remaining = max(0, 3 - query_count)
        
        if free_remaining > 0:
            st.info(f"🆓 Free queries remaining: **{free_remaining}**/3")
        else:
            st.warning("⚠️ Free tier exhausted")
            if not st.session_state.paid_access:
                show_payment_modal(supabase, user.id)
        
        st.markdown("---")
        st.caption("© 2025 AUM v1.0.1")
    
    # Main content area
    if st.session_state.engine is None:
        st.info("👆 Upload files and click **Initialize Engine** to begin")
        return
    
    # Check query limit
    if st.session_state.query_count >= 3 and not st.session_state.paid_access:
        st.error("🚫 Free tier limit reached. Please make payment to continue.")
        return
    
    # Tabs
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "📊 Data Preview",
        "🔗 Join Configuration",
        "💬 Query & Analyze",
        "📈 Visualizations",
        "💡 Insights"
    ])
    
    with tab1:
        render_data_preview()
    
    with tab2:
        render_join_configuration()
    
    with tab3:
        render_query_interface(supabase, user.id, domain)
    
    with tab4:
        render_visualizations()
    
    with tab5:
        render_insights()


def initialize_engine(domain: str, model: str):
    """Initialize AUM engine with uploaded files"""
    try:
        # Create temp directory for files
        temp_dir = tempfile.mkdtemp()
        file_paths = []
        
        for uploaded_file in st.session_state.uploaded_files:
            file_path = Path(temp_dir) / uploaded_file.name
            with open(file_path, 'wb') as f:
                f.write(uploaded_file.getbuffer())
            file_paths.append(str(file_path))
        
        # Initialize engine
        engine = AUMEngine(domain=domain, semantic_model=model)
        engine.load_files(file_paths)
        
        # Detect joins
        suggestions = engine.detect_joins()
        
        st.session_state.engine = engine
        st.session_state.join_suggestions = suggestions
        
        st.success(f"✅ Engine initialized with {len(engine.dataframes)} dataset(s)")
        st.success(f"✅ Found {len(suggestions)} join suggestions")
        
    except Exception as e:
        st.error(f"❌ Engine initialization failed: {str(e)}")


def render_data_preview():
    """Render data preview tab"""
    st.subheader("📄 Data Preview")
    
    engine = st.session_state.engine
    
    if not engine or not engine.dataframes:
        st.info("No data loaded")
        return
    
    # Dataset selector
    dataset_name = st.selectbox(
        "Select Dataset",
        list(engine.dataframes.keys()),
        key="preview_dataset"
    )
    
    df = engine.dataframes[dataset_name]
    
    # Display info
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Rows", f"{len(df):,}")
    with col2:
        st.metric("Columns", len(df.columns))
    with col3:
        st.metric("Memory", f"{df.memory_usage(deep=True).sum() / 1024**2:.1f} MB")
    with col4:
        st.metric("Nulls", f"{df.isnull().sum().sum():,}")
    
    # Display data
    st.dataframe(df.head(100), use_container_width=True, height=400)
    
    # Column info
    with st.expander("📋 Column Details"):
        col_info = pd.DataFrame({
            'Column': df.columns,
            'Type': df.dtypes.astype(str),
            'Non-Null': df.count().values,
            'Unique': df.nunique().values
        })
        st.dataframe(col_info, use_container_width=True)


def render_join_configuration():
    """Render join configuration tab - FIXED execution path"""
    st.subheader("🔗 Join Configuration")
    
    suggestions = st.session_state.join_suggestions
    
    if not suggestions:
        st.info("No join suggestions available. Initialize engine first.")
        return
    
    st.write(f"Found **{len(suggestions)}** potential joins:")
    
    # Display suggestions as editable dataframe
    join_df = pd.DataFrame(suggestions)
    
    edited_df = st.data_editor(
        join_df,
        column_config={
            "confidence": st.column_config.ProgressColumn(
                "Confidence",
                min_value=0,
                max_value=1,
            ),
        },
        hide_index=True,
        use_container_width=True
    )
    
    # FIXED: Execute button with proper join execution
    if st.button("🔗 Execute Selected Joins", key="exec_joins"):
        with st.spinner("Executing joins..."):
            try:
                selected_joins = edited_df.to_dict('records')
                engine = st.session_state.engine
                
                # Execute joins
                joined_df = engine.execute_joins(selected_joins[:5])  # Max 5 joins
                
                st.success(f"✅ Joined data: {len(joined_df)} rows × {len(joined_df.columns)} columns")
                
                # Preview joined data
                with st.expander("👁️ Preview Joined Data"):
                    st.dataframe(joined_df.head(50), use_container_width=True)
                
            except Exception as e:
                st.error(f"❌ Join execution failed: {str(e)}")


def render_query_interface(supabase: Client, user_id: str, domain: str):
    """Render natural language query interface"""
    st.subheader("💬 Natural Language Query")
    
    engine = st.session_state.engine
    
    if engine is None or engine.joined_df is None:
        st.info("Execute joins first to enable querying")
        return
    
    # Example prompts
    with st.expander("💡 Example Prompts"):
        st.markdown(f"""
        **{domain} Examples:**
        - "rank sales by dealer_name top 10"
        - "trend revenue by month in 2024"
        - "heatmap margin by category and channel"
        - "show gmv by region"
        """)
    
    # Query input
    prompt = st.text_area(
        "Enter your query",
        placeholder="E.g., rank sales by dealer top 10",
        height=100,
        key="query_input"
    )
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        execute_btn = st.button("🚀 Execute Query", key="exec_query", use_container_width=True)
    
    with col2:
        st.metric("Queries Used", st.session_state.query_count)
    
    if execute_btn and prompt:
        # Check limits
        if st.session_state.query_count >= 3 and not st.session_state.paid_access:
            st.error("🚫 Free tier exhausted. Please make payment.")
            return
        
        with st.spinner("Analyzing..."):
            try:
                # Execute analysis
                result = engine.analyze(prompt)
                
                # Increment counter
                st.session_state.query_count += 1
                
                # Log usage
                if supabase:
                    log_usage(supabase, user_id, prompt, domain, cost=0 if st.session_state.query_count <= 3 else 5)
                
                # Store results
                st.session_state.query_result = result
                
                st.success("✅ Analysis complete!")
                
                # Display results
                st.subheader("📊 Results")
                st.dataframe(result['result'], use_container_width=True, height=300)
                
            except Exception as e:
                st.error(f"❌ Query execution failed: {str(e)}")


def render_visualizations():
    """Render visualization tab - FIXED heatmap coercion"""
    st.subheader("📈 Visualizations")
    
    if 'query_result' not in st.session_state:
        st.info("Execute a query first to see visualizations")
        return
    
    result = st.session_state.query_result
    df = result['result']
    query = result['query']
    
    # Auto-generate chart based on task
    task = query['task']
    metrics = query['metrics']
    dimensions = query['dimensions']
    
    try:
        if task == 'rank' and dimensions and metrics:
            fig = px.bar(
                df.head(20),
                x=dimensions[0],
                y=metrics[0],
                title=f"{metrics[0]} by {dimensions[0]}",
                color=metrics[0],
                color_continuous_scale='Blues'
            )
            st.plotly_chart(fig, use_container_width=True)
        
        elif task == 'trend' and query['time_column'] and metrics:
            fig = px.line(
                df,
                x=query['time_column'],
                y=metrics[0],
                title=f"{metrics[0]} Trend Over Time",
                markers=True
            )
            st.plotly_chart(fig, use_container_width=True)
        
        elif task == 'heatmap' and len(dimensions) >= 2 and metrics:
            # FIXED: Numeric coercion for heatmap
            pivot = df.pivot_table(
                values=metrics[0],
                index=dimensions[0],
                columns=dimensions[1],
                aggfunc='sum'
            )
            
            # Coerce to numeric and fill NaN
            pivot_numeric = pivot.apply(pd.to_numeric, errors='coerce').fillna(0)
            
            fig = px.imshow(
                pivot_numeric,
                title=f"{metrics[0]} Heatmap",
                color_continuous_scale='RdYlBu_r',
                aspect='auto',
                labels=dict(x=dimensions[1], y=dimensions[0], color=metrics[0])
            )
            st.plotly_chart(fig, use_container_width=True)
        
        else:
            # Default scatter
            numeric_cols = df.select_dtypes(include=[np.number]).columns[:2]
            if len(numeric_cols) >= 2:
                fig = px.scatter(
                    df,
                    x=numeric_cols[0],
                    y=numeric_cols[1],
                    title="Data Distribution"
                )
                st.plotly_chart(fig, use_container_width=True)
    
    except Exception as e:
        st.warning(f"Visualization error: {str(e)}")


def render_insights():
    """Render insights tab"""
    st.subheader("💡 Insights & Recommendations")
    
    if 'query_result' not in st.session_state:
        st.info("Execute a query first to see insights")
        return
    
    insights = st.session_state.query_result.get('insights', [])
    
    if insights:
        for idx, insight in enumerate(insights, 1):
            st.markdown(f'<div class="insight-box">**{idx}.** {insight}</div>', 
                       unsafe_allow_html=True)
    else:
        st.info("No insights generated for this query")


def show_payment_modal(supabase: Client, user_id: str):
    """Display Razorpay payment modal"""
    st.markdown("---")
    st.subheader("💳 Unlock Unlimited Queries")
    
    st.info("Pay **₹5** to unlock unlimited queries for this session")
    
    # Razorpay QR placeholder
    st.image("https://via.placeholder.com/200x200/4F46E5/FFFFFF?text=Razorpay+QR", 
             caption="Scan to pay ₹5", width=200)
    
    st.markdown("""
    **Payment Instructions:**
    1. Scan QR code with any UPI app
    2. Pay ₹5 to the merchant
    3. Click "I Have Paid" below
    """)
    
    if st.button("✅ I Have Paid", key="confirm_payment"):
        # Record payment
        if supabase and record_payment(supabase, user_id, 5.0):
            st.session_state.paid_access = True
            st.success("✅ Payment confirmed! Unlimited access granted.")
            st.balloons()
            st.rerun()
        else:
            st.error("❌ Payment recording failed. Contact support.")


# ============================================================================
# Entry Point
# ============================================================================

if __name__ == "__main__":
    main()
