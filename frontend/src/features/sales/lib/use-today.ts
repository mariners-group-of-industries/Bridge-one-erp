"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** Local calendar date as "YYYY-MM-DD" (what <input type="date"> uses). */
export function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The browser's local date, or null while prerendering / on the server. Pages
 * that depend on "today" render a loading state until it is known, so the
 * prerender never reads the clock and server/browser time zones cannot disagree.
 */
export function useToday(): string | null {
  return useSyncExternalStore(noSubscribe, () => isoDay(new Date()), () => null);
}

/** "2026-10-11" → "11/10/2026" (the default business unit date format). */
export function formatDay(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/** "2026-10-11" + 14 → "2026-10-25". */
export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
