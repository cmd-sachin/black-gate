import os
from elasticsearch import Elasticsearch
from dotenv import load_dotenv

# Always load project-level .env (repo root), regardless of launch directory.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT_ENV = os.path.abspath(os.path.join(_BACKEND_DIR, "..", ".env"))
load_dotenv(_ROOT_ENV, override=True)

ES_URL = os.getenv("ES_URL") or os.getenv("ELASTIC_CLOUD_URL", "http://localhost:9200")
ES_API_KEY = os.getenv("ES_API_KEY") or os.getenv("ELASTIC_API_KEY")

if ES_API_KEY:
    # Elastic Cloud Serverless API Key Authentication
    es = Elasticsearch(ES_URL, api_key=ES_API_KEY)
else:
    # Fallback to local basic auth
    es = Elasticsearch(ES_URL, basic_auth=(os.getenv("ES_USERNAME", "elastic"), os.getenv("ES_PASSWORD", "elastic")))

ALERT_INDEX = "security-alerts"
INCIDENT_INDEX = "security-incidents"
MEMORY_INDEX = "agent-memory"
CAMPAIGN_INDEX = "blackgate.campaigns"
MITRE_KNOWLEDGE_INDEX = "blackgate.mitre_knowledge"
AGENT_MEMORY_INDEX = "blackgate.agent_memory"
