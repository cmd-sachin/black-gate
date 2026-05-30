from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from elastic_client import ALERT_INDEX, INCIDENT_INDEX, es
from pipeline.convert_hex_to_pcap import hex_to_pcap
from .correlation import correlate_alerts, fetch_recent_alerts
from .enrichment import enrich_entities_from_alerts
from .run_trace import add_event


def _script_dir() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _repo_root() -> str:
    return os.path.dirname(_script_dir())


def _default_paths() -> dict[str, str]:
    root = _repo_root()
    return {
        "hex": os.path.join(root, "data/sample/packets.hex"),
        "pcap": os.path.join(root, "data/sample/packets_simulated.pcap"),
        "zeek_dns": os.path.join(root, "data/telemetry/zeek_logs/dns.log"),
        "suricata_eve": os.path.join(root, "data/telemetry/suricata_logs/eve.json"),
    }


def _ecs_base(tool: str, timestamp_iso: str, source_ip: str | None, dest_ip: str | None) -> dict[str, Any]:
    return {
        "@timestamp": timestamp_iso,
        "event": {
            "kind": "event",
            "category": ["network"],
            "type": ["info"],
            "dataset": f"{tool}.network",
        },
        "source": {"ip": source_ip} if source_ip else {},
        "destination": {"ip": dest_ip} if dest_ip else {},
        "observer": {"type": "ids", "vendor": tool},
    }


def _index_zeek_row(row: dict[str, Any], timestamp_iso: str):
    source_ip = row.get("id.orig_h")
    dest_ip = row.get("id.resp_h")
    event_type = "dns"
    query = row.get("query")
    host = row.get("host")
    uri = row.get("uri")
    method = row.get("method")
    ecs = _ecs_base("zeek", timestamp_iso, source_ip, dest_ip)
    doc = {
        "tool": "zeek",
        "source_ip": source_ip,
        "dest_ip": dest_ip,
        "timestamp": timestamp_iso,
        "event_type": event_type,
        "query": query,
        "host": host,
        "uri": uri,
        "method": method,
        "dns": {"question": {"name": query}} if query else {},
        "url": {"domain": host, "path": uri} if (host or uri) else {},
        "http": {"request": {"method": method}} if method else {},
        "network": {"protocol": event_type, "transport": "udp"},
        **ecs,
        "raw": row,
    }
    return doc


def _index_suricata_alert(event: dict[str, Any], timestamp_iso: str):
    source_ip = event.get("src_ip")
    dest_ip = event.get("dest_ip")
    alert_info = event.get("alert", {})
    signature = alert_info.get("signature", "Unknown Alert")
    severity = str(alert_info.get("severity", "3"))
    destination_domain = (event.get("http") or {}).get("hostname")
    ecs = _ecs_base("suricata", timestamp_iso, source_ip, dest_ip)
    doc = {
        "tool": "suricata",
        "source_ip": source_ip,
        "dest_ip": dest_ip,
        "timestamp": timestamp_iso,
        "alert": signature,
        "severity": severity,
        "destination_domain": destination_domain,
        "event": {
            **ecs["event"],
            "kind": "alert",
            "type": ["indicator"],
            "action": signature,
            "severity": int(severity) if severity.isdigit() else 3,
        },
        "rule": {"name": signature, "severity": severity, "ruleset": "suricata"},
        "url": {"domain": destination_domain} if destination_domain else {},
        "network": {"protocol": "ip"},
        **{k: v for k, v in ecs.items() if k != "event"},
        "raw": event,
    }
    return doc


def run_simulated_ids_pipeline() -> dict[str, Any]:
    """
    Helper-subagent tool:
    1) Simulate packet layer from packets.hex -> pcap
    2) Feed Zeek/Suricata output logs into Elastic Security alert index
    """
    paths = _default_paths()
    add_event("helper.monitor", "Starting simulated packet monitoring", {"hex_file": paths["hex"]})

    if not os.path.exists(paths["hex"]):
        raise FileNotFoundError(f"Missing packet simulator input: {paths['hex']}")

    hex_to_pcap(paths["hex"], paths["pcap"])
    add_event("helper.ids", "Converted packets.hex to simulated pcap", {"pcap_file": paths["pcap"]})

    zeek_count = 0
    all_docs = []
    if os.path.exists(paths["zeek_dns"]):
        with open(paths["zeek_dns"], "r", encoding="utf-8", errors="ignore") as f:
            fields: list[str] = []
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
                if fields and len(parts) == len(fields):
                    row = dict(zip(fields, parts))
                    try:
                        ts = float(row.get("ts", "0"))
                        timestamp_iso = datetime.fromtimestamp(ts, timezone.utc).isoformat()
                    except Exception:
                        timestamp_iso = datetime.now(timezone.utc).isoformat()
                        doc = _index_zeek_row(row, timestamp_iso)
                        if doc:
                            all_docs.append(doc)
                    zeek_count += 1

    suricata_count = 0
    if os.path.exists(paths["suricata_eve"]):
        with open(paths["suricata_eve"], "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except Exception:
                    continue
                if event.get("event_type") != "alert":
                    continue
                ts_str = event.get("timestamp")
                try:
                    timestamp_iso = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).isoformat()
                except Exception:
                    timestamp_iso = datetime.now(timezone.utc).isoformat()
                doc = _index_suricata_alert(event, timestamp_iso)
                if doc:
                    all_docs.append(doc)
                suricata_count += 1

    if all_docs:
        add_event("helper.enrich", "Enriching telemetry batch with GeoIP and roles", {"batch_size": len(all_docs)})
        try:
            from .enrichment import enrich_alert_documents
            all_docs = enrich_alert_documents(all_docs)
        except Exception as e:
            print(f"Subagent enrichment failed: {e}")
            
        for doc in all_docs:
            es.index(index=ALERT_INDEX, document=doc)

    add_event(
        "helper.ids",
        "Ingested enriched Zeek/Suricata outputs into Elastic Security context layer",
        {"zeek_events": zeek_count, "suricata_alerts": suricata_count, "target_index": ALERT_INDEX},
    )
    return {"zeek_events": zeek_count, "suricata_alerts": suricata_count, "pcap_file": paths["pcap"]}


def run_security_correlation_queries(lookback_size: int = 500) -> dict[str, Any]:
    """
    Master-agent query tool:
    Run Elastic queries to summarize correlation findings and severity.
    """
    alerts = fetch_recent_alerts(limit=lookback_size)
    add_event("master.search", "Fetched recent alerts for correlation reasoning", {"alerts": len(alerts)})

    response = es.search(
        index=ALERT_INDEX,
        size=0,
        aggs={
            "by_source_ip": {"terms": {"field": "source.ip", "size": 10}},
            "by_signature": {"terms": {"field": "rule.name.keyword", "size": 10}},
            "by_destination_domain": {"terms": {"field": "url.domain.keyword", "size": 10}},
            "by_severity": {"terms": {"field": "event.severity", "size": 10}},
        },
        query={"match_all": {}},
    )

    security_alert_count = 0
    try:
        security_alert_count = es.count(index=".alerts-security.alerts-*")["count"]
    except Exception:
        security_alert_count = 0

    findings = {
        "source_clusters": response.get("aggregations", {}).get("by_source_ip", {}).get("buckets", []),
        "signature_clusters": response.get("aggregations", {}).get("by_signature", {}).get("buckets", []),
        "destination_clusters": response.get("aggregations", {}).get("by_destination_domain", {}).get("buckets", []),
        "severity_distribution": response.get("aggregations", {}).get("by_severity", {}).get("buckets", []),
        "security_alert_stream_count": security_alert_count,
        "raw_alert_count": len(alerts),
    }

    add_event("master.correlate", "Executed Elastic correlation aggregations", findings)
    return findings


def run_threat_intel_and_hypothesis() -> dict[str, Any]:
    alerts = fetch_recent_alerts(limit=200)
    enrichment = enrich_entities_from_alerts(alerts)
    countries = enrichment.get("entities", {}).get("countries", [])
    attacker_countries = enrichment.get("entities", {}).get("attacker_countries", [])

    ioc_matches = 0
    try:
        ioc_resp = es.search(
            index="logs-ti*,threat-*,blackgate.threat_intel",
            ignore_unavailable=True,
            size=5,
            query={"match_all": {}},
        )
        ioc_matches = len(ioc_resp.get("hits", {}).get("hits", []))
    except Exception:
        ioc_matches = 0

    hypothesis = {
        "country_relationship": enrichment.get("relationship", {}),
        "news_context_queries": enrichment.get("news_context_queries", []),
        "countries_observed": countries,
        "attacker_countries_observed": attacker_countries,
        "threat_intel_ioc_matches": ioc_matches,
        "intent_hypothesis": (
            "Likely reconnaissance-to-delivery chain targeting exposed internal assets."
            if alerts
            else "Insufficient telemetry for intent hypothesis."
        ),
        "intent_confidence": "medium" if alerts else "low",
    }
    add_event("master.hypothesis", "Built attacker intent and IOC relationship hypothesis", hypothesis)
    return hypothesis


def run_master_soc_pipeline(max_llm_incidents: int = 1) -> dict[str, Any]:
    incidents = correlate_alerts(fetch_recent_alerts(limit=300), max_llm_incidents=max_llm_incidents)
    enrich = enrich_entities_from_alerts(fetch_recent_alerts(limit=200))
    corr = run_security_correlation_queries(lookback_size=500)
    intel = run_threat_intel_and_hypothesis()

    severity_summary: dict[str, int] = {}
    for incident in incidents:
        severity = str(incident.get("risk", "unknown")).lower()
        severity_summary[severity] = severity_summary.get(severity, 0) + 1

    result = {
        "incident_count": len(incidents),
        "campaign_count": len({i.get("campaign", {}).get("cluster_id") for i in incidents if i.get("campaign")}),
        "severity_summary": severity_summary,
        "correlation": corr,
        "entity_enrichment": enrich,
        "threat_intel_and_hypothesis": intel,
        "incident_index": INCIDENT_INDEX,
    }
    add_event("master.report", "Generated grouped incidents/campaigns and severity summary", result)
    return result
