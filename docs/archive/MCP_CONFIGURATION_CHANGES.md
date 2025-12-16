# MCP Configuration Changes Summary

## Overview
This document summarizes the changes made to support flexible MCP (Model Context Protocol) server connectivity, allowing the application to connect to either a local Docker-based MCP server or a cloud-hosted MCP server.

**Date:** 2025-01-17  
**Change Type:** Configuration Enhancement

---

## What Changed

### 1. Environment Configuration (.env)

**New Variables Added:**
```bash
# MCP Host Type: 'local' | 'cloud' | 'custom'
MCP_HOST_TYPE=local

# Local MCP Server URL (for Docker Desktop)
MCP_LOCAL_URL=http://localhost:3001

# Cloud MCP Server URL (existing, now conditional)
MCP_SERVER_URL=http://3.141.18.225:3001
```

**Previous Behavior:**
- Always connected to cloud MCP at `http://3.141.18.225:3001`

**New Behavior:**
- Connects to local or cloud MCP based on `MCP_HOST_TYPE` setting
- Automatically detects and validates MCP connectivity at startup

---

### 2. Configuration Module (`services/agent-service/app/config.py`)

**Enhanced MCPServerConfig Class:**

```python
class MCPServerConfig:
    """MCP Server configuration with intelligent host resolution"""
    def __init__(self):
        # Determine which MCP host to use based on MCP_HOST_TYPE
        host_type = os.getenv("MCP_HOST_TYPE", "local").lower()
        
        if host_type == "local":
            self.base_url = os.getenv("MCP_LOCAL_URL", "http://localhost:3001")
            self.host_type = "local"
        elif host_type == "cloud":
            self.base_url = os.getenv("MCP_SERVER_URL", "http://3.141.18.225:3001")
            self.host_type = "cloud"
        else:  # custom
            self.base_url = os.getenv("MCP_SERVER_URL", "http://localhost:3001")
            self.host_type = "custom"
```

**Features:**
- Automatic URL resolution based on environment
- Startup logging showing active MCP configuration
- Support for custom MCP URLs

---

### 3. Startup Script (`start-backend.sh`)

**Added MCP Detection Logic:**

```bash
# MCP Server Detection and Configuration
echo "🔍 Detecting MCP Server Configuration..."

MCP_HOST_TYPE=${MCP_HOST_TYPE:-local}

if [ "$MCP_HOST_TYPE" = "local" ]; then
    # Check if local MCP Docker container is accessible
    # Prompt user if not reachable
elif [ "$MCP_HOST_TYPE" = "cloud" ]; then
    # Check if cloud MCP server is accessible
    # Warn if not reachable
fi
```

**Features:**
- Pre-flight MCP connectivity check
- Clear visual feedback (local 📍 vs cloud ☁️)
- Interactive prompt if local MCP is not running
- Continues with warning if cloud MCP unreachable

---

### 4. Verification Script (`scripts/verify-setup.sh`)

**Enhanced MCP Connectivity Check:**

```bash
# Load MCP configuration from .env
MCP_HOST_TYPE=${MCP_HOST_TYPE:-local}

if [ "$MCP_HOST_TYPE" = "local" ]; then
    MCP_TEST_URL=${MCP_LOCAL_URL:-http://localhost:3001}
    echo "   Testing LOCAL MCP: $MCP_TEST_URL"
elif [ "$MCP_HOST_TYPE" = "cloud" ]; then
    MCP_TEST_URL=${MCP_SERVER_URL:-http://3.141.18.225:3001}
    echo "   Testing CLOUD MCP: $MCP_TEST_URL"
fi
```

**Features:**
- Tests the correct MCP URL based on configuration
- Provides specific troubleshooting advice
- Shows Docker container hints for local mode

---

### 5. New Documentation

**Created: `docs/MCP_SETUP_GUIDE.md`**

Comprehensive guide covering:
- Configuration options (local, cloud, custom)
- Setup instructions for each mode
- Switching between environments
- Troubleshooting common issues
- Best practices for development vs production
- Monitoring and verification commands

**Updated: `README_QUICK_START.md`**
- Added MCP configuration reference
- Links to detailed MCP setup guide

---

## Usage Examples

### Example 1: Using Local Docker MCP

```bash
# 1. Start MCP Docker container
docker start mcpsocial

# 2. Set environment
echo "MCP_HOST_TYPE=local" >> .env

# 3. Start services
./start-backend.sh
```

**Expected Output:**
```
🔍 Detecting MCP Server Configuration...
📍 MCP Mode: LOCAL (Docker Desktop)
   URL: http://localhost:3001
   ✅ Local MCP server is running and accessible
```

---

### Example 2: Using Cloud MCP

```bash
# 1. Set environment
echo "MCP_HOST_TYPE=cloud" >> .env

# 2. Start services
./start-backend.sh
```

**Expected Output:**
```
🔍 Detecting MCP Server Configuration...
☁️  MCP Mode: CLOUD
   URL: http://3.141.18.225:3001
   ✅ Cloud MCP server is accessible
```

---

### Example 3: Switching from Cloud to Local

```bash
# 1. Stop current services
./stop-backend.sh

# 2. Start local MCP
docker start mcpsocial

# 3. Update .env
sed -i '' 's/MCP_HOST_TYPE=cloud/MCP_HOST_TYPE=local/' .env

# 4. Restart services
./start-backend.sh
```

---

## Benefits

### For Development
✅ **Full Local Testing** - Test without network dependency  
✅ **Faster Iteration** - No network latency  
✅ **Offline Work** - Develop without internet  
✅ **Easy Debugging** - Direct access to MCP container logs

### For Production
✅ **Centralized Management** - Single cloud MCP instance  
✅ **Team Collaboration** - Shared MCP resources  
✅ **Scalability** - Cloud infrastructure handles load  
✅ **Simplified Deployment** - No local dependencies

### For Both
✅ **Flexible Configuration** - Easy switching between modes  
✅ **Automatic Detection** - Scripts verify connectivity  
✅ **Clear Feedback** - Visual indicators of active mode  
✅ **Comprehensive Docs** - Troubleshooting guides included

---

## Testing Checklist

Before deploying these changes, verify:

- [ ] Local MCP connection works (`MCP_HOST_TYPE=local`)
- [ ] Cloud MCP connection works (`MCP_HOST_TYPE=cloud`)
- [ ] Custom MCP URL works (`MCP_HOST_TYPE=custom`)
- [ ] Startup script detects MCP correctly
- [ ] Verification script tests correct URL
- [ ] Error handling works when MCP unreachable
- [ ] Documentation is clear and accurate
- [ ] Environment variables are properly loaded
- [ ] Config logs show correct MCP type
- [ ] Services start successfully in both modes

---

## Migration Guide

### For Existing Deployments

**No Breaking Changes** - The default behavior maintains backward compatibility:
- If `MCP_HOST_TYPE` is not set, defaults to `local`
- Existing `MCP_SERVER_URL` continues to work
- No code changes required in services

**To Explicitly Use Cloud MCP:**
```bash
# Add to .env
MCP_HOST_TYPE=cloud
```

**To Switch to Local MCP:**
```bash
# 1. Add to .env
MCP_HOST_TYPE=local
MCP_LOCAL_URL=http://localhost:3001

# 2. Start local MCP container
docker start mcpsocial

# 3. Restart services
./stop-backend.sh && ./start-backend.sh
```

---

## Files Modified

1. `.env` - Added MCP configuration variables
2. `.env.example` - Updated template with new variables
3. `services/agent-service/app/config.py` - Enhanced MCPServerConfig class
4. `start-backend.sh` - Added MCP detection and validation
5. `scripts/verify-setup.sh` - Enhanced connectivity checks
6. `docs/MCP_SETUP_GUIDE.md` - New comprehensive guide (created)
7. `README_QUICK_START.md` - Updated with MCP configuration info
8. `docs/MCP_CONFIGURATION_CHANGES.md` - This summary document (created)

---

## Support

For questions or issues:
1. Review [MCP Setup Guide](./MCP_SETUP_GUIDE.md)
2. Check logs: `services/logs/agent-service.log`
3. Run verification: `./scripts/verify-setup.sh`
4. Check MCP container: `docker logs mcpsocial`

---

## Future Enhancements

Potential improvements for future iterations:
- [ ] Automatic MCP server discovery
- [ ] MCP health monitoring dashboard
- [ ] Automatic failover from local to cloud
- [ ] MCP connection pooling
- [ ] Performance metrics collection
- [ ] MCP version compatibility checking

---

**Change Log:**
- 2025-01-17: Initial implementation of flexible MCP configuration
