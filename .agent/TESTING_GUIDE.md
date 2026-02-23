# 🧪 COMPREHENSIVE TESTING GUIDE

## Pre-Testing Checklist

### Backend Setup
- [ ] Backend server running: `cd backend && python -m uvicorn app.main:app --reload`
- [ ] Environment variables configured in `backend/.env`:
  ```
  RAZORPAY_KEY_ID=rzp_test_...
  RAZORPAY_KEY_SECRET=...
  GOOGLE_APPLICATION_CREDENTIALS=path/to/firebase-credentials.json
  ```
- [ ] Firebase credentials file exists and is valid
- [ ] Backend accessible at `http://localhost:8000`
- [ ] Check `/api/health` endpoint returns `{"status": "healthy"}`

### Frontend Setup
- [ ] Frontend server running: `cd frontend && npm run dev`
- [ ] Environment variables configured in `frontend/.env.local`:
  ```
  NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
  NEXT_PUBLIC_FIREBASE_API_KEY=...
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
  NEXT_PUBLIC_API_URL=http://localhost:8000
  ```
- [ ] Frontend accessible at `http://localhost:3000`
- [ ] No console errors on page load

### Razorpay Setup
- [ ] Razorpay account created (test mode)
- [ ] Webhook configured:
  - URL: `http://localhost:8000/api/webhooks/razorpay` (use ngrok for local testing)
  - Events: `payment.captured`, `payment.failed`
  - Secret saved in backend `.env`

---

## Test 1: User Authentication

### Steps:
1. Navigate to `http://localhost:3000`
2. Click "Sign Up"
3. Enter email and password
4. Click "Create Account"

### Expected Results:
- ✅ User redirected to canvas page
- ✅ User email stored in localStorage
- ✅ Firestore `/users/{email}` document created with `tier: "free"`

### Verification:
```bash
# Check localStorage
console.log(localStorage.getItem('user_email'))

# Check Firestore (Firebase Console)
# Navigate to: Firestore Database > users > {your-email}
# Should see: { tier: "free", created_at: timestamp }
```

---

## Test 2: Real-time Collaboration (THE MOAT)

### Steps:
1. Open canvas in Chrome: `http://localhost:3000/canvas`
2. Upload a CSV file
3. Open **same canvas URL** in Firefox (copy full URL including `?id=...`)
4. Move mouse in Chrome

### Expected Results:
- ✅ See colored triangle cursor in Firefox moving in real-time
- ✅ Latency < 100ms
- ✅ Cursor shows "User" label
- ✅ Multiple cursors visible when 3+ users join

### Verification:
```javascript
// Open browser console in both windows
// Chrome console:
console.log('My cursor ID:', localStorage.getItem('cursor_id'))

// Firefox console - should see different ID:
console.log('My cursor ID:', localStorage.getItem('cursor_id'))

// Check Firestore:
// Collection: /artifacts/aum-data-labs/public/data/canvas_cursors
// Should see 2 documents with different IDs
```

### Troubleshooting:
- **No cursor visible?**
  - Check if both browsers are logged in
  - Verify canvas ID is the same in both URLs
  - Check browser console for Firestore errors
  - Ensure Firebase credentials are correct

- **Cursor laggy (> 100ms)?**
  - Check network tab for Firestore latency
  - Verify Firestore is in same region
  - Check if throttling is too aggressive (currently 50ms)

---

## Test 3: Data Upload & Analysis

### Steps:
1. Click "Upload Data" button
2. Select a CSV file (e.g., sales data, user data)
3. Wait for analysis to complete

### Expected Results:
- ✅ File uploads successfully
- ✅ Table appears on canvas
- ✅ "Analyzing Data..." overlay shows
- ✅ Auto-Insights panel appears on right
- ✅ Domain detected correctly (e.g., "E-Commerce", "SaaS")
- ✅ KPIs calculated and displayed
- ✅ Action items generated

### Verification:
```bash
# Check backend logs for:
"Domain detected: {domain_name}"
"KPIs calculated: {kpi_count}"

# Check frontend console for:
console.log('Insights:', insights)
# Should show: { domain_classification, kpis, action_items, ... }
```

### Troubleshooting:
- **Analysis fails?**
  - Check backend logs for errors
  - Verify CSV format is correct
  - Check if `domains.py` import is working
  - Ensure `domains_fixed.py` exists

- **No insights shown?**
  - Check if insights panel is collapsed
  - Verify backend returned insights
  - Check network tab for `/api/intelligence/analyze` response

---

## Test 4: Natural Language Query

### Steps:
1. Upload data (if not already uploaded)
2. Click on a table to select it
3. Type in NL bar: "What is the average revenue?"
4. Press Enter

### Expected Results:
- ✅ Query processes successfully
- ✅ Result appears as new chart/table on canvas
- ✅ Chart has close button (red X on hover)
- ✅ Result is accurate

### Test Queries:
```
- "What is the average revenue?"
- "Show me top 10 customers by sales"
- "What is the trend of revenue over time?"
- "Count users by country"
```

### Verification:
```bash
# Check backend logs:
"NL Query: {query}"
"Query Type: {type}"
"Result: {row_count} rows"

# Check frontend:
# New element should appear on canvas
# Element should have type: 'chart' or 'table'
```

---

## Test 5: Payment Flow (CRITICAL)

### Setup:
1. Install ngrok: `npm install -g ngrok`
2. Start ngrok: `ngrok http 8000`
3. Copy ngrok URL (e.g., `https://abc123.ngrok.io`)
4. Configure Razorpay webhook:
   - URL: `https://abc123.ngrok.io/api/webhooks/razorpay`
   - Events: `payment.captured`, `payment.failed`
   - Save webhook secret to backend `.env`

### Steps:
1. Click "Upgrade" button (crown icon)
2. Select "Pro" tier
3. Click "Upgrade Now"
4. Razorpay modal opens
5. Enter test card details:
   - Card: `4111 1111 1111 1111`
   - CVV: `123`
   - Expiry: `12/25`
   - Name: Any name
6. Click "Pay"

### Expected Results:
- ✅ Payment succeeds
- ✅ Razorpay sends webhook to backend
- ✅ Backend logs: `✅ Subscription updated: {email} → pro tier`
- ✅ Firestore `/users/{email}` updated with:
  ```
  {
    tier: "pro",
    subscription_start: timestamp,
    subscription_end: timestamp (30 days later),
    payment_id: "pay_...",
    payment_amount: 999,
    payment_status: "active"
  }
  ```
- ✅ Frontend refreshes and shows Pro features
- ✅ Upgrade button changes to "Pro Plan"

### Verification:
```bash
# Backend logs (should see):
"📥 Received webhook: payment.captured"
"✅ Subscription updated: user@example.com → pro tier"
"💰 Amount: ₹999"
"📅 Valid until: 2025-12-22"

# Check Firestore:
# Navigate to: Firestore Database > users > {your-email}
# Should see tier: "pro"

# Frontend:
# Refresh page
# Check if Pro features are unlocked
# Verify tier badge shows "Pro"
```

### Troubleshooting:
- **Webhook not received?**
  - Check ngrok is running
  - Verify webhook URL in Razorpay dashboard
  - Check Razorpay webhook logs
  - Ensure webhook secret matches `.env`

- **Payment succeeds but tier not updated?**
  - Check backend logs for webhook errors
  - Verify Firestore credentials
  - Check if email is in payment notes
  - Manually check Firestore for updates

- **Frontend doesn't show Pro features?**
  - Refresh page
  - Check localStorage for tier
  - Verify Firestore has tier: "pro"
  - Check if frontend is reading from Firestore

---

## Test 6: Canvas Sharing

### Steps:
1. Save canvas (Ctrl+S or click Save button)
2. Click "Share" button
3. Copy share link
4. Open link in incognito window

### Expected Results:
- ✅ Share modal opens
- ✅ Link copied to clipboard
- ✅ Incognito window shows canvas (read-only)
- ✅ All elements visible
- ✅ Insights panel visible
- ✅ Cannot edit (read-only mode)

### Verification:
```bash
# Share link format:
http://localhost:3000/share/{canvas_id}

# Check Firestore:
# /artifacts/aum-data-labs/public/data/canvases/{canvas_id}
# Should have: share_settings.public: true
```

---

## Test 7: Canvas Save/Load

### Steps:
1. Create canvas with data, charts, insights
2. Click "Save" button
3. Note canvas name
4. Click "My Canvases" dropdown
5. Select saved canvas

### Expected Results:
- ✅ Canvas saves successfully
- ✅ "Saved {time}" appears
- ✅ Canvas appears in dropdown
- ✅ Clicking canvas loads it correctly
- ✅ All elements restored
- ✅ Insights panel restored

### Verification:
```bash
# Check Firestore:
# /artifacts/aum-data-labs/public/data/canvases/{canvas_id}
# Should contain:
{
  owner_uid: "user@example.com",
  name: "My Canvas",
  elements: [...],
  analysis: {...},
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## Test 8: Multi-User Collaboration

### Steps:
1. User A: Create canvas, upload data
2. User A: Click "Share", copy link
3. User B: Open share link
4. User A: Drag table
5. User B: Observe

### Expected Results:
- ✅ User B sees User A's cursor
- ✅ User B sees table move in real-time
- ✅ Both users can edit simultaneously
- ✅ No conflicts or data loss
- ✅ Changes sync < 100ms

### Verification:
```bash
# Check Firestore listeners:
# Both users should have active listeners on:
# - /artifacts/.../canvases/{canvas_id}
# - /artifacts/.../canvas_cursors

# Check network tab:
# Should see frequent Firestore updates
# Latency should be < 100ms
```

---

## Test 9: UI/UX Polish

### Visual Checks:
- [ ] Glassmorphism effects visible on panels
- [ ] Smooth animations on element creation
- [ ] Hover effects work on buttons
- [ ] Gradients render correctly
- [ ] Dark mode works
- [ ] Scrollbars styled correctly
- [ ] No visual glitches

### Interaction Checks:
- [ ] Buttons have hover states
- [ ] Modals have backdrop blur
- [ ] Transitions are smooth (not janky)
- [ ] Loading states show correctly
- [ ] Error messages are clear
- [ ] Success feedback is visible

---

## Test 10: Performance

### Metrics to Check:
- [ ] Initial page load < 2s
- [ ] Data upload < 5s for 1MB file
- [ ] Analysis complete < 10s
- [ ] NL query response < 3s
- [ ] Canvas save < 2s
- [ ] Cursor update latency < 100ms

### Tools:
```bash
# Chrome DevTools > Performance
# Record interaction, check:
# - FPS (should be 60)
# - Main thread activity
# - Network requests

# Chrome DevTools > Network
# Check:
# - API response times
# - Firestore latency
# - Asset load times
```

---

## Test 11: Error Handling

### Test Scenarios:
1. **Upload invalid file**
   - Expected: Clear error message
   
2. **Backend offline**
   - Expected: "Service unavailable" message
   
3. **Payment fails**
   - Expected: Error shown, tier not changed
   
4. **Network disconnected**
   - Expected: Offline indicator, retry logic

5. **Firestore permission denied**
   - Expected: Auth error, redirect to login

---

## Success Criteria

### Must Pass:
- ✅ All authentication flows work
- ✅ Real-time collaboration < 100ms latency
- ✅ Payment flow completes end-to-end
- ✅ Data analysis generates insights
- ✅ NL queries return accurate results
- ✅ Canvas save/load works reliably
- ✅ No critical console errors

### Nice to Have:
- ✅ UI looks premium and polished
- ✅ Animations are smooth
- ✅ Performance metrics met
- ✅ Error handling is graceful

---

## Post-Testing Cleanup

### Remove Test Data:
```bash
# Firestore Console
# Delete test canvases
# Delete test users
# Delete test payments
```

### Reset Razorpay:
```bash
# Razorpay Dashboard
# Clear test payments
# Verify webhook logs
```

### Code Cleanup:
```bash
# Remove console.logs
# Remove test comments
# Remove unused imports
# Run linter
```

---

## Production Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured for production
- [ ] Razorpay in live mode
- [ ] Firebase security rules configured
- [ ] Backend deployed (Vercel/Railway/Heroku)
- [ ] Frontend deployed (Vercel)
- [ ] Webhook URL updated in Razorpay
- [ ] Domain configured
- [ ] SSL certificate active
- [ ] Monitoring setup (Sentry/LogRocket)
- [ ] Analytics configured (Google Analytics/Mixpanel)

---

## Need Help?

If any test fails:
1. Check backend logs
2. Check browser console
3. Check Firestore data
4. Check network tab
5. Review error messages
6. Consult documentation in `.agent/` folder

**You've got this!** 🚀
