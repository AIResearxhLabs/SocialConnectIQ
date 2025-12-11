"""
Agent Service - AI-powered social media management agent
Handles OAuth workflows and content generation using LangGraph and OpenAI
"""
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import sys
import os
from typing import Optional
from contextlib import asynccontextmanager

from .config import settings
from .mcp_client import MCPClient
from .linkedin_agent import LinkedInOAuthAgent

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.logging_utils import CorrelationLogger, generate_correlation_id

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize correlation logger
correlation_logger = CorrelationLogger(
    service_name="AGENT-SERVICE",
    log_file="logs/agent-service.log"
)

# Global instances
mcp_client: Optional[MCPClient] = None
linkedin_agent: Optional[LinkedInOAuthAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for the application"""
    global mcp_client, linkedin_agent
    
    # Startup
    logger.info("Initializing Agent Service...")
    
    try:
        # Initialize MCP client
        mcp_client = MCPClient(settings.mcp_server.base_url)
        logger.info(f"MCP Client initialized with server: {settings.mcp_server.base_url}")
        
        # Discover available tools
        tools = await mcp_client.discover_tools()
        logger.info(f"Discovered {len(tools.get('tools', []))} MCP tools")
        
        # Initialize LinkedIn agent
        linkedin_agent = LinkedInOAuthAgent(
            mcp_client=mcp_client,
            openai_api_key=settings.openai.api_key
        )
        logger.info("LinkedIn OAuth Agent initialized")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {str(e)}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Agent Service...")
    if mcp_client:
        await mcp_client.close()


app = FastAPI(
    title="Agent Service",
    description="AI-powered agent for social media OAuth and content management",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class GetAuthUrlRequest(BaseModel):
    user_id: str


class GetAuthUrlResponse(BaseModel):
    success: bool
    auth_url: Optional[str] = None
    state: Optional[str] = None
    error: Optional[str] = None


class HandleCallbackRequest(BaseModel):
    code: str
    user_id: str


class HandleCallbackResponse(BaseModel):
    success: bool
    result: Optional[dict] = None
    error: Optional[str] = None


class PostContentRequest(BaseModel):
    content: str
    access_token: str
    user_id: str


class PostContentResponse(BaseModel):
    success: bool
    result: Optional[dict] = None
    error: Optional[str] = None


class ToolsListResponse(BaseModel):
    tools: list


# Middleware to add correlation ID
@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    """Add correlation ID to request state"""
    correlation_id = request.headers.get("x-correlation-id") or generate_correlation_id()
    request.state.correlation_id = correlation_id
    
    # Log request start
    correlation_logger.request_start(
        correlation_id=correlation_id,
        endpoint=str(request.url.path),
        method=request.method,
        user_id=request.headers.get("x-user-id")
    )
    
    response = await call_next(request)
    
    # Log request end
    correlation_logger.request_end(
        correlation_id=correlation_id,
        endpoint=str(request.url.path),
        status_code=response.status_code,
        user_id=request.headers.get("x-user-id")
    )
    
    # Add correlation ID to response headers
    response.headers["X-Correlation-ID"] = correlation_id
    
    return response


# Health check
@app.get("/")
async def root(request: Request):
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    correlation_logger.info(
        "Agent Service root endpoint accessed",
        correlation_id=correlation_id
    )
    
    return {
        "service": "agent-service",
        "status": "running",
        "mcp_server": settings.mcp_server.base_url
    }


@app.get("/health")
async def health_check(request: Request):
    """Health check endpoint"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        # Check MCP server connectivity
        if mcp_client:
            tools = await mcp_client.list_available_tools()
            
            correlation_logger.success(
                f"Health check passed - {len(tools)} MCP tools available",
                correlation_id=correlation_id,
                additional_data={
                    "mcp_server": settings.mcp_server.base_url,
                    "tools_count": len(tools)
                }
            )
            
            return {
                "status": "healthy",
                "mcp_server": settings.mcp_server.base_url,
                "available_tools": len(tools)
            }
        else:
            correlation_logger.warning(
                "Health check - MCP client not yet initialized",
                correlation_id=correlation_id
            )
            
            return {
                "status": "initializing",
                "mcp_server": settings.mcp_server.base_url
            }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        
        correlation_logger.error(
            f"Health check failed: {str(e)}",
            correlation_id=correlation_id,
            additional_data={"error": str(e)}
        )
        
        return {
            "status": "unhealthy",
            "error": str(e)
        }


# MCP Tools Discovery
@app.get("/mcp/tools", response_model=ToolsListResponse)
async def get_mcp_tools(request: Request):
    """Get list of available MCP tools"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not mcp_client:
            correlation_logger.error(
                "MCP tools request failed - client not initialized",
                correlation_id=correlation_id
            )
            raise HTTPException(status_code=503, detail="MCP client not initialized")
        
        tools = await mcp_client.list_available_tools()
        
        correlation_logger.success(
            f"Retrieved {len(tools)} MCP tools",
            correlation_id=correlation_id,
            additional_data={"tools_count": len(tools), "tools": tools}
        )
        
        return {"tools": tools}
        
    except Exception as e:
        logger.error(f"Error fetching MCP tools: {str(e)}")
        
        correlation_logger.error(
            f"Error fetching MCP tools: {str(e)}",
            correlation_id=correlation_id,
            additional_data={"error": str(e)}
        )
        
        raise HTTPException(status_code=500, detail=str(e))


# LinkedIn OAuth Endpoints
@app.post("/agent/linkedin/auth", response_model=GetAuthUrlResponse)
async def linkedin_auth(
    request: GetAuthUrlRequest,
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID")
):
    """
    Unified LinkedIn OAuth endpoint via AI agent with LLM-driven MCP integration
    Handles get_auth_url, handle_callback, and post_content actions
    """
    correlation_id = x_correlation_id or "unknown"
    
    try:
        if not linkedin_agent:
            logger.error(
                f"Agent Service: LinkedIn agent not initialized | correlation_id={correlation_id}"
            )
            raise HTTPException(status_code=503, detail="LinkedIn agent not initialized")
        
        logger.info(
            f"Agent Service: Received LinkedIn auth request | "
            f"correlation_id={correlation_id} | user_id={request.user_id}"
        )
        
        # Execute agent workflow with LLM reasoning
        logger.info(
            f"Agent Service: Invoking LLM-based LinkedInOAuthAgent | "
            f"correlation_id={correlation_id}"
        )
        
        result = await linkedin_agent.execute({
            "user_id": request.user_id,
            "action": "get_auth_url",
            "correlation_id": correlation_id
        })
        
        logger.info(
            f"Agent Service: Agent execution completed | "
            f"correlation_id={correlation_id} | success={result['success']}"
        )
        
        return GetAuthUrlResponse(
            success=result["success"],
            auth_url=result.get("auth_url"),
            state=result.get("state"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(
            f"Agent Service: Error in linkedin_auth | "
            f"correlation_id={correlation_id} | error={str(e)}"
        )
        return GetAuthUrlResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/linkedin/get-auth-url", response_model=GetAuthUrlResponse)
async def linkedin_get_auth_url(request: Request, auth_request: GetAuthUrlRequest):
    """
    Get LinkedIn OAuth authorization URL via AI agent
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not linkedin_agent:
            correlation_logger.error(
                "LinkedIn agent not initialized",
                correlation_id=correlation_id,
                user_id=auth_request.user_id
            )
            raise HTTPException(status_code=503, detail="LinkedIn agent not initialized")
        
        correlation_logger.info(
            f"Getting LinkedIn auth URL for user",
            correlation_id=correlation_id,
            user_id=auth_request.user_id
        )
        
        # Execute agent workflow
        result = await linkedin_agent.execute({
            "user_id": auth_request.user_id,
            "action": "get_auth_url",
            "correlation_id": correlation_id
        })
        
        correlation_logger.success(
            f"LinkedIn auth URL generated",
            correlation_id=correlation_id,
            user_id=auth_request.user_id,
            additional_data={"has_auth_url": bool(result.get("auth_url"))}
        )
        
        return GetAuthUrlResponse(
            success=result["success"],
            auth_url=result.get("auth_url"),
            state=result.get("state"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in get_auth_url: {str(e)}")
        
        correlation_logger.error(
            f"Error in get_auth_url: {str(e)}",
            correlation_id=correlation_id,
            user_id=auth_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return GetAuthUrlResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/linkedin/handle-callback", response_model=HandleCallbackResponse)
async def linkedin_handle_callback(request: Request, callback_request: HandleCallbackRequest):
    """
    Handle LinkedIn OAuth callback via AI agent
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not linkedin_agent:
            correlation_logger.error(
                "LinkedIn agent not initialized",
                correlation_id=correlation_id,
                user_id=callback_request.user_id
            )
            raise HTTPException(status_code=503, detail="LinkedIn agent not initialized")
        
        correlation_logger.info(
            f"Handling LinkedIn callback",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"has_code": bool(callback_request.code)}
        )
        
        # Execute agent workflow
        result = await linkedin_agent.execute({
            "user_id": callback_request.user_id,
            "action": "handle_callback",
            "code": callback_request.code,
            "correlation_id": correlation_id
        })
        
        correlation_logger.success(
            f"LinkedIn callback handled",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"success": result.get("success")}
        )
        
        return HandleCallbackResponse(
            success=result["success"],
            result=result.get("result"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in handle_callback: {str(e)}")
        
        correlation_logger.error(
            f"Error in handle_callback: {str(e)}",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return HandleCallbackResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/linkedin/post-content", response_model=PostContentResponse)
async def linkedin_post_content(request: Request, post_request: PostContentRequest):
    """
    Post content to LinkedIn via AI agent
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not linkedin_agent:
            correlation_logger.error(
                "LinkedIn agent not initialized",
                correlation_id=correlation_id,
                user_id=post_request.user_id
            )
            raise HTTPException(status_code=503, detail="LinkedIn agent not initialized")
        
        correlation_logger.info(
            f"Posting content to LinkedIn",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"content_length": len(post_request.content)}
        )
        
        # Execute agent workflow
        result = await linkedin_agent.execute({
            "user_id": post_request.user_id,
            "action": "post_content",
            "content": post_request.content,
            "access_token": post_request.access_token,
            "correlation_id": correlation_id
        })
        
        correlation_logger.success(
            f"LinkedIn post completed",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"success": result.get("success")}
        )
        
        return PostContentResponse(
            success=result["success"],
            result=result.get("result"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in post_content: {str(e)}")
        
        correlation_logger.error(
            f"Error in post_content: {str(e)}",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return PostContentResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/linkedin/post", response_model=PostContentResponse)
async def linkedin_post(request: Request, post_request: PostContentRequest):
    """
    Simplified endpoint for posting to LinkedIn via AI agent
    Routes to the main post-content endpoint
    """
    return await linkedin_post_content(request, post_request)


@app.post("/agent/facebook/post", response_model=PostContentResponse)
async def facebook_post(request: Request, post_request: PostContentRequest):
    """
    Post content to Facebook via MCP Client with LLM-powered tool discovery
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not mcp_client:
            correlation_logger.error(
                "MCP client not initialized",
                correlation_id=correlation_id,
                user_id=post_request.user_id
            )
            raise HTTPException(status_code=503, detail="MCP client not initialized")
        
        correlation_logger.info(
            f"Posting content to Facebook",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"content_length": len(post_request.content)}
        )
        
        # Use MCP Client to invoke the postToFacebook tool
        result = await mcp_client.invoke_tool(
            tool_name="postToFacebook",
            parameters={
                "content": post_request.content,
                "accessToken": post_request.access_token,
                "userId": post_request.user_id
            },
            correlation_id=correlation_id,
            user_id=post_request.user_id
        )
        
        correlation_logger.success(
            f"Facebook post completed",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"result": result}
        )
        
        return PostContentResponse(
            success=True,
            result=result,
            error=None
        )
        
    except Exception as e:
        logger.error(f"Error posting to Facebook: {str(e)}")
        
        correlation_logger.error(
            f"Error posting to Facebook: {str(e)}",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return PostContentResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/twitter/post", response_model=PostContentResponse)
async def twitter_post(request: Request, post_request: PostContentRequest):
    """
    Post content to Twitter via MCP Client with LLM-powered tool discovery
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not mcp_client:
            correlation_logger.error(
                "MCP client not initialized",
                correlation_id=correlation_id,
                user_id=post_request.user_id
            )
            raise HTTPException(status_code=503, detail="MCP client not initialized")
        
        correlation_logger.info(
            f"Posting content to Twitter",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"content_length": len(post_request.content)}
        )
        
        # Use MCP Client to invoke the postToTwitter tool
        result = await mcp_client.invoke_tool(
            tool_name="postToTwitter",
            parameters={
                "content": post_request.content,
                "accessToken": post_request.access_token,
                "userId": post_request.user_id
            },
            correlation_id=correlation_id,
            user_id=post_request.user_id
        )
        
        correlation_logger.success(
            f"Twitter post completed",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"result": result}
        )
        
        return PostContentResponse(
            success=True,
            result=result,
            error=None
        )
        
    except Exception as e:
        logger.error(f"Error posting to Twitter: {str(e)}")
        
        correlation_logger.error(
            f"Error posting to Twitter: {str(e)}",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return PostContentResponse(
            success=False,
            error=str(e)
        )


# Debug Endpoints
@app.get("/debug/mcp-logs")
async def get_mcp_logs(request: Request, lines: int = 50):
    """Get recent MCP interaction logs for debugging"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        import os
        mcp_log_file = "logs/mcp-interactions.log"
        
        if not os.path.exists(mcp_log_file):
            return {
                "error": "MCP log file not found",
                "file": mcp_log_file
            }
        
        # Read last N lines from the log file
        with open(mcp_log_file, 'r') as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
        
        correlation_logger.info(
            f"Debug endpoint: Retrieved {len(recent_lines)} lines from MCP logs",
            correlation_id=correlation_id,
            additional_data={"lines_requested": lines, "lines_returned": len(recent_lines)}
        )
        
        return {
            "total_lines": len(all_lines),
            "returned_lines": len(recent_lines),
            "logs": "".join(recent_lines)
        }
        
    except Exception as e:
        correlation_logger.error(
            f"Error reading MCP logs: {str(e)}",
            correlation_id=correlation_id,
            additional_data={"error": str(e)}
        )
        return {"error": str(e)}


@app.get("/debug/last-request")
async def get_last_request(request: Request):
    """Get information about the last MCP request for debugging"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    correlation_logger.info(
        "Debug endpoint: Retrieving last request info",
        correlation_id=correlation_id
    )
    
    # This would need to be enhanced with actual request tracking
    # For now, just return a helpful message
    return {
        "message": "Check logs/mcp-interactions.log for detailed request/response logs",
        "centralized_log": "logs/centralized.log",
        "agent_service_log": "logs/agent-service.log",
        "mcp_interactions_log": "logs/mcp-interactions.log"
    }


@app.get("/debug/connection-test")
async def test_mcp_connection(request: Request):
    """Test MCP server connectivity"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not mcp_client:
            return {
                "status": "error",
                "message": "MCP client not initialized"
            }
        
        correlation_logger.info(
            "Debug endpoint: Testing MCP server connectivity",
            correlation_id=correlation_id,
            additional_data={"mcp_server": settings.mcp_server.base_url}
        )
        
        # Try to list tools as a connectivity test
        import time
        start_time = time.time()
        
        tools = await mcp_client.list_available_tools()
        
        elapsed = time.time() - start_time
        
        correlation_logger.success(
            f"Debug endpoint: MCP server connectivity test passed",
            correlation_id=correlation_id,
            additional_data={
                "mcp_server": settings.mcp_server.base_url,
                "response_time": f"{elapsed:.3f}s",
                "tools_count": len(tools)
            }
        )
        
        return {
            "status": "success",
            "mcp_server": settings.mcp_server.base_url,
            "response_time": f"{elapsed:.3f}s",
            "available_tools": tools
        }
        
    except Exception as e:
        correlation_logger.error(
            f"Debug endpoint: MCP connectivity test failed: {str(e)}",
            correlation_id=correlation_id,
            additional_data={"error": str(e), "mcp_server": settings.mcp_server.base_url}
        )
        
        return {
            "status": "error",
            "message": str(e),
            "mcp_server": settings.mcp_server.base_url
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=True
    )
