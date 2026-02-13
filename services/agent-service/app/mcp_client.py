"""
MCP (Model Context Protocol) Client
Handles communication with the MCP server for tool discovery and invocation
"""
import httpx
import logging
import time
import sys
import os
from typing import Dict, List, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.mcp_logging_utils import MCPInteractionLogger

logger = logging.getLogger(__name__)
mcp_logger = MCPInteractionLogger("AGENT-SERVICE-MCP-CLIENT")


class MCPClient:
    """Client for interacting with MCP server"""
    
    def __init__(self, mcp_server_url: str):
        self.mcp_server_url = mcp_server_url.rstrip('/')
        self.tools_cache: Optional[Dict[str, Any]] = None
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
    
    async def refresh_tools_cache(self) -> Dict[str, Any]:
        """
        Force refresh the tools cache from MCP server
        Returns: Dictionary of available tools with their schemas
        """
        logger.info("Force refreshing MCP tools cache")
        self.tools_cache = None
        return await self.discover_tools()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def discover_tools(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Discover available tools from MCP server
        Args:
            force_refresh: If True, bypass cache and fetch fresh tools
        Returns: Dictionary of available tools with their schemas
        """
        if force_refresh:
            logger.info("Force refresh requested - clearing cache")
            self.tools_cache = None
        
        try:
            logger.info(f"Discovering tools from MCP server: {self.mcp_server_url}/mcp/tools")
            response = await self.client.get(f"{self.mcp_server_url}/mcp/tools")
            response.raise_for_status()
            
            tools_data = response.json()
            
            # Handle both list and dict responses
            if isinstance(tools_data, list):
                # MCP server returned a list of tools directly
                self.tools_cache = {'tools': tools_data}
                logger.info(f"Successfully discovered {len(tools_data)} tools")
            elif isinstance(tools_data, dict):
                # MCP server returned a dict (may or may not have 'tools' key)
                self.tools_cache = tools_data if 'tools' in tools_data else {'tools': [tools_data]}
                logger.info(f"Successfully discovered {len(self.tools_cache.get('tools', []))} tools")
            else:
                logger.warning(f"Unexpected tools data format: {type(tools_data)}")
                self.tools_cache = {'tools': []}
            
            # Log all discovered tool names
            tool_names = [tool.get('name') for tool in self.tools_cache.get('tools', [])]
            logger.info(f"Available MCP tools: {tool_names}")
            
            return self.tools_cache
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error discovering tools: {e.response.status_code} - {e.response.text}")
            raise Exception(f"Failed to discover MCP tools: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"Request error discovering tools: {str(e)}")
            raise Exception(f"Failed to connect to MCP server: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error discovering tools: {str(e)}")
            raise
    
    async def get_tool_schema(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """
        Get schema for a specific tool
        Args:
            tool_name: Name of the tool
        Returns: Tool schema or None if not found
        """
        if not self.tools_cache:
            await self.discover_tools()
        
        tools = self.tools_cache.get('tools', [])
        for tool in tools:
            if tool.get('name') == tool_name:
                return tool
        
        logger.warning(f"Tool '{tool_name}' not found in MCP server")
        return None
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def invoke_tool(
        self, 
        tool_name: str, 
        parameters: Dict[str, Any],
        correlation_id: str = "unknown",
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Invoke a tool on the MCP server using JSON-RPC protocol
        Args:
            tool_name: Name of the tool to invoke
            parameters: Parameters to pass to the tool
            correlation_id: Correlation ID for request tracing
            user_id: User ID for logging
        Returns: Tool execution result
        """
        start_time = time.time()
        endpoint = f"{self.mcp_server_url}/mcp/v1"
        
        try:
            # Get tool schema to validate
            tool_schema = await self.get_tool_schema(tool_name)
            if not tool_schema:
                raise ValueError(f"Tool '{tool_name}' not found on MCP server")
            
            # Create JSON-RPC request
            json_rpc_request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": parameters
                }
            }
            
            # Log detailed request
            mcp_logger.log_mcp_request(
                correlation_id=correlation_id,
                tool_name=tool_name,
                endpoint=endpoint,
                method="POST",
                headers={"Content-Type": "application/json"},
                payload=json_rpc_request,
                user_id=user_id
            )
            
            logger.info(f"Invoking tool '{tool_name}' at {endpoint} using JSON-RPC")
            logger.debug(f"JSON-RPC Request: {json_rpc_request}")
            
            response = await self.client.post(
                endpoint,
                json=json_rpc_request,
                headers={"Content-Type": "application/json"}
            )
            
            elapsed_time = time.time() - start_time
            
            response.raise_for_status()
            
            json_rpc_response = response.json()
            logger.debug(f"JSON-RPC Response: {json_rpc_response}")
            
            # Log detailed response
            mcp_logger.log_mcp_response(
                correlation_id=correlation_id,
                tool_name=tool_name,
                status_code=response.status_code,
                response_headers=dict(response.headers),
                response_body=json_rpc_response,
                elapsed_time=elapsed_time,
                user_id=user_id
            )
            
            # Extract result from JSON-RPC response
            if "error" in json_rpc_response:
                error = json_rpc_response["error"]
                error_msg = error.get('message', 'Unknown error')
                logger.error(f"JSON-RPC error: {error}")
                
                mcp_logger.log_mcp_error(
                    correlation_id=correlation_id,
                    tool_name=tool_name,
                    error=error_msg,
                    user_id=user_id,
                    additional_data={"json_rpc_error": error}
                )
                
                raise Exception(f"MCP tool error: {error_msg}")
            
            result = json_rpc_response.get("result", {})
            
            # MCP server returns content in a nested structure: result.content[0].text
            # The text field contains a JSON string that needs to be parsed
            if isinstance(result, dict) and "content" in result:
                content = result.get("content", [])
                if content and len(content) > 0:
                    text_content = content[0].get("text", "")
                    if text_content:
                        import json
                        try:
                            # Parse the JSON string from the text field
                            result = json.loads(text_content)
                        except json.JSONDecodeError as e:
                            logger.warning(f"Failed to parse JSON from text content: {e}")
                            # Return the text as-is if it's not valid JSON
                            result = {"text": text_content}
            
            logger.info(f"Tool '{tool_name}' executed successfully")
            logger.debug(f"Result: {result}")
            
            return result
            
        except httpx.HTTPStatusError as e:
            elapsed_time = time.time() - start_time
            error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
            
            logger.error(f"HTTP error invoking tool '{tool_name}': {e.response.status_code} - {e.response.text}")
            
            mcp_logger.log_mcp_response(
                correlation_id=correlation_id,
                tool_name=tool_name,
                status_code=e.response.status_code,
                response_headers=dict(e.response.headers),
                response_body=e.response.text,
                elapsed_time=elapsed_time,
                user_id=user_id,
                error=error_msg
            )
            
            raise Exception(f"Failed to invoke tool '{tool_name}': {e.response.status_code}")
            
        except httpx.RequestError as e:
            elapsed_time = time.time() - start_time
            error_msg = f"Request error: {str(e)}"
            
            logger.error(f"Request error invoking tool '{tool_name}': {str(e)}")
            
            mcp_logger.log_mcp_error(
                correlation_id=correlation_id,
                tool_name=tool_name,
                error=error_msg,
                user_id=user_id,
                additional_data={"elapsed_time": f"{elapsed_time:.3f}s"}
            )
            
            raise Exception(f"Failed to connect to MCP server: {str(e)}")
            
        except Exception as e:
            elapsed_time = time.time() - start_time
            error_msg = str(e)
            
            logger.error(f"Unexpected error invoking tool '{tool_name}': {str(e)}")
            
            mcp_logger.log_mcp_error(
                correlation_id=correlation_id,
                tool_name=tool_name,
                error=error_msg,
                user_id=user_id,
                additional_data={"elapsed_time": f"{elapsed_time:.3f}s"}
            )
            
            raise
    
    async def get_linkedin_auth_url(self, user_id: str, correlation_id: str = "unknown", callback_url: str = None) -> Dict[str, Any]:
        """
        Get LinkedIn OAuth authorization URL with correlation tracking
        Args:
            user_id: User identifier
            correlation_id: Correlation ID for request tracing
            callback_url: Optional callback URL to override MCP server default
        Returns: Dict containing auth_url and state
        """
        import os
        start_time = time.time()
        
        # Get callback URL from environment if not provided
        if not callback_url:
            callback_url = os.getenv("LINKEDIN_REDIRECT_URI", "http://localhost:8000/api/integrations/linkedin/callback")
        
        logger.info(
            f"MCP Client: Calling getLinkedInAuthUrl tool | "
            f"correlation_id={correlation_id} | user_id={user_id} | "
            f"callback_url={callback_url} | "
            f"mcp_url={self.mcp_server_url}"
        )
        
        try:
            # Pass callbackUrl parameter to MCP server (as per MCP schema)
            parameters = {
                "callbackUrl": callback_url
            }
            
            result = await self.invoke_tool(
                tool_name="getLinkedInAuthUrl",
                parameters=parameters,
                correlation_id=correlation_id,
                user_id=user_id
            )
            
            elapsed = time.time() - start_time
            logger.info(
                f"MCP Client: getLinkedInAuthUrl completed in {elapsed:.2f}s | "
                f"correlation_id={correlation_id} | "
                f"has_auth_url={'auth_url' in result or 'authUrl' in result}"
            )
            
            return result
            
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                f"MCP Client: getLinkedInAuthUrl failed after {elapsed:.2f}s | "
                f"correlation_id={correlation_id} | error={str(e)}"
            )
            raise
    
    async def handle_linkedin_callback(
        self, 
        code: str, 
        user_id: str, 
        callback_url: str = None,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Handle LinkedIn OAuth callback and exchange code for tokens
        Args:
            code: Authorization code from LinkedIn
            user_id: User identifier
            callback_url: Optional callback URL (must match the one used in auth URL)
            correlation_id: Correlation ID for request tracing
        Returns: Dict containing access tokens and user info
        """
        import os
        
        # Get callback URL from environment if not provided
        if not callback_url:
            callback_url = os.getenv("LINKEDIN_REDIRECT_URI", "http://localhost:8000/api/integrations/linkedin/callback")
        
        # Pass callbackUrl parameter to MCP server (as per MCP schema)
        parameters = {
            "code": code,
            "callbackUrl": callback_url
        }
        
        return await self.invoke_tool(
            tool_name="exchangeLinkedInAuthCode",
            parameters=parameters,
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
        """
        Post content to LinkedIn
        Args:
            content: Content to post
            access_token: LinkedIn access token
            user_id: User identifier
            correlation_id: Correlation ID for request tracing
        Returns: Post result
        """
        return await self.invoke_tool(
            tool_name="postToLinkedIn",
            parameters={
                "content": content,
                "accessToken": access_token,
                "userId": user_id
            },
            correlation_id=correlation_id,
            user_id=user_id
        )

    # =========================================================================
    # Facebook OAuth Methods
    # =========================================================================

    async def get_facebook_auth_url(self, user_id: str, correlation_id: str = "unknown", callback_url: str = None) -> Dict[str, Any]:
        """
        Get Facebook OAuth authorization URL with correlation tracking
        Args:
            user_id: User identifier
            correlation_id: Correlation ID for request tracing
            callback_url: Optional callback URL to override MCP server default
        Returns: Dict containing auth_url and state
        """
        import os
        start_time = time.time()
        
        # Get callback URL from environment if not provided
        if not callback_url:
            callback_url = os.getenv("FACEBOOK_REDIRECT_URI", "http://localhost:8000/api/integrations/facebook/callback")
        
        logger.info(
            f"MCP Client: Calling getFacebookAuthUrl tool | "
            f"correlation_id={correlation_id} | user_id={user_id} | "
            f"callback_url={callback_url}"
        )
        
        try:
            # Pass callbackUrl parameter to MCP server
            parameters = {
                "callbackUrl": callback_url
            }
            
            result = await self.invoke_tool(
                tool_name="getFacebookAuthUrl",
                parameters=parameters,
                correlation_id=correlation_id,
                user_id=user_id
            )
            
            elapsed = time.time() - start_time
            logger.info(
                f"MCP Client: getFacebookAuthUrl completed in {elapsed:.2f}s | "
                f"correlation_id={correlation_id} | "
                f"has_auth_url={'auth_url' in result or 'authUrl' in result}"
            )
            
            return result
            
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                f"MCP Client: getFacebookAuthUrl failed after {elapsed:.2f}s | "
                f"correlation_id={correlation_id} | error={str(e)}"
            )
            raise

    async def handle_facebook_callback(
        self, 
        code: str, 
        user_id: str, 
        callback_url: str = None,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Handle Facebook OAuth callback and exchange code for tokens
        Args:
            code: Authorization code from Facebook
            user_id: User identifier
            callback_url: Optional callback URL (must match the one used in auth URL)
            correlation_id: Correlation ID for request tracing
        Returns: Dict containing access tokens and user info
        """
        import os
        
        # Get callback URL from environment if not provided
        if not callback_url:
            callback_url = os.getenv("FACEBOOK_REDIRECT_URI", "http://localhost:8000/api/integrations/facebook/callback")
        
        # Pass callbackUrl parameter to MCP server
        parameters = {
            "code": code,
            "callbackUrl": callback_url
        }
        
        return await self.invoke_tool(
            tool_name="exchangeFacebookAuthCode",
            parameters=parameters,
            correlation_id=correlation_id,
            user_id=user_id
        )

    async def post_to_facebook(
        self, 
        content: str, 
        access_token: str, 
        user_id: str,
        page_id: str = None,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Post content to Facebook Page
        Args:
            content: Content to post
            access_token: Facebook Page access token (or user token if posting to profile)
            user_id: User identifier
            page_id: Optional Page ID if targeting a specific page
            correlation_id: Correlation ID for request tracing
        Returns: Post result
        """
        params = {
            "content": content,
            "accessToken": access_token,
            "userId": user_id
        }
        if page_id:
            params["pageId"] = page_id
            
        return await self.invoke_tool(
            tool_name="postToFacebook",
            parameters=params,
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def get_twitter_auth_url(self, user_id: str, correlation_id: str = "unknown", callback_url: str = None) -> Dict[str, Any]:
        """
        Get Twitter OAuth authorization URL with correlation tracking
        Args:
            user_id: User identifier
            correlation_id: Correlation ID for request tracing
            callback_url: Optional callback URL to override MCP server default
        Returns: Dict containing auth_url and state
        """
        import os
        start_time = time.time()
        
        # Get callback URL from environment if not provided
        if not callback_url:
            callback_url = os.getenv("TWITTER_REDIRECT_URI", "http://localhost:8000/api/integrations/twitter/callback")
        
        logger.info(
            f"MCP Client: Calling getTwitterAuthUrl tool | "
            f"correlation_id={correlation_id} | user_id={user_id} | "
            f"callback_url={callback_url} | "
            f"mcp_url={self.mcp_server_url}"
        )
        
        try:
            # Pass callbackUrl parameter to MCP server (as per MCP schema)
            parameters = {
                "callbackUrl": callback_url
            }
            
            result = await self.invoke_tool(
                tool_name="getTwitterAuthUrl",
                parameters=parameters,
                correlation_id=correlation_id,
                user_id=user_id
            )
            
            elapsed = time.time() - start_time
            logger.info(
                f"MCP Client: getTwitterAuthUrl completed in {elapsed:.2f}s | "
                f"correlation_id={correlation_id} | "
                f"has_auth_url={'auth_url' in result or 'authUrl' in result}"
            )
            
            return result
            
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                f"MCP Client: getTwitterAuthUrl failed after {elapsed:.2f}s | "
                f"correlation_id={correlation_id} | error={str(e)}"
            )
            raise
    
    async def handle_twitter_callback(
        self, 
        code: str, 
        user_id: str,
        code_verifier: str,
        callback_url: str = None,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Handle Twitter OAuth callback and exchange code for tokens
        Args:
            code: Authorization code from Twitter
            user_id: User identifier
            code_verifier: PKCE code verifier from auth URL generation
            callback_url: Optional callback URL (must match the one used in auth URL)
            correlation_id: Correlation ID for request tracing
        Returns: Dict containing access tokens and user info
        """
        import os
        
        # Get callback URL from environment if not provided
        if not callback_url:
            callback_url = os.getenv("TWITTER_REDIRECT_URI", "http://localhost:8000/api/integrations/twitter/callback")
        
        logger.info(
            f"MCP Client: Calling exchangeTwitterAuthCode tool | "
            f"correlation_id={correlation_id} | user_id={user_id} | "
            f"has_code_verifier={bool(code_verifier)}"
        )
        
        # Pass code, codeVerifier, and callbackUrl to MCP server
        parameters = {
            "code": code,
            "codeVerifier": code_verifier,
            "callbackUrl": callback_url
        }
        
        return await self.invoke_tool(
            tool_name="exchangeTwitterAuthCode",
            parameters=parameters,
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
        """
        Post content to Twitter
        Args:
            content: Content to post (tweet text)
            access_token: Twitter access token
            user_id: User identifier
            correlation_id: Correlation ID for request tracing
        Returns: Post result
        """
        return await self.invoke_tool(
            tool_name="postToTwitter",
            parameters={
                "content": content,
                "accessToken": access_token,
                "userId": user_id
            },
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def get_facebook_auth_url(self, user_id: str, correlation_id: str = "unknown", callback_url: str = None) -> Dict[str, Any]:
        """
        Get Facebook OAuth authorization URL with correlation tracking
        Args:
            user_id: User identifier
            correlation_id: Correlation ID for request tracing
            callback_url: Optional callback URL to override MCP server default
        Returns: Dict containing auth_url and state
        """
        import os
        start_time = time.time()
        
        # Get callback URL from environment if not provided
        if not callback_url:
            callback_url = os.getenv("FACEBOOK_REDIRECT_URI", "http://localhost:8002/api/integrations/facebook/callback")
        
        logger.info(
            f"MCP Client: Calling getFacebookAuthUrl tool | "
            f"correlation_id={correlation_id} | user_id={user_id} | "
            f"callback_url={callback_url} | "
            f"mcp_url={self.mcp_server_url}"
        )
        
        try:
            # Pass callbackUrl parameter to MCP server (as per MCP schema)
            parameters = {
                "callbackUrl": callback_url
            }
            
            result = await self.invoke_tool(
                tool_name="getFacebookAuthUrl",
                parameters=parameters,
                correlation_id=correlation_id,
                user_id=user_id
            )
            
            elapsed = time.time() - start_time
            logger.info(
                f"MCP Client: getFacebookAuthUrl completed in {elapsed:.2f}s | "
                f"correlation_id={correlation_id} | "
                f"has_auth_url={'auth_url' in result or 'authUrl' in result}"
            )
            
            return result
            
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                f"MCP Client: getFacebookAuthUrl failed after {elapsed:.2f}s | "
                f"correlation_id={correlation_id} | error={str(e)}"
            )
            raise
    
    async def handle_facebook_callback(
        self, 
        code: str, 
        user_id: str, 
        callback_url: str = None,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Handle Facebook OAuth callback and exchange code for tokens
        Args:
            code: Authorization code from Facebook
            user_id: User identifier
            callback_url: Optional callback URL (must match the one used in auth URL)
            correlation_id: Correlation ID for request tracing
        Returns: Dict containing access tokens and page info
        """
        import os
        
        # Get callback URL from environment if not provided
        if not callback_url:
            callback_url = os.getenv("FACEBOOK_REDIRECT_URI", "http://localhost:8002/api/integrations/facebook/callback")
        
        logger.info(
            f"MCP Client: Calling exchangeFacebookAuthCode tool | "
            f"correlation_id={correlation_id} | user_id={user_id}"
        )
        
        # Pass code and callbackUrl to MCP server
        parameters = {
            "code": code,
            "callbackUrl": callback_url
        }
        
        return await self.invoke_tool(
            tool_name="exchangeFacebookAuthCode",
            parameters=parameters,
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def post_to_facebook(
        self, 
        content: str, 
        access_token: str, 
        user_id: str,
        page_id: str = None,
        correlation_id: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Post content to Facebook Page
        Args:
            content: Content to post
            access_token: Facebook Page access token
            user_id: User identifier
            page_id: Facebook Page ID (optional, MCP may resolve it)
            correlation_id: Correlation ID for request tracing
        Returns: Post result
        """
        parameters = {
            "content": content,
            "accessToken": access_token,
            "userId": user_id
        }
        
        if page_id:
            parameters["pageId"] = page_id
        
        return await self.invoke_tool(
            tool_name="postToFacebook",
            parameters=parameters,
            correlation_id=correlation_id,
            user_id=user_id
        )
    
    async def list_available_tools(self) -> List[str]:
        """
        Get list of available tool names
        Returns: List of tool names
        """
        if not self.tools_cache:
            await self.discover_tools()
        
        tools = self.tools_cache.get('tools', [])
        return [tool.get('name') for tool in tools if tool.get('name')]
