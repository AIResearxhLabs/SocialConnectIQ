# 🔍 Centralized Logging with Correlation IDs - Complete Guide

## Overview

This application implements **distributed tracing** using correlation IDs (similar to Apache's logging system). Every user action generates a unique correlation ID that flows through all microservices, allowing you to trace the entire request lifecycle in a single centralized log file.

---

## 🎯 Key Benefits

1. **Single Log File**: All services log to `logs/centralized.log`
2. **Correlation ID Tracking**: Each request has a unique ID that persists across all services
3. **Easy Debugging**: Filter by correlation ID to see the complete request flow
4. **Service Identification**: Each log entry shows which service generated it
5. **User Tracking**: User ID is logged with each entry
6. **Structured JSON**: Logs are in JSON format for easy parsing and analysis

---

## 🆔 How Correlation IDs Work

### Flow Diagram

```
User Action (Frontend)
    ↓
Generate Correlation ID: "1731857234567-abc123xyz"
    ↓
    Display in Console: "🆔 Correlation ID: 1731857234567-abc123xyz"
    ↓
Send to API Gateway (via X-Correlation-ID header)
    ↓
API Gateway logs with correlation ID
    ↓
Forward to Integration Service (with same correlation ID)
    ↓
Integration Service logs with same correlation ID
    ↓
All logs searchable by: "1731857234567-abc123xyz"
```

### Example Log Sequence

When a user clicks "Connect LinkedIn", here's what gets logged:

```
Frontend Console:
🆔 [FRONTEND] Correlation ID: 1731857234567-abc123xyz
💡 [FRONTEND] Use this ID to trace this request across all services

Centralized Log (logs/centralized.log):
{"timestamp":"2025-11-17T13:25:35Z","level":"INFO","service":"API-GATEWAY","correlation_id":"1731857234567-abc123xyz","user_id":"user-123","message":"🔵 REQUEST START: POST /api/integrations/linkedin/auth"}
{"timestamp":"2025-11-17T13:25:35Z","level":"INFO","service":"API-GATEWAY","correlation_id":"1731857234567-abc123xyz","user_id":"user-123","message":"Forwarding request to Integration Service"}
{"timestamp":"2025-11-17T13:25:35Z","level":"INFO","service":"INTEGRATION-SERVICE","correlation_id":"1731857234567-abc123xyz","user_id":"user-123","message":"🔵 REQUEST START: POST /api/integrations/linkedin/auth"}
{"timestamp":"2025-11-17T13:25:35Z","level":"SUCCESS","service":"INTEGRATION-SERVICE","correlation_id":"1731857234567-abc123xyz","user_id":"user-123","message":"Generated LinkedIn OAuth URL"}
{"timestamp":"2025-11-17T13:25:35Z","level":"SUCCESS","service":"INTEGRATION-SERVICE","correlation_id":"1731857234567-abc123xyz","user_id":"user-123","message":"🏁 REQUEST END: /api/integrations/linkedin/auth - Status: 200"}
{"timestamp":"2025-11-17T13:25:35Z","level":"SUCCESS","service":"API-GATEWAY","correlation_id":"1731857234567-abc123xyz","user_id":"user-123","message":"🏁 REQUEST END: /api/integrations/linkedin/auth - Status: 200"}
```

---

## 📋 Log Entry Structure

Each log entry is a JSON object with the following fields:

| Field | Description | Example |
|-------|-------------|---------|
| `timestamp` | ISO 8601 UTC timestamp | `"2025-11-17T13:25:35Z"` |
| `level` | Log level | `"INFO"`, `"SUCCESS"`, `"WARNING"`, `"ERROR"` |
| `service` | Service name | `"API-GATEWAY"`, `"INTEGRATION-SERVICE"` |
| `correlation_id` | Unique request ID | `"1731857234567-abc123xyz"` |
| `user_id` | User identifier | `"user-123"` or `"N/A"` |
| `message` | Log message | `"Generated LinkedIn OAuth URL"` |
| `data` | Additional context (optional) | `{"status_code": 200}` |

---

## 🔎 Filtering and Searching Logs

### Method 1: Using grep (Quick Filter)

```bash
# Filter by correlation ID
grep "1731857234567-abc123xyz" logs/centralized.log

# Filter by service
grep "API-GATEWAY" logs/centralized.log

# Filter by user
grep "user-123" logs/centralized.log

# Filter by error level
grep "ERROR" logs/centralized.log

# Combine filters (correlation ID + service)
grep "1731857234567-abc123xyz" logs/centralized.log | grep "INTEGRATION-SERVICE"
```

### Method 2: Using Python Script (Pretty Print)

Save this as `scripts/view-logs.py`:

```python
#!/usr/bin/env python3
import json
import sys
from datetime import datetime

def print_log_entry(entry):
    """Pretty print a log entry"""
    timestamp = entry.get('timestamp', '')
    level = entry.get('level', '')
    service = entry.get('service', '')
    corr_id = entry.get('correlation_id', '')[:12]  # First 12 chars
    user_id = entry.get('user_id', '')[:8]  # First 8 chars
    message = entry.get('message', '')
    
    # Color codes
    colors = {
        'INFO': '\033[94m',      # Blue
        'SUCCESS': '\033[92m',   # Green
        'WARNING': '\033[93m',   # Yellow
        'ERROR': '\033[91m',     # Red
        'RESET': '\033[0m'
    }
    
    color = colors.get(level, colors['RESET'])
    
    print(f"{color}[{timestamp}] [{level:7}] [{service:20}] [{corr_id}...] [{user_id}...] {message}{colors['RESET']}")
    
    if 'data' in entry:
        print(f"  Data: {entry['data']}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python view-logs.py <log_file> [correlation_id]")
        print("Example: python view-logs.py logs/centralized.log")
        print("Example: python view-logs.py logs/centralized.log 1731857234567-abc123xyz")
        sys.exit(1)
    
    log_file = sys.argv[1]
    filter_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    try:
        with open(log_file, 'r') as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    
                    # Filter by correlation ID if provided
                    if filter_id and filter_id not in entry.get('correlation_id', ''):
                        continue
                    
                    print_log_entry(entry)
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        print(f"Error: Log file '{log_file}' not found")
        sys.exit(1)

if __name__ == '__main__':
    main()
```

Make it executable:
```bash
chmod +x scripts/view-logs.py
```

Usage:
```bash
# View all logs (pretty printed)
python scripts/view-logs.py logs/centralized.log

# View logs for specific correlation ID
python scripts/view-logs.py logs/centralized.log 1731857234567-abc123xyz
```

### Method 3: Using jq (Advanced JSON Queries)

```bash
# Pretty print all logs
cat logs/centralized.log | jq '.'

# Filter by correlation ID
cat logs/centralized.log | jq 'select(.correlation_id == "1731857234567-abc123xyz")'

# Get all errors
cat logs/centralized.log | jq 'select(.level == "ERROR")'

# Get timeline for a specific user
cat logs/centralized.log | jq 'select(.user_id == "user-123") | .timestamp + " " + .service + ": " + .message'

# Count requests per service
cat logs/centralized.log | jq -s 'group_by(.service) | map({service: .[0].service, count: length})'
```

---

## 🚀 Using the System

### Step 1: User Clicks "Connect LinkedIn"

Frontend console will show:
```
================================================================================
🔵 [FRONTEND] Starting LinkedIn Authentication
🆔 [FRONTEND] Correlation ID: 1731857234567-abc123xyz
💡 [FRONTEND] Use this ID to trace this request across all services
================================================================================
```

### Step 2: Copy the Correlation ID

From the console, copy the correlation ID: `1731857234567-abc123xyz`

### Step 3: Filter the Centralized Log

```bash
# View all logs for this request
grep "1731857234567-abc123xyz" logs/centralized.log

# Or use the Python script for prettier output
python scripts/view-logs.py logs/centralized.log 1731857234567-abc123xyz
```

### Step 4: Analyze the Flow

You'll see the complete request flow:
1. Frontend sends request
2. API Gateway receives and forwards
3. Integration Service processes
4. Response flows back

All with the same correlation ID!

---

## 🎨 Console Output

Each service also prints human-readable logs to the console:

```
2025-11-17 13:25:35 - ℹ️ [API-GATEWAY] [17318572...] [user-123...] 🔵 REQUEST START: POST /api/integrations/linkedin/auth
2025-11-17 13:25:35 - ℹ️ [API-GATEWAY] [17318572...] [user-123...] Forwarding request to Integration Service
2025-11-17 13:25:35 - ✅ [API-GATEWAY] [17318572...] [user-123...] Received response from Integration Service
2025-11-17 13:25:35 - ✅ [API-GATEWAY] [17318572...] [user-123...] 🏁 REQUEST END: /api/integrations/linkedin/auth - Status: 200
```

---

## 🛠️ Implementation Details

### Frontend (TypeScript)

```typescript
// Generate correlation ID
const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// Add to headers
const headers = {
  'X-Correlation-ID': correlationId,
  // ... other headers
};
```

### Backend (Python)

```python
from shared.logging_utils import CorrelationLogger, get_correlation_id_from_headers

# Initialize logger
logger = CorrelationLogger(
    service_name="MY-SERVICE",
    log_file="logs/centralized.log"
)

# In endpoint
correlation_id = get_correlation_id_from_headers(dict(request.headers))
logger.info("Processing request", correlation_id=correlation_id, user_id=user_id)
```

---

## 📊 Log Levels

| Level | Emoji | Use Case | Example |
|-------|-------|----------|---------|
| **INFO** | ℹ️ | General information | Request received, forwarding to service |
| **SUCCESS** | ✅ | Successful operations | Request completed, token generated |
| **WARNING** | ⚠️ | Non-critical issues | Firestore not initialized, using fallback |
| **ERROR** | ❌ | Errors and failures | Connection failed, invalid credentials |
| **DEBUG** | 🔍 | Development debugging | Variable values, detailed state |

---

## 🔧 Troubleshooting

### Issue: No logs appearing in centralized.log

**Check:**
1. Verify log file exists: `ls -la logs/centralized.log`
2. Check file permissions: `chmod 666 logs/centralized.log`
3. Verify services are running with updated code
4. Check service logs for errors

### Issue: Correlation ID not propagating

**Check:**
1. Frontend is generating and sending `X-Correlation-ID` header
2. API Gateway is forwarding the header
3. Integration Service is extracting the header

**Debug:**
```bash
# Check if header is being sent (frontend console)
console.log('Headers:', headers);

# Check if header is received (backend logs)
grep "correlation_id" logs/centralized.log
```

### Issue: Cannot find specific request

**Solution:**
1. Copy correlation ID from frontend console
2. Search in centralized log:
   ```bash
   grep "<correlation-id>" logs/centralized.log
   ```
3. If not found, check if services are logging to correct file

---

## 📈 Best Practices

1. **Always Log Request Start and End**: Use `logger.request_start()` and `logger.request_end()`
2. **Include Context Data**: Use `additional_data` parameter for relevant information
3. **Use Appropriate Log Levels**: Don't overuse ERROR, use WARNING for non-critical issues
4. **Keep Messages Clear**: Write descriptive, actionable log messages
5. **Rotate Logs**: Implement log rotation for production (e.g., daily rotation, keep last 30 days)

---

## 🔄 Log Rotation (Production)

For production, implement log rotation:

```bash
# Install logrotate configuration
sudo tee /etc/logrotate.d/app-logs << EOF
/path/to/logs/centralized.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 user group
    postrotate
        # Signal services to reopen log file
        pkill -HUP -f "uvicorn"
    endscript
}
EOF
```

---

## 📚 Additional Resources

- [Python logging documentation](https://docs.python.org/3/library/logging.html)
- [Distributed Tracing concepts](https://opentelemetry.io/docs/concepts/observability-primer/#distributed-tracing)
- [JSON logging best practices](https://www.loggly.com/ultimate-guide/python-logging-basics/)

---

## 🎯 Quick Reference

### Get Correlation ID from Frontend
```javascript
// Look in browser console for:
🆔 [FRONTEND] Correlation ID: 1731857234567-abc123xyz
```

### Filter Centralized Log
```bash
grep "1731857234567-abc123xyz" logs/centralized.log
```

### View in Real-Time
```bash
tail -f logs/centralized.log | grep "1731857234567-abc123xyz"
```

### Count Errors
```bash
grep "ERROR" logs/centralized.log | wc -l
```

### Latest 50 Entries
```bash
tail -50 logs/centralized.log | jq '.'
```

---

**Remember:** The correlation ID is your friend! Copy it from the frontend console and use it to trace the entire request flow across all services.
