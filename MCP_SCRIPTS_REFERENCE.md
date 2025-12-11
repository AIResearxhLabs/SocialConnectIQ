# MCP Scripts Quick Reference

## Overview

This project includes dedicated scripts for managing backend services with different MCP (Model Context Protocol) configurations.

## Available Scripts

### 🐳 Local MCP (Docker Desktop)

**Start Services:**
```bash
./start-backend-local.sh
```

**Stop Services:**
```bash
./stop-backend-local.sh
```

**What it does:**
- Automatically configures MCP to use `http://localhost:3001`
- Checks if local Docker MCP container is running
- Starts all backend services with local MCP configuration
- No changes to `.env` file

---

### ☁️ Cloud MCP (AWS/GCP)

**Start Services:**
```bash
./start-backend-cloud.sh
```

**Stop Services:**
```bash
./stop-backend-cloud.sh
```

**What it does:**
- Automatically configures MCP to use `http://3.141.18.225:3001`
- Checks if cloud MCP server is accessible
- Starts all backend services with cloud MCP configuration
- No changes to `.env` file

---

### 🔧 Generic Scripts (Uses .env Configuration)

**Start Services:**
```bash
./start-backend.sh
```

**Stop Services:**
```bash
./stop-backend.sh
```

**What it does:**
- Reads `MCP_HOST_TYPE` from `.env` file
- Dynamically configures MCP based on `.env` settings
- Supports `local`, `cloud`, or `custom` modes

---

## Quick Start Examples

### Development Workflow (Local MCP)

```bash
# 1. Start your local MCP Docker container
docker start mcpsocial

# 2. Start backend services
./start-backend-local.sh

# 3. Work on your changes...

# 4. Stop services when done
./stop-backend-local.sh
```

### Testing with Cloud MCP

```bash
# 1. Start backend with cloud MCP
./start-backend-cloud.sh

# 2. Test your integration...

# 3. Stop services
./stop-backend-cloud.sh
```

### Switching Between Modes

```bash
# From local to cloud
./stop-backend-local.sh
./start-backend-cloud.sh

# From cloud to local
./stop-backend-cloud.sh
./start-backend-local.sh
```

---

## Script Comparison

| Feature | `start-backend-local.sh` | `start-backend-cloud.sh` | `start-backend.sh` |
|---------|-------------------------|-------------------------|-------------------|
| **MCP Configuration** | Always local | Always cloud | From `.env` |
| **Modifies .env** | ❌ No | ❌ No | ❌ No |
| **MCP Check** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Use Case** | Development | Production/Testing | Flexible |

---

## Environment Variables

These scripts set environment variables at runtime, **without modifying your `.env` file**:

### Local Script Sets:
```bash
export MCP_HOST_TYPE=local
export MCP_LOCAL_URL=http://localhost:3001
export MCP_SERVER_URL=http://localhost:3001
```

### Cloud Script Sets:
```bash
export MCP_HOST_TYPE=cloud
export MCP_SERVER_URL=http://3.141.18.225:3001
export MCP_LOCAL_URL=http://3.141.18.225:3001
```

---

## Verification

### Check What's Running

```bash
# View all running services
./scripts/check-services.sh

# Check which MCP mode is active
grep MCP_HOST_TYPE .env

# Test MCP connectivity
curl http://localhost:3001/mcp/tools      # Local
curl http://3.141.18.225:3001/mcp/tools  # Cloud
```

### View Logs

```bash
# All logs
ls -la services/logs/

# Agent service (handles MCP)
tail -f services/logs/agent-service.log

# Filter for MCP messages
tail -f services/logs/agent-service.log | grep MCP
```

---

## Troubleshooting

### Local MCP Not Found

```bash
# Check if container exists
docker ps -a | grep mcp

# Start it if stopped
docker start mcpsocial

# Check container logs
docker logs mcpsocial

# Verify port mapping
docker port mcpsocial
```

### Cloud MCP Not Reachable

```bash
# Test connectivity
ping 3.141.18.225

# Test MCP endpoint
curl -v http://3.141.18.225:3001/health

# Check with longer timeout
curl --connect-timeout 10 http://3.141.18.225:3001/mcp/tools
```

### Services Won't Start

```bash
# Check if ports are in use
lsof -i :8006  # Agent service
lsof -i :8000  # API Gateway

# Kill processes if needed
kill -9 <PID>

# Try starting again
./start-backend-local.sh  # or cloud
```

---

## Best Practices

### ✅ DO:
- Use `start-backend-local.sh` for daily development
- Use `start-backend-cloud.sh` for production testing
- Keep your local MCP container running during dev work
- Check logs if something goes wrong

### ❌ DON'T:
- Modify `.env` file during testing (use dedicated scripts instead)
- Run multiple scripts simultaneously
- Forget to stop services before switching modes

---

## File Permissions

All scripts should be executable. If not, run:

```bash
chmod +x start-backend-local.sh stop-backend-local.sh
chmod +x start-backend-cloud.sh stop-backend-cloud.sh
chmod +x start-backend.sh stop-backend.sh
```

---

## For More Information

- **Detailed Setup Guide:** [docs/MCP_SETUP_GUIDE.md](docs/MCP_SETUP_GUIDE.md)
- **Configuration Changes:** [docs/MCP_CONFIGURATION_CHANGES.md](docs/MCP_CONFIGURATION_CHANGES.md)
- **Quick Start:** [README_QUICK_START.md](README_QUICK_START.md)

---

**Last Updated:** 2025-01-17
