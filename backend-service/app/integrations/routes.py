"""
Main integration routes - aggregates all platform routers
"""
from fastapi import APIRouter, Request, Header
from pydantic import BaseModel
from typing import List, Optional
import sys
import os

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.logging_utils import CorrelationLogger

from . import content

logger = CorrelationLogger(
    service_name="BACKEND-SERVICE-INTEGRATIONS",
    log_file="logs/centralized.log"
)

# Create main integration router
router = APIRouter(prefix="/api/integrations", tags=["Integrations"])

# Include content refinement router
router.include_router(content.router)

# Note: Platform OAuth routers (LinkedIn, Twitter, Facebook) are now in Integration Service (port 8002)
# This service only handles content preview and business logic


# Preview Post Model
class PreviewRequest(BaseModel):
    content: str
    platforms: List[str]
    image_data: Optional[str] = None
    image_mime_type: Optional[str] = None


class PlatformPreview(BaseModel):
    platform: str
    platformName: str
    textContent: str
    hasImage: bool
    imagePreviewUrl: Optional[str] = None
    warning: Optional[str] = None
    canPost: bool


@router.post("/preview")
async def preview_post(
    request: Request,
    preview_request: PreviewRequest,
    user_id: str = Header(..., alias="X-User-ID")
):
    """
    Generate preview of what will be posted to each platform
    WITHOUT actually posting
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    logger.info(
        "Backend Service: Generating post preview",
        correlation_id=correlation_id,
        user_id=user_id,
        additional_data={
            "platforms": preview_request.platforms,
            "content_length": len(preview_request.content),
            "has_image": bool(preview_request.image_data)
        }
    )
    
    previews = []
    
    # Platform name mapping
    platform_names = {
        "linkedin": "LinkedIn",
        "twitter": "Twitter",
        "facebook": "Facebook"
    }
    
    for platform in preview_request.platforms:
        platform_name = platform_names.get(platform, platform.capitalize())
        
        # Base preview object
        preview = PlatformPreview(
            platform=platform,
            platformName=platform_name,
            textContent=preview_request.content or "[Image only]",
            hasImage=bool(preview_request.image_data),
            imagePreviewUrl=f"data:{preview_request.image_mime_type};base64,{preview_request.image_data}" if preview_request.image_data else None,
            warning=None,
            canPost=True
        )
        
        # Platform-specific validations and warnings
        if platform == "twitter":
            # Twitter has 280 character limit
            if len(preview_request.content) > 280:
                preview.warning = "Text will be truncated to 280 characters"
                preview.textContent = preview_request.content[:280] + "..."
            
            # Twitter image size recommendations
            if preview_request.image_data:
                # Estimate base64 size (rough calculation)
                estimated_size_mb = len(preview_request.image_data) * 0.75 / (1024 * 1024)
                if estimated_size_mb > 5:
                    preview.warning = "Image may be compressed by Twitter (exceeds 5MB)"
        
        elif platform == "linkedin":
            # LinkedIn has 3000 character limit for posts
            if len(preview_request.content) > 3000:
                preview.warning = "Text exceeds LinkedIn's 3000 character limit"
                preview.textContent = preview_request.content[:3000] + "..."
            
            # LinkedIn image size recommendations
            if preview_request.image_data:
                estimated_size_mb = len(preview_request.image_data) * 0.75 / (1024 * 1024)
                if estimated_size_mb > 10:
                    preview.warning = "Image may need to be compressed (LinkedIn recommends under 10MB)"
        
        elif platform == "facebook":
            # Facebook has 63,206 character limit (very high)
            if len(preview_request.content) > 63206:
                preview.warning = "Text exceeds Facebook's character limit"
                preview.textContent = preview_request.content[:63206] + "..."
        
        previews.append(preview)
    
    logger.success(
        "Backend Service: Post preview generated successfully",
        correlation_id=correlation_id,
        user_id=user_id,
        additional_data={"preview_count": len(previews)}
    )
    
    return {
        "success": True,
        "previews": [p.dict() for p in previews]
    }
