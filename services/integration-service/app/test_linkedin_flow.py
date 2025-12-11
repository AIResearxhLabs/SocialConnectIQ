"""
Quick test script to verify LinkedIn OAuth state flow
"""
import os
import sys
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Test Firebase connection
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    from datetime import datetime
    
    print("\n" + "="*80)
    print("🔥 FIREBASE CONNECTION TEST")
    print("="*80)
    
    # Get credentials
    firebase_project_id = os.getenv("FIREBASE_PROJECT_ID")
    firebase_private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n')
    firebase_client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
    
    print(f"Project ID: {firebase_project_id}")
    print(f"Client Email: {firebase_client_email}")
    print(f"Private Key Length: {len(firebase_private_key)} chars")
    
    if len(firebase_private_key) < 50:
        print("❌ CRITICAL: Private key too short!")
        sys.exit(1)
    
    # Initialize Firebase
    try:
        firebase_admin.get_app()
        print("✅ Firebase already initialized")
    except ValueError:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": firebase_project_id,
            "private_key": firebase_private_key,
            "client_email": firebase_client_email,
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        })
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized successfully")
    
    db = firestore.client()
    
    # Test: Create a test state
    test_state = "test_state_12345"
    test_user_id = "test_user_12345"
    
    print(f"\n📝 Creating test OAuth state...")
    print(f"   ├─ State: {test_state}")
    print(f"   └─ User ID: {test_user_id}")
    
    db.collection('oauth_states').document(test_state).set({
        'user_id': test_user_id,
        'platform': 'linkedin',
        'created_at': firestore.SERVER_TIMESTAMP,
        'expires_at': datetime.utcnow().timestamp() + 600
    })
    
    print("✅ Test state created")
    
    # Test: Read it back
    print(f"\n🔍 Reading test state back...")
    state_doc = db.collection('oauth_states').document(test_state).get()
    
    if state_doc.exists:
        state_data = state_doc.to_dict()
        print("✅ Test state found!")
        print(f"   ├─ User ID: {state_data.get('user_id')}")
        print(f"   ├─ Platform: {state_data.get('platform')}")
        print(f"   └─ Created: {state_data.get('created_at')}")
    else:
        print("❌ Test state NOT found!")
    
    # Cleanup
    print(f"\n🗑️  Cleaning up test state...")
    db.collection('oauth_states').document(test_state).delete()
    print("✅ Test state deleted")
    
    print("\n" + "="*80)
    print("✅ FIREBASE CONNECTION TEST PASSED")
    print("="*80 + "\n")
    
except Exception as e:
    print(f"\n❌ FIREBASE CONNECTION TEST FAILED")
    print(f"Error: {str(e)}")
    import traceback
    print(traceback.format_exc())
    sys.exit(1)
