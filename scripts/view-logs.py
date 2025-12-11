#!/usr/bin/env python3
"""
Centralized Log Viewer
Pretty prints and filters JSON logs from logs/centralized.log
"""
import json
import sys
from datetime import datetime

def print_log_entry(entry):
    """Pretty print a log entry"""
    timestamp = entry.get('timestamp', '')
    level = entry.get('level', '')
    service = entry.get('service', '')
    corr_id = entry.get('correlation_id', '')[:12]  # First 12 chars
    user_id = entry.get('user_id', 'N/A')[:8]  # First 8 chars
    message = entry.get('message', '')
    
    # Color codes
    colors = {
        'INFO': '\033[94m',      # Blue
        'SUCCESS': '\033[92m',   # Green
        'WARNING': '\033[93m',   # Yellow
        'ERROR': '\033[91m',     # Red
        'DEBUG': '\033[96m',     # Cyan
        'RESET': '\033[0m'
    }
    
    color = colors.get(level, colors['RESET'])
    
    print(f"{color}[{timestamp}] [{level:7}] [{service:20}] [{corr_id}...] [{user_id}...] {message}{colors['RESET']}")
    
    if 'data' in entry:
        print(f"  {colors['RESET']}Data: {entry['data']}")

def main():
    if len(sys.argv) < 2:
        print("Centralized Log Viewer")
        print("=" * 80)
        print("Usage: python view-logs.py <log_file> [correlation_id]")
        print("\nExamples:")
        print("  python view-logs.py logs/centralized.log")
        print("  python view-logs.py logs/centralized.log 1731857234567-abc123xyz")
        print("\nOptions:")
        print("  log_file        Path to the centralized log file")
        print("  correlation_id  Optional: Filter by specific correlation ID")
        sys.exit(1)
    
    log_file = sys.argv[1]
    filter_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    print("\n" + "=" * 80)
    print(f"📋 Viewing logs from: {log_file}")
    if filter_id:
        print(f"🔍 Filtering by correlation ID: {filter_id}")
    print("=" * 80 + "\n")
    
    try:
        entry_count = 0
        with open(log_file, 'r') as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    
                    # Filter by correlation ID if provided
                    if filter_id and filter_id not in entry.get('correlation_id', ''):
                        continue
                    
                    print_log_entry(entry)
                    entry_count += 1
                except json.JSONDecodeError:
                    continue
        
        print("\n" + "=" * 80)
        print(f"📊 Total entries displayed: {entry_count}")
        print("=" * 80 + "\n")
        
    except FileNotFoundError:
        print(f"\n❌ Error: Log file '{log_file}' not found")
        print("💡 Tip: Make sure the centralized log file exists")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
