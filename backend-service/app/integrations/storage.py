"""
Token storage management using Firestore
"""
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from typing import Optional, Dict, Any
import sys
import os

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.logging_utils import CorrelationLogger

logger = CorrelationLogger(
    service_name="STORAGE",
    log_file="logs/centralized.log"
)


class TokenStorage:
    """Manages OAuth token storage in Firestore"""
    
    def __init__(self):
        self.db = None
        self._initialize_firebase()
    
    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Check if Firebase is already initialized
            firebase_admin.get_app()
            self.db = firestore.client()
            print("✅ Firebase already initialized - using existing instance")
        except ValueError:
            # Initialize Firebase with credentials from environment
            try:
                from ..config import config
                
                if config.FIREBASE_PROJECT_ID and config.FIREBASE_PRIVATE_KEY and config.FIREBASE_CLIENT_EMAIL:
                    if len(config.FIREBASE_PRIVATE_KEY) > 50:
                        cred = credentials.Certificate({
                            "type": "service_account",
                            "project_id": config.FIREBASE_PROJECT_ID,
                            "private_key": config.FIREBASE_PRIVATE_KEY,
                            "client_email": config.FIREBASE_CLIENT_EMAIL,
                            "token_uri": "https://oauth2.googleapis.com/token",
                            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                        })
                        firebase_admin.initialize_app(cred)
                        self.db = firestore.client()
                        print("✅ Firebase initialized successfully")
                    else:
                        print("⚠️ Firebase private key too short - not initialized")
                else:
                    print("⚠️ Firebase credentials incomplete - not initialized")
            except Exception as e:
                print(f"⚠️ Could not initialize Firebase: {e}")
    
    async def save_oauth_state(
        self, 
        state: str, 
        user_id: str, 
        platform: str,
        correlation_id: str = "unknown"
    ) -> bool:
        """Save OAuth state for validation"""
        if self.db is None:
            logger.warning(
                "Firestore not initialized - cannot save OAuth state",
                correlation_id=correlation_id,
                user_id=user_id
            )
            return False
        
        try:
            state_data = {
                'user_id': user_id,
                'platform': platform,
                'created_at': firestore.SERVER_TIMESTAMP,
                'expires_at': datetime.utcnow().timestamp() + 600  # 10 minutes
            }
            
            self.db.collection('oauth_states').document(state).set(state_data)
            
            logger.success(
                f"OAuth state saved for {platform}",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"platform": platform, "state_prefix": state[:12]}
            )
            
            return True
        except Exception as e:
            logger.error(
                f"Failed to save OAuth state: {str(e)}",
                correlation_id=correlation_id,
                user_id=user_id
            )
            return False
    
    async def validate_oauth_state(
        self, 
        state: str,
        correlation_id: str = "unknown"
    ) -> Optional[Dict[str, Any]]:
        """Validate OAuth state and return user_id"""
        if self.db is None:
            logger.warning(
                "Firestore not initialized - cannot validate OAuth state",
                correlation_id=correlation_id
            )
            return None
        
        try:
            state_doc = self.db.collection('oauth_states').document(state).get()
            
            if not state_doc.exists:
                logger.warning(
                    "OAuth state not found or expired",
                    correlation_id=correlation_id,
                    additional_data={"state_prefix": state[:12]}
                )
                return None
            
            state_data = state_doc.to_dict()
            
            # Delete used state
            self.db.collection('oauth_states').document(state).delete()
            
            logger.success(
                f"OAuth state validated for {state_data.get('platform')}",
                correlation_id=correlation_id,
                user_id=state_data.get('user_id')
            )
            
            return state_data
            
        except Exception as e:
            logger.error(
                f"Failed to validate OAuth state: {str(e)}",
                correlation_id=correlation_id
            )
            return None
    
    async def save_tokens(
        self,
        user_id: str,
        platform: str,
        token_data: Dict[str, Any],
        correlation_id: str = "unknown"
    ) -> bool:
        """Save OAuth tokens for a user and platform"""
        if self.db is None:
            logger.warning(
                "Firestore not initialized - cannot save tokens",
                correlation_id=correlation_id,
                user_id=user_id
            )
            return False
        
        try:
            user_ref = self.db.collection('users').document(user_id)
            
            # Update the integrations field with the new token data
            user_ref.set({
                'integrations': {
                    platform: {
                        'access_token': token_data.get('access_token'),
                        'refresh_token': token_data.get('refresh_token', ''),
                        'expires_at': token_data.get('expires_at'),
                        'connected': True,
                        'connected_at': firestore.SERVER_TIMESTAMP,
                        'platform_user_id': token_data.get('platform_user_id', ''),
                    }
                }
            }, merge=True)
            
            logger.success(
                f"Tokens saved for {platform}",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"platform": platform}
            )
            
            return True
        except Exception as e:
            logger.error(
                f"Failed to save tokens: {str(e)}",
                correlation_id=correlation_id,
                user_id=user_id
            )
            return False
    
    async def get_tokens(
        self,
        user_id: str,
        platform: str,
        correlation_id: str = "unknown"
    ) -> Optional[Dict[str, Any]]:
        """Retrieve OAuth tokens for a user and platform"""
        if self.db is None:
            logger.warning(
                "Firestore not initialized - cannot get tokens",
                correlation_id=correlation_id,
                user_id=user_id
            )
            return None
        
        try:
            user_ref = self.db.collection('users').document(user_id)
            user_doc = user_ref.get()
            
            if not user_doc.exists:
                logger.info(
                    f"User document not found",
                    correlation_id=correlation_id,
                    user_id=user_id
                )
                return None
            
            user_data = user_doc.to_dict()
            integrations = user_data.get('integrations', {})
            
            tokens = integrations.get(platform, {})
            
            if tokens:
                logger.info(
                    f"Tokens retrieved for {platform}",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"platform": platform, "connected": tokens.get('connected', False)}
                )
            
            return tokens
            
        except Exception as e:
            logger.error(
                f"Failed to get tokens: {str(e)}",
                correlation_id=correlation_id,
                user_id=user_id
            )
            return None
    
    async def disconnect_platform(
        self,
        user_id: str,
        platform: str,
        correlation_id: str = "unknown"
    ) -> bool:
        """Disconnect a platform integration"""
        if self.db is None:
            logger.warning(
                "Firestore not initialized - cannot disconnect",
                correlation_id=correlation_id,
                user_id=user_id
            )
            return False
        
        try:
            user_ref = self.db.collection('users').document(user_id)
            user_ref.update({
                f'integrations.{platform}': firestore.DELETE_FIELD
            })
            
            logger.success(
                f"{platform} disconnected",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"platform": platform}
            )
            
            return True
        except Exception as e:
            logger.error(
                f"Failed to disconnect {platform}: {str(e)}",
                correlation_id=correlation_id,
                user_id=user_id
            )
            return False


# Global instance
token_storage = TokenStorage()
