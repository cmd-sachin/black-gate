# backend/services/mitre_mapper.py
from __future__ import annotations

import re
from typing import Any

from elastic_client import ALERT_INDEX, es

MITRE_KNOWLEDGE_INDEX = "blackgate.mitre_knowledge"
ELASTIC_SECURITY_ALERT_PATTERNS = [
    ALERT_INDEX,
    ".alerts-security.alerts-*",
    "logs-*",
]

# Local mappings are intentionally the last resort. Elastic Security rule metadata,
# existing alert fields, and Elasticsearch knowledge should win whenever available.
FALLBACK_MITRE_MAPPING = {
    "SURICATA Ethertype unknown": {
        "id": "T1040",
        "name": "Network Sniffing",
        "tactic": "Credential Access",
        "behavior": "malformed_packet",
    },
    "SURICATA UDPv4 invalid checksum": {
        "id": "T1595",
        "name": "Active Scanning",
        "tactic": "Reconnaissance",
        "behavior": "network_scanning",
    },
    "SURICATA TCPv4 invalid checksum": {
        "id": "T1595",
        "name": "Active Scanning",
        "tactic": "Reconnaissance",
        "behavior": "network_scanning",
    },
    "ET DNS Query": {
        "id": "T1071.004",
        "name": "Application Layer Protocol: DNS",
        "tactic": "Command and Control",
        "behavior": "suspicious_dns",
    },
    "Trojan": {
        "id": "T1105",
        "name": "Ingress Tool Transfer",
        "tactic": "Command and Control",
        "behavior": "payload_download",
    },
    "Exploit": {
        "id": "T1190",
        "name": "Exploit Public-Facing Application",
        "tactic": "Initial Access",
        "behavior": "exploitation",
    },
}

TECHNIQUE_ID_RE = re.compile(r"^T\d{4}(?:\.\d{3})?$")


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _get_path(doc: dict[str, Any], path: str) -> Any:
    current: Any = doc
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _walk_dicts(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _walk_dicts(child)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_dicts(item)


def _upsert_technique(
    techniques: dict[str, dict[str, Any]],
    technique_id: str | None,
    name: str | None,
    *,
    tactic: str | None = None,
    source: str,
    confidence: float,
    evidence: str,
):
    if not technique_id or not TECHNIQUE_ID_RE.match(str(technique_id)):
        return

    current = techniques.get(technique_id, {})
    evidence_list = list(current.get("evidence", []))
    if evidence and evidence not in evidence_list:
        evidence_list.append(evidence)

    sources = set(current.get("sources", []))
    sources.add(source)

    techniques[technique_id] = {
        "technique_id": technique_id,
        "name": name or current.get("name") or "Unknown ATT&CK technique",
        "tactic": tactic or current.get("tactic") or "Unknown",
        "confidence": max(float(current.get("confidence", 0)), confidence),
        "source": "hybrid" if len(sources) > 1 else next(iter(sources)),
        "sources": sorted(sources),
        "evidence": evidence_list[:6],
    }


def _extract_elastic_security_mitre(doc: dict[str, Any], techniques: dict[str, dict[str, Any]], evidence_prefix: str):
    """Extract ECS/Elastic Security ATT&CK mappings from alerts and detection rule metadata."""
    for threat_doc in _walk_dicts(doc):
        technique_values = []

        if "technique" in threat_doc:
            technique_values.extend(_as_list(threat_doc.get("technique")))
        if "subtechnique" in threat_doc:
            technique_values.extend(_as_list(threat_doc.get("subtechnique")))

        tactic_name = None
        tactic = threat_doc.get("tactic")
        if isinstance(tactic, dict):
            tactic_name = tactic.get("name")
        elif isinstance(tactic, str):
            tactic_name = tactic

        for technique in technique_values:
            if isinstance(technique, dict):
                _upsert_technique(
                    techniques,
                    technique.get("id"),
                    technique.get("name"),
                    tactic=tactic_name,
                    source="elastic_security",
                    confidence=0.95,
                    evidence=f"{evidence_prefix}: Elastic Security threat technique metadata",
                )

    ids = _as_list(_get_path(doc, "threat.technique.id"))
    names = _as_list(_get_path(doc, "threat.technique.name"))
    tactics = _as_list(_get_path(doc, "threat.tactic.name"))
    for index, technique_id in enumerate(ids):
        _upsert_technique(
            techniques,
            str(technique_id),
            str(names[index]) if index < len(names) else None,
            tactic=str(tactics[0]) if tactics else None,
            source="elastic_security",
            confidence=0.95,
            evidence=f"{evidence_prefix}: ECS threat.technique fields",
        )


def _entity_terms(alerts: list[dict[str, Any]]) -> list[str]:
    terms = set()
    for alert in alerts:
        for field in (
            "source_ip",
            "dest_ip",
            "destination_ip",
            "destination_domain",
            "query",
            "host",
        ):
            value = alert.get(field)
            if value:
                terms.add(str(value))
    return sorted(terms)


def _alert_text(alerts: list[dict[str, Any]]) -> str:
    parts = []
    for alert in alerts[:20]:
        parts.extend(
            str(value)
            for value in (
                alert.get("alert"),
                alert.get("signature"),
                alert.get("event_type"),
                alert.get("query"),
                alert.get("destination_domain"),
                alert.get("host"),
            )
            if value
        )
    return " ".join(parts)[:4000]


def _search_related_elastic_security_alerts(alerts: list[dict[str, Any]], techniques: dict[str, dict[str, Any]]):
    terms = _entity_terms(alerts)
    if not terms:
        return

    should = []
    for term in terms[:20]:
        should.extend(
            [
                {"term": {"source.ip.keyword": term}},
                {"term": {"destination.ip.keyword": term}},
                {"term": {"source_ip.keyword": term}},
                {"term": {"dest_ip.keyword": term}},
                {"term": {"dns.question.name.keyword": term}},
                {"term": {"url.domain.keyword": term}},
                {"term": {"destination_domain.keyword": term}},
                {"term": {"query.keyword": term}},
            ]
        )

    try:
        response = es.search(
            index=",".join(ELASTIC_SECURITY_ALERT_PATTERNS),
            ignore_unavailable=True,
            size=25,
            query={
                "bool": {
                    "must": [
                        {
                            "bool": {
                                "should": [
                                    {"exists": {"field": "threat.technique.id"}},
                                    {"exists": {"field": "kibana.alert.rule.threat.technique.id"}},
                                    {"exists": {"field": "rule.threat.technique.id"}},
                                ],
                                "minimum_should_match": 1,
                            }
                        }
                    ],
                    "should": should,
                    "minimum_should_match": 1,
                }
            },
        )
    except Exception:
        return

    for hit in response.get("hits", {}).get("hits", []):
        _extract_elastic_security_mitre(
            hit.get("_source", {}),
            techniques,
            f"Related Elastic alert {hit.get('_id')}",
        )


def _search_mitre_knowledge(alerts: list[dict[str, Any]], techniques: dict[str, dict[str, Any]]):
    text = _alert_text(alerts)
    if not text:
        return

    try:
        response = es.search(
            index=MITRE_KNOWLEDGE_INDEX,
            ignore_unavailable=True,
            size=5,
            query={
                "multi_match": {
                    "query": text,
                    "fields": [
                        "technique.id^4",
                        "technique.name^4",
                        "tactic.name^2",
                        "description",
                        "detection_notes",
                        "example_queries",
                    ],
                }
            },
        )
    except Exception:
        return

    for hit in response.get("hits", {}).get("hits", []):
        source = hit.get("_source", {})
        score = float(hit.get("_score") or 0)
        technique = source.get("technique", {})
        tactic = source.get("tactic", {})
        _upsert_technique(
            techniques,
            technique.get("id") or source.get("technique_id"),
            technique.get("name") or source.get("name"),
            tactic=tactic.get("name") if isinstance(tactic, dict) else source.get("tactic"),
            source="elasticsearch_mitre_knowledge",
            confidence=min(0.88, 0.55 + (score / 20)),
            evidence=f"Matched Elasticsearch MITRE knowledge document {hit.get('_id')}",
        )


def _fallback_local_mapping(alerts: list[dict[str, Any]], techniques: dict[str, dict[str, Any]], behaviors: set[str]):
    for alert in alerts:
        signature = alert.get("alert") or alert.get("signature") or ""
        query = alert.get("query", "")

        for sig_pattern, mapping in FALLBACK_MITRE_MAPPING.items():
            if sig_pattern.lower() in signature.lower() or sig_pattern.lower() in query.lower():
                behaviors.add(mapping["behavior"])
                _upsert_technique(
                    techniques,
                    mapping["id"],
                    mapping["name"],
                    tactic=mapping["tactic"],
                    source="local_fallback",
                    confidence=0.45,
                    evidence=f"Fallback signature match: {sig_pattern}",
                )

        if query and "suspicious_dns" not in behaviors:
            behaviors.add("dns_resolution")
            _upsert_technique(
                techniques,
                "T1071.004",
                "Application Layer Protocol: DNS",
                tactic="Command and Control",
                source="local_fallback",
                confidence=0.35,
                evidence="Fallback Zeek DNS activity heuristic",
            )


def map_alerts_to_mitre(alerts):
    """
    Resolve MITRE ATT&CK mappings with Elastic Security as the primary authority.

    Order of evidence:
    1. ATT&CK fields already present on Elastic Security alerts/rules.
    2. Related Elastic Security alerts with threat technique metadata.
    3. Elasticsearch MITRE knowledge documents.
    4. Local Suricata/Zeek heuristics as low-confidence fallback only.
    """
    behaviors = set()
    techniques: dict[str, dict[str, Any]] = {}

    for index, alert in enumerate(alerts):
        _extract_elastic_security_mitre(alert, techniques, f"Input alert {index + 1}")
        if alert.get("raw"):
            _extract_elastic_security_mitre(alert["raw"], techniques, f"Raw input alert {index + 1}")

    _search_related_elastic_security_alerts(alerts, techniques)
    _search_mitre_knowledge(alerts, techniques)

    if not techniques:
        _fallback_local_mapping(alerts, techniques, behaviors)

    for technique in techniques.values():
        if technique.get("name"):
            behaviors.add(str(technique["name"]).lower().replace(" ", "_").replace(":", ""))

    mitre_list = sorted(
        techniques.values(),
        key=lambda item: (-item.get("confidence", 0), item.get("technique_id", "")),
    )

    return sorted(behaviors), mitre_list
