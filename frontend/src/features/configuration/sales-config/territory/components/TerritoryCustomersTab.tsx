"use client";

import { MapPinned, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { errorMessage } from "@/lib/api/client";
import { EmptyBlock, Field, FormGrid, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { TerritoryCustomerList, TerritoryCustomerRow, TerritoryTree } from "../schemas/territory.schema";
import { territoryApi } from "../services/territory.api";

const PAGE_SIZE = 30;
const money = (value: string | null) =>
  value === null
    ? "—"
    : Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/** Customers of a territory (and everything below it), loaded page by page as you scroll. */
export function TerritoryCustomersTab({ tree, search }: { tree: TerritoryTree; search: string }) {
  const territoryLayer = tree.layers.find((layer) => layer.isTerritory);
  const territories = tree.nodes.filter((node) => node.level === territoryLayer?.level);
  const [nodeId, setNodeId] = useState(territories[0]?.id ?? "");
  const [customerId, setCustomerId] = useState("");
  const [rows, setRows] = useState<TerritoryCustomerRow[]>([]);
  const [meta, setMeta] = useState<Omit<TerritoryCustomerList, "rows"> | null>(null);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  // The request currently settled (data or error); anything else is still loading.
  const [settled, setSettled] = useState<{ key: string; error: string | null }>({ key: "", error: null });
  const sentinel = useRef<HTMLDivElement>(null);
  const queryKey = `${nodeId}|${customerId}|${search}`;
  const [loadedKey, setLoadedKey] = useState("");

  // A new territory / customer / search starts again from page 1.
  if (loadedKey !== queryKey) {
    setLoadedKey(queryKey);
    setRows([]);
    setMeta(null);
    setPage(1);
  }
  const requestKey = `${queryKey}|${page}|${retry}`;
  const loading = !!nodeId && settled.key !== requestKey;
  const error = settled.key === requestKey ? settled.error : null;

  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;
    territoryApi
      .customers({
        businessUnitId: tree.businessUnitId,
        nodeId,
        customerId,
        search,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((result) => {
        if (cancelled) return;
        const { rows: pageRows, ...rest } = result;
        setMeta(rest);
        setRows((current) => (page === 1 ? pageRows : [...current, ...pageRows]));
        setSettled({ key: requestKey, error: null });
      })
      .catch((err) => {
        if (!cancelled) setSettled({ key: requestKey, error: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [tree.businessUnitId, nodeId, customerId, search, page, requestKey]);

  const hasMore = !!meta && rows.length < meta.total;
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasMore || loading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setPage((p) => p + 1);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  if (territories.length === 0) {
    return (
      <div className="p-5">
        <EmptyBlock icon={<MapPinned />} title={`No ${territoryLayer?.name ?? "territory"} entries yet`}>
          Add territories in the Sales Territory tab first.
        </EmptyBlock>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <FormGrid cols={4}>
        <Field label={territoryLayer?.name ?? "Territory"}>
          {(id) => (
            <Select
              id={id}
              value={nodeId}
              placeholder={false}
              options={territories.map((t) => ({
                value: t.id,
                label: `${t.code} · ${t.name}`,
              }))}
              onChange={(e) => {
                setNodeId(e.target.value);
                setCustomerId("");
              }}
            />
          )}
        </Field>
        <Field label="Customer">
          {(id) => (
            <Select
              id={id}
              value={customerId}
              placeholder="All customers"
              options={(meta?.customers ?? []).map((c) => ({
                value: c.id,
                label: `${c.code} · ${c.name}`,
              }))}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          )}
        </Field>
      </FormGrid>

      {meta && (
        <section aria-label="Territory details" className="flex flex-wrap items-start gap-x-8 gap-y-2 rounded border border-line bg-canvas px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">Territory Name</p>
            <p className="text-base font-bold text-ink">
              {meta.territory.name} <span className="text-xs font-normal text-ink-faint">{meta.territory.code}</span>
            </p>
            <p className="text-xs text-ink-faint">{meta.territory.path.join(" › ")}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">Customers</p>
            <p className="text-base font-bold text-ink tabular-nums">{meta.total}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">Assigned Employees</p>
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink">
              <Users aria-hidden="true" className="size-3.5 text-ink-faint" />
              {meta.territory.employees.length ? meta.territory.employees.map((e) => `${e.name}${e.designation ? ` (${e.designation})` : ""}`).join(", ") : "None"}
            </p>
          </div>
        </section>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => setRetry((n) => n + 1)} />
      ) : !meta && loading ? (
        <LoadingState label="Loading customers…" />
      ) : meta && meta.total === 0 ? (
        <p className="py-6 text-center text-sm text-ink-faint">No customers in this territory{search ? ` matching “${search}”` : ""}.</p>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <table className="data-grid w-full min-w-max">
              <thead>
                <tr>
                  {["SL", "Customer Code", "Customer Name", "Customer Address", "Customer Group", "Credit Limit"].map((h) => (
                    <th key={h} scope="col" className="px-2.5 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{index + 1}</td>
                    <td className="px-2.5 py-2 font-medium whitespace-nowrap">{row.code}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap">{row.name}</td>
                    <td className="max-w-80 truncate px-2.5 py-2" title={row.address ?? undefined}>
                      {row.address ?? "—"}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">{row.groupName ?? "—"}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums">{money(row.creditLimit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div ref={sentinel} className="px-4 py-2.5 text-center text-xs text-ink-faint" aria-live="polite">
            {loading ? "Loading…" : hasMore ? `Showing ${rows.length} of ${meta?.total} customers · scroll for more…` : `${meta?.total ?? 0} customers`}
          </div>
        </div>
      )}
    </div>
  );
}
