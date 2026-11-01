"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  CheckCircle,
  Clock,
  ShieldCheck,
  X,
  Upload,
} from "lucide-react";

interface OtpRecord {
  id: string;
  mobileNo: string;
  otp: string;
  generatedDateTime: string;
  expiredDateTime: string;
  status: "Active" | "Expired" | "Used";
  source: "Generated" | "Uploaded";
}

const INITIAL_OTP_RECORDS: OtpRecord[] = [
  {
    id: "otp-1",
    mobileNo: "01712345678",
    otp: "582914",
    generatedDateTime: "01/11/2026 01:30 PM",
    expiredDateTime: "01/11/2026 02:00 PM",
    status: "Active",
    source: "Generated",
  },
  {
    id: "otp-2",
    mobileNo: "01898765432",
    otp: "194820",
    generatedDateTime: "01/11/2026 12:45 PM",
    expiredDateTime: "01/11/2026 01:15 PM",
    status: "Expired",
    source: "Generated",
  },
  {
    id: "otp-3",
    mobileNo: "01911223344",
    otp: "739102",
    generatedDateTime: "01/11/2026 11:20 AM",
    expiredDateTime: "01/11/2026 11:50 AM",
    status: "Used",
    source: "Generated",
  },
];

interface PointRedeemOtpSectionProps {
  onBack: () => void;
}

export function PointRedeemOtpSection({ onBack }: PointRedeemOtpSectionProps) {
  const [records, setRecords] = useState<OtpRecord[]>(INITIAL_OTP_RECORDS);

  // Filters
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSource, setFilterSource] = useState<"Generated" | "Uploaded">("Generated");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mobileInput, setMobileInput] = useState("");

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3500);
  };

  // LocalStorage Persistence
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("erp_pos_redeem_otp_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecords(parsed);
        }
      }
    } catch (e) {
      console.warn("Could not load OTP records from localStorage:", e);
    }
  }, []);

  const saveRecords = (newRecords: OtpRecord[]) => {
    setRecords(newRecords);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_redeem_otp_v1", JSON.stringify(newRecords));
      } catch (e) {
        console.warn("Could not save OTP records to localStorage:", e);
      }
    }
  };

  // Format Date String
  const formatDateTime = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${pad(hours)}:${minutes} ${ampm}`;
  };

  // Generate New OTP
  const handleGenerateOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileInput.trim()) return;

    const cleanMobile = mobileInput.trim();
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * 60 * 1000); // 30 min validity

    const newRecord: OtpRecord = {
      id: `otp-${Date.now()}`,
      mobileNo: cleanMobile,
      otp: generatedOtp,
      generatedDateTime: formatDateTime(now),
      expiredDateTime: formatDateTime(expiry),
      status: "Active",
      source: "Generated",
    };

    const updated = [newRecord, ...records];
    saveRecords(updated);
    setMobileInput("");
    setIsModalOpen(false);
    showToast(`OTP generated for ${cleanMobile}: ${generatedOtp}`);
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterSource && r.source !== filterSource) return false;
      if (filterStatus !== "All" && r.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!r.mobileNo.toLowerCase().includes(q) && !r.otp.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [records, filterSource, filterStatus, searchQuery]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* 1. Header: Back, Title, Search, + Generate New OTP */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
            title="Back to Setup Menu"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Point Redeem OTP
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search...."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Search className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* + Generate New OTP Button */}
          <button
            type="button"
            onClick={() => {
              setMobileInput("");
              setIsModalOpen(true);
            }}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="size-4" />
            <span>Generate New OTP</span>
          </button>
        </div>
      </div>

      {/* 2. Filter By Bar: Dropdown, Radio: Generated vs Uploaded, View button */}
      <div className="flex items-end gap-4 flex-wrap pt-1">
        <div className="w-56">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Filter By
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Used">Used</option>
          </select>
        </div>

        {/* Radio: Generated vs Uploaded */}
        <div className="flex items-center gap-5 pb-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="radio"
              name="otpSource"
              checked={filterSource === "Generated"}
              onChange={() => setFilterSource("Generated")}
              className="size-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Generated</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="radio"
              name="otpSource"
              checked={filterSource === "Uploaded"}
              onChange={() => setFilterSource("Uploaded")}
              className="size-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Uploaded</span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => showToast(`Filtered ${filteredRecords.length} OTP records`)}
          className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
        >
          View
        </button>
      </div>

      {/* 3. Table */}
      <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs mt-2">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-3 font-semibold">Mobile No</th>
              <th className="p-3 font-semibold">OTP</th>
              <th className="p-3 font-semibold">Generated Date Time</th>
              <th className="p-3 font-semibold">Expired Date Time</th>
              <th className="p-3 font-semibold text-center w-28">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredRecords.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                  {row.mobileNo}
                </td>
                <td className="p-3 font-mono font-bold text-blue-600 tracking-wider">
                  {row.otp}
                </td>
                <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                  {row.generatedDateTime}
                </td>
                <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                  {row.expiredDateTime}
                </td>
                <td className="p-3 text-center">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      row.status === "Active"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : row.status === "Used"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  No OTP records found matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Generate New OTP Modal (Screenshot 2) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
              Generate New OTP
            </h3>
            <form onSubmit={handleGenerateOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mobile No <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter Mobile No"
                  value={mobileInput}
                  onChange={(e) => setMobileInput(e.target.value)}
                  className="w-full h-10 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-4 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-sm font-bold text-rose-500 hover:text-rose-600 transition tracking-wider uppercase cursor-pointer"
                >
                  CLOSE
                </button>
                <button
                  type="submit"
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 transition tracking-wider uppercase cursor-pointer"
                >
                  GENERATE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle className="size-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
