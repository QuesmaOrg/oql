#!/usr/bin/env python3
import re
import json
import gzip
from datetime import datetime
import argparse

def parse_log_line(line):
    """
    Parses a single Hadoop log line.
    Expected format:
      YYYY-MM-DD HH:MM:SS,MMM SEVERITY [THREAD] SOURCE: MESSAGE
    Converts the timestamp into ISO-8601 format.
    """
    pattern = re.compile(
        r'^(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s+'
        r'(?P<severity>\w+)\s+'
        r'\[(?P<thread>[^\]]+)\]\s+'
        r'(?P<source>[^:]+):\s+'
        r'(?P<msg>.*)$'
    )
    match = pattern.match(line)
    if not match:
        return None

    # Retrieve named groups
    timestamp_str = match.group("timestamp")
    severity = match.group("severity")
    thread = match.group("thread")
    source = match.group("source")
    msg = match.group("msg").strip()

    # Convert the extracted date string into a datetime object
    # Replace the comma with a period for proper parsing of microseconds
    timestamp_str_fixed = timestamp_str.replace(",", ".")
    dt = datetime.strptime(timestamp_str_fixed, "%Y-%m-%d %H:%M:%S.%f")
    iso_date = dt.isoformat(timespec="microseconds")

    result = {
        "timestamp": iso_date,
        "severity": severity,
        "thread": thread,
        "source": source,
        "msg": msg,
        "logline": line.strip()  # keep the full original logline
    }
    return result

def main():
    parser = argparse.ArgumentParser(description="Convert a Hadoop log file into JSON Lines (jsonl) format compressed with gzip.")
    parser.add_argument("infile", help="Input log file")
    parser.add_argument("outfile", help="Output JSONL GZIP file (.jsonl.gz)")
    args = parser.parse_args()

    with open(args.infile, "r") as inf, gzip.open(args.outfile, "wt", encoding="utf-8") as outf:
        for line in inf:
            line = line.strip()
            if not line:
                continue  # skip empty lines
            parsed_log = parse_log_line(line)
            if parsed_log:
                # Write one JSON object per line
                outf.write(json.dumps(parsed_log) + "\n")
            else:
                print("Parsing error:", line)

if __name__ == '__main__':
    main()