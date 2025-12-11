# Social Media Management Dashboard with AI Agent

This repository contains the full-stack code for an **AI-powered Social Media Management application**, featuring a React frontend, Python/FastAPI microservices backend, and an intelligent AI agent powered by OpenAI GPT-4o.

## 1. Project Vision

This application empowers users to streamline their social media strategy through **AI-driven automation** and a unified dashboard to manage **LinkedIn, Facebook, Twitter, Instagram, and WhatsApp**. The platform features:

- **AI Social Media Agent**: Natural language interface for managing posts, scheduling, and analytics
- **Intelligent Content Generation**: AI-powered caption writing with brand voice consistency
- **Smart Scheduling**: ML-based optimal posting time predictions
- **Multi-Platform Support**: Seamless integration with major social media platforms via MCP server
- **Configurable Architecture**: Easy-to-update MCP server URL and API configurations
- **Enterprise-Ready**: Cost tracking, audit logging, and security features

---

## 2. System Architecture

The application follows a **microservices architecture** with AI agent capabilities:

### Core Components:
*   **Frontend:** React (TypeScript) SPA with Material-UI, featuring AI chat interface
*   **API Gateway:** Central entry point with rate limiting, authentication, and routing
*   **AI Agent Service:** LangChain + OpenAI GPT-4o for intelligent task automation
*   **Integration Service:** OAuth flows and MCP server communication
*   **MCP Server:** External service (AWS-hosted) providing social media platform APIs
*   **Configuration System:** Multi-layer configuration (env variables, YAML, database)

### Microservices:
| Service | Port | Technology | Purpose |
|---------|------|-----------|---------|
| **API Gateway** | 8000 | FastAPI | Request routing, rate limiting, auth validation |
| **Auth Service** | 8001 | FastAPI | User authentication, JWT token management |
| **Integration Service** | 8002 | FastAPI | OAuth flows, MCP server proxy |
| **Scheduling Service** | 8003 | FastAPI | Post scheduling, cron jobs |
| **Agent Service** | 8004 | FastAPI + LangChain | AI agent with GPT-4o |
| **Analytics Service** | 8005 | FastAPI | Metrics aggregation, insights |
| **Posting Service** | 8006 | FastAPI | Execute social media API calls |

### External Dependencies:
- **MCP Server**: `http://3.135.209.100:3001` (configurable)
- **OpenAI API**: GPT-4o for AI agent reasoning
- **Firebase**: Authentication service
- **PostgreSQL**: Structured data storage
- **Redis**: Caching and agent conversation memory

---

## 3. Repository Structure

```
/
|-- api-gateway/              # Central API Gateway (FastAPI)
|-- config/                   # Configuration files
|   |-- config.yaml           # Application configuration
|-- docs/                     # Documentation
|   |-- product-requirements.md
|   |-- functional-specification.md
|-- frontend/                 # React frontend application
|   |-- src/
|       |-- components/       # React components
|       |-- pages/            # Page components
|       |-- api/              # API client functions
|       |-- context/          # React context providers
|-- services/                 # Backend microservices
|   |-- auth-service/         # Authentication service
|   |-- integration-service/  # Social media OAuth & MCP proxy
|   |-- agent-service/        # AI agent with LangChain (NEW)
|   |-- scheduling-service/   # Post scheduling
|   |-- analytics-service/    # Metrics and insights
|   |-- posting-service/      # Social media posting
|-- .env.example              # Environment variables template
|-- README.md                 # This file
```

---

## 4. Environment Configuration

### 4.1. Configuration Setup

**Development Environment:**

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your credentials:
   ```bash
   # MCP Server Configuration
   MCP_SERVER_URL=http://3.135.209.100:3001
   MCP_SERVER_TIMEOUT=30

   # OpenAI Configuration (Your GPT-4o License)
   OPENAI_API_KEY=sk-proj-your-key-here
   OPENAI_MODEL=gpt-4o
   OPENAI_ORG_ID=org-your-org-id

   # Application Settings
   ENVIRONMENT=development
   LOG_LEVEL=INFO

   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/socialdb
   REDIS_URL=redis://localhost:6379

   # Firebase Authentication
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY=your-private-key
   FIREBASE_CLIENT_EMAIL=your-client-email

   # Security
   JWT_SECRET=your-secret-key-here
   CORS_ORIGINS=http://localhost:3000,http://localhost:8000
   ```

### 4.2. Updating MCP Server URL

The MCP server URL is **configurable at runtime** without code changes:

**Method 1: Environment Variable (Requires Restart)**
```bash
export MCP_SERVER_URL=http://new-ip:new-port
docker-compose restart
```

**Method 2: Configuration API (No Restart Required)**
```bash
curl -X PUT http://localhost:8000/api/v1/config/mcp-server \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://new-ip:3001", "validate": true}'
```

**Method 3: Configuration File**
Edit `config/config.yaml`:
```yaml
mcp_server:
  base_url: http://new-ip:3001
  timeout: 30
```

---

## 5. Getting Started

### 5.1. Prerequisites

- **Node.js** (v16+)
- **Python** (v3.9+)
- **PostgreSQL** (v13+)
- **Redis** (v6+)
- **OpenAI API Key** (GPT-4o access)
- **Docker** (optional, for containerized deployment)

### 5.2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm start
   ```
   
   The application will be available at `http://localhost:3000`

### 5.3. Backend Services Setup

#### Option A: Run All Services with Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

#### Option B: Run Individual Services

**1. Auth Service (Port 8001):**
```bash
cd services/auth-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

**2. Integration Service (Port 8002):**
```bash
cd services/integration-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```

**3. Agent Service (Port 8004) - NEW:**
```bash
cd services/agent-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Ensure OPENAI_API_KEY is set in .env
uvicorn app.main:app --reload --port 8004
```

**4. API Gateway (Port 8000):**
```bash
cd api-gateway
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 5.4. Database Setup

```bash
# Create PostgreSQL database
createdb socialdb

# Run migrations (if available)
python services/auth-service/migrations/migrate.py

# Start Redis
redis-server
```

---

## 6. Using the AI Agent

### 6.1. Natural Language Commands

The AI agent understands conversational requests:

**Examples:**
```
"Connect my LinkedIn account"
"Post to LinkedIn about AI trends in 2025"
"Schedule a tweet for tomorrow morning about our new product"
"Generate a professional caption for my Facebook post"
"What's the best time to post on Instagram?"
"Show me my LinkedIn engagement metrics"
```

### 6.2. Agent API Usage

**Chat with the Agent:**
```bash
curl -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "message": "Post to LinkedIn about AI",
    "user_id": "user123",
    "stream": false
  }'
```

**Execute Direct Task:**
```bash
curl -X POST http://localhost:8000/api/v1/agent/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "task": "post_to_linkedin",
    "parameters": {
      "content": "Exciting AI developments!",
      "schedule_time": "2025-11-18T09:00:00Z"
    },
    "user_id": "user123"
  }'
```

---

## 7. Configuration Management

### 7.1. Configuration Priority

The system uses a multi-layer configuration approach (highest to lowest priority):

1. **Environment Variables** (`.env` file)
2. **Configuration File** (`config/config.yaml`)
3. **Database Settings** (runtime updates via Admin API)
4. **Default Values** (hardcoded fallbacks)

### 7.2. Configuration Health Check

```bash
# Check MCP server connectivity
curl http://localhost:8000/api/v1/config/mcp-server

# Response:
{
  "url": "http://3.135.209.100:3001",
  "status": "connected",
  "last_health_check": "2025-11-17T12:00:00Z",
  "response_time_ms": 120
}
```

### 7.3. Monitoring API Costs

```bash
# View OpenAI API usage
curl http://localhost:8000/api/v1/admin/costs \
  -H "Authorization: Bearer <admin-token>"

# Set cost alerts
curl -X POST http://localhost:8000/api/v1/admin/alerts \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"threshold": 100, "email": "admin@example.com"}'
```

---

## 8. Development Workflow

### 8.1. Adding New Social Platform Integration

1. Add MCP server endpoints to Integration Service
2. Create OAuth flow handlers
3. Add tool definitions to Agent Service
4. Update frontend Integration page
5. Test OAuth flow and posting

### 8.2. Testing

```bash
# Run unit tests
pytest services/agent-service/tests/

# Run integration tests
pytest services/integration-service/tests/ --integration

# Test AI agent locally
python services/agent-service/tests/test_agent.py
```

### 8.3. Deployment

```bash
# Build Docker images
docker-compose build

# Deploy to staging
./deploy.sh staging

# Deploy to production
./deploy.sh production
```

---

## 9. Troubleshooting

### Common Issues

**1. MCP Server Connection Failed:**
```bash
# Check MCP server health
curl http://3.135.209.100:3001/api/capabilities

# Update MCP server URL if changed
export MCP_SERVER_URL=http://new-ip:3001
```

**2. OpenAI API Rate Limit:**
```bash
# Check current usage
curl https://api.openai.com/v1/usage

# Reduce agent max_tokens in config/config.yaml
```

**3. Redis Connection Issues:**
```bash
# Verify Redis is running
redis-cli ping

# Should return: PONG
```

---

## 10. Documentation

- **Product Requirements:** See `docs/product-requirements.md`
- **Functional Specification:** See `docs/functional-specification.md`
- **API Documentation:** Visit `http://localhost:8000/docs` (Swagger UI)
- **Agent Architecture:** See `docs/functional-specification.md` Section 2.4

---

## 11. Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run tests: `pytest`
4. Commit with conventional commits: `git commit -m "feat: add new feature"`
5. Push and create Pull Request

---

## 12. License

[Your License Here]

---

## 13. Support

For issues or questions:
- Create an issue in the repository
- Email: support@yourcompany.com
- Documentation: See `docs/` folder
