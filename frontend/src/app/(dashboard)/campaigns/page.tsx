"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Activity, MapPin, Search, Filter, ShieldAlert } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/campaigns`)
      .then((res) => res.json())
      .then((data) => {
        setCampaigns(data.campaigns || []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load campaigns.");
        setIsLoading(false);
      });
  }, []);

  const filteredCampaigns = campaigns.filter(c => {
    const data = c.campaign || {};
    return (data.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            data.description?.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="flex flex-col h-full bg-[#020617] text-slate-300 font-sans">
      
      {/* Top Action Bar */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between bg-[#0F172A] gap-4 shrink-0">
        <div>
          <h1 className="text-sm font-bold text-white flex items-center gap-2 tracking-tight">
            <Target className="w-4 h-4 text-cyan-500" />
            Threat Campaigns
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
              {filteredCampaigns.length} Active
            </span>
          </h1>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-medium">Clustered Intelligence View</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#020617] border border-slate-700 text-slate-300 text-xs rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[#020617] border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs rounded transition-colors">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 mx-4 mt-4 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Main Campaign List */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex flex-col space-y-4">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono bg-[#0F172A] border border-slate-800 rounded">Loading clustering engine...</div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-[#0F172A] border border-slate-800 rounded flex flex-col items-center">
              <Target className="w-6 h-6 mb-2 opacity-20" />
              <span className="text-xs uppercase tracking-wider">No campaigns clustered yet.</span>
            </div>
          ) : (
            filteredCampaigns.map((campaignData, idx) => {
              const c = campaignData.campaign || {};
              const entities = campaignData.entities || {};
              const incidentCount = campaignData.related_incident_ids?.length || 1;
              const confidence = c.confidence || 0;
              
              let confColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
              if (confidence > 0.8) confColor = "text-rose-400 border-rose-500/30 bg-rose-500/10";
              else if (confidence > 0.5) confColor = "text-amber-400 border-amber-500/30 bg-amber-500/10";

              return (
                <div 
                  key={c.id || idx}
                  className="flex flex-col bg-[#0F172A] border border-slate-800 rounded overflow-hidden"
                >
                  <div className="flex items-start justify-between p-4 border-b border-slate-800/50 bg-[#0A0F1C]">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-sm font-bold text-cyan-400">{c.name || "Unnamed Campaign"}</h2>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${confColor}`}>
                          {Math.round(confidence * 100)}% Confidence
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono block uppercase tracking-widest">
                        ID: {c.id || `CPG-${idx}`}
                      </span>
                    </div>
                    
                    <Link 
                      href={`/campaigns/${c.id || idx}`}
                      className="px-3 py-1 bg-[#020617] hover:bg-cyan-900/30 text-cyan-400 border border-slate-700 hover:border-cyan-800 rounded text-[10px] font-bold transition-colors uppercase tracking-wider flex items-center justify-center"
                    >
                      View Dossier
                    </Link>
                  </div>
                  
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 text-xs text-slate-300 leading-relaxed font-medium">
                      <p>{c.description || "Automatically clustered infrastructure and behavioral overlap."}</p>
                    </div>
                    
                    <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      {c.threat_actor && (
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Actor</span>
                          <span className="text-white font-mono flex items-center gap-1.5 truncate">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                            {c.threat_actor}
                          </span>
                        </div>
                      )}
                      
                      {(c.targeted_countries?.length > 0 || entities.countries?.length > 0) && (
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Victim Location</span>
                          <span className="text-white flex items-center gap-1.5 truncate">
                            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                            {c.targeted_countries?.join(", ") || entities.countries?.join(", ")}
                          </span>
                        </div>
                      )}
                      
                      {entities.ips?.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Attacker Infra</span>
                          <span className="text-slate-300 font-mono flex items-start gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                            <div className="flex flex-col space-y-0.5">
                              {entities.ips.slice(0,2).map((ip: string) => <span key={ip}>{ip}</span>)}
                              {entities.ips.length > 2 && <span className="text-slate-500 text-[10px]">+{entities.ips.length - 2} more</span>}
                            </div>
                          </span>
                        </div>
                      )}
                      
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Impact</span>
                        <span className="text-white flex items-center gap-1.5 truncate">
                          <Activity className="w-3.5 h-3.5 text-cyan-500" />
                          {incidentCount} Incidents
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
