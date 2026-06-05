"""
Blackgate SOC — FastAPI Gateway
================================
REST API exposing:
- Log ingestion (Zeek / Suricata)
- Elastic MCP bridge endpoints
- MongoDB Knowledge Base queries
- AI Agent orchestration trigger
"""

import os
import sys
import json

# Ensure backend local modules resolve whether app is launched from repo root
# (`uvicorn backend.main:app`) or from the backend directory.
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Optional
from sse_starlette.sse import EventSourceResponse
from elastic_client import es, INCIDENT_INDEX, ALERT_INDEX, CAMPAIGN_INDEX, MITRE_KNOWLEDGE_INDEX, AGENT_MEMORY_INDEX
from services.packet_simulator import stream_packets
from models.schemas import ZeekAlert, SuricataAlert
from services.correlation import fetch_recent_alerts, correlate_alerts
from services.enrichment import enrich_entities_from_alerts
from agent import run_agent
from services.run_trace import get_run, list_runs
from services.soc_runtime import run_master_soc_pipeline, run_simulated_ids_pipeline
import threading
import uuid
from datetime import datetime, timezone

# Track currently running background simulations
_active_runs: dict[str, dict] = {}

app = FastAPI(
    title="Blackgate SOC API",
    description="AI-Powered Threat Investigation & ATT&CK Mapping Platform",
    version="2.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# REQUEST SCHEMAS
# =====================================================================

class QueryRequest(BaseModel):
    query: str
    limit: int = 10

class AgentRequest(BaseModel):
    prompt: str = "Analyze the latest network alerts and report any incidents."

class IncidentReportRequest(BaseModel):
    title: str
    severity: str
    summary: str
    timeline: list[dict] = []
    mitre_mappings: list[str] = []
    sigma_rule: str = ""


class SimulatedRunRequest(BaseModel):
    prompt: str = "Run full simulated SOC pipeline and produce incident/campaign hypothesis."


class EnrichmentChatRequest(BaseModel):
    message: str
    entity: Optional[str] = None
    incident_id: Optional[str] = None
    campaign_id: Optional[str] = None


class ElasticSearchRequest(BaseModel):
    index: str
    size: int = 25
    query: dict[str, Any] = {"match_all": {}}
    sort: Optional[list[Any]] = None
    aggs: Optional[dict[str, Any]] = None


INDEX_ALIASES = {
    "alerts": ALERT_INDEX,
    "incidents": INCIDENT_INDEX,
    "campaigns": CAMPAIGN_INDEX,
    "mitre": MITRE_KNOWLEDGE_INDEX,
    "memory": AGENT_MEMORY_INDEX,
}


def _hits(response: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"id": hit.get("_id"), **(hit.get("_source") or {})}
        for hit in response.get("hits", {}).get("hits", [])
    ]


def _news_links(queries: list[str]) -> list[dict[str, str]]:
    links = []
    for query in queries[:8]:
        encoded = query.replace(" ", "+")
        links.append(
            {
                "query": query,
                "google_news": f"https://news.google.com/search?q={encoded}",
                "google_search": f"https://www.google.com/search?q={encoded}",
            }
        )
    return links

# =====================================================================
# ROOT
# =====================================================================

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Blackgate SOC API",
        "version": "2.0.0",
        "endpoints": {
            "agent": "/agent/run",
            "simulate_run": "/soc/simulate/run",
            "simulate_start": "/soc/simulate/start",
            "runs": "/soc/runs",
            "elastic_search": "/elastic/search",
            "incidents": "/incidents",
            "ingest_zeek": "/ingest/zeek",
            "ingest_suricata": "/ingest/suricata",
        }
    }

# =====================================================================
# LOG INGESTION
# =====================================================================

def _ecs_base(tool: str, timestamp_iso: str, source_ip: str | None, dest_ip: str | None):
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

@app.post("/ingest/zeek")
def ingest_zeek(alert: ZeekAlert):
    ts = alert.timestamp.isoformat()
    ecs = _ecs_base("zeek", ts, alert.source_ip, alert.dest_ip)

    doc = {
        "tool": "zeek",
        "source_ip": alert.source_ip,
        "dest_ip": alert.dest_ip,
        "timestamp": ts,
        "event_type": alert.event_type,
        "query": alert.query,
        "host": alert.host,
        "uri": alert.uri,
        "method": alert.method,
        "dns": {
            "question": {"name": alert.query}
        } if alert.query else {},
        "url": {
            "domain": alert.host,
            "path": alert.uri,
        } if (alert.host or alert.uri) else {},
        "http": {
            "request": {"method": alert.method}
        } if alert.method else {},
        "network": {
            "protocol": alert.event_type,
            "transport": "udp" if alert.event_type == "dns" else None,
        },
        **ecs,
        "raw": alert.raw,
    }
    if doc["network"].get("transport") is None:
        doc["network"].pop("transport")
    result = es.index(index=ALERT_INDEX, document=doc)
    return {"status": "ok", "id": result["_id"]}

@app.post("/ingest/suricata")
def ingest_suricata(alert: SuricataAlert):
    ts = alert.timestamp.isoformat()
    ecs = _ecs_base("suricata", ts, alert.source_ip, alert.dest_ip)

    doc = {
        "tool": "suricata",
        "source_ip": alert.source_ip,
        "dest_ip": alert.dest_ip,
        "timestamp": ts,
        "alert": alert.alert,
        "severity": alert.severity,
        "destination_domain": alert.destination_domain,
        "event": {
            **ecs["event"],
            "kind": "alert",
            "type": ["indicator"],
            "action": alert.alert,
            "severity": int(alert.severity) if str(alert.severity or "").isdigit() else 3,
        },
        "rule": {
            "name": alert.alert,
            "severity": alert.severity,
            "ruleset": "suricata",
        },
        "url": {
            "domain": alert.destination_domain,
        } if alert.destination_domain else {},
        "network": {"protocol": "ip"},
        **{k: v for k, v in ecs.items() if k != "event"},
        "raw": alert.raw,
    }
    result = es.index(index=ALERT_INDEX, document=doc)
    return {"status": "ok", "id": result["_id"]}

# =====================================================================
# ELASTIC SEARCH ENDPOINTS
# =====================================================================

@app.post("/tools/search_security_alerts")
def tool_search_security_alerts(req: QueryRequest):
    """Keyword search across Zeek and Suricata security alerts."""
    try:
        response = es.search(
            index=ALERT_INDEX,
            query={
                "multi_match": {
                    "query": req.query,
                    "fields": ["alert", "query", "destination_domain", "tool", "source_ip"]
                }
            },
            size=req.limit
        )
        hits = [hit["_source"] for hit in response["hits"]["hits"]]
        return {"hits": hits, "count": len(hits)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tools/enrich_entities")
def tool_enrich_entities(limit: int = 100):
    """Enrich recent alert entities with MMDB geo context and relationship/news leads."""
    try:
        alerts = fetch_recent_alerts(limit=limit)
        enriched = enrich_entities_from_alerts(alerts)
        return {
            "status": "ok",
            "alert_count": len(alerts),
            **enriched,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/elastic/search")
def elastic_search(req: ElasticSearchRequest):
    """Standard read path for dashboard Elasticsearch queries, restricted to known Blackgate indices."""
    index = INDEX_ALIASES.get(req.index, req.index)
    if index not in INDEX_ALIASES.values():
        raise HTTPException(status_code=400, detail=f"Index alias not allowed: {req.index}")

    try:
        response = es.search(
            index=index,
            ignore_unavailable=True,
            size=min(max(req.size, 0), 500),
            query=req.query,
            sort=req.sort,
            aggs=req.aggs,
        )
        return {
            "status": "ok",
            "index": index,
            "hits": _hits(response),
            "total": response.get("hits", {}).get("total", {}),
            "aggregations": response.get("aggregations", {}),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================================
# CORRELATION & ENRICHMENT PIPELINE
# =====================================================================

@app.get("/incidents")
async def get_incidents():
    """Run the full pipeline: fetch alerts → correlate → MITRE map → GeoIP → campaign cluster → save to Elasticsearch."""
    alerts = fetch_recent_alerts()
    incidents = await correlate_alerts(alerts)
    return {
        "incident_count": len(incidents),
        "incidents": incidents
    }


@app.post("/chat/enrich")
def chat_enrich(req: EnrichmentChatRequest):
    """
    Enrich an entity or incident/campaign context and return grounded follow-up links.
    News is returned as live search/news links so analysts can verify current reporting.
    """
    try:
        alerts = fetch_recent_alerts(limit=200)
        entity = (req.entity or "").strip()
        if not entity:
            for token in req.message.replace(",", " ").split():
                token = token.strip()
                if "." in token or ":" in token:
                    entity = token
                    break

        filtered_alerts = alerts
        if entity:
            filtered_alerts = [
                alert
                for alert in alerts
                if entity in str(alert.get("source_ip", ""))
                or entity in str(alert.get("dest_ip", ""))
                or entity in str(alert.get("destination_ip", ""))
                or entity in str(alert.get("query", ""))
                or entity in str(alert.get("host", ""))
                or entity in str(alert.get("destination_domain", ""))
            ] or alerts

        enrichment = enrich_entities_from_alerts(filtered_alerts)
        queries = enrichment.get("news_context_queries", [])
        if req.incident_id:
            queries.insert(0, f"{req.incident_id} cybersecurity incident threat intelligence")
        if req.campaign_id:
            queries.insert(0, f"{req.campaign_id} cyber campaign threat intelligence")
        if entity:
            queries.insert(0, f"{entity} threat intelligence recent campaign")

        reply = (
            "I enriched the available telemetry context and prepared current-news lookups. "
            "Use the news links as verification leads, not attribution by themselves."
        )
        return {
            "status": "ok",
            "reply": reply,
            "entity": entity,
            "matched_alert_count": len(filtered_alerts),
            "enrichment": enrichment,
            "news_links": _news_links(queries),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================================
# AI AGENT TRIGGER
# =====================================================================

@app.post("/agent/run")
async def trigger_agent(req: AgentRequest | None = None, prompt: str | None = None):
    """Trigger the master SOC agent with one helper subagent and full trace visibility."""
    user_prompt = (req.prompt if req else None) or prompt
    result = await run_agent(user_prompt)
    return {
        "status": "ok",
        **result
    }


@app.post("/soc/simulate/run")
async def run_simulated_soc(req: SimulatedRunRequest | None = None):
    """Run the full deterministic backend SOC simulation pipeline for transparent frontend playback."""
    try:
        helper = await run_simulated_ids_pipeline()
        master = await run_master_soc_pipeline(max_llm_incidents=1)
        return {"status": "ok", "helper": helper, "master": master, "prompt": req.prompt if req else ""}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/soc/simulate/start")
async def start_simulated_soc(background_tasks: BackgroundTasks, req: SimulatedRunRequest | None = None):
    """Start simulation in background and return run_id immediately for live dashboard polling."""
    from services.run_trace import create_run, finish_run, set_current_run, reset_current_run, add_event

    prompt = req.prompt if req else "Run full simulated SOC pipeline and produce incident/campaign hypothesis."
    run_id = create_run("Blackgate Simulated SOC Run", prompt)
    _active_runs[run_id] = {"run_id": run_id, "status": "running", "started_at": datetime.now(timezone.utc).isoformat()}

    async def worker():
        import asyncio
        token = set_current_run(run_id)
        try:
            add_event("run.start", "Simulation run started", {"prompt": prompt})
            
            # Start ingestion in the background
            ingestion_task = asyncio.create_task(run_simulated_ids_pipeline())
            
            master_results = []
            
            # Run the agent in a loop while ingestion is running
            while not ingestion_task.done():
                try:
                    master = await run_master_soc_pipeline(max_llm_incidents=0) # Only deterministic clustering during fast-loop
                    master_results.append(master)
                except Exception as e:
                    print(f"[WARN] Agent loop iteration failed: {e}")
                await asyncio.sleep(6.0)
                
            # Wait for ingestion to fully finish
            helper = await ingestion_task
            
            # Final sweep with full LLM enrichment
            master = await run_master_soc_pipeline(max_llm_incidents=1)
            master_results.append(master)
            
            total_incidents = sum(m.get('incident_count', 0) for m in master_results)
            
            add_event("run.complete", "Simulation run finished", {"incident_count": total_incidents})
            finish_run(run_id, "completed", {"helper": helper, "master": master})
            _active_runs[run_id] = {"run_id": run_id, "status": "completed", "output": f"{total_incidents} incidents correlated"}
        except Exception as exc:
            add_event("run.error", "Simulation run failed", {"error": str(exc)})
            finish_run(run_id, "failed", {"error": str(exc)})
            _active_runs[run_id] = {"run_id": run_id, "status": "error", "error": str(exc)}
        finally:
            reset_current_run(token)

    background_tasks.add_task(worker)
    return {"status": "ok", "run_id": run_id}


@app.get("/soc/runs")
def get_soc_runs(limit: int = 20):
    return {"status": "ok", "runs": list_runs(limit=limit)}


@app.get("/soc/runs/{run_id}")
def get_soc_run(run_id: str):
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return {"status": "ok", "run": run}


# =====================================================================
# ENTERPRISE DASHBOARD & SIMULATOR ENDPOINTS
# =====================================================================

@app.get("/simulator/stream")
@app.get("/api/simulator/stream")
async def sse_stream_packets(request: Request, limit: Optional[int] = None, delay_ms: int = 50):
    """SSE endpoint streaming decoded packet metadata from packets.hex"""
    async def event_generator():
        async for packet in stream_packets(delay_ms=delay_ms, limit=limit):
            if await request.is_disconnected():
                break
            yield {"data": json.dumps(packet)}
    return EventSourceResponse(event_generator())


@app.get("/api/incidents")
def api_list_incidents(size: int = 50, severity: Optional[str] = None):
    query = {"match_all": {}} if not severity else {"term": {"risk.keyword": severity}}
    resp = es.search(index=INCIDENT_INDEX, size=size, query=query, sort=[{"created_at": "desc"}], ignore_unavailable=True)
    return {"status": "ok", "incidents": _hits(resp)}


@app.get("/api/incidents/{incident_id}")
def api_get_incident(incident_id: str):
    resp = es.search(index=INCIDENT_INDEX, query={"term": {"incident_id.keyword": incident_id}}, size=1, ignore_unavailable=True)
    hits = _hits(resp)
    if not hits:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"status": "ok", "incident": hits[0]}


@app.get("/api/campaigns")
def api_list_campaigns(size: int = 50):
    resp = es.search(index=CAMPAIGN_INDEX, size=size, sort=[{"campaign.last_seen": "desc"}], ignore_unavailable=True)
    return {"status": "ok", "campaigns": _hits(resp)}


@app.get("/api/campaigns/{campaign_id}")
def api_get_campaign(campaign_id: str):
    resp = es.search(index=CAMPAIGN_INDEX, query={"term": {"campaign.id.keyword": campaign_id}}, size=1, ignore_unavailable=True)
    hits = _hits(resp)
    if not hits:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"status": "ok", "campaign": hits[0]}


@app.get("/api/mitre/techniques")
def api_list_mitre_techniques(size: int = 100):
    resp = es.search(index=MITRE_KNOWLEDGE_INDEX, size=size, sort=[{"last_seen": "desc"}], ignore_unavailable=True)
    return {"status": "ok", "techniques": _hits(resp)}


@app.get("/api/alerts/recent")
def api_recent_alerts(size: int = 100):
    resp = es.search(index=ALERT_INDEX, size=size, sort=[{"timestamp": "desc"}], ignore_unavailable=True)
    return {"status": "ok", "alerts": _hits(resp)}


@app.get("/api/stats/overview")
def api_stats_overview():
    try:
        incidents = es.count(index=INCIDENT_INDEX, ignore_unavailable=True).get("count", 0)
        campaigns = es.count(index=CAMPAIGN_INDEX, ignore_unavailable=True).get("count", 0)
        alerts = es.count(index=ALERT_INDEX, ignore_unavailable=True).get("count", 0)
        
        # Aggregate incident severity
        resp = es.search(index=INCIDENT_INDEX, size=0, aggs={"severities": {"terms": {"field": "risk.keyword"}}}, ignore_unavailable=True)
        severities = {b["key"]: b["doc_count"] for b in resp.get("aggregations", {}).get("severities", {}).get("buckets", [])}
        
        # Find active simulation if any
        active_sim = None
        for run_id, info in list(_active_runs.items()):
            if info.get("status") == "running":
                active_sim = info
                break
            elif info.get("status") in ("completed", "error"):
                active_sim = info  # Return last finished

        return {
            "status": "ok",
            "stats": {
                "total_incidents": incidents,
                "total_campaigns": campaigns,
                "total_alerts": alerts,
                "incident_severities": severities,
                "active_simulation": active_sim,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================================
# AGENT CHAT (Wired to ADK agent for live Q&A)
# =====================================================================

class AgentChatRequest(BaseModel):
    message: str

@app.post("/agent/chat")
async def agent_chat(req: AgentChatRequest):
    """Send a message to the Blackgate ADK agent and return the AI response.
    This is the primary endpoint for the dashboard chat interface."""
    try:
        result = await run_agent(req.message)
        return {
            "status": "ok",
            "run_id": result.get("run_id"),
            "response": result.get("output", "No response from agent."),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================================
# GEO THREAT ORIGINS (Aggregated from real incident data)
# =====================================================================

@app.get("/api/geo/threat-origins")
def api_geo_threat_origins(size: int = 200):
    """Aggregate threat origin countries and incident counts from real ES data for the ThreatMap."""
    try:
        resp = es.search(
            index=INCIDENT_INDEX,
            size=0,
            aggs={
                "by_country": {
                    "terms": {"field": "entities.countries.keyword", "size": 50},
                    "aggs": {
                        "severity_breakdown": {"terms": {"field": "risk.keyword"}},
                        "total_alerts": {"sum": {"field": "alert_count"}},
                        "latest": {"max": {"field": "created_at"}},
                        "sample_ips": {"terms": {"field": "entities.ips.keyword", "size": 5}},
                    }
                }
            },
            ignore_unavailable=True,
        )
        buckets = resp.get("aggregations", {}).get("by_country", {}).get("buckets", [])
        origins = []
        for b in buckets:
            severities = {s["key"]: s["doc_count"] for s in b.get("severity_breakdown", {}).get("buckets", [])}
            origins.append({
                "country": b["key"],
                "incident_count": b["doc_count"],
                "total_alerts": int(b.get("total_alerts", {}).get("value", 0)),
                "severities": severities,
                "last_seen": b.get("latest", {}).get("value_as_string"),
                "sample_ips": [s["key"] for s in b.get("sample_ips", {}).get("buckets", [])],
            })
        return {"status": "ok", "origins": origins}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

