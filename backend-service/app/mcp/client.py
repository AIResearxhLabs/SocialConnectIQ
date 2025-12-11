"""
MCP Server client for social media integrations
"""
import httpx
from typing import Dict, Any, Optional
import sys
import os

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.logging_utils import CorrelationLogger

logger = CorrelationLogger(
    service_name="MCP-CLIENT",
    log_file="logs/centralized.log"
)


class MCPClient:
    """Client for interacting with MCP Server"""
    
    def __init__(self, mcp_url: str, timeout: int = 30):
        self.mcp_url = mcp_url
        self.timeout = timeout
    
    async def call_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        correlation_id: str = "unknown",
        user_id: str = "anonymous"
    ) -> Dict[str, Any]:
        """Call an MCP tool with parameters"""
        
        url = f"{self.mcp_url}/tools/{tool_name}/run"
        
        logger.info(
            f"Calling MCP tool: {tool_name}",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"tool": tool_name, "url": url}
        )
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    json=parameters,
                    timeout=self.timeout
                )
                
                response.raise_for_status()
                result = response.json()
                
                logger.success(
                    f"MCP tool {tool_name} completed successfully",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"tool": tool_name, "status_code": response.status_code}
                )
                
                return result
                
            except httpx.HTTPStatusError as e:
                logger.error(
                    f"MCP tool {tool_name} returned error: {e.response.status_code}",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={
                        "tool": tool_name,
                        "status_code": e.response.status_code,
                        "response": e.response.text[:200]
                    }
                )
                raise
                
            except httpx.RequestError as e:
                logger.error(
                    f"Failed to connect to MCP server for tool {tool_name}: {str(e)}",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"tool": tool_name, "error": str(e)}
                )
                raise
    
    async def get_linkedin_auth_url(
        self,
        user_id: str,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """Get LinkedIn authorization URL"""
        return await self.call_tool(
            "getLinkedInAuthUrl",
            {"userId": user_id},
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def handle_linkedin_callback(
        self,
        code: str,
        user_id: str,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """Handle LinkedIn OAuth callback"""
        return await self.call_tool(
            "handleLinkedInAuthCallback",
            {"code": code, "userId": user_id},
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def post_to_linkedin(
        self,
        content: str,
        access_token: str,
        user_id: str,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """Post content to LinkedIn"""
        return await self.call_tool(
            "postToLinkedIn",
            {"content": content, "accessToken": access_token, "userId": user_id},
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def get_facebook_auth_url(
        self,
        user_id: str,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """Get Facebook authorization URL"""
        return await self.call_tool(
            "getFacebookAuthUrl",
            {"userId": user_id},
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def handle_facebook_callback(
        self,
        code: str,
        user_id: str,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """Handle Facebook OAuth callback"""
        return await self.call_tool(
            "handleFacebookAuthCallback",
            {"code": code, "userId": user_id},
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def post_to_facebook(
        self,
        content: str,
        access_token: str,
        user_id: str,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """Post content to Facebook"""
        return await self.call_tool(
            "postToFacebook",
            {"content": content, "accessToken": access_token, "userId": user_id},
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def get_twitter_auth_url(
        self,
        user_id: str,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """Get Twitter authorization URL"""
        return await self.call_tool(
            "getTwitterAuthUrl",
            {"userId": user_id},
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def handle_twitter_callback(
        self,
        code: str,
        user_id: str,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """Handle Twitter OAuth callback"""
        return await self.call_tool(
            "handleTwitterAuthCallback",
            {"code": code, "userId": user_id},
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def post_to_twitter(
        self,
        content: str,
        access_token: str,
        user_id: str,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """Post content to Twitter"""
        return await self.call_tool(
            "postToTwitter",
            {"content": content, "accessToken": access_token, "userId": user_id},
            correlation_id=correlation_id,
            user_id=user_id
        )
