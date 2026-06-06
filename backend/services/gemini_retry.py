"""Shared retry/backoff wrapper for Gemini generate_content calls.

The Gemini Generative Language API returns transient ``503 UNAVAILABLE`` ("model
is experiencing high demand") and ``429 RESOURCE_EXHAUSTED`` responses under
load. Without retries a single such blip fails an entire correlation or
validation run. This wraps ``client.aio.models.generate_content`` with bounded
exponential backoff (plus jitter) so the pipeline rides out short spikes, while
still surfacing non-retryable errors (400/403/404) immediately so they are not
masked.
"""
from __future__ import annotations

import asyncio
import os
import random
from typing import Any

# HTTP status codes worth retrying — all server-side / load-shedding signals.
RETRYABLE_CODES = {429, 500, 502, 503, 504}


def _status_code(exc: Exception) -> int | None:
    """Best-effort extraction of an HTTP status code from a google-genai error."""
    code = getattr(exc, "code", None)
    if isinstance(code, int):
        return code
    if isinstance(code, str) and code.isdigit():
        return int(code)
    msg = str(exc)
    for c in RETRYABLE_CODES:
        if str(c) in msg:
            return c
    upper = msg.upper()
    if "UNAVAILABLE" in upper or "HIGH DEMAND" in upper or "OVERLOADED" in upper:
        return 503
    if "RESOURCE_EXHAUSTED" in upper:
        return 429
    return None


async def generate_content_with_retry(
    client: Any,
    *,
    max_attempts: int | None = None,
    base_delay: float = 2.0,
    label: str = "gemini",
    **kwargs: Any,
) -> Any:
    """Call ``client.aio.models.generate_content(**kwargs)`` with retry/backoff.

    Retries only on transient server-side codes (``RETRYABLE_CODES``); any other
    error, or exhausting ``max_attempts``, re-raises so the caller's existing
    fallback handling still runs. Backoff is ``base_delay * 2**attempt`` seconds
    plus up to 50% jitter.
    """
    if max_attempts is None:
        max_attempts = max(1, int(os.getenv("GEMINI_MAX_RETRIES", "4")))

    for attempt in range(max_attempts):
        try:
            return await client.aio.models.generate_content(**kwargs)
        except Exception as exc:  # noqa: BLE001 - classify then re-raise
            code = _status_code(exc)
            if code not in RETRYABLE_CODES or attempt == max_attempts - 1:
                raise
            delay = base_delay * (2 ** attempt)
            delay += random.uniform(0, delay * 0.5)  # jitter to avoid thundering herd
            print(
                f"[{label}-retry] attempt {attempt + 1}/{max_attempts} hit {code}; "
                f"retrying in {delay:.1f}s"
            )
            await asyncio.sleep(delay)
