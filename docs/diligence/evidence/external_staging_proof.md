# Hard Evidence: External Staging Verification
**Scenario**: Remote verification of the hosted Cloud Run production environment.
**Captured**: 2026-03-07 01:23:02 UTC
**Environment**: `production`
**Service URL**: `https://aum-api-sgjqvkgxzq-as.a.run.app`

## Evidence Classification
> [!NOTE]
> This is a **Level 4 (External)** artifact. Unlike local repo traces, this evidence was captured by querying the actual Google Cloud infrastructure.

## Raw Data Link
[Hosted Cloud Run Trace (JSON)](raw/external_staging_trace.json)

## Live Response Headers
```http
HTTP/2 200 OK
content-type: application/json
x-cloud-trace-context: 5e73705601e4f085834505c4dd56f1a8
server: Google Frontend
date: Sat, 07 Mar 2026 01:23:02 GMT
```

## Payload Verification
The hosted system successfully generated a masked SSO intent token:
```json
{
  "success": true,
  "intent_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJv...vlA",
  "provider_name": "Enterprise IDP"
}
```

---
*AUM Diligence Evidence Layer: Cloud Run Verification*
