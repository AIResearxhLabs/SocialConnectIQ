from datetime import datetime, timezone
from google.cloud import firestore
import logging

logger = logging.getLogger(__name__)

async def check_user_limit(user_id: str, db: firestore.AsyncClient) -> bool:
    """
    Checks if a user has reached their monthly post limit.
    for 'basic' plan, limit is 5 posts per month.
    
    Args:
        user_id: The ID of the user.
        db: Firestore async client.
        
    Returns:
        bool: True if user is within limit, False if limit reached.
    """
    if not user_id:
        return True # specific error handling might be better, but fail open for now if no user

    try:
        # 1. Get User Plan
        user_ref = db.collection('users').document(user_id)
        user_doc = await user_ref.get()
        
        plan = 'basic' # Default
        if user_doc.exists:
            user_data = user_doc.to_dict()
            plan = user_data.get('plan', 'basic')
            
        # If not basic, assume unlimited for now (or high limit)
        if plan != 'basic':
            return True

        LIMIT = 5

        # 2. Count posts for current month
        now = datetime.now(timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        
        # We need to query the 'posts' collection (new standard) 
        # based on 'createdAt' timestamp
        posts_ref = db.collection('users').document(user_id).collection('posts')
        query = posts_ref.where('createdAt', '>=', start_of_month)
        
        # Count documents (using aggregation query would be better for cost, 
        # but standard generic get is fine for low limits)
        docs = await query.get()
        count = len(docs)
        
        logger.info(f"User {user_id} (plan: {plan}) has {count}/{LIMIT} posts this month.")
        
        if count >= LIMIT:
            return False
            
        return True

    except Exception as e:
        logger.error(f"Error checking user limit for {user_id}: {e}")
        # Fail safe: allow posting if check fails to avoid outage due to limit service
        return True
