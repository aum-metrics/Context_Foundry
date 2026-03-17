# AUM Context Foundry - Admin RBAC Policy & Audit Framework

**Last Updated:** March 2026

## Overview
This document outlines the Role-Based Access Control (RBAC) policy, session lifecycle, and audit framework governing Administrative access to the AUM Context Foundry environment. It serves as formal evidence of our security posture for enterprise diligence and compliance requirements.

## 1. Authentication & Session Lifecycles
Administrative access strictly enforces Firebase Identity (IAM) token validation. No static credentials, fallback passwords, or shared secrets exist in our infrastructure.

**Session Controls:**
- **Provider:** Google Identity / Firebase Authentication.
- **Grant Mechanism:** Administrative privileges are granted exclusively via Firebase Custom Claims (`{"admin": true}`).
- **Token Expiry:** Firebase ID tokens expire automatically after 1 hour.
- **Session Enforcement:** Every administrative API request requires a valid, unexpired token passed via the `Authorization: Bearer` header or `X-Admin-Token` secure HTTPOnly cookie. The backend actively verifies the cryptographic signature of the token against Firebase JWKS on every single request.

## 2. Role-Based Access Control (RBAC)
AUM utilizes a strict least-privilege model separating standard tenant users from system administrators.

**Standard Users (Tenant Scope):**
- Can only read/write data within their explicitly assigned `org_id`.
- Tenant Admins can invite users to their specific workspace (cannot cross boundaries).

**System Administrators (Global Scope):**
- Must possess the `admin` custom claim.
- Grants read-only access to global organization metrics (billing status, seat counts).
- Grants write access strictly for infrastructure provisioning (API keys, generating payment links).
- *Cannot* read tenant-specific proprietary data, uploaded knowledge bases, or simulation outcomes.

## 3. Audit Logging & Non-Repudiation
All critical administrative actions are immutably logged to the `audit_logs` collection to ensure non-repudiation.

**Logged Events Include:**
- `admin_session_verified`: Recorded whenever an admin successfully authenticates and loads the dashboard.
- `admin_apikey_updated`: Recorded whenever an admin provisions or rotates a B2B infrastructure key (e.g., OpenAI, Anthropic, Gemini).
- `workspace_member_invited`: Recorded whenever an admin invites a new user to a tenant workspace.

**Audit Log Schema:**
```json
{
  "org_id": "system_admin",
  "actor_id": "admin_email@example.com",
  "event_type": "admin_apikey_updated",
  "resource_id": "openai",
  "metadata": {"action": "update_key"},
  "timestamp": "2026-03-03T12:00:00Z"
}
```

## 4. Key Rotation & Offboarding
- **Admin Offboarding:** Revoking admin access is performed by removing the `admin` custom claim in Firebase IAM. Existing tokens will be invalidated immediately.
- **API Key Rotation:** Admin UI provides self-service rotation of infrastructure API keys. Previous keys are instantly overwritten in Firestore without requiring environment redeploys.


## Update: 2026-03-17
- Quick Scan prompt tuned to reduce negative claims for strong brands; competitor tile label now adapts to score.
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

