"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Copy,
  Download,
  Filter,
  Search,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CALENDAR_DEFINITIONS } from "../constants";
import type { CalendarDefinition } from "../types";

interface CalendarInfoModalProps {
  open: boolean;
  onClose: () => void;
  defaultOffice?: string;
}

export function CalendarInfoModal({
  open,
  onClose,
  defaultOffice,
}: CalendarInfoModalProps) {
  const [selectedOffice, setSelectedOffice] = useState<string>(
    defaultOffice || "ALL",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Filter only regular shift calendars (excluding OFF and HOL from main table view or keeping them in separate section)
  const regularCalendars = useMemo(
    () => CALENDAR_DEFINITIONS.filter((c) => c.shortCode !== "OFF" && c.shortCode !== "HOL"),
    [],
  );

  const officeOptions = useMemo(
    () => Array.from(new Set(regularCalendars.map((c) => c.office))),
    [regularCalendars],
  );

  const filteredCalendars = useMemo(() => {
    return regularCalendars.filter((item) => {
      if (selectedOffice !== "ALL" && item.office !== selectedOffice) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.office.toLowerCase().includes(q) ||
          item.calendarName.toLowerCase().includes(q) ||
          item.shortCode.toLowerCase().includes(q) ||
          item.startTime.toLowerCase().includes(q) ||
          item.endTime.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [regularCalendars, selectedOffice, searchQuery]);

  const handleCopy = () => {
    const header = [
      "Office",
      "Calendar Name",
      "Short Code",
      "Start Time",
      "End Time",
      "Min. Work Hour",
      "Last Start Time",
      "Grace Time",
      "Min In Time",
      "Max Out Time",
      "Break Start Time",
      "Break End Time",
    ].join("\t");

    const rows = filteredCalendars.map((c) =>
      [
        c.office,
        c.calendarName,
        c.shortCode,
        c.startTime,
        c.endTime,
        c.minWorkHour,
        c.lastStartTime,
        c.graceTime,
        c.minInTime,
        c.maxOutTime,
        c.breakStartTime,
        c.breakEndTime,
      ].join("\t"),
    );

    navigator.clipboard.writeText([header, ...rows].join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    const header = [
      "Office",
      "Calendar Name",
      "Short Code",
      "Start Time",
      "End Time",
      "Min Work Hour",
      "Last Start Time",
      "Grace Time",
      "Min In Time",
      "Max Out Time",
      "Break Start Time",
      "Break End Time",
    ].join(",");

    const rows = filteredCalendars.map((c) =>
      [
        `"${c.office}"`,
        `"${c.calendarName}"`,
        `"${c.shortCode}"`,
        `"${c.startTime}"`,
        `"${c.endTime}"`,
        c.minWorkHour,
        `"${c.lastStartTime}"`,
        `"${c.graceTime}"`,
        `"${c.minInTime}"`,
        `"${c.maxOutTime}"`,
        `"${c.breakStartTime}"`,
        `"${c.breakEndTime}"`,
      ].join(","),
    );

    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `calendar_information_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line bg-canvas px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Calendar & Shift Information</h2>
              <p className="text-xs text-ink-muted">
                Complete shift roster timings, minimum work hours, grace periods, and break schedules
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5"
              title="Copy table to clipboard"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              <span>{copied ? "Copied" : "Copy TSV"}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1.5"
              title="Download CSV"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2"
              aria-label="Close modal"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-ink-muted flex items-center gap-1">
              <Filter className="size-3.5" /> Office:
            </span>
            <button
              type="button"
              onClick={() => setSelectedOffice("ALL")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedOffice === "ALL"
                  ? "bg-primary text-white"
                  : "bg-control text-ink-muted hover:bg-hover hover:text-ink"
              }`}
            >
              All Offices ({regularCalendars.length})
            </button>
            {officeOptions.map((office) => {
              const count = regularCalendars.filter((c) => c.office === office).length;
              return (
                <button
                  key={office}
                  type="button"
                  onClick={() => setSelectedOffice(office)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedOffice === office
                      ? "bg-primary text-white"
                      : "bg-control text-ink-muted hover:bg-hover hover:text-ink"
                  }`}
                >
                  {office} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shift or code..."
              className="h-8 w-full rounded-md border border-line bg-surface pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line bg-control/80 text-ink font-semibold">
                  <th className="py-2.5 px-3">Office</th>
                  <th className="py-2.5 px-3">Calendar Name</th>
                  <th className="py-2.5 px-3 text-center">Short Code</th>
                  <th className="py-2.5 px-3">Start Time</th>
                  <th className="py-2.5 px-3">End Time</th>
                  <th className="py-2.5 px-3 text-center">Min. Work Hour</th>
                  <th className="py-2.5 px-3">Last Start Time</th>
                  <th className="py-2.5 px-3">Grace Time</th>
                  <th className="py-2.5 px-3">Min In Time</th>
                  <th className="py-2.5 px-3">Max Out Time</th>
                  <th className="py-2.5 px-3">Break Start</th>
                  <th className="py-2.5 px-3">Break End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredCalendars.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-ink-muted">
                      No calendars matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredCalendars.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-hover/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-medium text-ink whitespace-nowrap">
                        {c.office}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-ink whitespace-nowrap">
                        {c.calendarName}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded text-xs font-bold border ${c.badgeBg} ${c.badgeText} ${c.badgeBorder}`}
                        >
                          {c.shortCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink">
                          <Clock className="size-3 text-ink-faint" />
                          {c.startTime}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink">
                          <Clock className="size-3 text-ink-faint" />
                          {c.endTime}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center rounded-full bg-control px-2 py-0.5 font-semibold text-ink">
                          {c.minWorkHour} hrs
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted font-mono text-[11px] whitespace-nowrap">
                        {c.lastStartTime}
                      </td>
                      <td className="py-2.5 px-3 text-amber-700 dark:text-amber-400 font-mono text-[11px] font-medium whitespace-nowrap">
                        {c.graceTime}
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted font-mono text-[11px] whitespace-nowrap">
                        {c.minInTime}
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted font-mono text-[11px] whitespace-nowrap">
                        {c.maxOutTime}
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted font-mono text-[11px] whitespace-nowrap">
                        {c.breakStartTime}
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted font-mono text-[11px] whitespace-nowrap">
                        {c.breakEndTime}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-line bg-canvas px-6 py-3 text-xs text-ink-muted">
          <span>
            Showing <strong>{filteredCalendars.length}</strong> of{" "}
            <strong>{regularCalendars.length}</strong> configured calendars
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
