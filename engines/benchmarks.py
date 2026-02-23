# engines/benchmarks.py
DOMAIN_SIGNATURES = {}  # placeholder; primary signatures sit in domain_engine

INDUSTRY_BENCHMARKS = {
    "ecommerce": {
        "conversion_rate": {"excellent":3.5,"good":2.5,"average":1.5,"poor":1.0},
        "return_rate": {"excellent":5,"good":10,"average":15,"poor":20},
        "aov": {"unit":"₹","excellent":2000,"good":1500,"average":1000,"poor":500}
    },
    "manufacturing": {"oee":{"excellent":85,"good":70,"average":60,"poor":50},"defect_rate":{"excellent":1,"good":2,"average":3,"poor":5}},
    "retail": {"conversion_rate":{"excellent":25,"good":20,"average":15,"poor":10}},
    "finance": {"npa_rate":{"excellent":1.5,"good":2.5,"average":4.0,"poor":6.0}}
}
