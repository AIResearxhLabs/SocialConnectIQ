"""
Scheduling Service - Auto-executes scheduled posts
Polls Firestore every 60 seconds and calls Integration Service to post
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import httpx
import os
from datetime import datetime
from typing import Optional
import logging

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials, firestore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("scheduling-service")

# Configuration
APP_ID = "default-app-id"  # Must match frontend's appId (line 40 in App.jsx)
INTEGRATION_SERVICE_URL = os.getenv("INTEGRATION_SERVICE_URL", "http://localhost:8002")
POLLING_INTERVAL = int(os.getenv("SCHEDULING_POLL_INTERVAL", "60"))  # seconds

# Firebase initialization
db = None
firebase_initialized = False

def init_firebase():
    """Initialize Firebase Admin SDK"""
    global db, firebase_initialized
    
    try:
        # Check if already initialized
        firebase_admin.get_app()
        db = firestore.client()
        firebase_initialized = True
        logger.info("✅ Firebase already initialized")
    except ValueError:
        # Initialize with credentials from environment
        try:
            firebase_project_id = os.getenv("FIREBASE_PROJECT_ID")
            firebase_private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n')
            firebase_client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
            
            if firebase_project_id and firebase_private_key and firebase_client_email:
                cred = credentials.Certificate({
                    "type": "service_account",
                    "project_id": firebase_project_id,
                    "private_key": firebase_private_key,
                    "client_email": firebase_client_email,
                    "token_uri": "https://oauth2.googleapis.com/token",
                })
                firebase_admin.initialize_app(cred)
                db = firestore.client()
                firebase_initialized = True
                logger.info("✅ Firebase initialized successfully")
            else:
                logger.error("❌ Firebase credentials missing in environment")
        except Exception as e:
            logger.error(f"❌ Firebase initialization failed: {e}")

async def post_to_platform(platform: str, content: str, user_id: str) -> dict:
    """
    Call Integration Service to post content to a platform
    """
    url = f"{INTEGRATION_SERVICE_URL}/api/integrations/{platform}/post"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                url,
                json={
                    "content": content,
                    "user_id": user_id
                },
                headers={
                    "Content-Type": "application/json",
                    "X-User-ID": user_id
                }
            )
            
            if response.status_code == 200:
                return {"success": True, "platform": platform, "response": response.json()}
            else:
                return {"success": False, "platform": platform, "error": response.text}
                
        except Exception as e:
            logger.error(f"❌ Error posting to {platform}: {e}")
            return {"success": False, "platform": platform, "error": str(e)}

async def process_scheduled_posts():
    """
    Poll Firestore for due posts and execute them
    """
    if not firebase_initialized or not db:
        logger.warning("⚠️ Firebase not initialized, skipping poll")
        return
    
    # Use UTC for consistent timezone handling
    now = datetime.utcnow()
    logger.info(f"🔍 Checking for scheduled posts due before {now.isoformat()} UTC")
    
    try:
        # OPTIMIZED: Use collection_group to query ALL scheduled_posts at once
        # This is much faster than looping through each user
        logger.info("   📂 Using collection_group query for scheduled_posts")
        
        # Query all scheduled_posts with status='pending' across all users
        posts_query = db.collection_group('scheduled_posts').where('status', '==', 'pending')
        posts = list(posts_query.stream())
        
        logger.info(f"   📝 Found {len(posts)} pending posts across all users")
        
        posts_list = []
        
        for post_doc in posts:
            post_data = post_doc.to_dict()
            scheduled_time = post_data.get('scheduledTime')
            
            # Handle Firestore timestamp - convert to UTC datetime
            if hasattr(scheduled_time, 'seconds'):
                # Firestore timestamp seconds are Unix epoch (UTC)
                scheduled_datetime = datetime.utcfromtimestamp(scheduled_time.seconds)
            elif isinstance(scheduled_time, datetime):
                # Remove timezone info and assume it's already UTC
                scheduled_datetime = scheduled_time.replace(tzinfo=None) if scheduled_time.tzinfo else scheduled_time
            else:
                continue  # Skip if no valid timestamp
            
            # Extract user_id from document path: users/{userId}/scheduled_posts/{postId}
            path_parts = post_doc.reference.path.split('/')
            user_id = path_parts[1] if len(path_parts) >= 4 else None
            
            if not user_id:
                logger.warning(f"   ⚠️ Could not extract user_id from path: {post_doc.reference.path}")
                continue
            
            # Debug logging
            logger.info(f"   ⏰ Post {post_doc.id} (user: {user_id}): scheduled={scheduled_datetime.isoformat()} UTC, now={now.isoformat()} UTC, due={scheduled_datetime <= now}")
            
            # Check if due (both are now UTC)
            if scheduled_datetime <= now:
                posts_list.append((post_doc, post_data, scheduled_datetime, user_id))
        
        if not posts_list:
            logger.info("📭 No pending posts due for execution")
            return
        
        logger.info(f"📬 Found {len(posts_list)} posts to process")
        
        for post_doc, post_data, scheduled_datetime, user_id in posts_list:
            post_id = post_doc.id
            post_ref = post_doc.reference
            
            content = post_data.get('content', '')
            platforms = post_data.get('platforms', [])
            
            logger.info(f"📤 Processing post {post_id} for user {user_id}")
            logger.info(f"   Content: {content[:50]}..." if len(content) > 50 else f"   Content: {content}")
            logger.info(f"   Platforms: {platforms}")
            
            # Track results
            results = {"success": [], "failed": []}
            platform_post_ids = {}  # Store platform post IDs for deletion feature
            
            # Post to each platform
            for platform in platforms:
                result = await post_to_platform(platform, content, user_id)
                
                if result["success"]:
                    results["success"].append(platform)
                    logger.info(f"   ✅ Posted to {platform}")
                    
                    # Extract and store post_id from platform response
                    # Response structure: {success: bool, result: {post_id/id/urn...}, error: str}
                    response_data = result.get("response", {})
                    
                    # Check top-level first, then nested in 'result'
                    post_id_key = (
                        response_data.get("post_id") or 
                        response_data.get("id") or 
                        response_data.get("postId") or
                        response_data.get("urn") or
                        # Check nested in result object 
                        (response_data.get("result", {}) or {}).get("post_id") or
                        (response_data.get("result", {}) or {}).get("id") or
                        (response_data.get("result", {}) or {}).get("urn")
                    )
                    
                    if post_id_key:
                        platform_post_ids[platform] = post_id_key
                        logger.info(f"   📌 Saved {platform} post_id: {post_id_key}")
                    else:
                        logger.warning(f"   ⚠️ No post_id found in response for {platform}: {response_data}")
                else:
                    results["failed"].append({"platform": platform, "error": result.get("error", "Unknown error")})
                    logger.error(f"   ❌ Failed to post to {platform}: {result.get('error')}")
            
            # Update Firestore document
            if results["success"] and not results["failed"]:
                # All platforms succeeded - MOVE to posts collection
                posted_data = {
                    **post_data,
                    'status': 'posted',
                    'postedAt': firestore.SERVER_TIMESTAMP,
                    'postResults': results,
                    'originalScheduledTime': post_data.get('scheduledTime')
                }
                # Add platform post IDs if captured
                if platform_post_ids:
                    posted_data['platformPostIds'] = platform_post_ids
                
                # Create in posts collection
                posts_ref = db.collection('users').document(user_id).collection('posts')
                new_post_ref = posts_ref.add(posted_data)
                logger.info(f"   ✅ Post moved to 'posts' collection with ID: {new_post_ref[1].id}")
                
                # Delete from scheduled_posts
                post_ref.delete()
                logger.info(f"   🗑️ Deleted from scheduled_posts: {post_id}")
            elif results["failed"]:
                # Some or all platforms failed
                post_ref.update({
                    'status': 'failed',
                    'error': f"Failed platforms: {[f['platform'] for f in results['failed']]}",
                    'postResults': results
                })
                logger.error(f"   ❌ Post {post_id} marked as 'failed'")
    
    except Exception as e:
        logger.error(f"❌ Error processing scheduled posts: {e}")
        import traceback
        traceback.print_exc()

async def scheduler_loop():
    """
    Background task that runs the scheduler
    """
    logger.info(f"🚀 Scheduler started - polling every {POLLING_INTERVAL} seconds")
    
    while True:
        try:
            await process_scheduled_posts()
        except Exception as e:
            logger.error(f"❌ Scheduler error: {e}")
        
        await asyncio.sleep(POLLING_INTERVAL)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager - starts scheduler on startup
    """
    # Startup
    init_firebase()
    
    # Start background scheduler task
    scheduler_task = asyncio.create_task(scheduler_loop())
    logger.info("✅ Scheduling Service started")
    
    yield
    
    # Shutdown
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    logger.info("👋 Scheduling Service stopped")

# Create FastAPI app
app = FastAPI(
    title="Scheduling Service",
    description="Auto-executes scheduled posts by polling Firestore and calling Integration Service",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Scheduling Service",
        "status": "running",
        "firebase_connected": firebase_initialized,
        "polling_interval": POLLING_INTERVAL
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "firebase": "connected" if firebase_initialized else "disconnected",
        "integration_service_url": INTEGRATION_SERVICE_URL
    }

@app.post("/trigger")
async def trigger_now():
    """
    Manually trigger the scheduler (for testing)
    """
    logger.info("🔧 Manual trigger received")
    await process_scheduled_posts()
    return {"message": "Scheduler triggered successfully"}

@app.get("/stats")
async def get_stats():
    """
    Get scheduler statistics
    """
    if not firebase_initialized or not db:
        return {"error": "Firebase not connected"}
    
    try:
        # Count posts by iterating through users (avoids index requirement)
        pending_count = 0
        posted_count = 0
        failed_count = 0
        
        users_ref = db.collection('users')
        users = users_ref.stream()
        
        for user_doc in users:
            user_id = user_doc.id
            posts_ref = db.collection(f'users/{user_id}/scheduled_posts')
            posts = posts_ref.stream()
            
            for post_doc in posts:
                post_data = post_doc.to_dict()
                status = post_data.get('status', '')
                
                if status == 'pending':
                    pending_count += 1
                elif status == 'posted':
                    posted_count += 1
                elif status == 'failed':
                    failed_count += 1
        
        return {
            "pending": pending_count,
            "posted": posted_count,
            "failed": failed_count,
            "total": pending_count + posted_count + failed_count
        }
    except Exception as e:
        return {"error": str(e)}
