# AUM Context Foundry: Troubleshooting & Incident Response

**Target Audience:** L1/L2 Support Interns, Developers
**Prerequisites:** Access to Google Cloud Console (Firestore, Cloud Run).
**Last Updated:** March 2026 | Reflects hardening passes 1-5.

---

## 1. Triage Mindset

When a customer reports a bug, never guess.
You must ask yourself two questions immediately:
1. Is this a **Frontend (React)** error or a **Backend (FastAPI)** error?
2. Did the request return a HTTP code? (`4xx` = Auth/Validation issue. `5xx` = Server Crash).

---

## 2. Authentication & Login Issues

### 2.1 "I can't log in. It says Invalid Credentials."
*   **Where to check:** Firebase Authentication Console.
*   **Fix:** If they forgot their password, send a password reset email via the Firebase UI. If they are using Google SSO, tell them to ensure they are using the correct corporate email.

### 2.2 "I logged in, but the screen is entirely blank white."
*   **Diagnosis:** This is a Frontend Hard Crash. A critical React component failed to render.
*   **Where to check:** Ask the user to right-click -> `Inspect Element` -> `Console` and screenshot the red text.
*   **Common Cause:** This happens when we try to render dynamic data that doesn't exist yet. For example, trying to map `organization.allowedDomains.map(...)` when `allowedDomains` is `undefined`.
*   **Fix:** The intern must add Optional Chaining (`?.`) to the frontend code: `organization?.allowedDomains?.map(...)`.

### 2.3 "I get a 403 Forbidden Error when running a simulation."
*   **Diagnosis:** The backend bouncer caught them.
*   **Cause 1:** Their Firebase Token expired (it expires every 1 hour). Usually, the frontend invisibly refreshes it, but sometimes it hangs. Ask the user to hard-refresh (`Cmd+Shift+R`).
*   **Cause 2:** They are trying to pass an `orgId` payload that does not match the `orgId` bound to their `uid` in the database.
*   **Fix:** Check their `users/{uid}` document to verify their `orgId` matches exactly what they are requesting.

---

## 3. LCRS & API Simulation Errors

### 3.1 "Simulation Engine Unavailable" Notification
*   **Diagnosis:** The FastAPI backend caught an exception while trying to talk to OpenAI or Gemini.
*   **Cause 1:** The organization's API keys in `organizations/{orgId}/apiKeys` are invalid, revoked, or out of pre-paid credits.
*   **Cause 2:** OpenAI's servers are globally down.
*   **Intern Action:** Check the backend Python terminal. Look for `openai.AuthenticationError` or `openai.RateLimitError`.

### 3.2 "My LCRS Accuracy is always 0%"
*   **Diagnosis:** The semantic embedding engine failed to match the context document.
*   **Cause:** The Context Document (Manifest) the user uploaded is empty, or they uploaded a binary file (like an encrypted PDF) that the ingestor couldn't read.
*   **Fix:** Tell the customer to navigate to `/ingestion`, delete their current `latest` manifest, and re-upload a clean, plain-text `.txt` or `.md` file.

---

## 4. UI/UX "Ghost" Bugs

### 4.1 "I invited a user, but they don't show up in the Team list."
*   **Diagnosis:** The React state lagged behind the database state.
*   **Cause:** The frontend `TeamSettings.tsx` fetched the team list *before* the backend Firestore cluster finished replicating the new generic user.
*   **Fix:** Tell the user to simply refresh the page. The data is safe in the database.

### 4.2 The Dashboard Charts are "Flickering" or "Spinning Wildly"
*   **Diagnosis:** Infinite React Render Loop.
*   **Cause:** A developer added a `useEffect` hook that modifies a state variable, which in turn triggers the `useEffect` to fire again, 60 times a second.
*   **Fix:**
    1. Identify the rogue `useEffect` inside `SoMCommandCenter.tsx`.
    2. Add the proper dependency array at the bottom `[dependencyA, dependencyB]`.
    3. If deriving complex math (like LCRS averages), wrap it in a `useMemo(() => calculate(), [data])` so it only calculates once.

---

## 5. Billing Incidents

### 5.1 "A customer bought Growth, but it still says Explorer!"
*   **Cause:** The Razorpay webhook failed to reach our production server.
*   **Intern Fix:**
    1. Verify the payment in the Razorpay Dashboard.
    2. If paid, manually open Firestore → `organizations/{orgId}`.
    3. Change `subscription.planId` to `"growth"`.
    4. Change `subscription.maxSimulations` to `100`.
    5. Change `subscription.status` to `"active"`.

*Proceed to Guide 07: Sales & Lead Onboarding Guide.*
