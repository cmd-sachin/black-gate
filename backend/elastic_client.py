import os
from elasticsearch import Elasticsearch
from dotenv import load_dotenv

# Always load project-level .env (repo root), regardless of launch directory.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT_ENV = os.path.abspath(os.path.join(_BACKEND_DIR, "..", ".env"))
load_dotenv(_ROOT_ENV, override=True)

ES_URL = os.getenv("ES_URL") or os.getenv("ELASTIC_CLOUD_URL", "http://localhost:9200")
ES_API_KEY = os.getenv("ES_API_KEY") or os.getenv("ELASTIC_API_KEY")

class MockElasticsearch:
    def __init__(self):
        self._store = {}
        print("[INFO] Initialized In-Memory MockElasticsearch")

    def ping(self):
        return True

    def index(self, index, document, **kwargs):
        if index not in self._store:
            self._store[index] = []
        import uuid
        doc_id = uuid.uuid4().hex[:8]
        stored_doc = {"_id": doc_id, "_source": document}
        self._store[index].append(stored_doc)
        return {"_id": doc_id, "result": "created"}

    def update(self, index, id, upsert=None, **kwargs):
        if index not in self._store:
            self._store[index] = []
        
        # Check if exists
        doc = None
        for d in self._store[index]:
            if d.get("_id") == id:
                doc = d
                break
                
        if doc is None:
            # Upsert
            stored_doc = {"_id": id, "_source": upsert or {}}
            self._store[index].append(stored_doc)
        else:
            # simple mock merge
            doc["_source"].update(kwargs.get("document", {}))
            
        return {"_id": id, "result": "updated" if doc else "created"}

    def search(self, index, size=10, query=None, **kwargs):
        hits = self._store.get(index, [])
        # Return recent ones first
        hits = list(reversed(hits))
        return {
            "hits": {
                "total": {"value": len(hits), "relation": "eq"},
                "hits": hits[:size]
            },
            "aggregations": {
                "by_source_ip": {"buckets": [{"key": "192.168.1.50", "doc_count": len(hits)}]},
                "by_signature": {"buckets": [{"key": "ET MALWARE Active C2", "doc_count": len(hits)}]},
                "by_destination_domain": {"buckets": [{"key": "malicious-c2.com", "doc_count": len(hits)}]},
                "by_severity": {"buckets": [{"key": "3", "doc_count": len(hits)}]},
                "severities": {"buckets": [{"key": "high", "doc_count": len(hits)}]},
                "by_country": {
                    "buckets": [
                        {
                            "key": "United States",
                            "doc_count": len(hits),
                            "severity_breakdown": {"buckets": [{"key": "high", "doc_count": len(hits)}]},
                            "total_alerts": {"value": len(hits)},
                            "latest": {"value_as_string": "2026-05-30T12:00:00Z"},
                            "sample_ips": {"buckets": [{"key": "8.8.8.8", "doc_count": 1}]}
                        }
                    ]
                }
            }
        }

    def count(self, index, **kwargs):
        hits = self._store.get(index, [])
        return {"count": len(hits)}

es_connected = False
if ES_API_KEY:
    # Elastic Cloud Serverless API Key Authentication
    es_client = Elasticsearch(ES_URL, api_key=ES_API_KEY)
else:
    # Fallback to local basic auth
    es_client = Elasticsearch(ES_URL, basic_auth=(os.getenv("ES_USERNAME", "elastic"), os.getenv("ES_PASSWORD", "elastic")))

try:
    if es_client.ping():
        es_connected = True
        es = es_client
        print("[OK] Connected to Elasticsearch")
except Exception as e:
    pass

if not es_connected:
    es = MockElasticsearch()

ALERT_INDEX = "security-alerts"
INCIDENT_INDEX = "security-incidents"
CAMPAIGN_INDEX = "blackgate.campaigns"
MITRE_KNOWLEDGE_INDEX = "blackgate.mitre_knowledge"
# Single agent-memory index for both pipeline incident summaries
# (services.elastic_memory) and organizational notes (write_organizational_memory).
AGENT_MEMORY_INDEX = "blackgate.agent_memory"

def write_organizational_memory(context: str, category: str, content: str) -> dict:
    """
    Writes findings, analyst notes, or remediation outcomes into Elasticsearch
    to build the organizational security memory for CampaignIQ.
    """
    import datetime
    import uuid
    doc_id = uuid.uuid4().hex
    document = {
        "context": context,
        "category": category,
        "content": content,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    try:
        res = es.index(index=AGENT_MEMORY_INDEX, id=doc_id, document=document)
        return {"status": "success", "id": doc_id, "result": res.get("result")}
    except Exception as e:
        return {"status": "error", "message": str(e)}
