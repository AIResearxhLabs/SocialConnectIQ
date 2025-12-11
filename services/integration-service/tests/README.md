# LinkedIn Authentication Test Suite

Comprehensive test suite for the LinkedIn OAuth 2.0 authentication workflow with detailed monitoring and debugging capabilities.

## 📋 Overview

This test suite provides:
- **Complete OAuth flow testing** from auth URL generation to token storage
- **Detailed monitoring and logging** at every step
- **Comprehensive error handling tests** for all failure scenarios
- **Performance metrics tracking** for API calls
- **Visual flow diagrams** generation
- **Flexible test execution** with multiple filtering options

## 🚀 Quick Start

### Running All Tests

```bash
cd services/integration-service
./run_tests.sh
```

### Running Specific Test Categories

```bash
# Run only authentication initiation tests
./run_tests.sh --auth

# Run only OAuth callback tests
./run_tests.sh --callback

# Run only posting tests
./run_tests.sh --posting

# Run unit tests only
./run_tests.sh --unit

# Run integration tests only
./run_tests.sh --integration
```

### Running with Verbose Output

```bash
./run_tests.sh --verbose
# or
./run_tests.sh -v
```

### Running a Specific Test

```bash
./run_tests.sh --test test_linkedin_callback_success_flow
```

### Exporting Detailed Reports

```bash
./run_tests.sh --export-report
```

## 📊 Test Structure

### Test Files

| File | Purpose |
|------|---------|
| `test_linkedin_auth.py` | Main test suite for LinkedIn OAuth workflow |
| `conftest.py` | Shared fixtures, mocks, and test utilities |
| `test_monitoring_utils.py` | Monitoring and debugging utilities |

### Test Categories

#### 1. TestLinkedInAuthInitiation
Tests the OAuth authorization URL generation:
- ✅ Successful auth URL generation
- ✅ Required parameters validation
- ✅ State token storage in Firestore
- ✅ Error handling without user ID

#### 2. TestLinkedInCallback
Tests the OAuth callback handling:
- ✅ Successful token exchange
- ✅ User profile fetching
- ✅ Token storage in Firestore
- ✅ Invalid state token rejection (CSRF protection)
- ✅ Token exchange failure handling
- ✅ Proper redirect to frontend

#### 3. TestLinkedInStatus
Tests connection status checking:
- ✅ Connected account status
- ✅ Non-connected account status
- ✅ Platform user ID retrieval

#### 4. TestLinkedInPosting
Tests content posting functionality:
- ✅ Successful post creation
- ✅ Post without tokens (401 error)
- ✅ Expired token handling
- ✅ MCP server communication

#### 5. TestLinkedInDisconnect
Tests disconnection functionality:
- ✅ Successful disconnection
- ✅ Firestore update verification
- ✅ Error handling without Firestore

#### 6. TestLinkedInCompleteFlow
Integration test for the complete workflow:
- ✅ End-to-end authentication flow
- ✅ Multi-step workflow validation
- ✅ State management across steps

## 🔍 Monitoring & Debugging

### Test Monitor

The `TestMonitor` class tracks:
- **API calls** with request/response details
- **Test events** and milestones
- **Errors** with full context
- **State transitions**
- **Performance metrics**

### Detailed Logging

Every test generates detailed logs capturing:
- Request/response payloads
- Status codes and errors
- Timing information
- State changes
- Validation results

### Log Files

After running tests, check these files:

```bash
# Main test execution log with all details
cat tests/test_execution.log

# Coverage report (JSON format)
cat tests/coverage.json

# HTML test report
open tests/reports/test_report.html

# Coverage report (HTML)
open tests/coverage_report/index.html
```

## 📈 Reports Generated

### 1. HTML Test Report
Location: `tests/reports/test_report.html`

Visual report showing:
- Test results summary
- Passed/failed tests
- Execution time
- Detailed error messages

### 2. Coverage Report
Location: `tests/coverage_report/index.html`

Code coverage analysis showing:
- Line-by-line coverage
- Branch coverage
- Function coverage
- Missing coverage areas

### 3. Test Execution Log
Location: `tests/test_execution.log`

Detailed execution log with:
- Timestamp for each operation
- API call details
- Error traces
- Debug information

### 4. Coverage JSON
Location: `tests/coverage.json`

Machine-readable coverage data for CI/CD integration.

## 🐛 Debugging Failed Tests

### Step 1: Check the HTML Report
```bash
open tests/reports/test_report.html
```
This shows which tests failed and why.

### Step 2: Review the Execution Log
```bash
cat tests/test_execution.log | grep ERROR
```
Search for ERROR messages to identify the failure point.

### Step 3: Run Specific Test with Verbose Output
```bash
./run_tests.sh --test <test_name> --verbose
```
This provides detailed step-by-step execution information.

### Step 4: Check API Call Logs
Look for patterns in the test monitor output:
- Which API call failed?
- What was the status code?
- What error message was returned?

## 🔧 Common Issues & Solutions

### Issue: Tests fail with "Module not found"
**Solution:**
```bash
cd services/integration-service
pip install -r requirements.txt
```

### Issue: Firestore connection errors
**Solution:** Check environment variables in `.env` file:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

### Issue: LinkedIn API errors
**Solution:** Verify LinkedIn OAuth credentials:
```
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_REDIRECT_URI=your-redirect-uri
```

### Issue: Mock not working correctly
**Solution:** Check `conftest.py` fixtures are properly configured and imported.

## 📝 Writing New Tests

### Example Test Structure

```python
import pytest
from conftest import test_logger

class TestNewFeature:
    """Test description"""
    
    @pytest.mark.asyncio
    async def test_new_functionality(
        self,
        mock_env_vars,
        mock_firestore_db,
        test_user_id,
        test_monitor
    ):
        """Test docstring explaining what is being tested"""
        
        # Log test start
        test_monitor.log_event("test_start", {
            "test": "new_functionality",
            "user_id": test_user_id
        })
        
        # Your test implementation
        # ...
        
        # Log successful completion
        test_monitor.log_event("test_complete", {
            "result": "success"
        })
        
        test_logger.info("✓ Test passed")
```

### Available Fixtures

| Fixture | Description |
|---------|-------------|
| `test_monitor` | TestMonitor instance for detailed tracking |
| `mock_env_vars` | Mocked environment variables |
| `mock_firestore_db` | Mocked Firestore database |
| `mock_httpx_client` | Mocked HTTP client for API calls |
| `test_user_id` | Test user ID |
| `linkedin_auth_code` | Mock authorization code |
| `linkedin_state_token` | Mock state token |
| `mock_linkedin_tokens` | Mock OAuth tokens |
| `mock_linkedin_profile` | Mock user profile data |

## 🎯 Test Coverage Goals

Current coverage requirements:
- **Overall project coverage:** ≥ 80%
- **New/modified code:** 100%
- **Critical modules:** ≥ 90%

## 🔐 Security Testing

The test suite includes security-focused tests:
- ✅ CSRF protection (state token validation)
- ✅ Token expiration handling
- ✅ Secure token storage
- ✅ Input validation
- ✅ Error message sanitization (no sensitive data exposure)

## 🚦 CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run LinkedIn Auth Tests
  run: |
    cd services/integration-service
    ./run_tests.sh --export-report
    
- name: Upload Test Reports
  uses: actions/upload-artifact@v2
  with:
    name: test-reports
    path: services/integration-service/tests/reports/
```

## 📚 Additional Resources

- [LinkedIn OAuth 2.0 Documentation](https://docs.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [Pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)

## 🤝 Contributing

When adding new tests:
1. Follow the existing test structure
2. Add comprehensive logging via `test_monitor`
3. Include both success and failure scenarios
4. Document expected behavior in docstrings
5. Update this README if adding new test categories

## 📞 Support

For issues or questions:
1. Check the test execution log first
2. Review common issues section above
3. Run tests with `--verbose` flag for more details
4. Check the HTML reports for visual debugging

---

**Last Updated:** 2025-01-17
**Test Framework:** pytest 7.4.0+
**Python Version:** 3.8+
