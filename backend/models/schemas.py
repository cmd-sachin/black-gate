from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class ZeekAlert(BaseModel):
    source_ip: str
    dest_ip: Optional[str] = None
    timestamp: datetime
    event_type: str = "zeek"
    query: Optional[str] = None
    host: Optional[str] = None
    uri: Optional[str] = None
    method: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None

class SuricataAlert(BaseModel):
    source_ip: str
    dest_ip: Optional[str] = None
    timestamp: datetime
    alert: str
    severity: Optional[str] = None
    destination_domain: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None