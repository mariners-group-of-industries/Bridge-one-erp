"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  Clock,
  Download,
  History,
  Kanban,
  ListTodo,
  Paperclip,
  Plus,
  Repeat,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/shadcn/avatar";
import { Badge } from "@/components/ui/shadcn/badge";
import { Button } from "@/components/ui/shadcn/button";
import { Card, CardContent } from "@/components/ui/shadcn/card";
import { Checkbox } from "@/components/ui/shadcn/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/shadcn/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/shadcn/dialog";
import { Input } from "@/components/ui/shadcn/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { Progress } from "@/components/ui/shadcn/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/shadcn/select";
import { Separator } from "@/components/ui/shadcn/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/shadcn/sheet";
import { Slider } from "@/components/ui/shadcn/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Textarea } from "@/components/ui/shadcn/textarea";
import { useToast } from "@/components/ui/toast";
import type {
  ConnectTaskRecord,
  RecurringType,
  TaskChecklistItem,
  TaskPriority,
  TaskStatus,
} from "@/lib/connect/tasks-db";
import { cn } from "@/lib/utils";

interface DirectoryMember {
  id: string;
  name: string;
  designation: string;
  department: string;
  employeeCode?: string;
}

type ViewTab = "list" | "board" | "calendar" | "team";
type ScopeFilter = "all" | "mine" | "created";

interface CurrentUserInfo {
  id: string;
  name: string;
  employeeId: string | null;
  isMaster?: boolean;
}

interface TaskActivityLog {
  id: string;
  actor_name: string;
  action_type: string;
  new_status: string | null;
  progress_percent: number | null;
  remarks: string | null;
  created_at: string;
}

function projectPillClass(project: string): string {
  const key = project.toLowerCase();
  if (key.includes("purchase")) return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60";
  if (key.includes("production")) return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900/60";
  if (key.includes("inventory")) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60";
  if (key.includes("sales")) return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60";
  if (key.includes("account")) return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900/60";
  if (key.includes("hrm") || key.includes("hr")) return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60";
  return "bg-control text-ink-muted border-line";
}

const STATUS_COLUMNS: Array<{ status: TaskStatus; label: string; dot: string }> = [
  { status: "NOT_STARTED", label: "To Do", dot: "bg-slate-400" },
  { status: "IN_PROGRESS", label: "In Progress", dot: "bg-blue-500" },
  { status: "SUBMITTED_FOR_APPROVAL", label: "In Review", dot: "bg-amber-500" },
  { status: "VERIFIED_COMPLETED", label: "Done", dot: "bg-emerald-500" },
];

const PRIORITY_BADGE: Record<TaskPriority, { label: string; variant: "destructive" | "warning" | "info" | "secondary" }> = {
  CRITICAL: { label: "Critical", variant: "destructive" },
  HIGH: { label: "High", variant: "warning" },
  MEDIUM: { label: "Medium", variant: "info" },
  LOW: { label: "Low", variant: "secondary" },
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  SUBMITTED_FOR_APPROVAL: "In Review",
  VERIFIED_COMPLETED: "Done",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function TaskAllocationView() {
  const toast = useToast();
  const [tasks, setTasks] = useState<ConnectTaskRecord[]>([]);
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewTab>("list");

  // Filters
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<string>("ALL");
  const [memberFilterOpen, setMemberFilterOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Collapsed groups in List View
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Inline Quick-Add
  const [quickTitle, setQuickTitle] = useState("");
  const [quickAssigneeId, setQuickAssigneeId] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  // Calendar month cursor
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  // Allocate Task Modal
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<DirectoryMember[]>([]);
  const [defaultDueDate, setDefaultDueDate] = useState<string | null>(null);

  // Team view multi-select
  const [teamPickedIds, setTeamPickedIds] = useState<string[]>([]);

  // Task Detail Sheet
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, dirRes] = await Promise.all([
        fetch("/api/connect/tasks", { cache: "no-store" }),
        fetch("/api/connect/directory?limit=500", { cache: "no-store" }),
      ]);
      const tasksJson = await tasksRes.json();
      if (tasksJson.success && Array.isArray(tasksJson.tasks)) {
        setTasks(tasksJson.tasks);
        if (tasksJson.currentUser) setCurrentUser(tasksJson.currentUser);
      }
      if (dirRes.ok) {
        const dirJson = await dirRes.json();
        if (dirJson.success && Array.isArray(dirJson.employees)) {
          setMembers(dirJson.employees);
        }
      }
    } catch {
      toast.error("Failed to load task allocation data.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/connect/tasks", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/connect/directory?limit=500", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([tasksJson, dirJson]) => {
        if (!active) return;
        if (tasksJson?.success && Array.isArray(tasksJson.tasks)) {
          setTasks(tasksJson.tasks);
          if (tasksJson.currentUser) setCurrentUser(tasksJson.currentUser);
        }
        if (dirJson?.success && Array.isArray(dirJson.employees)) setMembers(dirJson.employees);
      })
      .catch(() => {
        if (active) toast.error("Failed to load task allocation data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  // Merge directory members + any task assignees not in directory
  const allMembers = useMemo<DirectoryMember[]>(() => {
    const map = new Map<string, DirectoryMember>();
    for (const m of members) map.set(m.id, m);
    for (const t of tasks) {
      if (!map.has(t.assignedToId)) {
        map.set(t.assignedToId, {
          id: t.assignedToId,
          name: t.assignedToName,
          designation: t.assignedToDesignation,
          department: t.department,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, tasks]);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "CANCELLED"),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeTasks.filter((t) => {
      if (scope === "mine" && currentUser) {
        const isMine =
          t.assignedToId === currentUser.id ||
          (currentUser.employeeId && t.assignedToId === currentUser.employeeId) ||
          t.assignedToName.toLowerCase() === currentUser.name.toLowerCase();
        if (!isMine) return false;
      }
      if (scope === "created" && currentUser) {
        const byMe =
          t.assignedById === currentUser.id ||
          t.assignedByName.toLowerCase() === currentUser.name.toLowerCase();
        if (!byMe) return false;
      }
      if (memberFilter !== "ALL" && t.assignedToId !== memberFilter && t.assignedToName !== memberFilter) {
        return false;
      }
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) {
        return false;
      }
      if (q) {
        const hit =
          t.title.toLowerCase().includes(q) ||
          t.taskCode.toLowerCase().includes(q) ||
          t.assignedToName.toLowerCase().includes(q) ||
          t.projectName.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [activeTasks, scope, currentUser, memberFilter, priorityFilter, search]);

  const kpis = useMemo(() => {
    const total = filteredTasks.length;
    const inProgress = filteredTasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "SUBMITTED_FOR_APPROVAL").length;
    const done = filteredTasks.filter((t) => t.status === "VERIFIED_COMPLETED").length;
    const overdue = filteredTasks.filter((t) => t.isOverdue).length;
    const avgProgress =
      total > 0 ? Math.round(filteredTasks.reduce((sum, t) => sum + t.progressPercent, 0) / total) : 0;
    return { total, inProgress, done, overdue, avgProgress };
  }, [filteredTasks]);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );

  async function patchTask(
    taskId: string,
    payload: {
      status?: TaskStatus;
      progressPercent?: number;
      checklist?: TaskChecklistItem[];
      staffRemarks?: string;
    }
  ) {
    try {
      const res = await fetch(`/api/connect/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutationType: "STAFF_UPDATE", ...payload }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not update task.");
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? json.task : t)));
    } catch {
      toast.error("Failed to update task.");
    }
  }

  async function deleteTask(taskId: string) {
    try {
      const res = await fetch(`/api/connect/tasks/${taskId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not delete task.");
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setActiveTaskId(null);
      toast.success("Task deleted.");
    } catch {
      toast.error("Failed to delete task.");
    }
  }
  function openAllocateFor(initial: DirectoryMember[], dueDate?: string) {
    setSelectedAssignees(initial);
    setDefaultDueDate(dueDate ?? null);
    setAllocateOpen(true);
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = quickTitle.trim();
    const member = allMembers.find((m) => m.id === quickAssigneeId) ?? allMembers[0];
    if (!title || !member) {
      toast.error("Enter a task title and pick a member.");
      return;
    }
    setQuickSaving(true);
    try {
      const due = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
      const res = await fetch("/api/connect/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_TASK",
          title,
          priority: "MEDIUM",
          deadline: `${due}T18:00:00.000Z`,
          verificationRequired: false,
          assignees: [{ id: member.id, name: member.name, designation: member.designation, department: member.department }],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not allocate task.");
        return;
      }
      setQuickTitle("");
      toast.success(`Allocated to ${member.name}.`);
      void loadData();
    } catch {
      toast.error("Failed to create task.");
    } finally {
      setQuickSaving(false);
    }
  }

  function exportCsv() {
    const header = ["Task Code", "Title", "Project", "Allocated To", "Priority", "Due Date", "Progress %", "Status"];
    const escape = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filteredTasks.map((t) => [
      t.taskCode,
      t.title,
      t.projectName,
      t.assignedToName,
      t.priority,
      t.deadline.slice(0, 10),
      t.progressPercent,
      STATUS_LABEL[t.status] ?? t.status,
    ]);
    const csv = [header.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-allocation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const teamStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    const isMaster = Boolean(currentUser?.isMaster);
    return allMembers
      .filter((m) => {
        if (!isMaster && currentUser) {
          const isSelf =
            m.id === currentUser.id ||
            (currentUser.employeeId ? m.id === currentUser.employeeId : false) ||
            m.name.toLowerCase() === currentUser.name.toLowerCase();
          if (!isSelf) return false;
        }
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          m.department.toLowerCase().includes(q) ||
          m.designation.toLowerCase().includes(q)
        );
      })
      .map((member) => {
        const list = activeTasks.filter(
          (t) => t.assignedToId === member.id || t.assignedToName.toLowerCase() === member.name.toLowerCase()
        );
        const done = list.filter((t) => t.status === "VERIFIED_COMPLETED").length;
        const active = list.filter((t) => t.status !== "VERIFIED_COMPLETED").length;
        const avgProgress =
          list.length > 0 ? Math.round(list.reduce((s, t) => s + t.progressPercent, 0) / list.length) : 0;
        return { member, total: list.length, done, active, avgProgress };
      });
  }, [allMembers, activeTasks, search]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">Task Allocation</h1>
          <p className="text-xs text-ink-muted">
            Select team members, allocate tasks, and track live completion progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {teamPickedIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openAllocateFor(allMembers.filter((m) => teamPickedIds.includes(m.id)))}
            >
              <Users className="size-3.5" />
              Allocate to {teamPickedIds.length} Selected
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={filteredTasks.length === 0}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => openAllocateFor([])}>
            <Plus className="size-3.5" />
            Allocate Task
          </Button>
        </div>
      </div>

      {/* Minimal 4-KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-[11px] font-medium text-ink-muted">Total Allocated</p>
              <p className="mt-1 text-xl font-semibold text-ink">{kpis.total}</p>
            </div>
            <div className="flex size-8 items-center justify-center rounded-md bg-control text-ink-muted">
              <ListTodo className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-[11px] font-medium text-ink-muted">In Progress</p>
              <p className="mt-1 text-xl font-semibold text-ink">{kpis.inProgress}</p>
            </div>
            <div className="flex size-8 items-center justify-center rounded-md bg-accent-soft text-accent-strong dark:text-accent">
              <Clock className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-ink-muted">Overall Progress</p>
              <span className="text-xs font-semibold text-ink">{kpis.avgProgress}%</span>
            </div>
            <Progress value={kpis.avgProgress} className="mt-2.5" />
            <p className="mt-1.5 text-[11px] text-ink-faint">{kpis.done} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-[11px] font-medium text-ink-muted">Overdue</p>
              <p className={cn("mt-1 text-xl font-semibold", kpis.overdue > 0 ? "text-danger" : "text-ink")}>
                {kpis.overdue}
              </p>
            </div>
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-md",
                kpis.overdue > 0 ? "bg-rose-50 text-danger dark:bg-rose-950/50" : "bg-control text-ink-muted"
              )}
            >
              <AlertCircle className="size-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Switcher & Filters */}
      <Tabs value={view} onValueChange={(v) => setView(v as ViewTab)}>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <TabsList>
              <TabsTrigger value="list">
                <ListTodo />
                List
              </TabsTrigger>
              <TabsTrigger value="board">
                <Kanban />
                Board
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <CalendarDays />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="team">
                <Users />
                Team Progress
              </TabsTrigger>
            </TabsList>

            <div className="inline-flex h-8 items-center rounded-md border border-line bg-control p-0.5 text-[11px]">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "mine", label: "Assigned to Me" },
                  { id: "created", label: "Allocated by Me" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 font-medium transition-colors",
                    scope === opt.id ? "bg-surface text-ink shadow-2xs" : "text-ink-muted hover:text-ink"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-52">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks or people..."
                className="pl-8"
              />
            </div>

            {view !== "team" && view !== "calendar" && (
              <>
                {currentUser?.isMaster && (
                  <Popover open={memberFilterOpen} onOpenChange={setMemberFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="default" className="w-44 justify-between font-normal">
                      <span className="truncate">
                        {memberFilter === "ALL"
                          ? "All Members"
                          : allMembers.find((m) => m.id === memberFilter)?.name ?? memberFilter}
                      </span>
                      <ChevronsUpDown className="size-3.5 text-ink-faint" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0">
                    <Command>
                      <CommandInput placeholder="Filter member..." />
                      <CommandList>
                        <CommandEmpty>No member found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="ALL"
                            onSelect={() => {
                              setMemberFilter("ALL");
                              setMemberFilterOpen(false);
                            }}
                          >
                            <Check className={cn("size-3.5", memberFilter === "ALL" ? "opacity-100" : "opacity-0")} />
                            All Members
                          </CommandItem>
                          {allMembers.map((m) => (
                            <CommandItem
                              key={m.id}
                              value={m.name}
                              onSelect={() => {
                                setMemberFilter(m.id);
                                setMemberFilterOpen(false);
                              }}
                            >
                              <Check className={cn("size-3.5", memberFilter === m.id ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{m.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                )}

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Priorities</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        {/* VIEW 1: LIST VIEW (Asana-inspired) */}
        <TabsContent value="list" className="mt-1">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-canvas text-[11px] font-medium text-ink-muted">
                    <th className="px-4 py-2.5">Task</th>
                    <th className="px-3 py-2.5">Allocated To</th>
                    <th className="px-3 py-2.5">Priority</th>
                    <th className="px-3 py-2.5">Due Date</th>
                    <th className="w-40 px-3 py-2.5">Progress</th>
                    <th className="w-36 px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-ink-muted">
                        Loading tasks...
                      </td>
                    </tr>
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-ink-muted">
                        No tasks found. Click <strong>Allocate Task</strong> to assign work.
                      </td>
                    </tr>
                  ) : (
                    STATUS_COLUMNS.map((group) => {
                      const items = filteredTasks.filter((t) => t.status === group.status);
                      if (items.length === 0) return null;
                      const isCollapsed = !!collapsed[group.status];
                      return (
                        <React.Fragment key={group.status}>
                          <tr
                            onClick={() =>
                              setCollapsed((prev) => ({ ...prev, [group.status]: !prev[group.status] }))
                            }
                            className="cursor-pointer border-b border-line bg-control/50 hover:bg-control"
                          >
                            <td colSpan={6} className="px-4 py-2 font-semibold text-ink">
                              <div className="flex items-center gap-2">
                                {isCollapsed ? (
                                  <ChevronRight className="size-3.5 text-ink-muted" />
                                ) : (
                                  <ChevronDown className="size-3.5 text-ink-muted" />
                                )}
                                <span className={cn("size-2 rounded-full", group.dot)} />
                                <span>{group.label}</span>
                                <span className="text-[11px] font-normal text-ink-faint">({items.length})</span>
                              </div>
                            </td>
                          </tr>
                          {!isCollapsed &&
                            items.map((task) => {
                              const pri = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.MEDIUM;
                              const doneChecks = task.checklist.filter((c) => c.done).length;
                              return (
                                <tr
                                  key={task.id}
                                  onClick={() => setActiveTaskId(task.id)}
                                  className="cursor-pointer border-b border-line transition-colors hover:bg-canvas"
                                >
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                      {task.status === "VERIFIED_COMPLETED" ? (
                                        <CheckCircle2 className="size-4 shrink-0 text-success" />
                                      ) : (
                                        <Circle className="size-4 shrink-0 text-ink-faint" />
                                      )}
                                      <div className="min-w-0">
                                        <p
                                          className={cn(
                                            "truncate font-medium text-ink",
                                            task.status === "VERIFIED_COMPLETED" && "line-through text-ink-muted"
                                          )}
                                        >
                                          {task.title}
                                        </p>
                                        <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                                          <span>{task.taskCode}</span>
                                          <span className={cn("rounded-full border px-1.5 py-0 text-[10px] font-medium", projectPillClass(task.projectName))}>
                                            {task.projectName}
                                          </span>
                                          {task.checklist.length > 0 && <span>· {doneChecks}/{task.checklist.length} subtasks</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <Avatar className="size-6">
                                        <AvatarFallback>{initials(task.assignedToName)}</AvatarFallback>
                                      </Avatar>
                                      <span className="truncate text-ink">{task.assignedToName}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <Badge variant={pri.variant}>{pri.label}</Badge>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 whitespace-nowrap",
                                        task.isOverdue ? "font-medium text-danger" : "text-ink-muted"
                                      )}
                                    >
                                      <Calendar className="size-3" />
                                      {formatDueDate(task.deadline)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                      <Progress
                                        value={task.progressPercent}
                                        indicatorClassName={task.progressPercent === 100 ? "bg-success" : undefined}
                                      />
                                      <span className="w-8 text-right text-[11px] font-medium text-ink-muted">
                                        {task.progressPercent}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                    <Select
                                      value={task.status}
                                      onValueChange={(next) =>
                                        void patchTask(task.id, {
                                          status: next as TaskStatus,
                                          progressPercent:
                                            next === "VERIFIED_COMPLETED" || next === "SUBMITTED_FOR_APPROVAL"
                                              ? 100
                                              : next === "NOT_STARTED"
                                                ? 0
                                                : Math.max(task.progressPercent, 25),
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-7 text-[11px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {STATUS_COLUMNS.map((c) => (
                                          <SelectItem key={c.status} value={c.status}>
                                            {c.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Inline Quick-Add */}
            <form
              onSubmit={handleQuickAdd}
              className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/60 px-4 py-2.5"
            >
              <Plus className="size-3.5 text-ink-faint shrink-0" />
              <Input
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="Quick allocate: type task title and press Enter..."
                className="h-7 flex-1 min-w-48 bg-surface"
              />
              <Select
                value={quickAssigneeId || allMembers[0]?.id || ""}
                onValueChange={setQuickAssigneeId}
              >
                <SelectTrigger className="h-7 w-44 text-[11px]">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {allMembers.slice(0, 80).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" variant="outline" disabled={quickSaving || !quickTitle.trim()}>
                {quickSaving ? "Adding..." : "Quick Add"}
              </Button>
            </form>
          </Card>
        </TabsContent>

        {/* VIEW 2: KANBAN BOARD VIEW (Trello + ClickUp-inspired) */}
        <TabsContent value="board" className="mt-1">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {STATUS_COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.status);
              return (
                <div
                  key={col.status}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!dragTaskId) return;
                    void patchTask(dragTaskId, {
                      status: col.status,
                      progressPercent:
                        col.status === "VERIFIED_COMPLETED" || col.status === "SUBMITTED_FOR_APPROVAL"
                          ? 100
                          : col.status === "NOT_STARTED"
                            ? 0
                            : undefined,
                    });
                    setDragTaskId(null);
                  }}
                  className="flex min-h-[380px] flex-col gap-2.5 rounded-lg border border-line bg-canvas p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", col.dot)} />
                      <h3 className="text-xs font-semibold text-ink">{col.label}</h3>
                      <span className="rounded-full bg-control px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                        {colTasks.length}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => openAllocateFor([])} title="Allocate task">
                      <Plus className="size-3.5" />
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {colTasks.map((task) => {
                      const pri = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.MEDIUM;
                      return (
                        <Card
                          key={task.id}
                          draggable
                          onDragStart={() => setDragTaskId(task.id)}
                          onClick={() => setActiveTaskId(task.id)}
                          className="cursor-pointer transition-shadow hover:shadow-sm"
                        >
                          <CardContent className="flex flex-col gap-2.5 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <Badge variant={pri.variant}>{pri.label}</Badge>
                                <span className={cn("rounded-full border px-1.5 py-0 text-[10px] font-medium", projectPillClass(task.projectName))}>
                                  {task.projectName}
                                </span>
                              </div>
                              <span className="text-[10px] font-medium text-ink-faint">{task.taskCode}</span>
                            </div>
                            <p className="text-xs font-medium leading-snug text-ink line-clamp-2">{task.title}</p>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={task.progressPercent}
                                indicatorClassName={task.progressPercent === 100 ? "bg-success" : undefined}
                              />
                              <span className="text-[10px] font-medium text-ink-muted">{task.progressPercent}%</span>
                            </div>
                            <div className="flex items-center justify-between pt-0.5">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-[11px]",
                                  task.isOverdue ? "font-medium text-danger" : "text-ink-faint"
                                )}
                              >
                                <Calendar className="size-3" />
                                {formatDueDate(task.deadline)}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="max-w-24 truncate text-[11px] text-ink-muted">
                                  {task.assignedToName}
                                </span>
                                <Avatar className="size-6">
                                  <AvatarFallback>{initials(task.assignedToName)}</AvatarFallback>
                                </Avatar>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {colTasks.length === 0 && (
                      <div className="rounded-md border border-dashed border-line py-8 text-center text-[11px] text-ink-faint">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* VIEW 3: CALENDAR DEADLINE VIEW */}
        <TabsContent value="calendar" className="mt-1">
          <TaskCalendarView
            monthCursor={calendarDate}
            onMonthChange={setCalendarDate}
            tasks={filteredTasks}
            onPickTask={setActiveTaskId}
            onAllocateDate={(isoDate) => openAllocateFor([], isoDate)}
          />
        </TabsContent>

        {/* VIEW 4: TEAM PROGRESS & SELECT-TO-ALLOCATE VIEW */}
        <TabsContent value="team" className="mt-1 flex flex-col gap-3">
          {currentUser?.isMaster && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-canvas p-2.5">
              <span className="mr-1 text-[11px] font-medium text-ink-muted">Allocate by Group:</span>
              {Array.from(
                allMembers.reduce((acc, m) => {
                  const dept = m.department || "General";
                  const list = acc.get(dept) ?? [];
                  list.push(m);
                  acc.set(dept, list);
                  return acc;
                }, new Map<string, DirectoryMember[]>())
              )
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(0, 12)
                .map(([dept, deptMembers]) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => openAllocateFor(deptMembers)}
                    className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:border-primary hover:text-primary transition-colors"
                  >
                    <Users className="size-3 text-ink-muted" />
                    <span>{dept}</span>
                    <span className="text-[10px] text-ink-faint">({deptMembers.length})</span>
                  </button>
                ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teamStats.map(({ member, total, done, active, avgProgress }) => {
              const checked = teamPickedIds.includes(member.id);
              return (
                <Card
                  key={member.id}
                  className={cn("transition-colors", checked && "border-primary ring-1 ring-primary/20")}
                >
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setTeamPickedIds((prev) =>
                              v ? [...prev, member.id] : prev.filter((id) => id !== member.id)
                            )
                          }
                          aria-label={`Select ${member.name}`}
                        />
                        <Avatar className="size-8">
                          <AvatarFallback>{initials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-ink">{member.name}</p>
                          <p className="truncate text-[11px] text-ink-muted">
                            {member.designation} · {member.department}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openAllocateFor([member])}>
                        <Plus className="size-3" />
                        Allocate
                      </Button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-muted">Completion Progress</span>
                        <span className="font-semibold text-ink">{avgProgress}%</span>
                      </div>
                      <Progress
                        value={avgProgress}
                        indicatorClassName={avgProgress === 100 && total > 0 ? "bg-success" : undefined}
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-line pt-2 text-[11px] text-ink-muted">
                      <span>Total: <strong className="text-ink">{total}</strong></span>
                      <span>Active: <strong className="text-ink">{active}</strong></span>
                      <span>Done: <strong className="text-success">{done}</strong></span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ALLOCATE TASK MODAL (Multi-Select Assignee + Subtasks) */}
      <AllocateTaskDialog
        key={allocateOpen ? `open-${selectedAssignees.map((a) => a.id).join(",")}-${defaultDueDate ?? ""}` : "closed"}
        open={allocateOpen}
        onOpenChange={setAllocateOpen}
        members={allMembers}
        initialAssignees={selectedAssignees}
        initialDueDate={defaultDueDate}
        onCreated={() => {
          setTeamPickedIds([]);
          void loadData();
        }}
      />

      {/* TASK DETAIL & PROGRESS SHEET */}
      <TaskDetailSheet
        key={activeTask?.id ?? "none"}
        task={activeTask}
        onClose={() => setActiveTaskId(null)}
        onSave={patchTask}
        onDelete={deleteTask}
      />
    </div>
  );
}

const SUBTASK_PRESETS = ["Data Collect", "Draft Prepare", "Review & Verify", "Final Submit"] as const;
const PROJECT_SPACES = [
  "General Operations",
  "Purchase",
  "Inventory",
  "Production",
  "Sales",
  "Accounts",
  "HRM",
] as const;

function AllocateTaskDialog({
  open,
  onOpenChange,
  members,
  initialAssignees,
  initialDueDate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: DirectoryMember[];
  initialAssignees: DirectoryMember[];
  initialDueDate?: string | null;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [assignees, setAssignees] = useState<DirectoryMember[]>(initialAssignees);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [allocationMode, setAllocationMode] = useState<"INDIVIDUAL" | "GROUP">("INDIVIDUAL");
  const [groupName, setGroupName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("HIGH");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [deadline, setDeadline] = useState(
    () => initialDueDate || new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10)
  );
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [projectName, setProjectName] = useState("General Operations");
  const [recurringType, setRecurringType] = useState<RecurringType>("ONE_TIME");
  const [collaborators, setCollaborators] = useState<DirectoryMember[]>([]);
  const [collabPickerOpen, setCollabPickerOpen] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggleMember(member: DirectoryMember) {
    setAssignees((prev) =>
      prev.some((m) => m.id === member.id) ? prev.filter((m) => m.id !== member.id) : [...prev, member]
    );
  }

  const departmentGroups = useMemo(() => {
    const map = new Map<string, DirectoryMember[]>();
    for (const m of members) {
      const dept = m.department || "General";
      const list = map.get(dept) ?? [];
      list.push(m);
      map.set(dept, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [members]);

  function selectDepartmentGroup(dept: string, deptMembers: DirectoryMember[]) {
    setAssignees((prev) => {
      const existing = new Set(prev.map((m) => m.id));
      const merged = [...prev];
      for (const m of deptMembers) {
        if (!existing.has(m.id)) merged.push(m);
      }
      return merged;
    });
    if (!groupName) setGroupName(dept);
    setGroupPickerOpen(false);
  }

  function toggleCollaborator(member: DirectoryMember) {
    setCollaborators((prev) =>
      prev.some((m) => m.id === member.id) ? prev.filter((m) => m.id !== member.id) : [...prev, member]
    );
  }

  function addSubtask(value?: string) {
    const text = (value ?? subtaskText).trim();
    if (!text) return;
    setChecklist((prev) => [...prev, { id: crypto.randomUUID(), text, done: false }]);
    if (!value) setSubtaskText("");
  }

  function handleSubtaskPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const raw = e.clipboardData.getData("text");
    if (!raw.includes("\n")) return;
    e.preventDefault();
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setChecklist((prev) => [...prev, ...lines.map((text) => ({ id: crypto.randomUUID(), text, done: false }))]);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/connect/upload", { method: "POST", body: form });
      const json = await res.json();
      const uploaded = json.attachments?.[0] ?? json.files?.[0];
      if (!res.ok || !json.success || !uploaded?.url) {
        toast.error(json.error || "File upload failed.");
        return;
      }
      setAttachment({ name: uploaded.name || file.name, url: uploaded.url });
    } catch {
      toast.error("Failed to upload attachment.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a task title.");
      return;
    }
    if (assignees.length === 0) {
      toast.error("Please select at least one person to allocate this task.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/connect/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_TASK",
          title: title.trim(),
          description: description.trim(),
          projectName,
          priority,
          startDate: `${startDate}T09:00:00.000Z`,
          deadline: `${deadline}T18:00:00.000Z`,
          recurringType,
          verificationRequired,
          checklist,
          allocationMode: assignees.length > 1 ? allocationMode : "INDIVIDUAL",
          groupName: groupName.trim() || undefined,
          collaborators: collaborators.map((c) => ({
            id: c.id,
            name: c.name,
            department: c.department,
          })),
          attachmentName: attachment?.name ?? null,
          attachmentUrl: attachment?.url ?? null,
          assignees: assignees.map((a) => ({
            id: a.id,
            name: a.name,
            designation: a.designation,
            department: a.department,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to allocate task.");
        return;
      }
      toast.success(`Task allocated to ${assignees.length} member${assignees.length > 1 ? "s" : ""}.`);
      setTitle("");
      setDescription("");
      setChecklist([]);
      setCollaborators([]);
      setAttachment(null);
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error("Network error while allocating task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Allocate Task</DialogTitle>
          <DialogDescription>Select one or more team members and define the task deliverables.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          {/* Multi-Select Assignee + Group Picker */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-ink">Allocate To</label>
              <Popover open={groupPickerOpen} onOpenChange={setGroupPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Users className="size-3" />
                    Select by Department / Group
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60 p-0">
                  <Command>
                    <CommandInput placeholder="Search department..." />
                    <CommandList>
                      <CommandEmpty>No department found.</CommandEmpty>
                      <CommandGroup>
                        {departmentGroups.map(([dept, list]) => (
                          <CommandItem key={dept} value={dept} onSelect={() => selectDepartmentGroup(dept, list)}>
                            <Users className="size-3.5 text-ink-muted" />
                            <span className="flex-1 truncate">{dept}</span>
                            <span className="text-[10px] text-ink-faint">{list.length}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate text-ink-muted">
                    {assignees.length === 0
                      ? "Select employees..."
                      : `${assignees.length} member${assignees.length > 1 ? "s" : ""} selected`}
                  </span>
                  <ChevronsUpDown className="size-3.5 text-ink-faint" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search name or department..." />
                  <CommandList>
                    <CommandEmpty>No matching employee.</CommandEmpty>
                    <CommandGroup>
                      {members.map((m) => {
                        const selected = assignees.some((a) => a.id === m.id);
                        return (
                          <CommandItem key={m.id} value={`${m.name} ${m.department}`} onSelect={() => toggleMember(m)}>
                            <Check className={cn("size-3.5 text-primary", selected ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-medium text-ink">{m.name}</span>
                              <span className="truncate text-[10px] text-ink-faint">
                                {m.designation} · {m.department}
                              </span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {assignees.length > 0 && (
              <div className="flex flex-col gap-2 pt-0.5">
                <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
                  {assignees.map((a) => (
                    <Badge key={a.id} variant="info" className="pr-1">
                      {a.name}
                      <button
                        type="button"
                        onClick={() => toggleMember(a)}
                        className="rounded-full p-0.5 hover:bg-primary/15"
                        aria-label={`Remove ${a.name}`}
                      >
                        <X className="size-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                {assignees.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-[11px]">
                    <span className="font-medium text-ink-muted">Mode:</span>
                    <button
                      type="button"
                      onClick={() => setAllocationMode("INDIVIDUAL")}
                      className={cn(
                        "rounded px-2 py-0.5 font-medium transition-colors",
                        allocationMode === "INDIVIDUAL" ? "bg-surface text-ink shadow-2xs" : "text-ink-muted hover:text-ink"
                      )}
                    >
                      Individual ({assignees.length} tasks)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllocationMode("GROUP")}
                      className={cn(
                        "rounded px-2 py-0.5 font-medium transition-colors",
                        allocationMode === "GROUP" ? "bg-surface text-ink shadow-2xs" : "text-ink-muted hover:text-ink"
                      )}
                    >
                      Shared Group (1 task)
                    </button>
                    {allocationMode === "GROUP" && (
                      <Input
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Group label (e.g. Purchase Team)"
                        className="h-6 flex-1 min-w-36 text-[11px]"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink">Task Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Monthly supplier reconciliation" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink">Due Date</label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink">Notes (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief instructions or deliverable expectations..."
              rows={2}
            />
          </div>

          {/* Custom Subtasks / Checklist + Quick Presets + Multi-line Paste */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ink">Subtasks (auto-tracks progress %)</label>
              {checklist.length > 0 && (
                <span className="text-[10px] text-ink-faint">{checklist.length} items</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {SUBTASK_PRESETS.map((preset) => {
                const exists = checklist.some((c) => c.text.toLowerCase() === preset.toLowerCase());
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={exists}
                    onClick={() => addSubtask(preset)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                      exists
                        ? "border-line bg-control text-ink-faint opacity-60 cursor-default"
                        : "border-line-strong bg-surface text-ink-muted hover:border-primary hover:text-primary"
                    )}
                  >
                    + {preset}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                value={subtaskText}
                onChange={(e) => setSubtaskText(e.target.value)}
                onPaste={handleSubtaskPaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Type subtask & press Enter (or paste multiple lines)..."
              />
              <Button type="button" variant="outline" onClick={() => addSubtask()}>
                Add
              </Button>
            </div>
            {checklist.length > 0 && (
              <div className="mt-1 flex max-h-36 flex-col gap-1 overflow-y-auto rounded-md border border-line bg-canvas p-2">
                {checklist.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs text-ink">
                    <span className="w-4 text-[10px] text-ink-faint">{idx + 1}.</span>
                    <input
                      value={item.text}
                      onChange={(e) =>
                        setChecklist((prev) =>
                          prev.map((c) => (c.id === item.id ? { ...c, text: e.target.value } : c))
                        )
                      }
                      className="flex-1 bg-transparent text-xs text-ink outline-none focus:underline"
                    />
                    <button
                      type="button"
                      onClick={() => setChecklist((prev) => prev.filter((c) => c.id !== item.id))}
                      className="text-ink-faint hover:text-danger"
                      aria-label="Remove subtask"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collapsible More Options (Project, Repeat, Start Date, Collaborators, Attachment) */}
          <div className="rounded-md border border-line bg-canvas/60 px-3 py-2">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-medium text-ink-muted hover:text-ink"
            >
              <span>More options (Project, Repeat, CC, File)</span>
              {showMore ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>

            {showMore && (
              <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-ink-muted">Project / Space</label>
                    <Select value={projectName} onValueChange={setProjectName}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_SPACES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-ink-muted">Repeat</label>
                    <Select value={recurringType} onValueChange={(v) => setRecurringType(v as RecurringType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ONE_TIME">One-time</SelectItem>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-ink-muted">Start Date</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-ink-muted">Collaborators (CC)</label>
                    <Popover open={collabPickerOpen} onOpenChange={setCollabPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span className="truncate text-ink-muted">
                            {collaborators.length === 0 ? "None" : `${collaborators.length} selected`}
                          </span>
                          <ChevronsUpDown className="size-3.5 text-ink-faint" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-60 p-0">
                        <Command>
                          <CommandInput placeholder="Search CC..." />
                          <CommandList>
                            <CommandEmpty>No match.</CommandEmpty>
                            <CommandGroup>
                              {members.map((m) => {
                                const selected = collaborators.some((c) => c.id === m.id);
                                return (
                                  <CommandItem key={m.id} value={m.name} onSelect={() => toggleCollaborator(m)}>
                                    <Check className={cn("size-3.5 text-primary", selected ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{m.name}</span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-control">
                    <Paperclip className="size-3.5 text-ink-muted" />
                    <span>{uploading ? "Uploading..." : attachment ? attachment.name : "Attach File"}</span>
                    <input type="file" className="hidden" onChange={(e) => void handleFileUpload(e)} disabled={uploading} />
                  </label>
                  {attachment && (
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="text-xs text-ink-muted hover:text-danger"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
            <Checkbox checked={verificationRequired} onCheckedChange={(v) => setVerificationRequired(!!v)} />
            Require supervisor review before marking Done
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || uploading}>
              {submitting ? "Allocating..." : "Allocate Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailSheet({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: ConnectTaskRecord | null;
  onClose: () => void;
  onSave: (
    taskId: string,
    payload: { status?: TaskStatus; progressPercent?: number; checklist?: TaskChecklistItem[]; staffRemarks?: string }
  ) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}) {
  const [progress, setProgress] = useState(task?.progressPercent ?? 0);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "NOT_STARTED");
  const [remarks, setRemarks] = useState(task?.staffRemarks ?? "");
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>(task?.checklist ?? []);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<TaskActivityLog[]>([]);

  useEffect(() => {
    if (!task) return;
    let active = true;
    fetch(`/api/connect/tasks/${task.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (active && json?.success && Array.isArray(json.logs)) {
          setLogs(json.logs);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [task]);

  if (!task) return null;
  const pri = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.MEDIUM;

  async function toggleCheck(itemId: string) {
    if (!task) return;
    const next = checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    setChecklist(next);
    const pct = next.length > 0 ? Math.round((next.filter((c) => c.done).length / next.length) * 100) : progress;
    setProgress(pct);
    const nextStatus: TaskStatus =
      pct === 100 ? (task.verificationRequired ? "SUBMITTED_FOR_APPROVAL" : "VERIFIED_COMPLETED") : pct > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    setStatus(nextStatus);
    await onSave(task.id, { checklist: next, progressPercent: pct, status: nextStatus });
  }

  async function addCheckItem() {
    if (!task || !newItem.trim()) return;
    const next = [...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }];
    setChecklist(next);
    setNewItem("");
    const pct = Math.round((next.filter((c) => c.done).length / next.length) * 100);
    setProgress(pct);
    await onSave(task.id, { checklist: next, progressPercent: pct });
  }

  async function handleSave() {
    if (!task) return;
    setSaving(true);
    await onSave(task.id, { status, progressPercent: progress, checklist, staffRemarks: remarks });
    setSaving(false);
    onClose();
  }

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant={pri.variant}>{pri.label}</Badge>
            <span className="text-[11px] font-medium text-ink-faint">{task.taskCode}</span>
          </div>
          <SheetTitle className="mt-1">{task.title}</SheetTitle>
          <SheetDescription>
            Allocated to <strong className="text-ink">{task.assignedToName}</strong> · Due {formatDueDate(task.deadline)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <Badge variant="outline">{task.projectName}</Badge>
            {task.recurringType !== "ONE_TIME" && (
              <Badge variant="secondary">
                <Repeat className="size-3" />
                {task.recurringType}
              </Badge>
            )}
            {task.attachmentUrl && (
              <a
                href={task.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-primary hover:underline"
              >
                <Paperclip className="size-3" />
                {task.attachmentName || "Attachment"}
              </a>
            )}
          </div>

          {task.description && (
            <p className="rounded-md bg-canvas p-3 text-xs text-ink-muted">{task.description}</p>
          )}

          {/* Progress Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink">Progress</span>
              <span className="font-semibold text-primary">{progress}%</span>
            </div>
            <Slider
              value={[progress]}
              max={100}
              step={5}
              onValueChange={([v]) => {
                setProgress(v);
                if (v === 100) setStatus(task.verificationRequired ? "SUBMITTED_FOR_APPROVAL" : "VERIFIED_COMPLETED");
                else if (v > 0 && status === "NOT_STARTED") setStatus("IN_PROGRESS");
              }}
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_COLUMNS.map((c) => (
                  <SelectItem key={c.status} value={c.status}>
                    {STATUS_LABEL[c.status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Subtasks Checklist */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink">Subtasks</span>
              <span className="text-[11px] text-ink-faint">
                {checklist.filter((c) => c.done).length}/{checklist.length} done
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addCheckItem();
                  }
                }}
                placeholder="Add subtask..."
              />
              <Button type="button" variant="outline" size="sm" onClick={() => void addCheckItem()}>
                Add
              </Button>
            </div>
            {checklist.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-2.5 py-2 text-xs hover:bg-canvas"
                  >
                    <Checkbox checked={item.done} onCheckedChange={() => void toggleCheck(item.id)} />
                    <span className={cn("flex-1", item.done && "line-through text-ink-faint")}>{item.text}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Progress Note */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink">Progress Note</label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Write a quick update..."
              rows={3}
            />
          </div>

          <Separator />

          {/* Live Activity Timeline */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink">
              <History className="size-3.5 text-ink-muted" />
              <span>Activity Timeline</span>
            </div>
            {logs.length === 0 ? (
              <p className="text-[11px] text-ink-faint">No activity logged yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {logs.slice(0, 10).map((log) => (
                  <div key={log.id} className="flex items-start gap-2 rounded-md border border-line bg-canvas/60 px-2.5 py-2 text-[11px]">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink truncate">{log.actor_name}</span>
                        <span className="text-[10px] text-ink-faint shrink-0">
                          {new Date(log.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                      <p className="text-ink-muted">
                        {log.remarks || log.action_type.replace(/_/g, " ")}
                        {log.progress_percent !== null && ` (${log.progress_percent}%)`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <Button
            variant="ghost"
            className="text-danger hover:bg-rose-50 hover:text-danger dark:hover:bg-rose-950/50"
            onClick={() => void onDelete(task.id)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Progress"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TaskCalendarView({
  monthCursor,
  onMonthChange,
  tasks,
  onPickTask,
  onAllocateDate,
}: {
  monthCursor: Date;
  onMonthChange: (next: Date) => void;
  tasks: ConnectTaskRecord[];
  onPickTask: (taskId: string) => void;
  onAllocateDate: (isoDate: string) => void;
}) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const todayIso = new Date().toISOString().slice(0, 10);

  const byDate = useMemo(() => {
    const map = new Map<string, ConnectTaskRecord[]>();
    for (const t of tasks) {
      const key = t.deadline.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">
          {monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => onMonthChange(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onMonthChange(new Date())}>
            Today
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => onMonthChange(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-canvas text-center text-[11px] font-medium text-ink-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - startOffset + 1;
          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const iso = inMonth
            ? `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
            : "";
          const dayTasks = inMonth ? (byDate.get(iso) ?? []) : [];
          const isToday = iso === todayIso;
          return (
            <div
              key={idx}
              className={cn(
                "group min-h-24 border-r border-b border-line p-1.5 last:border-r-0",
                !inMonth && "bg-canvas/50"
              )}
            >
              {inMonth && (
                <>
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex size-5 items-center justify-center rounded-full text-[11px] font-medium",
                        isToday ? "bg-primary text-primary-fg" : "text-ink-muted"
                      )}
                    >
                      {dayNum}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAllocateDate(iso)}
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-ink-faint hover:bg-control hover:text-ink transition-opacity"
                      title={`Allocate task due ${iso}`}
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {dayTasks.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onPickTask(t.id)}
                        className={cn(
                          "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-colors hover:opacity-80",
                          t.status === "VERIFIED_COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : t.isOverdue
                              ? "bg-rose-50 text-danger dark:bg-rose-950/50"
                              : "bg-accent-soft text-accent-strong dark:text-accent"
                        )}
                      >
                        <span className="truncate">{t.title}</span>
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="px-1 text-[10px] text-ink-faint">+{dayTasks.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
