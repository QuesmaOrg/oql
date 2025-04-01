#!/usr/bin/env python3
import re
import json
import gzip
import argparse
from datetime import datetime

def parse_log_line(line, year):
    """
    Parses a single log line from linux.log.
    Extracts timestamp, source, PID (if present), and message.
    Converts the timestamp into ISO-8601 format using the specified year.
    Returns the parsed log entry and the extracted month for year tracking.
    """
    # Extract basic components: timestamp, hostname, source, and message
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
    pid_pattern = re.compile(r'.*\[(\d+)\]')
    pid_match = pid_pattern.search(source_full)
    pid = int(pid_match.group(1)) if pid_match else None
    
    # Extract the source name (without modifiers and PID)
    source_pattern = re.compile(r'^([^\(\[]+)')
    source_match = source_pattern.match(source_full)
    source = source_match.group(1).strip() if source_match else source_full
    
    # Convert the timestamp to ISO format with the specified year
    date_str = f"{month} {day} {time} {year}"
    dt = datetime.strptime(date_str, "%b %d %H:%M:%S %Y")
    iso_date = dt.isoformat()
    
    result = {
        "timestamp": iso_date,
        "source": source,
        "pid": pid,
        "msg": msg,
        "logline": line.strip()
    }
    return result, month

def main():
    parser = argparse.ArgumentParser(description="Convert a linux log file into JSON Lines (jsonl) format compressed with gzip.")
    parser.add_argument("infile", help="Input log file")
    parser.add_argument("outfile", help="Output JSONL GZIP file (.jsonl.gz)")
    args = parser.parse_args()

    current_year = 2005  # Start with 2005 as specified
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
