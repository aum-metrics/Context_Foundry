# backend/app/api/realtime.py
"""
REAL-TIME COLLABORATIVE CANVAS
Google Docs-like real-time collaboration for data analysis
Up to 5 users can work simultaneously on the same canvas
PROFESSIONAL TIER ONLY - Premium feature
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from typing import Dict, List, Set, Any, Optional
import json
import asyncio
import logging
from datetime import datetime, timezone
from collections import defaultdict
import secrets

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except:
    SUPABASE_AVAILABLE = False

from core.config import settings
from core.dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase: Optional[Client] = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase: {e}")

def check_professional_subscription(email: str) -> bool:
    """
    Check if user has PROFESSIONAL subscription.
    Real-time collaboration is ONLY for professional tier.
    Tiers: free, starter, professional
    """
    if not supabase:
        logger.warning("Supabase not available, allowing collaboration for development")
        return True  # Allow in dev mode
    
    try:
        result = supabase.table("user_profiles").select(
            "subscription_type, subscription_expiry"
        ).eq("email", email).execute()
        
        if not result.data or len(result.data) == 0:
            return False
        
        user = result.data[0]
        subscription_type = user.get("subscription_type", "free")
        
        # ONLY professional tier can collaborate
        if subscription_type.lower() != "professional":
            logger.warning(f"User {email} attempted collaboration with {subscription_type} tier")
            return False
        
        # Check expiry
        subscription_expiry = user.get("subscription_expiry")
        if subscription_expiry:
            try:
                expiry_date = datetime.fromisoformat(subscription_expiry.replace('Z', '+00:00'))
                if datetime.now(timezone.utc) > expiry_date:
                    logger.warning(f"User {email} subscription expired")
                    return False
            except ValueError:
                pass
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to check subscription: {e}")
        return False

# ============================================================================
# REAL-TIME COLLABORATION MANAGER
# ============================================================================

class CollaborativeCanvas:
    """Manages a single collaborative canvas session"""
    
    def __init__(self, canvas_id: str, owner_email: str):
        self.canvas_id = canvas_id
        self.owner_email = owner_email
        self.created_at = datetime.utcnow()
        
        # Active connections
        self.connections: Dict[str, WebSocket] = {}  # {user_email: websocket}
        self.user_info: Dict[str, Dict[str, Any]] = {}  # {user_email: {name, color, cursor_pos}}
        
        # Canvas state
        self.data: Optional[Dict[str, Any]] = None
        self.insights: List[Dict[str, Any]] = []
        self.charts: List[Dict[str, Any]] = []
        self.filters: Dict[str, Any] = {}
        self.joins: List[Dict[str, Any]] = []
        
        # Activity tracking
        self.activity_log: List[Dict[str, Any]] = []
        self.version = 0
        
        # Cursor positions for real-time tracking
        self.cursors: Dict[str, Dict[str, Any]] = {}  # {user_email: {x, y, timestamp}}
        
    def add_user(self, email: str, websocket: WebSocket, user_info: Dict[str, Any]):
        """Add a user to the canvas"""
        self.connections[email] = websocket
        self.user_info[email] = {
            "email": email,
            "name": user_info.get("name", email.split("@")[0]),
            "color": user_info.get("color", self._generate_user_color(email)),
            "joined_at": datetime.utcnow().isoformat(),
            "is_owner": email == self.owner_email
        }
        
        self.activity_log.append({
            "type": "user_joined",
            "user": email,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        logger.info(f"👤 User joined canvas {self.canvas_id}: {email}")
    
    def remove_user(self, email: str):
        """Remove a user from the canvas"""
        if email in self.connections:
            del self.connections[email]
        if email in self.user_info:
            del self.user_info[email]
        if email in self.cursors:
            del self.cursors[email]
        
        self.activity_log.append({
            "type": "user_left",
            "user": email,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        logger.info(f"👤 User left canvas {self.canvas_id}: {email}")
    
    def update_cursor(self, email: str, x: float, y: float):
        """Update user's cursor position"""
        self.cursors[email] = {
            "x": x,
            "y": y,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def update_data(self, data: Dict[str, Any], user_email: str):
        """Update canvas data"""
        self.data = data
        self.version += 1
        
        self.activity_log.append({
            "type": "data_updated",
            "user": user_email,
            "version": self.version,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def add_insight(self, insight: Dict[str, Any], user_email: str):
        """Add an insight to the canvas"""
        insight_with_meta = {
            **insight,
            "id": secrets.token_urlsafe(8),
            "created_by": user_email,
            "created_at": datetime.utcnow().isoformat()
        }
        self.insights.append(insight_with_meta)
        self.version += 1
        
        self.activity_log.append({
            "type": "insight_added",
            "user": user_email,
            "insight_id": insight_with_meta["id"],
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return insight_with_meta
    
    def add_chart(self, chart: Dict[str, Any], user_email: str):
        """Add a chart to the canvas"""
        chart_with_meta = {
            **chart,
            "id": secrets.token_urlsafe(8),
            "created_by": user_email,
            "created_at": datetime.utcnow().isoformat()
        }
        self.charts.append(chart_with_meta)
        self.version += 1
        
        self.activity_log.append({
            "type": "chart_added",
            "user": user_email,
            "chart_id": chart_with_meta["id"],
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return chart_with_meta
    
    def update_filters(self, filters: Dict[str, Any], user_email: str):
        """Update canvas filters"""
        self.filters = filters
        self.version += 1
        
        self.activity_log.append({
            "type": "filters_updated",
            "user": user_email,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def add_join(self, join: Dict[str, Any], user_email: str):
        """Add a join to the canvas"""
        join_with_meta = {
            **join,
            "id": secrets.token_urlsafe(8),
            "created_by": user_email,
            "created_at": datetime.utcnow().isoformat()
        }
        self.joins.append(join_with_meta)
        self.version += 1
        
        self.activity_log.append({
            "type": "join_added",
            "user": user_email,
            "join_id": join_with_meta["id"],
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return join_with_meta
    
    def get_state(self) -> Dict[str, Any]:
        """Get complete canvas state"""
        return {
            "canvas_id": self.canvas_id,
            "owner_email": self.owner_email,
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "active_users": list(self.user_info.values()),
            "user_count": len(self.connections),
            "cursors": self.cursors,
            "data": self.data,
            "insights": self.insights,
            "charts": self.charts,
            "filters": self.filters,
            "joins": self.joins,
            "activity_log": self.activity_log[-50:]  # Last 50 activities
        }
    
    def _generate_user_color(self, email: str) -> str:
        """Generate a unique color for each user"""
        colors = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
            "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788"
        ]
        # Use email hash to consistently assign colors
        index = sum(ord(c) for c in email) % len(colors)
        return colors[index]
    
    async def broadcast(self, message: Dict[str, Any], exclude: Optional[str] = None):
        """Broadcast message to all connected users"""
        disconnected = []
        
        for email, websocket in self.connections.items():
            if exclude and email == exclude:
                continue
            
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to {email}: {e}")
                disconnected.append(email)
        
        # Clean up disconnected users
        for email in disconnected:
            self.remove_user(email)


class RealtimeCollaborationManager:
    """Manages all collaborative canvases"""
    
    def __init__(self):
        self.canvases: Dict[str, CollaborativeCanvas] = {}
        self.max_users_per_canvas = 5
    
    def create_canvas(self, canvas_id: str, owner_email: str) -> CollaborativeCanvas:
        """Create a new collaborative canvas"""
        if canvas_id in self.canvases:
            return self.canvases[canvas_id]
        
        canvas = CollaborativeCanvas(canvas_id, owner_email)
        self.canvases[canvas_id] = canvas
        
        logger.info(f"🎨 Canvas created: {canvas_id} by {owner_email}")
        return canvas
    
    def get_canvas(self, canvas_id: str) -> Optional[CollaborativeCanvas]:
        """Get a canvas by ID"""
        return self.canvases.get(canvas_id)
    
    def delete_canvas(self, canvas_id: str):
        """Delete a canvas"""
        if canvas_id in self.canvases:
            del self.canvases[canvas_id]
            logger.info(f"🎨 Canvas deleted: {canvas_id}")
    
    def can_join_canvas(self, canvas_id: str) -> bool:
        """Check if a user can join the canvas"""
        canvas = self.get_canvas(canvas_id)
        if not canvas:
            return True  # Can create new canvas
        
        return len(canvas.connections) < self.max_users_per_canvas
    
    def get_active_canvases(self) -> List[Dict[str, Any]]:
        """Get list of all active canvases"""
        return [
            {
                "canvas_id": canvas_id,
                "owner": canvas.owner_email,
                "user_count": len(canvas.connections),
                "created_at": canvas.created_at.isoformat(),
                "version": canvas.version
            }
            for canvas_id, canvas in self.canvases.items()
        ]


# Global collaboration manager
collaboration_manager = RealtimeCollaborationManager()


# ============================================================================
# WEBSOCKET ENDPOINTS
# ============================================================================

@router.websocket("/ws/{canvas_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    canvas_id: str,
    user_email: str,
    user_name: Optional[str] = None
):
    """
    WebSocket endpoint for real-time collaboration
    PROFESSIONAL TIER ONLY
    
    URL: ws://localhost:8000/api/realtime/ws/{canvas_id}?user_email=user@example.com&user_name=John
    """
    await websocket.accept()
    
    try:
        # ✅ CHECK PROFESSIONAL SUBSCRIPTION
        if not check_professional_subscription(user_email):
            await websocket.send_json({
                "type": "error",
                "message": "Real-time collaboration requires Professional subscription",
                "code": "SUBSCRIPTION_REQUIRED",
                "upgrade_url": "https://aumdatalabs.com/pricing"
            })
            await websocket.close()
            logger.warning(f"🚫 Collaboration denied for {user_email} - not professional tier")
            return
        
        # Check if canvas is full
        if not collaboration_manager.can_join_canvas(canvas_id):
            await websocket.send_json({
                "type": "error",
                "message": "Canvas is full. Maximum 5 users allowed.",
                "code": "CANVAS_FULL"
            })
            await websocket.close()
            return
        
        # Get or create canvas
        canvas = collaboration_manager.get_canvas(canvas_id)
        if not canvas:
            canvas = collaboration_manager.create_canvas(canvas_id, user_email)
        
        # Add user to canvas
        user_info = {
            "name": user_name or user_email.split("@")[0],
            "email": user_email
        }
        canvas.add_user(user_email, websocket, user_info)
        
        # Send initial state to the new user
        await websocket.send_json({
            "type": "init",
            "state": canvas.get_state()
        })
        
        # Notify other users
        await canvas.broadcast({
            "type": "user_joined",
            "user": canvas.user_info[user_email],
            "active_users": list(canvas.user_info.values())
        }, exclude=user_email)
        
        # Listen for messages
        while True:
            try:
                data = await websocket.receive_json()
                message_type = data.get("type")
                
                if message_type == "cursor_move":
                    # Update cursor position
                    canvas.update_cursor(user_email, data.get("x", 0), data.get("y", 0))
                    
                    # Broadcast cursor position
                    await canvas.broadcast({
                        "type": "cursor_update",
                        "user": user_email,
                        "cursor": canvas.cursors[user_email],
                        "user_color": canvas.user_info[user_email]["color"]
                    }, exclude=user_email)
                
                elif message_type == "data_update":
                    # Update canvas data
                    canvas.update_data(data.get("data"), user_email)
                    
                    # Broadcast data update
                    await canvas.broadcast({
                        "type": "data_updated",
                        "data": canvas.data,
                        "version": canvas.version,
                        "updated_by": user_email
                    })
                
                elif message_type == "add_insight":
                    # Add insight
                    insight = canvas.add_insight(data.get("insight"), user_email)
                    
                    # Broadcast new insight
                    await canvas.broadcast({
                        "type": "insight_added",
                        "insight": insight,
                        "version": canvas.version
                    })
                
                elif message_type == "add_chart":
                    # Add chart
                    chart = canvas.add_chart(data.get("chart"), user_email)
                    
                    # Broadcast new chart
                    await canvas.broadcast({
                        "type": "chart_added",
                        "chart": chart,
                        "version": canvas.version
                    })
                
                elif message_type == "update_filters":
                    # Update filters
                    canvas.update_filters(data.get("filters"), user_email)
                    
                    # Broadcast filter update
                    await canvas.broadcast({
                        "type": "filters_updated",
                        "filters": canvas.filters,
                        "version": canvas.version,
                        "updated_by": user_email
                    })
                
                elif message_type == "add_join":
                    # Add join
                    join = canvas.add_join(data.get("join"), user_email)
                    
                    # Broadcast new join
                    await canvas.broadcast({
                        "type": "join_added",
                        "join": join,
                        "version": canvas.version
                    })
                
                elif message_type == "chat_message":
                    # Broadcast chat message
                    await canvas.broadcast({
                        "type": "chat_message",
                        "user": user_email,
                        "user_name": canvas.user_info[user_email]["name"],
                        "user_color": canvas.user_info[user_email]["color"],
                        "message": data.get("message"),
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                elif message_type == "ping":
                    # Heartbeat
                    await websocket.send_json({"type": "pong"})
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    
    finally:
        # Remove user from canvas
        canvas.remove_user(user_email)
        
        # Notify other users
        if canvas:
            await canvas.broadcast({
                "type": "user_left",
                "user": user_email,
                "active_users": list(canvas.user_info.values())
            })
        
        # Clean up empty canvases
        if canvas and len(canvas.connections) == 0:
            collaboration_manager.delete_canvas(canvas_id)


# ============================================================================
# REST API ENDPOINTS
# ============================================================================

@router.get("/canvases")
async def get_active_canvases():
    """Get list of all active collaborative canvases"""
    return {
        "success": True,
        "canvases": collaboration_manager.get_active_canvases(),
        "total_count": len(collaboration_manager.canvases)
    }


@router.get("/canvas/{canvas_id}")
async def get_canvas_state(canvas_id: str):
    """Get current state of a canvas"""
    canvas = collaboration_manager.get_canvas(canvas_id)
    
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    
    return {
        "success": True,
        "state": canvas.get_state()
    }


@router.post("/canvas/{canvas_id}/create")
async def create_canvas(canvas_id: str, owner_email: str):
    """Create a new collaborative canvas"""
    canvas = collaboration_manager.create_canvas(canvas_id, owner_email)
    
    return {
        "success": True,
        "canvas_id": canvas_id,
        "owner": owner_email,
        "created_at": canvas.created_at.isoformat()
    }


@router.delete("/canvas/{canvas_id}")
async def delete_canvas(canvas_id: str, owner_email: str):
    """Delete a collaborative canvas (owner only)"""
    canvas = collaboration_manager.get_canvas(canvas_id)
    
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    
    if canvas.owner_email != owner_email:
        raise HTTPException(status_code=403, detail="Only the owner can delete the canvas")
    
    collaboration_manager.delete_canvas(canvas_id)
    
    return {
        "success": True,
        "message": "Canvas deleted successfully"
    }


@router.get("/health")
async def realtime_health():
    """Health check for realtime service"""
    return {
        "status": "healthy",
        "service": "realtime_collaboration",
        "active_canvases": len(collaboration_manager.canvases),
        "max_users_per_canvas": collaboration_manager.max_users_per_canvas,
        "features": [
            "real_time_cursors",
            "collaborative_editing",
            "live_chat",
            "data_sync",
            "insight_sharing",
            "chart_collaboration",
            "filter_sync",
            "join_collaboration",
            "activity_log"
        ]
    }
