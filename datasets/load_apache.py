#!/usr/bin/env python3
"""
This script:
  • Connects to ClickHouse on clickhouse:9000.
  • Drops any existing table named "apache_logs" and then creates a new one.
  • Loads Apache log records from a gzip-compressed JSONL file.
  • Scans the file to determine the maximum timestamp.
  • Computes the delta so that shifting the max timestamp gives the current time.
  • Adjusts each record's timestamp by that delta.
  • Also adjusts the date in the logline field to match the shifted timestamp.
  • Inserts all the adjusted records into the ClickHouse table.
"""

# FIXME: there can be multiple log lines in a single second - currently we lose
# the order of loglines within that one second!

import json
import gzip
import datetime
import re
from clickhouse_driver import Client

def main():
    # Connect to ClickHouse on clickhouse:9000.
    client = Client(host='clickhouse', port=9000)
    
    # Drop table if it exists.
    client.execute("DROP TABLE IF EXISTS apache_logs")
    
    # Create the table.
    # We're using a MergeTree engine and ordering by the timestamp.
    client.execute("""
        CREATE TABLE apache_logs (
            timestamp DateTime,
            severity String,
            client Nullable(String),
            function Nullable(String),
            path Nullable(String),
            msg String,
            logline String
        ) ENGINE = MergeTree()
        ORDER BY timestamp
    """)

    # Load data from the gzip JSONL file.
    # Also, find the maximum timestamp in the file.
    rows = []
    max_dt = None

    with gzip.open("apache.jsonl.gz", "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            # Parse the timestamp assuming ISO-8601 format, e.g., "2005-11-28T18:36:18"
            dt = datetime.datetime.strptime(record["timestamp"], "%Y-%m-%dT%H:%M:%S")
            # Update the max timestamp.
            if (max_dt is None) or (dt > max_dt):
                max_dt = dt
            rows.append(record)

    if max_dt is None:
        print("No records found in the file!")
        return

    # Compute the time difference (shift) needed so that the maximum timestamp becomes 'now'
    now = datetime.datetime.now()
    shift = now - max_dt

    # Prepare the data to be inserted.
    # For each record, parse its timestamp and add the computed shift.
    data_to_insert = []
    for record in rows:
        orig_dt = datetime.datetime.strptime(record["timestamp"], "%Y-%m-%dT%H:%M:%S")
        new_dt = orig_dt + shift
        
        # Update the date in the logline field
        logline = record["logline"]
        # Extract the date portion with regex
        date_pattern = r'\[(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{2}:\d{2}:\d{2} \d{4}\]'
        date_match = re.search(date_pattern, logline)
        if date_match:
            date_str = date_match.group(0)  # Including the square brackets
            # Remove brackets for parsing
            date_inner = date_str[1:-1]
            # Parse the date
            orig_logline_date = datetime.datetime.strptime(date_inner, "%a %b %d %H:%M:%S %Y")
            
            # Apply the time shift
            new_logline_date = orig_logline_date + shift
            
            # Format back to the original format with brackets
            new_date_str = f"[{new_logline_date.strftime('%a %b %d %H:%M:%S %Y')}]"
            
            # Replace in the logline
            updated_logline = logline.replace(date_str, new_date_str)
        else:
            updated_logline = logline
        
        # Build a tuple with the values in the same order as the table columns.
        data_tuple = (
            new_dt,
            record["severity"],
            record.get("client"),    # client can be null
            record.get("function"),  # function can be null
            record.get("path"),      # path can be null
            record["msg"],
            updated_logline
        )
        data_to_insert.append(data_tuple)

    # Insert the adjusted data into the ClickHouse table.
    client.execute(
        "INSERT INTO apache_logs (timestamp, severity, client, function, path, msg, logline) VALUES", 
        data_to_insert
    )
    print(f"Inserted {len(data_to_insert)} rows into ClickHouse.")

if __name__ == "__main__":
    main()
