# Context Information Model (CIM) Architecture

## Overview
The **Context Information Model (CIM)** is AUM Context Foundry's proprietary data structure. It represents the "Ground Truth" of an enterprise organization, distilled from noisy, unstructured corporate assets (PDFs, URLs, internal wikis) into a mathematically verifiable, LLM-optimized format.

The primary goal of the CIM is to serve as an irrefutable anchor against which external AI hallucinatory drift can be measured and remediated.

## The Transformation Workflow

The generation and application of the CIM follows a strict, zero-retention data flow:

### 1. Ingestion & Volatile Processing
- **Input**: Enterprise artifacts (e.g., Marketing PDFs, Product Specs) are uploaded via the Semantic Ingestion dashboard.
- **Volatile Parsing**: The payload is read into volatile RAM by `PyMuPDF4LLM`. Raw physical files are never written to disk, ensuring strict compliance with enterprise data policies.
- **Extraction**: Text, metadata, and document hierarchies are parsed out.

### 2. Semantic Chunking & Vectorization
- **Chunking**: The extracted text undergoes recursive character splitting to create overlapping semantic windows.
- **Embedding**: Using `text-embedding-3-small`, these chunks are projected into a 1536-dimensional hyper-space.

### 3. CIM Synthesis & JSON-LD Generation
- **Synthesis**: The unified metadata, hierarchical text, and dense vectors form the core CIM.
- **Serialization**: The semantic structure is compiled into a standardized `JSON-LD` (JavaScript Object Notation for Linked Data) schema.
- **Commit**: The vectors and the JSON-LD schema are transacted atomically into the organization's segregated Firebase NoSQL enclave. Raw memory buffers are immediately purged (`gc.collect()`).

## System Interactions

### Forward-Facing (Crawler & Agent Ingestion)
The CIM is automatically synthesized into the `/llms.txt` manifesto. When SearchGPT, Perplexity, or Anthropic crawlers index the organization's domain:
1. They parse the `/llms.txt`.
2. They pull the structured JSON-LD derived from the CIM.
3. The brand's verified context overrides out-of-date or hallucinated training data residing in the model's weights.

### Backward-Facing (LCRS Evaluation)
When running the Co-Intelligence Simulator:
1. Prompts are dispatched concurrently to multiple frontier models using keys automatically provisioned per-tenant.
2. The AI responses are converted into atomic claims.
3. The claims are cross-referenced (via semantic cosine similarity) backward against the organization's CIM embeddings.
4. If a claim deviates significantly from the CIM vectors, a "Context Drift" or "Hallucination" error is flagged.

## Billing & Infrastructure Note
To ensure seamless orchestration of the CIM pipeline and LCRS audits, infrastructure credentials for inference (e.g., OpenAI, Gemini, Anthropic) are fully abstracted from the user. 
- **No BYOK**: Organizations do not supply API keys to the frontend.
- **Transparency**: Dedicated sub-keys and execution quotas are provisioned automatically during tenant creation, ensuring secure isolation and explicit billing transparency for enterprise deployments.
