
"""
Twitter/X Authentication Workflow Tests

Comprehensive test suite for Twitter OAuth 2.0 authentication flow.
Mirroring the structure of test_linkedin_auth.py but adapted for Twitter's Agent Service delegation model.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException
from datetime import datetime, timedelta
import httpx

from .conftest import (
    test_logger
)

class TestTwitterAuthInitiation:
    """Test Twitter OAuth initiation endpoint"""
    
    @pytest.mark.asyncio
    async def test_twitter_auth_url_generation_success(
        self, 
        mock_env_vars, 
        mock_firestore_db,
        test_user_id,
        test_monitor,
        mock_httpx_client
    ):
        """
        Test successful Twitter auth URL generation via Agent Service
        """
        test_monitor.log_event("test_start", {
            "test": "twitter_auth_url_generation",
            "user_id": test_user_id
        })
        
        # Mock Agent Service Response
        valid_agent_response = {
            "success": True,
            "auth_url": "https://twitter.com/i/oauth2/authorize?response_type=code&client_id=xyz&state=abc&code_challenge=def",
            "state": "mock_twitter_state_123",
            "code_verifier": "mock_pkce_verifier_456"
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = MagicMock(
            status_code=200,
            json=lambda: valid_agent_response
        )
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        
        with patch('app.main.db', mock_firestore_db), \
             patch('httpx.AsyncClient', return_value=mock_client):
            from app.main import twitter_auth
            
            # Execute auth URL generation
            request = MagicMock()
            request.headers = {}
            result = await twitter_auth(request=request, user_id=test_user_id)
            
            test_monitor.log_event("auth_url_generated", {
                "auth_url": result["auth_url"]
            })
            
            # Verify result
            assert result["auth_url"] == valid_agent_response["auth_url"]
            assert result["state"] == valid_agent_response["state"]
            
            # Verify state AND verifier were stored in Firestore
            mock_firestore_db.collection.assert_called_with('oauth_states')
            collection = mock_firestore_db.collection.return_value
            collection.document.assert_called_with(valid_agent_response["state"])
            document = collection.document.return_value
            
            # Check what was saved
            args, kwargs = document.set.call_args
            saved_data = args[0]
            assert saved_data["user_id"] == test_user_id
            assert saved_data["platform"] == "twitter"
            assert saved_data["code_verifier"] == valid_agent_response["code_verifier"]
            
            test_logger.info("✓ Twitter auth flow correctly stored state and PKCE verifier")

class TestTwitterCallback:
    """Test Twitter OAuth callback endpoint"""
    
    @pytest.mark.asyncio
    async def test_twitter_callback_success_flow(
        self,
        mock_env_vars,
        mock_firestore_db,
        test_user_id,
        test_monitor
    ):
        """
        Test successful OAuth callback flow
        """
        code = "mock_twitter_code"
        state = "mock_twitter_state"
        code_verifier = "mock_verifier"
        
        # 1. Setup Firestore Validation
        state_doc = MagicMock()
        state_doc.exists = True
        state_doc.to_dict.return_value = {
            "user_id": test_user_id,
            "platform": "twitter",
            "code_verifier": code_verifier
        }
        mock_firestore_db.collection.return_value.document.return_value.get.return_value = state_doc
        
        # 2. Mock Agent Service Response for Callback
        mock_client = AsyncMock()
        mock_client.post.return_value = MagicMock(
            status_code=200,
            json=lambda: {
                "success": True,
                "result": {
                    "access_token": "mock_twitter_access_token",
                    "refresh_token": "mock_twitter_refresh_token",
                    "expires_in": 7200,
                    "platform_user_id": "twitter_user_999"
                }
            }
        )
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        
        with patch('app.main.db', mock_firestore_db), \
             patch('httpx.AsyncClient', return_value=mock_client):
            
            from app.main import twitter_callback
            
            result = await twitter_callback(code=code, state=state)
            
            # Verify Redirect
            assert result.status_code == 307
            assert "status=success" in result.headers["location"]
            assert "platform=twitter" in result.headers["location"]
            
            # Verify Agent Service was called with code_verifier
            mock_client.post.assert_called()
            call_args = mock_client.post.call_args
            # First arg is URL, check json body
            assert call_args.kwargs['json']['code'] == code
            assert call_args.kwargs['json']['code_verifier'] == code_verifier
            
            # Verify Tokens Saved
            mock_firestore_db.collection.assert_called_with('users')
            
            test_logger.info("✓ Twitter callback flow validated state and exchanged tokens via Agent Service")

class TestTwitterPosting:
    """Test Twitter posting functionality"""
    
    @pytest.mark.asyncio
    async def test_twitter_post_success(
        self,
        mock_env_vars,
        mock_firestore_db,
        test_user_id,
        test_monitor
    ):
        """Test successful post creation on Twitter"""
        
        # Mock Firestore Tokens
        doc_snapshot = MagicMock()
        doc_snapshot.exists = True
        doc_snapshot.to_dict.return_value = {
            "integrations": {
                "twitter": {
                    "access_token": "valid_token",
                    "connected": True
                }
            }
        }
        mock_firestore_db.collection.return_value.document.return_value.get.return_value = doc_snapshot
        
        # Mock Agent Service
        mock_client = AsyncMock()
        mock_client.post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"success": True, "id": "tweet_123"}
        )
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        
        with patch('app.main.db', mock_firestore_db), \
             patch('httpx.AsyncClient', return_value=mock_client):
            
            from app.main import post_to_twitter, PostRequest
            
            result = await post_to_twitter(PostRequest(content="Hello X", user_id=test_user_id))
            
            assert result["success"] is True
            assert result["id"] == "tweet_123"
