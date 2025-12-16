"""
Content refinement routes - AI-powered content enhancement
"""
from fastapi import APIRouter, Request, Header
from pydantic import BaseModel
from typing import Optional, List
import httpx
import sys
import os

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.logging_utils import CorrelationLogger

from ..config import config

# Initialize logger
logger = CorrelationLogger(
    service_name="BACKEND-SERVICE-CONTENT",
    log_file=config.LOG_FILE
)

# Create router
router = APIRouter(prefix="/content", tags=["Content"])


# Request/Response Models
class RefineContentRequest(BaseModel):
    original_content: str
    refinement_instructions: Optional[str] = None
    tone: Optional[str] = None  # professional, casual, humorous, enthusiastic, informative, neutral
    platform: Optional[str] = None  # linkedin, twitter, facebook
    generate_alternatives: bool = False


class RefineContentResponse(BaseModel):
    success: bool
    refined_content: Optional[str] = None
    suggestions: Optional[List[str]] = None
    alternatives: Optional[List[str]] = None
    metadata: Optional[dict] = None
    error: Optional[str] = None


@router.post("/refine", response_model=RefineContentResponse)
async def refine_content(
    request: Request,
    refine_request: RefineContentRequest,
    user_id: str = Header(..., alias="X-User-ID")
):
    """
    Refine content using AI-powered Content Refinement Agent
    
    This endpoint proxies requests to the Agent Service which uses
    OpenAI GPT-4o to enhance content clarity, engagement, and
    platform-specific optimization.
    
    Parameters:
    - original_content: User's original thought/idea
    - refinement_instructions: Optional specific instructions for refinement
    - tone: Desired tone (professional, casual, humorous, etc.)
    - platform: Target platform (linkedin, twitter, facebook)
    - generate_alternatives: Whether to generate alternative versions
    
    Returns:
    - refined_content: LLM-enhanced version of the content
    - suggestions: Helpful tips and recommendations
    - alternatives: Alternative versions (if requested)
    - metadata: Processing information
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    logger.info(
        f"Backend Service: Received content refinement request",
        correlation_id=correlation_id,
        user_id=user_id,
        additional_data={
            "original_length": len(refine_request.original_content),
            "tone": refine_request.tone,
            "platform": refine_request.platform,
            "has_instructions": bool(refine_request.refinement_instructions),
            "generate_alternatives": refine_request.generate_alternatives
        }
    )
    
    try:
        # Prepare request to Agent Service
        agent_request = {
            "user_id": user_id,
            "original_content": refine_request.original_content,
            "refinement_instructions": refine_request.refinement_instructions,
            "tone": refine_request.tone,
            "platform": refine_request.platform,
            "generate_alternatives": refine_request.generate_alternatives
        }
        
        logger.info(
            f"Backend Service: Calling Agent Service for content refinement",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"agent_service_url": config.AGENT_SERVICE_URL}
        )
        
        # Call Agent Service
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{config.AGENT_SERVICE_URL}/agent/content/refine",
                json=agent_request,
                headers={"X-Correlation-ID": correlation_id}
            )
            
            logger.info(
                f"Backend Service: Agent Service responded",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={
                    "status_code": response.status_code,
                    "response_ok": response.is_success
                }
            )
            
            if not response.is_success:
                error_detail = "Agent Service request failed"
                try:
                    error_data = response.json()
                    error_detail = error_data.get("detail", error_detail)
                except:
                    pass
                
                logger.error(
                    f"Backend Service: Agent Service error: {error_detail}",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"status_code": response.status_code}
                )
                
                return RefineContentResponse(
                    success=False,
                    error=error_detail
                )
            
            result = response.json()
            
            if result.get("success"):
                logger.success(
                    f"Backend Service: Content refinement completed successfully",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={
                        "refined_length": len(result.get("refined_content", "")),
                        "suggestions_count": len(result.get("suggestions", [])),
                        "alternatives_count": len(result.get("alternatives", []))
                    }
                )
            else:
                logger.error(
                    f"Backend Service: Content refinement failed: {result.get('error')}",
                    correlation_id=correlation_id,
                    user_id=user_id
                )
            
            return RefineContentResponse(
                success=result.get("success", False),
                refined_content=result.get("refined_content"),
                suggestions=result.get("suggestions"),
                alternatives=result.get("alternatives"),
                metadata=result.get("metadata"),
                error=result.get("error")
            )
            
    except httpx.TimeoutException:
        logger.error(
            f"Backend Service: Agent Service timeout",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"error": "Request timeout"}
        )
        
        return RefineContentResponse(
            success=False,
            error="Content refinement service timeout. Please try again."
        )
        
    except httpx.RequestError as e:
        logger.error(
            f"Backend Service: Failed to connect to Agent Service: {str(e)}",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"error": str(e)}
        )
        
        return RefineContentResponse(
            success=False,
            error=f"Failed to connect to content refinement service: {str(e)}"
        )
        
    except Exception as e:
        logger.error(
            f"Backend Service: Unexpected error in content refinement: {str(e)}",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"error": str(e)}
        )
        
        return RefineContentResponse(
            success=False,
            error=f"An unexpected error occurred: {str(e)}"
        )
