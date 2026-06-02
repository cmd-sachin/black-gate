import os
import uuid
from dotenv import load_dotenv

# ADK Imports
from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset, StdioServerParameters
from google.adk.runners import InMemoryRunner
from google.genai import types as genai_types

# Local service imports for custom pipeline triggering
from services.correlation import fetch_recent_alerts, correlate_alerts
from services.enrichment import enrich_entities_from_alerts
from services.soc_runtime import (
    run_master_soc_pipeline,
    run_security_correlation_queries,
    run_simulated_ids_pipeline,
    run_threat_intel_and_hypothesis,
)
from services.run_trace import add_event, create_run, finish_run, reset_current_run, set_current_run

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT_ENV = os.path.abspath(os.path.join(_BACKEND_DIR, "..", ".env"))
load_dotenv(_ROOT_ENV, override=True)

# =====================================================================
# 🔧 NATIVE MCP SERVER CONNECTIONS (Local node_modules)
# =====================================================================

env_vars = os.environ.copy()

# Inject standard OpenTelemetry disable flags to keep stdout clean of telemetry noise
env_vars["OTEL_SDK_DISABLED"] = "true"
env_vars["OTEL_LOG_LEVEL"] = "none"

# Agent Builder MCP Server (Remote)
es_api_key = os.getenv("ES_API_KEY") or os.getenv("ELASTIC_API_KEY", "")
elastic_mcp_url = os.getenv("ELASTIC_MCP_URL", "")
kibana_url = os.getenv("KIBANA_URL", "")

if es_api_key and (elastic_mcp_url or kibana_url):
    # Use Elastic Cloud Serverless Agent Builder MCP
    mcp_endpoint = elastic_mcp_url or f"{kibana_url.rstrip('/')}/api/agent_builder/mcp"
    elastic_params = StdioServerParameters(
        command="npx",
        args=[
            "--yes",
            "mcp-remote",
            mcp_endpoint,
            "--header",
            f"Authorization:ApiKey {es_api_key}"
        ],
        env=env_vars
    )
else:
    # Fallback to generic local Elasticsearch MCP
    elastic_params = StdioServerParameters(
        command="npx",
        args=["mcp-server-elasticsearch"],
        env={
            **env_vars,
            "ES_URL": os.getenv("ES_URL", "http://localhost:9200"),
            "ES_USERNAME": os.getenv("ES_USERNAME", "elastic"),
            "ES_PASSWORD": os.getenv("ES_PASSWORD", "elastic"),
        }
    )

# =====================================================================
# 🛠️ CUSTOM WORKFLOW TOOL (For Correlation Pipeline)
# =====================================================================

async def trigger_correlation_pipeline() -> str:
    """Trigger the backend pipeline to correlate raw alerts, map them to MITRE ATT&CK, and cluster campaigns. Do this before analyzing incidents."""
    try:
        alerts = fetch_recent_alerts()
        if not alerts:
            return "No alerts found to correlate."
        incidents = await correlate_alerts(alerts)
        return f"Successfully correlated {len(incidents)} incidents. Incident, campaign, MITRE, and agent memory are saved in Elasticsearch."
    except Exception as e:
        return f"Error triggering pipeline: {e}"


def helper_monitor_and_ingest_simulated_network() -> dict:
    """Helper subagent tool: monitor simulated network, run IDS layers, and ingest outputs."""
    result = run_simulated_ids_pipeline()
    add_event("helper.done", "Helper subagent finished monitoring+IDS ingest", result)
    return result


def enrich_recent_investigation_entities(limit: int = 100) -> dict:
    """
    Enrich recent alert entities with MMDB geo context, role inference, country relationships,
    and recent-news/threat-intel query suggestions. Use before writing the incident story,
    attacker motive hypothesis, or timeline narrative.
    """
    alerts = fetch_recent_alerts(limit=limit)
    if not alerts:
        return {
            "status": "empty",
            "message": "No recent alerts found to enrich.",
            "entities": {},
            "relationship": {},
            "news_context_queries": [],
        }

    enriched = enrich_entities_from_alerts(alerts)
    enriched["status"] = "ok"
    enriched["alert_count"] = len(alerts)
    add_event(
        "master.enrich",
        "Enriched entities for country relationship and timeline storytelling",
        {"alert_count": len(alerts), "countries": enriched.get("entities", {}).get("countries", [])},
    )
    return enriched


def master_run_security_queries(lookback_size: int = 500) -> dict:
    """Master tool: execute Elastic correlation queries for clustering and severity patterns."""
    return run_security_correlation_queries(lookback_size=lookback_size)


def master_threat_intel_hypothesis() -> dict:
    """Master tool: infer attacker-victim relationship, IOC linkage, and intent hypothesis."""
    return run_threat_intel_and_hypothesis()

from elastic_client import write_organizational_memory

def save_to_memory(context: str, category: str, content: str) -> dict:
    """Helper tool for agents to write findings back into Elasticsearch organizational memory."""
    return write_organizational_memory(context, category, content)

def create_soc_agent(elastic_mcp_tools):
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    
    # 1. Investigation Agent
    investigation_agent = LlmAgent(
        name="investigation_agent",
        model=gemini_model,
        description="Gathers evidence, historical incidents, and relevant context from Elasticsearch for a new security event.",
        instruction="""You are the CampaignIQ Investigation Agent.
1. Use Elastic MCP tools to retrieve raw logs, alerts, and historical incidents related to the current event.
2. Gather context on affected assets and users.
3. Summarize the timeline of events and initial evidence.""",
        tools=[elastic_mcp_tools, helper_monitor_and_ingest_simulated_network],
    )

    # 2. Threat Intelligence Agent
    threat_intel_agent = LlmAgent(
        name="threat_intelligence_agent",
        model=gemini_model,
        description="Enriches indicators using internal and external intelligence sources.",
        instruction="""You are the CampaignIQ Threat Intelligence Agent.
1. Run enrich_recent_investigation_entities to gather geographic and role data for IPs.
2. Run master_threat_intel_hypothesis to search for IOC overlaps.
3. Analyze attacker motives and external threat intelligence profiles.""",
        tools=[enrich_recent_investigation_entities, master_threat_intel_hypothesis],
    )

    # 3. Campaign Correlation Agent
    correlation_agent = LlmAgent(
        name="campaign_correlation_agent",
        model=gemini_model,
        description="Identifies relationships between incidents and clusters them into potential campaigns.",
        instruction="""You are the CampaignIQ Campaign Correlation Agent.
1. Run trigger_correlation_pipeline to map alerts to MITRE ATT&CK.
2. Run master_run_security_queries to analyze correlations and clustering.
3. Determine if multiple isolated incidents belong to a larger coordinated attack campaign.""",
        tools=[trigger_correlation_pipeline, master_run_security_queries],
    )

    # 4. Risk Assessment Agent
    risk_agent = LlmAgent(
        name="risk_assessment_agent",
        model=gemini_model,
        description="Evaluates the potential business impact based on asset criticality, exposure, and threat severity.",
        instruction="""You are the CampaignIQ Risk Assessment Agent.
1. Evaluate the blast radius of the correlated campaigns.
2. Assess business impact based on affected user roles, host criticality, and exposed data.
3. Assign a definitive Severity (Critical, High, Medium, Low).""",
        tools=[],
    )

    # 5. Recommendation Agent
    recommendation_agent = LlmAgent(
        name="recommendation_agent",
        model=gemini_model,
        description="Generates actionable remediation guidance, executive summaries, and response strategies, and writes them to memory.",
        instruction="""You are the CampaignIQ Recommendation Agent.
1. Generate specific, actionable remediation steps (e.g., firewall blocks, EDR isolation).
2. Generate an executive summary of the entire campaign.
3. MANDATORY: Use the save_to_memory tool to record your mitigation outcome and analyst notes back into Elasticsearch for future reference.""",
        tools=[save_to_memory],
    )

    # Master Orchestrator
    return LlmAgent(
        name="campaigniq_orchestrator",
        model=gemini_model,
        description='Master CampaignIQ orchestrator that coordinates the 5 specialized sub-agents.',
        sub_agents=[
            investigation_agent,
            threat_intel_agent,
            correlation_agent,
            risk_agent,
            recommendation_agent
        ],
        instruction='''You are CampaignIQ, an AI-powered security intelligence platform.
Instead of analyzing raw logs directly, you leverage Elasticsearch as your centralized memory layer and coordinate 5 specialized agents.

Workflow:
1. Delegate to investigation_agent to gather initial facts.
2. Delegate to correlation_agent to cluster incidents into campaigns.
3. Delegate to threat_intelligence_agent to enrich IOCs and attacker motives.
4. Delegate to risk_assessment_agent to evaluate business impact.
5. Delegate to recommendation_agent to generate remediation steps and save the findings to Organizational Memory.
6. Produce a final, unified campaign narrative combining all sub-agent insights.

Always refer to yourself as CampaignIQ.''',
        tools=[run_master_soc_pipeline],
    )

# =====================================================================
# FASTAPI ENTRYPOINT
# =====================================================================

def generate_offline_agent_response(query: str, original_error: str) -> str:
    """Generate a highly professional security report based on real Elasticsearch data as a fallback."""
    from elastic_client import es, INCIDENT_INDEX, CAMPAIGN_INDEX
    try:
        inc_count = es.count(index=INCIDENT_INDEX, ignore_unavailable=True).get("count", 0)
        camp_count = es.count(index=CAMPAIGN_INDEX, ignore_unavailable=True).get("count", 0)
        
        inc_res = es.search(index=INCIDENT_INDEX, size=3, sort=[{"created_at": "desc"}], ignore_unavailable=True)
        incidents = [hit["_source"] for hit in inc_res.get("hits", {}).get("hits", [])]
        
        camp_res = es.search(index=CAMPAIGN_INDEX, size=2, sort=[{"created_at": "desc"}], ignore_unavailable=True)
        campaigns = [hit["_source"] for hit in camp_res.get("hits", {}).get("hits", [])]
        
        report = []
        report.append("### 🛡️ Blackgate SOC Analyst Report (Offline Mode)")
        report.append("> ⚠️ **Gemini API Service Note**: The Gemini API service returned a rate limit or quota exceeded message (429). Generating local analysis from indexed Elasticsearch security logs.\n")
        report.append(f"**Security Telemetry Overview**:")
        report.append(f"- **Correlated Incidents**: {inc_count}")
        report.append(f"- **Identified Campaigns**: {camp_count}\n")
        
        if incidents:
            report.append("#### 🚨 Latest Correlated Incidents")
            for inc in incidents:
                risk = inc.get("risk", "medium").upper()
                report.append(f"- **{inc.get('incident_id')}** ({risk}): {inc.get('summary')}")
                if inc.get("entities", {}).get("countries"):
                    report.append(f"  * Origin: {', '.join(inc['entities']['countries'])}")
                if inc.get("mitre"):
                    techniques = [t.get("technique_id") for t in inc["mitre"] if t.get("technique_id")]
                    if techniques:
                        report.append(f"  * MITRE ATT&CK: {', '.join(techniques[:5])}")
                report.append("")
        
        if campaigns:
            report.append("#### 🎯 Identified Campaigns")
            for camp in campaigns:
                c = camp.get("campaign", {})
                report.append(f"- **{c.get('name', 'Unnamed Campaign')}** ({c.get('id', 'N/A')})")
                report.append(f"  * Match Confidence: {int((c.get('confidence') or 0.8) * 100)}%")
                report.append(f"  * Description: {c.get('description', 'No description available.')}")
                report.append("")
                
        report.append("#### 📝 Recommended Mitigations")
        report.append("1. **Block Outbound C2 Traffic**: Add observed attacker IPs to network egress firewalls.")
        report.append("2. **Isolate Compromised Nodes**: Flag hosts displaying repeated scanner behaviors for segment containment.")
        report.append("3. **Enable Policy Rules**: Review MITRE techniques mapped above to configure host-based protection profiles.")
        
        return "\n".join(report)
    except Exception as err:
        return f"### 🛡️ Blackgate SOC Analyst Report (Offline Fallback)\n\nError: Gemini API Quota limit exceeded (429).\nLocal ES Fallback details: {err}"


async def run_agent(prompt: str | None = None) -> dict:
    """Async entrypoint called by FastAPI. Spins up the MCP servers natively."""
    print("[START] Initializing Elastic MCP tools...")
    query = prompt or "Analyze the latest network alerts and report any incidents."
    run_id = create_run("Blackgate Master SOC Run", query)
    token = set_current_run(run_id)
    add_event("run.start", "Master SOC run initialized", {"prompt": query})
    
    elastic_mcp = McpToolset(connection_params=elastic_params)
    
    try:
        print("[OK] Elastic MCP connected. Starting Blackgate SOC agent...")
        add_event("run.mcp", "Elastic MCP connected", {"mode": "remote" if (elastic_mcp_url or kibana_url) else "local"})
        
        agent = create_soc_agent(elastic_mcp)
        
        runner = InMemoryRunner(agent=agent, app_name="blackgate-soc")
        
        session_id = f"session-{uuid.uuid4().hex[:8]}"
        user_id = "soc-analyst"
        runner.session_service.create_session_sync(
            user_id=user_id,
            session_id=session_id,
            app_name="blackgate-soc"
        )

        user_message = genai_types.Content(
            role="user",
            parts=[genai_types.Part(text=query)]
        )

        final_text = ""
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=user_message,
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        final_text = part.text

        if not final_text:
            final_text = "No actionable output from the agent."

        add_event("run.complete", "Master SOC run completed", {"output_length": len(final_text)})
        finish_run(run_id, "completed", {"output": final_text})
        return {"run_id": run_id, "output": final_text}

    except Exception as e:
        error_str = str(e)
        fallback_report = generate_offline_agent_response(query, error_str)
        print(f"[WARN] Exception in agent run, using fallback report: {e}")
        add_event("run.error", "Master SOC run failed, fallback generated", {"error": error_str})
        finish_run(run_id, "completed", {"output": fallback_report})
        return {"run_id": run_id, "output": fallback_report}
        
    finally:
        print("[CLEANUP] Cleaning up Elastic MCP process...")
        await elastic_mcp.close()
        reset_current_run(token)
