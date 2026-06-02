"use client";

import { Terminal } from "lucide-react";
import VisualSimulator from "@/components/VisualSimulator";

export default function SimulatorPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto w-full p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Terminal className="text-emerald-400" />
          SOC Simulator Demo
        </h1>
      </div>

      <VisualSimulator />
    </div>
  );
}
