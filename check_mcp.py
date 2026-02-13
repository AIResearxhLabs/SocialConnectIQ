import httpx
import asyncio
import os

MCP_URL = "http://localhost:3001"

async def check_mcp():
    print(f"Checking MCP Server at {MCP_URL}...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{MCP_URL}/mcp/tools", timeout=10.0)
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                tools = data.get('tools', [])
                if not tools and isinstance(data, list):
                    tools = data
                
                print(f"Found {len(tools)} tools:")
                found_linkedin = False
                for tool in tools:
                    name = tool.get('name')
                    print(f" - {name}")
                    if name == 'getLinkedInAuthUrl':
                        found_linkedin = True
                
                if found_linkedin:
                    print("\n✅ 'getLinkedInAuthUrl' tool found!")
                else:
                    print("\n❌ 'getLinkedInAuthUrl' tool NOT found!")
            else:
                print(f"Error response: {response.text}")

    except Exception as e:
        print(f"❌ Failed to connect: {e}")

if __name__ == "__main__":
    asyncio.run(check_mcp())
