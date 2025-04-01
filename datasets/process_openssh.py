#!/usr/bin/env python3
import re
import json
import gzip
import argparse
from datetime import datetime

def extract_additional_details(parsed_log):
    """
    Second pass parsing: extracts additional details from the log message.
    - IPv4 addresses
    - User information from various patterns
    """
    msg = parsed_log["msg"]
    
    # Extract IPv4 addresses
    ip_pattern = re.compile(r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b')
    ip_matches = ip_pattern.findall(msg)
    if ip_matches:
        parsed_log["ip"] = ip_matches[0]  # Take the first IP found
    
    # Extract user information with various patterns
    user_patterns = [
        re.compile(r'user=(\S+)'),                       # user=root
        re.compile(r'user\s+(\S+)'),                     # user root
        re.compile(r'Invalid user (\S+)'),               # Invalid user 0
        re.compile(r'for invalid user (\S+)'),           # for invalid user admin
        re.compile(r'for user (\S+)'),                   # for user admin
        re.compile(r'password for (\S+)'),               # password for root
        re.compile(r'authentication failure.* for (\S+)'),# authentication failure for root
        re.compile(r'authentication failures? for (\S+)'),# authentication failures for root
    ]

    for pattern in user_patterns:
        user_match = pattern.search(msg)
        if user_match:
            parsed_log["user"] = user_match.group(1)
            break
    
    return parsed_log

def parse_log_line(line, year):
    """
    Parses a single log line from openssh.log.
    Extracts timestamp, source, PID (if present), and message.
    Converts the timestamp into ISO-8601 format using the specified year.
    Returns the parsed log entry and the extracted month for year tracking.
    """
    # Extract basic components: timestamp, hostname, source with PID, and message
    basic_pattern = re.compile(
        r'^(?P<month>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+'
        r'(?P<day>\d{1,2})\s+'
        r'(?P<time>\d{2}:\d{2}:\d{2})\s+'
        r'(?P<hostname>\S+)\s+'
        r'(?P<source_full>.*?):\s*(?P<msg>.*)$'
    )
    match = basic_pattern.match(line)
    if not match:
        return None, None
    
    # Extract components
    month = match.group("month")
    day = match.group("day").zfill(2)  # Ensure two digits
    time = match.group("time")
    source_full = match.group("source_full")
    msg = match.group("msg")
    
    # Try to extract the PID from the source (if present)
    pid_pattern = re.compile(r'(\S+)\[(\d+)\]')
    pid_match = pid_pattern.search(source_full)
    
    if pid_match:
        source = pid_match.group(1)
        pid = int(pid_match.group(2))
    else:
        source = source_full
        pid = None
    
    # Convert the timestamp to ISO format with the specified year
    date_str = f"{month} {day} {time} {year}"
    dt = datetime.strptime(date_str, "%b %d %H:%M:%S %Y")
    iso_date = dt.isoformat()
    
    # Create the result dictionary
    result = {
        "timestamp": iso_date,
        "source": source,
        "pid": pid,
        "msg": msg,
        "logline": line.strip()
    }
    
    # Extract additional details in second pass
    result = extract_additional_details(result)
    
    return result, month

def main():
    parser = argparse.ArgumentParser(description="Convert an openssh log file into JSON Lines (jsonl) format compressed with gzip.")
    parser.add_argument("infile", help="Input log file")
    parser.add_argument("outfile", help="Output JSONL GZIP file (.jsonl.gz)")
    parser.add_argument("--year", type=int, default=2023, help="Year for logs (default: 2023)")
    args = parser.parse_args()

    current_year = args.year
    prev_month = None

    with open(args.infile, "r") as inf, gzip.open(args.outfile, "wt", encoding="utf-8") as outf:
        for line in inf:
            line = line.strip()
            if not line:
                continue  # skip empty lines
            
            parsed_log, current_month = parse_log_line(line, current_year)
            if parsed_log and current_month:
                # Check for year transition (Dec to Jan indicates year change)
                if prev_month == "Dec" and current_month == "Jan":
                    current_year += 1
                    # Re-parse the log with the updated year
                    parsed_log, _ = parse_log_line(line, current_year)
                
                # Write one JSON object per line
                outf.write(json.dumps(parsed_log) + "\n")
                prev_month = current_month
            else:
                print("Parsing error:", line)

if __name__ == '__main__':
    main()
