"""
MCP Server Tools for LangChain Agent
Wraps MCP server API calls as LangChain tools
"""
from typing import Optional, Dict, Any
import httpx
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential
from .config import settings
import logging

logger = logging.getLogger(__name__)


class MCPServerClient:
    """HTTP client for MCP server with retry logic"""
    
    def __init__(self):
        self.base_url = settings.mcp_server.base_url
        self.timeout = settings.mcp_server.timeout
        self.retry_attempts = settings.mcp_server.retry_attempts
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Make POST request to MCP server"""
        url = f"{self.base_url}{endpoint}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=data)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"MCP server request failed: {e}")
                raise
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def get(self, endpoint: str) -> Dict[str, Any]:
        """Make GET request to MCP server"""
        url = f"{self.base_url}{endpoint}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"MCP server request failed: {e}")
                raise


# Initialize MCP client
mcp_client = MCPServerClient()


# ============================================================================
# Tool Input Schemas
# ============================================================================

class LinkedInAuthInput(BaseModel):
    """Input for LinkedIn authentication"""
    user_id: str = Field(description="The user ID requesting authentication")


class PostContentInput(BaseModel):
    """Input for posting content"""
    content: str = Field(description="The content to post")
    user_id: Optional[str] = Field(None, description="User ID for tracking")


class CaptionGenerationInput(BaseModel):
    """Input for caption generation"""
    topic: str = Field(description="Topic or theme for the caption")
    platform: str = Field(default="linkedin", description="Target social media platform")
    tone: str = Field(default="professional", description="Desired tone (professional, casual, friendly)")
    max_length: Optional[int] = Field(None, description="Maximum caption length")


class ScheduleOptimizationInput(BaseModel):
    """Input for schedule optimization"""
    platform: str = Field(description="Target platform (linkedin, facebook, twitter, instagram)")
    content_type: str = Field(default="text", description="Type of content (text, image, video)")
    user_id: Optional[str] = Field(None, description="User ID for personalization")


# ============================================================================
# LangChain Tools
# ============================================================================

class LinkedInAuthenticateTool(BaseTool):
    """Tool to initiate LinkedIn OAuth authentication"""
    name = "linkedin_authenticate"
    description = """
    Use this tool to initiate the LinkedIn OAuth authentication flow.
    Returns an authentication URL that the user needs to visit to authorize the application.
    Input should be the user_id.
    """
    args_schema = LinkedInAuthInput
    
    async def _arun(self, user_id: str) -> str:
        """Async implementation"""
        try:
            result = await mcp_client.get("/api/auth/linkedin")
            auth_url = result.get("auth_url", "")
            return f"LinkedIn authentication initiated. Please visit: {auth_url}"
        except Exception as e:
            return f"Error initiating LinkedIn authentication: {str(e)}"
    
    def _run(self, user_id: str) -> str:
        """Sync implementation (not used in async context)"""
        raise NotImplementedError("Use async version")


class LinkedInPostTool(BaseTool):
    """Tool to create a post on LinkedIn"""
    name = "linkedin_post"
    description = """
    Use this tool to create and publish a post on LinkedIn.
    Input should include the content to post.
    Make sure the user is authenticated before using this tool.
    """
    args_schema = PostContentInput
    
    async def _arun(self, content: str, user_id: Optional[str] = None) -> str:
        """Async implementation"""
        try:
            result = await mcp_client.post("/api/linkedin/posts", {"content": content})
            post_id = result.get("id", "")
            return f"Successfully posted to LinkedIn. Post ID: {post_id}"
        except Exception as e:
            return f"Error posting to LinkedIn: {str(e)}"
    
    def _run(self, content: str, user_id: Optional[str] = None) -> str:
        """Sync implementation (not used in async context)"""
        raise NotImplementedError("Use async version")


class FacebookPostTool(BaseTool):
    """Tool to create a post on Facebook"""
    name = "facebook_post"
    description = """
    Use this tool to create and publish a post on Facebook.
    Input should include the content to post.
    """
    args_schema = PostContentInput
    
    async def _arun(self, content: str, user_id: Optional[str] = None) -> str:
        """Async implementation"""
        try:
            result = await mcp_client.post("/api/facebook/posts", {"content": content})
            post_id = result.get("id", "")
            return f"Successfully posted to Facebook. Post ID: {post_id}"
        except Exception as e:
            return f"Error posting to Facebook: {str(e)}"
    
    def _run(self, content: str, user_id: Optional[str] = None) -> str:
        """Sync implementation (not used in async context)"""
        raise NotImplementedError("Use async version")


class TwitterPostTool(BaseTool):
    """Tool to create a post on Twitter"""
    name = "twitter_post"
    description = """
    Use this tool to create and publish a tweet on Twitter.
    Input should include the content to post. Remember Twitter has a 280 character limit.
    """
    args_schema = PostContentInput
    
    async def _arun(self, content: str, user_id: Optional[str] = None) -> str:
        """Async implementation"""
        try:
            # Check character limit
            if len(content) > 280:
                return f"Error: Tweet exceeds 280 characters ({len(content)} characters). Please shorten the content."
            
            result = await mcp_client.post("/api/twitter/posts", {"content": content})
            tweet_id = result.get("id", "")
            return f"Successfully posted to Twitter. Tweet ID: {tweet_id}"
        except Exception as e:
            return f"Error posting to Twitter: {str(e)}"
    
    def _run(self, content: str, user_id: Optional[str] = None) -> str:
        """Sync implementation (not used in async context)"""
        raise NotImplementedError("Use async version")


class InstagramPostTool(BaseTool):
    """Tool to create a post on Instagram"""
    name = "instagram_post"
    description = """
    Use this tool to create and publish a post on Instagram.
    Input should include the content (caption) to post.
    Note: Instagram posts typically require images, which should be handled separately.
    """
    args_schema = PostContentInput
    
    async def _arun(self, content: str, user_id: Optional[str] = None) -> str:
        """Async implementation"""
        try:
            result = await mcp_client.post("/api/instagram/posts", {"content": content})
            post_id = result.get("id", "")
            return f"Successfully posted to Instagram. Post ID: {post_id}"
        except Exception as e:
            return f"Error posting to Instagram: {str(e)}"
    
    def _run(self, content: str, user_id: Optional[str] = None) -> str:
        """Sync implementation (not used in async context)"""
        raise NotImplementedError("Use async version")


class GenerateCaptionTool(BaseTool):
    """Tool to generate AI-powered captions"""
    name = "generate_caption"
    description = """
    Use this tool to generate engaging, AI-powered captions for social media posts.
    Input should include the topic, target platform, and desired tone.
    This tool uses GPT-4o internally to create compelling content.
    """
    args_schema = CaptionGenerationInput
    
    async def _arun(
        self, 
        topic: str, 
        platform: str = "linkedin", 
        tone: str = "professional",
        max_length: Optional[int] = None
    ) -> str:
        """Async implementation - delegates to GPT-4o"""
        try:
            # This will be handled by the agent's GPT-4o instance
            # We return a structured request that the agent can process
            platform_info = {
                "linkedin": {"max_chars": 3000, "style": "professional and insightful"},
                "twitter": {"max_chars": 280, "style": "concise and engaging"},
                "facebook": {"max_chars": 63206, "style": "friendly and conversational"},
                "instagram": {"max_chars": 2200, "style": "visual and engaging"}
            }
            
            info = platform_info.get(platform.lower(), platform_info["linkedin"])
            max_chars = max_length or info["max_chars"]
            
            prompt = f"""Generate a {tone} caption for {platform} about: {topic}
            
Style: {info['style']}
Maximum length: {max_chars} characters
Include relevant hashtags if appropriate for the platform.

Caption:"""
            
            return prompt
        except Exception as e:
            return f"Error generating caption: {str(e)}"
    
    def _run(
        self, 
        topic: str, 
        platform: str = "linkedin", 
        tone: str = "professional",
        max_length: Optional[int] = None
    ) -> str:
        """Sync implementation (not used in async context)"""
        raise NotImplementedError("Use async version")


class OptimizeScheduleTool(BaseTool):
    """Tool to suggest optimal posting times"""
    name = "optimize_schedule"
    description = """
    Use this tool to get AI-powered recommendations for the best time to schedule a post.
    Input should include the target platform and content type.
    Returns suggested timing based on audience engagement patterns.
    """
    args_schema = ScheduleOptimizationInput
    
    async def _arun(
        self, 
        platform: str, 
        content_type: str = "text",
        user_id: Optional[str] = None
    ) -> str:
        """Async implementation"""
        try:
            result = await mcp_client.post(
                "/api/gemini/schedule",
                {
                    "platform": platform,
                    "content_type": content_type
                }
            )
            suggested_time = result.get("suggested_time", "")
            reason = result.get("reason", "")
            return f"Optimal posting time for {platform}: {suggested_time}. Reason: {reason}"
        except Exception as e:
            return f"Error optimizing schedule: {str(e)}"
    
    def _run(
        self, 
        platform: str, 
        content_type: str = "text",
        user_id: Optional[str] = None
    ) -> str:
        """Sync implementation (not used in async context)"""
        raise NotImplementedError("Use async version")


# ============================================================================
# Tool Registry
# ============================================================================

def get_all_tools() -> list[BaseTool]:
    """Get all available tools for the agent"""
    return [
        LinkedInAuthenticateTool(),
        LinkedInPostTool(),
        FacebookPostTool(),
        TwitterPostTool(),
        InstagramPostTool(),
        GenerateCaptionTool(),
        OptimizeScheduleTool(),
    ]
