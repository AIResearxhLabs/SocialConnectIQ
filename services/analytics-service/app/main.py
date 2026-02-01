from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from .models import AnalyticsOverview
from .mock_data import generate_mock_analytics
from .platform_analytics import fetch_all_platform_analytics
import uvicorn
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SocialConnectIQ Analytics Service", version="1.0.0")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"], # Allow Frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analytics-service"}

@app.get("/analytics/overview")
async def get_analytics_overview(user_id: Optional[str] = Header(None, alias="X-User-ID")):
    """
    Get analytics overview from local Firestore tracking.
    Tracks posts made through SocialConnectIQ.
    """
    try:
        logger.info(f"🔍 [ANALYTICS] Request received. Raw User ID Header: '{user_id}'")
        
        if not user_id or user_id == "null" or user_id == "undefined":
            logger.error("❌ [ANALYTICS] No valid user_id provided in header")
            return {
                "has_data": False,
                "message": "Please log in to see your analytics. (ID missing)"
            }
        
        logger.info(f"🚀 [ANALYTICS] Fetching data for validated user_id: {user_id}")
        result = await fetch_all_platform_analytics(user_id)
        
        # Add last_updated timestamp
        if "last_updated" not in result:
            from datetime import datetime
            result["last_updated"] = datetime.utcnow().isoformat()
        
        return result
            
    except Exception as e:
        logger.error(f"Error generating analytics: {e}")
        return {
            "has_data": False,
            "message": "Unable to load analytics. Please try again later."
        }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8004, reload=True)

