"use client";

import { ArrowRight } from "lucide-react";

/**
 * Evidence timeline — renders the raw alerts that built an incident as a
 * chronological forensic sequence (time -> detector + signature -> src→dst).
 * Fed from the incident's `raw_alerts_preview` (Zeek/Suricata documents).
 */

export interface EvidenceAlert {
  timestamp?: string;
  "@timestamp"?: string;
  tool?: string;
  alert?: string;
  signature?: string;
  query?: string;
  event_type?: string;
  source_ip?: string;
  dest_ip?: string;
  destination_ip?: string;
}

const TOOL_COLOR: Record<string, string> = {
  suricata: "text-rose-400 border-rose-500/40 bg-rose-500/10",
  zeek: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
};

function ts(a: EvidenceAlert): string {
  return a.timestamp || a["@timestamp"] || "";
}

function label(a: EvidenceAlert): string {
  return a.alert || a.signature || a.query || a.event_type || "Network event";
}

export default function EvidenceTimeline({ alerts }: { alerts?: EvidenceAlert[] }) {
  if (!alerts || alerts.length === 0) {
    return <span className="text-xs text-slate-500 font-mono">No raw evidence retained for this incident.</span>;
  }

  const sorted = alerts
    .slice()
    .sort((a, b) => ts(a).localeCompare(ts(b)));

  return (
    <ol className="relative space-y-3 pl-4">
      {/* connecting spine */}
      <span className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-800" aria-hidden />
      {sorted.map((a, i) => {
        const tool = (a.tool || "").toLowerCase();
        const toolCls = TOOL_COLOR[tool] || "text-slate-400 border-slate-600 bg-slate-700/20";
        const dst = a.dest_ip || a.destination_ip;
        const when = ts(a);
        return (
          <li key={i} className="relative">
            <span className="absolute -left-4 top-1 w-[11px] h-[11px] rounded-full border-2 border-slate-600 bg-[#020617]" aria-hidden />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] text-slate-500">
                {when ? new Date(when).toLocaleString("sv") : "—"}
              </span>
              {a.tool && (
                <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${toolCls}`}>
                  {a.tool}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-200 font-medium mt-0.5">{label(a)}</p>
            {(a.source_ip || dst) && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-slate-400">
                <span className="text-purple-400">{a.source_ip || "?"}</span>
                <ArrowRight className="w-3 h-3 text-slate-600" />
                <span className="text-emerald-400">{dst || "?"}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
