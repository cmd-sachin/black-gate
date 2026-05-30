# Rapid SOC Agent (Elastic Track)
> Submitted for the Google Cloud Rapid Agent Hackathon

**Rapid SOC Agent** is an autonomous AI SOC analyst designed to slash Mean-Time-To-Detect (MTTD). It correlates raw network telemetry with Elastic Security alerts, maps behavior to MITRE ATT&CK, clusters incidents into campaigns, and generates actionable incident reports.

## 🏆 Hackathon Compliance & Technologies

- **Google Cloud Agent Builder / ADK**: The orchestration layer for one focused Gemini SOC agent.
- **Elastic Security Serverless (GCP Region)**: The security source of truth for alerts, incidents, campaigns, MITRE knowledge, and long-term agent memory.
- **Elastic Agent / Agentless Integrations**: The telemetry collection layer that sends endpoint, network, cloud, or SaaS events into Elastic Security.
- **Elastic Agent Builder (MCP Server)**: Exposes Elastic search, ES|QL, Attack Discovery-style workflows, and memory tools directly to Gemini.
- **Google Cloud Run**: Serverless, scale-to-zero container hosting for our Next.js dashboard and FastAPI telemetry ingestion endpoints.

## Agent Model

Blackgate uses one Gemini reasoning agent: `soc_orchestrator`.

Elastic Agent is a separate Elastic data collector, not another Gemini reasoning agent. The unpacked `backend/elastic-agent-9.4.1-darwin-aarch64` folder is a local Elastic Agent distribution for enrollment/testing; the backend does not execute it directly. In production or demo mode, Elastic Agent should be enrolled through Fleet, or replaced with Elastic agentless integrations where supported.

## 🚀 The Pipeline Architecture

1. **Telemetry Ingestion**: Raw packet captures (`.hex` or `.pcap`) are dropped into Google Cloud Storage.
2. **Event-Driven Analysis**: Eventarc triggers Cloud Run, parsing packets through **Zeek** (protocol decoders) and **Suricata** (signature engine).
3. **Elastic Context Layer**: The output logs and alerts are pushed into Elastic Cloud Serverless.
4. **Agentic Reasoning**: When an analyst queries the Rapid SOC Agent, it uses Elastic MCP tools to:
   - Perform Semantic Search across alerts.
   - Execute complex **ES|QL** joins (e.g., correlating DNS requests with malicious HTTP payloads).
   - Write structured Incident Reports back to Elastic via Workflow Tools.

## 🛠️ Elastic MCP Tools Implemented

We defined the following custom tools in our Elastic Agent Builder UI, which are exposed to our Google Cloud Agent via MCP:

- `search_security_alerts`: Semantic and hybrid search over incoming telemetry.
- `correlate_dns_to_alerts`: ES|QL tool that identifies internal hosts making DNS requests to domains that immediately trigger Suricata alerts.
- `save_incident_report`: Workflow tool that saves Gemini's final analysis into the `security-incidents` index.

## 💻 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+
- Google Cloud CLI (`gcloud`)
- Elastic Cloud Serverless Project

### Setup

1. **Clone & Install**
   ```bash
   git clone https://github.com/your-username/rapid-soc-agent.git
   cd rapid-soc-agent
   python -m venv venv
   source venv/bin/activate
   pip install -r backend/requirements.txt
   ```

2. **Configure Environment**
   Copy `.env.example` to `.env` and fill in your GCP and Elastic credentials:
   ```bash
   cp .env.example .env
   ```

3. **Run the Ingestion Pipeline**
   ```bash
   # Convert sample hex trace to pcap and ingest
   python backend/pipeline/convert_hex_to_pcap.py data/sample/packets.hex data/sample/packets.pcap
   python backend/pipeline/ingest_elastic.py
   ```

4. **Launch the Dashboard**
   ```bash
   cd frontend
   npm run dev
   ```

## 📜 License
MIT License. See `LICENSE` for more information.
