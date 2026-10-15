"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingBag,
  ChevronDown,
  Building2,
  Layers,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const purchaseNavItems = [
  { name: "Purchase Dashboard", href: "/purchase/dashboard" },
  { name: "Purchase Requisition", href: "/purchase/requisitions" },
  { name: "Purchase Order", href: "/purchase/orders" },
  { name: "Purchase Receive", href: "/purchase/receive" },
  { name: "Purchase Return", href: "/purchase/returns" },
  { name: "Purchase Payment", href: "/purchase/supplier-payments" },
  { name: "Purchase Analytics", href: "/purchase/analytics" },
  { name: "Purchase Report", href: "/purchase/reports" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(true);

  return (
    <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-14 px-3 flex items-center justify-between border-b border-slate-800 bg-[#090d16]">
        <Link
          href="/purchase/requisitions"
          className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded w-full shadow-xs hover:bg-slate-50 transition"
          title="BridgeOne ERP"
        >
          <img
            src="/logo.png"
            alt="BridgeOne ERP"
            className="h-6 w-auto max-w-[150px] object-contain"
          />
          <span className="text-[9px] bg-sky-100 text-sky-800 font-extrabold px-1.5 py-0.5 rounded tracking-wide shrink-0">
            ERP
          </span>
        </Link>
      </div>

      {/* Company Context Selector */}
      <div className="px-3 py-2.5 bg-slate-900/60 border-b border-slate-800/80">
        <div className="flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-1.5 rounded hover:bg-slate-800/50 transition">
          <div className="flex items-center gap-2 overflow-hidden">
            <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate font-medium text-slate-200 text-[11px]">BridgeOne Tech Ltd.</span>
          </div>
          <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
        </div>
      </div>

      {/* Navigation Group */}
      <div className="flex-1 py-3 px-2 space-y-6 overflow-y-auto">
        <div>
          {/* Purchase Accordion Trigger matching Screenshot 2 */}
          <button
            type="button"
            onClick={() => setIsPurchaseOpen((prev) => !prev)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all select-none mb-1",
              isPurchaseOpen
                ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
            )}
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="font-semibold text-[13px]">Purchase</span>
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-blue-400 transition-transform duration-200 shrink-0",
                !isPurchaseOpen && "-rotate-90 text-slate-400"
              )}
            />
          </button>

          {/* Sub-menu Items matching Screenshot 2 with Bullet Dots */}
          {isPurchaseOpen && (
            <div className="space-y-0.5 pl-2 py-1">
              {purchaseNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/purchase/dashboard" && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-2 rounded-md text-[12.5px] transition-all",
                      isActive
                        ? "text-blue-400 font-semibold bg-blue-500/15"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 font-medium"
                    )}
                  >
                    {/* Bullet Dot */}
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all shrink-0",
                        isActive
                          ? "bg-blue-400 ring-2 ring-blue-400/30"
                          : "bg-slate-500"
                      )}
                    />
                    <span className="truncate flex-1">{item.name}</span>
                    {/* Active right border indicator bar matching Screenshot 2 */}
                    {isActive && (
                      <span className="absolute right-0 top-1.5 bottom-1.5 w-1 bg-blue-500 rounded-l" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Other ERP Modules Placeholder (Clear disabled status) */}
        <div className="pt-2 border-t border-slate-800/60">
          <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
            <span>Other ERP Modules</span>
            <span className="text-[9px] bg-slate-800 text-slate-500 px-1 py-0.2 rounded">Disabled</span>
          </div>
          <div className="space-y-0.5 opacity-40 cursor-not-allowed">
            <div className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-slate-400">
              <Layers className="w-3.5 h-3.5" />
              <span>Inventory & Warehousing</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-slate-400">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Finance & Accounts</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-slate-400">
              <Building2 className="w-3.5 h-3.5" />
              <span>Human Resources</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer System Status */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 bg-[#090d16]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Purchase Core
          </span>
          <span className="text-[10px] text-slate-400 font-mono">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
