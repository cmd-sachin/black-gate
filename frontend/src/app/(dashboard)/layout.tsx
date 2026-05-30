"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Shield,
  Target,
  Database,
  TerminalSquare,
} from "lucide-react";
import Image from "next/image";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", icon: Activity, label: "Overview", color: "text-cyan-400" },
    { href: "/incidents", icon: Shield, label: "Incidents", color: "text-rose-400" },
    { href: "/campaigns", icon: Target, label: "Campaigns", color: "text-amber-400" },
  ];

  const systemItems = [
    { href: "/simulator", icon: TerminalSquare, label: "Live Simulator", color: "text-emerald-400" },
  ];

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-300 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0f1c] flex flex-col">
        {/* Logo */}
        <Link href="/" className="p-6 flex items-center gap-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
          <Image
            src="/blackgate-logo.jpeg"
            alt="Blackgate"
            width={32}
            height={32}
            className="rounded"
          />
          <span className="text-white font-bold text-lg tracking-tight">
            Blackgate
          </span>
        </Link>

        <nav className="flex-1 p-4 space-y-6">
          {/* Main navigation */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white/10 border border-white/10 text-white shadow-sm"
                      : "hover:bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? item.color : "text-slate-500"
                    }`}
                  />
                  {item.label}
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* System section */}
          <div>
            <p className="px-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              System
            </p>
            <div className="space-y-1">
              {systemItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-white/10 border border-white/10 text-white shadow-sm"
                        : "hover:bg-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? item.color : "text-slate-500"
                      }`}
                    />
                    {item.label}
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </Link>
                );
              })}

              {/* Disabled Elastic Search */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-50 cursor-not-allowed text-sm font-medium">
                <Database className="w-4 h-4 text-slate-500" />
                Elastic Search (MCP)
              </div>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/5">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            ← Back to website
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}