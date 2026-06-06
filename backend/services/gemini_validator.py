"""
Gemini-powered validation/rejection layer for incidents and campaigns.
Determines whether a correlated incident is a genuine threat or noise,
with a structured verdict and reasoning.
"""

import json
import os
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from .gemini_retry import generate_content_with_retry

try:
    client = genai.Client()
except Exception as e:
    print(f"[WARN] Gemini validator client init failed: {e}")
    client = None


class ValidationResult(BaseModel):
    is_valid: bool = Field(description="True if genuine security incident, False if noise")
    confidence: float = Field(description="Confidence 0.0-1.0")
    verdict: str = Field(description="confirmed_threat | likely_threat | inconclusive | rejected_noise | rejected_irrelevant")
    reasoning: str = Field(description="Brief explanation of the verdict")
    revised_severity: str = Field(description="critical | high | medium | low | informational")
    analyst_notes: str = Field(description="Notes for the SOC analyst")


_FALLBACK = {
    "is_valid": True,
    "confidence": 0.5,
    "verdict": "inconclusive",
    "reasoning": "Gemini validation unavailable; incident retained for manual review.",
    "revised_severity": "medium",
    "analyst_notes": "Automated validation could not be performed.",
    "validated_by": "fallback",
}


async def validate_incident(incident: dict) -> dict:
    """
    Ask Gemini to validate or reject an incident.
    Soft gate: rejected incidents are saved but marked with verdict.
    """
    if not client or not os.getenv("GEMINI_API_KEY"):
        fb = dict(_FALLBACK)
        fb["revised_severity"] = incident.get("risk", "medium")
        return fb

    try:
        view = {
            "incident_id": incident.get("incident_id"),
            "alert_count": incident.get("alert_count", 0),
            "severity": incident.get("risk", "unknown"),
            "summary": incident.get("summary", ""),
            "narrative": (incident.get("narrative") or "")[:500],
            "entities": {
                "ips": [
                    (ip.get("ip") if isinstance(ip, dict) else ip)
                    for ip in (incident.get("entities", {}).get("ips", []))[:10]
                ],
                "domains": [
                    (d.get("domain") if isinstance(d, dict) else d)
                    for d in (incident.get("entities", {}).get("domains", []))[:10]
                ],
                "countries": incident.get("entities", {}).get("countries", []),
            },
            "mitre_techniques": [
                {"id": t.get("technique_id"), "name": t.get("name"), "confidence": t.get("confidence")}
                for t in incident.get("mitre", [])[:8]
            ],
            "campaign": incident.get("campaign", {}),
            "behaviors": incident.get("behaviors", [])[:15],
            "sample_alerts": [
                {
                    "alert": a.get("alert") or a.get("signature", ""),
                    "source_ip": a.get("source_ip"),
                    "dest_ip": a.get("dest_ip") or a.get("destination_ip"),
                }
                for a in incident.get("raw_alerts_preview", [])[:5]
            ],
        }

        prompt = f"""You are a senior SOC analyst performing QA on automated incident correlations.
Review this incident and determine whether it's a genuine security threat or noise.

[INCIDENT DATA]
{json.dumps(view, indent=2)}

[VERDICT OPTIONS]
- confirmed_threat: Clear malicious activity
- likely_threat: Suspicious patterns warranting investigation
- inconclusive: Insufficient evidence, recommend manual review
- rejected_noise: Benign activity incorrectly flagged
- rejected_irrelevant: Real but not a security concern (broadcast, DHCP, etc.)

[GUIDELINES]
- ARP broadcasts between internal IPs are typically NOT security incidents
- DNS queries to well-known domains are usually benign
- Multiple low-confidence heuristic-only MITRE mappings suggest noise
- Consider whether source/destination IPs are private vs public"""

        response = await generate_content_with_retry(
            client,
            label="validate-incident",
            model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ValidationResult,
                temperature=0.1,
            ),
        )

        if response.text:
            result = json.loads(response.text)
            result["validated_by"] = "gemini"
            return result

    except Exception as e:
        print(f"[WARN] Gemini validation fallback: {e}")

    fb = dict(_FALLBACK)
    fb["revised_severity"] = incident.get("risk", "medium")
    return fb


async def validate_campaign(campaign: dict, related_incidents: list[dict]) -> dict:
    """Validate whether a campaign cluster is coherent or coincidental."""
    if not client or not os.getenv("GEMINI_API_KEY"):
        return dict(_FALLBACK)

    try:
        view = {
            "campaign_id": campaign.get("cluster_id") or campaign.get("id"),
            "name": campaign.get("name"),
            "description": campaign.get("description"),
            "confidence": campaign.get("confidence"),
            "incident_count": len(related_incidents),
            "incident_summaries": [
                {"id": i.get("incident_id"), "severity": i.get("risk"), "summary": (i.get("summary") or "")[:200]}
                for i in related_incidents[:5]
            ],
        }

        prompt = f"""Validate whether this auto-clustered campaign is a coherent threat actor campaign or coincidental grouping.

[CAMPAIGN DATA]
{json.dumps(view, indent=2)}

Determine if the incidents share tactical, infrastructural, or temporal overlap to constitute a real campaign."""

        response = await generate_content_with_retry(
            client,
            label="validate-campaign",
            model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ValidationResult,
                temperature=0.1,
            ),
        )

        if response.text:
            result = json.loads(response.text)
            result["validated_by"] = "gemini"
            return result

    except Exception as e:
        print(f"[WARN] Campaign validation fallback: {e}")

    return dict(_FALLBACK)
