"use client";

import React, { useState, useMemo } from "react";
import { useResource } from "@/hooks/use-resource";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import { ReceiveTransferDialog } from "@/features/inventory/components/ReceiveTransferDialog";
import type { InventoryDocument } from "@/features/inventory/schemas/document.schema";
import { dmy, inventoryApi, monthAgo, today } from "@/features/inventory/services/inventory.api";
import {
  Search,
  Upload,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  Printer,
  Eye,
  FileSpreadsheet,
} from "lucide-react";

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
    requestCode: d.request?.number ?? "Direct",
    transferCode: d.number,
    fromOffice: d.warehouse?.officeName ?? "",
    fromWarehouse: d.warehouse?.name ?? "",
    receiveOffice: d.toWarehouse?.officeName ?? "",
    receiveWarehouse: d.toWarehouse?.name ?? "",
    requestBy: d.createdBy,
    requestTo: d.toWarehouse?.name ?? "",
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
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [page, setPage] = useState(1);

  // Transfers of the period and approved requests waiting to be sent.
  const [period, setPeriod] = useState({ from: fromDate, to: toDate });
  const applyPeriod = () => {
    setPeriod({ from: fromDate, to: toDate });
    setPage(1);
  };
  const transfers = useResource(`transfer-${period.from}-${period.to}`, () => inventoryApi.list("transfer", period));
  const approved = useResource("transfer-request-approved", () => inventoryApi.list("transfer-request", { status: "APPROVED" }));
  const reload = () => {
    transfers.reload();
    approved.reload();
  };
  const [createOpen, setCreateOpen] = useState(false);
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
          transferRequestNumber: d.request?.number ?? "Direct",
          transferCode: d.number,
          fromWarehouse: d.warehouse?.name ?? "",
          receiveWarehouse: d.toWarehouse?.name ?? "",
          requestTo: d.toWarehouse?.name ?? "",
          receivedQty: d.processedQty,
          loadingTime: d.meta?.loadingTime ?? "",
          loadingTemp: d.meta?.loadingTemp ?? "",
          chillingTemp: d.meta?.chillingTemp ?? "",
        })),
    [docs],
  );
  const OFFICE_OPTIONS = options("From Office", docs.map((d) => d.warehouse?.officeName ?? ""));
  const TO_OFFICE_OPTIONS = options("To Office", docs.map((d) => d.toWarehouse?.officeName ?? ""));
  const WAREHOUSE_OPTIONS = options("From Warehouse", docs.map((d) => d.warehouse?.name ?? ""));
  const TO_WAREHOUSE_OPTIONS = options("To Warehouse / Requesting Warehouse", docs.map((d) => d.toWarehouse?.name ?? ""));
  const approvedRequests = (approved.data ?? []).filter((r) => {
    if (fromOffice && r.warehouse?.officeName !== fromOffice) return false;
    if (fromWarehouse && r.warehouse?.name !== fromWarehouse) return false;
    if (toOffice && r.toWarehouse?.officeName !== toOffice) return false;
    if (toWarehouse && r.toWarehouse?.name !== toWarehouse) return false;
    if (requestTo.length >= 3 && !(r.toWarehouse?.name ?? "").toLowerCase().includes(requestTo.toLowerCase())) return false;
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

  // Filter Transfer Out rows
  const filteredTransferOut = useMemo(() => {
    return transferOutRows.filter((row) => {
      if (fromOffice && row.fromOffice !== fromOffice) return false;
      if (fromWarehouse && row.fromWarehouse !== fromWarehouse) return false;
      if (toWarehouse && row.receiveWarehouse !== toWarehouse) return false;
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
  }, [transferOutRows, fromOffice, fromWarehouse, toWarehouse, searchTerm]);

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
  }, [receivedRows, fromWarehouse, toWarehouse, searchTerm]);

  // CSV Export
  const handleExportCSV = () => {
    let csvContent = "";
    if (activeTab === "TRANSFER_OUT" || activeTab === "IN_TRANSIT") {
      const source = activeTab === "TRANSFER_OUT" ? filteredTransferOut : inTransitRows;
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
    <div className="space-y-3 p-1">
      {/* ─────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER                                      */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Transfer
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search...."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Upload */}
          <button
            type="button"
            title="Upload"
            className="h-9 px-3.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={handleExportCSV}
            title="Download CSV"
            className="h-9 px-3.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          {/* Direct Transfer Out Button */}
          <button
            type="button"
            onClick={() => openTransfer()}
            className="h-9 px-4 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition whitespace-nowrap"
          >
            <span>Direct Transfer Out</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 2. TABS NAVIGATION                                 */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-8 text-xs font-bold uppercase tracking-wider overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={`pb-2 whitespace-nowrap transition ${
              activeTab === tab.id
                ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 3. TAB 1: APPROVED TRANS. REQUEST                   */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "APPROVED_REQ" && (
        <div className="space-y-2">
          {/* Filter row 1 */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <select
                  value={fromOffice}
                  onChange={(e) => setFromOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toOffice}
                  onChange={(e) => setToOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
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
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
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
            <div className="border border-slate-300 bg-white rounded shadow-2xs p-12 text-center text-slate-400">
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                <span className="text-sm font-medium">{approved.loading ? "Loading…" : "No approved transfer requests pending transfer out."}</span>
              </div>
            </div>
          ) : (
            <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
              <table className="erp-table w-full text-left text-xs border-collapse">
                <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300">
                  <tr>
                    <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                    <th className="p-2 border border-slate-300">Request Date</th>
                    <th className="p-2 border border-slate-300">Request Code</th>
                    <th className="p-2 border border-slate-300">From Warehouse</th>
                    <th className="p-2 border border-slate-300">Requesting Warehouse</th>
                    <th className="p-2 border border-slate-300 text-right">Requested</th>
                    <th className="p-2 border border-slate-300 text-right">Sent</th>
                    <th className="p-2 border border-slate-300 text-right">Open</th>
                    <th className="p-2 border border-slate-300 w-28 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                  {approvedRequests.map((r, i) => (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="p-2 border border-slate-300 text-center font-mono">{i + 1}</td>
                      <td className="p-2 border border-slate-300 whitespace-nowrap">{dmy(r.docDate)}</td>
                      <td className="p-2 border border-slate-300 font-mono font-medium">{r.number}</td>
                      <td className="p-2 border border-slate-300">{r.warehouse?.name}</td>
                      <td className="p-2 border border-slate-300">{r.toWarehouse?.name}</td>
                      <td className="p-2 border border-slate-300 text-right font-mono">{r.totalQty}</td>
                      <td className="p-2 border border-slate-300 text-right font-mono">{r.processedQty}</td>
                      <td className="p-2 border border-slate-300 text-right font-mono font-bold">{round3(r.totalQty - r.processedQty)}</td>
                      <td className="p-2 border border-slate-300 text-center">
                        <button
                          type="button"
                          onClick={() => openTransfer(r.id)}
                          className="px-2 py-0.5 rounded bg-[#1976d2] text-white text-[10px] font-semibold"
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
        <div className="space-y-2">
          {/* Filter row 1 */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <select
                  value={fromOffice}
                  onChange={(e) => setFromOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toOffice}
                  onChange={(e) => setToOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
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
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
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
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Transfer Date</th>
                  <th className="p-2 border border-slate-300 w-28">Request Code</th>
                  <th className="p-2 border border-slate-300 w-32">Transfer Code</th>
                  <th className="p-2 border border-slate-300">From/Sending Office</th>
                  <th className="p-2 border border-slate-300">From/Sending Warehouse</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Office</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Warehouse</th>
                  <th className="p-2 border border-slate-300 w-24">Request By</th>
                  <th className="p-2 border border-slate-300 w-24">Request To</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Total Qty</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Received Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">Return Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">In Transit Qty</th>
                  <th className="p-2 border border-slate-300 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredTransferOut.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.transferDate}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800">
                      {row.requestCode}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.requestBy}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.requestTo}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-medium">
                      {row.totalQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {row.receivedQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {row.returnQty.toFixed(2)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {row.inTransitQty.toFixed(2)}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        <button type="button" className="p-0.5 hover:text-blue-600" title="Print">
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
        <div className="space-y-2">
          {/* Filter row 1 */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <select
                  value={fromOffice}
                  onChange={(e) => setFromOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toOffice}
                  onChange={(e) => setToOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
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
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
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
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Transfer Date</th>
                  <th className="p-2 border border-slate-300 w-28">Request Code</th>
                  <th className="p-2 border border-slate-300 w-32">Transfer Code</th>
                  <th className="p-2 border border-slate-300">From/Sending Office</th>
                  <th className="p-2 border border-slate-300">From/Sending Warehouse</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Office</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Warehouse</th>
                  <th className="p-2 border border-slate-300 w-24">Request By</th>
                  <th className="p-2 border border-slate-300 w-24">Request To</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Total Qty</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Received Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">Return Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">In Transit Qty</th>
                  <th className="p-2 border border-slate-300 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {inTransitRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.transferDate}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800">
                      {row.requestCode}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.requestBy}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.requestTo}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-medium">
                      {row.totalQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {row.receivedQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {row.returnQty.toFixed(2)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-blue-600 font-bold">
                      {row.inTransitQty.toFixed(2)}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        <button
                          type="button"
                          onClick={() => setReceiveTarget(docs.find((d) => d.id === row.id) ?? null)}
                          className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold"
                        >
                          Receive
                        </button>
                        <button type="button" className="p-0.5 hover:text-blue-600" title="Print">
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
        <div className="space-y-2">
          {/* Date range filter */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
            <div>
              <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
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
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Return Date</th>
                  <th className="p-2 border border-slate-300 w-36">Transfer Code</th>
                  <th className="p-2 border border-slate-300 w-36">Return Code</th>
                  <th className="p-2 border border-slate-300">From/Sending Office</th>
                  <th className="p-2 border border-slate-300">From/Sending Warehouse</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Office</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Warehouse</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Return Qty</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Status</th>
                  <th className="p-2 border border-slate-300 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredReturn.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.returnDate}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                      {row.returnCode}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-medium">
                      {row.returnQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <span className="text-emerald-600 font-semibold text-[11px]">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <button type="button" className="p-0.5 hover:text-blue-600 text-slate-600" title="View">
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
        <div className="space-y-2">
          {/* Filters */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
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
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Transfer Date</th>
                  <th className="p-2 border border-slate-300 w-24">Receive Date</th>
                  <th className="p-2 border border-slate-300 w-32">Transfer Request Number</th>
                  <th className="p-2 border border-slate-300 w-32">Transfer Code</th>
                  <th className="p-2 border border-slate-300">From/Sending Warehouse</th>
                  <th className="p-2 border border-slate-300">Request/Receive Warehouse</th>
                  <th className="p-2 border border-slate-300 w-24">Request To</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Received Qty</th>
                  <th className="p-2 border border-slate-300 w-24">Loading Time</th>
                  <th className="p-2 border border-slate-300 w-28">Loading Temperature (°C)</th>
                  <th className="p-2 border border-slate-300 w-28">Chilling Temperature (°C)</th>
                  <th className="p-2 border border-slate-300 w-16 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredReceived.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.transferDate}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.receiveDate}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800">
                      {row.transferRequestNumber}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.requestTo}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-medium">
                      {row.receivedQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.loadingTime}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.loadingTemp}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.chillingTemp}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        <button type="button" className="p-0.5 hover:text-blue-600" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-0.5 hover:text-blue-600" title="View">
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
          title: "Transfer Out",
          warehouses: "two",
          warehouseLabel: "From warehouse",
          toWarehouseLabel: "To warehouse",
          fulfils: { slug: "transfer-request", label: "Against transfer request" },
          referenceLabel: "Vehicle / challan no",
        }}
      />
      <ReceiveTransferDialog transfer={receiveTarget} onClose={() => setReceiveTarget(null)} onReceived={reload} />
    </div>
  );
}
