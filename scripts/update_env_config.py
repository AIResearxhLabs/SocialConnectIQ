import os
import re

env_path = os.path.join(os.getcwd(), '.env')

try:
    with open(env_path, 'r', encoding='utf-8') as f:
        content = f.read()
except FileNotFoundError:
    print(".env file not found, creating new one")
    content = ""

# Updates from user request
updates = {
    "MCP_HOST_TYPE": "cloud",
    "MCP_SERVER_URL": "https://mcpsocial-service-xjajnhkzra-uc.a.run.app"
}

print(f"Updating {env_path}...")

for key, value in updates.items():
    if re.search(f"^{key}=", content, re.MULTILINE):
        print(f"Updating existing {key}...")
        content = re.sub(f"^{key}=.*", f"{key}={value}", content, flags=re.MULTILINE)
    else:
        print(f"Adding new {key}...")
        if content and not content.endswith('\n'):
            content += '\n'
        content += f"{key}={value}\n"

with open(env_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Updated .env successfully")
