"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { CalendarDefinition } from "./types";

/**
 * The calendars of HR Governance › Calendar Setup (plus Weekly Off and
 * Holiday), loaded once per page visit and shared by every component.
 */
let cache: Promise<CalendarDefinition[]> | null = null;

const load = () => {
  cache ??= apiRequest<CalendarDefinition[]>("/api/hrm/calendar-assign/calendars").catch((error) => {
    cache = null; // Try again next time.
    throw error;
  });
  return cache;
};

export function useCalendars() {
  const [calendars, setCalendars] = useState<CalendarDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    load().then(
      (list) => live && setCalendars(list),
      (e: unknown) => live && setError(e instanceof Error ? e.message : "Could not load the calendars."),
    );
    return () => {
      live = false;
    };
  }, []);

  // A code can exist in more than one office; the badge only needs one of them.
  const byCode = useMemo(() => {
    const map = new Map<string, CalendarDefinition>();
    for (const c of calendars) if (!map.has(c.shortCode)) map.set(c.shortCode, c);
    return map;
  }, [calendars]);

  /** The calendars an office may use: its own, every-office ones, Weekly Off and Holiday. */
  const forOffice = (officeName: string) => calendars.filter((c) => c.office === "All" || c.office === officeName);

  return { calendars, byCode, forOffice, error, loading: !calendars.length && !error };
}
