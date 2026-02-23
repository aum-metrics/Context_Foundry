# AUM Data Labs - Comprehensive Firestore Schema

This document outlines the complete, exhaustive database schema for AUM Data Labs, using Google Cloud Firestore (NoSQL), optimized for high-volume real-time collaboration.

## 1. Core Collections

### 1.1 `users` (Private Data Path: `/artifacts/{appId}/users/{userId}/profiles`)

Stores user profile information and global settings.

- **Document ID**: `uid` (Firebase Auth UID)
- **Fields**:
  - `email` (string): User's primary email address (optional for anonymous users)
  - `display_name` (string): Full name (default: "User XXXX")
  - `created_at` (timestamp): Account creation date
  - `tier` (string): 'free', 'pro', or 'team'
  - `workspace_ids` (array of strings): IDs of workspaces the user belongs to (Team Tier)
  - `settings` (map): `{ theme: 'light' or 'dark' }`

### 1.2 `canvases` (Public Data Path: `/artifacts/{appId}/public/data/canvases`)

The core entity storing the infinite canvas state, used for sharing and collaboration.

- **Document ID**: `uuid` (The `CANVAS_ID` used in frontend code)
- **Fields**:
  - `name` (string): Canvas title
  - `owner_uid` (string): Creator's UID (for primary write access)
  - `workspace_id` (string, optional): ID of the parent workspace (Team Tier)
  - `elements` (array of maps): The visual components (Table, Chart, Note, etc.)
    - `id` (string): UUID
    - `type` (string): 'table', 'chart', 'note'
    - `x`, `y`, `width`, `height` (numbers): Position and size
    - `data_json` (string): JSON string of the actual raw data (for tables)
    - `config` (map): Chart configuration, table filters, etc.
  - `analysis` (map): Auto-generated domain intelligence from backend
    - `domain` (string): Detected domain (e.g., "SaaS")
    - `kpis` (map): Calculated key performance indicators
    - `action_items` (array of strings): Suggested tasks from insights
  - `share_settings` (map):
    - `is_public_view` (boolean): If true, accessible via link
    - `editors` (array of strings): UIDs allowed to edit (Free Tier limit enforced here)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

### 1.3 `canvas_cursors` (Transient/High-Traffic Collection)

**CRITICAL FIX**: This is a separate top-level collection for all cursor traffic across all canvases. This optimizes Firestore performance by preventing contention on the core canvases documents.

- **Collection Path**: `/artifacts/{appId}/public/data/canvas_cursors`
- **Document ID**: `uid` (Firebase Auth UID)
- **Fields**:
  - `canvas_id` (string): The canvas currently being viewed/edited (Index required)
  - `x` (number), `y` (number): Mouse position relative to viewport
  - `user_name` (string), `color` (string)
  - `last_active` (timestamp): Used for cleanup and presence detection

### 1.4 `comments` (Subcollection under `canvases/{canvasId}`)

Stores real-time comment threads tied to a specific canvas.

- **Collection Path**: `/artifacts/{appId}/public/data/canvases/{canvasId}/comments`
- **Document ID**: `uuid` (Comment Thread ID)
- **Fields**:
  - `element_id` (string): ID of the element the comment is pinned to
  - `x`, `y` (number): Position of the comment pin on the canvas
  - `status` (string): 'open', 'resolved'
  - `thread` (array of maps):
    - `uid` (string), `timestamp` (timestamp), `text` (string)

### 1.5 `version_history` (Subcollection under `canvases/{canvasId}`)

Stores checkpoints of the full canvas state for restoration.

- **Collection Path**: `/artifacts/{appId}/public/data/canvases/{canvasId}/history`
- **Document ID**: `timestamp` (e.g., ISO string or timestamp integer)
- **Fields**:
  - `user_uid` (string)
  - `label` (string, optional): "Named Checkpoint"
  - `snapshot` (map): Contains the full `elements` array snapshot.

## 2. Security Rules (firestore.rules)

**CRITICAL FIX**: Updated rules to match the `/artifacts/{appId}/public/data/` structure and use `uid` for authorization, matching the React implementation.

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- Helper Functions ---
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return request.auth.uid == uid;
    }

    // --- Public Data Path Match (Used by the Frontend MVP) ---
    match /artifacts/{appId}/public/data/canvases/{canvasId} {
      // READ: Allow if owner, or if public view is enabled.
      allow read: if isSignedIn() && (
        isOwner(resource.data.owner_uid) || 
        resource.data.share_settings.is_public_view == true
      );
      
      // WRITE: Allow only if authenticated AND they are the owner.
      // NOTE: For MVP, we simplify. Production would check the 'editors' array.
      allow write: if isSignedIn() && isOwner(resource.data.owner_uid);
    }
    
    // --- Cursors (High-Traffic Real-Time) ---
    match /artifacts/{appId}/public/data/canvas_cursors/{uid} {
      // READ: Anyone can read cursor positions if signed in (for collaboration).
      allow read: if isSignedIn();
      // WRITE: Only the user matching the document ID can update their own cursor position.
      allow write: if isOwner(uid);
    }

    // --- Subcollection Matches (Comments and History) ---
    match /artifacts/{appId}/public/data/canvases/{canvasId}/{subcollection}/{docId} {
      // Inherit READ access from the parent canvas document's rules.
      allow read: if get(/databases/$(database)/documents/artifacts/$(appId)/public/data/canvases/$(canvasId)).share_settings.is_public_view == true || 
                    get(/databases/$(database)/documents/artifacts/$(appId)/public/data/canvases/$(canvasId)).owner_uid == request.auth.uid;
      
      // WRITE: Only canvas owner can modify/add comments or history entries.
      allow write: if get(/databases/$(database)/documents/artifacts/$(appId)/public/data/canvases/$(canvasId)).owner_uid == request.auth.uid;
    }

    // --- Default Deny ---
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 3. Indexes (firestore.indexes.json)

Required composite indexes for querying canvases and cursors.

```json
{
  "indexes": [
    {
      "collectionGroup": "canvases",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "owner_uid", "order": "ASCENDING" },
        { "fieldPath": "updated_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "canvases",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspace_id", "order": "ASCENDING" },
        { "fieldPath": "updated_at", "order": "DESCENDING" }
      ]
    },
    // REQUIRED FOR HIGH-TRAFFIC CURSOR COLLECTION
    {
      "collectionGroup": "canvas_cursors",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "canvas_id", "order": "ASCENDING" },
        { "fieldPath": "last_active", "order": "DESCENDING" }
      ]
    }
  ]
}
```
