"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Play, CheckCircle2, Loader2, ShieldAlert, Server, Network, BrainCircuit } from "lucide-react";
import { useState, useEffect } from "react";

export default function VisualSimulator() {
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isProcessing, setIsProcessing] = useState(false);

  const nodes = [
    {
      id: "source",
      label: "Cyber Attack Origin",
      layerName: "External Network",
      color: "bg-rose-500/20 border-rose-500/40",
      accent: "text-rose-500",
      glow: "shadow-[0_0_50px_rgba(244,63,94,0.3)]",
      baseGlow: "shadow-[0_0_30px_#f43f5e]",
      icon: Network,
      log: "Attack injected: TCP 103.202.61.57:443 \nTarget: Substation Relay 4",
    },
    {
      id: "ids",
      label: "Zeek / Suricata IDS",
      layerName: "Communications",
      color: "bg-blue-500/20 border-blue-500/40",
      accent: "text-blue-500",
      glow: "shadow-[0_0_50px_rgba(59,130,246,0.3)]",
      baseGlow: "shadow-[0_0_30px_#3b82f6]",
      icon: ShieldAlert,
      log: "Analyzing Traffic... \n[ALERT] ET MALWARE Suspicious TLS Cert",
    },
    {
      id: "es",
      label: "Elasticsearch Lake",
      layerName: "Protection Layer",
      color: "bg-amber-500/20 border-amber-500/40",
      accent: "text-amber-500",
      glow: "shadow-[0_0_50px_rgba(245,158,11,0.3)]",
      baseGlow: "shadow-[0_0_30px_#f59e0b]",
      icon: Server,
      log: "Correlating context...\nGeoIP: Russia\nHistorical Alerts: 2 found",
    },
    {
      id: "agent",
      label: "AI SOC Master Agent",
      layerName: "Applications Layer",
      color: "bg-emerald-500/20 border-emerald-500/40",
      accent: "text-emerald-500",
      glow: "shadow-[0_0_50px_rgba(16,185,129,0.3)]",
      baseGlow: "shadow-[0_0_30px_#10b981]",
      icon: BrainCircuit,
      log: "Clustering MITRE...\nHypothesis: Phantom Probe Campaign",
    },
  ];

  const triggerSimulation = () => {
    if (currentStep >= 0 && currentStep < nodes.length) return;
    setCurrentStep(0);
    setIsProcessing(true);
  };

  useEffect(() => {
    if (currentStep >= 0 && currentStep < nodes.length) {
      setIsProcessing(true);
      const timer = setTimeout(() => {
        setIsProcessing(false);
        setTimeout(() => {
          if (currentStep < nodes.length - 1) {
            setCurrentStep((prev) => prev + 1);
          } else {
            setTimeout(() => setCurrentStep(-1), 5000);
          }
        }, 1000);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  return (
    <div className="w-full bg-[#030712] border border-slate-800 rounded-2xl overflow-hidden relative min-h-[600px] flex flex-col shadow-2xl">
      <div className="absolute top-6 left-8 right-8 z-50 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 drop-shadow-md">
          Pipeline Architecture
        </h2>
        <button
          onClick={triggerSimulation}
          disabled={currentStep >= 0}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
        >
          {currentStep >= 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {currentStep >= 0 ? "Tracing Packet..." : "Run Packet Trace"}
        </button>
      </div>

      {/* Main Grid Background */}
      <div className="absolute inset-0 border border-slate-800/40 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />

      {/* Horizontal Flex Container */}
      <div className="flex-1 flex flex-row items-center justify-between px-10 relative z-10 mt-20">
        
        {/* Horizontal Connecting Line */}
        <div className="absolute left-[10%] right-[10%] top-1/2 h-1 bg-slate-800 rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] -z-10 -translate-y-1/2" />

        {nodes.map((node, i) => {
          const isActive = currentStep === i;
          const isPassed = currentStep > i;

          return (
            <div key={node.id} className="relative flex flex-col items-center flex-1">
              
              {/* Animated Horizontal Packet */}
              {isActive && !isProcessing && i > 0 && (
                <motion.div
                  initial={{ width: 0, left: "-100%" }}
                  animate={{ width: "100%", left: 0 }}
                  transition={{ duration: 1.0, ease: "easeInOut" }}
                  className={`absolute top-1/2 h-1 ${node.color.split(' ')[0]} ${node.glow} -z-10 -translate-y-1/2`}
                />
              )}

              {/* 3D Isometric Node Container */}
              <div 
                className="relative w-40 h-40 flex items-center justify-center perspective-[1000px]"
              >
                {/* 3D Floating Base Platform */}
                <motion.div
                  animate={isActive ? { y: 15 } : { y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute bottom-0 w-32 h-16 rounded-[50%] bg-[#0a0f18] border-2 border-b-[6px] border-slate-700 shadow-2xl flex items-center justify-center"
                >
                  <div className={`w-24 h-12 rounded-[50%] ${node.color} ${isActive ? node.baseGlow : ''} transition-all duration-700`} />
                </motion.div>

                {/* 3D Floating Glass Construct */}
                <motion.div 
                  className="absolute bottom-6 flex flex-col items-center justify-center"
                  animate={isActive && isProcessing ? { y: [-15, 5, -15] } : { y: 0 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="relative perspective-[1000px]">
                    <div 
                      className={`w-24 h-24 rounded-2xl flex items-center justify-center bg-[#0a0f18]/80 backdrop-blur-xl border border-slate-600/50 shadow-2xl overflow-hidden transition-all duration-700`}
                      style={{ transform: "rotateX(20deg) rotateY(-20deg)", transformStyle: "preserve-3d" }}
                    >
                      {/* Inner 3D Box glow */}
                      <div className={`absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent`} />
                      {isActive && (
                        <div className={`absolute inset-0 ${node.accent} opacity-30 bg-current blur-xl`} />
                      )}
                      
                      {/* Icon */}
                      <node.icon 
                        className={`w-12 h-12 ${node.accent} relative z-10 transition-all duration-700 ${isActive ? 'drop-shadow-[0_0_15px_currentColor] scale-110' : ''}`} 
                        strokeWidth={1.5} 
                        style={{ transform: "translateZ(20px)" }} 
                      />
                    </div>
                  </div>

                  {isPassed && (
                    <motion.div 
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute -top-3 -right-3 bg-emerald-500 text-black rounded-full p-0.5 shadow-[0_0_20px_#10b981] z-50"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* Text Labels below the 3D construct */}
              <div className="mt-8 text-center">
                <div className={`text-sm font-black uppercase tracking-widest ${node.accent} opacity-80`}>
                  {node.layerName}
                </div>
                <div className={`text-xs mt-1 font-semibold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {node.label}
                </div>
              </div>

              {/* Processing Terminal Tooltip */}
              <AnimatePresence>
                {isActive && isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute top-full mt-4 w-64 p-4 rounded-xl bg-[#050914]/95 border border-slate-700 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-3xl z-50 text-left"
                  >
                    <div className="flex gap-1.5 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-[0_0_5px_#ef4444]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shadow-[0_0_5px_#f59e0b]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shadow-[0_0_5px_#10b981]" />
                    </div>
                    <div className="font-mono text-xs text-cyan-400 whitespace-pre-wrap leading-relaxed font-semibold">
                      {node.log}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          );
        })}
      </div>
    </div>
  );
}
