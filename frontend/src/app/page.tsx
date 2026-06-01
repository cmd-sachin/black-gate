"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

// ----------------------------------------------------------------------
// Navbar
// ----------------------------------------------------------------------
const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#020617]/80 border-b border-white/5">
    <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Image
          src="/blackgate-logo.jpeg"
          alt="Blackgate"
          width={32}
          height={32}
          className="rounded"
        />
        <span className="text-white font-bold text-lg tracking-tight">Blackgate</span>
      </div>
      <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
        <Link href="#" className="hover:text-white transition-colors">Product</Link>
        <Link href="#" className="hover:text-white transition-colors">Architecture</Link>
        <Link href="#" className="hover:text-white transition-colors">Docs</Link>
        <Link href="#" className="hover:text-white transition-colors">Demo</Link>
      </div>
      <Link href="/dashboard" className="px-4 py-2 rounded-lg border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition-colors">
        Go to Dashboard
      </Link>
    </div>
  </nav>
);

// ----------------------------------------------------------------------
// Main Page
// ----------------------------------------------------------------------
export default function Home() {
  const router = useRouter();
  const [isSimulating, setIsSimulating] = useState(false);
  const [activePhase, setActivePhase] = useState<number | null>(null);

  const runSimulation = () => {
    setIsSimulating(true);
    router.push("/simulator");
  };

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.15 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-40 pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5" />
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 max-w-5xl mx-auto text-center"
        >
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-white via-cyan-200 to-amber-200 bg-clip-text text-transparent">
              Blackgate
            </span>
          </motion.h1>
          <motion.p variants={itemVariants} className="mt-4 text-xl md:text-2xl text-slate-300 font-medium">
            Security with no blindspots
          </motion.p>
          <motion.p variants={itemVariants} className="mt-6 max-w-3xl mx-auto text-slate-400 text-lg leading-relaxed">
            Turn raw telemetry into actionable intelligence. Our agentic platform correlates anomalies,
            maps MITRE ATT&CK patterns, and delivers contextual threat hypotheses — so your SOC team sees everything.
          </motion.p>
          <motion.div variants={itemVariants} className="mt-12 flex justify-center gap-4">
            <button
              onClick={runSimulation}
              disabled={isSimulating}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-amber-600 text-white font-semibold text-base uppercase tracking-wider shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-300 disabled:opacity-70"
            >
              {isSimulating ? "Launching..." : "Run Live Demo"}
            </button>
            <a
              href="#architecture"
              className="px-8 py-4 rounded-xl border border-white/10 text-slate-300 font-semibold text-base uppercase tracking-wider hover:bg-white/5 hover:scale-105 transition-all duration-300"
            >
              View Architecture
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* What we do */}
      <section className="px-6 py-20 bg-[#0a0f1c] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-bold text-center text-white"
          >
            What we do
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-slate-400 max-w-3xl mx-auto text-center leading-relaxed"
          >
            From raw honeypot logs to finished intelligence — our pipeline automates the entire SOC workflow.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mt-16">
            {[
              { icon: "/file.svg", label: "Raw Logs", desc: "PCAP / NetFlow", needsLight: false },
              { icon: "/elastic-security-icon.png", label: "Zeek & Suricata", desc: "Protocols & Anomalies", needsLight: false },
              { icon: "/elastic-logo.svg", label: "Elastic Security", desc: "Serverless Agent (MCP)", needsLight: true },
              { icon: "/google-cloud-logo.svg", label: "Google ADK", desc: "Reasoning & Hypothesis", needsLight: false },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="flex flex-col items-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/20 transition-all duration-300"
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${step.needsLight ? "bg-white" : "bg-white/10"}`}>
                  <Image
                    src={step.icon}
                    alt={step.label}
                    width={step.icon.includes("logo") ? 40 : 28}
                    height={step.icon.includes("logo") ? 28 : 28}
                    className={step.needsLight ? "" : "invert"}
                  />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-200">{step.label}</p>
                <p className="text-xs text-slate-500 mt-1">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-center text-slate-500 text-sm mt-12"
          >
            Result: <span className="text-cyan-400 font-medium">95% less alert noise</span>, every incident MITRE‑mapped and context‑rich.
          </motion.p>
        </div>
      </section>

      {/* Why Blackgate */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-bold text-white"
          >
            Why Blackgate
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            {[
              { title: "Autonomous Triage", desc: "Millions of logs reduced to ~100 incidents, around the clock." },
              { title: "Contextual Intelligence", desc: "Enriched with GeoIP, current affairs, and MITRE ATT&CK mapping." },
              { title: "Agentic Pipeline", desc: "Google ADK orchestrates Elastic MCP, subagent ingestion, and hypothesis generation." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/20 transition-all duration-300"
              >
                <h3 className="text-lg font-semibold text-cyan-400">{item.title}</h3>
                <p className="text-slate-400 text-sm mt-2">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Agentic Architecture – Comprehensive 7-Phase Pipeline */}
      <section id="architecture" className="px-6 py-20 bg-[#0a0f1c] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center text-white"
          >
            Agentic Architecture
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-slate-400 max-w-3xl mx-auto text-center leading-relaxed"
          >
            A seven‑phase pipeline orchestrated by a dual‑agent system – from raw packet capture to validated intelligence.
          </motion.p>

          {/* Full Architecture Diagram (SVG) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mt-12 relative"
          >
            <svg viewBox="0 0 1200 650" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
                </marker>
              </defs>

              {/* Phases Row */}
              <rect x="40" y="40" width="160" height="60" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
              <text x="120" y="62" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">PHASE 1</text>
              <text x="120" y="78" textAnchor="middle" fill="#cbd5e1" fontSize="8">Ingestion & Simulation</text>
              <text x="120" y="90" textAnchor="middle" fill="#94a3b8" fontSize="7">Zeek / Suricata + GeoIP</text>

              <rect x="260" y="40" width="160" height="60" rx="8" fill="#1e293b" stroke="#a78bfa" strokeWidth="1.5" />
              <text x="340" y="62" textAnchor="middle" fill="#a78bfa" fontSize="10" fontWeight="bold">PHASE 2</text>
              <text x="340" y="78" textAnchor="middle" fill="#cbd5e1" fontSize="8">Correlation & Grouping</text>
              <text x="340" y="90" textAnchor="middle" fill="#94a3b8" fontSize="7">Alert → Incident</text>

              <rect x="480" y="40" width="160" height="60" rx="8" fill="#1e293b" stroke="#f97316" strokeWidth="1.5" />
              <text x="560" y="62" textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="bold">PHASE 3</text>
              <text x="560" y="78" textAnchor="middle" fill="#cbd5e1" fontSize="8">MITRE ATT&CK Mapping</text>
              <text x="560" y="90" textAnchor="middle" fill="#94a3b8" fontSize="7">Tactic & Technique</text>

              <rect x="700" y="40" width="160" height="60" rx="8" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.5" />
              <text x="780" y="62" textAnchor="middle" fill="#fbbf24" fontSize="10" fontWeight="bold">PHASE 4</text>
              <text x="780" y="78" textAnchor="middle" fill="#cbd5e1" fontSize="8">Campaign Clustering</text>
              <text x="780" y="90" textAnchor="middle" fill="#94a3b8" fontSize="7">Behavioral Hash</text>

              <rect x="920" y="40" width="160" height="60" rx="8" fill="#1e293b" stroke="#34d399" strokeWidth="1.5" />
              <text x="1000" y="62" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="bold">PHASE 5</text>
              <text x="1000" y="78" textAnchor="middle" fill="#cbd5e1" fontSize="8">Cognitive Enrichment</text>
              <text x="1000" y="90" textAnchor="middle" fill="#94a3b8" fontSize="7">AI Narrative & Summary</text>

              <rect x="920" y="140" width="160" height="60" rx="8" fill="#1e293b" stroke="#f43f5e" strokeWidth="1.5" />
              <text x="1000" y="162" textAnchor="middle" fill="#f43f5e" fontSize="10" fontWeight="bold">PHASE 6</text>
              <text x="1000" y="178" textAnchor="middle" fill="#cbd5e1" fontSize="8">AI Validation Gate</text>
              <text x="1000" y="190" textAnchor="middle" fill="#94a3b8" fontSize="7">Confirm / Reject</text>

              <rect x="920" y="240" width="160" height="60" rx="8" fill="#1e293b" stroke="#8b5cf6" strokeWidth="1.5" />
              <text x="1000" y="262" textAnchor="middle" fill="#8b5cf6" fontSize="10" fontWeight="bold">PHASE 7</text>
              <text x="1000" y="278" textAnchor="middle" fill="#cbd5e1" fontSize="8">Storage & Dashboard</text>
              <text x="1000" y="290" textAnchor="middle" fill="#94a3b8" fontSize="7">React + FastAPI</text>

              {/* Subagent */}
              <rect x="60" y="280" width="180" height="80" rx="10" fill="#1e293b" stroke="#a78bfa" strokeWidth="2" />
              <text x="150" y="305" textAnchor="middle" fill="#a78bfa" fontSize="11" fontWeight="bold">SUBAGENT</text>
              <text x="150" y="320" textAnchor="middle" fill="#cbd5e1" fontSize="8">network_simulation</text>
              <text x="150" y="335" textAnchor="middle" fill="#94a3b8" fontSize="7">Run IDS + Ingest</text>
              <text x="150" y="350" textAnchor="middle" fill="#94a3b8" fontSize="7">enrich_alert_documents()</text>

              {/* Main Agent */}
              <rect x="350" y="265" width="220" height="110" rx="12" fill="#1e293b" stroke="#fbbf24" strokeWidth="2" />
              <text x="460" y="290" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="bold">MAIN AGENT</text>
              <text x="460" y="305" textAnchor="middle" fill="#cbd5e1" fontSize="8">soc_orchestrator_master</text>
              <text x="460" y="320" textAnchor="middle" fill="#94a3b8" fontSize="7">Gemini 2.5 Flash via ADK</text>
              <text x="460" y="335" textAnchor="middle" fill="#94a3b8" fontSize="7">Uses tools, MCP, memory</text>
              <text x="460" y="350" textAnchor="middle" fill="#94a3b8" fontSize="7">Writes IncidentIntelligence</text>

              {/* Memory (Elasticsearch) */}
              <rect x="60" y="440" width="280" height="90" rx="10" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
              {/* White background for Elastic logo */}
              <rect x="80" y="450" width="90" height="30" rx="4" fill="#ffffff" />
              <foreignObject x="80" y="450" width="90" height="30">
                <div className="flex items-center justify-center h-full">
                  <Image src="/elastic-logo.svg" alt="Elastic" width={70} height={20} />
                </div>
              </foreignObject>
              <text x="170" y="468" textAnchor="middle" fill="#06b6d4" fontSize="12" fontWeight="bold">Elasticsearch</text>
              <text x="200" y="490" textAnchor="middle" fill="#94a3b8" fontSize="8">security-alerts</text>
              <text x="200" y="505" textAnchor="middle" fill="#94a3b8" fontSize="8">security-incidents / campaigns</text>

              {/* Tools Panel (Main Agent side) */}
              <rect x="660" y="265" width="200" height="220" rx="10" fill="#1e293b" stroke="#f97316" strokeWidth="1.5" />
              <text x="760" y="290" textAnchor="middle" fill="#f97316" fontSize="11" fontWeight="bold">AGENT TOOLS</text>
              <text x="760" y="315" textAnchor="middle" fill="#94a3b8" fontSize="7">trigger_correlation_pipeline</text>
              <text x="760" y="335" textAnchor="middle" fill="#94a3b8" fontSize="7">enrich_recent_investigation</text>
              <text x="760" y="355" textAnchor="middle" fill="#94a3b8" fontSize="7">master_run_security_queries</text>
              <text x="760" y="375" textAnchor="middle" fill="#94a3b8" fontSize="7">master_threat_intel_hypothesis</text>
              <text x="760" y="395" textAnchor="middle" fill="#94a3b8" fontSize="7">run_master_soc_pipeline</text>
              {/* Elastic MCP inside tools */}
              <rect x="685" y="420" width="150" height="30" rx="4" fill="#ffffff" />
              <foreignObject x="685" y="420" width="150" height="30">
                <div className="flex items-center justify-center h-full">
                  <Image src="/elastic-logo.svg" alt="Elastic MCP" width={80} height={20} />
                </div>
              </foreignObject>
              <text x="760" y="462" textAnchor="middle" fill="#06b6d4" fontSize="7">Elastic MCP (ES|QL)</text>

              {/* Connections */}
              <line x1="200" y1="70" x2="255" y2="70" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <line x1="420" y1="70" x2="475" y2="70" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <line x1="640" y1="70" x2="695" y2="70" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <line x1="860" y1="70" x2="915" y2="70" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <line x1="1000" y1="100" x2="1000" y2="135" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <line x1="1000" y1="200" x2="1000" y2="235" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />

              {/* Agent to phase connections */}
              <line x1="150" y1="280" x2="120" y2="105" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5,5" markerEnd="url(#arrow)" />
              <line x1="150" y1="360" x2="150" y2="435" stroke="#06b6d4" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <line x1="460" y1="265" x2="460" y2="105" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="5,5" markerEnd="url(#arrow)" />
              <line x1="570" y1="320" x2="655" y2="320" stroke="#fbbf24" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <line x1="460" y1="375" x2="200" y2="435" stroke="#06b6d4" strokeWidth="1.5" markerEnd="url(#arrow)" />

              {/* Tool to phase connections */}
              <line x1="760" y1="265" x2="760" y2="105" stroke="#f97316" strokeWidth="1.5" strokeDasharray="5,5" />
              <line x1="660" y1="280" x2="560" y2="280" stroke="#f97316" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <line x1="660" y1="300" x2="560" y2="300" stroke="#f97316" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <line x1="660" y1="320" x2="560" y2="320" stroke="#f97316" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <line x1="660" y1="340" x2="560" y2="340" stroke="#f97316" strokeWidth="1.5" markerEnd="url(#arrow)" />
            </svg>
          </motion.div>

          {/* Interactive Phase Details */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[
              { phase: 1, title: "Ingestion & Enrichment", desc: "Raw PCAP decoded via Zeek/Suricata. GeoIP enrichment via MaxMind. Indexed by subagent.", tool: "run_simulated_ids_pipeline" },
              { phase: 2, title: "Correlation & Grouping", desc: "Alerts grouped by source IP into Incidents. One IP = one incident for clear story.", tool: "correlate_alerts" },
              { phase: 3, title: "MITRE ATT&CK Mapping", desc: "Rules cross-referenced with MITRE knowledge. Adds Tactic & Technique.", tool: "map_alerts_to_mitre" },
              { phase: 4, title: "Campaign Clustering", desc: "Incidents clustered into campaigns via behavioral hash.", tool: "cluster_campaign" },
              { phase: 5, title: "Cognitive Enrichment", desc: "Gemini writes summary, narrative, and remediation steps.", tool: "fetch_llm_intelligence" },
              { phase: 6, title: "AI Validation Gate", desc: "Gemini validates if incident is real threat or false positive.", tool: "validate_incident" },
              { phase: 7, title: "Storage & Dashboard", desc: "Validated incident stored in ES. React dashboard displays KPIs & timeline.", tool: "FastAPI + React" },
            ].map((item) => (
              <motion.div
                key={item.phase}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: item.phase * 0.05 }}
                whileHover={{ y: -5 }}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                  activePhase === item.phase
                    ? "bg-cyan-500/10 border-cyan-400/50"
                    : "bg-white/5 border-white/10 hover:border-cyan-500/30"
                }`}
                onClick={() => setActivePhase(activePhase === item.phase ? null : item.phase)}
              >
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-bold shrink-0">
                    {item.phase}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                    {activePhase === item.phase && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        className="mt-2 pt-2 border-t border-white/10"
                      >
                        <p className="text-xs text-cyan-400 font-mono">Tool: {item.tool}</p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center border-t border-white/5 bg-[#020617]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-slate-400 mb-4">
            <span>Powered by</span>
            <div className="bg-white rounded-lg p-1">
              <Image src="/elastic-logo.svg" alt="Elastic" width={70} height={20} />
            </div>
            <span>and</span>
            <Image src="/google-cloud-logo.svg" alt="Google Cloud" width={80} height={24} />
          </div>
          <p className="text-xs text-slate-500 mt-4">Blackgate – Turning raw logs into intelligence</p>
          <p className="text-xs text-slate-600 mt-2">
            Released under the{" "}
            <Link href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">
              MIT License
            </Link>
            . Contribute on GitHub.
          </p>
        </div>
      </footer>
    </div>
  );
}
