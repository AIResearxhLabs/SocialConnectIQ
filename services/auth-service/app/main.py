from fastapi import FastAPI

app = FastAPI(
    title="Authentication Service",
    description="Handles user registration, login, and token management (JWT).",
    version="1.0.0",
)

@app.get("/")
async def root():
    return {"message": "Authentication Service is running"}

# API endpoints for registration, login, etc., will be added here.
