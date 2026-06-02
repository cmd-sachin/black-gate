"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  FileText,
  Terminal,
  ChevronRight
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
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
      <div className="flex h-full items-center justify-center bg-[#020617]">
        <div className="text-slate-500 font-mono text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 animate-spin text-cyan-500" />
          Loading Incident {incidentId}...
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="flex flex-col h-full bg-[#020617] p-6 text-slate-300">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-6 text-xs uppercase tracking-wider font-bold">
          <ArrowLeft className="w-4 h-4" /> Back to Incidents
        </button>
        <div className="bg-red-900/20 border border-red-500/50 rounded p-6 text-red-400 font-mono">
          Error: {error || "Incident not found"}
        </div>
      </div>
    );
  }

  const validation = incident.validation || {};
  const isRejected = validation.verdict?.startsWith("rejected");

  let riskColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (incident.risk === "critical") riskColor = "text-rose-400 border-rose-500/30 bg-rose-500/10";
  else if (incident.risk === "high") riskColor = "text-orange-400 border-orange-500/30 bg-orange-500/10";
  else if (incident.risk === "medium") riskColor = "text-amber-400 border-amber-500/30 bg-amber-500/10";

  return (
    <div className="flex flex-col h-full bg-[#020617] text-slate-300 font-sans overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-[#0F172A] shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">
          <Link href="/incidents" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> Incidents
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-300">{incident.incident_id}</span>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-3">
              {incident.incident_id}
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${riskColor}`}>
                {incident.risk} Risk
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono mt-1">Generated: {new Date(incident.created_at).toLocaleString('sv')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 bg-[#020617] border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs rounded transition-colors flex items-center gap-2 font-medium">
              <FileText className="w-3.5 h-3.5" /> Export Report
            </button>
            <button className="px-3 py-1.5 bg-[#020617] border border-slate-700 hover:bg-slate-800 text-cyan-400 text-xs rounded transition-colors flex items-center gap-2 font-medium">
              <Activity className="w-3.5 h-3.5" /> Trigger SOAR Playbook
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 flex-1">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-full items-start">
          
          {/* Main Info */}
          <div className="xl:col-span-2 space-y-4">
            
            {/* Validation Panel */}
            {validation.verdict && (
              <div className={`border rounded overflow-hidden ${isRejected ? "bg-red-500/5 border-red-500/20" : "bg-emerald-500/5 border-emerald-500/20"}`}>
                <div className={`px-4 py-2 border-b flex items-center justify-between text-[10px] font-bold uppercase tracking-wider ${isRejected ? "bg-red-950/30 border-red-500/20 text-red-400" : "bg-emerald-950/30 border-emerald-500/20 text-emerald-400"}`}>
                  <div className="flex items-center gap-2">
                    {isRejected ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Gemini AI Validation: {validation.verdict.replace("_", " ")}
                  </div>
                  {validation.confidence && (
                    <span className="font-mono text-[9px] bg-black/20 px-1.5 py-0.5 rounded">
                      {Math.round(validation.confidence * 100)}% Conf
                    </span>
                  )}
                </div>
                <div className="p-4 text-xs text-slate-300 leading-relaxed">
                  <p>{validation.reasoning}</p>
                  {validation.analyst_notes && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 text-slate-400">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block mb-1">Analyst Notes</span>
                      {validation.analyst_notes}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Narrative & Summary */}
            <div className="bg-[#0F172A] border border-slate-800 rounded overflow-hidden">
              <div className="px-4 py-2 bg-[#0A0F1C] border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-cyan-500" /> Attack Narrative
              </div>
              <div className="p-4 space-y-4 text-xs text-slate-300 leading-relaxed font-medium">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Incident Summary</span>
                  <p>{incident.summary}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Detailed Narrative</span>
                  <p className="whitespace-pre-wrap">{incident.narrative || "No narrative generated."}</p>
                </div>
              </div>
            </div>

            {/* MITRE ATT&CK */}
            <div className="bg-[#0F172A] border border-slate-800 rounded overflow-hidden">
              <div className="px-4 py-2 bg-[#0A0F1C] border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-amber-500" /> MITRE ATT&CK Mapping
              </div>
              <div className="p-4">
                {incident.mitre?.length > 0 ? (
                  <div className="space-y-2">
                    {incident.mitre.map((m: any, idx: number) => (
                      <div key={idx} className="p-3 bg-[#020617] border border-slate-800 rounded flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-cyan-400">{m.technique_id}</span>
                            <span className="text-xs font-bold text-slate-300">{m.name}</span>
                          </div>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">{m.tactic}</span>
                        </div>
                        {m.evidence?.length > 0 && (
                          <div className="text-[10px] text-slate-400 pl-2 border-l border-slate-700">
                            <span className="font-bold text-slate-500 mb-1 block">Evidence</span>
                            <ul className="list-disc list-inside">
                              {m.evidence.map((e: string, i: number) => <li key={i}>{e}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 font-mono">No MITRE techniques mapped.</span>
                )}
              </div>
            </div>

          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            
            {/* Telemetry & Entities */}
            <div className="bg-[#0F172A] border border-slate-800 rounded overflow-hidden">
              <div className="px-4 py-2 bg-[#0A0F1C] border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Observables
              </div>
              <div className="p-4 space-y-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1.5">Involved IPs</span>
                  <div className="flex flex-wrap gap-1.5">
                    {incident.entities?.ips?.map((ip: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-[#020617] border border-slate-700 text-purple-400 font-mono rounded">
                        {ip}
                      </span>
                    )) || <span className="text-slate-500 font-mono">None</span>}
                  </div>
                </div>

                {incident.entities?.domains?.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1.5">Domains</span>
                    <div className="flex flex-wrap gap-1.5">
                      {incident.entities.domains.map((d: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-[#020617] border border-slate-700 text-emerald-400 font-mono rounded">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Metadata</span>
                  <div className="space-y-1.5 text-slate-300 mt-2">
                    <div className="flex items-center justify-between bg-[#020617] px-2 py-1 border border-slate-800 rounded">
                      <span className="text-slate-500">Alerts Correlated</span>
                      <span className="font-mono">{incident.alert_count}</span>
                    </div>
                    {incident.entities?.countries?.length > 0 && (
                      <div className="flex items-center justify-between bg-[#020617] px-2 py-1 border border-slate-800 rounded">
                        <span className="text-slate-500">Geo Origin</span>
                        <span>{incident.entities.countries.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Cluster */}
            {incident.campaign && (
              <div className="bg-[#0F172A] border border-cyan-900/50 rounded overflow-hidden">
                <div className="px-4 py-2 bg-[#0A0F1C] border-b border-cyan-900/50 text-[10px] font-bold uppercase tracking-wider text-cyan-500 flex items-center justify-between">
                  <span>Campaign Cluster</span>
                  <Target className="w-3 h-3" />
                </div>
                <div className="p-4 text-xs space-y-2">
                  <p className="text-white font-bold">{incident.campaign.name}</p>
                  <p className="font-mono text-cyan-400 text-[10px]">{incident.campaign.cluster_id}</p>
                  <p className="text-slate-400">{incident.campaign.description}</p>
                  
                  <Link href={`/campaigns/${incident.campaign.cluster_id}`} className="mt-3 block text-center px-3 py-1.5 bg-[#020617] border border-cyan-900 hover:border-cyan-500 text-cyan-400 rounded transition-colors font-bold uppercase tracking-wider text-[10px]">
                    View Campaign Dossier
                  </Link>
                </div>
              </div>
            )}

            {/* Mitigations */}
            {incident.remediation && (
              <div className="bg-[#0F172A] border border-slate-800 rounded overflow-hidden">
                <div className="px-4 py-2 bg-[#0A0F1C] border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Remediation
                </div>
                <div className="p-4 text-xs">
                  <div className="flex items-start gap-2 text-slate-300">
                    <Terminal className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="whitespace-pre-wrap">{incident.remediation}</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}