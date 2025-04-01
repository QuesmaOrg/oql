#!/usr/bin/env python3
"""
This script:
  • Connects to ClickHouse on clickhouse:9000.
  • Drops any existing table named "openssh_logs" and then creates a new one.
  • Loads OpenSSH log records from a gzip-compressed JSONL file.
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
    client.execute("DROP TABLE IF EXISTS openssh_logs")
    
    # Create the table.
    # We're using a MergeTree engine and ordering by the timestamp.
    client.execute("""
        CREATE TABLE openssh_logs (
            timestamp DateTime,
            source String,
            pid Int32,
            msg String,
            logline String,
            ip Nullable(String),
            user Nullable(String)
        ) ENGINE = MergeTree()
        ORDER BY timestamp
    """)

    # Load data from the gzip JSONL file.
    # Also, find the maximum timestamp in the file.
    rows = []
    max_dt = None

    with gzip.open("openssh.jsonl.gz", "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            # Parse the timestamp assuming ISO-8601 format, e.g., "2023-12-17T01:25:11"
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
        
        # Extract the date components with regex
        # The format will look like "Dec 17 01:25:11" or "Jan  3 21:20:56"
        date_pattern = r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})'
        date_match = re.search(date_pattern, logline)
        
        if date_match:
            # Extract the matched date components
            month_name = date_match.group(1)  # e.g., "Jan"
            day = int(date_match.group(2))    # e.g., 3 or 17
            time_str = date_match.group(3)    # e.g., "21:20:56"
            full_match = date_match.group(0)  # The full matched string
            
            # Extract the year from the original timestamp
            year = orig_dt.year
            
            # Parse the original date by combining the extracted components
            month_num = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, 
                         "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}[month_name]
            hours, minutes, seconds = map(int, time_str.split(':'))
            
            orig_logline_date = datetime.datetime(year, month_num, day, hours, minutes, seconds)
            
            # Apply the time shift
            new_logline_date = orig_logline_date + shift
            
            # Format the new date components
            new_month_name = new_logline_date.strftime("%b")  # This will be like "Jan", "Feb", etc.
            new_day = new_logline_date.day
            new_time_str = new_logline_date.strftime("%H:%M:%S")
            
            # Format the new date with the same spacing as the original
            # For single-digit days, add an extra space to align with the original format
            if new_day < 10:
                new_date_str = f"{new_month_name}  {new_day} {new_time_str}"  # Double space for single-digit days
            else:
                new_date_str = f"{new_month_name} {new_day} {new_time_str}"   # Single space for double-digit days
            
            # Replace the original date string in the logline
            updated_logline = logline.replace(full_match, new_date_str)
        else:
            updated_logline = logline
        
        # Build a tuple with the values in the same order as the table columns.
        data_tuple = (
            new_dt,
            record["source"],
            record["pid"],
            record["msg"],
            updated_logline,
            record.get("ip"),    # ip can be null
            record.get("user")   # user can be null
        )
        data_to_insert.append(data_tuple)

    # Insert the adjusted data into the ClickHouse table.
    client.execute(
        "INSERT INTO openssh_logs (timestamp, source, pid, msg, logline, ip, user) VALUES", 
        data_to_insert
    )
    print(f"Inserted {len(data_to_insert)} rows into ClickHouse.")

if __name__ == "__main__":
    main()
