"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type OutletDayStatus = "ORDER" | "NO_ORDER" | "PENDING";

export interface RoutePoint {
  id: string;
  kind: string;
  at: string;
  outlet: string | null;
  latitude: number;
  longitude: number;
}

export interface MapOutlet {
  id: string;
  code: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: OutletDayStatus;
}

/** Marker colours (DESIGN.md semantic accents). */
export const STATUS_COLORS = {
  START: "#0f172a",
  ORDER: "#059669",
  NO_ORDER: "#2563eb",
  PENDING: "#e11d48",
} as const;

export const STATUS_LABELS: Record<OutletDayStatus, string> = { ORDER: "Order", NO_ORDER: "No Order", PENDING: "Pending Visit" };

const SPEEDS = [0.5, 1, 2, 5, 10, 20, 500] as const;
/** Dhaka (no data yet): the map's resting view. */
const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125];

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
export const formatClock = (ms: number) => clock.format(new Date(ms));

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Where the rep was at time `t`: linear between the two route points around it. */
function positionAt(points: RoutePoint[], times: number[], t: number): [number, number] {
  if (t <= times[0]) return [points[0].latitude, points[0].longitude];
  for (let i = 1; i < points.length; i++) {
    if (t <= times[i]) {
      const span = times[i] - times[i - 1] || 1;
      const f = (t - times[i - 1]) / span;
      return [points[i - 1].latitude + (points[i].latitude - points[i - 1].latitude) * f, points[i - 1].longitude + (points[i].longitude - points[i - 1].longitude) * f];
    }
  }
  const last = points[points.length - 1];
  return [last.latitude, last.longitude];
}

/**
 * The field day on an OpenStreetMap map: the travelled route, every outlet
 * coloured by status, and a playback bar that replays the route over time.
 */
export function RouteMap({ path, outlets, className }: { path: RoutePoint[]; outlets: MapOutlet[]; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const mover = useRef<Leaflet.CircleMarker | null>(null);
  const trail = useRef<Leaflet.Polyline | null>(null);
  const [ready, setReady] = useState(false);

  const times = useMemo(() => path.map((p) => new Date(p.at).getTime()), [path]);
  const startMs = times[0] ?? 0;
  const endMs = times[times.length - 1] ?? 0;
  const [now, setNow] = useState(startMs);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  // Leaflet touches `window`, so load it in the browser only.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !host.current || map.current) return;
      leaflet.current = L;
      map.current = L.map(host.current, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Route, outlets and the moving marker whenever the data changes.
  useEffect(() => {
    const L = leaflet.current;
    if (!ready || !L || !map.current || !layer.current) return;
    layer.current.clearLayers();
    const bounds: [number, number][] = [];

    if (path.length > 1) {
      L.polyline(path.map((p) => [p.latitude, p.longitude] as [number, number]), { color: STATUS_COLORS.NO_ORDER, weight: 3, opacity: 0.35, dashArray: "6 6" }).addTo(layer.current);
    }
    trail.current = path.length ? L.polyline([], { color: STATUS_COLORS.NO_ORDER, weight: 4, opacity: 0.9 }).addTo(layer.current) : null;

    for (const o of outlets) {
      if (o.latitude === null || o.longitude === null) continue;
      bounds.push([o.latitude, o.longitude]);
      L.circleMarker([o.latitude, o.longitude], { radius: 7, color: "#ffffff", weight: 2, fillColor: STATUS_COLORS[o.status], fillOpacity: 1 })
        .bindPopup(`<strong>${escapeHtml(`${o.code} · ${o.name}`)}</strong><br/>${escapeHtml(STATUS_LABELS[o.status])}${o.address ? `<br/><span style="color:#64748b">${escapeHtml(o.address)}</span>` : ""}`)
        .addTo(layer.current);
    }
    if (path.length) {
      const first = path[0];
      bounds.push(...path.map((p) => [p.latitude, p.longitude] as [number, number]));
      L.circleMarker([first.latitude, first.longitude], { radius: 9, color: "#ffffff", weight: 3, fillColor: STATUS_COLORS.START, fillOpacity: 1 })
        .bindPopup(`<strong>Starting point</strong><br/>${escapeHtml(first.outlet ?? "Check-in")}<br/>${escapeHtml(formatClock(times[0]))}`)
        .addTo(layer.current);
      mover.current = L.circleMarker([first.latitude, first.longitude], { radius: 8, color: STATUS_COLORS.NO_ORDER, weight: 3, fillColor: "#ffffff", fillOpacity: 1 }).addTo(layer.current);
    } else {
      mover.current = null;
    }

    if (bounds.length) map.current.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    else map.current.setView(DEFAULT_CENTER, 12);
    setNow(startMs);
    setPlaying(false);
  }, [ready, path, outlets, times, startMs]);

  // Playback clock.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(t) {
      const dt = t - last;
      last = t;
      setNow((n) => {
        const next = Math.min(endMs, n + dt * speed);
        if (next >= endMs) setPlaying(false);
        return next;
      });
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, endMs]);

  // Move the marker and grow the travelled trail to `now`.
  useEffect(() => {
    if (!path.length || !mover.current || !trail.current) return;
    const at = positionAt(path, times, now);
    mover.current.setLatLng(at);
    const done = path.filter((_p, i) => times[i] <= now).map((p) => [p.latitude, p.longitude] as [number, number]);
    trail.current.setLatLngs(now > startMs ? [...done, at] : []);
  }, [now, path, times, startMs]);

  const canPlay = path.length > 1 && endMs > startMs;
  const progress = canPlay ? ((now - startMs) / (endMs - startMs)) * 100 : 0;

  return (
    <div className={cn("flex flex-col overflow-hidden rounded border border-line bg-surface", className)}>
      <div ref={host} className="isolate h-[420px] w-full bg-control sm:h-[520px]" role="region" aria-label="Travel route map" />
      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-slate-900 px-3 py-2 text-slate-100">
        <button
          type="button"
          aria-label={playing ? "Pause playback" : "Play route"}
          disabled={!canPlay}
          onClick={() => {
            if (!playing && now >= endMs) setNow(startMs);
            setPlaying((p) => !p);
          }}
          className="inline-flex size-9 items-center justify-center rounded hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-40"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="Restart playback"
          disabled={!canPlay}
          onClick={() => {
            setPlaying(false);
            setNow(startMs);
          }}
          className="inline-flex size-9 items-center justify-center rounded hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
        </button>
        <div role="radiogroup" aria-label="Playback speed" className="flex overflow-hidden rounded bg-white/95 p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={speed === s}
              onClick={() => setSpeed(s)}
              className={cn(
                "min-h-7 min-w-9 rounded px-1.5 text-xs font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-blue-500",
                speed === s ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-900",
              )}
            >
              {s}X
            </button>
          ))}
        </div>
        <span className="text-xs tabular-nums text-slate-300">{canPlay ? formatClock(startMs) : "--:--"}</span>
        <label className="flex min-w-40 flex-1 items-center">
          <span className="sr-only">Playback position</span>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            disabled={!canPlay}
            onChange={(e) => {
              setPlaying(false);
              setNow(startMs + ((endMs - startMs) * Number(e.target.value)) / 100);
            }}
            className="h-6 w-full cursor-pointer accent-blue-500 disabled:cursor-not-allowed"
          />
        </label>
        <span className="text-xs tabular-nums text-slate-300">{canPlay ? formatClock(endMs) : "--:--"}</span>
        <span className="rounded border border-blue-400/40 px-2 py-0.5 text-xs font-semibold tabular-nums text-blue-200" aria-live="off">
          {canPlay ? formatClock(now) : "--:--"}
        </span>
      </div>
    </div>
  );
}
