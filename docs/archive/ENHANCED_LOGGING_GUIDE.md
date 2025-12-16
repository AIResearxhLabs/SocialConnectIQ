# 📊 Enhanced Logging & Debugging Guide

This guide documents the comprehensive logging system implemented across the application to help debug and troubleshoot issues, particularly with LinkedIn OAuth integration and MCP server interactions.

## 🎯 Overview

The enhanced logging system provides:
- **Detailed request/response logging** for all MCP interactions
- **Correlation ID tracking** across all services
- **Multiple log files** for different purposes
- **Debug endpoints** for real-time troubleshooting
- **Structured JSON logging** for automated analysis
- **Human-readable console output** for development

---

## 📁 Log File Structure

### Log Files Location

All logs are stored in the `/logs` directory:

| Log File | Purpose | Format | Updated By |
|----------|---------|--------|------------|
| `logs/centralized.log` | All services, structured logging | JSON | All services |
| `logs/agent-service.log` | Agent service specific logs | JSON | Agent Service |
| `logs/mcp-interactions.log` | **Detailed MCP request/response logs** | Human-readable + JSON | Agent Service MCP Client |
| `logs/backend-service.log` | Backend service logs | JSON | Backend Service |
| `logs/integration-service.log` | Integration service logs | JSON | Integration Service |

### Log File Contents

#### `logs/centralized.log`
- **Purpose**: Single source of truth for all application logs
- **Format**: JSON, one line per log entry
- **Content**: All INFO, WARNING, ERROR, SUCCESS level logs
- **Example**:
```json
{
  "timestamp": "2025-10-12T08:30:15.123456Z",
  "level": "INFO",
  "service": "AGENT-SERVICE",
  "correlation_id": "abc123-def456-ghi789",
  "user_id": "user_12345",
  "message": "MCP REQUEST: getLinkedInAuthUrl",
  "data": {
    "tool_name": "getLinkedInAuthUrl",
    "endpoint": "http://localhost:8007/mcp/v1",
    "method": "POST",
    "payload_size": 256
  }
}
```

#### `logs/mcp-interactions.log` ⭐ **MOST IMPORTANT FOR DEBUGGING**
- **Purpose**: Detailed HTTP-level logging of MCP server communications
- **Format**: Human-readable with visual separators
- **Content**: Complete request/response payloads, headers, timing
- **Example**:
```
====================================================================================================
🔵 MCP REQUEST
----------------------------------------------------------------------------------------------------
Timestamp:       2025-10-12T08:30:15.123456Z
Service:         AGENT-SERVICE-MCP-CLIENT
Correlation ID:  abc123-def456-ghi789
User ID:         user_12345
Tool Name:       getLinkedInAuthUrl
Endpoint:        http://localhost:8007/mcp/v1
Method:          POST
----------------------------------------------------------------------------------------------------
Headers:
{
  "Content-Type": "application/json"
}
----------------------------------------------------------------------------------------------------
Request Payload:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "getLinkedInAuthUrl",
    "arguments": {
      "callbackUrl": "http://localhost:8000/api/integrations/linkedin/callback"
    }
  }
}
====================================================================================================

====================================================================================================
✅ MCP RESPONSE
----------------------------------------------------------------------------------------------------
Timestamp:       2025-10-12T08:30:15.456789Z
Service:         AGENT-SERVICE-MCP-CLIENT
Correlation ID:  abc123-def456-ghi789
User ID:         user_12345
Tool Name:       getLinkedInAuthUrl
Status Code:     200
Elapsed Time:    0.333s
Success:         True
----------------------------------------------------------------------------------------------------
Response Headers:
{
  "content-type": "application/json",
  "content-length": "512"
}
----------------------------------------------------------------------------------------------------
Response Body:
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"authUrl\":\"https://www.linkedin.com/oauth/v2/authorization?...\",\"state\":\"abc123...\"}"
      }
    ]
  }
}
----------------------------------------------------------------------------------------------------
Error: None
====================================================================================================
```

---

## 🔍 How to Debug Issues

### Step 1: Identify the Correlation ID

When an issue occurs:
1. Check the browser console or network tab for the `X-Correlation-ID` header in the response
2. Or check the most recent logs for the timestamp when the issue occurred

### Step 2: Trace the Request Flow

Use the correlation ID to trace the request across services:

```bash
# Search all logs for a specific correlation ID
grep "abc123-def456-ghi789" logs/centralized.log

# View MCP interactions for that correlation ID
grep "abc123-def456-ghi789" logs/mcp-interactions.log
```

### Step 3: Examine MCP Request/Response

The `logs/mcp-interactions.log` file contains the complete HTTP conversation:

1. **Request Section** - Shows exactly what was sent to MCP server:
   - Endpoint URL
   - Request headers
   - Complete JSON-RPC payload
   
2. **Response Section** - Shows exactly what was received:
   - HTTP status code
   - Response headers
   - Complete response body
   - Elapsed time
   - Any errors

### Step 4: Check for Common Issues

#### Issue: LinkedIn Connection Status Not Showing

**What to check:**
1. Search `logs/mcp-interactions.log` for `getLinkedInAuthUrl`
2. Verify the MCP server returned a valid `authUrl` and `state`
3. Check if the `state` parameter was saved to Firestore (search centralized.log for "OAuth state saved")
4. Verify the callback received the correct `state` parameter

**Example log search:**
```bash
# Find all LinkedIn auth URL requests
grep -A 50 "getLinkedInAuthUrl" logs/mcp-interactions.log | grep -E "(authUrl|state)"

# Check if state was saved
grep "OAuth state saved" logs/centralized.log
```

#### Issue: MCP Server Not Responding

**What to check:**
1. Look for `RequestError` or `HTTPStatusError` in logs
2. Check the MCP server is running on the correct port
3. Use the debug endpoint: `http://localhost:8006/debug/connection-test`

---

## 🛠️ Debug Endpoints

The Agent Service provides several debug endpoints for real-time troubleshooting:

### 1. **Test MCP Connection**
```
GET http://localhost:8006/debug/connection-test
```

**Returns:**
```json
{
  "status": "success",
  "mcp_server": "http://localhost:8007",
  "response_time": "0.125s",
  "available_tools": ["getLinkedInAuthUrl", "exchangeLinkedInAuthCode", "postToLinkedIn"]
}
```

### 2. **View Recent MCP Logs**
```
GET http://localhost:8006/debug/mcp-logs?lines=100
```

**Returns:**
```json
{
  "total_lines": 500,
  "returned_lines": 100,
  "logs": "... recent log content ..."
}
```

### 3. **Get Log File Locations**
```
GET http://localhost:8006/debug/last-request
```

**Returns:**
```json
{
  "message": "Check logs/mcp-interactions.log for detailed request/response logs",
  "centralized_log": "logs/centralized.log",
  "agent_service_log": "logs/agent-service.log",
  "mcp_interactions_log": "logs/mcp-interactions.log"
}
```

---

## 📋 Correlation ID Tracking

Every request is assigned a unique correlation ID that flows through all services:

```
Frontend Request
  → API Gateway (generates correlation ID)
    → Backend Service (propagates correlation ID)
      → Agent Service (propagates correlation ID)
        → MCP Server (logged with correlation ID)
```

### How to Use Correlation IDs

1. **From Browser**: Check the `X-Correlation-ID` response header
2. **From Logs**: Each log entry includes the correlation ID
3. **From Code**: Access via `request.state.correlation_id`

---

## 🔧 Logging Configuration

### Enable Debug Level Logging

To see more detailed logs, set environment variable:
```bash
export LOG_LEVEL=DEBUG
```

### Change Log File Location

Modify in the service initialization:
```python
correlation_logger = CorrelationLogger(
    service_name="MY-SERVICE",
    log_file="custom/path/to/logs/my-service.log"
)
```

---

## 📊 Log Analysis Commands

### View Real-time Logs
```bash
# Watch centralized log
tail -f logs/centralized.log | jq .

# Watch MCP interactions (human-readable)
tail -f logs/mcp-interactions.log

# Watch agent service
tail -f logs/agent-service.log | jq .
```

### Search for Specific Events
```bash
# Find all LinkedIn auth requests
grep "getLinkedInAuthUrl" logs/mcp-interactions.log

# Find all errors
jq 'select(.level == "ERROR")' logs/centralized.log

# Find all requests for a specific user
jq 'select(.user_id == "user_12345")' logs/centralized.log

# Count requests by service
jq -r '.service' logs/centralized.log | sort | uniq -c
```

### Export Logs for Analysis
```bash
# Export all MCP interactions for last hour
grep "$(date -u -d '1 hour ago' '+%Y-%m-%d')" logs/mcp-interactions.log > mcp-last-hour.log

# Export errors as JSON
jq 'select(.level == "ERROR")' logs/centralized.log > errors.json
```

---

## ⚠️ Common Debugging Scenarios

### Scenario 1: "LinkedIn Connection Status Not Updating"

1. **Check Agent Service is receiving requests:**
   ```bash
   grep "LinkedIn auth request" logs/agent-service.log
   ```

2. **Verify MCP communication:**
   ```bash
   grep "getLinkedInAuthUrl" logs/mcp-interactions.log | tail -100
   ```

3. **Check response has authUrl:**
   Look for the response body in `logs/mcp-interactions.log` and verify it contains `authUrl` and `state`

4. **Verify state storage:**
   ```bash
   grep "OAuth state saved" logs/centralized.log
   ```

### Scenario 2: "MCP Server Connection Errors"

1. **Test connectivity:**
   ```
   curl http://localhost:8006/debug/connection-test
   ```

2. **Check MCP server logs:**
   ```bash
   docker logs mcp-linkedin-container
   # or check integration service logs
   tail -f logs/integration-service.log
   ```

3. **Verify environment variables:**
   ```bash
   grep "MCP_SERVER_URL" .env
   ```

---

## 🎓 Best Practices

1. **Always include correlation ID** when reporting issues
2. **Check `logs/mcp-interactions.log` first** for MCP-related issues
3. **Use debug endpoints** for real-time troubleshooting
4. **Monitor log file sizes** and implement rotation if needed
5. **Keep correlation IDs** in all service-to-service calls
6. **Review logs regularly** to identify patterns

---

## 📞 Support

If issues persist after checking logs:
1. Collect the correlation ID
2. Export relevant log sections
3. Include debug endpoint outputs
4. Document the exact steps to reproduce
