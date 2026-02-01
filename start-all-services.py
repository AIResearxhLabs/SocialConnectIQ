#!/usr/bin/env python3
"""
Cross-Platform Service Startup Script
Starts: API Gateway + Backend Service + Integration Service + Agent Service + Scheduling Service

Works on: Windows, macOS, Linux
"""

import os
import sys

# Force UTF-8 encoding on Windows to prevent unicode/emoji crashes
if sys.platform == 'win32':
    os.environ['PYTHONUTF8'] = '1'

from pathlib import Path

# Add scripts directory to path
scripts_dir = Path(__file__).parent / 'scripts'
sys.path.insert(0, str(scripts_dir))

try:
    from service_manager import ServiceManager, Fore, Style
except ImportError as e:
    print(f"❌ Error importing service_manager: {e}")
    print("   Make sure scripts/service_manager.py exists and dependencies are installed")
    print("   Run: pip install psutil colorama")
    sys.exit(1)


def main():
    """Main entry point for starting all services"""
    
    print(f"{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}")
    print(f"{Fore.MAGENTA}🚀 Starting All Services{Style.RESET_ALL}")
    print(f"{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}\n")
    
    # Initialize service manager
    manager = ServiceManager()
    
    # Service configuration: (name, directory, port, host, reload)
    services_config = [
        ('backend-service', 'backend-service', 8001, '0.0.0.0', False),
        ('integration-service', 'services/integration-service', 8002, '127.0.0.1', True),
        ('scheduling-service', 'services/scheduling-service', 8003, '127.0.0.1', True),
        ('agent-service', 'services/agent-service', 8006, '127.0.0.1', True),
        ('analytics-service', 'services/analytics-service', 8004, '0.0.0.0', True),
        ('api-gateway', 'api-gateway', 8000, '0.0.0.0', False),
    ]
    
    # Step 1: Clean up any existing processes
    print(f"{Fore.CYAN}🧹 Cleaning up existing processes...{Style.RESET_ALL}")
    ports_to_clean = [8000, 8001, 8002, 8003, 8006, 8004]
    service_names = ['API Gateway', 'Backend Service', 'Integration Service', 'Scheduling Service', 'Agent Service', 'Analytics Service']
    
    for port, service_name in zip(ports_to_clean, service_names):
        manager.kill_process_on_port(port, service_name)
    print()
    
    # Step 2: Clear old logs
    log_files = [
        'centralized.log',
        'api-gateway.log',
        'backend-service.log',
        'integration-service.log',
        'scheduling-service.log',
        'scheduling-service.log',
        'agent-service.log',
        'analytics-service.log'
    ]
    manager.clear_logs(log_files)
    print()
    
    # Step 3: Start services sequentially
    started_services = []
    
    for service_name, service_dir, port, host, reload in services_config:
        service_path = manager.project_root / service_dir
        
        if not service_path.exists():
            print(f"{Fore.RED}❌ Service directory not found: {service_path}{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}   Skipping {service_name}...{Style.RESET_ALL}\n")
            continue
        
        # Start the service
        pid = manager.start_uvicorn_service(
            service_name=service_name,
            service_dir=service_path,
            port=port,
            host=host,
            reload=reload
        )
        
        if pid is None:
            print(f"{Fore.RED}❌ Failed to start {service_name}{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}   Check logs/{service_name}.log for details{Style.RESET_ALL}\n")
            
            # Ask user if they want to continue
            try:
                response = input(f"{Fore.YELLOW}Continue starting remaining services? (y/n): {Style.RESET_ALL}").lower()
                if response != 'y':
                    print(f"\n{Fore.RED}Startup aborted by user{Style.RESET_ALL}")
                    sys.exit(1)
            except KeyboardInterrupt:
                print(f"\n{Fore.RED}Startup interrupted by user{Style.RESET_ALL}")
                sys.exit(1)
            continue
        
        # Wait for service to be ready
        display_name = service_name.replace('-', ' ').title()
        if not manager.wait_for_port(port, timeout=30, service_name=display_name):
            print(f"{Fore.RED}❌ {display_name} failed to start properly{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}   Check logs/{service_name}.log for errors{Style.RESET_ALL}\n")
            
            # Ask user if they want to continue
            try:
                response = input(f"{Fore.YELLOW}Continue starting remaining services? (y/n): {Style.RESET_ALL}").lower()
                if response != 'y':
                    print(f"\n{Fore.RED}Startup aborted by user{Style.RESET_ALL}")
                    sys.exit(1)
            except KeyboardInterrupt:
                print(f"\n{Fore.RED}Startup interrupted by user{Style.RESET_ALL}")
                sys.exit(1)
        else:
            started_services.append((display_name, port, pid))
        
        print()
    
    # Step 4: Display summary
    if started_services:
        manager.print_service_info(started_services)
        return 0
    else:
        print(f"{Fore.RED}❌ No services were started successfully{Style.RESET_ALL}")
        return 1


if __name__ == '__main__':
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n\n{Fore.YELLOW}⚠️  Startup interrupted by user{Style.RESET_ALL}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Fore.RED}❌ Unexpected error: {e}{Style.RESET_ALL}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
