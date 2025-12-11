from fastapi import FastAPI

app = FastAPI(
    title="Analytics Service",
    description="Ingests and aggregates metrics data from various platforms for display.",
    version="1.0.0",
)

@app.get("/")
async def root():
    return {"message": "Analytics Service is running"}

# API endpoints for fetching analytics data will be added here.
