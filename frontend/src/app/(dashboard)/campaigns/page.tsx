"use client";

import { useEffect, useState } from "react";
import { Target, Activity, MapPin, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

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
                className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white-[0.02] transition-colors flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {c.name || "Unnamed Campaign"}
                    </h2>
                    <span className="text-xs text-slate-500 font-mono block mt-1">
                      {c.id}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                    {c.confidence
                      ? `${Math.round(c.confidence * 100)}% Match`
                      : "Pending"}
                  </span>
                </div>

                <p className="text-sm text-slate-300 mb-6 flex-1 line-clamp-3">
                  {c.description ||
                    "Automatically clustered infrastructure and behavioral overlap."}
                </p>

                <div className="grid grid-cols-2 gap-4 text-sm mt-auto pt-4 border-t border-white/10">
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">
                      Related Incidents
                    </span>
                    <span className="text-white font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      {incidentCount} Incidents
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block mb-1">
                      Observed Infrastructure
                    </span>
                    <span className="text-white font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-purple-400" />
                      {entities.countries?.length || 0} Countries
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