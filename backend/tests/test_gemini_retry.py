"""Unit tests for the shared Gemini retry/backoff wrapper.

These exercise the classification + backoff logic in isolation — no network,
no google-genai SDK. ``asyncio.sleep`` is patched to a no-op so the backoff
delays don't slow the suite down.
"""
import asyncio
import os
import sys
from pathlib import Path

import pytest

# Make ``services`` importable without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.gemini_retry import (  # noqa: E402
    _status_code,
    generate_content_with_retry,
    RETRYABLE_CODES,
)


class FakeError(Exception):
    """Stand-in for a google-genai error that carries an HTTP ``code``."""

    def __init__(self, message, code=None):
        super().__init__(message)
        self.code = code


class FakeModels:
    """Records calls and replays a scripted sequence of results/exceptions."""

    def __init__(self, sequence):
        self._sequence = list(sequence)
        self.calls = 0

    async def generate_content(self, **kwargs):
        self.calls += 1
        item = self._sequence.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class FakeClient:
    def __init__(self, sequence):
        self.aio = type("Aio", (), {"models": FakeModels(sequence)})()


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    """Skip real backoff delays."""
    async def _instant(_):
        return None

    monkeypatch.setattr(asyncio, "sleep", _instant)


# --------------------------------------------------------------------------- #
# _status_code classification
# --------------------------------------------------------------------------- #

def test_status_code_from_int_attr():
    assert _status_code(FakeError("boom", code=503)) == 503


def test_status_code_from_numeric_string_attr():
    assert _status_code(FakeError("boom", code="429")) == 429


def test_status_code_parsed_from_message_digits():
    # No .code attribute — must fall back to scanning the message text.
    assert _status_code(Exception("got 503 from upstream")) == 503


def test_status_code_parsed_from_unavailable_text():
    assert _status_code(Exception("The model is UNAVAILABLE, high demand")) == 503


def test_status_code_parsed_from_resource_exhausted_text():
    assert _status_code(Exception("RESOURCE_EXHAUSTED: quota")) == 429


def test_status_code_none_for_unrecognized():
    assert _status_code(Exception("totally unrelated message")) is None


def test_retryable_codes_membership():
    assert {429, 500, 502, 503, 504} == RETRYABLE_CODES


# --------------------------------------------------------------------------- #
# generate_content_with_retry behavior
# --------------------------------------------------------------------------- #

def test_retries_then_succeeds():
    """503 twice, then a successful response → returns the success."""
    client = FakeClient([
        FakeError("overloaded", code=503),
        FakeError("overloaded", code=503),
        "OK",
    ])
    result = asyncio.run(
        generate_content_with_retry(client, max_attempts=4, base_delay=0.0, contents="hi")
    )
    assert result == "OK"
    assert client.aio.models.calls == 3


def test_non_retryable_raises_immediately():
    """A 400 is a real client error → no retries, raised on first attempt."""
    client = FakeClient([
        FakeError("bad request", code=400),
        "OK",  # should never be reached
    ])
    with pytest.raises(FakeError):
        asyncio.run(
            generate_content_with_retry(client, max_attempts=4, base_delay=0.0, contents="hi")
        )
    assert client.aio.models.calls == 1


def test_exhaustion_raises_last_error():
    """All attempts hit 503 → the last exception propagates after max_attempts."""
    client = FakeClient([
        FakeError("overloaded", code=503),
        FakeError("overloaded", code=503),
        FakeError("overloaded", code=503),
    ])
    with pytest.raises(FakeError):
        asyncio.run(
            generate_content_with_retry(client, max_attempts=3, base_delay=0.0, contents="hi")
        )
    assert client.aio.models.calls == 3


def test_message_only_503_is_retried():
    """A 503 expressed only in the message string (no .code) still retries."""
    client = FakeClient([
        Exception("503 UNAVAILABLE: The model is overloaded"),
        "OK",
    ])
    result = asyncio.run(
        generate_content_with_retry(client, max_attempts=3, base_delay=0.0, contents="hi")
    )
    assert result == "OK"
    assert client.aio.models.calls == 2


def test_max_attempts_from_env(monkeypatch):
    """When max_attempts is unset it reads GEMINI_MAX_RETRIES."""
    monkeypatch.setenv("GEMINI_MAX_RETRIES", "2")
    client = FakeClient([
        FakeError("overloaded", code=503),
        FakeError("overloaded", code=503),
    ])
    with pytest.raises(FakeError):
        asyncio.run(
            generate_content_with_retry(client, base_delay=0.0, contents="hi")
        )
    assert client.aio.models.calls == 2
