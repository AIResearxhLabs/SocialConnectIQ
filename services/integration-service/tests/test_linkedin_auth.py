"""
LinkedIn Authentication Workflow Tests

Comprehensive test suite for LinkedIn OAuth 2.0 authentication flow with
detailed monitoring and debugging capabilities.

Test Coverage:
1. Initial auth URL generation
2. OAuth callback handling
3. Token exchange and storage
4. Status checking
5. Post creation
6. Error handling and edge cases
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException
from datetime import datetime, timedelta
import httpx

from .conftest import (
    test_logger,
    assert_valid_linkedin_auth_url,
    assert_tokens_saved_correctly
)


class TestLinkedInAuthInitiation:
    """Test LinkedIn OAuth initiation endpoint"""
    
    @pytest.mark.asyncio
    async def test_linkedin_auth_url_generation_success(
        self, 
        mock_env_vars, 
        mock_firestore_db,
        test_user_id,
        test_monitor
    ):
        """
        Test successful LinkedIn auth URL generation
        
        Flow:
        1. User requests LinkedIn authentication
        2. System generates OAuth URL with state token
        3. State is stored in Firestore for CSRF protection
        4. Auth URL is returned to user
        """
        test_monitor.log_event("test_start", {
            "test": "linkedin_auth_url_generation",
            "user_id": test_user_id
        })
        
        with patch('app.main.db', mock_firestore_db):
            from app.main import linkedin_auth
            
            # Execute auth URL generation
            result = await linkedin_auth(user_id=test_user_id)
            
            test_monitor.log_event("auth_url_generated", {
                "auth_url": result["auth_url"][:100] + "..."
            })
            
            # Verify auth URL structure
            assert "auth_url" in result
            assert_valid_linkedin_auth_url(
                result["auth_url"], 
                mock_env_vars["LINKEDIN_CLIENT_ID"]
            )
            
            # Verify state was stored in Firestore
            mock_firestore_db.collection.assert_called_with('oauth_states')
            test_monitor.log_event("state_stored", {
                "collection": "oauth_states",
                "verified": True
            })
            
            test_logger.info("✓ LinkedIn auth URL generated successfully")
    
    @pytest.mark.asyncio
    async def test_linkedin_auth_url_contains_required_parameters(
        self,
        mock_env_vars,
        mock_firestore_db,
        test_user_id,
        test_monitor
    ):
        """
        Test that auth URL contains all required OAuth parameters
        
        Required Parameters:
        - response_type=code
        - client_id
        - redirect_uri
        - state (for CSRF)
        - scope (permissions)
        """
        test_monitor.log_event("test_start", {
            "test": "auth_url_parameters_validation"
        })
        
        with patch('app.main.db', mock_firestore_db):
            from app.main import linkedin_auth
            
            result = await linkedin_auth(user_id=test_user_id)
            auth_url = result["auth_url"]
            
            # Check all required parameters
            required_params = [
                "response_type=code",
                f"client_id={mock_env_vars['LINKEDIN_CLIENT_ID']}",
                f"redirect_uri={mock_env_vars['LINKEDIN_REDIRECT_URI']}",
                "state=",
                "scope="
            ]
            
            for param in required_params:
                assert param in auth_url, f"Missing parameter: {param}"
                test_monitor.log_event("parameter_verified", {
                    "parameter": param,
                    "present": True
                })
            
            test_logger.info("✓ All required parameters present in auth URL")
    
    @pytest.mark.asyncio
    async def test_linkedin_auth_without_user_id_fails(
        self,
        mock_env_vars,
        test_monitor
    ):
        """Test that auth fails without user ID"""
        test_monitor.log_event("test_start", {
            "test": "auth_without_user_id"
        })
        
        with patch('app.main.db', None):
            from app.main import linkedin_auth
            
            # Should raise exception when user_id is missing
            with pytest.raises(Exception):
                await linkedin_auth(user_id=None)
            
            test_monitor.log_error("expected_error", {
                "error": "Missing user_id",
                "expected": True
            })
            
            test_logger.info("✓ Auth correctly fails without user ID")


class TestLinkedInCallback:
    """Test LinkedIn OAuth callback endpoint"""
    
    @pytest.mark.asyncio
    async def test_linkedin_callback_success_flow(
        self,
        mock_env_vars,
        mock_firestore_db,
        mock_httpx_client,
        test_user_id,
        linkedin_auth_code,
        linkedin_state_token,
        test_monitor
    ):
        """
        Test successful OAuth callback flow
        
        Flow:
        1. User redirected from LinkedIn with auth code
        2. System validates state token
        3. Exchange auth code for access token
        4. Fetch user profile from LinkedIn
        5. Store tokens in Firestore
        6. Redirect user to frontend
        """
        test_monitor.log_event("test_start", {
            "test": "linkedin_callback_success",
            "user_id": test_user_id,
            "auth_code": linkedin_auth_code[:20] + "..."
        })
        
        # Setup Firestore state validation
        state_doc = MagicMock()
        state_doc.exists = True
        state_doc.to_dict.return_value = {
            "user_id": test_user_id,
            "platform": "linkedin",
            "created_at": datetime.utcnow(),
            "expires_at": (datetime.utcnow() + timedelta(minutes=10)).timestamp()
        }
        
        mock_firestore_db.collection.return_value.document.return_value.get.return_value = state_doc
        
        with patch('app.main.db', mock_firestore_db), \
             patch('httpx.AsyncClient', return_value=mock_httpx_client):
            
            from app.main import linkedin_callback
            
            # Execute callback
            result = await linkedin_callback(
                code=linkedin_auth_code,
                state=linkedin_state_token
            )
            
            test_monitor.log_event("callback_executed", {
                "result_type": type(result).__name__,
                "redirect_location": str(result.headers.get("location", ""))
            })
            
            # Verify redirect response
            assert result.status_code == 307  # Redirect
            assert "localhost:3000" in result.headers["location"]
            assert "status=success" in result.headers["location"]
            assert "platform=linkedin" in result.headers["location"]
            
            test_monitor.log_event("redirect_verified", {
                "status": "success",
                "platform": "linkedin"
            })
            
            # Verify state was deleted after use
            state_doc_ref = mock_firestore_db.collection.return_value.document.return_value
            state_doc_ref.delete.assert_called_once()
            
            test_monitor.log_event("state_cleaned_up", {
                "state_deleted": True
            })
            
            test_logger.info("✓ LinkedIn callback flow completed successfully")
    
    @pytest.mark.asyncio
    async def test_linkedin_callback_invalid_state(
        self,
        mock_env_vars,
        mock_firestore_db,
        linkedin_auth_code,
        test_monitor
    ):
        """
        Test callback with invalid state token
        
        Should reject the request to prevent CSRF attacks
        """
        test_monitor.log_event("test_start", {
            "test": "callback_invalid_state"
        })
        
        # Setup Firestore to return non-existent state
        state_doc = MagicMock()
        state_doc.exists = False
        
        mock_firestore_db.collection.return_value.document.return_value.get.return_value = state_doc
        
        with patch('app.main.db', mock_firestore_db):
            from app.main import linkedin_callback
            
            # Execute callback with invalid state
            result = await linkedin_callback(
                code=linkedin_auth_code,
                state="invalid_state_token"
            )
            
            # Should redirect with error
            assert result.status_code == 307
            assert "status=error" in result.headers["location"]
            
            test_monitor.log_error("invalid_state_rejected", {
                "state": "invalid",
                "handled_correctly": True
            })
            
            test_logger.info("✓ Invalid state token correctly rejected")
    
    @pytest.mark.asyncio
    async def test_linkedin_callback_token_exchange_failure(
        self,
        mock_env_vars,
        mock_firestore_db,
        test_user_id,
        linkedin_auth_code,
        linkedin_state_token,
        test_monitor
    ):
        """
        Test handling of token exchange failure
        
        Simulates LinkedIn API returning an error during token exchange
        """
        test_monitor.log_event("test_start", {
            "test": "token_exchange_failure"
        })
        
        # Setup valid state
        state_doc = MagicMock()
        state_doc.exists = True
        state_doc.to_dict.return_value = {
            "user_id": test_user_id,
            "platform": "linkedin"
        }
        
        mock_firestore_db.collection.return_value.document.return_value.get.return_value = state_doc
        
        # Mock failed HTTP request
        mock_client = AsyncMock()
        
        async def mock_post_error(*args, **kwargs):
            test_monitor.log_api_call("POST", "linkedin_token", status=401, error="Unauthorized")
            raise httpx.HTTPStatusError(
                "Unauthorized",
                request=MagicMock(),
                response=MagicMock(status_code=401)
            )
        
        mock_client.post = mock_post_error
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        
        with patch('app.main.db', mock_firestore_db), \
             patch('httpx.AsyncClient', return_value=mock_client):
            
            from app.main import linkedin_callback
            
            result = await linkedin_callback(
                code=linkedin_auth_code,
                state=linkedin_state_token
            )
            
            # Should redirect with error
            assert "status=error" in result.headers["location"]
            
            test_monitor.log_error("token_exchange_failed", {
                "error": "HTTPStatusError",
                "status_code": 401,
                "handled": True
            })
            
            test_logger.info("✓ Token exchange failure handled correctly")


class TestLinkedInStatus:
    """Test LinkedIn connection status endpoint"""
    
    @pytest.mark.asyncio
    async def test_linkedin_status_connected(
        self,
        mock_env_vars,
        mock_firestore_db,
        test_user_id,
        test_monitor
    ):
        """Test status check for connected LinkedIn account"""
        test_monitor.log_event("test_start", {
            "test": "status_check_connected",
            "user_id": test_user_id
        })
        
        with patch('app.main.db', mock_firestore_db):
            from app.main import linkedin_status
            
            result = await linkedin_status(user_id=test_user_id)
            
            test_monitor.log_event("status_retrieved", {
                "connected": result.get("connected"),
                "platform_user_id": result.get("platform_user_id")
            })
            
            assert result["connected"] is True
            assert "platform_user_id" in result
            
            test_logger.info("✓ Connected status retrieved correctly")
    
    @pytest.mark.asyncio
    async def test_linkedin_status_not_connected(
        self,
        mock_env_vars,
        test_user_id,
        test_monitor
    ):
        """Test status check for non-connected account"""
        test_monitor.log_event("test_start", {
            "test": "status_check_not_connected"
        })
        
        # Mock Firestore with no LinkedIn integration
        mock_db = MagicMock()
        doc_snapshot = MagicMock()
        doc_snapshot.exists = True
        doc_snapshot.to_dict.return_value = {"integrations": {}}
        
        mock_db.collection.return_value.document.return_value.get.return_value = doc_snapshot
        
        with patch('app.main.db', mock_db):
            from app.main import linkedin_status
            
            result = await linkedin_status(user_id=test_user_id)
            
            test_monitor.log_event("status_retrieved", {
                "connected": result.get("connected")
            })
            
            assert result["connected"] is False
            
            test_logger.info("✓ Not connected status retrieved correctly")


class TestLinkedInPosting:
    """Test LinkedIn posting functionality"""
    
    @pytest.mark.asyncio
    async def test_linkedin_post_success(
        self,
        mock_env_vars,
        mock_firestore_db,
        mock_httpx_client,
        test_user_id,
        test_monitor
    ):
        """
        Test successful post creation on LinkedIn
        
        Flow:
        1. Retrieve user's LinkedIn tokens from Firestore
        2. Call MCP server to create post
        3. Return success response
        """
        test_monitor.log_event("test_start", {
            "test": "linkedin_post_success",
            "user_id": test_user_id
        })
        
        with patch('app.main.db', mock_firestore_db), \
             patch('httpx.AsyncClient', return_value=mock_httpx_client):
            
            from app.main import post_to_linkedin, PostRequest
            
            post_request = PostRequest(
                content="Test LinkedIn post content",
                user_id=test_user_id
            )
            
            test_monitor.log_event("post_request_created", {
                "content_length": len(post_request.content)
            })
            
            result = await post_to_linkedin(post_request)
            
            test_monitor.log_event("post_created", {
                "success": result.get("success"),
                "post_id": result.get("post_id")
            })
            
            assert result["success"] is True
            assert "post_id" in result
            
            test_logger.info("✓ LinkedIn post created successfully")
    
    @pytest.mark.asyncio
    async def test_linkedin_post_without_tokens(
        self,
        mock_env_vars,
        test_user_id,
        test_monitor
    ):
        """Test posting without valid LinkedIn tokens"""
        test_monitor.log_event("test_start", {
            "test": "post_without_tokens"
        })
        
        # Mock Firestore with no tokens
        mock_db = MagicMock()
        doc_snapshot = MagicMock()
        doc_snapshot.exists = True
        doc_snapshot.to_dict.return_value = {"integrations": {}}
        
        mock_db.collection.return_value.document.return_value.get.return_value = doc_snapshot
        
        with patch('app.main.db', mock_db):
            from app.main import post_to_linkedin, PostRequest
            
            post_request = PostRequest(
                content="Test content",
                user_id=test_user_id
            )
            
            with pytest.raises(HTTPException) as exc_info:
                await post_to_linkedin(post_request)
            
            test_monitor.log_error("post_without_tokens", {
                "error": str(exc_info.value),
                "status_code": exc_info.value.status_code,
                "expected": True
            })
            
            assert exc_info.value.status_code == 401
            assert "not connected" in exc_info.value.detail.lower()
            
            test_logger.info("✓ Post correctly rejected without tokens")
    
    @pytest.mark.asyncio
    async def test_linkedin_post_expired_token(
        self,
        mock_env_vars,
        mock_firestore_db,
        test_user_id,
        test_monitor
    ):
        """
        Test posting with expired token
        
        Should return 401 and prompt re-authentication
        """
        test_monitor.log_event("test_start", {
            "test": "post_with_expired_token"
        })
        
        # Mock expired token response from MCP server
        mock_client = AsyncMock()
        
        async def mock_post_expired(*args, **kwargs):
            test_monitor.log_api_call("POST", "linkedin_post", status=401, error="Token expired")
            response = MagicMock()
            response.status_code = 401
            response.text = "Token expired"
            raise httpx.HTTPStatusError(
                "Token expired",
                request=MagicMock(),
                response=response
            )
        
        mock_client.post = mock_post_expired
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        
        with patch('app.main.db', mock_firestore_db), \
             patch('httpx.AsyncClient', return_value=mock_client):
            
            from app.main import post_to_linkedin, PostRequest
            
            post_request = PostRequest(
                content="Test content",
                user_id=test_user_id
            )
            
            with pytest.raises(HTTPException) as exc_info:
                await post_to_linkedin(post_request)
            
            test_monitor.log_error("expired_token", {
                "status_code": exc_info.value.status_code,
                "detail": exc_info.value.detail,
                "expected": True
            })
            
            assert exc_info.value.status_code == 401
            assert "expired" in exc_info.value.detail.lower()
            
            test_logger.info("✓ Expired token handled correctly")


class TestLinkedInDisconnect:
    """Test LinkedIn disconnection functionality"""
    
    @pytest.mark.asyncio
    async def test_linkedin_disconnect_success(
        self,
        mock_env_vars,
        mock_firestore_db,
        test_user_id,
        test_monitor
    ):
        """Test successful LinkedIn disconnection"""
        test_monitor.log_event("test_start", {
            "test": "disconnect_success",
            "user_id": test_user_id
        })
        
        with patch('app.main.db', mock_firestore_db):
            from app.main import disconnect_linkedin
            
            result = await disconnect_linkedin(user_id=test_user_id)
            
            test_monitor.log_event("disconnect_executed", {
                "message": result.get("message")
            })
            
            # Verify Firestore update was called
            mock_firestore_db.collection.assert_called_with('users')
            
            assert "message" in result
            assert "disconnected" in result["message"].lower()
            
            test_logger.info("✓ LinkedIn disconnected successfully")
    
    @pytest.mark.asyncio
    async def test_linkedin_disconnect_without_firestore(
        self,
        mock_env_vars,
        test_user_id,
        test_monitor
    ):
        """Test disconnect when Firestore is not available"""
        test_monitor.log_event("test_start", {
            "test": "disconnect_no_firestore"
        })
        
        with patch('app.main.db', None):
            from app.main import disconnect_linkedin
            
            with pytest.raises(HTTPException) as exc_info:
                await disconnect_linkedin(user_id=test_user_id)
            
            test_monitor.log_error("no_firestore", {
                "status_code": exc_info.value.status_code,
                "expected": True
            })
            
            assert exc_info.value.status_code == 503
            
            test_logger.info("✓ Firestore unavailable error handled correctly")


# Integration test for complete flow
class TestLinkedInCompleteFlow:
    """Integration test for the complete LinkedIn OAuth flow"""
    
    @pytest.mark.asyncio
    async def test_complete_linkedin_authentication_flow(
        self,
        mock_env_vars,
        mock_firestore_db,
        mock_httpx_client,
        test_user_id,
        linkedin_auth_code,
        test_monitor
    ):
        """
        Test the complete LinkedIn authentication workflow
        
        Complete Flow:
        1. User initiates auth → Get auth URL
        2. User authorizes on LinkedIn → Redirected back with code
        3. System exchanges code for tokens → Stores in Firestore
        4. System fetches user profile → Updates user data
        5. User is redirected to frontend → Success message
        6. Check connection status → Should be connected
        7. Create a test post → Should succeed
        8. Disconnect → Should succeed
        """
        test_monitor.log_event("integration_test_start", {
            "test": "complete_linkedin_flow",
            "user_id": test_user_id
        })
        
        with patch('app.main.db', mock_firestore_db), \
             patch('httpx.AsyncClient', return_value=mock_httpx_client):
            
            # Step 1: Initiate authentication
            test_monitor.log_event("step_1", {"action": "initiate_auth"})
            from app.main import linkedin_auth
            auth_result = await linkedin_auth(user_id=test_user_id)
            assert "auth_url" in auth_result
            test_monitor.log_event("step_1_complete", {"has_auth_url": True})
            
            # Step 2: Handle callback (simulate user authorization)
            test_monitor.log_event("step_2", {"action": "handle_callback"})
            
            # Setup state validation
            import secrets
            state_token = secrets.token_urlsafe(32)
            state_doc = MagicMock()
            state_doc.exists = True
            state_doc.to_dict.return_value = {
                "user_id": test_user_id,
                "platform": "linkedin"
            }
            mock_firestore_db.collection.return_value.document.return_value.get.return_value = state_doc
            
            from app.main import linkedin_callback
            callback_result = await linkedin_callback(
                code=linkedin_auth_code,
                state=state_token
            )
            assert callback_result.status_code == 307
            assert "status=success" in callback_result.headers["location"]
            test_monitor.log_event("step_2_complete", {"callback_successful": True})
            
            # Step 3: Check connection status
            test_monitor.log_event("step_3", {"action": "check_status"})
            from app.main import linkedin_status
            status_result = await linkedin_status(user_id=test_user_id)
            assert status_result["connected"] is True
            test_monitor.log_event("step_3_complete", {"connected": True})
            
            # Step 4: Create a post
            test_monitor.log_event("step_4", {"action": "create_post"})
            from app.main import post_to_linkedin, PostRequest
            post_request = PostRequest(
                content="Integration test post",
                user_id=test_user_id
            )
            post_result = await post_to_linkedin(post_request)
            assert post_result["success"] is True
            test_monitor.log_event("step_4_complete", {"post_created": True})
            
            # Step 5: Disconnect
            test_monitor.log_event("step_5", {"action": "disconnect"})
            from app.main import disconnect_linkedin
            disconnect_result = await disconnect_linkedin(user_id=test_user_id)
            assert "disconnected" in disconnect_result["message"].lower()
            test_monitor.log_event("step_5_complete", {"disconnected": True})
            
            test_monitor.log_event("integration_test_complete", {
                "all_steps": "passed",
                "total_steps": 5
            })
            
            test_logger.info("✓✓✓ Complete LinkedIn authentication flow successful ✓✓✓")
