#!/usr/bin/env python3
"""
Cross-Platform Service Shutdown Script
Stops: API Gateway + Backend Service + Integration Service + Agent Service

Works on: Windows, macOS, Linux
"""

import sys
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
    """Main entry point for stopping all services"""
    
    print(f"{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}")
    print(f"{Fore.MAGENTA}🛑 Stopping All Services{Style.RESET_ALL}")
    print(f"{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}\n")
    
    # Initialize service manager
    manager = ServiceManager()
    
    # Services to stop: (port, service_name)
    services_to_stop = [
        (8000, 'API Gateway'),
        (8001, 'Backend Service'),
        (8002, 'Integration Service'),
        (8006, 'Agent Service'),
    ]
    
    stopped_count = 0
    total_count = len(services_to_stop)
    
    # Stop each service
    for port, service_name in services_to_stop:
        if manager.kill_process_on_port(port, service_name):
            stopped_count += 1
    
    print()
    print(f"{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}")
    
    if stopped_count == 0:
        print(f"{Fore.BLUE}ℹ️  No services were running{Style.RESET_ALL}")
    elif stopped_count == total_count:
        print(f"{Fore.GREEN}✅ All Services Stopped Successfully{Style.RESET_ALL}")
    else:
        print(f"{Fore.YELLOW}⚠️  Stopped {stopped_count}/{total_count} services{Style.RESET_ALL}")
    
    print(f"{Fore.MAGENTA}{'='*50}{Style.RESET_ALL}\n")
    
    return 0


if __name__ == '__main__':
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n\n{Fore.YELLOW}⚠️  Shutdown interrupted by user{Style.RESET_ALL}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Fore.RED}❌ Unexpected error: {e}{Style.RESET_ALL}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
