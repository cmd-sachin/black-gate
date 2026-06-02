"use client";

import { useEffect, useState, useCallback } from "react";
import ThreatMap from "@/components/ThreatMap";
import {
  Activity,
  ShieldAlert,
  Target,
  AlertTriangle,
  Zap,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function DashboardOverview() {
  const [stats, setStats] = useState<any>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapView, setMapView] = useState<"map" | "table">("map");

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/api/stats/overview`),
        fetch(`${API_BASE}/api/alerts/recent?size=15`),
      ]);
      const statsData = await statsRes.json();
      const alertsData = await alertsRes.json();
      setStats(statsData.stats);
      setRecentAlerts(alertsData.alerts || []);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000); 
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  return (
    <div className="flex flex-col h-full bg-[#020617] text-slate-300 font-sans p-4 space-y-4 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">CampaignIQ Overview</h1>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Real-time Telemetry & Intelligence</p>
        </div>
        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 border border-slate-700 bg-[#0F172A] px-2 py-1 rounded">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)] animate-pulse"></div>
          Live Sync Active
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-[#0F172A] border border-slate-800 rounded p-4 flex flex-col justify-between h-24">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Incidents</h3>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono text-white">
              {isLoading ? "..." : stats?.total_incidents.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-400">+12% (24h)</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#0F172A] border border-slate-800 rounded p-4 flex flex-col justify-between h-24">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Campaigns</h3>
            <Target className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono text-white">
              {isLoading ? "..." : stats?.total_campaigns.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-400">+2 (24h)</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#0F172A] border border-slate-800 rounded p-4 flex flex-col justify-between h-24">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Raw Alerts (24h)</h3>
            <Activity className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono text-white">
              {isLoading ? "..." : stats?.total_alerts.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-400">Stable</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#0F172A] border border-slate-800 rounded p-4 flex flex-col justify-between h-24">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Severity Mix (Crit/High)</h3>
            <AlertTriangle className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-mono text-rose-400">
              {isLoading ? "..." : (stats?.incident_severities?.critical || 0)}
            </span>
            <span className="text-lg text-slate-600 font-mono">/</span>
            <span className="text-xl font-mono text-orange-400">
              {isLoading ? "..." : (stats?.incident_severities?.high || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Map and Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-[500px]">
        {/* Threat Map Panel */}
        <div className="lg:col-span-2 bg-[#0F172A] border border-slate-800 rounded flex flex-col">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-[#0A0F1C]">
            <h2 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Global Threat Origin</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setMapView("map")}
                className={`text-[10px] border px-2 py-0.5 rounded transition-colors ${mapView === "map" ? "border-cyan-500 text-cyan-400 bg-cyan-950/30" : "border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-800"}`}
              >
                Map View
              </button>
              <button 
                onClick={() => setMapView("table")}
                className={`text-[10px] border px-2 py-0.5 rounded transition-colors ${mapView === "table" ? "border-cyan-500 text-cyan-400 bg-cyan-950/30" : "border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-800"}`}
              >
                Table View
              </button>
            </div>
          </div>
          <div className="flex-1 relative">
            <ThreatMap viewMode={mapView} />
          </div>
        </div>

        {/* Telemetry Stream Panel */}
        <div className="bg-[#0F172A] border border-slate-800 rounded flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-[#0A0F1C]">
            <h2 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Live Telemetry Feed</h2>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex-1 overflow-y-auto p-0">
            {isLoading ? (
              <div className="p-4 text-center text-slate-500 text-xs font-mono">Loading data stream...</div>
            ) : recentAlerts.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs font-mono">No recent alerts found.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <tbody>
                  {recentAlerts.map((alert: any) => (
                    <tr key={alert.id} className="border-b border-slate-800/50 hover:bg-[#020617] transition-colors group">
                      <td className="p-2 pl-4 w-24">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(alert.timestamp).toLocaleTimeString([], {hour12:false})}
                        </span>
                      </td>
                      <td className="p-2 w-20">
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-400 border border-cyan-800/50 font-bold">
                          {alert.tool || alert.event_type}
                        </span>
                      </td>
                      <td className="p-2 text-xs text-slate-300 font-medium truncate max-w-[150px]">
                        {alert.alert || alert.query || alert.signature || "Unknown Event"}
                      </td>
                      <td className="p-2 pr-4 text-right">
                        <div className="flex flex-col items-end text-[10px] font-mono text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity">
                          <span className="text-rose-400/70">{alert.source_ip || "-"}</span>
                          <span className="text-emerald-400/70">{alert.dest_ip || "-"}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
