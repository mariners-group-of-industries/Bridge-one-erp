"use client";

import { Eye, FileSpreadsheet, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CONTROL, SelectField } from "@/components/ui/form-field";
import { Card } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { exportList, rtmApi, type TerritoryFilters } from "../services/rtm.api";
import { options } from "./kit";

// Filters and list frame shared by Retail Order, Delivery and Collection.

export interface TerritoryValue {
  basePointId: string;
  routeId: string;
  marketId: string;
  srId: string;
}

export const EMPTY_TERRITORY: TerritoryValue = { basePointId: "", routeId: "", marketId: "", srId: "" };

/** The most specific node picked (market › route › base point). */
export const nodeOf = (v: TerritoryValue) => v.marketId || v.routeId || v.basePointId;

export function useTerritory() {
  return useResource("rtm-territory", () => rtmApi.get<TerritoryFilters>("territory"));
}

/** Base Point › Route › Market › Sales Force: each list narrows to the one before it. */
export function TerritoryFields({ value, onChange, territory }: { value: TerritoryValue; onChange: (v: TerritoryValue) => void; territory: TerritoryFilters | undefined }) {
  const routes = (territory?.routes ?? []).filter((r) => !value.basePointId || r.parentId === value.basePointId);
  const markets = (territory?.markets ?? []).filter((m) => (value.routeId ? m.parentId === value.routeId : !value.basePointId || routes.some((r) => r.id === m.parentId)));
  const node = nodeOf(value);
  const salesForce = (territory?.salesForce ?? []).filter((s) => !node || s.nodeIds.includes(node));
  const keepSr = (next: Omit<TerritoryValue, "srId">) => {
    const n = nodeOf({ ...next, srId: "" });
    const sr = territory?.salesForce.find((s) => s.id === value.srId);
    return { ...next, srId: sr && (!n || sr.nodeIds.includes(n)) ? value.srId : "" };
  };
  return (
    <>
      <SelectField
        label="Base Point"
        className="w-48"
        value={value.basePointId}
        onChange={(e) => onChange(keepSr({ basePointId: e.target.value, routeId: "", marketId: "" }))}
        options={options(territory?.basePoints, (n) => n.name, (n) => n.id, "All base points")}
      />
      <SelectField
        label="Route"
        className="w-48"
        value={value.routeId}
        onChange={(e) => onChange(keepSr({ basePointId: value.basePointId, routeId: e.target.value, marketId: "" }))}
        options={options(routes, (n) => n.name, (n) => n.id, "All routes")}
      />
      <SelectField
        label="Market"
        className="w-48"
        value={value.marketId}
        onChange={(e) => onChange(keepSr({ basePointId: value.basePointId, routeId: value.routeId, marketId: e.target.value }))}
        options={options(markets, (n) => n.name, (n) => n.id, "All markets")}
      />
      <SelectField
        label="Sales Force"
        className="w-56"
        value={value.srId}
        onChange={(e) => onChange({ ...value, srId: e.target.value })}
        options={options(salesForce, (s) => `${s.code} · ${s.name}`, (s) => s.id, "All sales force")}
      />
    </>
  );
}

/**
 * Filters edited on screen, applied on "View". `view()` applies the draft; when it
 * is already applied, `onSame` runs instead (load the same filters again).
 */
export function useViewFilters<T extends object>(initial: T) {
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const key = JSON.stringify(applied);
  return {
    draft,
    set: (patch: Partial<T>) => setDraft((d) => ({ ...d, ...patch })),
    applied,
    key,
    view: (onSame: () => void) => (JSON.stringify(draft) === key ? onSame() : setApplied(draft)),
  };
}

export function ViewButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <Button variant="primary" loading={loading} onClick={onClick} className="mb-px">
      {!loading && <Eye />} View
    </Button>
  );
}

export type ExportCell = string | number | null;

export interface ExportFile<T> {
  title: string;
  headers: string[];
  row: (r: T, index: number) => ExportCell[];
}

/** Downloads rows as Excel through `/api/rtm/<page>/export`; errors show as a toast. */
export function useListExport<T>(page: string, file: ExportFile<T>) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const download = async (rows: readonly T[]) => {
    setExporting(true);
    try {
      await exportList(page, file.title, file.headers, rows.map(file.row));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };
  return { exporting, download };
}

/** A list with its title on the left and outlet search + Excel download on the top right. */
export function ListCard<T>({
  title,
  rows,
  query,
  onQuery,
  placeholder = "Search outlet…",
  exportPage,
  exportFile,
  canExport,
  children,
}: {
  title: string;
  /** Rows after search: what is shown and exported. */
  rows: readonly T[];
  query: string;
  onQuery: (q: string) => void;
  placeholder?: string;
  /** RTM page path segment ("retail-order"): the export uses that page's permission. */
  exportPage: string;
  exportFile: ExportFile<T>;
  canExport: boolean;
  children: ReactNode;
}) {
  const { exporting, download: save } = useListExport(exportPage, exportFile);
  const download = () => save(rows);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="mr-auto text-sm font-semibold text-ink">
          {title} <span className="ml-1 text-xs font-medium text-ink-muted tabular-nums">{rows.length}</span>
        </h2>
        <label className="relative w-full sm:w-64">
          <span className="sr-only">{placeholder}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2 size-4 text-ink-faint" />
          <input type="search" value={query} placeholder={placeholder} onChange={(e) => onQuery(e.target.value)} className={cn(CONTROL, "h-8 pl-7")} />
        </label>
        {canExport && (
          <Button onClick={download} loading={exporting} disabled={rows.length === 0} title={rows.length === 0 ? "Nothing to export" : "Download as Excel"}>
            {!exporting && <FileSpreadsheet />} Excel
          </Button>
        )}
      </div>
      {children}
    </Card>
  );
}

/** Rows whose outlet (name, code or mobile) matches the search. */
export const searchOutlets = <T extends { outletName: string; outletCode: string; outletPhone: string | null }>(rows: readonly T[] | undefined, query: string) => {
  const q = query.trim().toLowerCase();
  if (!rows) return [];
  return q ? rows.filter((r) => `${r.outletName} ${r.outletCode} ${r.outletPhone ?? ""}`.toLowerCase().includes(q)) : rows;
};

/** A small icon button for a row's Action cell. */
export function RowAction({ label, icon, onClick, disabled, loading, tone }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean; tone?: "danger" }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick} disabled={disabled} loading={loading} className={cn(tone === "danger" && "hover:text-danger")}>
      {!loading && icon}
    </Button>
  );
}

/**
 * One select per territory layer (National › Region › … › Market, as configured),
 * plus Sales Rep. `value` maps layer id → node id; picking a node clears the
 * layers below it, and each list shows only nodes under the picks above.
 */
export function LayerFields({ value, srId, onChange, territory, srLabel = "Sales Rep", withSr = true }: { value: Record<string, string>; srId: string; onChange: (layers: Record<string, string>, srId: string) => void; territory: TerritoryFilters | undefined; srLabel?: string; withSr?: boolean }) {
  const layers = territory?.layers ?? [];
  const deepest = (upTo: number) => {
    for (let i = upTo - 1; i >= 0; i--) if (value[layers[i].id]) return value[layers[i].id];
    return "";
  };
  const node = deepest(layers.length);
  const salesForce = (territory?.salesForce ?? []).filter((s) => !node || s.nodeIds.includes(node));
  const pick = (index: number, id: string) => {
    const next: Record<string, string> = {};
    layers.forEach((l, i) => {
      if (i < index && value[l.id]) next[l.id] = value[l.id];
    });
    if (id) next[layers[index].id] = id;
    const n = id || Object.values(next).at(-1) || "";
    const sr = territory?.salesForce.find((s) => s.id === srId);
    onChange(next, sr && (!n || sr.nodeIds.includes(n)) ? srId : "");
  };
  return (
    <>
      {layers.map((l, i) => {
        const above = deepest(i);
        const nodes = above ? l.nodes.filter((n) => n.path.includes(above)) : l.nodes;
        return <SelectField key={l.id} label={l.name} className="w-44" value={value[l.id] ?? ""} onChange={(e) => pick(i, e.target.value)} options={options(nodes, (n) => n.name, (n) => n.id, `All`)} />;
      })}
      {withSr && <SelectField label={srLabel} className="w-56" value={srId} onChange={(e) => onChange(value, e.target.value)} options={options(salesForce, (s) => `${s.code} · ${s.name}`, (s) => s.id, "All")} />}
    </>
  );
}

/** The most specific node picked in LayerFields. */
export const deepestNode = (territory: TerritoryFilters | undefined, value: Record<string, string>) =>
  [...(territory?.layers ?? [])].reverse().map((l) => value[l.id]).find(Boolean) ?? "";
