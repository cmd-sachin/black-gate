# Elastic Agent Builder Integration

This is the hackathon integration path for Blackgate.

## What We Are Using

Use these Elastic capabilities from the Devpost resource page:

1. Elastic Cloud Serverless as the managed Elasticsearch project.
2. Agent Builder as the MCP tool layer for Gemini.
3. Built-in and custom search tools for contextual retrieval.
4. ES|QL-backed tools for incident clustering and timeline analysis.
5. Workflow/write tools for saving incidents, campaigns, MITRE mappings, and agent memory back into Elasticsearch.
6. Elasticsearch as the long-term memory layer.

Elastic Agent is separate from Agent Builder. Elastic Agent/Fleet collects telemetry. Agent Builder exposes tools over MCP.

## Required Elastic Setup

1. Create an Elastic Cloud Serverless Elasticsearch project in a Google Cloud region.
2. Open Kibana for that project.
3. Enable Agent Builder.
4. Create an Elasticsearch API key with read/write access to Blackgate indices and read access to Elastic Security alerts.
5. Copy the MCP server endpoint from Kibana > Agent Builder > Tools.
6. Set these environment variables:

```bash
ES_URL="https://your-project.es.region.gcp.elastic-cloud.com"
ES_API_KEY="your-elasticsearch-api-key"
ELASTIC_MCP_URL="https://your-agent-builder-mcp-endpoint/api/agent_builder/mcp"
GEMINI_API_KEY="your-gemini-api-key"
```

## Data Model

Use these indices for the MVP:

- `security-alerts`: local/demo Zeek and Suricata alerts.
- `.alerts-security.alerts-*`: Elastic Security alerts.
- `security-incidents`: generated incident reports.
- `blackgate.campaigns`: campaign memory.
- `blackgate.mitre_knowledge`: MITRE ATT&CK knowledge and observed technique memory.
- `blackgate.agent_memory`: long-term agent memory.

## Agent Builder Tools To Create

Create the tools in [elastic_agent_builder_tools.json](/Users/sachin/Desktop/black-gate/docs/elastic_agent_builder_tools.json).

Minimum winning set:

1. `enrich_investigation_entities`
   - Enriches IP/domain entities with MMDB geo context, inferred roles, country relationship summary, and recent-news/threat-intel query leads.

2. `search_security_context`
   - Hybrid search over alerts, incidents, campaigns, MITRE knowledge, and memory.

3. `timeline_by_entity`
   - ES|QL timeline for an IP/domain/host/user.

4. `cluster_incident_candidates`
   - ES|QL aggregation for likely incident clusters.

5. `mitre_from_elastic_security`
   - Pulls ATT&CK techniques from Elastic Security alert/rule metadata.

6. `campaign_memory_lookup`
   - Finds similar campaigns by infrastructure and ATT&CK overlap.

7. `save_blackgate_investigation`
   - Workflow/write tool that persists the final investigation to Elasticsearch.

## Google Agent Builder / ADK Connection

The backend now supports two modes:

1. Preferred hackathon mode:
   - `ELASTIC_MCP_URL` + `ES_API_KEY`
   - Uses Elastic Agent Builder MCP directly.
   - Requires the Node package `mcp-remote`, declared in `backend/package.json`.

2. Local fallback:
   - `ES_URL` + `ES_USERNAME` + `ES_PASSWORD`
   - Uses the local Elasticsearch MCP package.

The runtime is intentionally one Gemini reasoning agent: `soc_orchestrator`.

## Demo Script

Use this story for the 3-minute video:

1. Show Elastic Serverless and Agent Builder tools.
2. Upload or ingest sample Zeek/Suricata telemetry.
3. Ask Blackgate: "Investigate the latest suspicious activity. Cluster incidents, identify campaigns, and map MITRE ATT&CK."
4. Blackgate triggers correlation.
5. Blackgate queries Elastic through MCP.
6. Show incident cluster, timeline, MITRE techniques, campaign hypothesis, confidence, and evidence.
7. Show the result written back into Elasticsearch memory.

The key judging sentence:

"Blackgate uses Elastic Agent Builder MCP as the agent's operational tool layer and Elasticsearch as persistent security memory, while Gemini performs analyst reasoning over Elastic Security evidence."
