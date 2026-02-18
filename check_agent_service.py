import httpx
import asyncio

AGENT_URL = "http://localhost:8006"

async def check_agent():
    print(f"Checking Agent Service at {AGENT_URL}...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{AGENT_URL}/health", timeout=5.0)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")

if __name__ == "__main__":
    asyncio.run(check_agent())
