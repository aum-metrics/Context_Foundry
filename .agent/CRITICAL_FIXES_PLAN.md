# Critical Fixes Implementation Plan

## Priority 1: Core Functionality (Real-time Collaboration Moat)

### 1.1 Firestore Schema & User Management
- [ ] Create proper user subscription collection structure
- [ ] Sync Razorpay payment webhooks with Firestore user records
- [ ] Implement proper tier enforcement across all features
- [ ] Add user profile management with subscription status

### 1.2 Real-time Collaboration (The Moat)
- [ ] Verify Firestore cursor tracking is working correctly
- [ ] Implement proper canvas element synchronization across users
- [ ] Add presence indicators (who's viewing/editing)
- [ ] Implement conflict resolution for simultaneous edits
- [ ] Add visual feedback for other users' actions

### 1.3 Backend-Frontend Integration
- [ ] Audit all API endpoints and ensure they match frontend calls
- [ ] Fix `domains_fixed.py` import issue in `intelligence.py`
- [ ] Ensure all NL query responses include proper data structures
- [ ] Add proper error handling and user feedback

## Priority 2: UI/UX Enhancement (WOW Factor)

### 2.1 Landing Page
- [ ] Mark Team/Enterprise as "Coming Soon"
- [ ] Add stunning hero animations
- [ ] Implement interactive demo video/GIF
- [ ] Add social proof (testimonials, logos)
- [ ] Enhance color scheme and typography

### 2.2 Canvas Interface
- [ ] Add close buttons to all floating windows (NL query results, charts, tables)
- [ ] Implement smooth animations for element creation/deletion
- [ ] Add glassmorphism effects to panels
- [ ] Improve toolbar design with better iconography
- [ ] Add keyboard shortcuts overlay
- [ ] Implement mini-map for canvas navigation

### 2.3 Data Visualization
- [ ] Enhance chart designs with modern styling
- [ ] Add chart animation on creation
- [ ] Implement interactive tooltips
- [ ] Add export options for individual charts

## Priority 3: Payment & Subscription System

### 3.1 Razorpay Integration
- [ ] Create webhook endpoint for payment success
- [ ] Update Firestore user document on successful payment
- [ ] Implement subscription renewal logic
- [ ] Add payment history tracking
- [ ] Create billing page for users

### 3.2 Tier Enforcement
- [ ] Implement middleware to check user tier on protected routes
- [ ] Add upgrade prompts at tier limits
- [ ] Create seamless upgrade flow

## Priority 4: Intelligence Engine

### 4.1 Backend Fixes
- [ ] Fix `domains_fixed.py` import
- [ ] Ensure KPI calculations work for all domains
- [ ] Add caching for repeated queries
- [ ] Optimize response times

### 4.2 Frontend Integration
- [ ] Ensure insights panel displays all KPIs correctly
- [ ] Add loading states for analysis
- [ ] Implement error recovery

## Implementation Order

**Day 1 (Today)**:
1. Fix landing page (Team/Enterprise "Coming Soon")
2. Add close buttons to NL query windows
3. Fix backend import issues
4. Verify Firestore real-time sync

**Day 2**:
1. Implement Razorpay webhook
2. Create user subscription sync
3. Enhance canvas UI with glassmorphism
4. Add presence indicators

**Day 3**:
1. Complete UI/UX overhaul
2. Add animations and micro-interactions
3. Implement keyboard shortcuts
4. Polish landing page

**Day 4**:
1. End-to-end testing
2. Performance optimization
3. Bug fixes
4. Documentation

## Success Metrics

- Real-time collaboration works flawlessly (< 100ms latency)
- Payment flow completes successfully
- UI receives "WOW" reactions from test users
- All backend endpoints return < 2s
- Zero critical bugs in production
