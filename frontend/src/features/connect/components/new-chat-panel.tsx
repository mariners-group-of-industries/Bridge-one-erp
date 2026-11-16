"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Search, UserRound } from "lucide-react";

interface DirectoryEmployee {
  id: string;
  name: string;
  designation: string;
  department: string;
  officeName?: string;
  isActive?: boolean;
}

interface NewChatPanelProps {
  currentUserId?: string;
  /** Called with the (new or already existing) direct conversation once it is ready. */
  onStarted: (conversationId: string, name: string) => void;
}

/**
 * Colleague picker for the floating messenger: lists the employee directory and opens
 * (or creates) a 1-to-1 chat. The API returns the existing DIRECT chat when one exists.
 */
export function NewChatPanel({ currentUserId, onStarted }: NewChatPanelProps) {
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/connect/directory?limit=1000");
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success || !Array.isArray(data.employees)) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        if (!cancelled) setEmployees(data.employees);
      } catch (err) {
        console.warn("Failed to load directory:", err);
        if (!cancelled) setLoadError("Couldn't load colleagues. Try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(
      (e) =>
        e.isActive !== false &&
        e.id !== currentUserId &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q))
    );
  }, [employees, search, currentUserId]);

  const startChat = async (emp: DirectoryEmployee) => {
    if (startingId) return;
    setStartingId(emp.id);
    setStartError(null);
    try {
      const res = await fetch("/api/connect/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "DIRECT",
          name: emp.name,
          description: `${emp.designation} • ${emp.department}`,
          memberUserIds: [currentUserId || "user-current", emp.id],
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data.conversation?.id) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      onStarted(data.conversation.id, emp.name);
    } catch (err) {
      console.warn("Failed to start chat:", err);
      setStartError(`Couldn't start a chat with ${emp.name}. Try again.`);
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 bg-white dark:bg-[#111b21] flex flex-col">
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-[#f0f2f5] dark:bg-[#202c33]">
        <div className="relative">
          <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, department, designation..."
            aria-label="Search colleagues"
            autoFocus
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-white dark:bg-[#2a3942] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {startError && (
        <div role="alert" className="mx-2.5 mt-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="size-3.5 shrink-0 mt-px" />
          <span>{startError}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
        {isLoading ? (
          <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="size-5 animate-spin text-emerald-600" />
            <span className="text-xs">Loading colleagues...</span>
          </div>
        ) : loadError ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-rose-600 dark:text-rose-400">
            <AlertCircle className="size-6 mb-1" />
            <p className="text-xs font-medium">{loadError}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-center p-4">
            <UserRound className="size-8 text-slate-300 dark:text-slate-600 mb-1" />
            <p className="text-xs font-medium">No colleagues found</p>
          </div>
        ) : (
          filtered.map((emp) => {
            const isStarting = startingId === emp.id;
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => startChat(emp)}
                disabled={!!startingId}
                aria-busy={isStarting || undefined}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] cursor-pointer transition disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500"
              >
                <div className="size-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {emp.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">{emp.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {emp.designation} • {emp.department}
                  </p>
                </div>
                {isStarting && <Loader2 className="size-4 animate-spin text-emerald-600 shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
