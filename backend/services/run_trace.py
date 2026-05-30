from __future__ import annotations

from contextvars import ContextVar
from datetime import datetime, timezone
from threading import Lock
from typing import Any
import uuid


_current_run_id: ContextVar[str | None] = ContextVar("current_run_id", default=None)
_runs: dict[str, dict[str, Any]] = {}
_lock = Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_run(title: str, prompt: str | None = None) -> str:
    run_id = f"run-{uuid.uuid4().hex[:10]}"
    with _lock:
        _runs[run_id] = {
            "run_id": run_id,
            "title": title,
            "prompt": prompt or "",
            "status": "running",
            "created_at": _now(),
            "updated_at": _now(),
            "events": [],
            "result": None,
        }
    return run_id


def set_current_run(run_id: str):
    return _current_run_id.set(run_id)


def reset_current_run(token):
    _current_run_id.reset(token)


def get_current_run_id() -> str | None:
    return _current_run_id.get()


def add_event(stage: str, detail: str, data: dict[str, Any] | None = None):
    run_id = _current_run_id.get()
    if not run_id:
        return

    with _lock:
        run = _runs.get(run_id)
        if not run:
            return
        run["events"].append(
            {
                "timestamp": _now(),
                "stage": stage,
                "detail": detail,
                "data": data or {},
            }
        )
        run["updated_at"] = _now()


def finish_run(run_id: str, status: str, result: dict[str, Any] | None = None):
    with _lock:
        run = _runs.get(run_id)
        if not run:
            return
        run["status"] = status
        run["result"] = result or {}
        run["updated_at"] = _now()


def get_run(run_id: str) -> dict[str, Any] | None:
    with _lock:
        run = _runs.get(run_id)
        if not run:
            return None
        return dict(run)


def list_runs(limit: int = 20) -> list[dict[str, Any]]:
    with _lock:
        runs = list(_runs.values())
    runs.sort(key=lambda item: item.get("updated_at", ""), reverse=True)
    return [dict(item) for item in runs[:limit]]

