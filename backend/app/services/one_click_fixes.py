# backend/app/services/one_click_fixes.py
class OneClickFixes:
    """Execute one-click fix actions"""
    
    def apply_fix(self, fix_type: str, df: pd.DataFrame, params: dict):
        """Apply a one-click fix"""
        
        if fix_type == 'drill_down':
            column = params.get('column')
            return df.groupby(['date', column]).sum().reset_index()
        
        elif fix_type == 'export_low_stock':
            stock_col = params.get('stock_column', 'stock')
            low_stock = df[df[stock_col] < params.get('threshold', 10)]
            return low_stock[['sku', stock_col, 'reorder_level']]
        
        elif fix_type == 'analyze_returns':
            returns = df[df['returns'] > 0]
            return returns.groupby('sku')[['returns', 'orders']].sum()
        
        elif fix_type == 'customer_analysis':
            top_customers = df.groupby('customer_id')['revenue'].sum().nlargest(20)
            return top_customers.reset_index()
        
        return df