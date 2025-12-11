"""
MCP Interaction Logger - Dedicated logging for MCP server communications
Provides detailed request/response logging for debugging MCP integrations
"""
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import sys
import os

class MCPInteractionLogger:
    """Logger specifically for MCP server interactions with detailed payload logging"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.centralized_log = "logs/centralized.log"
        self.mcp_log = "logs/mcp-interactions.log"
        self._setup_loggers()
    
    def _setup_loggers(self):
        """Setup separate loggers for centralized and MCP-specific logs"""
        # Ensure log directory exists
        os.makedirs("logs", exist_ok=True)
        
        # Centralized logger (JSON format)
        self.centralized_logger = logging.getLogger(f"{self.service_name}_centralized")
        self.centralized_logger.setLevel(logging.DEBUG)
        self.centralized_logger.handlers = []
        
        centralized_handler = logging.FileHandler(self.centralized_log)
        centralized_handler.setLevel(logging.DEBUG)
        centralized_handler.setFormatter(logging.Formatter('%(message)s'))
        self.centralized_logger.addHandler(centralized_handler)
        
        # MCP interaction logger (detailed format)
        self.mcp_logger = logging.getLogger(f"{self.service_name}_mcp")
        self.mcp_logger.setLevel(logging.DEBUG)
        self.mcp_logger.handlers = []
        
        mcp_handler = logging.FileHandler(self.mcp_log)
        mcp_handler.setLevel(logging.DEBUG)
        mcp_handler.setFormatter(logging.Formatter('%(message)s'))
        self.mcp_logger.addHandler(mcp_handler)
        
        # Console handler for immediate feedback
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
        self.centralized_logger.addHandler(console_handler)
    
    def _create_log_entry(
        self,
        level: str,
        message: str,
        correlation_id: str,
        user_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a structured log entry"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": level,
            "service": self.service_name,
            "correlation_id": correlation_id,
            "user_id": user_id or "N/A",
            "message": message
        }
        
        if additional_data:
            log_entry["data"] = additional_data
        
        return json.dumps(log_entry)
    
    def _format_separator(self, char: str = "=", length: int = 100) -> str:
        """Create a visual separator"""
        return char * length
    
    def log_mcp_request(
        self,
        correlation_id: str,
        tool_name: str,
        endpoint: str,
        method: str,
        headers: Dict[str, str],
        payload: Dict[str, Any],
        user_id: Optional[str] = None
    ):
        """Log outgoing MCP request with full details"""
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        # Log to centralized log (JSON)
        centralized_entry = self._create_log_entry(
            "INFO",
            f"MCP REQUEST: {tool_name}",
            correlation_id,
            user_id,
            {
                "tool_name": tool_name,
                "endpoint": endpoint,
                "method": method,
                "payload_size": len(json.dumps(payload))
            }
        )
        self.centralized_logger.info(centralized_entry)
        
        # Log to MCP interaction log (detailed, human-readable)
        mcp_entry = f"""
{self._format_separator("=", 100)}
🔵 MCP REQUEST
{self._format_separator("-", 100)}
Timestamp:       {timestamp}
Service:         {self.service_name}
Correlation ID:  {correlation_id}
User ID:         {user_id or "N/A"}
Tool Name:       {tool_name}
Endpoint:        {endpoint}
Method:          {method}
{self._format_separator("-", 100)}
Headers:
{json.dumps(headers, indent=2)}
{self._format_separator("-", 100)}
Request Payload:
{json.dumps(payload, indent=2)}
{self._format_separator("=", 100)}
"""
        self.mcp_logger.info(mcp_entry)
        
        # Console output (brief)
        console_msg = (
            f"🔵 [{self.service_name}] MCP REQUEST: {tool_name} | "
            f"correlation_id={correlation_id[:12]}... | "
            f"endpoint={endpoint}"
        )
        print(console_msg)
    
    def log_mcp_response(
        self,
        correlation_id: str,
        tool_name: str,
        status_code: int,
        response_headers: Dict[str, str],
        response_body: Any,
        elapsed_time: float,
        user_id: Optional[str] = None,
        error: Optional[str] = None
    ):
        """Log MCP response with full details"""
        timestamp = datetime.utcnow().isoformat() + "Z"
        success = 200 <= status_code < 300 and not error
        level = "SUCCESS" if success else "ERROR"
        emoji = "✅" if success else "❌"
        
        # Log to centralized log (JSON)
        centralized_entry = self._create_log_entry(
            level,
            f"MCP RESPONSE: {tool_name} - {status_code}",
            correlation_id,
            user_id,
            {
                "tool_name": tool_name,
                "status_code": status_code,
                "elapsed_time": f"{elapsed_time:.3f}s",
                "success": success,
                "error": error,
                "response_size": len(json.dumps(response_body)) if response_body else 0
            }
        )
        self.centralized_logger.info(centralized_entry)
        
        # Log to MCP interaction log (detailed, human-readable)
        mcp_entry = f"""
{self._format_separator("=", 100)}
{emoji} MCP RESPONSE
{self._format_separator("-", 100)}
Timestamp:       {timestamp}
Service:         {self.service_name}
Correlation ID:  {correlation_id}
User ID:         {user_id or "N/A"}
Tool Name:       {tool_name}
Status Code:     {status_code}
Elapsed Time:    {elapsed_time:.3f}s
Success:         {success}
{self._format_separator("-", 100)}
Response Headers:
{json.dumps(response_headers, indent=2)}
{self._format_separator("-", 100)}
Response Body:
{json.dumps(response_body, indent=2) if response_body else "No response body"}
{self._format_separator("-", 100)}
Error: {error if error else "None"}
{self._format_separator("=", 100)}

"""
        self.mcp_logger.info(mcp_entry)
        
        # Console output (brief)
        console_msg = (
            f"{emoji} [{self.service_name}] MCP RESPONSE: {tool_name} | "
            f"status={status_code} | "
            f"time={elapsed_time:.3f}s | "
            f"correlation_id={correlation_id[:12]}..."
        )
        print(console_msg)
    
    def log_mcp_error(
        self,
        correlation_id: str,
        tool_name: str,
        error: str,
        user_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Log MCP error"""
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        # Log to centralized log (JSON)
        centralized_entry = self._create_log_entry(
            "ERROR",
            f"MCP ERROR: {tool_name}",
            correlation_id,
            user_id,
            {
                "tool_name": tool_name,
                "error": error,
                **(additional_data or {})
            }
        )
        self.centralized_logger.error(centralized_entry)
        
        # Log to MCP interaction log (detailed)
        mcp_entry = f"""
{self._format_separator("=", 100)}
❌ MCP ERROR
{self._format_separator("-", 100)}
Timestamp:       {timestamp}
Service:         {self.service_name}
Correlation ID:  {correlation_id}
User ID:         {user_id or "N/A"}
Tool Name:       {tool_name}
{self._format_separator("-", 100)}
Error:
{error}
{self._format_separator("-", 100)}
Additional Data:
{json.dumps(additional_data, indent=2) if additional_data else "None"}
{self._format_separator("=", 100)}

"""
        self.mcp_logger.error(mcp_entry)
        
        # Console output
        console_msg = (
            f"❌ [{self.service_name}] MCP ERROR: {tool_name} | "
            f"correlation_id={correlation_id[:12]}... | "
            f"error={error[:100]}"
        )
        print(console_msg)
