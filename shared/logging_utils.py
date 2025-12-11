"""
Centralized Logging Utility with Distributed Tracing
Implements correlation ID-based logging across all microservices
"""
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import sys

class CorrelationLogger:
    """Logger that includes correlation ID for distributed tracing"""
    
    def __init__(self, service_name: str, log_file: str = "logs/centralized.log"):
        self.service_name = service_name
        self.log_file = log_file
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup logger with both file and console handlers"""
        self.logger = logging.getLogger(f"{self.service_name}_correlation")
        self.logger.setLevel(logging.DEBUG)
        
        # Remove existing handlers
        self.logger.handlers = []
        
        # Ensure log directory exists
        import os
        log_dir = os.path.dirname(self.log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
        
        # File handler - JSON format for centralized logging
        file_handler = logging.FileHandler(self.log_file)
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter('%(message)s')
        file_handler.setFormatter(file_formatter)
        
        # Console handler - Human readable format
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter(
            '%(asctime)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(console_formatter)
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
    
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
    
    def _format_console_message(
        self,
        level: str,
        message: str,
        correlation_id: str,
        user_id: Optional[str] = None
    ) -> str:
        """Format message for console output"""
        emoji_map = {
            "INFO": "ℹ️",
            "DEBUG": "🔍",
            "WARNING": "⚠️",
            "ERROR": "❌",
            "SUCCESS": "✅"
        }
        emoji = emoji_map.get(level, "📋")
        
        return (
            f"{emoji} [{self.service_name}] "
            f"[{correlation_id[:8]}...] "
            f"{f'[User: {user_id[:8]}...] ' if user_id else ''}"
            f"{message}"
        )
    
    def info(
        self, 
        message: str, 
        correlation_id: str,
        user_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Log info level message"""
        # Log to file as JSON
        log_entry = self._create_log_entry("INFO", message, correlation_id, user_id, additional_data)
        self.logger.info(log_entry)
        
        # Also print formatted to console
        console_msg = self._format_console_message("INFO", message, correlation_id, user_id)
        print(console_msg)
    
    def debug(
        self, 
        message: str, 
        correlation_id: str,
        user_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Log debug level message"""
        log_entry = self._create_log_entry("DEBUG", message, correlation_id, user_id, additional_data)
        self.logger.debug(log_entry)
    
    def warning(
        self, 
        message: str, 
        correlation_id: str,
        user_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Log warning level message"""
        log_entry = self._create_log_entry("WARNING", message, correlation_id, user_id, additional_data)
        self.logger.warning(log_entry)
        
        console_msg = self._format_console_message("WARNING", message, correlation_id, user_id)
        print(console_msg)
    
    def error(
        self, 
        message: str, 
        correlation_id: str,
        user_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Log error level message"""
        log_entry = self._create_log_entry("ERROR", message, correlation_id, user_id, additional_data)
        self.logger.error(log_entry)
        
        console_msg = self._format_console_message("ERROR", message, correlation_id, user_id)
        print(console_msg)
    
    def success(
        self, 
        message: str, 
        correlation_id: str,
        user_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Log success message (custom level)"""
        log_entry = self._create_log_entry("SUCCESS", message, correlation_id, user_id, additional_data)
        self.logger.info(log_entry)
        
        console_msg = self._format_console_message("SUCCESS", message, correlation_id, user_id)
        print(console_msg)
    
    def request_start(
        self,
        correlation_id: str,
        endpoint: str,
        method: str,
        user_id: Optional[str] = None
    ):
        """Log the start of a request"""
        message = f"🔵 REQUEST START: {method} {endpoint}"
        self.info(
            message,
            correlation_id,
            user_id,
            {"endpoint": endpoint, "method": method}
        )
    
    def request_end(
        self,
        correlation_id: str,
        endpoint: str,
        status_code: int,
        user_id: Optional[str] = None
    ):
        """Log the end of a request"""
        level = "SUCCESS" if 200 <= status_code < 300 else "ERROR"
        message = f"🏁 REQUEST END: {endpoint} - Status: {status_code}"
        
        if level == "SUCCESS":
            self.success(
                message,
                correlation_id,
                user_id,
                {"endpoint": endpoint, "status_code": status_code}
            )
        else:
            self.error(
                message,
                correlation_id,
                user_id,
                {"endpoint": endpoint, "status_code": status_code}
            )


def get_correlation_id_from_headers(headers: Dict[str, str]) -> Optional[str]:
    """Extract correlation ID from request headers"""
    # Support multiple header names for compatibility
    header_names = [
        "x-correlation-id",
        "x-request-id", 
        "correlation-id",
        "request-id"
    ]
    
    for header_name in header_names:
        correlation_id = headers.get(header_name) or headers.get(header_name.replace("-", "_"))
        if correlation_id:
            return correlation_id
    
    return None


def generate_correlation_id() -> str:
    """Generate a new correlation ID"""
    import uuid
    return str(uuid.uuid4())
