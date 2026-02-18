import os
import sys

print("Checking System Environment Variables...")
key = os.environ.get("OPENAI_API_KEY")

if key:
    print(f"FOUND: OPENAI_API_KEY is set in system environment!")
    print(f"Value: {key[:10]}...{key[-5:]}")
    if "tJcA" in key: # Verify if it's the old key mentioned in .env comment
        print("MATCH: It appears to be the old/invalid key.")
else:
    print("NOT FOUND: OPENAI_API_KEY is NOT set in system environment.")
