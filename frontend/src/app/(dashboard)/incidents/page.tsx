"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, ArrowRight, Activity, MapPin } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/incidents`)
      .then(res => res.json())
      .then(data => {
        setIncidents(data.incidents || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  const severityColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case "critical": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "high": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "medium": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "low": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      default: return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ShieldAlert className="text-rose-400" />
          Security Incidents
        </h1>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading incidents...</div>
        ) : incidents.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No incidents found in the active indices.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {incidents.map((incident, idx) => (
              <div key={`${incident.incident_id}-${idx}`} className="p-5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${severityColor(incident.risk)}`}>
                        {incident.risk}
                      </span>
                      <h2 className="text-base font-semibold text-white">{incident.incident_id}</h2>
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(incident.created_at).toLocaleString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-300 max-w-2xl">{incident.summary}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs mt-2">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Activity className="w-3 h-3" />
                        {incident.alert_count} Alerts Correlated
                      </div>
                      
                      {incident.entities?.countries?.length > 0 && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <MapPin className="w-3 h-3" />
                          {incident.entities.countries.join(", ")}
                        </div>
                      )}
                      
                      {incident.mitre && incident.mitre.length > 0 && (
                        <div className="flex gap-1">
                          {incident.mitre.slice(0, 3).map((m: any) => (
                            <span key={m.technique_id} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                              {m.technique_id}
                            </span>
                          ))}
                          {incident.mitre.length > 3 && (
                            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
                              +{incident.mitre.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Link 
                    href={`/incidents/${incident.incident_id}`}
                    className="flex items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/30 px-3 py-1.5 rounded border border-cyan-500/20 transition-colors"
                  >
                    Investigate <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
