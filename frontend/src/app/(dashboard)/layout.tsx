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
    <div className="flex min-h-screen bg-[#02040a] text-slate-300 font-sans selection:bg-cyan-500/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/50 bg-[#050914]/80 backdrop-blur-3xl flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.5)] relative z-20">
        {/* Logo */}
        <Link href="/" className="p-6 flex items-center gap-3 border-b border-slate-800/50 hover:bg-white/[0.02] transition-colors relative group">
          <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Image
            src="/blackgate-logo.jpeg"
            alt="Blackgate"
            width={34}
            height={34}
            className="rounded-lg shadow-[0_0_15px_rgba(34,211,238,0.2)]"
          />
          <span className="text-white font-bold text-lg tracking-wide uppercase">
            Blackgate
          </span>
        </Link>

        <nav className="flex-1 p-5 space-y-8">
          {/* Main navigation */}
          <div className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all overflow-hidden group ${
                    isActive
                      ? "text-white bg-slate-800/50 border border-slate-700 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {/* Active glowing accent line */}
                  {isActive && (
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.color.replace('text-', 'bg-')} shadow-[0_0_10px_currentColor]`} />
                  )}
                  {/* Hover background glow */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${item.color.replace('text-', 'bg-')}`} />
                  
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? item.color : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* System section */}
          <div>
            <p className="px-4 pb-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
              System
            </p>
            <div className="space-y-1.5">
              {systemItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all overflow-hidden group ${
                      isActive
                        ? "text-white bg-slate-800/50 border border-slate-700 shadow-md"
                        : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {isActive && (
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.color.replace('text-', 'bg-')} shadow-[0_0_10px_currentColor]`} />
                    )}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${item.color.replace('text-', 'bg-')}`} />
                    
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? item.color : "text-slate-500 group-hover:text-slate-300"
                      }`}
                    />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
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
