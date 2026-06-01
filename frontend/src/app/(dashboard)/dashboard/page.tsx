"use client";

import { useEffect, useState, useCallback } from "react";
import ThreatMap from "@/components/ThreatMap";
import {
  Activity,
  ShieldAlert,
  Target,
  AlertTriangle,
  Zap,
  Loader2,
  Terminal,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function DashboardOverview() {
  const [stats, setStats] = useState<any>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [simStatus, setSimStatus] = useState<{
    active: boolean;
    runId?: string;
    status?: string;
    output?: string;
    error?: string;
  }>({ active: false });

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/api/stats/overview`),
        fetch(`${API_BASE}/api/alerts/recent?size=10`),
      ]);
      const statsData = await statsRes.json();
      const alertsData = await alertsRes.json();
      setStats(statsData.stats);
      setRecentAlerts(alertsData.alerts || []);

      // Check if there's an active simulation run
      if (statsData.stats?.active_simulation) {
        setSimStatus({
          active: true,
          runId: statsData.stats.active_simulation.run_id,
          status: statsData.stats.active_simulation.status,
          output: statsData.stats.active_simulation.output,
        });
      } else {
        setSimStatus(prev =>
          prev.active ? { ...prev, active: false } : prev
        );
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000); // Poll every 5s for live updates
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const runSimulation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/soc/simulate/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Run full SOC pipeline" }),
      });
      if (!response.ok) throw new Error("Backend error");
      const data = await response.json();
      // Immediately start polling for run status
      setSimStatus({ active: true, runId: data.run_id, status: "running" });
      await fetchDashboardData(); // Refresh stats to get latest
    } catch (err) {
      console.error(err);
      setSimStatus({ active: true, status: "error", error: String(err) });
    } finally {
      setIsLoading(false);
    }
  };

  // Pipeline phase visualization
  const phases = [
    "Ingestion",
    "Correlation",
    "MITRE Mapping",
    "Campaign Clustering",
    "Cognitive Enrichment",
    "AI Validation",
    "Complete",
  ];
  const currentPhaseIndex = simStatus.status === "completed"
    ? phases.length - 1
    : simStatus.status === "error"
    ? -1
    : phases.indexOf(simStatus.status || "Ingestion");

  return (
    <div className="space-y-6">

      {/* KPI Cards and rest of dashboard ... (keep existing code) */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">SOC Overview</h1>
        <div className="text-sm text-slate-400 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          Live Sync Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="group relative bg-[#050914]/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(244,63,94,0.3)] hover:border-rose-500/30 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 text-slate-400 mb-4 relative z-10">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <h3 className="text-sm font-semibold tracking-wide">Total Incidents</h3>
          </div>
          <p className="text-4xl font-black text-white tracking-tight relative z-10 group-hover:text-rose-50 transition-colors">
            {isLoading ? "..." : stats?.total_incidents.toLocaleString()}
          </p>
        </div>

        <div className="group relative bg-[#050914]/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(245,158,11,0.3)] hover:border-amber-500/30 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 text-slate-400 mb-4 relative z-10">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Target className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-sm font-semibold tracking-wide">Active Campaigns</h3>
          </div>
          <p className="text-4xl font-black text-white tracking-tight relative z-10 group-hover:text-amber-50 transition-colors">
            {isLoading ? "..." : stats?.total_campaigns.toLocaleString()}
          </p>
        </div>

        <div className="group relative bg-[#050914]/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(34,211,238,0.3)] hover:border-cyan-500/30 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 text-slate-400 mb-4 relative z-10">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-sm font-semibold tracking-wide">Raw Alerts (24h)</h3>
          </div>
          <p className="text-4xl font-black text-white tracking-tight relative z-10 group-hover:text-cyan-50 transition-colors">
            {isLoading ? "..." : stats?.total_alerts.toLocaleString()}
          </p>
        </div>

        <div className="group relative bg-[#050914]/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(168,85,247,0.3)] hover:border-purple-500/30 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 text-slate-400 mb-4 relative z-10">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-sm font-semibold tracking-wide">Critical / High</h3>
          </div>
          <p className="text-4xl font-black text-white tracking-tight relative z-10 flex items-baseline gap-2 group-hover:text-purple-50 transition-colors">
            {isLoading ? "..." : (stats?.incident_severities?.critical || 0)}
            <span className="text-xl text-slate-600 font-normal">/</span>
            <span className="text-2xl text-slate-400 font-semibold group-hover:text-slate-300 transition-colors">
              {isLoading ? "..." : (stats?.incident_severities?.high || 0)}
            </span>
          </p>
        </div>
      </div>

      {/* Map and Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#050914]/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col h-[500px] shadow-lg">
          <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              Global Threat Origin
            </h2>
          </div>
          <div className="flex-1 relative">
            <ThreatMap />
          </div>
        </div>
        <div className="bg-[#050914]/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl flex flex-col h-[500px] shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              Live Telemetry Feed
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {isLoading ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                Loading alerts...
              </div>
            ) : recentAlerts.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                No recent alerts found.
              </div>
            ) : (
              recentAlerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {alert.tool || alert.event_type}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-200 mt-1 truncate">
                    {alert.alert ||
                      alert.query ||
                      alert.signature ||
                      "Unknown Event"}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs font-mono text-slate-400">
                    <span className="truncate max-w-[120px]">
                      {alert.source_ip || "?"}
                    </span>
                    <span className="text-slate-600">→</span>
                    <span className="truncate max-w-[120px]">
                      {alert.dest_ip ||
                        alert.destination_domain ||
                        "?"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
