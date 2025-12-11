"""
Main Backend Service - Consolidated service for OAuth, posting, and analytics
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from shared.logging_utils import CorrelationLogger

from .config import config
from .middleware import CorrelationIDMiddleware, RequestLoggingMiddleware
from .integrations import routes as integration_routes

# Initialize logger
logger = CorrelationLogger(
    service_name=config.SERVICE_NAME,
    log_file=config.LOG_FILE
)

# Create FastAPI app
app = FastAPI(
    title="Backend Service",
    description="Consolidated service for OAuth, social media integrations, posting, and analytics",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware (order matters!)
app.add_middleware(CorrelationIDMiddleware)  # First: Generate/extract correlation ID
app.add_middleware(RequestLoggingMiddleware, service_name=config.SERVICE_NAME)  # Second: Log requests

# Include routers
app.include_router(integration_routes.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": config.SERVICE_NAME,
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint with dependency status"""
    
    # Validate configuration
    config_errors = config.validate()
    
    health_status = {
        "status": "healthy" if not config_errors else "degraded",
        "service": config.SERVICE_NAME,
        "version": "1.0.0",
        "dependencies": {
            "mcp_server": {
                "url": config.MCP_SERVER_URL,
                "status": "configured"
            },
            "firestore": {
                "status": "configured" if not config_errors else "not_configured",
                "errors": config_errors if config_errors else None
            }
        }
    }
    
    return health_status


@app.get("/metrics")
async def metrics():
    """Basic metrics endpoint"""
    # This can be expanded with Prometheus metrics later
    return {
        "service": config.SERVICE_NAME,
        "metrics": {
            "note": "Metrics collection to be implemented"
        }
    }


# Exception handler for correlation ID propagation
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler that includes correlation ID"""
    
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    user_id = getattr(request.state, "user_id", "anonymous")
    
    logger.error(
        f"Unhandled exception: {str(exc)}",
        correlation_id=correlation_id,
        user_id=user_id,
        additional_data={
            "error_type": type(exc).__name__,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "correlation_id": correlation_id
        },
        headers={"X-Correlation-ID": correlation_id}
    )


if __name__ == "__main__":
    import uvicorn
    
    print(f"\n{'='*80}")
    print(f"🚀 Starting {config.SERVICE_NAME}")
    print(f"{'='*80}")
    print(f"📍 Port: {config.SERVICE_PORT}")
    print(f"🔗 MCP Server: {config.MCP_SERVER_URL}")
    print(f"📝 Log File: {config.LOG_FILE}")
    print(f"🔒 CORS Origins: {', '.join(config.CORS_ORIGINS)}")
    
    # Validate configuration
    errors = config.validate()
    if errors:
        print(f"\n⚠️  Configuration Warnings:")
        for error in errors:
            print(f"   - {error}")
    else:
        print(f"\n✅ Configuration validated successfully")
    
    print(f"{'='*80}\n")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=config.SERVICE_PORT,
        reload=True,
        log_level=config.LOG_LEVEL.lower()
    )
