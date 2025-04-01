#!/usr/bin/env python3
"""
This script:
  • Connects to ClickHouse on clickhouse:9000.
  • Drops any existing table named "hadoop_logs" and then creates a new one.
  • Loads Hadoop log records from a gzip-compressed JSONL file.
  • Scans the file to determine the maximum timestamp.
  • Computes the delta so that shifting the max timestamp gives the current time.
  • Adjusts each record's timestamp by that delta.
  • Also adjusts the date in the logline field to match the shifted timestamp.
  • Inserts all the adjusted records into the ClickHouse table.
"""

import json
import gzip
import datetime
import re
from clickhouse_driver import Client

def main():
    # Connect to ClickHouse on clickhouse:9000.
    client = Client(host='clickhouse', port=9000)
    
    # Drop table if it exists.
    client.execute("DROP TABLE IF EXISTS hadoop_logs")
    
    # Create the table.
    # We're using a MergeTree engine and ordering by the timestamp.
    client.execute("""
        CREATE TABLE hadoop_logs (
            timestamp DateTime64(6),
            severity String,
            thread String,
            source String,
            msg String,
            logline String
        ) ENGINE = MergeTree()
        ORDER BY timestamp
    """)

    # Load data from the gzip JSONL file.
    # Also, find the maximum timestamp in the file.
    rows = []
    max_dt = None

    with gzip.open("hadoop.jsonl.gz", "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            # Parse the timestamp with microseconds, e.g., "2015-10-17T21:48:16.337000"
            dt = datetime.datetime.strptime(record["timestamp"], "%Y-%m-%dT%H:%M:%S.%f")
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
        orig_dt = datetime.datetime.strptime(record["timestamp"], "%Y-%m-%dT%H:%M:%S.%f")
        new_dt = orig_dt + shift
        
        # Update the date in the logline field
        logline = record["logline"]
        # Extract the date portion with regex
        date_pattern = r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})'
        date_match = re.search(date_pattern, logline)
        if date_match:
            orig_date_str = date_match.group(0)
            # Parse the date
            orig_logline_date = datetime.datetime.strptime(orig_date_str, "%Y-%m-%d %H:%M:%S,%f")
            
            # Apply the time shift
            new_logline_date = orig_logline_date + shift
            
            # Format back to the original format
            new_date_str = new_logline_date.strftime("%Y-%m-%d %H:%M:%S,%f")[:-3]  # Only keep 3 digits of microseconds
            
            # Replace in the logline
            updated_logline = logline.replace(orig_date_str, new_date_str)
        else:
            updated_logline = logline
        
        # Build a tuple with the values in the same order as the table columns.
        data_tuple = (
            new_dt,
            record["severity"],
            record["thread"],
            record["source"],
            record["msg"],
            updated_logline
        )
        data_to_insert.append(data_tuple)

    # Insert the adjusted data into the ClickHouse table.
    client.execute(
        "INSERT INTO hadoop_logs (timestamp, severity, thread, source, msg, logline) VALUES", 
        data_to_insert
    )
    print(f"Inserted {len(data_to_insert)} rows into ClickHouse.")

if __name__ == "__main__":
    main()