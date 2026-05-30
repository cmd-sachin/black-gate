# backend/services/campaigns.py
import hashlib

def cluster_campaign(mitre_list, ips, domains):
    """
    Deterministically clusters an incident into a campaign.
    Creates a fingerprint based on overlapping MITRE techniques and IPs/Domains.
    """
    techniques = sorted([m["technique_id"] for m in mitre_list])
    sorted_ips = sorted(list(ips))
    
    # Create a simple deterministic clustering hash based on attacker behavior and infrastructure
    cluster_string = f"{'-'.join(techniques)}_{'-'.join(sorted_ips)}"
    cluster_id = hashlib.md5(cluster_string.encode()).hexdigest()[:10]
    
    # Basic confidence scoring: high if we have multiple techniques mapped
    confidence = 0.85 if len(techniques) > 1 else 0.50
    
    return {
        "cluster_id": f"CAMP-{cluster_id.upper()}",
        "confidence": confidence
    }
