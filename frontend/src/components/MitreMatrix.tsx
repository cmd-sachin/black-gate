"use client";

import { ShieldCheck, Bot, Database, Sparkles, Layers } from "lucide-react";

/**
 * MITRE ATT&CK matrix heatmap.
 *
 * Groups the incident's techniques into kill-chain tactic columns and colours
 * each technique cell by mapping confidence (hotter = higher confidence). Each
 * cell also carries a provenance badge sourced from the backend mitre_mapper
 * (elastic_rule | elastic_related | mitre_knowledge | gemini | deterministic |
 * hybrid), so analysts can see *why* a technique was mapped.
 */

export interface MitreTechnique {
  technique_id?: string;
  name?: string;
  technique_name?: string;
  tactic?: string;
  confidence?: number;
  source?: string;
  evidence?: string[];
}

// Canonical MITRE ATT&CK Enterprise tactic order (kill-chain left-to-right).
const TACTIC_ORDER = [
  "Reconnaissance",
  "Resource Development",
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Discovery",
  "Lateral Movement",
  "Collection",
  "Command and Control",
  "Exfiltration",
  "Impact",
];

function tacticRank(tactic: string): number {
  const idx = TACTIC_ORDER.findIndex(
    (t) => t.toLowerCase() === (tactic || "").toLowerCase()
  );
  return idx === -1 ? TACTIC_ORDER.length : idx;
}

// Confidence -> heatmap colour. Higher confidence reads "hotter".
function confidenceStyle(confidence: number): string {
  if (confidence >= 0.85) return "bg-rose-500/15 border-rose-500/40 text-rose-200";
  if (confidence >= 0.7) return "bg-orange-500/15 border-orange-500/40 text-orange-200";
  if (confidence >= 0.5) return "bg-amber-500/10 border-amber-500/30 text-amber-200";
  return "bg-slate-700/20 border-slate-700 text-slate-300";
}

const SOURCE_META: Record<string, { label: string; cls: string; Icon: typeof Bot }> = {
  elastic_rule: { label: "Elastic Rule", cls: "text-cyan-400 border-cyan-500/30", Icon: ShieldCheck },
  elastic_related: { label: "Elastic Related", cls: "text-sky-400 border-sky-500/30", Icon: ShieldCheck },
  mitre_knowledge: { label: "Knowledge Base", cls: "text-violet-400 border-violet-500/30", Icon: Database },
  gemini: { label: "Gemini", cls: "text-fuchsia-400 border-fuchsia-500/30", Icon: Sparkles },
  deterministic: { label: "Heuristic", cls: "text-slate-400 border-slate-600", Icon: Layers },
  hybrid: { label: "Hybrid", cls: "text-emerald-400 border-emerald-500/30", Icon: Bot },
};

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const meta = SOURCE_META[source] || { label: source, cls: "text-slate-400 border-slate-600", Icon: Layers };
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${meta.cls}`}
      title={`Mapping source: ${meta.label}`}
    >
      <Icon className="w-2.5 h-2.5" /> {meta.label}
    </span>
  );
}

export default function MitreMatrix({ techniques }: { techniques?: MitreTechnique[] }) {
  if (!techniques || techniques.length === 0) {
    return <span className="text-xs text-slate-500 font-mono">No MITRE techniques mapped.</span>;
  }

  // Group techniques by tactic.
  const byTactic = new Map<string, MitreTechnique[]>();
  for (const t of techniques) {
    const tactic = t.tactic || "Unknown";
    if (!byTactic.has(tactic)) byTactic.set(tactic, []);
    byTactic.get(tactic)!.push(t);
  }

  const columns = Array.from(byTactic.entries()).sort(
    (a, b) => tacticRank(a[0]) - tacticRank(b[0])
  );

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {columns.map(([tactic, items]) => (
        <div key={tactic} className="min-w-[150px] flex-1 shrink-0">
          <div className="px-2 py-1 mb-1.5 bg-[#0A0F1C] border border-slate-800 rounded text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span className="truncate" title={tactic}>{tactic}</span>
            <span className="font-mono text-slate-500">{items.length}</span>
          </div>
          <div className="space-y-1.5">
            {items
              .slice()
              .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
              .map((m, idx) => {
                const conf = m.confidence ?? 0;
                return (
                  <div
                    key={`${m.technique_id}-${idx}`}
                    className={`p-2 rounded border ${confidenceStyle(conf)}`}
                    title={(m.evidence || []).join("\n")}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] font-bold">{m.technique_id}</span>
                      <span className="font-mono text-[9px] opacity-70">{Math.round(conf * 100)}%</span>
                    </div>
                    <div className="text-[10px] leading-tight mt-0.5 text-slate-200/90 line-clamp-2">
                      {m.technique_name || m.name}
                    </div>
                    <div className="mt-1.5">
                      <SourceBadge source={m.source} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
