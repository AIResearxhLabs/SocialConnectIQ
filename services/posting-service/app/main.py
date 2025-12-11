from fastapi import FastAPI

app = FastAPI(
    title="Posting Service",
    description="Executes the actual API calls to social platforms to publish content.",
    version="1.0.0",
)

@app.get("/")
async def root():
    return {"message": "Posting Service is running"}

# Logic for handling post requests will be added here.
