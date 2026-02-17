import os
import sys
from dotenv import load_dotenv

# Set a DUMMY system environment variable to test override
os.environ["OPENAI_API_KEY"] = "sk-dummy-system-key-should-be-ignored"
print(f"System Env Key set to: {os.environ['OPENAI_API_KEY']}")

# Load .env with override=True
print("Loading .env with override=True...")
load_dotenv(override=True)

# Check the key in os.environ
loaded_key = os.environ.get("OPENAI_API_KEY")
print(f"Loaded Key: {loaded_key[:10]}...")

if loaded_key == "sk-dummy-system-key-should-be-ignored":
    print("❌ FAILED: System environment variable was NOT overridden.")
    sys.exit(1)
elif loaded_key and loaded_key.startswith("sk-proj-fh"): # Matches the new key start
    print("✅ SUCCESS: .env file overrode the system environment variable!")
else:
    print(f"⚠️  WARNING: Key loaded but does not match expected new key start. Value: {loaded_key[:10]}...")

# Clean up
del os.environ["OPENAI_API_KEY"]
