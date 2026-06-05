#!/usr/bin/env python3
"""Bootstrap the Elasticsearch indices Blackgate / CampaignIQ writes to.

Creates each index with an explicit mapping so the correlation, campaign
clustering, and memory-persistence pipelines behave deterministically instead of
relying on "the first document decides the type" dynamic mapping. In particular
the campaign clustering in ``services/campaigns.py`` sorts on
``campaign.last_seen`` (needs a ``date``) and term-matches
``campaign.techniques / infrastructure / signatures`` (need ``keyword``).

Design notes
------------
* Mappings only, no index settings — Elastic Cloud Serverless rejects
  ``number_of_shards`` / ``number_of_replicas``.
* ``dynamic: true`` everywhere, so fields we do not pin still index normally;
  we only pin the fields whose type matters for sorting, aggregation, or to
  avoid mapping conflicts (e.g. ``severity`` arrives as a string).
* Alert geo is intentionally left dynamic: ``services/enrichment.py`` can emit an
  empty ``geo.location`` object, and mapping it as ``geo_point`` would reject
  those documents at ingest time.

Usage
-----
    python scripts/bootstrap_indices.py            # create any missing indices
    python scripts/bootstrap_indices.py --list     # show planned indices, do nothing
    python scripts/bootstrap_indices.py --only blackgate.campaigns
    python scripts/bootstrap_indices.py --recreate --yes   # DROP + recreate (destructive)
"""
from __future__ import annotations

import argparse
import os
import sys

# Make the backend package importable whether run as `scripts/bootstrap_indices.py`
# or `python -m scripts.bootstrap_indices` from the backend directory.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from elastic_client import (  # noqa: E402
    es,
    ALERT_INDEX,
    INCIDENT_INDEX,
    CAMPAIGN_INDEX,
    MITRE_KNOWLEDGE_INDEX,
    AGENT_MEMORY_INDEX,  # single "blackgate.agent_memory" for both memory writers
)

# Reusable field templates -------------------------------------------------
_TEXT_KW = {"type": "text", "fields": {"keyword": {"type": "keyword", "ignore_above": 1024}}}


def _mitre_props() -> dict:
    """Shape of a single MITRE technique as emitted by services/mitre_mapper.py."""
    return {
        "technique_id": {"type": "keyword"},
        "technique_name": _TEXT_KW,
        "name": _TEXT_KW,
        "tactic": {"type": "keyword"},
        "confidence": {"type": "float"},
        "source": {"type": "keyword"},
        "sources": {"type": "keyword"},
        "evidence": {"type": "text"},
    }


# Index name -> mapping. Order is creation order.
INDEX_MAPPINGS: dict[str, dict] = {
    # Raw Zeek/Suricata alerts. Mostly dynamic; only pin the fields whose type
    # would otherwise be guessed inconsistently across Zeek vs Suricata docs.
    ALERT_INDEX: {
        "dynamic": True,
        "properties": {
            "@timestamp": {"type": "date"},
            "timestamp": {"type": "date"},
            "severity": {"type": "keyword"},  # arrives as a string ("3", "high")
        },
    },
    # Correlated incidents written by services/correlation.py.
    INCIDENT_INDEX: {
        "dynamic": True,
        "properties": {
            "incident_id": {"type": "keyword"},
            "risk": {"type": "keyword"},
            "alert_count": {"type": "integer"},
            "behaviors": {"type": "keyword"},
            "created_at": {"type": "date"},
            "mitre": {"properties": _mitre_props()},
            "campaign": {
                "properties": {
                    "cluster_id": {"type": "keyword"},
                    "confidence": {"type": "float"},
                    "name": _TEXT_KW,
                    "description": {"type": "text"},
                    "techniques": {"type": "keyword"},
                    "signatures": {"type": "keyword"},
                    "infrastructure": {"type": "keyword"},
                    "match_score": {"type": "float"},
                    "is_new": {"type": "boolean"},
                }
            },
            "mitre_coverage": {
                "properties": {
                    "deterministic_complete": {"type": "boolean"},
                    "technique_count": {"type": "integer"},
                    "sources": {"type": "keyword"},
                }
            },
        },
    },
    # Campaign clusters. The clustering reads campaign.last_seen (sort) and the
    # technique/infrastructure/signature keyword arrays (term overlap).
    CAMPAIGN_INDEX: {
        "dynamic": True,
        "properties": {
            "campaign": {
                "properties": {
                    "id": {"type": "keyword"},
                    "name": _TEXT_KW,
                    "description": {"type": "text"},
                    "confidence": {"type": "float"},
                    "first_seen": {"type": "date"},
                    "last_seen": {"type": "date"},
                    "techniques": {"type": "keyword"},
                    "infrastructure": {"type": "keyword"},
                    "signatures": {"type": "keyword"},
                }
            },
            "related_incident_ids": {"type": "keyword"},
            "entities": {
                "properties": {
                    "ips": {"type": "keyword"},
                    "domains": {"type": "keyword"},
                    "countries": {"type": "keyword"},
                    "asn": {"type": "keyword"},
                }
            },
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"},
        },
    },
    # MITRE ATT&CK knowledge base, searched via multi_match in mitre_mapper.py.
    MITRE_KNOWLEDGE_INDEX: {
        "dynamic": True,
        "properties": {
            "technique": {"properties": {"id": {"type": "keyword"}, "name": _TEXT_KW}},
            "tactic": {"properties": {"name": _TEXT_KW}},
            "description": {"type": "text"},
            "detection_notes": {"type": "text"},
            "example_queries": {"type": "text"},
            "related_incident_ids": {"type": "keyword"},
            "created_at": {"type": "date"},
            "last_seen": {"type": "date"},
            "updated_at": {"type": "date"},
        },
    },
    # Agent memory — a single index for both writers:
    #   * services/elastic_memory.save_to_elastic_memory -> memory.* / linked_* / confidence
    #   * elastic_client.write_organizational_memory      -> context / category / content
    AGENT_MEMORY_INDEX: {
        "dynamic": True,
        "properties": {
            # Pipeline incident-summary memory.
            "memory": {
                "properties": {
                    "type": {"type": "keyword"},
                    "scope": {"type": "keyword"},
                    "text": {"type": "text"},
                }
            },
            "linked_incidents": {"type": "keyword"},
            "confidence": {"type": "float"},
            "created_at": {"type": "date"},
            # Organizational notes.
            "context": _TEXT_KW,
            "category": {"type": "keyword"},
            "content": {"type": "text"},
            "timestamp": {"type": "date"},
        },
    },
}


def _is_real_es() -> bool:
    """The in-memory MockElasticsearch has no index-management API."""
    return hasattr(es, "indices")


def _exists(name: str) -> bool:
    return bool(es.indices.exists(index=name))


def bootstrap(only: list[str] | None, recreate: bool, confirmed: bool) -> int:
    if not _is_real_es():
        print(
            "[SKIP] Connected to the in-memory MockElasticsearch (no ES_URL/ES_API_KEY "
            "reachable). Nothing to bootstrap — set ES credentials and re-run."
        )
        return 0

    targets = list(INDEX_MAPPINGS)
    if only:
        unknown = [n for n in only if n not in INDEX_MAPPINGS]
        if unknown:
            print(f"[ERROR] Unknown index name(s): {', '.join(unknown)}")
            print(f"        Known indices: {', '.join(INDEX_MAPPINGS)}")
            return 2
        targets = [n for n in targets if n in only]

    if recreate and not confirmed:
        print("[ABORT] --recreate deletes existing indices and all their data.")
        print("        Re-run with --recreate --yes to confirm.")
        return 2

    created, skipped, recreated, failed = 0, 0, 0, 0
    for name in targets:
        mapping = INDEX_MAPPINGS[name]
        try:
            already = _exists(name)
            if already and recreate:
                es.indices.delete(index=name)
                es.indices.create(index=name, mappings=mapping)
                print(f"[RECREATED] {name}")
                recreated += 1
            elif already:
                print(f"[SKIP]      {name} (already exists)")
                skipped += 1
            else:
                es.indices.create(index=name, mappings=mapping)
                print(f"[CREATED]   {name}")
                created += 1
        except Exception as exc:  # noqa: BLE001 - report per-index, keep going
            print(f"[FAILED]    {name}: {exc}")
            failed += 1

    print(
        f"\nDone. created={created} recreated={recreated} skipped={skipped} failed={failed}"
    )
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap Blackgate Elasticsearch indices.")
    parser.add_argument("--list", action="store_true", help="List the indices this script manages and exit.")
    parser.add_argument("--only", nargs="+", metavar="INDEX", help="Only operate on the given index name(s).")
    parser.add_argument("--recreate", action="store_true", help="Delete and recreate existing indices (destructive).")
    parser.add_argument("--yes", action="store_true", help="Confirm a destructive --recreate run.")
    args = parser.parse_args()

    if args.list:
        print("Managed indices:")
        for name in INDEX_MAPPINGS:
            print(f"  - {name}")
        return 0

    return bootstrap(only=args.only, recreate=args.recreate, confirmed=args.yes)


if __name__ == "__main__":
    raise SystemExit(main())
