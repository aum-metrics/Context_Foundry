# backend/app/services/smart_alerts.py
# app/api/alerts.py

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class AlertFixRequest(BaseModel):
    fix_type: str
    params: dict | None = None

@router.post("/alerts/apply-fix")
async def apply_fix(req: AlertFixRequest):
    # Placeholder logic — replace with actual fixing logic
    return {
        "success": True,
        "message": f"Applied fix: {req.fix_type}",
        "params_used": req.params
    }
class SmartAlertEngine:
    """
    Proactive monitoring and alerts
    """
    
    def detect_anomalies(self, df, historical_data=None):
        """Detect unusual patterns"""
        alerts = []
        
        # 1. Sudden drops/spikes
        for col in df.select_dtypes(include=['number']).columns:
            recent_avg = df[col].tail(7).mean()
            overall_avg = df[col].mean()
            
            if recent_avg < overall_avg * 0.7:  # 30% drop
                alerts.append({
                    'type': 'CRITICAL',
                    'title': f'Unusual drop in {col}',
                    'impact': f'{col} dropped 30% below average',
                    'recommendation': f'Investigate {col} decline',
                    'one_click_fix': f'drill_down:{col}'
                })
        
        # 2. Inventory alerts (for ecommerce)
        if 'stock' in df.columns or 'inventory' in df.columns:
            stock_col = 'stock' if 'stock' in df.columns else 'inventory'
            low_stock = df[df[stock_col] < 10]
            
            if len(low_stock) > 0:
                alerts.append({
                    'type': 'WARNING',
                    'title': f'{len(low_stock)} SKUs low on stock',
                    'impact': 'Potential stockouts',
                    'recommendation': 'Reorder inventory',
                    'one_click_fix': 'export_low_stock',
                    'affected_items': low_stock['sku'].tolist() if 'sku' in low_stock.columns else []
                })
        
        # 3. Return rate alerts
        if 'returns' in df.columns and 'orders' in df.columns:
            return_rate = (df['returns'].sum() / df['orders'].sum()) * 100
            if return_rate > 15:
                alerts.append({
                    'type': 'CRITICAL',
                    'title': f'High return rate: {return_rate:.1f}%',
                    'impact': f'Return rate {return_rate - 15:.1f}% above threshold',
                    'recommendation': 'Analyze return reasons',
                    'one_click_fix': 'analyze_returns'
                })
        
        # 4. Revenue concentration
        if 'revenue' in df.columns and 'customer_id' in df.columns:
            top_10_rev = df.groupby('customer_id')['revenue'].sum().nlargest(10).sum()
            total_rev = df['revenue'].sum()
            concentration = (top_10_rev / total_rev) * 100
            
            if concentration > 50:
                alerts.append({
                    'type': 'WARNING',
                    'title': f'Revenue concentration risk: {concentration:.1f}%',
                    'impact': 'Top 10 customers drive majority of revenue',
                    'recommendation': 'Diversify customer base',
                    'one_click_fix': 'customer_analysis'
                })
        
        return alerts
    
    def suggest_joins(self, current_tables):
        """Suggest data enrichment via joins"""
        suggestions = []
        
        # Example: If has order data but no customer data
        if 'orders' in current_tables and 'customers' not in current_tables:
            suggestions.append({
                'type': 'JOIN',
                'title': 'Enrich with customer data',
                'impact': 'Get customer demographics and behavior',
                'one_click_fix': 'apply_join:customer_master'
            })
        
        return suggestions