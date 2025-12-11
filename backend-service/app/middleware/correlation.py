"""
Correlation ID middleware for distributed tracing
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import uuid
from typing import Callable


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Middleware to handle correlation IDs for request tracing"""
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Check for existing correlation ID in headers
        correlation_id = (
            request.headers.get("x-correlation-id") or
            request.headers.get("x-request-id") or
            request.headers.get("correlation-id") or
            request.headers.get("request-id") or
            str(uuid.uuid4())
        )
        
        # Store correlation ID in request state for access in routes
        request.state.correlation_id = correlation_id
        
        # Extract user ID if present
        user_id = request.headers.get("x-user-id", "anonymous")
        request.state.user_id = user_id
        
        # Call the next middleware/route
        response = await call_next(request)
        
        # Add correlation ID to response headers for client tracking
        response.headers["X-Correlation-ID"] = correlation_id
        
        return response
