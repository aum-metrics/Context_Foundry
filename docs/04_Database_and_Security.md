# AUM Context Foundry: Database & Security Model

**Target Audience:** Security Engineers, DevOps Interns, Backend Developers
**Prerequisites:** Understanding of NoSQL, JSON, and basic Identity Access Management (IAM).
**Last Updated:** March 2026 | Reflects hardening passes 1-5.

---

## 1. The NoSQL Philosophy (Firestore)

AUM Context Foundry runs on Google Cloud Firestore, a highly scalable NoSQL document database. 
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
3.  **Role Access:** If you are a `member` (not an `admin`), the rules **physically block** you from reading or writing the `payments` subcollections.

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

## 5. Security Vulnerability: The "Mock Token" Bypass

During early development, engineers used a "mock token" (`mock-dev-token`) to bypass logging into Google Firebase constantly. 

**The P0 Incident it Caused:** If the app was accidentally deployed with `ENV="development"`, anyone on the public internet could send `Authorization: Bearer mock-dev-token` and gain full admin access to the entire database.

### How We Fixed It (The Hardening)
The mock token bypass is now **double-gated** and safe:

1. `backend/app/core/config.py` defaults `ENV = "production"`. Mock auth requires `ENV=development`.
2. `backend/app/core/config.py` defaults `ALLOW_MOCK_AUTH = False`. Mock auth requires this to be `True`.
3. `security.py` checks BOTH conditions:
    ```python
    if token == "mock-dev-token":
        if settings.ENV == "development" and allow_mock:
            return MOCK_USER  # Only in explicit dev mode
        else:
            logger.critical("🛑 SECURITY BREACH ATTEMPT: mock-dev-token used in production")
            raise HTTPException(status_code=401)
    ```
4. In production, attempts to use mock tokens trigger a `CRITICAL` log entry and `401` rejection.
5. The Pydantic `Settings.__init__` validator crashes if dev defaults for `JWT_SECRET` or `SSO_ENCRYPTION_KEY` are used in production.
6. The startup gate in `main.py` crashes if any required API keys are missing in production.

---

## 6. Firestore Indexing (Why your queries fail)

If you write a new query in the backend:
`db.collection("batchJobs").where("status", "==", "pending").order_by("createdAt").limit(10)`

It will fail with a `FailedPrecondition` error. 

### Why?
Firestore does not scan tables (O(n)). It uses massive indexing trees (O(log n)). If you query multiple fields at once (like `status` AND `createdAt`), you must tell Google to build an index.

### The Fix
When it fails, the error message in the terminal will include a blue URL. 
Click that URL to automatically build the exact index. 

### Mandatory Production Indexes (`firestore.indexes.json`)
You must deploy the composite indexes via `firebase deploy --only firestore:indexes` before going live. The most critical one is the Team Invitation auto-join query:

**Collection**: `users`
- Field: `email` (Ascending)
- Field: `status` (Ascending)

Without this index, the backend will fail with a `FailedPrecondition` when users attempt to accept team invites (`/api/workspaces/provision`), causing silent failures in production.

*Proceed to Guide 05: Administrator & Operations Runbook.*
