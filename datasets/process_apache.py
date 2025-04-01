#!/usr/bin/env python3
import re
import json
import gzip
from datetime import datetime
import argparse

def parse_log_line(line):
    """
    Parses a single log line.
    Expected format:
      [Timestamp] [severity] [client IP] [optional function()] message [optional path]
    where the client and trailing path are optional.
    Converts the timestamp into ISO-8601 format.
    The path is recognized by detecting at least two slash-separated segments,
    and a function call (if any) is extracted separately.
    """
    pattern = re.compile(
        r'^\[(?P<timestamp>[^\]]+)\]\s+'
        r'\[(?P<severity>[^\]]+)\]\s+'
        r'(?:\[client\s+(?P<client>[^\]]+)\]\s+)?'
        r'(?P<msg>(?:(?P<function>[A-Za-z0-9_.]+\(\))\s+)?.*?(?P<path>(?:/[A-Za-z0-9._-]+){2,}/?)?\s*)$'
    )
    match = pattern.match(line)
    if not match:
        return None

    # Retrieve named groups
    timestamp_str = match.group("timestamp")
    severity = match.group("severity")
    client = match.group("client")  # Optional, may be None
    function = match.group("function")  # Optional, may be None
    msg = match.group("msg").strip()
    path = match.group("path")      # Optional, may be None

    # Convert the extracted date string into a datetime object.
    dt = datetime.strptime(timestamp_str, "%a %b %d %H:%M:%S %Y")
    iso_date = dt.isoformat()

    result = {
        "timestamp": iso_date,
        "severity": severity,
        "client": client if client else None,
        "function": function if function else None,
        "path": path if path else None,
        "msg": msg,
        "logline": line.strip()  # keep the full original logline
    }
    return result

def main():
    parser = argparse.ArgumentParser(description="Convert a log file into JSON Lines (jsonl) format compressed with gzip.")
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
                # Write one JSON object per line.
                outf.write(json.dumps(parsed_log) + "\n")
            else:
                print("Parsing error:", line)

if __name__ == '__main__':
    main()
