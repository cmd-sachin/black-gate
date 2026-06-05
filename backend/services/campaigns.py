# backend/services/campaigns.py
"""Multi-factor campaign clustering.

A campaign is a set of incidents that share an adversary. Rather than minting a
per-incident fingerprint (which can never link two incidents together), this
module scores an incoming incident against the campaigns already stored in
Elasticsearch across several independent signals:

    * entity / infrastructure overlap (IPs + domains)
    * MITRE ATT&CK technique overlap
    * detection-signature overlap
    * temporal proximity
    * semantic / embedding similarity (reserved hook — not yet produced)

If the best-matching campaign clears ``MERGE_THRESHOLD`` the incident folds into
that campaign and inherits its id; otherwise a new deterministic campaign id is
minted. All Elasticsearch access is best-effort: if the index is missing, ES is
unreachable, or the in-memory mock is in use, scoring degrades to "no
candidates" and the incident simply starts a fresh campaign.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Iterable

from elastic_client import es

CAMPAIGN_INDEX = "blackgate.campaigns"

# Per-factor weights. They sum to 1.0 when every factor is available. When a
# factor cannot be computed (e.g. embeddings are not produced yet, or neither
# side has signatures) its weight is dropped and the score is renormalised over
# the factors that were present — so a missing signal never deflates the match.
WEIGHTS = {
    "entity": 0.25,     # IP + domain overlap (infrastructure)
    "mitre": 0.25,      # MITRE technique overlap (behaviour)
    "signature": 0.15,  # detection-signature overlap
    "temporal": 0.15,   # time proximity
    "semantic": 0.20,   # embedding similarity (reserved)
}

# Blended score at or above which an incident is folded into an existing campaign.
MERGE_THRESHOLD = 0.45
# Hours after which temporal proximity has fully decayed to 0.
TEMPORAL_WINDOW_HOURS = 72.0
# How many recent campaigns to score the incident against.
CANDIDATE_LIMIT = 50


def _norm_set(values: Iterable[Any]) -> set[str]:
    """Lower-cased, stripped, non-empty string set."""
    out: set[str] = set()
    for v in values or []:
        if v in (None, ""):
            continue
        s = str(v).strip().lower()
        if s:
            out.add(s)
    return out


def _jaccard(a: set[str], b: set[str]) -> float:
    union = a | b
    return len(a & b) / len(union) if union else 0.0


def _parse_iso(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _temporal_score(last_seen: Any, now: datetime) -> float | None:
    seen = _parse_iso(last_seen)
    if not seen:
        return None
    delta_h = abs((now - seen).total_seconds()) / 3600.0
    if delta_h >= TEMPORAL_WINDOW_HOURS:
        return 0.0
    return 1.0 - (delta_h / TEMPORAL_WINDOW_HOURS)


def _infra_from_entities(entities: dict[str, Any]) -> set[str]:
    entities = entities or {}
    return _norm_set(list(entities.get("ips", []))) | _norm_set(list(entities.get("domains", [])))


def _fetch_candidate_campaigns() -> list[dict[str, Any]]:
    """Recent campaigns to score against. Best-effort; returns [] on any failure."""
    # Try sorted-by-recency first; retry unsorted if last_seen isn't a sortable field.
    for extra in ({"sort": [{"campaign.last_seen": {"order": "desc"}}]}, {}):
        try:
            resp = es.search(
                index=CAMPAIGN_INDEX,
                size=CANDIDATE_LIMIT,
                query={"match_all": {}},
                ignore_unavailable=True,
                **extra,
            )
            hits = (resp or {}).get("hits", {}).get("hits", [])
            return [h.get("_source", {}) for h in hits if h.get("_source")]
        except Exception:
            continue
    return []


def _score_against(
    candidate: dict[str, Any],
    techniques: set[str],
    infra: set[str],
    signatures: set[str],
    now: datetime,
) -> float:
    camp = candidate.get("campaign", {}) or {}
    cand_tech = _norm_set(camp.get("techniques", []))
    cand_infra = _norm_set(camp.get("infrastructure", [])) or _infra_from_entities(candidate.get("entities", {}))
    cand_sig = _norm_set(camp.get("signatures", []))

    # None => factor not computable on this pair, so it is excluded from the blend.
    factors: dict[str, float | None] = {
        "entity": _jaccard(infra, cand_infra) if (infra or cand_infra) else None,
        "mitre": _jaccard(techniques, cand_tech) if (techniques or cand_tech) else None,
        "signature": _jaccard(signatures, cand_sig) if (signatures or cand_sig) else None,
        "temporal": _temporal_score(camp.get("last_seen"), now),
        "semantic": None,  # embeddings not produced yet — reserved hook.
    }

    acc = 0.0
    total_w = 0.0
    for key, val in factors.items():
        if val is None:
            continue
        acc += WEIGHTS[key] * val
        total_w += WEIGHTS[key]
    return acc / total_w if total_w else 0.0


def _new_cluster_id(techniques: set[str], infra: set[str]) -> str:
    basis = "-".join(sorted(techniques)) + "_" + "-".join(sorted(infra))
    digest = hashlib.md5(basis.encode()).hexdigest()[:10]
    return f"CAMP-{digest.upper()}"


def cluster_campaign(
    mitre_list: list[dict[str, Any]],
    ips: Iterable[str],
    domains: Iterable[str],
    signatures: Iterable[str] | None = None,
    last_seen: Any = None,
) -> dict[str, Any]:
    """Cluster an incident into a new or existing campaign via multi-factor scoring.

    Returns a dict carrying the resolved ``cluster_id`` and ``confidence`` (kept
    for backward compatibility) plus the feature sets used for scoring so the
    caller can persist them on the campaign for future matches.
    """
    techniques = _norm_set(m.get("technique_id") for m in (mitre_list or []))
    infra = _norm_set(list(ips or [])) | _norm_set(list(domains or []))
    sigs = _norm_set(signatures or [])
    now = _parse_iso(last_seen) or datetime.now(timezone.utc)

    best_id: str | None = None
    best_score = 0.0
    for candidate in _fetch_candidate_campaigns():
        cid = (candidate.get("campaign") or {}).get("id")
        if not cid:
            continue
        score = _score_against(candidate, techniques, infra, sigs, now)
        if score > best_score:
            best_score, best_id = score, cid

    feature_payload = {
        "match_score": round(best_score, 3),
        "techniques": sorted(techniques),
        "signatures": sorted(sigs),
        "infrastructure": sorted(infra),
    }

    if best_id and best_score >= MERGE_THRESHOLD:
        # Fold into the existing campaign; confidence scales with match strength.
        return {
            "cluster_id": best_id,
            "confidence": round(min(0.99, 0.55 + 0.45 * best_score), 2),
            "is_new": False,
            **feature_payload,
        }

    # No sufficiently similar campaign — mint a fresh, deterministic id.
    return {
        "cluster_id": _new_cluster_id(techniques, infra),
        "confidence": 0.85 if len(techniques) > 1 else 0.55,
        "is_new": True,
        **feature_payload,
    }
