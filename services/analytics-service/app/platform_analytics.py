"""
Platform Analytics Module
Fetches analytics data from local Firestore tracking.
(LinkedIn/Twitter APIs require Community Management API permission)
"""
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)

# Firebase/Firestore imports
import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

# Load environment variables from project root .env file
# Logic: Go up 3 levels from services/analytics-service/app -> project root
_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_current_dir, "../../.."))
_env_path = os.path.join(_project_root, ".env")

if os.path.exists(_env_path):
    load_dotenv(_env_path)
    logger.info(f"✅ Loaded environment from: {_env_path}")
else:
    logger.warning(f"⚠️ .env file not found at: {_env_path}")

# Initialize Firebase (if not already done)
# Initialize Firebase (if not already done)
db = None
try:
    # Try getting existing app first
    firebase_admin.get_app()
    db = firestore.client()
    logger.info("✅ Firebase reused from existing app")
except ValueError:
    # Initialize Firebase
    try:
        firebase_project_id = os.getenv("FIREBASE_PROJECT_ID")
        firebase_private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n')
        firebase_client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
        
        logger.info(f"Initializing Firebase with Project ID: {firebase_project_id}")
        
        if firebase_project_id and firebase_private_key and firebase_client_email and len(firebase_private_key) > 50:
            if "your-project-id" in firebase_project_id or "your-client-email" in firebase_client_email:
                logger.warning("❌ CRITICAL: Firebase credentials are PLACEHOLDER values!")
            else:
                cred = credentials.Certificate({
                    "type": "service_account",
                    "project_id": firebase_project_id,
                    "private_key": firebase_private_key,
                    "client_email": firebase_client_email,
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                })
                firebase_admin.initialize_app(cred)
                db = firestore.client()
                logger.info("✅ Firebase initialized successfully with real credentials")
        else:
            logger.warning("❌ CRITICAL: Firebase credentials are incomplete or missing!")
    except Exception as e:
        logger.error(f"❌ ERROR: Could not initialize Firebase: {e}")


async def fetch_local_analytics(user_id: str) -> Dict[str, Any]:
    """
    Fetch analytics from local Firestore tracking.
    Reads from users/{userId}/posts collection (published posts only).
    """
    if db is None:
        logger.warning("Firestore not initialized")
        return {"has_data": False, "message": "Database not configured"}
    
    try:
        # 1. Fetch from NEW collection (scheduled_posts)
        # Filter for only COMPLETED posts (status == 'posted')
        # NOTE: Removed .order_by() to avoid "Missing Index" error. Sorting is handled in Python.
        posts_ref_new = db.collection('users').document(user_id).collection('scheduled_posts')
        posts_query_new = posts_ref_new.where('status', '==', 'posted').limit(100)
        posts_new = list(posts_query_new.stream())
        logger.info(f"📊 [ANALYTICS] Found {len(posts_new)} posts in NEW 'scheduled_posts' collection")
        
        # 2. Fetch from LEGACY collection (posts) for backward compatibility
        posts_ref_old = db.collection('users').document(user_id).collection('posts')
        posts_query_old = posts_ref_old.order_by('created_at', direction=firestore.Query.DESCENDING).limit(100)
        posts_old = list(posts_query_old.stream())
        logger.info(f"📊 [ANALYTICS] Found {len(posts_old)} posts in LEGACY 'posts' collection")
        
        # Merge lists
        all_posts = posts_new + posts_old
        logger.info(f"📊 [ANALYTICS] Total posts after merge: {len(all_posts)}")
        
        # Aggregate by platform
        platform_counts = defaultdict(int)
        total_posts = 0
        recent_posts_list = []
        
        # Process all posts
        for post in all_posts:
            post_data = post.to_dict()
            total_posts += 1
            
            # Get platforms from post
            platforms = post_data.get('platforms', [])
            if isinstance(platforms, str):
                platforms = [platforms]
            
            for platform in platforms:
                platform_counts[platform.lower()] += 1
            
            # Normalize timestamp for sorting
            # Handle both camelCase (new) and snake_case (legacy) timestamps
            created_at = post_data.get('createdAt') or post_data.get('created_at')
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                except:
                    pass
            
            recent_posts_list.append({
                "id": post.id,
                "content": post_data.get('content', '')[:100] + '...' if len(post_data.get('content', '')) > 100 else post_data.get('content', ''),
                "full_content": post_data.get('content', ''),
                "platforms": platforms,
                "status": post_data.get('status', 'unknown'),
                "created_at": created_at,
                "image": post_data.get('image')
            })
            
        # Sort by date descending and take top 10
        # Helper to get timestamp for sorting
        def get_sort_key(p):
            t = p.get('created_at')
            if hasattr(t, 'timestamp'): return t.timestamp()
            if isinstance(t, str): return 0 # Fallback
            return 0
            
        recent_posts_list.sort(key=get_sort_key, reverse=True)
        recent_posts = recent_posts_list[:10]
        
        if total_posts == 0:
            return {
                "has_data": False,
                "message": "No posts yet. Start posting to see your analytics!"
            }
        
        # Build platform stats
        platform_stats = []
        for platform, count in platform_counts.items():
            platform_stats.append({
                "platform": platform,
                "posts": count,
                "followers": 0,  # Not available without API
                "engagement_rate": 0,  # Not available without API
                "note": "Connect Community Management API for real metrics"
            })
        
        return {
            "has_data": True,
            "total_posts": total_posts,
            "platform_stats": platform_stats,
            "recent_posts": recent_posts,
            "last_updated": datetime.utcnow().isoformat(),
            "note": "Showing local tracking. For impressions/likes, enable Community Management API."
        }
        
    except Exception as e:
        logger.error(f"Error fetching local analytics: {e}")
        return {
            "has_data": False,
            "message": f"Error loading analytics: {str(e)}"
        }


async def fetch_all_platform_analytics(user_id: str) -> Dict[str, Any]:
    """
    Fetch analytics from local Firestore tracking.
    """
    return await fetch_local_analytics(user_id)

