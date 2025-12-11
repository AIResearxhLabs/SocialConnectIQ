"""
Main integration routes - aggregates all platform routers
"""
from fastapi import APIRouter
from . import linkedin

# Create main integration router
router = APIRouter(prefix="/api/integrations", tags=["Integrations"])

# Include platform-specific routers
router.include_router(linkedin.router)

# Note: Facebook and Twitter routers can be added similarly when needed
# from . import facebook, twitter
# router.include_router(facebook.router)
# router.include_router(twitter.router)
