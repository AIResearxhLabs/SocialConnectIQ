"""
Request/Response logging middleware
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time
import sys
import os
from typing import Callable

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.logging_utils import CorrelationLogger


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all requests and responses"""
    
    def __init__(self, app, service_name: str = "BACKEND-SERVICE"):
        super().__init__(app)
        self.logger = CorrelationLogger(
            service_name=service_name,
            log_file="logs/centralized.log"
        )
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Get correlation ID from request state (set by CorrelationIDMiddleware)
        correlation_id = getattr(request.state, "correlation_id", "unknown")
        user_id = getattr(request.state, "user_id", "anonymous")
        
        # Log request start
        self.logger.request_start(
            correlation_id=correlation_id,
            endpoint=request.url.path,
            method=request.method,
            user_id=user_id
        )
        
        # Record start time
        start_time = time.time()
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Log request end
            self.logger.request_end(
                correlation_id=correlation_id,
                endpoint=request.url.path,
                status_code=response.status_code,
                user_id=user_id
            )
            
            # Log additional metrics
            self.logger.info(
                f"Request completed in {duration_ms}ms",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={
                    "duration_ms": duration_ms,
                    "status_code": response.status_code,
                    "method": request.method,
                    "path": request.url.path
                }
            )
            
            return response
            
        except Exception as e:
            # Log error
            duration_ms = int((time.time() - start_time) * 1000)
            
            self.logger.error(
                f"Request failed: {str(e)}",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={
                    "duration_ms": duration_ms,
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "method": request.method,
                    "path": request.url.path
                }
            )
            
            # Re-raise the exception
            raise
