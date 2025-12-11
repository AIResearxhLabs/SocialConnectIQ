#!/usr/bin/env python3
"""
Test script to verify OpenAI API key is loaded and working
"""
import os
import sys
from dotenv import load_dotenv

# Load .env file
load_dotenv()

print("=" * 80)
print("🔑 OpenAI API Key Configuration Test")
print("=" * 80)

# Get the API key
api_key = os.getenv("OPENAI_API_KEY", "")

print(f"\n✅ .env file location: {os.path.abspath('.env')}")
print(f"✅ .env file exists: {os.path.exists('.env')}")

if api_key:
    # Mask the key for security
    if len(api_key) > 20:
        masked_key = f"{api_key[:10]}...{api_key[-10:]}"
    else:
        masked_key = "***too short***"
    
    print(f"\n✅ OpenAI API Key Found")
    print(f"   Length: {len(api_key)} characters")
    print(f"   Masked: {masked_key}")
    print(f"   Starts with: {api_key[:7]}")
    
    # Check if it's the old cached key
    if api_key.startswith("sk-proj-") and "tJcA" in api_key:
        print(f"\n❌ ERROR: This appears to be the OLD CACHED KEY!")
        print(f"   This key is causing the 401 error")
        sys.exit(1)
    
    # Test with OpenAI
    print(f"\n🧪 Testing API key with OpenAI...")
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        
        # Make a simple test call
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say 'test successful' in 2 words"}],
            max_tokens=10
        )
        
        print(f"✅ OpenAI API Key is VALID and WORKING!")
        print(f"   Response: {response.choices[0].message.content}")
        
    except Exception as e:
        error_str = str(e)
        print(f"\n❌ OpenAI API Test Failed:")
        print(f"   Error: {error_str}")
        
        if "401" in error_str or "Incorrect API key" in error_str:
            print(f"\n🔍 This is an AUTHENTICATION ERROR")
            print(f"   The API key in .env might be invalid or expired")
        
        sys.exit(1)
else:
    print(f"\n❌ ERROR: No OpenAI API Key found in environment!")
    print(f"   Check OPENAI_API_KEY in .env file")
    sys.exit(1)

print(f"\n" + "=" * 80)
print(f"✅ All tests passed! OpenAI API key is configured correctly")
print(f"=" * 80)
