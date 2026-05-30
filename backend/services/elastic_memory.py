# backend/services/elastic_memory.py
from __future__ import annotations

from datetime import datetime, timezone

from elastic_client import es

CAMPAIGN_INDEX = "blackgate.campaigns"
MITRE_MEMORY_INDEX = "blackgate.mitre_knowledge"
AGENT_MEMORY_INDEX = "blackgate.agent_memory"


def save_to_elastic_memory(incident: dict):
    """Persist campaign, MITRE, and agent memory rollups in Elasticsearch."""
    campaign = incident.get("campaign") or {}
    entities = incident.get("entities") or {}
    incident_id = incident.get("incident_id")
    now = datetime.now(timezone.utc).isoformat()

    if campaign.get("cluster_id"):
        es.update(
            index=CAMPAIGN_INDEX,
            id=campaign["cluster_id"],
            retry_on_conflict=5,
            script={
                "source": """
                    ctx._source.campaign.name = params.name;
                    ctx._source.campaign.description = params.description;
                    ctx._source.campaign.confidence = Math.max(ctx._source.campaign.confidence, params.confidence);
                    ctx._source.campaign.last_seen = params.now;
                    ctx._source.entities = params.entities;
                    ctx._source.updated_at = params.now;
                    if (ctx._source.related_incident_ids == null) {
                        ctx._source.related_incident_ids = [];
                    }
                    if (params.incident_id != null && !ctx._source.related_incident_ids.contains(params.incident_id)) {
                        ctx._source.related_incident_ids.add(params.incident_id);
                    }
                """,
                "params": {
                    "name": campaign.get("name", "Unknown Campaign"),
                    "description": campaign.get("description", ""),
                    "confidence": campaign.get("confidence", 0.0),
                    "entities": entities,
                    "incident_id": incident_id,
                    "now": now,
                },
            },
            upsert={
                "campaign": {
                    "id": campaign["cluster_id"],
                    "name": campaign.get("name", "Unknown Campaign"),
                    "description": campaign.get("description", ""),
                    "confidence": campaign.get("confidence", 0.0),
                    "first_seen": now,
                    "last_seen": now,
                },
                "entities": entities,
                "related_incident_ids": [incident_id] if incident_id else [],
                "created_at": now,
                "updated_at": now,
            },
        )

    for technique in incident.get("mitre", []):
        technique_id = technique.get("technique_id")
        if not technique_id:
            continue

        es.update(
            index=MITRE_MEMORY_INDEX,
            id=technique_id,
            retry_on_conflict=5,
            script={
                "source": """
                    ctx._source.technique.name = params.name;
                    ctx._source.tactic.name = params.tactic;
                    ctx._source.last_seen = params.now;
                    ctx._source.updated_at = params.now;
                    if (ctx._source.related_incident_ids == null) {
                        ctx._source.related_incident_ids = [];
                    }
                    if (ctx._source.detection_notes == null) {
                        ctx._source.detection_notes = [];
                    }
                    if (params.incident_id != null && !ctx._source.related_incident_ids.contains(params.incident_id)) {
                        ctx._source.related_incident_ids.add(params.incident_id);
                    }
                    for (note in params.detection_notes) {
                        if (!ctx._source.detection_notes.contains(note)) {
                            ctx._source.detection_notes.add(note);
                        }
                    }
                """,
                "params": {
                    "name": technique.get("name", "Unknown ATT&CK technique"),
                    "tactic": technique.get("tactic", "Unknown"),
                    "detection_notes": technique.get("evidence", []),
                    "incident_id": incident_id,
                    "now": now,
                },
            },
            upsert={
                "technique": {
                    "id": technique_id,
                    "name": technique.get("name", "Unknown ATT&CK technique"),
                },
                "tactic": {"name": technique.get("tactic", "Unknown")},
                "related_incident_ids": [incident_id] if incident_id else [],
                "detection_notes": technique.get("evidence", []),
                "created_at": now,
                "last_seen": now,
                "updated_at": now,
            },
        )

    if incident_id:
        es.index(
            index=AGENT_MEMORY_INDEX,
            document={
                "memory": {
                    "type": "incident_summary",
                    "scope": "security",
                    "text": incident.get("summary", ""),
                },
                "linked_incidents": [incident_id],
                "linked_entities": entities,
                "confidence": campaign.get("confidence", 0.0),
                "created_at": now,
            },
        )
