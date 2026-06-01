"use client";

import { useEffect, useState } from "react";
import { Target, Activity, MapPin, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Target className="text-amber-400" />
            Threat Campaigns
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {campaigns.length} campaigns clustered by the agent
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          // Loading skeletons
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse"
            >
              <div className="h-6 w-32 bg-slate-700 rounded mb-3" />
              <div className="h-4 w-48 bg-slate-700 rounded mb-4" />
              <div className="h-20 bg-slate-700 rounded mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-5 bg-slate-700 rounded" />
                <div className="h-5 bg-slate-700 rounded" />
              </div>
            </div>
          ))
        ) : campaigns.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 bg-white/5 border border-white/10 rounded-xl">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No campaigns clustered yet. Run a simulation to start detecting
            campaigns.
          </div>
        ) : (
          campaigns.map((campaignData, idx) => {
            const c = campaignData.campaign || {};
            const entities = campaignData.entities || {};
            const incidentCount =
              campaignData.related_incident_ids?.length || 1;

            return (
              <motion.div
                key={`${campaignData.id || campaignData.campaign?.id || idx}-${idx}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative bg-[#050914]/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 flex flex-col overflow-hidden"
              >
                {/* Dossier top accent bar based on confidence */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                  (c.confidence || 0) > 0.8 ? "bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_15px_#e11d48]" : 
                  (c.confidence || 0) > 0.5 ? "bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_15px_#d97706]" :
                  "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_#059669]"
                }`} />

                {/* Subtle tech grid background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-10" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#050914]/90" />

                <div className="relative z-10 flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight group-hover:text-cyan-400 transition-colors">
                      {c.name || "Unnamed Campaign"}
                    </h2>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1 uppercase tracking-widest bg-slate-900/50 inline-block px-2 py-0.5 rounded border border-slate-800">
                      ID: {c.id || `CPG-${idx}`}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-md ${
                    (c.confidence || 0) > 0.8 ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                    (c.confidence || 0) > 0.5 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}>
                    {c.confidence
                      ? `${Math.round(c.confidence * 100)}% Match`
                      : "Pending"}
                  </span>
                </div>

                <p className="relative z-10 text-sm text-slate-400 mb-6 flex-1 whitespace-pre-wrap font-medium">
                  {c.description ||
                    "Automatically clustered infrastructure and behavioral overlap."}
                </p>

                <div className={`relative z-10 grid gap-5 text-sm mt-auto pt-5 border-t border-slate-800/80 ${
                  c.threat_actor ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3"
                }`}>
                  {c.threat_actor && (
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1.5">
                        Threat Actor
                      </span>
                      <span className="text-white font-semibold flex items-center gap-1.5 truncate" title={c.threat_actor}>
                        <Target className="w-4 h-4 text-rose-400" />
                        {c.threat_actor}
                      </span>
                    </div>
                  )}

                  {(c.targeted_countries?.length > 0 || entities.countries?.length > 0) && (
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1.5">
                        Target / Victim
                      </span>
                      <span className="text-white font-semibold flex items-center gap-1.5 truncate" title={c.targeted_countries?.join(", ") || entities.countries?.join(", ")}>
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        {c.targeted_countries?.join(", ") || entities.countries?.join(", ")}
                      </span>
                    </div>
                  )}

                  {entities.ips?.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1.5">
                        Attacker Infra
                      </span>
                      <span className="text-white font-semibold flex items-start gap-1.5 font-mono text-[11px] whitespace-normal break-all" title={entities.ips.join(", ")}>
                        <Activity className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                        <span>
                          {entities.ips.slice(0,2).join(', ')} {entities.ips.length > 2 ? ', ...' : ''}
                        </span>
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1.5">
                      Impacted
                    </span>
                    <span className="text-white font-semibold flex items-center gap-1.5 truncate">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      {incidentCount} Incidents
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
