"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Shield,
  Target,
  TerminalSquare,
  Search,
  Bell,
  Settings,
  User,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", icon: Activity, label: "Overview" },
    { href: "/incidents", icon: Shield, label: "Incidents" },
    { href: "/campaigns", icon: Target, label: "Campaigns" },
  ];

  const systemItems = [
    { href: "/simulator", icon: TerminalSquare, label: "Live Simulator" },
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-300 font-sans selection:bg-cyan-900/50 overflow-hidden">
      
      {/* Rigid Left Sidebar */}
      <aside className="w-60 border-r border-slate-800 bg-[#0F172A] flex flex-col flex-shrink-0 z-20">
        {/* Logo Area */}
        <Link href="/" className="h-14 px-4 flex items-center gap-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
          <Image
            src="/blackgate-logo.jpeg"
            alt="CampaignIQ"
            width={24}
            height={24}
            className="rounded shadow-sm"
          />
          <span className="text-white font-bold text-sm tracking-tight">
            CampaignIQ
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-3 mb-2">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Analyze</h3>
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-cyan-900/40 text-cyan-400 border border-cyan-800/50"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="px-3 mt-6">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">System</h3>
            <div className="space-y-0.5">
              {systemItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-cyan-900/40 text-cyan-400 border border-cyan-800/50"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
            <span className="text-[10px] text-slate-400 font-mono">Agent Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Global Top Nav & Search Bar */}
        <header className="h-14 border-b border-slate-800 bg-[#0F172A] flex items-center justify-between px-4 z-10 flex-shrink-0">
          
          {/* Mock KQL / SPL Query Bar */}
          <div className="flex-1 max-w-3xl flex items-center bg-[#020617] border border-slate-700 rounded text-sm group focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all">
            <div className="pl-3 pr-2 py-2 text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input 
              type="text" 
              placeholder="Query events (e.g. event.category: network AND source.ip: 10.0.0.*)" 
              className="flex-1 bg-transparent border-none focus:outline-none text-slate-200 text-xs font-mono placeholder:text-slate-600 placeholder:font-sans py-2 h-full"
            />
            <div className="pr-2">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-medium border border-slate-700">KQL</span>
            </div>
          </div>

          {/* Top Right Utilities */}
          <div className="flex items-center gap-4 ml-4">
            <button className="text-slate-400 hover:text-slate-200 transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-[#0F172A]"></span>
            </button>
            <button className="text-slate-400 hover:text-slate-200 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-700"></div>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
                <User className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-300">Admin</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[#020617]">
          {children}
        </main>
      </div>
    </div>
  );
}
