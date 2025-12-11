#!/bin/bash

# =============================================================================
# Setup Verification Script
# =============================================================================
# This script verifies that your system is properly configured

echo "🔍 Verifying System Setup..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

all_ok=true

# Check Python version
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Checking Python..."
if command -v python3 &> /dev/null; then
    python_version=$(python3 --version)
    echo -e "${GREEN}✅ $python_version${NC}"
else
    echo -e "${RED}❌ Python 3 not found${NC}"
    all_ok=false
fi

# Check Node.js version
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Checking Node.js..."
if command -v node &> /dev/null; then
    node_version=$(node --version)
    echo -e "${GREEN}✅ Node.js $node_version${NC}"
else
    echo -e "${RED}❌ Node.js not found${NC}"
    all_ok=false
fi

# Check npm
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Checking npm..."
if command -v npm &> /dev/null; then
    npm_version=$(npm --version)
    echo -e "${GREEN}✅ npm $npm_version${NC}"
else
    echo -e "${RED}❌ npm not found${NC}"
    all_ok=false
fi

# Check .env file exists
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Checking .env file..."
if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    
    # Check for required variables
    echo "   Checking required environment variables..."
    
    if grep -q "OPENAI_API_KEY=" .env && ! grep -q "OPENAI_API_KEY=$" .env; then
        echo -e "   ${GREEN}✅ OPENAI_API_KEY is set${NC}"
    else
        echo -e "   ${RED}❌ OPENAI_API_KEY is missing or empty${NC}"
        all_ok=false
    fi
    
    if grep -q "MCP_SERVER_URL=" .env; then
        mcp_url=$(grep "MCP_SERVER_URL=" .env | cut -d '=' -f2)
        echo -e "   ${GREEN}✅ MCP_SERVER_URL: $mcp_url${NC}"
    else
        echo -e "   ${RED}❌ MCP_SERVER_URL is missing${NC}"
        all_ok=false
    fi
    
    if grep -q "FIREBASE_PROJECT_ID=" .env; then
        echo -e "   ${GREEN}✅ FIREBASE_PROJECT_ID is set${NC}"
    else
        echo -e "   ${YELLOW}⚠️  FIREBASE_PROJECT_ID is missing${NC}"
    fi
    
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo "   Copy .env.example to .env and configure it"
    all_ok=false
fi

# Check if MCP server is reachable
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Checking MCP Server connectivity..."

# Load MCP configuration from .env
if [ -f .env ]; then
    export $(cat .env | grep -E "^MCP_HOST_TYPE=" | xargs)
    export $(cat .env | grep -E "^MCP_LOCAL_URL=" | xargs)
    export $(cat .env | grep -E "^MCP_SERVER_URL=" | xargs)
fi

MCP_HOST_TYPE=${MCP_HOST_TYPE:-local}

if [ "$MCP_HOST_TYPE" = "local" ]; then
    MCP_TEST_URL=${MCP_LOCAL_URL:-http://localhost:3001}
    echo "   Testing LOCAL MCP: $MCP_TEST_URL"
elif [ "$MCP_HOST_TYPE" = "cloud" ]; then
    MCP_TEST_URL=${MCP_SERVER_URL:-http://3.141.18.225:3001}
    echo "   Testing CLOUD MCP: $MCP_TEST_URL"
else
    MCP_TEST_URL=${MCP_SERVER_URL:-http://localhost:3001}
    echo "   Testing CUSTOM MCP: $MCP_TEST_URL"
fi

if command -v curl &> /dev/null; then
    if curl -s --connect-timeout 5 "$MCP_TEST_URL/health" > /dev/null 2>&1 || \
       curl -s --connect-timeout 5 "$MCP_TEST_URL/mcp/tools" > /dev/null 2>&1; then
        echo -e "   ${GREEN}✅ MCP Server is reachable${NC}"
    else
        echo -e "   ${YELLOW}⚠️  MCP Server not reachable${NC}"
        if [ "$MCP_HOST_TYPE" = "local" ]; then
            echo "   Make sure your local MCP Docker container is running:"
            echo "   → docker ps | grep mcp"
        else
            echo "   Check network connection and server status"
        fi
    fi
else
    echo -e "   ${YELLOW}⚠️  curl not available to test connectivity${NC}"
fi

# Check if frontend dependencies are installed
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Checking Frontend dependencies..."
if [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend dependencies not installed${NC}"
    echo "   Run: cd frontend && npm install"
fi

# Check if backend virtual environments exist
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. Checking Backend virtual environments..."
venv_count=0
for service in services/*/; do
    if [ -d "${service}venv" ]; then
        ((venv_count++))
    fi
done

if [ $venv_count -gt 0 ]; then
    echo -e "${GREEN}✅ Found $venv_count service virtual environments${NC}"
else
    echo -e "${YELLOW}⚠️  No virtual environments found${NC}"
    echo "   They will be created when you run ./start-backend.sh"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$all_ok" = true ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    echo ""
    echo "You're ready to start the application:"
    echo "  1. Run: ./start-backend.sh"
    echo "  2. In another terminal: cd frontend && npm start"
    echo "  3. Open: http://localhost:3000"
else
    echo -e "${RED}❌ Some issues need to be fixed${NC}"
    echo ""
    echo "Please fix the issues above before starting."
    echo "See START_HERE.md for detailed instructions."
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
