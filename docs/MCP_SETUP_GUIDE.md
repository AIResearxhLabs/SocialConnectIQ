# MCP Server Setup Guide

This guide explains how to configure and use the MCP (Model Context Protocol) server in both local and cloud environments.

## Overview

The application supports three MCP server deployment modes:

1. **Local** - MCP server running in Docker Desktop (recommended for development)
2. **Cloud** - MCP server hosted on AWS/GCP (for production)
3. **Custom** - Custom MCP server URL

## Configuration

### Environment Variables

The MCP server configuration is controlled by environment variables in your `.env` file:

```bash
# MCP Host Type: 'local' | 'cloud' | 'custom'
MCP_HOST_TYPE=local

# Cloud MCP Server URL (used when MCP_HOST_TYPE=cloud or custom)
MCP_SERVER_URL=http://3.141.18.225:3001

# Local MCP Server URL (used when MCP_HOST_TYPE=local)
MCP_LOCAL_URL=http://localhost:3001

# MCP Connection Settings
MCP_SERVER_TIMEOUT=30
MCP_SERVER_RETRY_ATTEMPTS=3
MCP_SERVER_RETRY_DELAY=2
```

## Setup Options

### Option 1: Local Docker Setup (Recommended for Development)

**Advantages:**
- Full control over MCP server
- No network latency
- Can test offline
- Easy debugging

**Setup Steps:**

1. **Start MCP Docker Container:**
   ```bash
   # If you have a docker-compose for MCP
   cd /path/to/mcp-server
   docker-compose up -d
   
   # Or if using docker run
   docker run -d -p 3001:3001 --name mcpsocial your-mcp-image:latest
   ```

2. **Verify MCP is Running:**
   ```bash
   docker ps | grep mcp
   curl http://localhost:3001/health
   curl http://localhost:3001/mcp/tools
   ```

3. **Start Backend Services (Local Mode):**
   ```bash
   ./start-backend-local.sh
   ```
   
   The script will automatically:
   - Configure MCP for local Docker mode
   - Check MCP connectivity
   - Start all backend services
   
4. **Stop Services:**
   ```bash
   ./stop-backend-local.sh
   ```

### Option 2: Cloud MCP Setup (Production)

**Advantages:**
- No local resources needed
- Centralized management
- Scales better for team use

**Setup Steps:**

1. **Ensure Cloud MCP is Running:**
   ```bash
   curl http://3.141.18.225:3001/health
   ```

2. **Start Backend Services (Cloud Mode):**
   ```bash
   ./start-backend-cloud.sh
   ```
   
   The script will automatically:
   - Configure MCP for cloud mode
   - Check cloud MCP connectivity
   - Start all backend services
   
3. **Stop Services:**
   ```bash
   ./stop-backend-cloud.sh
   ```

### Option 3: Custom MCP URL

**Use Case:** For custom deployments or alternative MCP servers

**Setup Steps:**

1. **Configure .env:**
   ```bash
   MCP_HOST_TYPE=custom
   MCP_SERVER_URL=http://your-custom-mcp-server:port
   ```

2. **Start Backend Services:**
   ```bash
   ./start-backend.sh
   ```

## Switching Between Environments

### Switch from Local to Cloud

**Simple Method (Using Dedicated Scripts):**

```bash
# Stop local services
./stop-backend-local.sh

# Start cloud services
./start-backend-cloud.sh
```

**Alternative Method (Using .env):**

1. Edit `.env` file:
   ```bash
   # Change: MCP_HOST_TYPE=local
   # To:     MCP_HOST_TYPE=cloud
   ```

2. Restart backend services:
   ```bash
   ./stop-backend.sh
   ./start-backend.sh
   ```

### Switch from Cloud to Local

**Simple Method (Using Dedicated Scripts):**

```bash
# Make sure local MCP is running
docker start mcpsocial

# Stop cloud services
./stop-backend-cloud.sh

# Start local services
./start-backend-local.sh
```

**Alternative Method (Using .env):**

1. **Start Local MCP Container:**
   ```bash
   docker start mcpsocial
   ```

2. Edit `.env` file:
   ```bash
   # Change: MCP_HOST_TYPE=cloud
   # To:     MCP_HOST_TYPE=local
   ```

3. Restart backend services:
   ```bash
   ./stop-backend.sh
   ./start-backend.sh
   ```

## Verification

### Verify MCP Configuration

Run the verification script:
```bash
./scripts/verify-setup.sh
```

This will check:
- Which MCP mode is configured
- If the configured MCP server is reachable
- All environment variables are set correctly

### Manual Testing

Test MCP connectivity directly:

```bash
# For local MCP
curl http://localhost:3001/mcp/tools

# For cloud MCP
curl http://3.141.18.225:3001/mcp/tools
```

Expected response: JSON array of available tools

## Troubleshooting

### Local MCP Not Reachable

**Problem:** Cannot connect to `http://localhost:3001`

**Solutions:**

1. Check if Docker container is running:
   ```bash
   docker ps | grep mcp
   ```

2. Start the container if stopped:
   ```bash
   docker start mcpsocial
   ```

3. Check container logs:
   ```bash
   docker logs mcpsocial
   ```

4. Verify port mapping:
   ```bash
   docker port mcpsocial
   ```

5. Test connectivity:
   ```bash
   curl -v http://localhost:3001/health
   ```

### Cloud MCP Not Reachable

**Problem:** Cannot connect to cloud MCP server

**Solutions:**

1. Check network connectivity:
   ```bash
   ping 3.141.18.225
   ```

2. Test MCP endpoint:
   ```bash
   curl -v http://3.141.18.225:3001/health
   ```

3. Check firewall/security group settings

4. Verify cloud server status with infrastructure team

### Wrong MCP Mode Active

**Problem:** Services connecting to wrong MCP server

**Solution:**

1. Check current configuration:
   ```bash
   grep MCP_HOST_TYPE .env
   ```

2. Verify the value matches your intention

3. Restart services after changing:
   ```bash
   ./stop-backend.sh
   ./start-backend.sh
   ```

### MCP Connection Timeouts

**Problem:** MCP requests timing out

**Solutions:**

1. Increase timeout in `.env`:
   ```bash
   MCP_SERVER_TIMEOUT=60
   ```

2. Check network latency:
   ```bash
   ping -c 5 3.141.18.225  # for cloud
   ```

3. Review MCP server logs for performance issues

## Best Practices

### Development Workflow

1. **Use Local MCP** for development and testing
2. **Test locally first** before deploying
3. **Keep MCP container running** during development session
4. **Use cloud MCP** only for integration testing

### Production Workflow

1. **Use Cloud MCP** for production deployments
2. **Monitor MCP health** continuously
3. **Have fallback strategy** if cloud MCP is down
4. **Log all MCP interactions** for debugging

### Team Collaboration

1. **Document custom MCP URLs** in team wiki
2. **Share MCP container setup** via docker-compose
3. **Use environment-specific .env files** (.env.local, .env.prod)
4. **Don't commit MCP URLs** with credentials to git

## Monitoring

### Check MCP Status

```bash
# Health check
curl http://localhost:3001/health

# List available tools
curl http://localhost:3001/mcp/tools

# Check specific tool
curl http://localhost:3001/mcp/tools/{tool-name}
```

### View Backend MCP Logs

```bash
# Agent service logs (handles MCP communication)
tail -f services/logs/agent-service.log | grep MCP
```

### Check Startup Messages

When starting services, look for:
```
🔍 Detecting MCP Server Configuration...
📍 MCP Mode: LOCAL (Docker Desktop)
   URL: http://localhost:3001
   ✅ Local MCP server is running and accessible
```

## Additional Resources

- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [Docker Desktop Documentation](https://docs.docker.com/desktop/)
- [Project README](../README.md)
- [Startup Instructions](../STARTUP_INSTRUCTIONS.md)

## Support

If you encounter issues not covered in this guide:

1. Check the logs: `services/logs/agent-service.log`
2. Run verification: `./scripts/verify-setup.sh`
3. Check MCP container: `docker logs mcpsocial`
4. Review this guide's troubleshooting section
5. Contact the development team
