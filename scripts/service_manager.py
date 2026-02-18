"""
Cross-Platform Service Manager Utilities
Provides OS-agnostic functions for managing microservices
"""

import os
import sys
import time
import platform
import subprocess
import signal
from pathlib import Path
from typing import Optional, List, Tuple

try:
    import psutil
except ImportError:
    print("❌ Error: 'psutil' package is required but not installed.")
    print("   Please run: pip install psutil")
    sys.exit(1)

try:
    from colorama import init, Fore, Style
    init(autoreset=True)  # Initialize colorama for Windows
except ImportError:
    # Fallback if colorama is not installed
    class Fore:
        RED = GREEN = YELLOW = BLUE = CYAN = MAGENTA = WHITE = RESET = ''
    class Style:
        BRIGHT = RESET_ALL = ''


class ServiceManager:
    """Manages microservice lifecycle across different operating systems"""
    
    def __init__(self, project_root: str = None):
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.os_type = platform.system()
        self.logs_dir = self.project_root / 'logs'
        self.pids_dir = self.project_root / 'services' / 'pids'
        
        # Ensure directories exist
        self.logs_dir.mkdir(exist_ok=True)
        self.pids_dir.mkdir(exist_ok=True)
    
    def get_python_command(self) -> str:
        """Returns appropriate Python command for the OS"""
        if self.os_type == 'Windows':
            return 'python'
        return 'python3'
    
    def get_venv_python(self, venv_path: Path) -> Path:
        """Returns path to Python executable in virtual environment"""
        if self.os_type == 'Windows':
            return venv_path / 'Scripts' / 'python.exe'
        else:
            return venv_path / 'bin' / 'python'
    
    def find_process_on_port(self, port: int) -> Optional[int]:
        """
        Find process ID listening on a specific port
        Works on Windows, macOS, and Linux
        """
        try:
            for conn in psutil.net_connections(kind='inet'):
                if conn.laddr.port == port and conn.status == 'LISTEN':
                    return conn.pid
        except (psutil.AccessDenied, psutil.NoSuchProcess):
            pass
        return None
    
    def kill_process_on_port(self, port: int, service_name: str = "Service") -> bool:
        """
        Terminate process on specified port gracefully
        Returns True if process was killed, False if no process found
        """
        pid = self.find_process_on_port(port)
        
        if not pid:
            print(f"{Fore.BLUE}ℹ️  No process found on port {port} for {service_name}{Style.RESET_ALL}")
            return False
        
        try:
            process = psutil.Process(pid)
            process_name = process.name()
            
            print(f"{Fore.YELLOW}🛑 Stopping {service_name} on port {port} (PID: {pid}, Process: {process_name}){Style.RESET_ALL}")
            
            # Kill child processes first (uvicorn workers)
            children = process.children(recursive=True)
            for child in children:
                try:
                    child.terminate()
                except psutil.NoSuchProcess:
                    pass
            
            # Wait for children to terminate
            if children:
                psutil.wait_procs(children, timeout=3)
            
            # Try graceful termination of parent
            process.terminate()
            
            # Wait up to 5 seconds for graceful shutdown
            try:
                process.wait(timeout=5)
                print(f"{Fore.GREEN}✅ {service_name} stopped gracefully{Style.RESET_ALL}")
                return True
            except psutil.TimeoutExpired:
                # Force kill if graceful shutdown fails
                print(f"{Fore.YELLOW}⚠️  Graceful shutdown timeout, forcing kill...{Style.RESET_ALL}")
                process.kill()
                process.wait(timeout=3)
                print(f"{Fore.GREEN}✅ {service_name} stopped (forced){Style.RESET_ALL}")
                return True
                
        except psutil.NoSuchProcess:
            print(f"{Fore.BLUE}ℹ️  Process {pid} already terminated{Style.RESET_ALL}")
            return False
        except psutil.AccessDenied:
            print(f"{Fore.RED}❌ Access denied when trying to kill process {pid}{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}   Try running with administrator/sudo privileges{Style.RESET_ALL}")
            return False
        except Exception as e:
            print(f"{Fore.RED}❌ Error killing process on port {port}: {e}{Style.RESET_ALL}")
            return False
    
    def check_port_available(self, port: int) -> bool:
        """Check if port is available (no process listening)"""
        return self.find_process_on_port(port) is None
    
    def wait_for_port(self, port: int, timeout: int = 30, service_name: str = "Service") -> bool:
        """
        Wait for a service to start listening on a port
        Returns True if service started, False if timeout
        """
        print(f"{Fore.CYAN}⏳ Waiting for {service_name} on port {port}...{Style.RESET_ALL}")
        
        for i in range(timeout):
            if not self.check_port_available(port):
                print(f"{Fore.GREEN}✅ {service_name} is ready on port {port}!{Style.RESET_ALL}")
                return True
            time.sleep(1)
        
        print(f"{Fore.RED}❌ {service_name} failed to start within {timeout} seconds{Style.RESET_ALL}")
        return False
    
    def create_virtualenv(self, service_dir: Path) -> Path:
        """
        Create virtual environment if it doesn't exist
        Returns path to venv directory
        """
        venv_path = service_dir / 'venv'
        
        if not venv_path.exists():
            print(f"{Fore.CYAN}📦 Creating virtual environment in {service_dir.name}...{Style.RESET_ALL}")
            python_cmd = self.get_python_command()
            
            try:
                subprocess.run(
                    [python_cmd, '-m', 'venv', str(venv_path)],
                    check=True,
                    capture_output=True
                )
                print(f"{Fore.GREEN}✅ Virtual environment created{Style.RESET_ALL}")
            except subprocess.CalledProcessError as e:
                print(f"{Fore.RED}❌ Failed to create virtual environment: {e}{Style.RESET_ALL}")
                raise
        
        return venv_path
    
    def install_requirements(self, venv_python: Path, requirements_file: Path) -> bool:
        """Install Python requirements in virtual environment"""
        if not requirements_file.exists():
            print(f"{Fore.YELLOW}⚠️  No requirements.txt found at {requirements_file}{Style.RESET_ALL}")
            return False
        
        print(f"{Fore.CYAN}📦 Checking dependencies from {requirements_file.name}...{Style.RESET_ALL}")
        
        try:
            subprocess.run(
                [str(venv_python), '-m', 'pip', 'install', '-q', '-r', str(requirements_file)],
                check=True,
                capture_output=True
            )
            return True
        except subprocess.CalledProcessError as e:
            print(f"{Fore.RED}❌ Failed to install requirements: {e}{Style.RESET_ALL}")
            return False
    
    def start_uvicorn_service(
        self,
        service_name: str,
        service_dir: Path,
        port: int,
        host: str = '0.0.0.0',
        reload: bool = False
    ) -> Optional[int]:
        """
        Start a Uvicorn-based FastAPI service
        Returns the process PID if successful, None otherwise
        """
        print(f"\n{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}")
        print(f"{Fore.MAGENTA}🚀 Starting {service_name} (Port {port}){Style.RESET_ALL}")
        print(f"{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}")
        
        # Check if service is already running
        if not self.check_port_available(port):
            print(f"{Fore.YELLOW}⚠️  Port {port} is already in use{Style.RESET_ALL}")
            return None
        
        # Create and setup virtual environment
        venv_path = self.create_virtualenv(service_dir)
        venv_python = self.get_venv_python(venv_path)
        
        # Install requirements
        requirements_file = service_dir / 'requirements.txt'
        if not self.install_requirements(venv_python, requirements_file):
            return None
        
        # Prepare log file
        log_file_path = self.logs_dir / f'{service_name}.log'
        log_file = open(log_file_path, 'w')
        
        # Build uvicorn command
        cmd = [
            str(venv_python),
            '-m', 'uvicorn',
            'app.main:app',
            '--host', host,
            '--port', str(port)
        ]
        
        if reload:
            cmd.append('--reload')
        
        # Start the service
        print(f"{Fore.CYAN}🚀 Launching {service_name}...{Style.RESET_ALL}")
        
        try:
            # Use different creation flags based on OS
            if self.os_type == 'Windows':
                # On Windows, use CREATE_NEW_PROCESS_GROUP to allow background execution
                process = subprocess.Popen(
                    cmd,
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    cwd=str(service_dir),
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
                )
            else:
                # On Unix-like systems, standard Popen works fine
                process = subprocess.Popen(
                    cmd,
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    cwd=str(service_dir),
                    preexec_fn=os.setsid  # Create new process group
                )
            
            # Save PID
            pid_file = self.pids_dir / f'{service_name}.pid'
            pid_file.write_text(str(process.pid))
            
            print(f"{Fore.GREEN}✅ {service_name} started (PID: {process.pid}){Style.RESET_ALL}")
            print(f"{Fore.BLUE}📝 Logs: {log_file_path}{Style.RESET_ALL}")
            
            return process.pid
            
        except Exception as e:
            print(f"{Fore.RED}❌ Failed to start {service_name}: {e}{Style.RESET_ALL}")
            log_file.close()
            return None
    
    def save_pid(self, service_name: str, pid: int):
        """Save process ID to file"""
        pid_file = self.pids_dir / f'{service_name}.pid'
        pid_file.write_text(str(pid))
    
    def read_pid(self, service_name: str) -> Optional[int]:
        """Read process ID from file"""
        pid_file = self.pids_dir / f'{service_name}.pid'
        if pid_file.exists():
            try:
                return int(pid_file.read_text().strip())
            except (ValueError, FileNotFoundError):
                return None
        return None
    
    def clear_logs(self, log_files: List[str]):
        """Clear specified log files"""
        print(f"{Fore.CYAN}📝 Clearing old logs...{Style.RESET_ALL}")
        for log_file in log_files:
            log_path = self.logs_dir / log_file
            if log_path.exists():
                log_path.write_text('')
    
    def print_service_info(self, services: List[Tuple[str, int, int]]):
        """
        Print summary of running services
        services: List of (name, port, pid) tuples
        """
        print(f"\n{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}")
        print(f"{Fore.GREEN}✅ All Services Started Successfully!{Style.RESET_ALL}")
        print(f"{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}\n")
        
        print(f"{Fore.CYAN}📊 Service Status:{Style.RESET_ALL}")
        for name, port, pid in services:
            print(f"  {Fore.GREEN}•{Style.RESET_ALL} {name:25} http://localhost:{port}  (PID: {pid})")
        
        print(f"\n{Fore.CYAN}📖 API Documentation:{Style.RESET_ALL}")
        for name, port, _ in services:
            print(f"  {Fore.BLUE}•{Style.RESET_ALL} {name:25} http://localhost:{port}/docs")
        
        print(f"\n{Fore.CYAN}🔍 Health Checks:{Style.RESET_ALL}")
        for name, port, _ in services:
            print(f"  {Fore.YELLOW}•{Style.RESET_ALL} {name:25} http://localhost:{port}/health")
        
        print(f"\n{Fore.CYAN}📝 Log Files:{Style.RESET_ALL}")
        for name, _, _ in services:
            log_file = f"{name.lower().replace(' ', '-')}.log"
            print(f"  {Fore.WHITE}•{Style.RESET_ALL} {name:25} logs/{log_file}")
        
        print(f"\n{Fore.CYAN}🔧 Useful Commands:{Style.RESET_ALL}")
        print(f"  {Fore.WHITE}•{Style.RESET_ALL} View all logs:     tail -f logs/*.log  (Unix) or type logs\\*.log (Windows)")
        print(f"  {Fore.WHITE}•{Style.RESET_ALL} Stop all services: python stop-all-services.py")
        print(f"\n{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}\n")
