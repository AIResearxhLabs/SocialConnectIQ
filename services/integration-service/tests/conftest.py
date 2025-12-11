"""
Test Configuration and Fixtures for Integration Service Tests

This module provides shared fixtures, mocks, and test utilities for testing
the LinkedIn OAuth authentication workflow with detailed monitoring capabilities.
"""

import pytest
import os
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import json
import logging

# Configure detailed test logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)

# Test logger for monitoring
test_logger = logging.getLogger("integration_service_tests")


class TestMonitor:
    """Monitor test execution with detailed logging"""
    
    def __init__(self):
        self.events = []
        self.errors = []
        self.api_calls = []
        
    def log_event(self, event_type: str, details: Dict[str, Any]):
        """Log a test event"""
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": event_type,
            "details": details
        }
        self.events.append(event)
        test_logger.info(f"EVENT: {event_type} - {json.dumps(details, indent=2)}")
        
    def log_error(self, error_type: str, details: Dict[str, Any]):
        """Log a test error"""
        error = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": error_type,
            "details": details
        }
        self.errors.append(error)
        test_logger.error(f"ERROR: {error_type} - {json.dumps(details, indent=2)}")
        
    def log_api_call(self, method: str, url: str, status: Optional[int] = None, 
                     response: Optional[Dict] = None, error: Optional[str] = None):
        """Log an API call"""
        call = {
            "timestamp": datetime.utcnow().isoformat(),
            "method": method,
            "url": url,
            "status": status,
            "response": response,
            "error": error
        }
        self.api_calls.append(call)
        test_logger.debug(f"API_CALL: {method} {url} - Status: {status}")
        
    def get_report(self) -> Dict[str, Any]:
        """Get a comprehensive test report"""
        return {
            "total_events": len(self.events),
            "total_errors": len(self.errors),
            "total_api_calls": len(self.api_calls),
            "events": self.events,
            "errors": self.errors,
            "api_calls": self.api_calls
        }
        
    def print_report(self):
        """Print a formatted test report"""
        report = self.get_report()
        test_logger.info("\n" + "="*80)
        test_logger.info("TEST EXECUTION REPORT")
        test_logger.info("="*80)
        test_logger.info(f"Total Events: {report['total_events']}")
        test_logger.info(f"Total Errors: {report['total_errors']}")
        test_logger.info(f"Total API Calls: {report['total_api_calls']}")
        test_logger.info("="*80 + "\n")


@pytest.fixture
def test_monitor():
    """Fixture providing a test monitor instance"""
    monitor = TestMonitor()
    yield monitor
    # Print report after each test
    monitor.print_report()


@pytest.fixture
def mock_env_vars():
    """Mock environment variables for testing"""
    env_vars = {
        "LINKEDIN_CLIENT_ID": "test_client_id_12345",
        "LINKEDIN_CLIENT_SECRET": "test_client_secret_xyz",
        "LINKEDIN_REDIRECT_URI": "http://localhost:8000/api/integrations/linkedin/callback",
        "FIREBASE_PROJECT_ID": "test-project-id",
        "FIREBASE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\ntest_key\n-----END PRIVATE KEY-----",
        "FIREBASE_CLIENT_EMAIL": "test@test-project.iam.gserviceaccount.com",
        "MCP_SERVER_URL": "http://test-mcp-server:3001",
        "AGENT_SERVICE_URL": "http://localhost:8006"
    }
    
    with patch.dict(os.environ, env_vars):
        yield env_vars


@pytest.fixture
def test_user_id():
    """Fixture providing a test user ID"""
    return "test_user_123456"


@pytest.fixture
def mock_firestore_db():
    """Mock Firestore database"""
    db = MagicMock()
    
    # Mock collection and document structure
    collection_mock = MagicMock()
    document_mock = MagicMock()
    
    db.collection.return_value = collection_mock
    collection_mock.document.return_value = document_mock
    
    # Mock document operations
    doc_snapshot = MagicMock()
    doc_snapshot.exists = True
    doc_snapshot.to_dict.return_value = {
        "integrations": {
            "linkedin": {
                "access_token": "mock_access_token_xyz",
                "refresh_token": "mock_refresh_token_abc",
                "expires_at": (datetime.utcnow() + timedelta(days=30)).timestamp(),
                "connected": True,
                "platform_user_id": "linkedin_user_123"
            }
        }
    }
    
    document_mock.get.return_value = doc_snapshot
    document_mock.set = MagicMock()
    document_mock.update = MagicMock()
    document_mock.delete = MagicMock()
    
    return db


@pytest.fixture
def mock_httpx_client(test_monitor):
    """Mock httpx AsyncClient for external API calls"""
    
    async def mock_post(url: str, **kwargs):
        """Mock POST request"""
        test_monitor.log_api_call("POST", url, status=200)
        
        response = AsyncMock()
        response.status_code = 200
        
        # Mock LinkedIn token endpoint
        if "linkedin.com/oauth/v2/accessToken" in url:
            response.json.return_value = {
                "access_token": "mock_linkedin_access_token",
                "expires_in": 5184000,
                "refresh_token": "mock_linkedin_refresh_token"
            }
            test_monitor.log_event("linkedin_token_exchange", {
                "url": url,
                "response": "success"
            })
            
        # Mock MCP server endpoints
        elif "postToLinkedIn" in url:
            response.json.return_value = {
                "success": True,
                "post_id": "mock_post_123",
                "message": "Posted successfully"
            }
            test_monitor.log_event("linkedin_post_created", {
                "url": url,
                "response": "success"
            })
            
        response.raise_for_status = MagicMock()
        return response
    
    async def mock_get(url: str, **kwargs):
        """Mock GET request"""
        test_monitor.log_api_call("GET", url, status=200)
        
        response = AsyncMock()
        response.status_code = 200
        
        # Mock LinkedIn userinfo endpoint
        if "api.linkedin.com/v2/userinfo" in url:
            response.json.return_value = {
                "sub": "linkedin_user_123",
                "name": "Test User",
                "email": "test@example.com"
            }
            test_monitor.log_event("linkedin_profile_fetched", {
                "url": url,
                "response": "success"
            })
            
        response.raise_for_status = MagicMock()
        return response
    
    client = AsyncMock()
    client.post = mock_post
    client.get = mock_get
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    
    return client


@pytest.fixture
def linkedin_auth_code():
    """Mock LinkedIn authorization code"""
    return "mock_auth_code_linkedin_12345"


@pytest.fixture
def linkedin_state_token():
    """Mock state token for CSRF protection"""
    return "mock_state_token_csrf_xyz"


@pytest.fixture
def mock_linkedin_tokens():
    """Mock LinkedIn OAuth tokens"""
    return {
        "access_token": "mock_linkedin_access_token_xyz",
        "refresh_token": "mock_linkedin_refresh_token_abc",
        "expires_in": 5184000,  # 60 days
        "expires_at": (datetime.utcnow() + timedelta(days=60)).timestamp()
    }


@pytest.fixture
def mock_linkedin_profile():
    """Mock LinkedIn user profile"""
    return {
        "sub": "linkedin_user_123",
        "name": "Test User",
        "email": "test@example.com",
        "picture": "https://example.com/profile.jpg"
    }


@pytest.fixture
async def test_app(mock_env_vars, mock_firestore_db):
    """Create test FastAPI application instance"""
    from fastapi.testclient import TestClient
    
    # Import after env vars are mocked
    with patch('app.main.db', mock_firestore_db):
        from app.main import app
        
        client = TestClient(app)
        yield client


class MockHTTPXError:
    """Mock HTTPX error responses"""
    
    @staticmethod
    def create_request_error(message: str = "Connection error"):
        """Create a mock request error"""
        import httpx
        error = httpx.RequestError(message)
        return error
    
    @staticmethod
    def create_http_status_error(status_code: int = 401, message: str = "Unauthorized"):
        """Create a mock HTTP status error"""
        import httpx
        request = Mock()
        response = Mock()
        response.status_code = status_code
        response.text = message
        error = httpx.HTTPStatusError(message, request=request, response=response)
        return error


@pytest.fixture
def mock_httpx_errors():
    """Fixture providing mock HTTPX errors"""
    return MockHTTPXError()


# Helper functions for tests

def assert_valid_linkedin_auth_url(auth_url: str, expected_client_id: str):
    """Assert that a LinkedIn auth URL is valid"""
    assert "https://www.linkedin.com/oauth/v2/authorization" in auth_url
    assert f"client_id={expected_client_id}" in auth_url
    assert "response_type=code" in auth_url
    assert "state=" in auth_url
    assert "scope=openid%20profile%20email%20w_member_social" in auth_url
    test_logger.info(f"✓ LinkedIn auth URL is valid: {auth_url[:100]}...")


def assert_tokens_saved_correctly(db_mock, user_id: str, platform: str):
    """Assert that tokens were saved to Firestore correctly"""
    db_mock.collection.assert_called_with('users')
    collection_mock = db_mock.collection.return_value
    collection_mock.document.assert_called_with(user_id)
    
    document_mock = collection_mock.document.return_value
    assert document_mock.set.called or document_mock.update.called
    
    test_logger.info(f"✓ Tokens saved correctly for user {user_id} on platform {platform}")


def create_mock_request_with_user(user_id: str):
    """Create a mock request with user authentication"""
    request = Mock()
    request.headers = {"X-User-ID": user_id}
    return request
