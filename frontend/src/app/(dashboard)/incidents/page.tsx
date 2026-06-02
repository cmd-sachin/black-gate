"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, Search, Filter, ChevronDown, ChevronRight, Activity, MapPin } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const severityColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case "critical": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "high": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "medium": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "low": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      default: return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    }
  };

  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch = inc.incident_id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inc.summary?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === "ALL" || inc.risk?.toUpperCase() === riskFilter;
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="flex h-full bg-[#020617] text-slate-300 font-sans">
      
      {/* Left Filter Pane */}
      <div className="w-64 border-r border-slate-800 bg-[#0F172A] flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Filters</h2>
          <Filter className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div className="p-4 space-y-6 flex-1 overflow-y-auto">
          {/* Risk Level Filter */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400">Severity</h3>
            <div className="space-y-2 text-xs">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => (
                <label key={level} className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="risk" 
                    checked={riskFilter === level} 
                    onChange={() => setRiskFilter(level)}
                    className="accent-cyan-500 w-3 h-3 bg-slate-800 border-slate-700" 
                  />
                  <span className={`group-hover:text-slate-200 ${riskFilter === level ? 'text-white font-medium' : 'text-slate-500'}`}>
                    {level === 'ALL' ? 'All Severities' : level}
                  </span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Mock Time Filter */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400">Time Range</h3>
            <select className="w-full bg-[#020617] border border-slate-700 rounded text-xs text-slate-300 py-1.5 px-2 outline-none">
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Data Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0F172A]">
          <h1 className="text-sm font-bold text-white flex items-center gap-2 tracking-tight">
            <ShieldAlert className="w-4 h-4 text-cyan-500" />
            Security Incidents
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
              {filteredIncidents.length} results
            </span>
          </h1>
          
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Filter by ID or keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#020617] border border-slate-700 text-slate-300 text-xs rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-slate-900/50 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
          <div className="col-span-1"></div>
          <div className="col-span-2">Timestamp</div>
          <div className="col-span-2">Incident ID</div>
          <div className="col-span-1">Severity</div>
          <div className="col-span-4">Summary</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">Loading data stream...</div>
          ) : filteredIncidents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">No records found.</div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-800/50">
              {filteredIncidents.map((incident, idx) => {
                const isExpanded = expandedRows.has(incident.incident_id);
                return (
                  <div key={`${incident.incident_id || 'inc'}-${idx}`} className="flex flex-col hover:bg-slate-800/20 transition-colors">
                    {/* Main Row */}
                    <div className="grid grid-cols-12 gap-4 px-4 py-2.5 items-center cursor-pointer" onClick={() => toggleRow(incident.incident_id)}>
                      <div className="col-span-1 flex items-center justify-center">
                        <button className="text-slate-500 hover:text-slate-300">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="col-span-2 text-xs font-mono text-slate-400">
                        {new Date(incident.created_at).toLocaleString('sv')}
                      </div>
                      <div className="col-span-2 text-xs font-mono text-cyan-400 truncate">
                        {incident.incident_id}
                      </div>
                      <div className="col-span-1 flex items-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${severityColor(incident.risk)}`}>
                          {incident.risk}
                        </span>
                      </div>
                      <div className="col-span-4 text-xs text-slate-300 truncate font-medium">
                        {incident.summary}
                      </div>
                      <div className="col-span-2 text-right flex justify-end">
                        <Link 
                          href={`/incidents/${incident.incident_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1 bg-[#0F172A] hover:bg-cyan-900/30 text-cyan-400 border border-slate-700 hover:border-cyan-800 rounded text-[10px] font-bold transition-colors uppercase tracking-wider"
                        >
                          Analyze
                        </Link>
                      </div>
                    </div>

                    {/* Expanded Detail Pane */}
                    {isExpanded && (
                      <div className="col-span-12 bg-[#0F172A]/50 border-t border-slate-800/50 p-4 pl-12 grid grid-cols-2 gap-8 text-xs">
                        <div className="space-y-3">
                          <div>
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-1">Full Description</span>
                            <p className="text-slate-300 leading-relaxed">{incident.summary}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-1">Indicators & Context</span>
                            <div className="flex gap-4">
                              <span className="flex items-center gap-1.5 text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                <Activity className="w-3.5 h-3.5 text-cyan-500" />
                                {incident.alert_count} Alerts
                              </span>
                              {incident.entities?.countries?.length > 0 && (
                                <span className="flex items-center gap-1.5 text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                  {incident.entities.countries.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-1">MITRE ATT&CK Mapping</span>
                          {incident.mitre && incident.mitre.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {incident.mitre.map((m: any) => (
                                <span key={m.technique_id} className="px-2 py-0.5 bg-slate-900 text-slate-300 rounded border border-slate-700 font-mono text-[10px]">
                                  {m.technique_id}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-600 font-mono">No MITRE tactics identified</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
