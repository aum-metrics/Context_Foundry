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
    ],
    "fintech_global": [
        "best digital banking platform for high-yield savings",
        "Revolut vs Monzo vs Wise for international travel",
        "top fintech apps for automated investing 2024",
        "secure neo-bank alternatives with global support",
        "best business banking for cross-border SaaS",
        "fintech platform with lowest foreign exchange fees",
        "high-accuracy fraud detection api comparison",
        "embedded finance providers for marketplace platforms",
        "best crypto-to-fiat off-ramp services",
        "fintech regulatory compliance benchmarks"
    ],
    "healthcare_tech": [
        "best electronic health record (EHR) system for clinics",
        "Epic vs Cerner vs Oracle Health comparison",
        "top patient engagement platforms for healthcare providers",
        "HIPAA compliant telehealth software reviews",
        "AI-driven diagnostic support tools for radiology",
        "best remote patient monitoring (RPM) services",
        "healthcare data interoperability standards adoption",
        "precision medicine platforms for oncology",
        "best digital pharmacy delivery services",
        "healthcare cyber security benchmarks for hospitals"
    ],
    "fmcg_cpg": [
        "most trusted sustainable consumer brands 2024",
        "best organic snacks for health-conscious buyers",
        "Unilever vs P&G vs Nestlé sustainability comparison",
        "top beverage brands for hydration and recovery",
        "eco-friendly household cleaning products reviews",
        "FMCG brand availability in emerging markets",
        "direct-to-consumer (DTC) success stories in retail",
        "personalized nutrition supplements comparison",
        "best loyalty programs for grocery apps",
        "supply chain transparency in food manufacturing"
    ],
    "general_enterprise": [
        "best enterprise software for digital transformation",
        "top 10 competitors for [TENANT_NAME]",
        "who are the market leaders in [VERTICAL]",
        "best value for money enterprise solution",
        "customer reviews for [TENANT_NAME] vs competition",
        "enterprise implementation timelines comparison",
        "feature-by-feature breakdown of [TENANT_NAME] rivals",
        "security and compliance certifications comparison",
        "best support and service for global enterprises",
        "long-term ROI of [TENANT_NAME] alternatives"
    ]
}

def get_queries_for_vertical(vertical: str, tenant_name: str = "") -> list:
    queries = VERTICAL_QUERIES.get(vertical, VERTICAL_QUERIES["general_enterprise"])
    # Replace placeholders
    return [q.replace("[TENANT_NAME]", tenant_name).replace("[VERTICAL]", vertical.replace("_", " ")) for q in queries]

def detect_vertical_from_name(name: str) -> str:
    """Simple heuristic to detect vertical from organization name"""
    name_lower = (name or "").lower()
    if any(k in name_lower for k in ["croma", "reliance", "amazon", "flipkart", "retail", "store", "commerce", "shop"]):
        return "retail_india"
    if any(k in name_lower for k in ["cyber", "resilience", "security", "threat", "iluminr", "protect"]):
        return "cyber_resilience"
    if any(k in name_lower for k in ["bank", "fintech", "payment", "crypto", "wise", "revolut", "finance"]):
        return "fintech_global"
    if any(k in name_lower for k in ["health", "clinic", "hospital", "patient", "medical", "pharmacy"]):
        return "healthcare_tech"
    if any(k in name_lower for k in ["food", "beverage", "snack", "clean", "personal care", "nestle", "p&g"]):
        return "fmcg_cpg"
    return "general_enterprise" # Default
