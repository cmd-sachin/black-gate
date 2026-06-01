import os
import json
from collections import defaultdict
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import List, Dict

from google import genai
from google.genai import types

from elastic_client import es, ALERT_INDEX, INCIDENT_INDEX
from .mitre_mapper import map_alerts_to_mitre
from .campaigns import cluster_campaign
from .enrichment import enrich_entities
from .elastic_memory import save_to_elastic_memory

# Initialize the Gemini GenAI Client
try:
    # Google GenAI Client automatically picks up GEMINI_API_KEY from env
    client = genai.Client()
except Exception as e:
    print(f"⚠️ Failed to initialize Google GenAI Client: {e}")
    client = None

# =====================================================================
# 📊 PYDANTIC STRUCTURED SCHEMAS FOR GEMINI THREAT INTEL
# =====================================================================

class MitreTechnique(BaseModel):
    technique_id: str = Field(description="The standard MITRE ATT&CK ID, e.g., T1071.004, T1595, or T1021")
    name: str = Field(description="The formal name of the technique, e.g., Active Scanning")
    tactic: str = Field(default="Unknown", description="The MITRE ATT&CK tactic name, if known")
    confidence: float = Field(default=0.60, description="Confidence from 0.0 to 1.0")
    evidence: List[str] = Field(default_factory=list, description="Short evidence strings supporting the mapping")

class IncidentIntelligence(BaseModel):
    analyst_summary: str = Field(description="A concise, high-level executive summary of the threat (1-2 sentences)")
    detailed_narrative: str = Field(description="A comprehensive step-by-step forensic description of the attacker's timeline and observed actions")
    advanced_mitre_techniques: List[MitreTechnique] = Field(description="Additional complex or hidden MITRE ATT&CK techniques identified by the LLM that simple rules might miss")
    suggested_actionable_remediation: str = Field(description="Immediate defensive action recommendations, such as blocklists, quarantine instructions, or firewall policies")
    threat_severity_rating: str = Field(description="The risk level rating (Low, Medium, High, or Critical) based on severity of actions")
    campaign_name: str = Field(description="A creative, premium threat-actor campaign name (e.g., Obsidian Cobra, Crimson Sentinel, Phantom Storm)")
    campaign_description: str = Field(description="A high-level explanation of the threat actor campaign goals, overlapping tactics, and target infrastructure profile")

# =====================================================================
# 🧠 COGNITIVE ENRICHMENT LOOP
# =====================================================================

async def fetch_llm_intelligence(alerts: List[Dict], countries: List[str], base_mitre: List[Dict], campaign_id: str) -> Dict:
    """
    Calls Gemini to analyze the telemetry stream, extract high-level patterns,
    identify advanced MITRE techniques, and summarize the attack.
    Includes a fail-safe fallback dictionary to ensure pipeline resilience.
    """
    # 1. Fallback payload in case Gemini fails or rate limits are reached
    default_summary = f"Correlated incident cluster from IPs {list(set([a.get('source_ip') for a in alerts if a.get('source_ip')]))}."
    fallback = {
        "analyst_summary": f"Deterministic security correlation. {default_summary}",
        "detailed_narrative": "A series of related security alerts was observed from a single source host. Recommended forensic timeline mapping should be conducted.",
        "advanced_mitre_techniques": [],
        "suggested_actionable_remediation": "Block source IP on corporate firewalls and perform threat hunt on local logs.",
        "threat_severity_rating": "high" if len(alerts) >= 5 else "medium",
        "campaign_name": f"Adversary Cluster {campaign_id}",
        "campaign_description": "A campaign fingerprint clustered automatically by correlating overlapping threat vectors and host infrastructure."
    }

    if not client or not os.getenv("GEMINI_API_KEY"):
        return fallback

    try:
        # Format a condensed payload for the LLM to inspect
        alert_summary_list = []
        for a in alerts[:8]:  # Send first 8 alerts to prevent token bloating
            alert_summary_list.append({
                "timestamp": a.get("timestamp"),
                "signature": a.get("alert") or a.get("signature") or "Unknown signature",
                "proto": a.get("proto", "IP"),
                "dest_ip": a.get("destination_ip"),
                "dest_port": a.get("destination_port"),
                "query": a.get("query")
            })

        prompt = f"""
You are the Lead Cyber Threat Analyst at an elite SOC. 
Analyze this security telemetry payload and perform structured forensic enrichment.

[CONTEXT]
- Incident Country Profile: {countries}
- Elastic Security / Elasticsearch MITRE ATT&CK Evidence Detected: {base_mitre}
- Telemetry Event Log (First {len(alert_summary_list)} alerts):
{json.dumps(alert_summary_list, indent=2)}

[YOUR TASK]
1. Review the Elastic Security and Elasticsearch-derived ATT&CK evidence. Add only techniques that are missing or under-specified, and include evidence for each addition.
2. Formulate a rich step-by-step timeline narrative and a concise executive summary.
3. Suggest concrete threat mitigation steps (remediation).
4. Assign a professional campaign actor name and actor description to this cluster of threat activities.
"""

        # Call Gemini using Structured Outputs
        response = await client.aio.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=IncidentIntelligence,
                temperature=0.1,  # Keep reasoning analytical and low-hallucination
            ),
        )
        
        # Parse output safely
        if response.text:
            return json.loads(response.text)
        return fallback

    except Exception as e:
        print(f"[WARN] Gemini Enrichment fallback triggered (Rate limit or Connection error): {e}")
        return fallback

# =====================================================================
# 🔄 MAIN CORRELATION PIPELINE
# =====================================================================

def get_path(doc: Dict, path: str):
    current = doc
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current

def first_value(doc: Dict, *paths: str):
    for path in paths:
        value = get_path(doc, path) if "." in path else doc.get(path)
        if isinstance(value, list):
            value = value[0] if value else None
        if value:
            return value
    return None

def fetch_recent_alerts(limit: int = 100):
    response = es.search(
        index=ALERT_INDEX,
        size=limit,
        query={"match_all": {}}
    )
    return [hit["_source"] for hit in response["hits"]["hits"]]

def merge_mitre_techniques(base_list: List[Dict], advanced_list: List[Dict]) -> List[Dict]:
    """Merges Elastic-derived and LLM-derived MITRE techniques without weakening stronger evidence."""
    techniques = {t["technique_id"]: dict(t) for t in base_list if t.get("technique_id")}
    for t in advanced_list:
        technique_id = t.get("technique_id")
        if not technique_id:
            continue

        current = techniques.get(technique_id, {})
        current_confidence = float(current.get("confidence", 0))
        llm_confidence = float(t.get("confidence", 0.60))
        evidence = list(current.get("evidence", []))
        for item in t.get("evidence", []):
            if item not in evidence:
                evidence.append(item)

        sources = set(current.get("sources", []))
        if current.get("source"):
            sources.add(current["source"])
        sources.add("gemini")

        techniques[technique_id] = {
            **current,
            "technique_id": technique_id,
            "name": current.get("name") or t.get("name", "Unknown ATT&CK technique"),
            "tactic": current.get("tactic") or t.get("tactic", "Unknown"),
            "confidence": max(current_confidence, llm_confidence),
            "source": "hybrid" if len(sources) > 1 else "gemini",
            "sources": sorted(sources),
            "evidence": evidence[:8],
        }

    return sorted(
        techniques.values(),
        key=lambda item: (-float(item.get("confidence", 0)), item.get("technique_id", "")),
    )

async def correlate_alerts(alerts, max_llm_incidents: int = 1):
    grouped = defaultdict(list)

    # Group by Source IP
    for alert in alerts:
        source_ip = first_value(alert, "source_ip", "source.ip", "host.ip")
        if not source_ip:
            continue
        grouped[source_ip].append(alert)

    incidents = []

    ranked_groups = sorted(grouped.items(), key=lambda item: len(item[1]), reverse=True)

    for index, (source_ip, related_alerts) in enumerate(ranked_groups):
        if len(related_alerts) < 2:
            continue
            
        # Entity Extraction
        ips = {source_ip}
        domains = set()
        
        for a in related_alerts:
            for domain in (
                first_value(a, "query", "dns.question.name"),
                first_value(a, "host", "url.domain"),
                first_value(a, "destination_domain", "destination.domain"),
            ):
                if domain:
                    domains.add(domain)

            destination_ip = first_value(a, "destination_ip", "dest_ip", "destination.ip")
            if destination_ip:
                ips.add(destination_ip)

        # GeoIP/entity enrichment for campaign story, timeline, and motive hypotheses.
        entity_enrichment = enrich_entities(ips=list(ips), domains=list(domains), alerts=related_alerts)
        countries = entity_enrichment["entities"]["countries"]

        # 1. Elastic Security / Elasticsearch-first MITRE mapping
        behaviors, mitre_list = map_alerts_to_mitre(related_alerts)
        
        # 2. Calculate Campaign Clustering base
        campaign_info = cluster_campaign(mitre_list, ips, domains)

        # 3. Cognitive Enrichment Layer (AI Agent Brain)
        if index < max_llm_incidents:
            print(f"[AI] Querying Gemini for Incident & Campaign Intelligence ({source_ip})...")
            llm_intel = await fetch_llm_intelligence(related_alerts, countries, mitre_list, campaign_info["cluster_id"])
        else:
            llm_intel = {
                "analyst_summary": f"Deterministic correlation for {source_ip}.",
                "detailed_narrative": "LLM enrichment skipped to preserve quota; deterministic evidence retained.",
                "advanced_mitre_techniques": [],
                "suggested_actionable_remediation": "Review clustered evidence and apply containment controls.",
                "threat_severity_rating": "high" if len(related_alerts) >= 5 else "medium",
                "campaign_name": f"Adversary Cluster {campaign_info['cluster_id']}",
                "campaign_description": "Cluster inferred from technique and infrastructure overlap.",
            }

        # Merge advanced behaviors and techniques
        enriched_mitre = merge_mitre_techniques(mitre_list, llm_intel.get("advanced_mitre_techniques", []))
        for mitre in enriched_mitre:
            behaviors.append(mitre["name"].lower().replace(" ", "_"))
        behaviors = list(set(behaviors))

        # 4. Build Advanced Incident Schema
        incident = {
            "incident_id": f"INC-{source_ip.replace('.', '')}-{len(related_alerts)}",
            "entities": {
                "ips": list(ips),
                "domains": list(domains),
                "asn": [],
                "countries": countries,
                "enrichment": entity_enrichment
            },
            "behaviors": behaviors,
            "mitre": enriched_mitre,
            "campaign": {
                "cluster_id": campaign_info["cluster_id"],
                "confidence": campaign_info["confidence"],
                "name": llm_intel.get("campaign_name", "Unknown Campaign"),
                "description": llm_intel.get("campaign_description", "Adversary behavior cluster.")
            },
            "summary": llm_intel.get("analyst_summary", "Threat detection correlation."),
            "narrative": llm_intel.get("detailed_narrative", "Historical packet trace correlation."),
            "remediation": llm_intel.get("suggested_actionable_remediation", "Investigate instantly."),
            "risk": llm_intel.get("threat_severity_rating", "medium").lower(),
            "alert_count": len(related_alerts),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "raw_alerts_preview": related_alerts[:3]
        }

        # 5. Gemini Validation Gate
        try:
            from .gemini_validator import validate_incident
            print(f"[AI] Validating Incident {incident['incident_id']} via Gemini...")
            validation = await validate_incident(incident)
            incident["validation"] = validation
            if validation.get("revised_severity"):
                incident["risk"] = validation["revised_severity"]
        except Exception as e:
            print(f"[WARN] Validation failed for {incident['incident_id']}: {e}")
            incident["validation"] = {"is_valid": True, "verdict": "inconclusive", "reasoning": "Validation failed"}

        # Save to Elastic Search (For time-series metrics/SIEM feeds)
        es.index(index=INCIDENT_INDEX, document=incident)
        
        # Save campaign, MITRE, and agent memory rollups to Elasticsearch.
        save_to_elastic_memory(incident)
        
        incidents.append(incident)

    return incidents
