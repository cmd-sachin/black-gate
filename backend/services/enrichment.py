# backend/services/enrichment.py
import geoip2.database
import geoip2.errors
import ipaddress
import os
from collections import Counter, defaultdict

# Path to the extracted MMDB
MMDB_PATH = os.path.join(
    os.path.dirname(__file__), 
    "../../data/GeoLite2-City_20260526/GeoLite2-City.mmdb"
)

def _get_path(doc, path):
    current = doc
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _first_value(doc, *paths):
    for path in paths:
        value = _get_path(doc, path) if "." in path else doc.get(path)
        if isinstance(value, list):
            value = value[0] if value else None
        if value:
            return value
    return None


def _is_private_ip(ip):
    try:
        parsed = ipaddress.ip_address(ip)
        return parsed.is_private or parsed.is_loopback or parsed.is_link_local
    except ValueError:
        return False


def _safe_city_lookup(reader, ip):
    try:
        response = reader.city(ip)
        location = {}
        if response.location.latitude is not None and response.location.longitude is not None:
            location = {
                "lat": response.location.latitude,
                "lon": response.location.longitude,
            }

        return {
            "country_iso_code": response.country.iso_code,
            "country_name": response.country.name,
            "city_name": response.city.name,
            "continent_name": response.continent.name,
            "timezone": response.location.time_zone,
            "location": location,
        }
    except geoip2.errors.AddressNotFoundError:
        return {}
    except Exception as e:
        print(f"Error reading GeoIP for {ip}: {e}")
        return {}


def _extract_entities_from_alerts(alerts):
    ips = set()
    domains = set()
    ip_roles = defaultdict(Counter)

    for alert in alerts or []:
        source_ip = _first_value(alert, "source_ip", "source.ip", "host.ip")
        destination_ip = _first_value(alert, "destination_ip", "dest_ip", "destination.ip")

        if source_ip:
            ips.add(source_ip)
            ip_roles[source_ip]["source"] += 1
            if _is_private_ip(source_ip):
                ip_roles[source_ip]["victim_internal"] += 1
            else:
                ip_roles[source_ip]["attacker_or_external_source"] += 1

        if destination_ip:
            ips.add(destination_ip)
            ip_roles[destination_ip]["destination"] += 1
            if _is_private_ip(destination_ip):
                ip_roles[destination_ip]["victim_internal"] += 1
            else:
                ip_roles[destination_ip]["external_service_or_c2"] += 1

        for domain in (
            _first_value(alert, "query", "dns.question.name"),
            _first_value(alert, "host", "url.domain"),
            _first_value(alert, "destination_domain", "destination.domain"),
        ):
            if domain:
                domains.add(domain)

    return ips, domains, ip_roles


def _dominant_role(role_counts, is_private):
    if not role_counts:
        return "victim_internal" if is_private else "unknown"

    priority = [
        "victim_internal",
        "attacker_or_external_source",
        "external_service_or_c2",
        "source",
        "destination",
    ]
    for role in priority:
        if role_counts.get(role):
            return role
    return role_counts.most_common(1)[0][0]


def enrich_entities(ips=None, domains=None, alerts=None):
    """
    Enriches investigation entities for agent reasoning and frontend storytelling.
    Uses local MaxMind GeoLite2 City MMDB for IP geo context.
    """
    alert_ips, alert_domains, ip_roles = _extract_entities_from_alerts(alerts or [])
    all_ips = set(ips or []) | alert_ips
    all_domains = set(domains or []) | alert_domains

    enriched_ips = []
    attacker_countries = set()
    victim_countries = set()
    external_countries = set()

    if not os.path.exists(MMDB_PATH):
        print(f"⚠️ GeoLite2 MMDB not found at: {MMDB_PATH}")
        reader = None
    else:
        try:
            reader = geoip2.database.Reader(MMDB_PATH)
        except Exception as e:
            print(f"⚠️ Failed to load GeoIP database: {e}")
            reader = None

    try:
        for ip in sorted(all_ips):
            is_private = _is_private_ip(ip)
            role_counts = ip_roles.get(ip, Counter())
            role = _dominant_role(role_counts, is_private)

            geo = {} if is_private or reader is None else _safe_city_lookup(reader, ip)
            country = geo.get("country_name")

            if country:
                external_countries.add(country)
                if "attacker" in role or "external" in role:
                    attacker_countries.add(country)
                if "victim" in role:
                    victim_countries.add(country)

            enriched_ips.append(
                {
                    "ip": ip,
                    "role": role,
                    "is_private": is_private,
                    "activity": dict(role_counts),
                    "geo": geo,
                }
            )
    finally:
        if reader:
            reader.close()

    domain_entities = [
        {
            "domain": domain,
            "role": "queried_domain_or_external_infrastructure",
        }
        for domain in sorted(all_domains)
    ]

    relationship_summary = "No public geo relationship could be established from MMDB."
    if attacker_countries:
        relationship_summary = (
            "External infrastructure appears in "
            + ", ".join(sorted(attacker_countries))
            + ". Treat country-level motive as hypothesis only unless supported by threat intel or recent news evidence."
        )
    elif external_countries:
        relationship_summary = (
            "Public infrastructure appears in "
            + ", ".join(sorted(external_countries))
            + ". This is infrastructure context, not attribution."
        )

    news_queries = []
    for country in sorted(attacker_countries or external_countries):
        news_queries.extend(
            [
                f"recent cyber attacks attributed to infrastructure in {country}",
                f"{country} threat actor campaigns recent cybersecurity news",
            ]
        )
    for domain in sorted(all_domains)[:5]:
        news_queries.append(f"{domain} threat intelligence recent campaign")

    return {
        "entities": {
            "ips": enriched_ips,
            "domains": domain_entities,
            "countries": sorted(external_countries),
            "attacker_countries": sorted(attacker_countries),
            "victim_countries": sorted(victim_countries),
        },
        "relationship": {
            "cross_border": bool(attacker_countries),
            "summary": relationship_summary,
            "motive_caution": "Do not infer geopolitical motive from IP geolocation alone. Use this as context, then verify with Elastic evidence and grounded recent-news/threat-intel sources.",
        },
        "news_context_queries": news_queries[:12],
    }


def enrich_entities_from_alerts(alerts):
    return enrich_entities(alerts=alerts)


def enrich_ips(ips):
    """
    Backward-compatible helper returning only country names.
    """
    enriched = enrich_entities(ips=ips)
    return enriched["entities"]["countries"]


def enrich_alert_documents(docs: list[dict]) -> list[dict]:
    """
    Enrich a batch of alert documents in-place with GeoIP fields before ES ingestion.
    Adds `source.geo`, `destination.geo`, and `enrichment` fields to each document.
    """
    # Collect all unique IPs
    ip_geo_cache: dict[str, dict] = {}
    all_ips: set[str] = set()
    for doc in docs:
        for field in ("source_ip", "dest_ip"):
            ip = doc.get(field)
            if ip and not _is_private_ip(ip):
                all_ips.add(ip)

    # Batch GeoIP lookup
    if all_ips and os.path.exists(MMDB_PATH):
        try:
            reader = geoip2.database.Reader(MMDB_PATH)
            for ip in all_ips:
                ip_geo_cache[ip] = _safe_city_lookup(reader, ip)
            reader.close()
        except Exception as e:
            print(f"⚠️ Batch GeoIP enrichment failed: {e}")

    # Attach geo to each document
    for doc in docs:
        src_ip = doc.get("source_ip")
        dst_ip = doc.get("dest_ip")

        src_geo = ip_geo_cache.get(src_ip, {}) if src_ip else {}
        dst_geo = ip_geo_cache.get(dst_ip, {}) if dst_ip else {}

        if src_geo:
            source = doc.get("source", {})
            source["geo"] = src_geo
            doc["source"] = source

        if dst_geo:
            dest = doc.get("destination", {})
            dest["geo"] = dst_geo
            doc["destination"] = dest

        countries = set()
        if src_geo.get("country_name"):
            countries.add(src_geo["country_name"])
        if dst_geo.get("country_name"):
            countries.add(dst_geo["country_name"])

        src_private = _is_private_ip(src_ip) if src_ip else True
        dst_private = _is_private_ip(dst_ip) if dst_ip else True

        doc["enrichment"] = {
            "source_role": "victim_internal" if src_private else "external_source",
            "destination_role": "victim_internal" if dst_private else "external_target",
            "countries": sorted(countries),
            "enriched": True,
        }

    return docs

