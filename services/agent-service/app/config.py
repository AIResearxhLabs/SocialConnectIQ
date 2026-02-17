"""
Configuration module for Agent Service
Multi-layer configuration: Environment Variables > Config File > Defaults
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field
import yaml
from dotenv import load_dotenv

# Load environment variables from project root .env file
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
_env_path = os.path.join(_project_root, ".env")
load_dotenv(_env_path, override=True)


class OpenAIConfig:
    """OpenAI API configuration"""
    def __init__(self):
        self.api_key: str = os.getenv("OPENAI_API_KEY", "")
        self.org_id: Optional[str] = os.getenv("OPENAI_ORG_ID")
        self.model: str = os.getenv("OPENAI_MODEL", "gpt-4o")
        self.temperature: float = float(os.getenv("OPENAI_TEMPERATURE", "0.7"))
        self.max_tokens: int = int(os.getenv("OPENAI_MAX_TOKENS", "2000"))
        self.streaming: bool = os.getenv("AGENT_ENABLE_STREAMING", "true").lower() == "true"
        self.timeout: int = 60


class MCPServerConfig:
    """MCP Server configuration with intelligent host resolution"""
    def __init__(self):
        # Determine which MCP host to use based on MCP_HOST_TYPE
        host_type = os.getenv("MCP_HOST_TYPE", "local").lower()
        
        if host_type == "local":
            # Use local Docker Desktop MCP container
            self.base_url: str = os.getenv("MCP_LOCAL_URL", "http://localhost:3001")
            self.host_type = "local"
        elif host_type == "cloud":
            # Use cloud-hosted MCP server
            self.base_url: str = os.getenv("MCP_SERVER_URL", "http://3.141.18.225:3001")
            self.host_type = "cloud"
        else:  # custom
            # Use custom URL from MCP_SERVER_URL
            self.base_url: str = os.getenv("MCP_SERVER_URL", "http://localhost:3001")
            self.host_type = "custom"
        
        self.timeout: int = int(os.getenv("MCP_SERVER_TIMEOUT", "30"))
        self.retry_attempts: int = int(os.getenv("MCP_SERVER_RETRY_ATTEMPTS", "3"))
        self.retry_delay: int = int(os.getenv("MCP_SERVER_RETRY_DELAY", "2"))
        
        # Log the MCP configuration for debugging
        print(f"MCP Server Configuration:")
        print(f"  Host Type: {self.host_type}")
        print(f"  Base URL: {self.base_url}")
        print(f"  Timeout: {self.timeout}s")


class AgentConfig:
    """AI Agent configuration"""
    def __init__(self):
        self.max_iterations: int = int(os.getenv("AGENT_MAX_ITERATIONS", "10"))
        self.memory_window: int = int(os.getenv("AGENT_MEMORY_WINDOW", "10"))
        self.conversation_timeout: int = int(os.getenv("AGENT_CONVERSATION_TIMEOUT", "3600"))
        self.enable_streaming: bool = os.getenv("AGENT_ENABLE_STREAMING", "true").lower() == "true"


class RedisConfig:
    """Redis configuration"""
    def __init__(self):
        self.url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.ttl: int = int(os.getenv("REDIS_TTL", "3600"))
        self.max_connections: int = int(os.getenv("REDIS_MAX_CONNECTIONS", "50"))


class DatabaseConfig:
    """Database configuration"""
    def __init__(self):
        self.url: str = os.getenv("DATABASE_URL", "postgresql://localhost:5432/socialdb")
        self.pool_size: int = int(os.getenv("DB_POOL_SIZE", "20"))
        self.max_overflow: int = int(os.getenv("DB_MAX_OVERFLOW", "10"))


class SecurityConfig:
    """Security configuration"""
    def __init__(self):
        self.jwt_secret: str = os.getenv("JWT_SECRET", "development-secret-key")
        self.jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
        self.jwt_expiration_minutes: int = int(os.getenv("JWT_EXPIRATION_MINUTES", "60"))
        self.rate_limit_per_user: int = int(os.getenv("RATE_LIMIT_PER_USER", "100"))


class MonitoringConfig:
    """Monitoring and observability configuration"""
    def __init__(self):
        self.enable_audit_logging: bool = os.getenv("ENABLE_AUDIT_LOGGING", "true").lower() == "true"
        self.enable_cost_tracking: bool = os.getenv("ENABLE_COST_TRACKING", "true").lower() == "true"
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO")
        self.log_format: str = os.getenv("LOG_FORMAT", "json")


class Settings:
    """Main application settings"""
    def __init__(self):
        self.environment: str = os.getenv("ENVIRONMENT", "development")
        self.service_name: str = "agent-service"
        self.service_port: int = int(os.getenv("AGENT_SERVICE_PORT", "8006"))
        
        # Sub-configurations
        self.openai = OpenAIConfig()
        self.mcp_server = MCPServerConfig()
        self.agent = AgentConfig()
        self.redis = RedisConfig()
        self.database = DatabaseConfig()
        self.security = SecurityConfig()
        self.monitoring = MonitoringConfig()


def load_yaml_config(config_path: str = "config/config.yaml") -> dict:
    """Load configuration from YAML file"""
    try:
        # Handle relative path from project root
        if not os.path.isabs(config_path):
            # Try to find project root
            current_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.abspath(os.path.join(current_dir, "../../.."))
            config_path = os.path.join(project_root, config_path)
        
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                # Expand environment variables in YAML
                return _expand_env_vars(config)
        return {}
    except Exception as e:
        print(f"Warning: Could not load config.yaml: {e}")
        return {}


def _expand_env_vars(config: dict) -> dict:
    """Recursively expand environment variables in config"""
    if isinstance(config, dict):
        return {k: _expand_env_vars(v) for k, v in config.items()}
    elif isinstance(config, list):
        return [_expand_env_vars(item) for item in config]
    elif isinstance(config, str):
        # Handle ${VAR:-default} syntax
        if config.startswith("${") and config.endswith("}"):
            var_expr = config[2:-1]
            if ":-" in var_expr:
                var_name, default = var_expr.split(":-", 1)
                return os.getenv(var_name.strip(), default.strip())
            else:
                return os.getenv(var_expr.strip(), config)
        return config
    return config


# Global settings instance
settings = Settings()

# Load YAML config for additional settings
yaml_config = load_yaml_config()


def get_system_prompt() -> str:
    """Get the agent system prompt from config"""
    return yaml_config.get("agent", {}).get("system_prompt", """
You are an intelligent social media management assistant. You help users manage their 
social media accounts, create engaging content, and optimize their posting strategy.

You have access to tools that can:
- Authenticate with social media platforms (LinkedIn, Facebook, Twitter, Instagram)
- Create and schedule posts
- Generate engaging captions
- Suggest optimal posting times
- Analyze post performance

Always think step-by-step and explain your reasoning. When a user asks you to do something,
break it down into clear steps and execute them sequentially.

Be professional, helpful, and creative. If you're unsure about something, ask for clarification.
""".strip())


def get_enabled_tools() -> list:
    """Get list of enabled tools from config"""
    tools_config = yaml_config.get("agent", {}).get("tools", [])
    return [tool["name"] for tool in tools_config if tool.get("enabled", True)]
