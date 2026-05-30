import json
import requests
import sys
from datetime import datetime

API_BASE = "http://127.0.0.1:8000"

def ingest_zeek_dns(dns_log_path):
    print(f"Reading Zeek DNS log: {dns_log_path}")
    count = 0
    with open(dns_log_path, 'r') as f:
        fields = []
        for line in f:
            line = line.strip()
            if not line:
                continue
            if line.startswith("#fields"):
                fields = line.split("\t")[1:]
                continue
            if line.startswith("#"):
                continue
            
            parts = line.split("\t")
            if len(parts) != len(fields):
                continue
            
            row = dict(zip(fields, parts))
            
            # Map to ZeekAlert schema
            try:
                ts = float(row.get("ts"))
                timestamp = datetime.fromtimestamp(ts).isoformat()
            except Exception:
                timestamp = datetime.utcnow().isoformat()
                
            payload = {
                "source_ip": row.get("id.orig_h"),
                "dest_ip": row.get("id.resp_h"),
                "timestamp": timestamp,
                "event_type": "dns",
                "query": row.get("query"),
                "raw": row
            }
            
            # Post to API
            try:
                res = requests.post(f"{API_BASE}/ingest/zeek", json=payload)
                if res.status_code == 200:
                    count += 1
            except Exception as e:
                print(f"Failed to post zeek log: {e}")
                
    print(f"Successfully ingested {count} Zeek DNS logs.")

def ingest_suricata_alerts(eve_json_path):
    print(f"Reading Suricata EVE json: {eve_json_path}")
    count = 0
    with open(eve_json_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except Exception:
                continue
            
            if ev.get("event_type") != "alert":
                continue
            
            # Map to SuricataAlert schema
            alert_info = ev.get("alert", {})
            
            # Try parsing timestamp
            ts_str = ev.get("timestamp")
            try:
                # Handle timezones like +0530
                if "+" in ts_str:
                    ts_clean = ts_str.split("+")[0]
                elif "-" in ts_str and len(ts_str.split("-")) > 3:
                    # timezone suffix exists
                    ts_clean = ts_str[:-5]
                else:
                    ts_clean = ts_str
                timestamp = datetime.fromisoformat(ts_clean).isoformat()
            except Exception:
                timestamp = datetime.utcnow().isoformat()
                
            payload = {
                "source_ip": ev.get("src_ip", "0.0.0.0"),
                "dest_ip": ev.get("dest_ip"),
                "timestamp": timestamp,
                "alert": alert_info.get("signature", "Unknown Alert"),
                "severity": str(alert_info.get("severity", "3")),
                "destination_domain": ev.get("http", {}).get("hostname"),
                "raw": ev
            }
            
            # Post to API
            try:
                res = requests.post(f"{API_BASE}/ingest/suricata", json=payload)
                if res.status_code == 200:
                    count += 1
            except Exception as e:
                print(f"Failed to post Suricata alert: {e}")
                
    print(f"Successfully ingested {count} Suricata alerts.")

import os

# Resolve paths relative to this script's directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ZEEK_LOG_PATH = os.path.join(SCRIPT_DIR, "../../data/telemetry/zeek_logs/dns.log")
SURICATA_LOG_PATH = os.path.join(SCRIPT_DIR, "../../data/telemetry/suricata_logs/eve.json")

if __name__ == "__main__":
    ingest_zeek_dns(ZEEK_LOG_PATH)
    ingest_suricata_alerts(SURICATA_LOG_PATH)
