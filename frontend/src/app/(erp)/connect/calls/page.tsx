"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Search,
  RefreshCw,
} from "lucide-react";

interface CallLogItem {
  id: string;
  userId: string;
  userName: string;
  department: string;
  type: "audio" | "video";
  direction: "incoming" | "outgoing" | "missed";
  durationSec: number;
  timestamp: string;
  quality: "Excellent" | "Good";
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarBg(name?: string | null): string {
  const colors = [
    "bg-blue-600 text-white",
    "bg-indigo-600 text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-purple-600 text-white",
    "bg-teal-600 text-white",
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function BrgConnectCallsPage() {
  const [filterType, setFilterType] = useState<"all" | "audio" | "video" | "missed">("all");
  const [search, setSearch] = useState("");
  const [callLogs, setCallLogs] = useState<CallLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCalls = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/connect/calls");
      const data = await res.json();
      if (data.success && Array.isArray(data.calls)) {
        const mapped: CallLogItem[] = data.calls.map(
          (c: {
            id: string;
            conversationId: string;
            conversationName: string;
            type: string;
            status: string;
            durationSec: number;
            startedAt: string;
          }) => ({
            id: c.id,
            userId: c.conversationId,
            userName: c.conversationName || "Team Call",
            department: "BridgeOne Connect",
            type: c.type?.toLowerCase() === "video" ? "video" : "audio",
            direction: c.status === "MISSED" ? "missed" : "outgoing",
            durationSec: c.durationSec || 0,
            timestamp: new Date(c.startedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }),
            quality: "Excellent",
          })
        );
        setCallLogs(mapped);
      }
    } catch {
      // Offline or network error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) fetchCalls();
    });
    return () => { active = false; };
  }, []);

  const formatDuration = (sec: number) => {
    if (sec === 0) return "-";
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s}s`;
  };

  const filteredLogs = callLogs.filter((log) => {
    const matchSearch =
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.department.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterType === "audio") return log.type === "audio" && log.direction !== "missed";
    if (filterType === "video") return log.type === "video";
    if (filterType === "missed") return log.direction === "missed";
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/connect"
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              &larr; Back to Chat
            </Link>
          </div>
          <h1 className="text-xl font-bold text-ink mt-1 flex items-center gap-2">
            <PhoneCall className="size-5 text-emerald-600" />
            <span>Calls &amp; Meetings History</span>
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Enterprise WebRTC audio and video calling records stored in Neon PostgreSQL database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchCalls}
            disabled={isLoading}
            className="h-8 px-2.5 rounded border border-line bg-surface hover:bg-control text-ink text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            title="Refresh database"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync DB</span>
          </button>
          <Link
            href="/connect"
            className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <Phone className="size-3.5" />
            <span>Start New Call</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-line bg-surface">
          <span className="text-[11px] text-ink-muted block">Total Calls</span>
          <span className="text-xl font-bold font-mono text-ink mt-1 block">{callLogs.length}</span>
        </div>
        <div className="p-3.5 rounded-xl border border-line bg-surface">
          <span className="text-[11px] text-ink-muted block">Total Talk Time</span>
          <span className="text-xl font-bold font-mono text-blue-600 mt-1 block">
            {Math.floor(callLogs.reduce((acc, c) => acc + c.durationSec, 0) / 60)}m {callLogs.reduce((acc, c) => acc + c.durationSec, 0) % 60}s
          </span>
        </div>
        <div className="p-3.5 rounded-xl border border-line bg-surface">
          <span className="text-[11px] text-ink-muted block">Completed Rate</span>
          <span className="text-xl font-bold font-mono text-emerald-600 mt-1 block">
            {callLogs.length === 0 ? "0%" : `${Math.round((callLogs.filter((c) => c.direction !== "missed").length / Math.max(1, callLogs.length)) * 100)}%`}
          </span>
        </div>
        <div className="p-3.5 rounded-xl border border-line bg-surface">
          <span className="text-[11px] text-ink-muted block">Missed Calls</span>
          <span className="text-xl font-bold font-mono text-rose-500 mt-1 block">
            {callLogs.filter((c) => c.direction === "missed").length}
          </span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 absolute left-3 top-2.5 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by participant name, team..."
            className="w-full h-9 pl-9 pr-3 rounded border border-line bg-surface text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 text-xs">
          {(["all", "audio", "video", "missed"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1.5 rounded capitalize transition cursor-pointer ${
                filterType === tab
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-control/50 text-ink-muted hover:bg-control hover:text-ink border border-line"
              }`}
            >
              {tab === "all" ? "All Calls" : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Call Table or Empty State */}
      {filteredLogs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-line rounded-xl bg-surface/50 space-y-3">
          <PhoneCall className="size-10 text-ink-muted mx-auto" />
          <h3 className="text-sm font-semibold text-ink">No call records found</h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            {isLoading ? "Fetching call logs from database..." : "Start a 1-to-1 WebRTC audio or video call directly from any conversation or employee profile."}
          </p>
          <div className="pt-2">
            <Link
              href="/connect"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              <Phone className="size-3.5" />
              <span>Go to Chat &amp; Start Call</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-line">
                <tr>
                  <th className="p-3 w-12 text-center">Type</th>
                  <th className="p-3">Participant</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Call Time</th>
                  <th className="p-3 text-right">Duration</th>
                  <th className="p-3 text-center">Stream Quality</th>
                  <th className="p-3 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredLogs.map((log) => {
                  const isMissed = log.direction === "missed";
                  return (
                    <tr key={log.id} className="hover:bg-control/40 transition">
                      <td className="p-3 text-center">
                        {isMissed ? (
                          <PhoneMissed className="size-4 text-rose-500 inline" />
                        ) : log.direction === "incoming" ? (
                          <PhoneIncoming className="size-4 text-emerald-600 inline" />
                        ) : (
                          <PhoneOutgoing className="size-4 text-blue-600 inline" />
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`size-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${getAvatarBg(
                              log.userName
                            )}`}
                          >
                            {getInitials(log.userName)}
                          </div>
                          <div>
                            <span className={`block font-semibold ${isMissed ? "text-rose-600" : "text-ink"}`}>
                              {log.userName}
                            </span>
                            <span className="text-[10px] text-ink-muted capitalize">
                              {log.type} Call ({log.direction})
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-ink-muted font-medium">{log.department}</td>
                      <td className="p-3 font-mono text-ink-muted">{log.timestamp}</td>
                      <td className="p-3 text-right font-mono font-bold text-ink">
                        {formatDuration(log.durationSec)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-500/20">
                          {log.quality} (Coturn P2P)
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Link
                          href="/connect"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-control hover:bg-control/80 text-ink font-semibold text-[11px] transition"
                        >
                          <Phone className="size-3 text-emerald-600" />
                          <span>Call Back</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
