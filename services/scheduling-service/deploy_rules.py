"""
Deploy Firestore Rules using Service Account Credentials
Run from: services/scheduling-service folder
Command: python deploy_rules.py
"""
import os
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv(dotenv_path="../../.env")

PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")
CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL")

print(f"Project ID: {PROJECT_ID}")
print(f"Client Email: {CLIENT_EMAIL}")
print(f"Private Key length: {len(PRIVATE_KEY)} chars")

# The rules to deploy
RULES = '''rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /domains/{domainId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
'''

print("\n📜 Rules to deploy:")
print(RULES)

# Create credentials JSON
import json
import tempfile

creds = {
    "type": "service_account",
    "project_id": PROJECT_ID,
    "private_key": PRIVATE_KEY,
    "client_email": CLIENT_EMAIL,
    "token_uri": "https://oauth2.googleapis.com/token",
}

# Write to temp file
with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
    json.dump(creds, f)
    creds_file = f.name

print(f"\n✅ Created temp credentials file: {creds_file}")

# Use Google Cloud API to deploy rules
try:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    import requests
    
    credentials = service_account.Credentials.from_service_account_file(
        creds_file,
        scopes=['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']
    )
    credentials.refresh(Request())
    
    # Deploy rules via REST API
    url = f"https://firebaserules.googleapis.com/v1/projects/{PROJECT_ID}/rulesets"
    
    headers = {
        "Authorization": f"Bearer {credentials.token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "source": {
            "files": [{
                "name": "firestore.rules",
                "content": RULES
            }]
        }
    }
    
    print(f"\n🚀 Creating ruleset...")
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code == 200:
        ruleset = response.json()
        ruleset_name = ruleset.get("name")
        print(f"✅ Ruleset created: {ruleset_name}")
        
        # Now release (deploy) the ruleset
        release_url = f"https://firebaserules.googleapis.com/v1/projects/{PROJECT_ID}/releases/cloud.firestore"
        release_payload = {
            "name": f"projects/{PROJECT_ID}/releases/cloud.firestore",
            "rulesetName": ruleset_name
        }
        
        # Try PATCH first (update existing release)
        release_response = requests.patch(release_url, json=release_payload, headers=headers)
        
        if release_response.status_code != 200:
            # If PATCH fails, try POST (create new release)
            releases_url = f"https://firebaserules.googleapis.com/v1/projects/{PROJECT_ID}/releases"
            release_response = requests.post(releases_url, json=release_payload, headers=headers)
        
        if release_response.status_code == 200:
            print("🎉 Rules deployed successfully!")
        else:
            print(f"❌ Failed to release rules: {release_response.status_code}")
            print(release_response.text)
    else:
        print(f"❌ Failed to create ruleset: {response.status_code}")
        print(response.text)
        
except ImportError as e:
    print(f"\n❌ Missing dependency: {e}")
    print("Run: pip install google-auth google-auth-oauthlib requests")

finally:
    # Clean up temp file
    import os
    if os.path.exists(creds_file):
        os.remove(creds_file)
        print(f"\n🧹 Cleaned up temp credentials file")
