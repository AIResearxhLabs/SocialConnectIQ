"""
Monitoring and Debugging Utilities for LinkedIn Authentication Testing

This module provides utilities to monitor and debug the LinkedIn OAuth workflow,
including detailed logging, API call tracing, and failure analysis.
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum


class TestPhase(Enum):
    """Phases of the LinkedIn authentication workflow"""
    INIT_AUTH = "init_auth"
    CALLBACK = "callback"
    TOKEN_EXCHANGE = "token_exchange"
    PROFILE_FETCH = "profile_fetch"
    TOKEN_STORAGE = "token_storage"
    STATUS_CHECK = "status_check"
    POST_CREATION = "post_creation"
    DISCONNECT = "disconnect"


class CallStatus(Enum):
    """Status of an API call"""
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    RETRY = "retry"


@dataclass
class APICallRecord:
    """Record of an API call"""
    timestamp: str
    phase: str
    method: str
    url: str
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    request_headers: Dict[str, str] = field(default_factory=dict)
    request_body: Optional[Dict] = None
    response_body: Optional[Dict] = None
    error: Optional[str] = None
    call_status: str = CallStatus.SUCCESS.value
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class TestEvent:
    """Record of a test event"""
    timestamp: str
    phase: str
    event_type: str
    details: Dict[str, Any]
    success: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


class LinkedInAuthMonitor:
    """
    Comprehensive monitor for LinkedIn authentication workflow
    
    Tracks:
    - All API calls with request/response details
    - Test events and milestones
    - Errors and failures
    - Performance metrics
    - State transitions
    """
    
    def __init__(self, test_name: str):
        self.test_name = test_name
        self.start_time = datetime.utcnow()
        self.api_calls: List[APICallRecord] = []
        self.events: List[TestEvent] = []
        self.errors: List[Dict[str, Any]] = []
        self.state_transitions: List[Dict[str, Any]] = []
        self.current_phase: Optional[TestPhase] = None
        
        # Setup logger
        self.logger = logging.getLogger(f"LinkedInAuthMonitor.{test_name}")
        self.logger.setLevel(logging.DEBUG)
    
    def start_phase(self, phase: TestPhase, details: Optional[Dict] = None):
        """Mark the start of a test phase"""
        self.current_phase = phase
        event = TestEvent(
            timestamp=datetime.utcnow().isoformat(),
            phase=phase.value,
            event_type="phase_start",
            details=details or {},
            success=True
        )
        self.events.append(event)
        self.logger.info(f"▶ Started phase: {phase.value}")
        if details:
            self.logger.debug(f"  Details: {json.dumps(details, indent=2)}")
    
    def end_phase(self, phase: TestPhase, success: bool = True, details: Optional[Dict] = None):
        """Mark the end of a test phase"""
        event = TestEvent(
            timestamp=datetime.utcnow().isoformat(),
            phase=phase.value,
            event_type="phase_end",
            details=details or {},
            success=success
        )
        self.events.append(event)
        status_icon = "✓" if success else "✗"
        self.logger.info(f"{status_icon} Completed phase: {phase.value} - {'SUCCESS' if success else 'FAILURE'}")
    
    def record_api_call(
        self,
        phase: TestPhase,
        method: str,
        url: str,
        status_code: Optional[int] = None,
        response_time_ms: Optional[float] = None,
        request_headers: Optional[Dict] = None,
        request_body: Optional[Dict] = None,
        response_body: Optional[Dict] = None,
        error: Optional[str] = None
    ):
        """Record an API call"""
        call_status = CallStatus.SUCCESS if error is None and (status_code is None or 200 <= status_code < 300) else CallStatus.FAILURE
        
        record = APICallRecord(
            timestamp=datetime.utcnow().isoformat(),
            phase=phase.value,
            method=method,
            url=url,
            status_code=status_code,
            response_time_ms=response_time_ms,
            request_headers=request_headers or {},
            request_body=request_body,
            response_body=response_body,
            error=error,
            call_status=call_status.value
        )
        
        self.api_calls.append(record)
        
        # Log the call
        status_str = f"Status: {status_code}" if status_code else "No status"
        time_str = f"Time: {response_time_ms:.2f}ms" if response_time_ms else ""
        self.logger.debug(f"API Call: {method} {url} - {status_str} {time_str}")
        
        if error:
            self.logger.error(f"  Error: {error}")
    
    def record_state_transition(self, from_state: str, to_state: str, details: Optional[Dict] = None):
        """Record a state transition"""
        transition = {
            "timestamp": datetime.utcnow().isoformat(),
            "from_state": from_state,
            "to_state": to_state,
            "details": details or {}
        }
        self.state_transitions.append(transition)
        self.logger.info(f"State transition: {from_state} → {to_state}")
    
    def record_error(self, phase: TestPhase, error_type: str, message: str, details: Optional[Dict] = None):
        """Record an error"""
        error = {
            "timestamp": datetime.utcnow().isoformat(),
            "phase": phase.value,
            "error_type": error_type,
            "message": message,
            "details": details or {}
        }
        self.errors.append(error)
        self.logger.error(f"❌ Error in {phase.value}: {error_type} - {message}")
        if details:
            self.logger.error(f"   Details: {json.dumps(details, indent=2)}")
    
    def record_event(self, phase: TestPhase, event_type: str, details: Dict[str, Any], success: bool = True):
        """Record a generic test event"""
        event = TestEvent(
            timestamp=datetime.utcnow().isoformat(),
            phase=phase.value,
            event_type=event_type,
            details=details,
            success=success
        )
        self.events.append(event)
        icon = "✓" if success else "✗"
        self.logger.info(f"{icon} Event: {event_type} in {phase.value}")
    
    def get_summary(self) -> Dict[str, Any]:
        """Get a summary of the test execution"""
        end_time = datetime.utcnow()
        duration = (end_time - self.start_time).total_seconds()
        
        total_api_calls = len(self.api_calls)
        successful_calls = sum(1 for call in self.api_calls if call.call_status == CallStatus.SUCCESS.value)
        failed_calls = total_api_calls - successful_calls
        
        return {
            "test_name": self.test_name,
            "duration_seconds": duration,
            "total_api_calls": total_api_calls,
            "successful_api_calls": successful_calls,
            "failed_api_calls": failed_calls,
            "total_events": len(self.events),
            "total_errors": len(self.errors),
            "total_state_transitions": len(self.state_transitions),
            "phases_executed": list(set(event.phase for event in self.events))
        }
    
    def get_detailed_report(self) -> Dict[str, Any]:
        """Get a detailed report of the test execution"""
        return {
            "summary": self.get_summary(),
            "api_calls": [call.to_dict() for call in self.api_calls],
            "events": [event.to_dict() for event in self.events],
            "errors": self.errors,
            "state_transitions": self.state_transitions
        }
    
    def print_report(self, detailed: bool = False):
        """Print a formatted report"""
        summary = self.get_summary()
        
        print("\n" + "="*80)
        print(f"LINKEDIN AUTHENTICATION TEST REPORT: {self.test_name}")
        print("="*80)
        print(f"Duration: {summary['duration_seconds']:.2f}s")
        print(f"API Calls: {summary['total_api_calls']} total, {summary['successful_api_calls']} successful, {summary['failed_api_calls']} failed")
        print(f"Events: {summary['total_events']}")
        print(f"Errors: {summary['total_errors']}")
        print(f"State Transitions: {summary['total_state_transitions']}")
        print(f"Phases: {', '.join(summary['phases_executed'])}")
        
        if self.errors:
            print("\n" + "-"*80)
            print("ERRORS:")
            print("-"*80)
            for error in self.errors:
                print(f"  [{error['phase']}] {error['error_type']}: {error['message']}")
        
        if detailed:
            print("\n" + "-"*80)
            print("API CALLS:")
            print("-"*80)
            for call in self.api_calls:
                status_icon = "✓" if call.call_status == CallStatus.SUCCESS.value else "✗"
                print(f"  {status_icon} [{call.phase}] {call.method} {call.url}")
                print(f"     Status: {call.status_code}, Time: {call.response_time_ms}ms")
                if call.error:
                    print(f"     Error: {call.error}")
            
            print("\n" + "-"*80)
            print("EVENTS:")
            print("-"*80)
            for event in self.events:
                icon = "✓" if event.success else "✗"
                print(f"  {icon} [{event.phase}] {event.event_type}")
                if event.details:
                    print(f"     {json.dumps(event.details, indent=6)}")
        
        print("="*80 + "\n")
    
    def export_to_file(self, filepath: str):
        """Export the detailed report to a JSON file"""
        report = self.get_detailed_report()
        with open(filepath, 'w') as f:
            json.dump(report, f, indent=2)
        self.logger.info(f"Report exported to {filepath}")


class FlowDiagramGenerator:
    """Generate visual flow diagrams of the authentication process"""
    
    @staticmethod
    def generate_mermaid_diagram(monitor: LinkedInAuthMonitor) -> str:
        """Generate a Mermaid diagram of the authentication flow"""
        diagram = ["```mermaid", "sequenceDiagram"]
        diagram.append("    participant User")
        diagram.append("    participant Frontend")
        diagram.append("    participant IntegrationService")
        diagram.append("    participant LinkedIn")
        diagram.append("    participant Firestore")
        
        # Add API calls to diagram
        for call in monitor.api_calls:
            if "linkedin.com" in call.url:
                source = "IntegrationService"
                target = "LinkedIn"
            elif "firestore" in call.url.lower() or call.phase == "token_storage":
                source = "IntegrationService"
                target = "Firestore"
            else:
                source = "IntegrationService"
                target = "MCP"
            
            status = "✓" if call.call_status == CallStatus.SUCCESS.value else "✗"
            diagram.append(f"    {source}->>+{target}: {call.method} {status}")
            if call.status_code:
                diagram.append(f"    {target}-->>-{source}: {call.status_code}")
        
        diagram.append("```")
        return "\n".join(diagram)


def create_test_monitor(test_name: str) -> LinkedInAuthMonitor:
    """Factory function to create a test monitor"""
    return LinkedInAuthMonitor(test_name)
