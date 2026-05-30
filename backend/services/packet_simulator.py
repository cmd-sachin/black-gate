"""
Packet simulator — reads packets.hex, decodes Ethernet/ARP/IPv4 frames,
and yields structured packet metadata for SSE streaming to the frontend.
"""

import asyncio
import binascii
import os
import struct
from datetime import datetime, timezone
from typing import AsyncGenerator, Generator


def _decode_mac(raw: bytes) -> str:
    return ":".join(f"{b:02x}" for b in raw)


def _decode_ipv4(raw: bytes) -> str:
    return ".".join(str(b) for b in raw)


ETHERTYPE_MAP = {0x0800: "IPv4", 0x0806: "ARP", 0x86DD: "IPv6", 0x8100: "VLAN"}
IP_PROTO_MAP = {1: "ICMP", 6: "TCP", 17: "UDP", 47: "GRE", 50: "ESP"}


def decode_packet(hex_data: str, index: int, timestamp: str) -> dict:
    """Decode a hex-encoded Ethernet frame into structured metadata."""
    try:
        raw = binascii.unhexlify(hex_data)
    except Exception:
        return {"error": "Invalid hex", "index": index}

    if len(raw) < 14:
        return {"error": "Frame too short", "index": index, "length": len(raw)}

    dst_mac = _decode_mac(raw[0:6])
    src_mac = _decode_mac(raw[6:12])
    ethertype = struct.unpack("!H", raw[12:14])[0]

    pkt: dict = {
        "index": index,
        "timestamp": timestamp,
        "length": len(raw),
        "dst_mac": dst_mac,
        "src_mac": src_mac,
        "ethertype": ETHERTYPE_MAP.get(ethertype, f"0x{ethertype:04x}"),
        "protocol": "Ethernet",
        "hex_preview": hex_data[:80],
    }

    # ARP
    if ethertype == 0x0806 and len(raw) >= 42:
        opcode = struct.unpack("!H", raw[20:22])[0]
        pkt.update(
            protocol="ARP",
            arp_opcode="Request" if opcode == 1 else "Reply" if opcode == 2 else str(opcode),
            src_ip=_decode_ipv4(raw[28:32]),
            dst_ip=_decode_ipv4(raw[38:42]),
        )

    # IPv4
    elif ethertype == 0x0800 and len(raw) >= 34:
        ihl = (raw[14] & 0x0F) * 4
        ip_proto = raw[23]
        pkt.update(
            protocol=IP_PROTO_MAP.get(ip_proto, f"IP({ip_proto})"),
            src_ip=_decode_ipv4(raw[26:30]),
            dst_ip=_decode_ipv4(raw[30:34]),
            ttl=raw[22],
            ip_total_length=struct.unpack("!H", raw[16:18])[0],
        )
        # TCP / UDP ports
        if ip_proto in (6, 17) and len(raw) >= 14 + ihl + 4:
            pkt["src_port"] = struct.unpack("!H", raw[14 + ihl : 14 + ihl + 2])[0]
            pkt["dst_port"] = struct.unpack("!H", raw[14 + ihl + 2 : 14 + ihl + 4])[0]

    return pkt


def _default_hex_path() -> str:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(os.path.dirname(backend_dir), "data/sample/packets.hex")


def read_packets(hex_path: str | None = None, limit: int | None = None) -> Generator[dict, None, None]:
    """Synchronous generator yielding decoded packets."""
    path = hex_path or _default_hex_path()
    if not os.path.exists(path):
        return

    base_ts = 1777632000  # 2026-05-01 10:00:00 UTC
    ts_usec = 0

    with open(path, "r") as f:
        for idx, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 2:
                continue

            ts_usec += 10000
            if ts_usec >= 1_000_000:
                base_ts += 1
                ts_usec %= 1_000_000

            ts = datetime.fromtimestamp(base_ts + ts_usec / 1_000_000, timezone.utc).isoformat()
            yield decode_packet(parts[1], idx, ts)

            if limit and idx + 1 >= limit:
                break


async def stream_packets(
    hex_path: str | None = None,
    delay_ms: int = 50,
    limit: int | None = None,
    batch_size: int = 1,
) -> AsyncGenerator[dict, None]:
    """Async generator for SSE streaming with configurable delay."""
    batch: list[dict] = []
    for packet in read_packets(hex_path, limit=limit):
        batch.append(packet)
        if len(batch) >= batch_size:
            for p in batch:
                yield p
            batch = []
            await asyncio.sleep(delay_ms / 1000.0)
    for p in batch:
        yield p


def get_packet_stats(hex_path: str | None = None) -> dict:
    """Aggregate statistics about the packet capture."""
    protocols: dict[str, int] = {}
    unique_ips: set[str] = set()
    unique_macs: set[str] = set()
    total = 0

    for pkt in read_packets(hex_path):
        total += 1
        proto = pkt.get("protocol", "Unknown")
        protocols[proto] = protocols.get(proto, 0) + 1
        for field in ("src_ip", "dst_ip"):
            if pkt.get(field):
                unique_ips.add(pkt[field])
        for field in ("src_mac", "dst_mac"):
            if pkt.get(field):
                unique_macs.add(pkt[field])

    return {
        "total_packets": total,
        "protocols": protocols,
        "unique_ips": sorted(unique_ips),
        "unique_macs": sorted(unique_macs),
    }
