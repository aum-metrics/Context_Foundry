# backend/app/services/playbooks.py
DOMAIN_PLAYBOOKS = {
    'ecommerce': {
        'name': 'E-commerce Performance Playbook',
        'steps': [
            {
                'id': 'revenue_check',
                'title': 'Verify Revenue Trends',
                'description': 'Check if revenue is growing month-over-month',
                'query': 'trend revenue over time',
                'success_criteria': 'Revenue should grow >5% MoM',
                'chart_type': 'line'
            },
            {
                'id': 'return_rate',
                'title': 'Check Return Rate',
                'description': 'Ensure returns are below 15%',
                'query': 'sum of returns',
                'success_criteria': 'Return rate < 15%',
                'alert_threshold': 15
            },
            {
                'id': 'top_sellers',
                'title': 'Analyze Top Sellers',
                'description': 'Identify best performing products',
                'query': 'top 10 sku by revenue',
                'success_criteria': 'Top 10 contribute >40% revenue',
                'chart_type': 'bar'
            },
            {
                'id': 'aov_analysis',
                'title': 'Average Order Value',
                'description': 'Track AOV trends',
                'query': 'average order_value',
                'success_criteria': 'AOV > ₹1000',
                'benchmark': 1000
            }
        ]
    },
    'manufacturing': {
        'name': 'Manufacturing OEE Playbook',
        'steps': [
            {
                'id': 'oee_calc',
                'title': 'Calculate OEE',
                'description': 'Overall Equipment Effectiveness',
                'formula': '(availability * performance * quality) * 100',
                'success_criteria': 'OEE > 85%',
                'benchmark': 85
            },
            {
                'id': 'defect_rate',
                'title': 'Check Defect Rate',
                'description': 'Monitor quality metrics',
                'query': 'sum defects by line',
                'success_criteria': 'Defect rate < 2%',
                'alert_threshold': 2
            },
            {
                'id': 'downtime',
                'title': 'Analyze Downtime',
                'description': 'Identify bottlenecks',
                'query': 'top 5 machines by downtime',
                'success_criteria': 'Downtime < 10%'
            }
        ]
    },
    'retail': {
        'name': 'Retail Store Performance',
        'steps': [
            {
                'id': 'sales_per_store',
                'title': 'Sales by Store',
                'description': 'Compare store performance',
                'query': 'top 10 stores by sales',
                'chart_type': 'bar'
            },
            {
                'id': 'footfall',
                'title': 'Footfall Analysis',
                'description': 'Traffic to conversion ratio',
                'query': 'average footfall by store',
                'success_criteria': 'Conversion > 20%'
            }
        ]
    }
}