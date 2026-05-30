"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Terminal, Send, Loader2, Zap, StopCircle } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

export default function SimulatorPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [packetLogs, setPacketLogs] = useState<string[]>([]);
  const [agentInput, setAgentInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Auto‑scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [packetLogs]);

  // Auto‑scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Start live packet stream via SSE
  const startStreaming = useCallback(() => {
    if (isStreaming) return;
    setIsStreaming(true);
    setPacketLogs([]);

    const es = new EventSource(`${API_BASE}/api/simulator/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const proto = data.protocol || "ETH";
        const src = data.src_ip
          ? `${data.src_ip}${data.src_port ? ":" + data.src_port : ""}`
          : data.src_mac || "?";
        const dst = data.dst_ip
          ? `${data.dst_ip}${data.dst_port ? ":" + data.dst_port : ""}`
          : data.dst_mac || "?";
        const ts = data.timestamp?.split("T")[1]?.split(".")[0] || "";
        const line = `${String(data.index).padStart(5, "0")} ${ts}  ${proto.padEnd(5)} ${src}  →  ${dst}`;
        setPacketLogs((prev) => {
          const next = [...prev, line];
          return next.length > 500 ? next.slice(-500) : next;
        });
      } catch {
        setPacketLogs((prev) => [...prev, event.data]);
      }
    };

    es.onerror = () => {
      setPacketLogs((prev) => [...prev, "--- Stream ended ---"]);
      es.close();
      setIsStreaming(false);
    };

    es.onopen = () => {
      setPacketLogs((prev) => [...prev, "--- Connected to packet stream ---"]);
    };
  }, [isStreaming]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    setPacketLogs((prev) => [...prev, "--- Stream stopped ---"]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Send prompt to the real ADK agent via /agent/chat
  const sendAgentPrompt = async () => {
    const message = agentInput.trim();
    if (!message) return;

    setChatHistory((prev) => [
      ...prev,
      { role: "user", content: message, timestamp: new Date().toLocaleTimeString() },
    ]);
    setAgentInput("");
    setAgentLoading(true);

    try {
      const response = await fetch(`${API_BASE}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      const data = await response.json();

      setChatHistory((prev) => [
        ...prev,
        {
          role: "agent",
          content: data.response || "No response from agent.",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "agent",
          content: `Error: ${String(err)}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setAgentLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Terminal className="text-emerald-400" />
          Live Simulator
        </h1>
        <div className="flex gap-3">
          {!isStreaming ? (
            <button
              onClick={startStreaming}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Zap className="w-4 h-4" /> Start Packet Stream
            </button>
          ) : (
            <button
              onClick={stopStreaming}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <StopCircle className="w-4 h-4" /> Stop Stream
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matrix‑style packet terminal */}
        <div className="lg:col-span-2 bg-black/40 border border-emerald-500/20 rounded-xl overflow-hidden flex flex-col h-[600px]">
          <div className="px-5 py-3 border-b border-emerald-500/20 flex items-center justify-between bg-black/20">
            <h2 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Packet Stream
            </h2>
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  isStreaming ? "bg-emerald-500 animate-pulse" : "bg-slate-600"
                }`}
              />
              {isStreaming ? "LIVE" : "OFFLINE"} · {packetLogs.length} events
            </span>
          </div>
          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm text-emerald-300 space-y-0.5"
            style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
          >
            {packetLogs.length === 0 ? (
              <div className="text-slate-500">
                {isStreaming
                  ? "Waiting for packet events..."
                  : "Click 'Start Packet Stream' to begin the live feed from packets.hex"}
              </div>
            ) : (
              packetLogs.map((line, idx) => (
                <div key={idx} className="whitespace-pre leading-tight">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Agent Chat Panel */}
        <div className="bg-white/5 border border-white/10 rounded-xl flex flex-col h-[600px]">
          <div className="px-5 py-3 border-b border-white/10 bg-black/20">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Agent Interface
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Ask the Blackgate agent about threats, incidents, or campaigns.
            </p>
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatHistory.length === 0 && !agentLoading && (
              <div className="text-xs text-slate-500 text-center py-8 space-y-2">
                <p>Ask anything about the ingested data.</p>
                <p className="text-slate-600">
                  Examples: "What campaigns were found?" · "Summarize
                  incident INC-192168110-5" · "What MITRE techniques are
                  most common?"
                </p>
              </div>
            )}

            {chatHistory.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg text-sm ${
                  msg.role === "user"
                    ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-100 ml-8"
                    : "bg-black/20 border border-white/10 text-slate-200 mr-4"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-400">
                    {msg.role === "user" ? "You" : "Blackgate Agent"}
                  </span>
                  <span className="text-xs text-slate-600">{msg.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {agentLoading && (
              <div className="flex items-center gap-2 text-sm text-cyan-400 p-3">
                <Loader2 className="w-4 h-4 animate-spin" /> Agent is
                reasoning…
              </div>
            )}
          </div>

          <div className="p-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about incidents, campaigns, entities..."
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !agentLoading && sendAgentPrompt()}
                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={sendAgentPrompt}
                disabled={agentLoading || !agentInput.trim()}
                className="p-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}