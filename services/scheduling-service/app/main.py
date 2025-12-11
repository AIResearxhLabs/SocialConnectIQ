from fastapi import FastAPI

app = FastAPI(
    title="Scheduling Service",
    description="Stores post drafts, handles scheduling, and triggers the Posting Service.",
    version="1.0.0",
)

@app.get("/")
async def root():
    return {"message": "Scheduling Service is running"}

# API endpoints for creating, updating, and deleting scheduled posts will be added here.
