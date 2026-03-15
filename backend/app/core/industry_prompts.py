"""
Industry-specific query suites for Automated Buyer-Intent Intelligence (Auto-Pilot).
Used to build instant competitive leaderboards without user prompting.
"""

VERTICAL_QUERIES = {
    "retail_india": [
        "best electronics store in India",
        "where to buy iPhone 16 in India",
        "Reliance Digital vs Croma vs Amazon India",
        "fastest electronics delivery India",
        "best store for home appliances in Bangalore",
        "laptops for sale near me India",
        "Croma electronics customer service reviews",
        "Tata brand trust electronics shopping",
        "buy macbook pro india online",
        "cheapest smartphone deals india",
        "best offline electronics showroom india",
        "Vijay Sales vs Croma comparisons",
        "Poorvika mobiles reviews",
        "electronics exchange offers india",
        "guaranteed genuine electronics india"
    ],
    "cyber_resilience": [
        "best cyber crisis simulation platform for banks",
        "Immersive Labs vs RangeForce vs iluminr",
        "tabletop crisis training software reviews",
        "enterprise cyber resilience training 2024",
        "incident response simulation automation",
        "regulatory compliance cyber training platform",
        "cyber crisis scenarios for executive boards",
        "iluminr cyber resilience reviews",
        "workforce cyber resilience benchmarking",
        "cyber training platform with automated scenario generation"
    ],
    "saas_enterprise": [
        "best crm for enterprise sales teams",
        "Salesforce vs HubSpot for 500+ employees",
        "top enterprise billing platforms 2024",
        "automated sales intelligence software for mid-market",
        "Stripe vs Adyen enterprise feature comparison",
        "enterprise marketing automation tools B2B",
        "best customer success platform for high-churn industries",
        "Zendesk vs Freshdesk enterprise scalability",
        "B2B SaaS visibility gaps identification",
        "enterprise AI software adoption benchmarks"
    ]
}

def get_queries_for_vertical(vertical: str) -> list:
    return VERTICAL_QUERIES.get(vertical, [])

def detect_vertical_from_name(name: str) -> str:
    """Simple heuristic to detect vertical from organization name"""
    name_lower = name.lower()
    if any(k in name_lower for k in ["croma", "reliance", "amazon", "flipkart", "retail", "store"]):
        return "retail_india"
    if any(k in name_lower for k in ["cyber", "resilience", "security", "threat", "iluminr"]):
        return "cyber_resilience"
    return "saas_enterprise" # Default
