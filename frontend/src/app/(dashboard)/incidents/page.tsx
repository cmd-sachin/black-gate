"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, ArrowRight, Activity, MapPin, Search, Filter } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");

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
      case "critical": return { badge: "text-rose-400 bg-rose-500/10 border-rose-500/20", dot: "bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-pulse" };
      case "high": return { badge: "text-orange-400 bg-orange-500/10 border-orange-500/20", dot: "bg-orange-500 shadow-[0_0_10px_#f97316]" };
      case "medium": return { badge: "text-amber-400 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-500 shadow-[0_0_10px_#f59e0b]" };
      case "low": return { badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-500 shadow-[0_0_10px_#10b981]" };
      default: return { badge: "text-slate-400 bg-slate-500/10 border-slate-500/20", dot: "bg-slate-500" };
    }
  };

  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch = inc.incident_id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inc.summary?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === "ALL" || inc.risk?.toUpperCase() === riskFilter;
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
          <ShieldAlert className="text-rose-400" />
          Security Incidents
        </h1>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#050914]/80 backdrop-blur-2xl border border-slate-800/80 p-4 rounded-2xl shadow-lg">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search incident ID or summary..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0a0f18] border border-slate-700 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-500 hidden md:block" />
          <select 
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="w-full md:w-auto bg-[#0a0f18] border border-slate-700 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all appearance-none cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="LOW">Low Only</option>
          </select>
        </div>
      </div>

      <div className="bg-[#050914]/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
        {/* Sticky Header for List */}
        <div className="bg-slate-900/80 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest sticky top-0 z-10 backdrop-blur-md">
          <span>Incident Details</span>
          <span>Action</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading incidents...</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500 font-medium bg-[#0a0f18]/50">
            <Search className="w-8 h-8 mb-3 opacity-20" />
            No incidents match your filters.
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredIncidents.map((incident, idx) => {
              const severity = severityColor(incident.risk);
              return (
                <div key={`${incident.incident_id}-${idx}`} className="group relative p-6 hover:bg-slate-800/40 border-b border-slate-800/50 last:border-0 transition-all duration-300">
                  {/* Left Edge Hover Glow */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_12px_#06b6d4]" />
                  
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        {/* Dynamic Status Dot */}
                        <div className="relative flex items-center justify-center w-4 h-4">
                          <div className={`w-2.5 h-2.5 rounded-full ${severity.dot}`} />
                        </div>
                        
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${severity.badge}`}>
                          {incident.risk}
                        </span>
                        <h2 className="text-lg font-bold text-white tracking-tight">{incident.incident_id}</h2>
                        <span className="text-xs text-slate-500 font-mono bg-slate-900/50 px-2 py-1 rounded border border-slate-800">
                          {new Date(incident.created_at).toLocaleString()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-slate-400 max-w-3xl font-medium leading-relaxed ml-8">{incident.summary}</p>
                      
                      <div className="flex flex-wrap items-center gap-5 text-xs mt-3 ml-8">
                        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                          <Activity className="w-3.5 h-3.5 text-cyan-500" />
                          {incident.alert_count} Alerts Correlated
                        </div>
                        
                        {incident.entities?.countries?.length > 0 && (
                          <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                            {incident.entities.countries.join(", ")}
                          </div>
                        )}
                        
                        {incident.mitre && incident.mitre.length > 0 && (
                          <div className="flex gap-1.5 border-l border-slate-700 pl-5">
                            {incident.mitre.slice(0, 4).map((m: any) => (
                              <span key={m.technique_id} className="px-2 py-0.5 bg-[#0a0f18] text-slate-300 rounded border border-slate-700/50 font-mono text-[10px]">
                                {m.technique_id}
                              </span>
                            ))}
                            {incident.mitre.length > 4 && (
                              <span className="px-2 py-0.5 bg-[#0a0f18] text-slate-500 rounded border border-slate-700/50 font-mono text-[10px]">
                                +{incident.mitre.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Link 
                      href={`/incidents/${incident.incident_id}`}
                      className="flex items-center gap-2 text-sm font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/20 hover:bg-cyan-900/40 px-4 py-2.5 rounded-lg border border-cyan-500/20 hover:border-cyan-500/40 transition-all shadow-[0_0_15px_rgba(6,182,212,0.05)] hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] group-hover:-translate-x-1"
                    >
                      Investigate <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
