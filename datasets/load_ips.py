#!/usr/bin/env python3
"""
This script:
  • Connects to ClickHouse on clickhouse:9000
  • Drops any existing table named "ip_data" and creates a new one
  • Loads IP geolocation data from a gzip-compressed JSONL file
  • Inserts all records into the ClickHouse table
"""

import json
import gzip
from clickhouse_driver import Client
import datetime

def main():
    # Connect to ClickHouse on clickhouse:9000
    client = Client(host='clickhouse', port=9000)

    # Drop table if it exists
    client.execute("DROP TABLE IF EXISTS ip_data")

    # Create the table with all string fields as Nullable(String)
    client.execute("""
        CREATE TABLE ip_data (
            allocated_at Nullable(DateTime),
            asn Nullable(String),
            asn_country Nullable(String),
            city Nullable(String),
            country_long Nullable(String),
            country_short Nullable(String),
            hostname Nullable(String),
            ip String,
            isp Nullable(String),
            latitude Nullable(Float64),
            longitude Nullable(Float64),
            region Nullable(String),
            registry Nullable(String),
            timezone Nullable(String),
            zipcode Nullable(String)
        ) ENGINE = MergeTree()
        ORDER BY ip
    """)

    # Load data from the gzip JSONL file
    rows = []
    with gzip.open("ips.jsonl.gz", "rt", encoding="utf-8") as f:
        for line_number, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue

            try:
                record = json.loads(line)

                # Parse the allocated_at timestamp (handling None values)
                dt = None
                if record.get("allocated_at"):
                    try:
                        dt = datetime.datetime.strptime(record["allocated_at"], "%Y-%m-%dT%H:%M:%SZ")
                    except ValueError:
                        print(f"Warning: Invalid date format on line {line_number}: {record['allocated_at']}")

                # Convert latitude and longitude to float (handling parsing errors)
                try:
                    lat = float(record["latitude"]) if record.get("latitude") else None
                except (ValueError, TypeError):
                    lat = None

                try:
                    lon = float(record["longitude"]) if record.get("longitude") else None
                except (ValueError, TypeError):
                    lon = None

                # Build a tuple with the values in the same order as the table columns
                data_tuple = (
                    dt,
                    record.get("asn"),
                    record.get("asn_country"),
                    record.get("city"),
                    record.get("country_long"),
                    record.get("country_short"),
                    record.get("hostname"),
                    record.get("ip"),
                    record.get("isp"),
                    lat,
                    lon,
                    record.get("region"),
                    record.get("registry"),
                    record.get("timezone"),
                    record.get("zipcode")
                )
                rows.append(data_tuple)
            except json.JSONDecodeError:
                print(f"Warning: Invalid JSON on line {line_number}")
            except Exception as e:
                print(f"Error processing line {line_number}: {str(e)}")

    # Insert all data in a single operation
    client.execute(
        """INSERT INTO ip_data (
            allocated_at, asn, asn_country, city, country_long, country_short, 
            hostname, ip, isp, latitude, longitude, region, registry, timezone, zipcode
        ) VALUES""",
        rows
    )
    print(f"Inserted {len(rows)} rows into ClickHouse.")

if __name__ == "__main__":
    main()
