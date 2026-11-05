"use client";

import React, { useState, useEffect, useEffectEvent, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Users,
  Video,
  RefreshCw,
} from "lucide-react";
import type { ConnectUser } from "@/features/connect/types";

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

export default function BrgConnectDirectoryPage() {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [employees, setEmployees] = useState<ConnectUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDirectory = async (searchTerm = search, dept = selectedDept) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (searchTerm) params.set("search", searchTerm);
      if (dept !== "All") params.set("department", dept);

      const res = await fetch(`/api/connect/directory?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.employees)) {
        const mapped: ConnectUser[] = data.employees.map(
          (e: {
            id: string;
            name: string;
            designation: string;
            department: string;
            phone: string;
            email: string;
            officeName: string;
            isActive: boolean;
          }) => ({
            id: e.id,
            name: e.name,
            department: e.department || "General",
            designation: e.designation || "Staff Member",
            phone: e.phone || "-",
            email: e.email || "-",
            officeName: e.officeName || "Main Office",
            status: e.isActive ? "online" : "offline",
            role: "member",
          })
        );
        setEmployees(mapped);
      }
    } catch {
      // Offline or network error
    } finally {
      setIsLoading(false);
    }
  };

  // Reload when the department changes, using the latest fetchDirectory.
  const onFetchDirectory = useEffectEvent(() => fetchDirectory());
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) onFetchDirectory();
    });
    return () => { active = false; };
  }, [selectedDept]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    return ["All", ...Array.from(set)];
  }, [employees]);

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
            <Users className="size-5 text-blue-600" />
            <span>Employee Directory</span>
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Live enterprise staff registry from Neon PostgreSQL database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchDirectory()}
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
            <MessageSquare className="size-3.5" />
            <span>Open Messenger</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchDirectory();
          }}
          className="relative w-full sm:w-80"
        >
          <Search className="size-4 absolute left-3 top-2.5 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, phone, email..."
            className="w-full h-9 pl-9 pr-3 rounded border border-line bg-surface text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </form>

        {/* Department Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 text-xs">
          {departments.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap transition cursor-pointer ${
                selectedDept === dept
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-control/50 text-ink-muted hover:bg-control hover:text-ink border border-line"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Employee Cards Grid */}
      {employees.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-line rounded-xl bg-surface/50 space-y-3">
          <Users className="size-10 text-ink-muted mx-auto" />
          <h3 className="text-sm font-semibold text-ink">No employees found</h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            {isLoading ? "Fetching live employees from database..." : "Add employees in the HRM module to see them listed in the enterprise directory."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((user) => (
            <div
              key={user.id}
              className="rounded-xl border border-line bg-surface p-4 shadow-2xs hover:shadow-xs transition space-y-3 flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <div
                    className={`size-12 rounded-full flex items-center justify-center font-bold text-sm border-2 border-line ${getAvatarBg(
                      user.name
                    )}`}
                  >
                    {getInitials(user.name)}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-surface ${
                      user.status === "online"
                        ? "bg-emerald-500"
                        : "bg-slate-400"
                    }`}
                    title={`Status: ${user.status}`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-ink truncate">{user.name}</h3>
                    <span className="text-[10px] uppercase font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                      {user.role}
                    </span>
                  </div>
                  <span className="block text-xs text-ink-muted font-medium truncate mt-0.5">
                    {user.designation}
                  </span>
                  <span className="block text-[11px] text-ink-muted truncate">
                    {user.department}
                  </span>
                </div>
              </div>

              {/* Office & Contact Info */}
              <div className="pt-2 border-t border-line/60 space-y-1.5 text-xs text-ink-muted">
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="size-3.5 text-ink-muted shrink-0" />
                  <span className="truncate">{user.officeName}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="size-3.5 text-ink-muted shrink-0" />
                    <span className="font-mono text-[11px] text-ink">{user.phone}</span>
                  </div>
                )}
                {user.email && (
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="size-3.5 text-ink-muted shrink-0" />
                    <span className="truncate text-[11px] text-ink">{user.email}</span>
                  </div>
                )}
              </div>

              {/* Direct Action Buttons */}
              <div className="pt-2 border-t border-line/60 flex items-center gap-2">
                <Link
                  href="/connect"
                  className="flex-1 h-8 rounded border border-line bg-control/40 hover:bg-control text-ink text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <MessageSquare className="size-3.5 text-blue-600" />
                  <span>Message</span>
                </Link>
                <Link
                  href="/connect"
                  className="size-8 rounded border border-line bg-control/40 hover:bg-control text-ink flex items-center justify-center transition"
                  title="Start Audio Call"
                >
                  <Phone className="size-3.5 text-emerald-600" />
                </Link>
                <Link
                  href="/connect"
                  className="size-8 rounded border border-line bg-control/40 hover:bg-control text-ink flex items-center justify-center transition"
                  title="Start Video Call"
                >
                  <Video className="size-3.5 text-blue-600" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
