#!/usr/bin/env python3
"""
Simple Test Script for OpenAI API Key
Verifies that the .env key is loaded correctly (overriding system envs)
"""
import os
import sys
from dotenv import load_dotenv

# Load .env file with override=True to fix the system env conflict
load_dotenv(override=True)

print("=" * 60)
print("Testing OpenAI API Key Configuration")
print("=" * 60)

# Get the API key
api_key = os.getenv("OPENAI_API_KEY", "")

if not api_key:
    print("❌ ERROR: No OPENAI_API_KEY found.")
    sys.exit(1)

# Mask the key for display
masked_key = f"{api_key[:10]}...{api_key[-5:]}" if len(api_key) > 15 else "***"
print(f"Loaded Key: {masked_key}")

if "sk-proj-fh" not in api_key:
    print("⚠️  WARNING: This does not look like your new key (starting with sk-proj-fh...)")
    print("   Check if .env is being loaded correctly.")
else:
    print("✅ Key prefix matches your new key.")

# Test connectivity
print("\nTesting connectivity with OpenAI...")
try:
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=5
    )
    print(f"✅ SUCCESS! API call worked.")
    print(f"Response: {response.choices[0].message.content}")

except Exception as e:
    print(f"❌ API Call Failed: {e}")
    sys.exit(1)
