#!/usr/bin/env python3
"""
This script:
  • Connects to ClickHouse on clickhouse:9000.
  • Drops any existing table named "linux_logs" and then creates a new one.
  • Loads Linux log records from a gzip-compressed JSONL file.
  • Scans the file to determine the maximum timestamp.
  • Computes the delta so that shifting the max timestamp gives the current time.
  • Adjusts each record's timestamp by that delta.
  • Also adjusts the date in the logline and msg fields to match the shifted timestamp.
  • Inserts all the adjusted records into the ClickHouse table.
"""

# FIXME: there can be multiple log lines in a single second - currently we lose
# the order of loglines within that one second!

import json
import gzip
import datetime
import re
from clickhouse_driver import Client

def shift_dates_in_text(text, time_shift, orig_year):
    """
    Shifts all dates in the given text by the specified time_shift.
    Handles both Unix log format dates and embedded full dates.
    """
    result = text
    
    # First, check if the text begins with a Unix log timestamp (MMM DD HH:MM:SS)
    unix_log_pattern = r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\s+)(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(.+)$'
    match = re.match(unix_log_pattern, result)
    
    if match:
        month_name, spaces, day_num, time_str, rest = match.groups()
        
        # Month mapping
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        month_num = month_names.index(month_name) + 1
        
        # Convert day to integer
        day = int(day_num)
        
        # Parse the time
        hour, minute, second = map(int, time_str.split(':'))
        
        # Create a datetime object for the original logline date using passed year
        orig_logline_dt = datetime.datetime(orig_year, month_num, day, hour, minute, second)
        
        # Apply the time shift
        new_logline_dt = orig_logline_dt + time_shift
        
        # Format the new date components for the logline
        new_month_name = new_logline_dt.strftime("%b")
        new_day = new_logline_dt.day
        
        # Ensure proper spacing for single-digit days
        if new_day < 10:
            new_day_spaces = "  "  # Two spaces for single digit
        else:
            new_day_spaces = " "   # One space for double digit
        
        new_time_str = new_logline_dt.strftime("%H:%M:%S")
        
        # Reconstruct the logline
        result = f"{new_month_name}{new_day_spaces}{new_day} {new_time_str} {rest}"
    
    # Pattern for embedded dates like "Sun Feb 12 19:42:12 2006"
    embedded_date_pattern = r'(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\s+)(\d{1,2}) (\d{2}:\d{2}:\d{2}) (\d{4})'
    
    # Find all embedded dates and update them
    for match in re.finditer(embedded_date_pattern, result):
        embedded_date_str = match.group(0)
        weekday = match.group(1)
        month = match.group(2)
        spaces = match.group(3)
        day = int(match.group(4))
        time_str = match.group(5)
        year = int(match.group(6))
        
        # Create datetime for embedded date
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        month_num = month_names.index(month) + 1
        
        # Parse the time
        hour, minute, second = map(int, time_str.split(':'))
        
        # Create original datetime
        orig_embedded_dt = datetime.datetime(year, month_num, day, hour, minute, second)
        
        # Apply the time shift
        new_embedded_dt = orig_embedded_dt + time_shift

        # Format new datetime with proper components
        new_weekday = new_embedded_dt.strftime("%a")
        new_month = new_embedded_dt.strftime("%b")
        new_day = new_embedded_dt.day
        new_time = new_embedded_dt.strftime("%H:%M:%S")
        new_year = new_embedded_dt.year
        
        # Ensure proper spacing for day
        if new_day < 10:
            new_day_spaces = "  "  # Two spaces for single digit
        else:
            new_day_spaces = " "   # One space for double digit
        
        # Create new embedded date string
        new_embedded_date_str = f"{new_weekday} {new_month}{new_day_spaces}{new_day} {new_time} {new_year}"

        # Replace in the text
        result = result.replace(embedded_date_str, new_embedded_date_str)
    
    return result

def main():
    # Connect to ClickHouse on clickhouse:9000.
    client = Client(host='clickhouse', port=9000)
    
    # Drop table if it exists.
    client.execute("DROP TABLE IF EXISTS linux_logs")
    
    # Create the table.
    # We're using a MergeTree engine and ordering by the timestamp.
    client.execute("""
        CREATE TABLE linux_logs (
            timestamp DateTime,
            source String,
            pid Nullable(Int32),
            msg String,
            logline String
        ) ENGINE = MergeTree()
        ORDER BY timestamp
    """)

    # Load data from the gzip JSONL file.
    # Also, find the maximum timestamp in the file.
    rows = []
    max_dt = None

    with gzip.open("linux.jsonl.gz", "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            # Parse the timestamp assuming ISO-8601 format
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
    data_to_insert = []
    for record in rows:
        orig_dt = datetime.datetime.strptime(record["timestamp"], "%Y-%m-%dT%H:%M:%S")
        new_dt = orig_dt + shift
        
        # Get the original year for date shifting
        orig_year = orig_dt.year
        
        # Update both the logline and msg fields with the same function
        updated_logline = shift_dates_in_text(record["logline"], shift, orig_year)
        updated_msg = shift_dates_in_text(record["msg"], shift, orig_year)
        
        # Build a tuple with the values in the same order as the table columns.
        data_tuple = (
            new_dt,
            record["source"],
            record["pid"],  # pid can be null
            updated_msg,
            updated_logline
        )
        data_to_insert.append(data_tuple)

    # Insert the adjusted data into the ClickHouse table.
    client.execute(
        "INSERT INTO linux_logs (timestamp, source, pid, msg, logline) VALUES", 
        data_to_insert
    )
    print(f"Inserted {len(data_to_insert)} rows into ClickHouse.")

if __name__ == "__main__":
    main()
