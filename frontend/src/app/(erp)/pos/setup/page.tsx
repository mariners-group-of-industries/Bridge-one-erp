"use client";

import React, { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";

type SetupSection =
  | null
  | "DISCOUNT_OFFER"
  | "COUNTER_SETUP"
  | "SALES_SETUP"
  | "POINT_REDEEM_OTP"
  | "FLOOR_TABLE_SETUP";

function DiscountOfferIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-12" fill="none">
      {/* Bottom ribbons */}
      <path d="M24 42L19 56L26 52L30 57L31 44" fill="#1e293b" />
      <path d="M40 42L45 56L38 52L34 57L33 44" fill="#0f172a" />
      {/* Starburst badge */}
      <path
        d="M32 8L36.9 12.2L43.3 11L45.5 17.1L51.6 19.3L50.4 25.7L54.6 30.6L50.4 35.5L51.6 41.9L45.5 44.1L43.3 50.2L36.9 49L32 53.2L27.1 49L20.7 50.2L18.5 44.1L12.4 41.9L13.6 35.5L9.4 30.6L13.6 25.7L12.4 19.3L18.5 17.1L20.7 11L27.1 12.2L32 8Z"
        fill="#ff2e38"
      />
      {/* Sparkles */}
      <circle cx="48" cy="10" r="1.3" fill="#ff2e38" />
      <circle cx="53" cy="14" r="1" fill="#ff2e38" />
      {/* % symbol */}
      <circle cx="26.5" cy="25.5" r="3" stroke="#ffffff" strokeWidth="2.2" />
      <circle cx="37.5" cy="35.5" r="3" stroke="#ffffff" strokeWidth="2.2" />
      <path
        d="M38 24L26 37"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CounterSetupIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-12" fill="none">
      {/* Monitor frame */}
      <rect x="14" y="8" width="36" height="26" rx="2" fill="#2563eb" />
      <rect x="18" y="12" width="28" height="18" rx="1" fill="#e0f2fe" />
      {/* Keypad dots on screen */}
      <rect x="20" y="14" width="4" height="3" fill="#3b82f6" />
      <rect x="25.5" y="14" width="4" height="3" fill="#3b82f6" />
      <rect x="31" y="14" width="4" height="3" fill="#3b82f6" />
      <rect x="20" y="18.5" width="4" height="3" fill="#3b82f6" />
      <rect x="25.5" y="18.5" width="4" height="3" fill="#3b82f6" />
      <rect x="31" y="18.5" width="4" height="3" fill="#3b82f6" />
      <rect x="20" y="23" width="4" height="3" fill="#3b82f6" />
      <rect x="25.5" y="23" width="4" height="3" fill="#3b82f6" />
      <rect x="31" y="23" width="4" height="3" fill="#3b82f6" />
      {/* Side display bars */}
      <rect x="37.5" y="14" width="6.5" height="4" fill="#93c5fd" />
      <rect x="37.5" y="20" width="6.5" height="6" fill="#60a5fa" />
      {/* Stand neck */}
      <rect x="26" y="34" width="12" height="6" fill="#1e3a8a" />
      {/* Red power/status button */}
      <rect x="29" y="36" width="6" height="3" rx="0.8" fill="#ef4444" />
      {/* Base drawer */}
      <path d="M10 40H54L56 52H8L10 40Z" fill="#172554" />
    </svg>
  );
}

function SalesSetupIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-12" fill="none">
      {/* Clipboard board */}
      <rect
        x="12"
        y="10"
        width="34"
        height="44"
        rx="3"
        fill="#dbeafe"
        stroke="#3b82f6"
        strokeWidth="2"
      />
      <rect x="16" y="15" width="26" height="34" rx="1" fill="#ffffff" />
      {/* Top clip */}
      <rect x="22" y="7" width="14" height="6" rx="1.5" fill="#ef4444" />
      {/* Chart & lines inside clipboard */}
      <rect x="19" y="26" width="3.5" height="8" fill="#ef4444" />
      <rect x="24" y="22" width="3.5" height="12" fill="#3b82f6" />
      <rect x="29" y="19" width="3.5" height="15" fill="#10b981" />
      <rect x="19" y="37" width="16" height="2" rx="1" fill="#94a3b8" />
      <rect x="19" y="41" width="12" height="2" rx="1" fill="#94a3b8" />
      {/* Red Gear Cog on bottom-right */}
      <circle cx="44" cy="44" r="8" fill="#ef4444" />
      <circle cx="44" cy="44" r="3.2" fill="#ffffff" />
      <path
        d="M44 33.5V36M44 52V54.5M33.5 44H36M52 44H54.5M36.6 36.6L38.4 38.4M49.6 49.6L51.4 51.4M51.4 36.6L49.6 38.4M38.4 49.6L36.6 51.4"
        stroke="#ef4444"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PointRedeemIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-12" fill="none">
      {/* Left tall stack of gold coins */}
      <ellipse cx="24" cy="46" rx="11" ry="4" fill="#f59e0b" />
      <ellipse cx="24" cy="40" rx="11" ry="4" fill="#fbbf24" />
      <ellipse cx="24" cy="34" rx="11" ry="4" fill="#f59e0b" />
      <ellipse cx="24" cy="28" rx="11" ry="4" fill="#fbbf24" />
      <ellipse cx="24" cy="22" rx="11" ry="4" fill="#f59e0b" />
      <ellipse cx="24" cy="16" rx="11" ry="4" fill="#fcd34d" />
      {/* Right stack of gold coins */}
      <ellipse cx="42" cy="48" rx="10" ry="3.8" fill="#d97706" />
      <ellipse cx="42" cy="42" rx="10" ry="3.8" fill="#f59e0b" />
      <ellipse cx="42" cy="36" rx="10" ry="3.8" fill="#fbbf24" />
      <ellipse cx="42" cy="30" rx="10" ry="3.8" fill="#fcd34d" />
    </svg>
  );
}

const SETUP_CARDS: Array<{
  id: Exclude<SetupSection, null>;
  label: string;
  Icon: React.ComponentType;
}> = [
  { id: "DISCOUNT_OFFER", label: "Discount & Offer", Icon: DiscountOfferIcon },
  { id: "COUNTER_SETUP", label: "Counter Setup", Icon: CounterSetupIcon },
  { id: "SALES_SETUP", label: "Sales Setup", Icon: SalesSetupIcon },
  { id: "POINT_REDEEM_OTP", label: "Point Redeem OTP", Icon: PointRedeemIcon },
  { id: "FLOOR_TABLE_SETUP", label: "Floor & Table Setup", Icon: CounterSetupIcon },
];

export default function PosSetupPage() {
  const [activeSection, setActiveSection] = useState<SetupSection>(null);

  if (!activeSection) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {SETUP_CARDS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className="group flex flex-col items-center justify-center gap-2.5 rounded-md border border-[#b6d4fe] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-6 shadow-[0_2px_8px_rgba(13,110,253,0.08)] hover:border-[#0d6efd] hover:shadow-md transition-all cursor-pointer min-h-[125px]"
            >
              <div className="transition-transform group-hover:scale-105">
                <Icon />
              </div>
              <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 text-center">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const currentCard = SETUP_CARDS.find((c) => c.id === activeSection);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveSection(null)}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
          <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {currentCard?.label}
          </h1>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded bg-[#0d6efd] hover:bg-[#0b5ed7] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs cursor-pointer"
        >
          <Plus className="size-3.5" />
          Create New
        </button>
      </div>

      <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-2.5 font-semibold w-14">SL</th>
              <th className="p-2.5 font-semibold">Name / Title</th>
              <th className="p-2.5 font-semibold">Code / Type</th>
              <th className="p-2.5 font-semibold">Outlet / Scope</th>
              <th className="p-2.5 font-semibold text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={5}
                className="p-8 text-center text-xs text-slate-400"
              >
                No records found
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

