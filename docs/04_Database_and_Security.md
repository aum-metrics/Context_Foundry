# Context Foundry: Database & Security Model

**Target Audience:** Security Engineers, DevOps Interns, Backend Developers
**Prerequisites:** Understanding of NoSQL, JSON, and basic Identity Access Management (IAM).

---

## 1. The NoSQL Philosophy (Firestore)

Context Foundry runs on Google Cloud Firestore, a highly scalable NoSQL document database. 
If you learned SQL (PostgreSQL, MySQL) in college, you need to unlearn a few things:

1.  **No Joins:** You cannot `JOIN` the `users` collection with the `organizations` collection in a single query. You must make two separate fetches or duplicate the data (denormalization).
2.  **Schema-less:** Firestore does not enforce column types. The `backend/app/api/...` Python models (Pydantic) are responsible for enforcing data structure before it touches the database.
3.  **Shallow Queries:** If you fetch a document `organizations/acme`, it **does not** fetch the subcollections inside it (like `organizations/acme/scoringHistory`). Subcollections require their own dedicated queries.

---

## 2. Global Firestore Schema Mapping

This is the exact structure of our production database.

### The Users Root (`/users/{uid}`)
*   **Purpose:** Maps a Google Firebase Auth JWT into our platform's logic.
*   **Fields:**
    *   `email` (string)
    *   `orgId` (string) - *The tenant they belong to.*
    *   `role` (string) - `"admin"` or `"member"`.
    *   `status` (string) - `"invited"`, `"active"`.

### The Organizations Root (`/organizations/{orgId}`)
*   **Purpose:** The Tenant. All billing, settings, and historical data descend from here.
*   **Fields:**
    *   `name` (string)
    *   `apiKeys` (object) - *Extremely sensitive. Contains `OPENAI_API_KEY`, etc.*
    *   `subscription` (object) - *Contains `planId`, `simsThisCycle`, `status`.*
*   **Subcollection: `/manifests/{manifestId}`**
    *   Contains the vector embeddings and raw text of the uploaded Context Documents.
*   **Subcollection: `/scoringHistory/{simulationId}`**
    *   The atomic ledger. Every time LCRS runs, it drops a JSON log here containing timestamps, formulas, and prompt traces. *Do not delete these; clients use them for auditing.*
*   **Subcollection: `/auditLogs/{logId}`**
    *   System immutability. If a user changes a setting, a read-only audit log is dropped here.

---

## 3. The "Fail-Closed" Security Posture

Most security breaches happen because a developer forgot to write a rule blocking access. **Fail-Closed** means that if no rule explicitly allows an action, the database physically rejects it.

### `firestore.rules` - The Vault Door
The `firestore.rules` file sits directly on Google Cloud. Even if our Python backend completely crashes or is bypassed, this file prevents hackers from stealing data by using the raw Firebase Javascript SDK.

**Core Rules:**
1.  **Authentication:** You must have a valid JWT token. `request.auth != null`.
2.  **Tenant Isolation:** You can only read `organizations/{orgId}` if your JWT token proves you belong to that `orgId`.
3.  **Role Access:** If you are a `member` (not an `admin`), the rules **physically block** you from reading or writing the `apiKeys` and `payments` subcollections.

**Example of our Enterprise Rule:**
```javascript
match /organizations/{orgId} {
    // Only users who belong to this org can even see the document
    allow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.orgId == orgId;
    
    // Only an ADMIN can update the organization settings
    allow update: if request.auth != null && 
                  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.orgId == orgId &&
                  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
}
```

---

## 4. API Key Protection (Redaction)

If a company trusts us with their $100,000/month OpenAI API key, we must protect it like nuclear launch codes.

### The Threat
A frontend intern writes `console.log(organization)` in `TeamSettings.tsx`. If the backend sent the raw organization JSON, that intern just leaked the client's OpenAI key to the browser console.

### The Backend Redaction Lock
Every time a Python route fetches an organization document, it MUST redact the keys before calling `return`.

```python
org_data = org_doc.to_dict()
api_keys = org_data.pop("apiKeys", {}) # Extracts the keys into memory, removes them from the dict

# Now it is safe to return org_data to the React frontend.
return org_data 
```

---

## 5. Security Vulnerability: The "Mock Token" Bypass

During early development, engineers used a "mock token" (`mock-dev-token`) to bypass logging into Google Firebase constantly. 

**The P0 Incident it Caused:** If the app was accidentally deployed with `ENV="development"`, anyone on the public internet could send `Authorization: Bearer mock-dev-token` and gain full admin access to the entire database.

### How We Fixed It (The Hardening)
1. `backend/app/core/config.py` now forces `ENV = "production"` by default unless explicitly overridden locally.
2. `security.py` now wraps the mock bypass in an explicit environment check:
    ```python
    if settings.ENV == "development" and token == "mock-dev-token":
        return MOCK_USER
    elif settings.ENV == "production" and token == "mock-dev-token":
        raise HTTPException(status_code=403, detail="CRITICAL: Mock tokens disabled in production")
    ```

---

## 6. Firestore Indexing (Why your queries fail)

If you write a new query in the backend:
`db.collection("batchJobs").where("status", "==", "pending").order_by("createdAt").limit(10)`

It will fail with a `FailedPrecondition` error. 

### Why?
Firestore does not scan tables (O(n)). It uses massive indexing trees (O(log n)). If you query multiple fields at once (like `status` AND `createdAt`), you must tell Google to build an index.

### The Fix
When it fails, the error message in the terminal will include a blue URL. 
Click that URL. It will take you to the Google Cloud Console and automatically build the exact index you need. It takes about 3 minutes to compile.

*Proceed to Guide 05: Administrator & Operations Runbook.*
