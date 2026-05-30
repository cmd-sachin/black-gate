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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

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
      {/* Agent Orchestration Panel */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-cyan-950/40 to-amber-950/40 border border-cyan-500/20 rounded-2xl p-6 backdrop-blur-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Agent Orchestration
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Trigger the full SOC pipeline and watch the agent work in
              real‑time.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {simStatus.active ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">
                  Run{" "}
                  <span className="font-mono text-cyan-400">
                    {simStatus.runId?.slice(0, 8)}
                  </span>
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    simStatus.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : simStatus.status === "error"
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse"
                  }`}
                >
                  {simStatus.status === "completed"
                    ? "Completed"
                    : simStatus.status === "error"
                    ? "Error"
                    : "Running..."}
                </span>
              </div>
            ) : (
              <button
                onClick={runSimulation}
                disabled={isLoading}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-amber-600 text-white font-semibold rounded-xl hover:shadow-cyan-500/30 hover:scale-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Launching...
                  </>
                ) : (
                  <>
                    <Terminal className="w-4 h-4" /> Run Simulation
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Pipeline Progress Visualization */}
        {simStatus.active && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-6 space-y-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              {phases.map((phase, idx) => {
                const isCompleted = simStatus.status === "completed" || idx < currentPhaseIndex;
                const isCurrent = idx === currentPhaseIndex && simStatus.status !== "completed" && simStatus.status !== "error";
                const isError = simStatus.status === "error" && idx === currentPhaseIndex + 1;
                return (
                  <div key={phase} className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full ${
                        isCompleted
                          ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                          : isCurrent
                          ? "bg-cyan-500 shadow-[0_0_8px_#06b6d4] animate-pulse"
                          : isError
                          ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
                          : "bg-slate-700"
                      }`}
                    />
                    <span
                      className={`text-xs ${
                        isCompleted || isCurrent ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {phase}
                    </span>
                    {idx < phases.length - 1 && (
                      <span className="text-slate-600 mx-1">→</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Final Output */}
            {simStatus.status === "completed" && simStatus.output && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/30 border border-white/10 rounded-xl p-4 font-mono text-sm text-emerald-400 max-h-40 overflow-y-auto"
              >
                {simStatus.output}
              </motion.div>
            )}

            {simStatus.error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                Simulation error: {simStatus.error}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

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
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-medium">Total Incidents</h3>
          </div>
          <p className="text-3xl font-light text-white">
            {isLoading ? "..." : stats?.total_incidents.toLocaleString()}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Target className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-medium">Active Campaigns</h3>
          </div>
          <p className="text-3xl font-light text-white">
            {isLoading ? "..." : stats?.total_campaigns.toLocaleString()}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-medium">Raw Alerts (24h)</h3>
          </div>
          <p className="text-3xl font-light text-white">
            {isLoading ? "..." : stats?.total_alerts.toLocaleString()}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <AlertTriangle className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-medium">Critical / High</h3>
          </div>
          <p className="text-3xl font-light text-white flex items-baseline gap-2">
            {isLoading ? "..." : (stats?.incident_severities?.critical || 0)}
            <span className="text-xl text-slate-500">/</span>
            <span className="text-2xl text-slate-300">
              {isLoading ? "..." : (stats?.incident_severities?.high || 0)}
            </span>
          </p>
        </div>
      </div>

      {/* Map and Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col h-[500px]">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Global Threat Origin
            </h2>
          </div>
          <div className="flex-1 relative">
            <ThreatMap />
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl flex flex-col h-[500px]">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">
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