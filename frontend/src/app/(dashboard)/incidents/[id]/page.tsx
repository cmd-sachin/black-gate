"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldAlert,
  Target,
  Info,
  CheckCircle2,
  XCircle,
  MapPin,
  Activity,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function IncidentDetailPage() {
  const params = useParams();
  const incidentId = params.id as string;
  const [incident, setIncident] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId) return;
    fetch(`${API_BASE}/api/incidents/${incidentId}`)
      .then((res) => res.json())
      .then((data) => {
        setIncident(data.incident);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load incident details.");
        setIsLoading(false);
      });
  }, [incidentId]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl pb-10 animate-pulse">
        <div className="h-6 w-32 bg-slate-700 rounded" />
        <div className="h-10 w-64 bg-slate-700 rounded" />
        <div className="h-40 bg-slate-700 rounded-xl" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="space-y-6 max-w-5xl pb-10">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Incidents
        </Link>
        <div className="p-8 text-center text-red-400 bg-white/5 border border-red-500/20 rounded-xl">
          {error || "Incident not found."}
        </div>
      </div>
    );
  }

  const validation = incident.validation || {};
  const isRejected = validation.verdict?.startsWith("rejected");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl pb-10"
    >
      <Link
        href="/incidents"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Incidents
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">
              {incident.incident_id}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${
                incident.risk === "critical"
                  ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                  : incident.risk === "high"
                  ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
                  : "text-amber-400 bg-amber-500/10 border-amber-500/20"
              }`}
            >
              {incident.risk} Risk
            </span>
          </div>
          <p className="text-slate-300 text-lg">{incident.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Gemini AI Validation */}
          {validation.verdict && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-5 rounded-xl border ${
                isRejected
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-emerald-500/5 border-emerald-500/20"
              }`}
            >
              <h3
                className={`text-sm font-semibold flex items-center gap-2 mb-3 ${
                  isRejected ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {isRejected ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Gemini AI Validation:{" "}
                {validation.verdict.replace("_", " ").toUpperCase()}
                {validation.confidence && (
                  <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded-full">
                    {Math.round(validation.confidence * 100)}% confidence
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-300 mb-2">
                {validation.reasoning}
              </p>
              {validation.analyst_notes && (
                <div className="text-xs text-slate-400 border-t border-white/5 pt-3 mt-3">
                  <span className="font-semibold text-slate-300">
                    Analyst Notes:
                  </span>{" "}
                  {validation.analyst_notes}
                </div>
              )}
            </motion.div>
          )}

          {/* Attack Narrative */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" /> Attack Narrative
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
              {incident.narrative || "No narrative generated."}
            </p>

            {incident.remediation && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2">
                  Suggested Remediation
                </h4>
                <p className="text-sm text-slate-300">
                  {incident.remediation}
                </p>
              </div>
            )}
          </div>

          {/* MITRE ATT&CK Mapping */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" /> MITRE ATT&CK
              Mapping
            </h3>
            {incident.mitre?.length > 0 ? (
              <div className="space-y-3">
                {incident.mitre.map((m: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-3 bg-white/5 rounded-lg border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-cyan-300 text-sm">
                        {m.technique_id}
                      </span>
                      <span className="text-xs text-slate-500">
                        {m.tactic}
                      </span>
                    </div>
                    <p className="text-sm text-white font-medium">{m.name}</p>
                    <div className="mt-2 text-xs text-slate-400">
                      <strong>Evidence:</strong>
                      <ul className="list-disc list-inside mt-1 ml-1 opacity-80">
                        {m.evidence?.map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No MITRE techniques mapped.
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Infrastructure Entities */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-400" />{" "}
              Infrastructure
            </h3>

            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                  Involved IPs
                </span>
                <div className="flex flex-wrap gap-1">
                  {incident.entities?.ips?.map((ip: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded border border-slate-700 font-mono"
                    >
                      {ip}
                    </span>
                  ))}
                </div>
              </div>

              {incident.entities?.domains?.length > 0 && (
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                    Domains
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {incident.entities.domains.map((d: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded border border-slate-700 font-mono"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {incident.entities?.countries?.length > 0 && (
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                    Geo Origin
                  </span>
                  <p className="text-sm text-slate-300">
                    {incident.entities.countries.join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Campaign Cluster */}
          {incident.campaign && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-amber-500/20 rounded-xl p-5"
            >
              <h3 className="text-sm font-semibold text-amber-400 mb-2">
                Campaign Cluster
              </h3>
              <p className="text-white font-medium mb-1">
                {incident.campaign.name}
              </p>
              <p className="text-xs text-slate-400 mb-3">
                {incident.campaign.cluster_id}
              </p>
              <p className="text-sm text-slate-300">
                {incident.campaign.description}
              </p>
              <Link
                href="/campaigns"
                className="mt-4 inline-block text-xs font-medium text-amber-400 hover:text-amber-300"
              >
                View all campaigns →
              </Link>
            </motion.div>
          )}

          {/* Additional Meta */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-xs">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Activity className="w-3 h-3" />
              {incident.alert_count} Alerts Correlated
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <MapPin className="w-3 h-3" />
              Created: {new Date(incident.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}