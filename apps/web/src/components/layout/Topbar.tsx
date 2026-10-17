"use client";

import React from "react";
import { Search, Bell, HelpCircle, User, ShieldCheck } from "lucide-react";

export function Topbar() {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
      {/* Quick Search */}
      <div className="flex items-center gap-3 w-96">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Quick search requisition, PO, supplier, item (Ctrl + K)..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Environment Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-600 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
          <span>Purchase Admin Mode</span>
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500"></span>
        </button>

        {/* Help */}
        <button
          type="button"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
          title="ERP User Manual"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-slate-200"></div>

        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-1 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-300 text-sky-800 flex items-center justify-center font-semibold text-xs shadow-inner">
            FH
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-800 leading-tight">Fuad Hossain</div>
            <div className="text-[10px] text-slate-500 leading-tight">Jr. Developer</div>
          </div>
        </div>
      </div>
    </header>
  );
}
