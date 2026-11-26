"use client";

import React, { useState, useMemo } from "react";
import { useResource } from "@/hooks/use-resource";
import { InventoryTabBar, tabBarButton } from "@/features/inventory/components/InventoryTabBar";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import { ReceiveTransferDialog } from "@/features/inventory/components/ReceiveTransferDialog";
import type { InventoryDocument } from "@/features/inventory/schemas/document.schema";
import { dmy, inventoryApi, monthAgo, today } from "@/features/inventory/services/inventory.api";
import {
  Upload,
  Download,
  Printer,
  Eye,
  FileSpreadsheet,
} from "lucide-react";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { NativeDateInput } from "@/components/ui/date-input";

// ============================================================================
// TYPES
// ============================================================================
type TransferTabId =
  | "APPROVED_REQ"
  | "TRANSFER_OUT"
  | "IN_TRANSIT"
  | "RETURN_LIST"
  | "RECEIVED_LIST";

interface TransferOutRow {
  sl: number;
  id: string;
  transferDate: string;
  requestCode: string;
  transferCode: string;
  fromOffice: string;
  fromWarehouse: string;
  receiveOffice: string;
  receiveWarehouse: string;
  requestBy: string;
  requestTo: string;
  totalQty: number;
  receivedQty: number;
  returnQty: number;
  inTransitQty: number;
}

interface ReturnRow {
  sl: number;
  id: string;
  returnDate: string;
  transferCode: string;
  returnCode: string;
  fromOffice: string;
  fromWarehouse: string;
  receiveOffice: string;
  receiveWarehouse: string;
  returnQty: number;
  status: "Approved" | "Pending" | "Rejected";
}

interface ReceivedRow {
  sl: number;
  id: string;
  transferDate: string;
  receiveDate: string;
  transferRequestNumber: string;
  transferCode: string;
  fromWarehouse: string;
  receiveWarehouse: string;
  requestTo: string;
  receivedQty: number;
  loadingTime: string;
  loadingTemp: string;
  chillingTemp: string;
}

// ============================================================================
// ROWS FROM TRANSFERS
// ============================================================================
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const receivedOf = (d: InventoryDocument) => (d.status === "COMPLETED" ? d.processedQty : 0);

function toTransferOutRow(d: InventoryDocument, i: number): TransferOutRow {
  const received = receivedOf(d);
  return {
    sl: i + 1,
    id: d.id,
    transferDate: dmy(d.docDate),
    requestCode: d.request?.number ?? "",
    transferCode: d.number,
    fromOffice: d.warehouse?.officeName ?? "",
    fromWarehouse: d.warehouse?.name ?? "",
    receiveOffice: d.toWarehouse?.officeName ?? "",
    receiveWarehouse: d.toWarehouse?.name ?? "",
    requestBy: d.request?.createdBy ?? "",
    requestTo: d.request?.requestTo ?? "",
    totalQty: d.totalQty,
    receivedQty: received,
    returnQty: d.status === "COMPLETED" ? round3(d.totalQty - received) : 0,
    inTransitQty: d.status === "IN_TRANSIT" ? d.totalQty : 0,
  };
}

const options = (placeholder: string, values: string[]) => [
  { value: "", label: placeholder },
  ...[...new Set(values.filter(Boolean))].sort().map((v) => ({ value: v, label: v })),
];

export default function TransferPage() {
  const perms = useFeaturePermissions("/inventory/transfer");
  const [activeTab, setActiveTab] = useState<TransferTabId>("TRANSFER_OUT");
  const [searchTerm, setSearchTerm] = useState("");

  // Filters
  const [fromOffice, setFromOffice] = useState("");
  const [toOffice, setToOffice] = useState("");
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [requestTo, setRequestTo] = useState("");
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate, setToDate] = useState(today());

  // Pagination
  const [, setPage] = useState(1);

  // Transfers of the period and approved requests waiting to be sent.
  const [period, setPeriod] = useState({ from: fromDate, to: toDate });
  const applyPeriod = () => {
    setPeriod({ from: fromDate, to: toDate });
    setPage(1);
  };
  const transfers = useResource(`transfer-${period.from}-${period.to}`, () => inventoryApi.list("transfer", period));
  const approved = useResource("transfer-request-approved", () => inventoryApi.list("transfer-request", { status: "APPROVED" }));
  const masters = useResource("inventory-masters", inventoryApi.masters);
  const reload = () => {
    transfers.reload();
    approved.reload();
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [createRequestId, setCreateRequestId] = useState<string | undefined>();
  const [receiveTarget, setReceiveTarget] = useState<InventoryDocument | null>(null);
  const openTransfer = (requestId?: string) => {
    setCreateRequestId(requestId);
    setCreateOpen(true);
  };

  const docs = useMemo(() => transfers.data ?? [], [transfers.data]);
  const transferOutRows = useMemo(() => docs.map(toTransferOutRow), [docs]);
  const inTransitRows = useMemo(() => docs.filter((d) => d.status === "IN_TRANSIT").map(toTransferOutRow), [docs]);
  // What was not received went back to the sending warehouse.
  const returnRows = useMemo<ReturnRow[]>(
    () =>
      docs
        .filter((d) => d.status === "COMPLETED" && d.totalQty - d.processedQty > 1e-9)
        .map((d, i) => ({
          sl: i + 1,
          id: d.id,
          returnDate: dmy(d.completedAt?.slice(0, 10)),
          transferCode: d.number,
          returnCode: `${d.number}-R`,
          fromOffice: d.toWarehouse?.officeName ?? "",
          fromWarehouse: d.toWarehouse?.name ?? "",
          receiveOffice: d.warehouse?.officeName ?? "",
          receiveWarehouse: d.warehouse?.name ?? "",
          returnQty: round3(d.totalQty - d.processedQty),
          status: "Approved" as const,
        })),
    [docs],
  );
  const receivedRows = useMemo<ReceivedRow[]>(
    () =>
      docs
        .filter((d) => d.status === "COMPLETED")
        .map((d, i) => ({
          sl: i + 1,
          id: d.id,
          transferDate: dmy(d.docDate),
          receiveDate: dmy(d.completedAt?.slice(0, 10)),
          transferRequestNumber: d.request?.number ?? "",
          transferCode: d.number,
          fromWarehouse: d.warehouse?.name ?? "",
          receiveWarehouse: d.toWarehouse?.name ?? "",
          requestTo: d.request?.requestTo ?? "",
          receivedQty: d.processedQty,
          loadingTime: d.meta?.loadingTime ?? "",
          loadingTemp: d.meta?.loadingTemp ?? "",
          chillingTemp: d.meta?.chillingTemp ?? "",
        })),
    [docs],
  );
  // Offices and warehouses come from Configuration (Business Units › Offices / Warehouses).
  const configuredWarehouses = masters.data?.warehouses ?? [];
  const configuredOffices = configuredWarehouses.map((w) => w.officeName);
  const warehousesOf = (office: string) => configuredWarehouses.filter((w) => w.officeName === office).map((w) => w.name);
  const OFFICE_OPTIONS = options("From Office", configuredOffices);
  const TO_OFFICE_OPTIONS = options("To Office", configuredOffices);
  const WAREHOUSE_OPTIONS = options(fromOffice ? "From Warehouse" : "Select From Office first", fromOffice ? warehousesOf(fromOffice) : []);
  const TO_WAREHOUSE_OPTIONS = options(
    toOffice ? "To Warehouse / Requesting Warehouse" : "Select To Office first",
    toOffice ? warehousesOf(toOffice) : [],
  );
  const approvedRequests = (approved.data ?? []).filter((r) => {
    if (fromOffice && r.warehouse?.officeName !== fromOffice) return false;
    if (fromWarehouse && r.warehouse?.name !== fromWarehouse) return false;
    if (toOffice && r.toWarehouse?.officeName !== toOffice) return false;
    if (toWarehouse && r.toWarehouse?.name !== toWarehouse) return false;
    if (requestTo.length >= 3 && !(r.meta?.requestTo ?? "").toLowerCase().includes(requestTo.toLowerCase())) return false;
    return true;
  });

  // Tabs definition
  const tabs: { id: TransferTabId; label: string }[] = [
    { id: "APPROVED_REQ", label: "APPROVED TRANS. REQUEST" },
    { id: "TRANSFER_OUT", label: "TRANSFER OUT LIST" },
    { id: "IN_TRANSIT", label: "TRANSFER IN TRANSIT" },
    { id: "RETURN_LIST", label: "RETURN LIST" },
    { id: "RECEIVED_LIST", label: "TRANSFER IN/RECEIVED LIST" },
  ];

  // iBOS list filters: From Office/Warehouse, To Office/Requesting Warehouse, Request To, search.
  const matches = useMemo(() => {
    const who = requestTo.trim().toLowerCase();
    const s = searchTerm.trim().toLowerCase();
    return (row: TransferOutRow) =>
      (!fromOffice || row.fromOffice === fromOffice) &&
      (!fromWarehouse || row.fromWarehouse === fromWarehouse) &&
      (!toOffice || row.receiveOffice === toOffice) &&
      (!toWarehouse || row.receiveWarehouse === toWarehouse) &&
      (who.length < 3 || row.requestTo.toLowerCase().includes(who)) &&
      (!s || [row.transferCode, row.requestCode, row.fromWarehouse, row.receiveWarehouse, row.requestBy, row.requestTo].some((v) => v.toLowerCase().includes(s)));
  }, [fromOffice, fromWarehouse, toOffice, toWarehouse, requestTo, searchTerm]);
  const filteredTransferOut = useMemo(() => transferOutRows.filter(matches), [transferOutRows, matches]);
  const filteredInTransit = useMemo(() => inTransitRows.filter(matches), [inTransitRows, matches]);

  // Filter Return rows
  const filteredReturn = useMemo(() => {
    return returnRows.filter((row) => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          row.transferCode.toLowerCase().includes(s) ||
          row.returnCode.toLowerCase().includes(s) ||
          row.fromWarehouse.toLowerCase().includes(s) ||
          row.receiveWarehouse.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [returnRows, searchTerm]);

  // Filter Received rows
  const filteredReceived = useMemo(() => {
    return receivedRows.filter((row) => {
      if (fromWarehouse && row.fromWarehouse !== fromWarehouse) return false;
      if (toWarehouse && row.receiveWarehouse !== toWarehouse) return false;
      if (requestTo.trim().length >= 3 && !row.requestTo.toLowerCase().includes(requestTo.trim().toLowerCase())) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          row.transferCode.toLowerCase().includes(s) ||
          row.fromWarehouse.toLowerCase().includes(s) ||
          row.receiveWarehouse.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [receivedRows, fromWarehouse, toWarehouse, requestTo, searchTerm]);

  // CSV Export
  const handleExportCSV = () => {
    let csvContent = "";
    if (activeTab === "TRANSFER_OUT" || activeTab === "IN_TRANSIT") {
      const source = activeTab === "TRANSFER_OUT" ? filteredTransferOut : filteredInTransit;
      const headers = [
        "SL",
        "Transfer Date",
        "Request Code",
        "Transfer Code",
        "From Office",
        "From Warehouse",
        "Receive Office",
        "Receive Warehouse",
        "Total Qty",
        "Received Qty",
        "Return Qty",
        "In Transit Qty",
      ];
      const rows = source.map((r, i) => [
        i + 1,
        r.transferDate,
        r.requestCode,
        r.transferCode,
        `"${r.fromOffice}"`,
        `"${r.fromWarehouse}"`,
        `"${r.receiveOffice}"`,
        `"${r.receiveWarehouse}"`,
        r.totalQty,
        r.receivedQty,
        r.returnQty,
        r.inTransitQty,
      ]);
      csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    } else if (activeTab === "RETURN_LIST") {
      const headers = [
        "SL",
        "Return Date",
        "Transfer Code",
        "Return Code",
        "From Office",
        "From Warehouse",
        "Receive Office",
        "Receive Warehouse",
        "Return Qty",
        "Status",
      ];
      const rows = filteredReturn.map((r, i) => [
        i + 1,
        r.returnDate,
        r.transferCode,
        r.returnCode,
        `"${r.fromOffice}"`,
        `"${r.fromWarehouse}"`,
        `"${r.receiveOffice}"`,
        `"${r.receiveWarehouse}"`,
        r.returnQty,
        r.status,
      ]);
      csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    } else if (activeTab === "RECEIVED_LIST") {
      const headers = [
        "SL",
        "Transfer Date",
        "Receive Date",
        "Transfer Request Number",
        "Transfer Code",
        "From Warehouse",
        "Receive Warehouse",
        "Received Qty",
      ];
      const rows = filteredReceived.map((r, i) => [
        i + 1,
        r.transferDate,
        r.receiveDate,
        r.transferRequestNumber,
        r.transferCode,
        `"${r.fromWarehouse}"`,
        `"${r.receiveWarehouse}"`,
        r.receivedQty,
      ]);
      csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    }
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `stock_transfer_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-surface space-y-2 p-3 flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      <InventoryTabBar
        title="Transfer"
        tabs={tabs}
        active={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setPage(1);
        }}
        search={searchTerm}
        onSearch={setSearchTerm}
        actions={
          <>
            {perms.import && (<button type="button" onClick={() => setBulkOpen(true)} className={tabBarButton} title="Bulk upload from Excel">
              <Upload /> Bulk Upload
            </button>)}
            {perms.export && (<button type="button" onClick={handleExportCSV} className={tabBarButton}>
              <Download /> Download
            </button>)}
            {perms.create && (<button type="button" onClick={() => openTransfer()} className={tabBarButton}>
              Direct Transfer Out
            </button>)}
          </>
        }
      />

      {/* ─────────────────────────────────────────────────── */}
      {/* 3. TAB 1: APPROVED TRANS. REQUEST                   */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "APPROVED_REQ" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          {/* Filter row 1 */}
          <div className="py-1.5 space-y-2.5 text-xs shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Office</label>
                <select
                  value={fromOffice}
                  onChange={(e) => { setFromOffice(e.target.value); setFromWarehouse(""); }}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
                >
                  {OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Warehouse</label>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  disabled={!fromOffice}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">To Office</label>
                <select
                  value={toOffice}
                  onChange={(e) => { setToOffice(e.target.value); setToWarehouse(""); }}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
                >
                  {TO_OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">Requesting/Receive Warehouse</label>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  disabled={!toOffice}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
                >
                  {TO_WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">Request To</label>
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 placeholder:text-ink-faint"
                />
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">From Date</label>
                <NativeDateInput
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">To Date</label>
                <NativeDateInput
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={applyPeriod}
                  className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
                >
                  {transfers.loading ? "Loading…" : "View"}
                </button>
              </div>
            </div>
          </div>

          {approvedRequests.length === 0 ? (
            <div className="border border-line-strong bg-surface rounded shadow-2xs p-12 text-center text-ink-faint shrink-0">
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                <span className="text-sm font-medium">{approved.loading ? "Loading…" : "No approved transfer requests pending transfer out."}</span>
              </div>
            </div>
          ) : (
            <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
              <table className="erp-table w-full text-left text-xs border-collapse">
                <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs">
                  <tr>
                    <th className="px-2.5 py-2 border-b border-line w-10 text-center">SL</th>
                    <th className="px-2.5 py-2 border-b border-line">Request Date</th>
                    <th className="px-2.5 py-2 border-b border-line">Request Code</th>
                    <th className="px-2.5 py-2 border-b border-line">From Warehouse</th>
                    <th className="px-2.5 py-2 border-b border-line">Requesting Warehouse</th>
                    <th className="px-2.5 py-2 border-b border-line text-right">Requested</th>
                    <th className="px-2.5 py-2 border-b border-line text-right">Sent</th>
                    <th className="px-2.5 py-2 border-b border-line text-right">Open</th>
                    <th className="px-2.5 py-2 border-b border-line w-28 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-[11px] text-ink">
                  {approvedRequests.map((r, i) => (
                    <tr key={r.id} className="hover:bg-canvas/80">
                      <td className="px-2.5 py-2 border-b border-line text-center font-mono">{i + 1}</td>
                      <td className="px-2.5 py-2 border-b border-line whitespace-nowrap">{dmy(r.docDate)}</td>
                      <td className="px-2.5 py-2 border-b border-line font-mono font-medium">{r.number}</td>
                      <td className="px-2.5 py-2 border-b border-line">{r.warehouse?.name}</td>
                      <td className="px-2.5 py-2 border-b border-line">{r.toWarehouse?.name}</td>
                      <td className="px-2.5 py-2 border-b border-line text-right font-mono">{r.totalQty}</td>
                      <td className="px-2.5 py-2 border-b border-line text-right font-mono">{r.processedQty}</td>
                      <td className="px-2.5 py-2 border-b border-line text-right font-mono font-bold">{round3(r.totalQty - r.processedQty)}</td>
                      <td className="px-2.5 py-2 border-b border-line text-center">
                        <button title={!perms.create ? needsPermission("create") : undefined} disabled={!perms.create}
                          type="button"
                          onClick={() => openTransfer(r.id)}
                          className="px-2 py-0.5 rounded bg-[#1976d2] text-white text-[10px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Transfer Out
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 4. TAB 2: TRANSFER OUT LIST                         */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "TRANSFER_OUT" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          {/* Filter row 1 */}
          <div className="py-1.5 space-y-2.5 text-xs shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Office</label>
                <select
                  value={fromOffice}
                  onChange={(e) => { setFromOffice(e.target.value); setFromWarehouse(""); }}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
                >
                  {OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Warehouse</label>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  disabled={!fromOffice}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">To Office</label>
                <select
                  value={toOffice}
                  onChange={(e) => { setToOffice(e.target.value); setToWarehouse(""); }}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
                >
                  {TO_OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">Requesting/Receive Warehouse</label>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  disabled={!toOffice}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
                >
                  {TO_WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">Request To</label>
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 placeholder:text-ink-faint"
                />
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">From Date</label>
                <NativeDateInput
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">To Date</label>
                <NativeDateInput
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={applyPeriod}
                  className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
                >
                  {transfers.loading ? "Loading…" : "View"}
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                <tr>
                  <th className="px-2.5 py-2 border-b border-line w-10 text-center">SL</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Transfer Date</th>
                  <th className="px-2.5 py-2 border-b border-line w-28">Request Code</th>
                  <th className="px-2.5 py-2 border-b border-line w-32">Transfer Code</th>
                  <th className="px-2.5 py-2 border-b border-line">From/Sending Office</th>
                  <th className="px-2.5 py-2 border-b border-line">From/Sending Warehouse</th>
                  <th className="px-2.5 py-2 border-b border-line">Requesting/Receive Office</th>
                  <th className="px-2.5 py-2 border-b border-line">Requesting/Receive Warehouse</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Request By</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Request To</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-right">Total Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-right">Received Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-right">Return Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-right">In Transit Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {filteredTransferOut.map((row) => (
                  <tr key={row.id} className="hover:bg-canvas/80 transition-colors">
                    <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                      {row.sl}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.transferDate}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono text-ink">
                      {row.requestCode}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.fromOffice}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.fromWarehouse}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.receiveOffice}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.receiveWarehouse}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.requestBy}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.requestTo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-right font-mono font-medium">
                      {row.totalQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                      {row.receivedQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                      {row.returnQty.toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                      {row.inTransitQty.toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <div className="row-actions flex items-center justify-center gap-1.5 text-ink-muted">
                        <button type="button" className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 5. TAB 3: TRANSFER IN TRANSIT                       */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "IN_TRANSIT" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          {/* Filter row 1 */}
          <div className="py-1.5 space-y-2.5 text-xs shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Office</label>
                <select
                  value={fromOffice}
                  onChange={(e) => { setFromOffice(e.target.value); setFromWarehouse(""); }}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
                >
                  {OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Warehouse</label>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  disabled={!fromOffice}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">To Office</label>
                <select
                  value={toOffice}
                  onChange={(e) => { setToOffice(e.target.value); setToWarehouse(""); }}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
                >
                  {TO_OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">Requesting/Receive Warehouse</label>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  disabled={!toOffice}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
                >
                  {TO_WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">Request To</label>
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 placeholder:text-ink-faint"
                />
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">From Date</label>
                <NativeDateInput
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">To Date</label>
                <NativeDateInput
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={applyPeriod}
                  className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
                >
                  {transfers.loading ? "Loading…" : "View"}
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                <tr>
                  <th className="px-2.5 py-2 border-b border-line w-10 text-center">SL</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Transfer Date</th>
                  <th className="px-2.5 py-2 border-b border-line w-28">Request Code</th>
                  <th className="px-2.5 py-2 border-b border-line w-32">Transfer Code</th>
                  <th className="px-2.5 py-2 border-b border-line">From/Sending Office</th>
                  <th className="px-2.5 py-2 border-b border-line">From/Sending Warehouse</th>
                  <th className="px-2.5 py-2 border-b border-line">Requesting/Receive Office</th>
                  <th className="px-2.5 py-2 border-b border-line">Requesting/Receive Warehouse</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Request By</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Request To</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-right">Total Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-right">Received Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-right">Return Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-right">In Transit Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {filteredInTransit.map((row) => (
                  <tr key={row.id} className="hover:bg-canvas/80 transition-colors">
                    <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                      {row.sl}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.transferDate}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono text-ink">
                      {row.requestCode}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.fromOffice}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.fromWarehouse}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.receiveOffice}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.receiveWarehouse}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.requestBy}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.requestTo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-right font-mono font-medium">
                      {row.totalQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                      {row.receivedQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                      {row.returnQty.toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-right font-mono text-blue-600 dark:text-blue-400 font-bold">
                      {row.inTransitQty.toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <div className="row-actions flex items-center justify-center gap-1.5 text-ink-muted">
                        <button title={!perms.edit ? needsPermission("edit") : undefined} disabled={!perms.edit}
                          type="button"
                          onClick={() => setReceiveTarget(docs.find((d) => d.id === row.id) ?? null)}
                          className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Receive
                        </button>
                        <button type="button" className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 6. TAB 4: RETURN LIST                               */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "RETURN_LIST" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          {/* Date range filter */}
          <div className="bg-canvas/60 p-3 rounded border border-line grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs shrink-0">
            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">From Date</label>
              <NativeDateInput
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">To Date</label>
              <NativeDateInput
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={applyPeriod}
                className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
              >
                {transfers.loading ? "Loading…" : "View"}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                <tr>
                  <th className="px-2.5 py-2 border-b border-line w-10 text-center">SL</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Return Date</th>
                  <th className="px-2.5 py-2 border-b border-line w-36">Transfer Code</th>
                  <th className="px-2.5 py-2 border-b border-line w-36">Return Code</th>
                  <th className="px-2.5 py-2 border-b border-line">From/Sending Office</th>
                  <th className="px-2.5 py-2 border-b border-line">From/Sending Warehouse</th>
                  <th className="px-2.5 py-2 border-b border-line">Requesting/Receive Office</th>
                  <th className="px-2.5 py-2 border-b border-line">Requesting/Receive Warehouse</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-right">Return Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-center">Status</th>
                  <th className="px-2.5 py-2 border-b border-line w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {filteredReturn.map((row) => (
                  <tr key={row.id} className="hover:bg-canvas/80 transition-colors">
                    <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                      {row.sl}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.returnDate}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono text-ink whitespace-nowrap">
                      {row.returnCode}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.fromOffice}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.fromWarehouse}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.receiveOffice}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.receiveWarehouse}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-right font-mono font-medium">
                      {row.returnQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <button type="button" className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400 text-ink-muted" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 7. TAB 5: TRANSFER IN/RECEIVED LIST                 */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "RECEIVED_LIST" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          {/* Filters */}
          <div className="py-1.5 space-y-2.5 text-xs shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Office</label>
                <select
                  value={fromOffice}
                  onChange={(e) => { setFromOffice(e.target.value); setFromWarehouse(""); }}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
                >
                  {OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Warehouse</label>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  disabled={!fromOffice}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">To Office</label>
                <select
                  value={toOffice}
                  onChange={(e) => { setToOffice(e.target.value); setToWarehouse(""); }}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
                >
                  {TO_OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">Requesting/Receive Warehouse</label>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  disabled={!toOffice}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
                >
                  {TO_WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">Request To</label>
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 placeholder:text-ink-faint"
                />
              </div>

              <div>
                <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">From Date</label>
                <NativeDateInput
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">To Date</label>
                <NativeDateInput
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={applyPeriod}
                  className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
                >
                  {transfers.loading ? "Loading…" : "View"}
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                <tr>
                  <th className="px-2.5 py-2 border-b border-line w-10 text-center">SL</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Transfer Date</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Receive Date</th>
                  <th className="px-2.5 py-2 border-b border-line w-32">Transfer Request Number</th>
                  <th className="px-2.5 py-2 border-b border-line w-32">Transfer Code</th>
                  <th className="px-2.5 py-2 border-b border-line">From/Sending Warehouse</th>
                  <th className="px-2.5 py-2 border-b border-line">Request/Receive Warehouse</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Request To</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-right">Received Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Loading Time</th>
                  <th className="px-2.5 py-2 border-b border-line w-28">Loading Temperature (°C)</th>
                  <th className="px-2.5 py-2 border-b border-line w-28">Chilling Temperature (°C)</th>
                  <th className="px-2.5 py-2 border-b border-line w-16 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {filteredReceived.map((row) => (
                  <tr key={row.id} className="hover:bg-canvas/80 transition-colors">
                    <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                      {row.sl}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.transferDate}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.receiveDate}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono text-ink">
                      {row.transferRequestNumber}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.fromWarehouse}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.receiveWarehouse}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.requestTo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-right font-mono font-medium">
                      {row.receivedQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.loadingTime}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.loadingTemp}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.chillingTemp}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <div className="row-actions flex items-center justify-center gap-1.5 text-ink-muted">
                        <button type="button" className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <InventoryDocumentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={reload}
        initialRequestId={createRequestId}
        config={{
          slug: "transfer",
          title: "Create Transfer Out",
          warehouses: "two",
          offices: true,
          officeLabel: "From Office",
          warehouseLabel: "From Warehouse",
          toOfficeLabel: "To Office",
          toWarehouseLabel: "To Warehouse",
          dateLabel: "Transfer Date",
          fulfils: { slug: "transfer-request", label: "Transfer Request" },
          fields: [
            // iBOS: "Direct Transfer in" receives at once (no in-transit step); "Supplier Wise" asks for the supplier and lists its items.
            { key: "directTransferIn", label: "Direct Transfer in", kind: "checkbox" },
            { key: "supplierWise", label: "Supplier Wise", kind: "checkbox" },
            { key: "grnNo", label: "GRN", kind: "text" },
            { key: "productionEntry", label: "Production Entry", kind: "text" },
            { key: "supplier", label: "Supplier", kind: "supplier", required: true, whenChecked: "supplierWise" },
          ],
          picker: "simple",
          qtyLabel: "Quantity",
          columns: ["code", "category", "name", "cost", "trade", "mrp", "altUom", "altQty", "uom", "stock", "qty", "remarks"],
        }}
      />
      <ReceiveTransferDialog transfer={receiveTarget} onClose={() => setReceiveTarget(null)} onReceived={reload} />
      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={reload}
        noun="transfers"
        templateUrl={inventoryApi.importTemplateUrl("transfer")}
        maxRows={2000}
        matchHint="Warehouse names must match existing warehouses; Item Code must match an active item. Rows with the same Ref are saved as one transfer; use Request Number to fulfil an approved transfer request."
        upload={(file) => inventoryApi.importFile("transfer", file)}
      />
    </div>
  );
}
