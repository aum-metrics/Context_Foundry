# AUM Context Foundry: Frontend Implementation Guide

**Target Audience:** Frontend Engineers, Interns
**Prerequisites:** React, Next.js (App Router), CSS, Framer Motion.
**Last Updated:** March 2026 | Reflects hardening passes 1-5.

---

## 1. Next.js App Router Structure

AUM Context Foundry uses the `Next.js 15 App Router`. This means file paths directly correspond to URL routes.

### Directory Mapping
*   `src/app/page.tsx` ➡️ Maps to `https://yourdomain.com/` (The Landing Page)
*   `src/app/dashboard/page.tsx` ➡️ Maps to `https://yourdomain.com/dashboard/` (The Main App)
*   `src/app/login/page.tsx` ➡️ Maps to `https://yourdomain.com/login/`

**Intern Note:** To add a new page (e.g., `/settings`), you literally just create a new folder `src/app/settings/` and place a `page.tsx` file inside it.

---

## 2. The Authentication Wall (`AuthWrapper.tsx`)

If a user tries to access `/dashboard` without being logged in, they must be redirected to `/login`. We handle this elegantly using a global wrapper.

### How `AuthWrapper.tsx` Works
1.  **Location:** Wrapping the children inside `src/app/layout.tsx` (for protected routes) or explicitly in `src/app/dashboard/layout.tsx`.
2.  **Logic:** It uses Firebase's `onAuthStateChanged` listener. 
3.  **Loading State:** While it talks to Firebase (which takes ~500ms), it returns a `<LoadingScreen />`. This prevents the dashboard from awkwardly flashing on the screen before kicking the unauthenticated user out.
4.  **Bypass Alert:** In `production`, mock tokens are mathematically disabled. Do not try to append `?mock=true` in production to bypass login; the UI will reject it.

---

## 3. Global State: The Organization Context

AUM Context Foundry is a "multi-tenant" application. Everything revolves around the Organization (Tenant). An intern must understand `OrganizationContext.tsx`.

### Why we need it
If a user is logged in, passing their `orgId`, `subscriptionTier`, and `apiKeys` down as "props" through 15 layers of React components is a nightmare (called "prop drilling").

### How it works
`OrganizationContext` wraps the entire Dashboard. It listens to the Firebase Auth module. Once the user is known, it makes a single fetch to `firestore: users/{uid}` to find their `orgId`, and then fetches `firestore: organizations/{orgId}`. 

It provides a globally accessible hook:
```typescript
import { useOrganization } from "@/components/OrganizationContext";

// Inside any component:
const { organization, orgUser, loading } = useOrganization();

console.log(organization.name); // "Acme Corp"
console.log(organization.subscriptionTier) // "growth"
```

**Common Bug Fix:** "The dashboard is blank but I'm logged in."
*   **Cause:** The user's Firebase Auth account exists, but their record is missing from the `users/` Firestore collection, meaning `useOrganization` cannot map them to an `orgId`.

---

## 4. UI Library & Styling Strategy (Vanilla CSS)

AUM Context Foundry uses a **custom CSS design system** defined in `frontend/src/app/globals.css`. We do NOT use Tailwind CSS.

### The Design System (`globals.css`)
The design system uses CSS custom properties (variables) for theming:
```css
:root {
  --color-primary: #f59e0b;      /* Amber for primary actions */
  --color-success: #10b981;       /* Emerald for success markers */
  --color-bg-dark: #0f172a;       /* Slate-900 background */
  --color-surface: #1e293b;       /* Slate-800 cards */
  --radius: 0.75rem;              /* Consistent border radius */
}
```

### The "Look and Feel" (Dark Mode by Default)
AUM Context Foundry is heavily biased toward Dark Mode for a premium, developer-centric aesthetic.
*   **Backgrounds:** Dark slate tones (`#0f172a`, `#1e293b`).
*   **Accents:** Amber (`#f59e0b`) for primary actions (simulations, upgrades) and emerald (`#10b981`) for success markers.
*   **Gradients:** Heavy use of `linear-gradient` for headers and accent elements.

### Building a New Component
Whenever you build a new UI element:
1. Use CSS custom properties from `globals.css` — never hardcode colors.
2. Make it responsive using CSS Grid/Flexbox.
3. Add hover states and transitions: `transition: all 0.2s ease`.
4. If it looks "flat," add a subtle border or box-shadow.

---

## 5. Animations (`Framer Motion`)

A massive part of AUM Context Foundry's premium feel is the dynamic animation layer. We use `framer-motion` to handle mount/unmount and layout transitions smoothly.

### The `<motion.div>`
Instead of a standard `<div>`, use `<motion.div>` to add entrance animations.

**Example: A smooth fade-in list item:**
```typescript
import { motion } from "framer-motion";

<motion.div 
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.2 }}
>
  Hello World
</motion.div>
```

### The Radar Charts (`SoMCommandCenter.tsx`)
The heartbeat pulsing inside the System of Metrics (SoM) dashboard utilizes complex React `useEffect` loops driving SVG circles.
*   **Performance Warning:** If you ever edit the radar chart loops, you MUST wrap the derivations in `useMemo`. If you don't, React will re-render the entire 1,000-line DOM tree 60 times a second, crashing the user's browser.

---

## 6. Calling the Backend APIs from React

To securely communicate with our Python FastAPI backend, you **must** attach the user's Firebase JWT Bearer token to every request. 

### The Standard API Fetch Pattern
If you are writing a new data-fetching hook:

```typescript
import { auth } from "@/lib/firebase";

const handleSaveData = async (payload) => {
    // 1. Get the current, unexpired token mathematically from Google
    const token = await auth.currentUser?.getIdToken();
    
    // 2. Attach it to the Authorization Header
    const response = await fetch('/api/v1/my-new-endpoint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // <--- CRITICAL
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error("API Failed");
    }
}
```

---

## 7. The Upgrade Funnel (Monetization UI)

We restrict certain actions based on the user's `organization.subscriptionTier` ('explorer', 'growth', 'scale', 'enterprise').

### How to Lock a Feature
Do not just hide the button. Show the button, but add a visual lock icon and trigger the `<UpgradeModal />`.

**Example:**
```typescript
{organization.subscriptionTier === 'explorer' ? (
    <button onClick={() => setIsUpgradeModalOpen(true)}>
        <Lock className="w-4 h-4" /> Premium Feature
    </button>
) : (
    <button onClick={handlePremiumFeature}>
        Run Feature
    </button>
)}
```
The `<UpgradeModal />` handles the Razorpay checkout session automatically via the `useRazorpay()` hook.

*Proceed to Guide 03: Backend API & Logic Reference.*
