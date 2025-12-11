# Functional Specification Document (FSD): Social Media Management Dashboard

| Status | Version | Last Updated | Owner |
| :--- | :--- | :--- | :--- |
| Draft | 1.0 | 2025-11-16 | Cline |

## 1. System Architecture

### 1.1. High-Level Architecture
*   **Frontend:** React (TypeScript), Material-UI (MUI), React Router
*   **Backend:** Python FastAPI microservices architecture
*   **Authentication:** Firebase Authentication (JWT-based)
*   **AI Engine:** OpenAI GPT-4o with LangChain agent framework
*   **MCP Integration:** Configurable MCP server for social media platform APIs
*   **Data Storage:** PostgreSQL (structured data), Redis (caching & agent memory)
*   **Deployment:** Docker containers (Development: Local, Production: Cloud Provider)

### 1.2. Microservices Architecture

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| **API Gateway** | FastAPI | 8000 | Central entry point, routing, rate limiting |
| **Auth Service** | FastAPI | 8001 | User registration, login, JWT token management |
| **Integration Service** | FastAPI | 8002 | OAuth flows, MCP server communication |
| **Scheduling Service** | FastAPI | 8003 | Post scheduling, cron jobs |
| **Agent Service** | FastAPI + LangChain | 8004 | AI agent with OpenAI GPT-4o |
| **Analytics Service** | FastAPI | 8005 | Metrics aggregation, performance tracking |
| **Posting Service** | FastAPI | 8006 | Execute API calls to social platforms |

### 1.3. External Dependencies

| Component | Type | Configuration |
|-----------|------|---------------|
| **MCP Server** | External API | `${MCP_SERVER_URL}` (default: http://3.135.209.100:3001) |
| **OpenAI API** | External API | `${OPENAI_API_KEY}` (GPT-4o license) |
| **Firebase** | Authentication | Firebase project credentials |
| **PostgreSQL** | Database | `${DATABASE_URL}` |
| **Redis** | Cache/Memory | `${REDIS_URL}` |

## 2. Functional Decomposition

### 2.1. User Authentication
*   **Sign-Up/Sign-In:** Users can register with Email/Password or Google OAuth
*   **Session Management:** JWT tokens stored securely on client and sent with API requests
*   **Token Refresh:** Automatic token refresh before expiration

### 2.2. Dashboard
*   **Widgets:** Summary widgets for each connected account showing recent activity
*   **Data Flow:** Frontend calls `/api/v1/dashboard-summary` to populate widgets
*   **Real-time Updates:** WebSocket connection for live notifications

### 2.3. Social Media Integrations
*   **Connection Flow:** User navigates to Integrations page, selects platform, redirected to OAuth consent
*   **MCP Server Integration:** All OAuth flows handled through configurable MCP server
*   **API Endpoints:**
    *   `POST /api/v1/integrations/linkedin/auth`: Initiates LinkedIn OAuth
    *   `POST /api/v1/integrations/facebook/auth`: Initiates Facebook OAuth
    *   `POST /api/v1/integrations/twitter/auth`: Initiates Twitter OAuth
    *   `POST /api/v1/integrations/instagram/auth`: Initiates Instagram OAuth
    *   `GET /api/v1/integrations/linkedin/callback`: OAuth callback handler
    *   `GET /api/v1/integrations`: Lists all connected accounts

### 2.4. AI Agent Service (NEW)

#### 2.4.1. Agent Architecture
The AI Agent uses the **ReAct (Reasoning + Acting)** pattern powered by OpenAI GPT-4o:

```
User Input → Agent Reasoning → Tool Selection → Tool Execution → Observation → Response
```

**Agent Components:**

1. **LangChain Agent Executor**
   - OpenAI GPT-4o as reasoning engine
   - ReAct prompt template for structured thinking
   - Conversation memory (last 10 exchanges stored in Redis)
   - Token usage tracking per request

2. **Available Tools:**

| Tool Name | Purpose | MCP/Internal |
|-----------|---------|--------------|
| `linkedin_authenticate` | Initiate LinkedIn OAuth | MCP: GET /api/auth/linkedin |
| `linkedin_post` | Create LinkedIn post | MCP: POST /api/linkedin/posts |
| `facebook_post` | Create Facebook post | MCP: POST /api/facebook/posts |
| `twitter_post` | Create Twitter post | MCP: POST /api/twitter/posts |
| `instagram_post` | Create Instagram post | MCP: POST /api/instagram/posts |
| `generate_caption` | AI caption generation | Internal (GPT-4o) |
| `optimize_schedule` | Best posting time | MCP: POST /api/gemini/schedule |
| `analyze_performance` | Get post metrics | MCP: GET /api/linkedin/posts/:id/likes |
| `get_user_preferences` | Retrieve user settings | Internal (PostgreSQL) |

3. **Agent Workflow Example:**

```
User: "Connect my LinkedIn and post about AI trends"

Step 1: [Thought] User needs LinkedIn connection first
Step 2: [Action] Use tool: linkedin_authenticate
Step 3: [Observation] Auth URL: https://linkedin.com/oauth/authorize?...
Step 4: [Thought] User will complete OAuth in browser, now prepare content
Step 5: [Action] Use tool: generate_caption with topic="AI trends"
Step 6: [Observation] Caption generated: "5 AI trends shaping 2025..."
Step 7: [Thought] Should I post immediately or get optimal timing?
Step 8: [Action] Use tool: optimize_schedule
Step 9: [Observation] Best time: Tomorrow 9:00 AM EST
Step 10: [Response] "I've prepared your LinkedIn post about AI trends. 
         The best time to post is tomorrow at 9 AM. Would you like me to 
         schedule it, or would you prefer to review the caption first?"
```

#### 2.4.2. Agent API Endpoints

**Chat Interface:**
```
POST /api/v1/agent/chat
Request: {
  "message": "Post to LinkedIn about AI",
  "conversation_id": "uuid-optional",
  "user_id": "user123",
  "stream": true
}
Response (Streaming): {
  "response": "I'll help you create a LinkedIn post...",
  "actions_taken": ["generate_caption", "linkedin_post"],
  "conversation_id": "uuid",
  "tokens_used": 1250,
  "cost": 0.05
}
```

**Task Execution:**
```
POST /api/v1/agent/execute
Request: {
  "task": "post_to_linkedin",
  "parameters": {
    "content": "Check out our new AI product!",
    "schedule_time": "2025-11-18T09:00:00Z"
  },
  "user_id": "user123"
}
Response: {
  "task_id": "uuid",
  "status": "pending|completed|failed",
  "result": {...}
}
```

**Conversation History:**
```
GET /api/v1/agent/conversations/:conversation_id
Response: {
  "messages": [
    {"role": "user", "content": "...", "timestamp": "..."},
    {"role": "assistant", "content": "...", "timestamp": "..."}
  ],
  "total_tokens": 5000,
  "total_cost": 0.25
}
```

### 2.5. Post Scheduling
*   **Composer UI:** Rich text editor with AI assistance panel
*   **AI Suggestions:** Real-time caption improvements and hashtag recommendations
*   **Scheduler Logic:** Cron job checks due posts every minute, dispatches via Posting Service

### 2.6. Analytics
*   **Data Fetching:** Daily job fetches metrics from each platform via MCP server
*   **API Endpoint:** `GET /api/v1/analytics?platform=instagram&metric=engagement`
*   **AI Insights:** Performance predictions and optimization suggestions

### 2.7. Configuration Management

#### 2.7.1. Configuration Layers (Priority Order)

1. **Environment Variables** (Highest Priority)
2. **Configuration File** (`config/config.yaml`)
3. **Database Settings** (Runtime updates via Admin API)
4. **Default Values** (Fallback)

#### 2.7.2. Configuration File Structure

**`config/config.yaml`:**
```yaml
environment: ${ENVIRONMENT:-development}

mcp_server:
  base_url: ${MCP_SERVER_URL:-http://3.135.209.100:3001}
  timeout: 30
  retry_attempts: 3
  retry_delay: 2
  health_check_interval: 60

openai:
  api_key: ${OPENAI_API_KEY}
  model: ${OPENAI_MODEL:-gpt-4o}
  temperature: 0.7
  max_tokens: 2000
  streaming: true

agent:
  max_iterations: 10
  enable_streaming: true
  memory_window: 10
  conversation_timeout: 3600
  
database:
  url: ${DATABASE_URL:-postgresql://localhost/socialdb}
  pool_size: 20
  max_overflow: 10

redis:
  url: ${REDIS_URL:-redis://localhost:6379}
  ttl: 3600
  max_connections: 50

security:
  rate_limit_per_user: 100
  enable_audit_logging: true
  allowed_origins: ${CORS_ORIGINS:-http://localhost:3000}
  
logging:
  level: ${LOG_LEVEL:-INFO}
  format: json
  output: stdout
```

#### 2.7.3. Configuration API Endpoints

**Get Current Configuration:**
```
GET /api/v1/config/mcp-server
Response: {
  "url": "http://3.135.209.100:3001",
  "status": "connected",
  "last_health_check": "2025-11-17T12:00:00Z",
  "response_time_ms": 120
}
```

**Update Configuration (Admin Only):**
```
PUT /api/v1/config/mcp-server
Headers: {
  "Authorization": "Bearer <admin-token>"
}
Request: {
  "url": "http://new-ip:3001",
  "validate": true
}
Response: {
  "success": true,
  "previous_url": "http://3.135.209.100:3001",
  "new_url": "http://new-ip:3001",
  "health_check": "passed"
}
```

### 2.8. UI Theming
*   **Toggle Mechanism:** Settings menu button toggles theme, persists to `localStorage`
*   **Themes:** Light mode and dark mode with Material-UI theme system

## 3. Database Schema
*   **`users` table:** `user_id`, `email`, `created_at`.
*   **`integrations` table:** `integration_id`, `user_id`, `platform`, `access_token`, `refresh_token`.
*   **`scheduled_posts` table:** `post_id`, `integration_id`, `content`, `scheduled_at`, `status`.

## 4. API Specification
*   Reference to a future `openapi.yaml` file.
