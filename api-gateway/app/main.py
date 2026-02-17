from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import sys
import os

# Add parent directory to path to import shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from shared.logging_utils import CorrelationLogger, get_correlation_id_from_headers, generate_correlation_id

# Initialize centralized logger
logger = CorrelationLogger(
    service_name="API-GATEWAY",
    log_file="logs/centralized.log"
)

app = FastAPI(
    title="Social Media Management - API Gateway",
    description="The central entry point for all client requests.",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Correlation ID Middleware
@app.middleware("http")
async def add_correlation_id_middleware(request: Request, call_next):
    """Add or extract correlation ID and add to request state and response headers"""
    # Extract or generate correlation ID
    correlation_id = get_correlation_id_from_headers(dict(request.headers)) or generate_correlation_id()
    
    # Store in request state for easy access
    request.state.correlation_id = correlation_id
    
    # Log request start
    user_id = request.headers.get('x-user-id', 'unknown')
    logger.request_start(
        correlation_id=correlation_id,
        endpoint=str(request.url.path),
        method=request.method,
        user_id=user_id
    )
    
    # Process request
    response = await call_next(request)
    
    # Add correlation ID to response headers
    response.headers["X-Correlation-ID"] = correlation_id
    
    # Log request end
    logger.request_end(
        correlation_id=correlation_id,
        endpoint=str(request.url.path),
        status_code=response.status_code,
        user_id=user_id
    )
    
    return response

@app.get("/")
async def root():
    return {"message": "API Gateway is running"}

# Service URLs
AUTH_SERVICE_URL = "http://localhost:8001"
INTEGRATION_SERVICE_URL = "http://localhost:8002"  # Integration service on port 8002
BACKEND_SERVICE_URL = "http://localhost:8001"  # Backend service fallback
AGENT_SERVICE_URL = "http://localhost:8006"

# ============================================
# LinkedIn Integration Routes
# ============================================

@app.post("/api/integrations/linkedin/auth")
async def route_linkedin_auth(request: Request):
    """Route LinkedIn OAuth initiation to integration service"""
    # Get correlation ID from request state (set by middleware)
    correlation_id = getattr(request.state, 'correlation_id', 'unknown')
    user_id = request.headers.get('x-user-id', 'unknown')
    
    print("\n" + "="*100)
    print("🟢 [API-GATEWAY] LinkedIn Auth Request Received from Frontend")
    print("="*100)
    print(f"🆔 [API-GATEWAY] Correlation ID: {correlation_id}")
    print(f"👤 [API-GATEWAY] User ID: {user_id}")
    print(f"📍 [API-GATEWAY] Endpoint: POST /api/integrations/linkedin/auth")
    
    async with httpx.AsyncClient() as client:
        try:
            headers_to_forward = {k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            
            # Ensure correlation ID is forwarded
            if 'x-correlation-id' not in headers_to_forward:
                headers_to_forward['x-correlation-id'] = correlation_id
            
            print(f"📤 [API-GATEWAY] Forwarding to Integration Service:")
            print(f"   ├─ Target: {INTEGRATION_SERVICE_URL}/api/integrations/linkedin/auth")
            print(f"   ├─ Headers Count: {len(headers_to_forward)}")
            print(f"   └─ Key Headers: X-User-ID={headers_to_forward.get('x-user-id')}, X-Correlation-ID={correlation_id}")
            
            logger.info(
                f"Forwarding request to Integration Service",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"target_url": f"{INTEGRATION_SERVICE_URL}/api/integrations/linkedin/auth"}
            )
            
            response = await client.post(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/linkedin/auth",
                headers=headers_to_forward,
                timeout=60.0
            )
            
            print(f"📥 [API-GATEWAY] Response from Integration Service:")
            print(f"   ├─ Status Code: {response.status_code}")
            print(f"   └─ Status: {'SUCCESS' if response.status_code == 200 else 'ERROR'}")
            
            logger.success(
                f"Received response from Integration Service",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"status_code": response.status_code}
            )
            
            response.raise_for_status()
            
            response_data = response.json()
            print(f"✅ [API-GATEWAY] Returning auth_url to frontend")
            print(f"   └─ Auth URL Length: {len(response_data.get('auth_url', ''))} characters")
            
            print("="*100 + "\n")
            
            # Create response with correlation ID header
            json_response = JSONResponse(content=response_data, status_code=response.status_code)
            json_response.headers["X-Correlation-ID"] = correlation_id
            return json_response
            
        except httpx.RequestError as exc:
            print(f"❌ [API-GATEWAY] Request Error:")
            print(f"   ├─ Type: {type(exc).__name__}")
            print(f"   └─ Message: {str(exc)}")
            
            logger.error(
                f"Request error connecting to Integration Service: {str(exc)}",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"error_type": type(exc).__name__}
            )
            
            print("="*100 + "\n")
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
            
        except httpx.HTTPStatusError as exc:
            print(f"❌ [API-GATEWAY] HTTP Status Error:")
            print(f"   ├─ Status Code: {exc.response.status_code}")
            print(f"   └─ Response: {exc.response.text[:200]}")
            
            logger.error(
                f"HTTP error from Integration Service",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"status_code": exc.response.status_code, "response": exc.response.text[:200]}
            )
            
            print("="*100 + "\n")
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


@app.get("/api/integrations/linkedin/callback")
async def route_linkedin_callback(code: str, state: str = None):
    """Route LinkedIn OAuth callback to integration service"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            params = {"code": code}
            if state:
                params["state"] = state
            
            print(f"🔄 [API-GATEWAY] LinkedIn callback → forwarding to Integration Service (timeout=60s)")
            
            response = await client.get(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/linkedin/callback",
                params=params,
                follow_redirects=False
            )
            
            # If it's a redirect, return it
            if response.status_code in (301, 302, 303, 307, 308):
                return RedirectResponse(url=response.headers.get('location', 'http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=no_redirect_location'))
            
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            print(f"❌ [API-GATEWAY] LinkedIn callback FAILED: {type(exc).__name__}: {str(exc)}")
            # On error, redirect to oauth-callback.html so popup can postMessage and close
            return RedirectResponse(url="http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=gateway_request_error")
        except httpx.HTTPStatusError as exc:
            print(f"❌ [API-GATEWAY] LinkedIn callback HTTP error: {exc.response.status_code}")
            return RedirectResponse(url="http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=gateway_http_error")


@app.get("/api/integrations/linkedin/status")
async def route_linkedin_status(request: Request):
    """Route LinkedIn status check to integration service"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/linkedin/status",
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


@app.post("/api/integrations/linkedin/post")
async def route_linkedin_post(request: Request):
    """Route LinkedIn post to integration service"""
    async with httpx.AsyncClient() as client:
        try:
            body = await request.json()
            response = await client.post(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/linkedin/post",
                json=body,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')},
                timeout=60.0
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


@app.delete("/api/integrations/linkedin/disconnect")
async def route_linkedin_disconnect(request: Request):
    """Route LinkedIn disconnect to integration service"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/linkedin/disconnect",
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


# ============================================
# Facebook Integration Routes
# ============================================

@app.post("/api/integrations/facebook/post-with-image")
async def route_facebook_post_with_image(request: Request):
    """Route Facebook post-with-image to integration service"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            body = await request.json()
            response = await client.post(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/facebook/post-with-image",
                json=body,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')},
                timeout=60.0
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)

@app.post("/api/integrations/facebook/auth")
async def route_facebook_auth(request: Request):
    """Route Facebook OAuth initiation to integration service"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/facebook/auth",
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


@app.get("/api/integrations/facebook/callback")
async def route_facebook_callback(code: str, state: str = None):
    """Route Facebook OAuth callback to integration service"""
    print("\n" + "="*100)
    print("🔄 [API-GATEWAY] Facebook Callback - Forwarding to Integration Service")
    print(f"   Code length: {len(code)}")
    print("="*100)

    # Increased timeout to 60s for OAuth token exchange
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            params = {"code": code}
            if state:
                params["state"] = state
            
            response = await client.get(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/facebook/callback",
                params=params,
                follow_redirects=False
            )
            
            print(f"📥 [API-GATEWAY] Response from Integration Service: {response.status_code}")

            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get('location', 'http://localhost:3000/oauth-callback.html?status=error&platform=facebook&message=no_redirect_location')
                print(f"✅ [API-GATEWAY] Redirecting to: {location}")
                return RedirectResponse(url=location)
            
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)

        except httpx.RequestError as exc:
            print(f"❌ [API-GATEWAY] Request Error: {exc}")
            return RedirectResponse(url="http://localhost:3000/oauth-callback.html?status=error&platform=facebook&message=gateway_timeout")
        except httpx.HTTPStatusError as exc:
            print(f"❌ [API-GATEWAY] HTTP Error: {exc.response.status_code}")
            return RedirectResponse(url="http://localhost:3000/oauth-callback.html?status=error&platform=facebook&message=gateway_error")


@app.get("/api/integrations/facebook/status")
async def route_facebook_status(request: Request):
    """Route Facebook status check to integration service"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/facebook/status",
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


@app.post("/api/integrations/facebook/post")
async def route_facebook_post(request: Request):
    """Route Facebook post to integration service"""
    async with httpx.AsyncClient() as client:
        try:
            body = await request.json()
            response = await client.post(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/facebook/post",
                json=body,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


# ============================================
# Twitter Integration Routes
# ============================================

@app.post("/api/integrations/twitter/auth")
async def route_twitter_auth(request: Request):
    """Route Twitter OAuth initiation to integration service"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/twitter/auth",
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')},
                timeout=60.0
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


@app.get("/api/integrations/twitter/callback")
async def route_twitter_callback(code: str, state: str = None):
    """Route Twitter OAuth callback to integration service"""
    print("\n" + "="*100)
    print("🔄 [API-GATEWAY] Twitter Callback - Forwarding to Integration Service")
    print("="*100)

    # Increased timeout to 60s for OAuth token exchange
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            params = {"code": code}
            if state:
                params["state"] = state
            
            response = await client.get(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/twitter/callback",
                params=params,
                follow_redirects=False
            )
            
            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get('location', 'http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=no_redirect_location')
                print(f"✅ [API-GATEWAY] Redirecting to: {location}")
                return RedirectResponse(url=location)
            
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)

        except httpx.RequestError as exc:
            print(f"❌ [API-GATEWAY] Request Error: {exc}")
            return RedirectResponse(url="http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=gateway_timeout")
        except httpx.HTTPStatusError as exc:
            print(f"❌ [API-GATEWAY] HTTP Error: {exc.response.status_code}")
            return RedirectResponse(url="http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=gateway_error")


@app.get("/api/integrations/twitter/status")
async def route_twitter_status(request: Request):
    """Route Twitter status check to integration service"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/twitter/status",
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


@app.post("/api/integrations/twitter/post")
async def route_twitter_post(request: Request):
    """Route Twitter post to integration service"""
    async with httpx.AsyncClient() as client:
        try:
            body = await request.json()
            response = await client.post(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/twitter/post",
                json=body,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


@app.delete("/api/integrations/twitter/disconnect")
async def route_twitter_disconnect(request: Request):
    """Route Twitter disconnect to integration service"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(
                f"{INTEGRATION_SERVICE_URL}/api/integrations/twitter/disconnect",
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Error connecting to integration service: {exc}")
        except httpx.HTTPStatusError as exc:
            return JSONResponse(content=exc.response.json() if exc.response.text else {"detail": "Service error"}, status_code=exc.response.status_code)


# ============================================
# Preview Post Route
# ============================================

@app.post("/api/integrations/preview")
async def route_preview_post(request: Request):
    """Route post preview to backend service"""
    correlation_id = getattr(request.state, 'correlation_id', 'unknown')
    user_id = request.headers.get('x-user-id', 'unknown')
    
    logger.info(
        "API Gateway: Routing preview request to Backend Service",
        correlation_id=correlation_id,
        user_id=user_id
    )
    
    async with httpx.AsyncClient() as client:
        try:
            body = await request.json()
            headers_to_forward = {k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            
            # Ensure correlation ID is forwarded
            if 'x-correlation-id' not in headers_to_forward:
                headers_to_forward['x-correlation-id'] = correlation_id
            
            response = await client.post(
                f"{BACKEND_SERVICE_URL}/api/integrations/preview",
                json=body,
                headers=headers_to_forward,
                timeout=30.0
            )
            
            response.raise_for_status()
            
            response_data = response.json()
            
            logger.success(
                "API Gateway: Preview generated successfully",
                correlation_id=correlation_id,
                user_id=user_id
            )
            
            # Create response with correlation ID header
            json_response = JSONResponse(content=response_data, status_code=response.status_code)
            json_response.headers["X-Correlation-ID"] = correlation_id
            return json_response
            
        except httpx.RequestError as exc:
            logger.error(
                f"Request error connecting to Backend Service: {str(exc)}",
                correlation_id=correlation_id,
                user_id=user_id
            )
            raise HTTPException(status_code=503, detail=f"Error connecting to backend service: {exc}")
            
        except httpx.HTTPStatusError as exc:
            logger.error(
                f"HTTP error from Backend Service",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"status_code": exc.response.status_code}
            )
            return JSONResponse(
                content=exc.response.json() if exc.response.text else {"detail": "Service error"}, 
                status_code=exc.response.status_code
            )


# ============================================
# Content Refinement Routes
# ============================================

@app.post("/api/integrations/content/refine")
async def route_content_refine(request: Request):
    """Route content refinement directly to Agent Service for AI-powered content enhancement"""
    correlation_id = getattr(request.state, 'correlation_id', 'unknown')
    user_id = request.headers.get('x-user-id', 'unknown')
    
    print("\n" + "="*100)
    print("✨ [API-GATEWAY] Content Refinement Request Received from Frontend")
    print("="*100)
    print(f"🆔 [API-GATEWAY] Correlation ID: {correlation_id}")
    print(f"👤 [API-GATEWAY] User ID: {user_id}")
    print(f"📍 [API-GATEWAY] Endpoint: POST /api/integrations/content/refine")
    
    async with httpx.AsyncClient() as client:
        try:
            body = await request.json()
            
            # Prepare request for Agent Service
            agent_request = {
                "user_id": user_id,
                "original_content": body.get('original_content'),
                "refinement_instructions": body.get('refinement_instructions'),
                "tone": body.get('tone'),
                "platform": body.get('platform'),
                "generate_alternatives": body.get('generate_alternatives', False)
            }
            
            headers_to_forward = {k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')}
            
            # Ensure correlation ID is forwarded
            if 'x-correlation-id' not in headers_to_forward:
                headers_to_forward['x-correlation-id'] = correlation_id
            
            print(f"📤 [API-GATEWAY] Forwarding to Agent Service (AI Content Refinement):")
            print(f"   ├─ Target: {AGENT_SERVICE_URL}/agent/content/refine")
            print(f"   ├─ Original Content Length: {len(body.get('original_content', ''))} chars")
            print(f"   ├─ Tone: {body.get('tone', 'default')}")
            print(f"   └─ Platform: {body.get('platform', 'none')}")
            
            logger.info(
                f"Forwarding content refinement request to Agent Service",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={
                    "target_url": f"{AGENT_SERVICE_URL}/agent/content/refine",
                    "content_length": len(body.get('original_content', '')),
                    "tone": body.get('tone'),
                    "platform": body.get('platform')
                }
            )
            
            response = await client.post(
                f"{AGENT_SERVICE_URL}/agent/content/refine",
                json=agent_request,
                headers=headers_to_forward,
                timeout=60.0  # Longer timeout for LLM processing
            )
            
            print(f"📥 [API-GATEWAY] Response from Agent Service:")
            print(f"   ├─ Status Code: {response.status_code}")
            print(f"   └─ Status: {'SUCCESS' if response.status_code == 200 else 'ERROR'}")
            
            logger.success(
                f"Received response from Agent Service",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"status_code": response.status_code}
            )
            
            response.raise_for_status()
            
            response_data = response.json()
            
            if response_data.get('success'):
                print(f"✅ [API-GATEWAY] Content refinement successful")
                print(f"   ├─ Refined Length: {len(response_data.get('refined_content', ''))} chars")
                print(f"   └─ Suggestions: {len(response_data.get('suggestions', []))}")
            else:
                print(f"❌ [API-GATEWAY] Content refinement failed: {response_data.get('error')}")
            
            print("="*100 + "\n")
            
            # Create response with correlation ID header
            json_response = JSONResponse(content=response_data, status_code=response.status_code)
            json_response.headers["X-Correlation-ID"] = correlation_id
            return json_response
            
        except httpx.RequestError as exc:
            print(f"❌ [API-GATEWAY] Request Error:")
            print(f"   ├─ Type: {type(exc).__name__}")
            print(f"   └─ Message: {str(exc)}")
            
            logger.error(
                f"Request error connecting to Agent Service: {str(exc)}",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"error_type": type(exc).__name__}
            )
            
            print("="*100 + "\n")
            raise HTTPException(status_code=503, detail=f"Error connecting to agent service: {exc}")
            
        except httpx.HTTPStatusError as exc:
            print(f"❌ [API-GATEWAY] HTTP Status Error:")
            print(f"   ├─ Status Code: {exc.response.status_code}")
            print(f"   └─ Response: {exc.response.text[:200]}")
            
            logger.error(
                f"HTTP error from Agent Service",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"status_code": exc.response.status_code, "response": exc.response.text[:200]}
            )
            
            print("="*100 + "\n")
            return JSONResponse(
                content=exc.response.json() if exc.response.text else {"detail": "Service error"}, 
                status_code=exc.response.status_code
            )


# ============================================
# Health Check
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "auth_service": AUTH_SERVICE_URL,
        "integration_service": INTEGRATION_SERVICE_URL,
        "agent_service": AGENT_SERVICE_URL
    }
