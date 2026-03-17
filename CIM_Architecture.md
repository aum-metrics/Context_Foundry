# AUM Context Foundry — CIM Architecture
**Context Information Model — Technical Design**
**v5.1.0-v1.2.6 | March 2026**

---

## What is the CIM?

The **Context Information Model (CIM)** is the mathematical and semantic representation of an organization's verified ground truth. It is the core data structure that powers the Visibility Score evaluation engine — the authoritative source that AI responses are measured against.

Think of it as:
> "A compressed, mathematically indexed copy of everything your brand wants to be known for — stored in a form that can be compared to anything an AI model says."

---

## CIM Anatomy

```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "name": "Product Specification v3.0",
  "description": "AUM Context Foundry real-time evaluation platform features...",
  "keywords": ["Visibility Score", "zero-retention", "AI search presence", "context drift"],
  "datePublished": "2026-03-02T00:00:00Z",
  "version": "1.0.0",
  "totalChunks": 42,
  "embedding": [0.0021, -0.0411, 0.0093, ...],  // 1536-dimensional vector
  "chunks": [...]  // Sub-collection of chunked embeddings
}
```

Every CIM document has:
1. **JSON-LD Schema** — structured, machine-readable identity (who, what, keywords).
2. **Document-level Embedding** — 1536-dimensional vector (text-embedding-3-small) of the full document summary.
3. **Chunk Embeddings** — individual embeddings for each semantic chunk, stored in the `chunks` sub-collection.

---

## CIM Build Pipeline

```
Raw PDF
   │
   ▼
[PyMuPDF4LLM]
   Extract markdown structure from PDF binary
   Process entirely in volatile RAM
   ──────────────────────────────────────────
   del content; gc.collect()   ← Raw file purged here
   │
   ▼
[recursive_split()]
   max_size: 2000 characters
   overlap_size: 200 characters
   Priority split points: "\n\n" → ". " → " "
   │
   ├──[chunks] → parallel embedding (OpenAI text-embedding-3-small)
   │             16 chunks per API call (batched)
   │
   └──[full doc summary] → GPT-4o JSON-LD extraction
                            Schema type: TechArticle / FAQPage / Product
   │
   ▼
[Firestore Atomic Transaction]
   organizations/{orgId}/manifests/latest  ← pointer
   organizations/{orgId}/manifests/{id}    ← versioned CIM doc
   organizations/{orgId}/manifests/{id}/chunks/{i}  ← chunk embeddings
   │
   ▼
[Audit Log]
   organizations/{orgId}/auditLogs/{auto_id}
   { eventType: "document_ingestion", resourceId: manifestId }
```

---

## Key Design Properties

### Zero-Retention
The raw document binary is **never written to disk or external storage**. It is:
1. Received as a byte stream in memory.
2. Processed by PyMuPDF4LLM in-memory.
3. Explicitly deleted (`del content`).
4. **24-Hour TTL Assigned**: The resulting manifest is assigned an `expiresAt` timestamp and automatically purged by Firestore after 24 hours.
5. Python garbage collected (`gc.collect()`).

Only the mathematical embeddings and JSON-LD schema are persisted.

### Versioning
Every ingestion creates a new versioned manifest document:
- `organizations/{orgId}/manifests/{timestamp_hash}` — the full versioned CIM.
- `organizations/{orgId}/manifests/latest` — a pointer document updated atomically.

Simulations default to `manifestVersion: "latest"` but can target historic versions.

### Chunking Strategy
```
recursive_split(text, max_size=2000, overlap_size=200)
```
Split hierarchy (in priority order):
1. Double newline (`\n\n`) — paragraph boundaries.
2. Period-space (`. `) — sentence boundaries.
3. Space — word boundaries (last resort).

Overlap ensures semantic continuity across chunk boundaries.

### Plan Limits
```
Explorer:  1 manifest document allowed
Growth:    Unlimited manifest ingestion
Scale:     Unlimited manifest ingestion
Enterprise: Unlimited manifest ingestion (admin-managed tenant)
```
Limit check queries the `manifests` collection document count (not `documents`).

---

## How the Visibility Scoring Engine Uses the CIM

### At Simulation Time

```
1. Fetch organizations/{orgId}/manifests/latest
   → manifest_content (JSON-LD text)
   → manifest_embedding (1536-dim vector)

2. Run user prompt through all active LLM providers concurrently

3. For each LLM response:
   a. Extract atomic claims via GPT-4o
   b. Embed the response (text-embedding-3-small)
   c. Compare claim embeddings against manifest_embedding (cosine similarity)
   d. Verify claim support: does the CIM ground truth support this claim?

4. Score:
   claim_accuracy = supported_claims / total_claims      (0.0–1.0)
   semantic_fidelity = 1.0 - cosine_divergence           (0.0–1.0)
   lcrs_score = (claim_accuracy × 0.6 + semantic_fidelity × 0.4) × 100

5. Grade:
   > 85   → "high_fidelity"
   60–85  → "minor_drift"  
   < 60   → "drift_detected"
```

### Caching (Zero-Burn v2)
```
cache_key = SHA-256(orgId + prompt + manifestVersion)
cache_doc = organizations/{orgId}/simulationCache/{cache_key}
TTL: 24 hours
```
Cache is checked using a deterministic SHA-256 hash of the request signature. Serves results in <100ms.

---

## The `/llms.txt` Manifesto (Edge Syndication)

The CIM is synthesized into an AI-crawler-friendly manifesto:

```
# [Organization Name] — AUM Context Foundry

## Ground Truth
[Synthesized description from JSON-LD CIM]

## Verified Claims
[Key facts extracted from manifests]

## Links
- /: Homepage
- /privacy: Zero-Retention Compliance
```

Served at `/llms.txt?orgId=...` from the Next.js edge, fetched from the backend which uses Firebase Admin SDK (bypasses client Firestore auth rules). Cached for 1 hour at the CDN layer. It is a machine-readable context artifact, not a guarantee that any external model will prioritize the tenant narrative.

---

## Firestore Schema (Complete)

```
organizations/{orgId}/manifests/
  latest/
    content: string (JSON-LD)
    embedding: number[] (1536)
    version: string
    createdAt: timestamp
    totalChunks: number

  {manifestId}/
    content: string (JSON-LD)
    embedding: number[] (1536)
    version: string
    createdAt: timestamp
    totalChunks: number
    chunks/
      {i}/
        text: string
        embedding: number[] (1536)
        index: number

organizations/{orgId}/simulationCache/
  {sha256_hash}/
    prompt: string
    results: object
    timestamp: timestamp
```

---

*AUM Context Foundry — CIM Architecture v5.1.0*


## Update: 2026-03-17
- Quick Scan edge proxy returns a demo fallback on upstream 5xx to avoid blank/failed landing scans.
- Release checklist added at docs/RELEASE_CHECKLIST.md.
- Workspace health endpoint (GET /api/workspaces/health) added for uptime checks.
- Prompt sanitization now strips <script> tags and ignores non-string input safely.
- Quick Scan landing page validates scan responses and handles non-200 errors to avoid invalid date/blank score rendering.
- Quick Scan public endpoint (`/api/quick-scan`) uses a platform OpenAI key with per-IP rate limiting.
- Competitor displacement API is gated to Growth/Scale/Enterprise plans.
- Simulation quota reservation uses sharded counters (`usageReservations`) to reduce org doc contention.
- Pricing defaults: Growth ₹6,499/mo, Scale ₹20,999/mo (Razorpay plan amounts).
- Default support email: hello@aumcontextfoundry.com (white-label config).

