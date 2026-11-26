"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Eye,
  Printer,
  Ban,
  Plus,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import {
  PrintablePurchaseDoc,
  PurchasePrintToolbar,
  fmtPrintDate,
  fmtPrintNum,
  type PrintHeaderContext,
} from "@/components/purchase/PrintablePurchaseDoc";
import { toast } from "@/components/purchase/Toast";
import { Spinner } from "@/components/ui/spinner";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { PURCHASE_QUERY_KEYS, downloadCsv, localToday, uploadPurchaseBulk, tableDate } from "@/features/purchase/lib/client";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { usePurchasePermissions } from "@/features/purchase/lib/usePurchasePermissions";
import {
  PurchaseReturn,
  GoodsReceipt,
  Warehouse,
  Office,
} from "@bridgeone/contracts";
import { NativeDateInput } from "@/components/ui/date-input";

// ============================================================================
// REALISTIC MOCK FALLBACK DATA MATCHING SCREENSHOT 1 (RECEIVED LIST - 30 ROWS)
// ============================================================================
interface ReceivedRow {
  sl: number;
  /** Goods receipt id, sent with the return so the stock leaves the receipt's warehouse. */
  grnId: string;
  receiveDate: string;
  poNo: string;
  returnInvoiceNo: string;
  remarks: string;
  supplier: string;
  amount: number;
  office: string;
  items?: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    uom: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

interface ReturnRow {
  id: string;
  sl: number;
  officeId?: string;
  officeName: string;
  warehouseName?: string;
  grnNumber?: string;
  createdBy?: string;
  returnDate: string;
  poNo: string;
  returnNo: string;
  remarks: string;
  supplier: string;
  amount: number;
  returnType: string;
  status: "Approved" | "Pending Approval" | "Cancelled";
  items?: Array<{
    itemCode: string;
    itemName: string;
    uom: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    reason: string;
  }>;
}


export default function PurchaseReturnsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidateAll = () => {
    for (const key of PURCHASE_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };
  const perms = usePurchasePermissions();

  // Active Tab: RECEIVED_LIST or RETURN_LIST
  const [activeTab, setActiveTab] = useState<"RECEIVED_LIST" | "RETURN_LIST">("RECEIVED_LIST");
  const [bulkOpen, setBulkOpen] = useState(false);

  // Global Search
  const [searchTerm, setSearchTerm] = useState("");

  // Tab 2 Filters
  const [filterOffice, setFilterOffice] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  // Pagination states
  const [receivedRowsPerPage, setReceivedRowsPerPage] = useState(50);
  const [receivedPage, setReceivedPage] = useState(1);
  const [returnRowsPerPage, setReturnRowsPerPage] = useState(50);
  const [returnPage, setReturnPage] = useState(1);

  // Modals state
  const [fullReturnTarget, setFullReturnTarget] = useState<ReceivedRow | null>(null);
  const [partialReturnTarget, setPartialReturnTarget] = useState<ReceivedRow | null>(null);
  const [viewReturnTarget, setViewReturnTarget] = useState<ReturnRow | null>(null);
  const [printReturnTarget, setPrintReturnTarget] = useState<ReturnRow | null>(null);
  const [cancelReturnTarget, setCancelReturnTarget] = useState<ReturnRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Return Form States
  const [fullReturnReason, setFullReturnReason] = useState("Excess / Transit Damaged consignment rejected during QC inspection.");
  const [partialReturnItems, setPartialReturnItems] = useState<
    Array<{
      itemId: string;
      itemCode: string;
      itemName: string;
      uom: string;
      receivedQty: number;
      returnQty: number;
      unitPrice: number;
      condition: "DAMAGED" | "DEFECTIVE" | "WRONG_SPECIFICATION" | "EXCESS" | "EXPIRED";
      reason: string;
    }>
  >([]);

  // API Queries with TanStack
  const { data: context } = useQuery<PrintHeaderContext>({
    queryKey: ["context"],
    queryFn: () => fetchApi("/master/context"),
  });
  const { data: serverEligible } = useQuery<GoodsReceipt[]>({
    queryKey: ["eligibleGRNs"],
    queryFn: () => fetchApi("/purchase/returns/eligible-receipts"),
    staleTime: 60000,
  });

  const { data: serverReturns, isFetching: returnsLoading, refetch: refetchReturns } = useQuery<PurchaseReturn[]>({
    queryKey: ["returnsList"],
    queryFn: () => fetchApi("/purchase/returns"),
    staleTime: 60000,
  });

  const { data: offices } = useQuery<Office[]>({ queryKey: ["offices"], queryFn: () => fetchApi("/master/offices") });
  const { data: warehouses } = useQuery<Warehouse[]>({ queryKey: ["warehouses"], queryFn: () => fetchApi("/master/warehouses") });

  // Lists come from the server: receipts that can be returned, and posted returns.
  const receivedList = useMemo<ReceivedRow[]>(
    () =>
      // The server only lists receipts with something left to return (partly returned ones included).
      (serverEligible ?? [])
        .filter((g) => g.status === "RECEIVED" || g.status === "PARTIALLY_RETURNED")
        .map((g, i) => ({
          sl: i + 1,
          grnId: g.id,
          receiveDate: g.receiptDate,
          poNo: g.poNumber === "DIRECT-PO" ? "Direct" : g.poNumber,
          returnInvoiceNo: g.grnNumber,
          remarks: g.remarks || "N/A",
          supplier: g.supplierName,
          amount: g.totalReceivedAmount,
          office: g.officeName,
          items: g.items.map((it) => ({
            itemId: it.itemId,
            itemCode: it.itemCode,
            itemName: it.itemName,
            uom: it.uom,
            quantity: it.currentReceivedQuantity - it.rejectedDamagedQuantity,
            unitPrice: it.unitPrice,
            lineTotal: it.lineTotal,
          })),
        })),
    [serverEligible],
  );
  const returnList = useMemo<ReturnRow[]>(
    () =>
      (serverReturns ?? []).map((r, i) => ({
        id: r.id,
        sl: i + 1,
        officeId: r.officeId,
        officeName: r.officeName,
        warehouseName: warehouses?.find((w) => w.officeId === r.officeId)?.name || "-",
        grnNumber: r.grnNumber,
        createdBy: r.createdBy,
        returnDate: r.returnDate,
        poNo: !r.poNumber || r.poNumber === "DIRECT-PO" ? "Direct" : r.poNumber,
        returnNo: r.returnNumber,
        remarks: r.remarks || r.items[0]?.reason || "N/A",
        supplier: r.supplierName,
        amount: r.totalReturnAmount,
        returnType: r.grnNumber === "Direct Return" ? "Direct / Ad-hoc" : "Against GRN",
        status: r.status === "CANCELLED" ? "Cancelled" : r.status === "PENDING_APPROVAL" ? "Pending Approval" : "Approved",
        items: r.items.map((it) => ({
          itemCode: it.itemCode,
          itemName: it.itemName,
          uom: it.uom,
          quantity: it.returnQuantity,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
          reason: it.reason,
        })),
      })),
    [serverReturns, warehouses],
  );

  // Posts the return: stock leaves the warehouse and the supplier balance goes down.
  const returnMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => fetchApi<PurchaseReturn>("/purchase/returns", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      for (const key of PURCHASE_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
      setFullReturnTarget(null);
      setPartialReturnTarget(null);
      setActiveTab("RETURN_LIST");
      if (data.status === "PENDING_APPROVAL") toast.success(`Return ${data.returnNumber} saved; the goods leave stock once its approval is complete.`, { title: "Sent for Approval" });
      else toast.success(`Return ${data.returnNumber} posted. Stock and supplier balance updated.`, { title: "Purchase Return Posted" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Return Failed" }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      fetchApi<PurchaseReturn>(`/purchase/returns/${id}/cancel`, { method: "POST", body: JSON.stringify({ comments }) }),
    onSuccess: (data) => {
      for (const key of PURCHASE_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
      setCancelReturnTarget(null);
      toast.success(`Return ${data.returnNumber} cancelled. Stock and supplier balance restored.`, { title: "Return Cancelled" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Cancel Failed" }),
  });

  type ReturnLine = { itemId: string; itemCode: string; itemName: string; uom: string; receivedQty: number; returnQty: number; unitPrice: number; reason: string; condition?: string };
  const submitReturn = (goodsReceiptId: string, returnDate: string, lines: ReturnLine[], extra: Record<string, unknown> = {}) => {
    const items = lines.filter((l) => l.returnQty > 0);
    if (!items.length) {
      toast.error("Enter a return quantity for at least one item.", { title: "Purchase Return" });
      return;
    }
    returnMutation.mutate({
      companyId: "comp-bridgeone-01",
      goodsReceiptId,
      returnDate,
      returnType: "REFUND_CREDIT",
      ...extra,
      items: items.map((l) => ({
        grnItemId: "",
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        uom: l.uom,
        receivedQuantity: l.receivedQty,
        previouslyReturnedQuantity: 0,
        eligibleReturnQuantity: l.receivedQty,
        returnQuantity: l.returnQty,
        unitPrice: l.unitPrice,
        lineTotal: l.returnQty * l.unitPrice,
        reason: l.reason || "Returned to supplier",
        condition: l.condition ?? "DAMAGED",
      })),
    });
  };
  const today = localToday;

  // Handle Full Return Click
  const handleOpenFullReturn = (row: ReceivedRow) => {
    setFullReturnTarget(row);
    setFullReturnReason(`100% consignment reversal for ${row.returnInvoiceNo} due to quality defect.`);
  };

  // Handle Partial Return Click
  const handleOpenPartialReturn = (row: ReceivedRow) => {
    setPartialReturnTarget(row);
    setPartialReturnItems(
      (row.items ?? []).map((it) => ({
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        receivedQty: it.quantity,
        returnQty: 0,
        unitPrice: it.unitPrice,
        condition: "DAMAGED",
        reason: "",
      }))
    );
  };

  // Submit Full Return: every accepted quantity of the receipt goes back.
  const handleConfirmFullReturn = () => {
    if (!fullReturnTarget) return;
    submitReturn(
      fullReturnTarget.grnId,
      today(),
      (fullReturnTarget.items ?? []).map((it) => ({ ...it, receivedQty: it.quantity, returnQty: it.quantity, reason: fullReturnReason })),
      { remarks: fullReturnReason },
    );
  };

  // Submit Partial Return
  const handleConfirmPartialReturn = () => {
    if (!partialReturnTarget) return;
    submitReturn(partialReturnTarget.grnId, today(), partialReturnItems);
  };

  // Filtered Received List
  const filteredReceived = useMemo(() => {
    return receivedList.filter((row) => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        row.poNo.toLowerCase().includes(s) ||
        row.returnInvoiceNo.toLowerCase().includes(s) ||
        row.supplier.toLowerCase().includes(s) ||
        row.remarks.toLowerCase().includes(s)
      );
    });
  }, [receivedList, searchTerm]);

  // Paginated Received List
  const totalReceivedPages = Math.ceil(filteredReceived.length / receivedRowsPerPage) || 1;
  const paginatedReceived = useMemo(() => {
    const start = (receivedPage - 1) * receivedRowsPerPage;
    return filteredReceived.slice(start, start + receivedRowsPerPage);
  }, [filteredReceived, receivedPage, receivedRowsPerPage]);

  // Filtered Return List
  const filteredReturns = useMemo(() => {
    return returnList.filter((row) => {
      if (filterOffice !== "All" && row.officeName !== filterOffice) return false;
      if (filterStatus !== "All" && row.status !== filterStatus) return false;
      if (filterFromDate && row.returnDate < filterFromDate) return false;
      if (filterToDate && row.returnDate > filterToDate) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          row.returnNo.toLowerCase().includes(s) ||
          row.supplier.toLowerCase().includes(s) ||
          row.poNo.toLowerCase().includes(s) ||
          row.officeName.toLowerCase().includes(s) ||
          row.remarks.toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [returnList, filterOffice, filterStatus, filterFromDate, filterToDate, searchTerm]);

  // Paginated Return List
  const totalReturnPages = Math.ceil(filteredReturns.length / returnRowsPerPage) || 1;
  const paginatedReturns = useMemo(() => {
    const start = (returnPage - 1) * returnRowsPerPage;
    return filteredReturns.slice(start, start + returnRowsPerPage);
  }, [filteredReturns, returnPage, returnRowsPerPage]);

  // Export to CSV
  const handleExportCSV = () => {
    if (activeTab === "RECEIVED_LIST") {
      downloadCsv(
        `purchase_receive_for_return_${localToday()}.csv`,
        ["SL", "Receive Date", "PO No", "Return Invoice No", "Remarks", "Supplier", "Amount"],
        filteredReceived.map((r, idx) => [idx + 1, r.receiveDate, r.poNo, r.returnInvoiceNo, r.remarks, r.supplier, r.amount]),
      );
    } else {
      downloadCsv(
        `purchase_returns_list_${localToday()}.csv`,
        ["SL", "Office Name", "Return Date", "PO No", "Return No", "Remarks", "Supplier", "Amount", "Return Type", "Status"],
        filteredReturns.map((r, idx) => [idx + 1, r.officeName, r.returnDate, r.poNo, r.returnNo, r.remarks, r.supplier, r.amount, r.returnType, r.status]),
      );
    }
  };

  return (
    <div className="flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden font-sans bg-surface p-3 space-y-2">
      {/* Fixed Top Controls (header + tabs) */}
      <div className="shrink-0 space-y-2">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink tracking-tight">Purchase Return</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input matching Screenshot */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search...."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-surface placeholder:text-ink-faint"
            />
            <Search className="w-3.5 h-3.5 text-ink-faint absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Bulk upload from Excel */}
          {perms.returns.import && (
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              title="Bulk upload returns from an Excel file"
              className="h-9 px-4 border border-line-strong rounded text-ink-muted hover:bg-canvas font-semibold text-xs inline-flex items-center gap-1.5 transition"
            >
              <Upload className="w-4 h-4" />
              <span>Bulk Upload</span>
            </button>
          )}

          {/* Export to CSV / Excel Button */}
          {perms.returns.export && (
            <button
              type="button"
              onClick={handleExportCSV}
              title="Download CSV / Excel"
              className="h-9 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          )}

          {/* + Return Without Ref. Blue Button */}
          {perms.returns.create && (
            <button
              type="button"
              onClick={() => router.push("/purchase/returns/create")}
              className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Return Without Ref.</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TABS NAVIGATION */}
      {/* ------------------------------------------------------------- */}
      <div className="flex border-b border-line gap-8 text-xs font-bold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setActiveTab("RECEIVED_LIST")}
          className={`pb-2 transition ${
            activeTab === "RECEIVED_LIST"
              ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 font-extrabold"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          RECEIVED LIST
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RETURN_LIST")}
          className={`pb-2 transition ${
            activeTab === "RETURN_LIST"
              ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 font-extrabold"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          RETURN LIST
        </button>
      </div>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: RECEIVED LIST (SCREENSHOT 1) */}
      {/* ============================================================= */}
      {activeTab === "RECEIVED_LIST" && (
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Table Container with All Borders (Only Table Scrolls) */}
          <div className="flex-1 min-h-0 border border-line-strong bg-surface rounded shadow-2xs overflow-auto">
            <table className="erp-table erp-table-compact w-full text-left border-collapse">
              <thead className="bg-grid-head text-ink font-semibold text-[11px] border-b border-line-strong select-none">
                <tr>
                  <th className="p-2 border border-line-strong w-10 text-center">SL</th>
                  <th className="p-2 border border-line-strong w-24">Receive Date</th>
                  <th className="p-2 border border-line-strong w-36">PO No</th>
                  <th className="p-2 border border-line-strong w-44">Return Invoice No</th>
                  <th className="p-2 border border-line-strong">Remarks</th>
                  <th className="p-2 border border-line-strong">Supplier</th>
                  <th className="p-2 border border-line-strong w-28 text-right">Amount</th>
                  <th className="p-2 border border-line-strong w-24 text-center">Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {filteredReceived.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-ink-faint">
                      No eligible receipts found for return.
                    </td>
                  </tr>
                ) : (
                  paginatedReceived.map((row, idx) => {
                    const serialNo = (receivedPage - 1) * receivedRowsPerPage + idx + 1;
                    return (
                      <tr key={row.sl || idx} className="hover:bg-canvas/80 transition-colors">
                        <td className="p-2 border border-line-strong text-center font-mono text-ink-muted">
                          {serialNo}
                        </td>
                        <td className="p-2 border border-line-strong whitespace-nowrap text-ink-muted">
                          {tableDate(row.receiveDate)}
                        </td>
                        <td className="p-2 border border-line-strong font-mono text-ink whitespace-nowrap">
                          {row.poNo}
                        </td>
                        <td className="p-2 border border-line-strong whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-ink font-medium">
                            <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 inline shrink-0" />
                            <span>{row.returnInvoiceNo}</span>
                          </span>
                        </td>
                        <td className="p-2 border border-line-strong text-ink-muted max-w-xs truncate" title={row.remarks}>
                          {row.remarks}
                        </td>
                        <td className="p-2 border border-line-strong text-ink" title={row.supplier}>
                          {row.supplier}
                        </td>
                        <td className="p-2 border border-line-strong text-right font-mono font-medium text-ink whitespace-nowrap">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="p-2 border border-line-strong text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 text-xs">
                            <button
                              type="button"
                              disabled={!perms.returns.create}
                              onClick={() => handleOpenFullReturn(row)}
                              className="inline-flex items-center min-h-6 px-1 rounded text-blue-600 dark:text-blue-400 hover:underline font-medium hover:text-blue-800 dark:hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:opacity-40 disabled:pointer-events-none"
                              title={!perms.returns.create ? "Requires Create permission in Configuration" : "Return all items from this receipt"}
                            >
                              Full
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              disabled={!perms.returns.create}
                              onClick={() => handleOpenPartialReturn(row)}
                              className="inline-flex items-center min-h-6 px-1 rounded text-blue-600 dark:text-blue-400 hover:underline font-medium hover:text-blue-800 dark:hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:opacity-40 disabled:pointer-events-none"
                              title={!perms.returns.create ? "Requires Create permission in Configuration" : "Select specific items and quantities to return"}
                            >
                              Partial
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer matching Screenshot 1 */}
          <div className="shrink-0 flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-ink-muted pt-1">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={receivedRowsPerPage}
                onChange={(e) => {
                  setReceivedRowsPerPage(Number(e.target.value));
                  setReceivedPage(1);
                }}
                className="border border-line-strong rounded px-1.5 py-0.5 bg-surface text-xs"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>
                {filteredReceived.length === 0
                  ? "0-0 of 0"
                  : `${(receivedPage - 1) * receivedRowsPerPage + 1}-${Math.min(
                      receivedPage * receivedRowsPerPage,
                      filteredReceived.length
                    )} of ${filteredReceived.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={receivedPage <= 1}
                  onClick={() => setReceivedPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={receivedPage >= totalReceivedPages}
                  onClick={() => setReceivedPage((p) => Math.min(totalReceivedPages, p + 1))}
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: RETURN LIST (SCREENSHOT 2) */}
      {/* ============================================================= */}
      {activeTab === "RETURN_LIST" && (
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Filter Card matching Screenshot 2 */}
          <div className="shrink-0 bg-canvas/60 p-3 rounded border border-line grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-xs">
            {/* Office Filter */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">Office</label>
              <select
                value={filterOffice}
                onChange={(e) => setFilterOffice(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All</option>
                {offices?.map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All</option>
                <option value="Approved">Approved</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Date</label>
              <NativeDateInput
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">To Date</label>
              <NativeDateInput
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* View Button */}
            <div>
              <button
                type="button"
                onClick={() => refetchReturns()}
                disabled={returnsLoading}
                className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] disabled:opacity-60 text-white text-xs font-bold rounded shadow-xs transition inline-flex items-center gap-1.5"
              >
                {returnsLoading && <Spinner className="size-3.5" />}
                View
              </button>
            </div>
          </div>

          {/* Table Container with All Borders (Only Table Scrolls) */}
          <div className="flex-1 min-h-0 border border-line-strong bg-surface rounded shadow-2xs overflow-auto">
            <table className="erp-table erp-table-compact w-full text-left border-collapse">
              <thead className="bg-grid-head text-ink font-semibold text-[11px] border-b border-line-strong select-none">
                <tr>
                  <th className="p-2 border border-line-strong w-10 text-center">SL</th>
                  <th className="p-2 border border-line-strong w-24 text-center">Actions</th>
                  <th className="p-2 border border-line-strong w-36">Office Name</th>
                  <th className="p-2 border border-line-strong w-24">Return Date</th>
                  <th className="p-2 border border-line-strong w-24">PO No</th>
                  <th className="p-2 border border-line-strong w-44">Return No</th>
                  <th className="p-2 border border-line-strong w-36">Remarks</th>
                  <th className="p-2 border border-line-strong">Supplier</th>
                  <th className="p-2 border border-line-strong w-28 text-right">Amount</th>
                  <th className="p-2 border border-line-strong w-24 text-center">Return Type</th>
                  <th className="p-2 border border-line-strong w-24 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-ink-faint">
                      No purchase return records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedReturns.map((row, idx) => {
                    const serialNo = (returnPage - 1) * returnRowsPerPage + idx + 1;
                    return (
                      <tr key={row.sl || idx} className="hover:bg-canvas/80 transition-colors">
                        <td className="p-2 border border-line-strong text-center font-mono text-ink-muted">
                          {serialNo}
                        </td>

                        {/* Actions: View, Print, Edit */}
                        <td className="p-2 border border-line-strong text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setViewReturnTarget(row)}
                              className="inline-flex size-6 items-center justify-center rounded transition-colors hover:bg-control text-ink-muted hover:text-ink"
                              title="View Return Note"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrintReturnTarget(row)}
                              className="inline-flex size-6 items-center justify-center rounded transition-colors hover:bg-control text-ink-muted hover:text-ink"
                              title="Print Debit Note / Return Voucher"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCancelReturnTarget(row);
                                setCancelReason("");
                              }}
                              disabled={row.status === "Cancelled" || !perms.returns.delete}
                              className="inline-flex size-6 items-center justify-center rounded transition-colors disabled:opacity-30 disabled:pointer-events-none text-ink-muted hover:bg-rose-100 dark:hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-rose-300"
                              title={!perms.returns.delete ? "Requires Delete permission in Configuration" : "Cancel return (goods come back into stock)"}
                              aria-label={`Cancel return ${row.returnNo}`}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="p-2 border border-line-strong text-ink-muted whitespace-nowrap">
                          {row.officeName}
                        </td>
                        <td className="p-2 border border-line-strong whitespace-nowrap text-ink-muted">
                          {tableDate(row.returnDate)}
                        </td>
                        <td className="p-2 border border-line-strong font-mono text-ink whitespace-nowrap">
                          {row.poNo}
                        </td>
                        <td className="p-2 border border-line-strong whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-ink font-medium">
                            <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 inline shrink-0" />
                            <span>{row.returnNo}</span>
                          </span>
                        </td>
                        <td className="p-2 border border-line-strong text-ink-muted max-w-xs truncate" title={row.remarks}>
                          {row.remarks}
                        </td>
                        <td className="p-2 border border-line-strong text-ink" title={row.supplier}>
                          {row.supplier}
                        </td>
                        <td className="p-2 border border-line-strong text-right font-mono font-medium text-ink whitespace-nowrap">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="p-2 border border-line-strong text-center whitespace-nowrap">
                          <span className="text-amber-700 dark:text-amber-300 font-medium">
                            {row.returnType}
                          </span>
                        </td>
                        <td className="p-2 border border-line-strong text-center whitespace-nowrap">
                          <span className={row.status === "Cancelled" ? "text-rose-600 dark:text-rose-400 font-semibold" : row.status === "Pending Approval" ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-emerald-700 dark:text-emerald-300 font-semibold"}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer matching Screenshot 2 */}
          <div className="shrink-0 flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-ink-muted pt-1">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={returnRowsPerPage}
                onChange={(e) => {
                  setReturnRowsPerPage(Number(e.target.value));
                  setReturnPage(1);
                }}
                className="border border-line-strong rounded px-1.5 py-0.5 bg-surface text-xs"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>
                {filteredReturns.length === 0
                  ? "0-0 of 0"
                  : `${(returnPage - 1) * returnRowsPerPage + 1}-${Math.min(
                      returnPage * returnRowsPerPage,
                      filteredReturns.length
                    )} of ${filteredReturns.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={returnPage <= 1}
                  onClick={() => setReturnPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={returnPage >= totalReturnPages}
                  onClick={() => setReturnPage((p) => Math.min(totalReturnPages, p + 1))}
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 3. FULL RETURN MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(fullReturnTarget)}
        onClose={() => setFullReturnTarget(null)}
        title="Full Purchase Return (100% Stock Reversal)"
        subtitle={`GRN: ${fullReturnTarget?.returnInvoiceNo || ""} • Supplier: ${fullReturnTarget?.supplier || ""}`}
        maxWidth="lg"
      >
        {fullReturnTarget && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded text-rose-800 dark:text-rose-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Confirm Full Consignment Return</span>
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                This action will reverse 100% of the received inventory from warehouse, generate a debit note voucher, and reduce supplier payables by <strong>BDT {formatCurrency(fullReturnTarget.amount)}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-canvas p-2.5 rounded border border-line">
              <div>
                <span className="text-[10px] text-ink-faint block font-bold uppercase">PO Reference</span>
                <span className="font-semibold text-ink font-mono">{fullReturnTarget.poNo}</span>
              </div>
              <div>
                <span className="text-[10px] text-ink-faint block font-bold uppercase">Receive Date</span>
                <span className="font-semibold text-ink">{fullReturnTarget.receiveDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-ink-faint block font-bold uppercase">Warehouse Office</span>
                <span className="font-semibold text-ink">{fullReturnTarget.office}</span>
              </div>
              <div>
                <span className="text-[10px] text-ink-faint block font-bold uppercase">Total Refund Amount</span>
                <span className="font-bold text-rose-700 dark:text-rose-300 font-mono">{formatCurrency(fullReturnTarget.amount)}</span>
              </div>
            </div>

            <div>
              <label className="block text-ink-muted font-semibold mb-1">Audit Reason for Full Return *</label>
              <textarea
                value={fullReturnReason}
                onChange={(e) => setFullReturnReason(e.target.value)}
                rows={3}
                className="w-full border border-line-strong rounded p-2 text-xs bg-surface"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setFullReturnTarget(null)}
                className="px-4 py-1.5 border border-line rounded text-ink-muted font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFullReturn}
                disabled={returnMutation.isPending}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold rounded shadow-xs transition inline-flex items-center gap-1.5"
              >
                {returnMutation.isPending && <Spinner className="size-3.5" />}
                Confirm Full Return & Issue Debit Note
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 4. PARTIAL RETURN MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(partialReturnTarget)}
        onClose={() => setPartialReturnTarget(null)}
        title="Partial Purchase Return"
        subtitle={`GRN: ${partialReturnTarget?.returnInvoiceNo || ""} • Supplier: ${partialReturnTarget?.supplier || ""}`}
        maxWidth="4xl"
      >
        {partialReturnTarget && (
          <div className="space-y-4 text-xs">
            <div className="bg-canvas p-2.5 rounded border border-line flex justify-between items-center">
              <div>
                <p className="font-bold text-ink">{partialReturnTarget.returnInvoiceNo}</p>
                <p className="text-[11px] text-ink-faint">PO: {partialReturnTarget.poNo} • {partialReturnTarget.supplier}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-ink-faint uppercase font-bold block">Consignment Total</span>
                <span className="font-bold font-mono text-ink">{formatCurrency(partialReturnTarget.amount)}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-line rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-control text-ink-muted font-semibold text-[11px]">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center w-16">UoM</th>
                    <th className="p-2 text-center w-24">Recv Qty</th>
                    <th className="p-2 w-28 text-center bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300">Return Qty *</th>
                    <th className="p-2 w-36">Defect Condition</th>
                    <th className="p-2">Inspection Remarks</th>
                    <th className="p-2 text-right w-28">Debit Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {partialReturnItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-canvas">
                      <td className="p-2">
                        <div className="font-semibold text-ink">{item.itemName}</div>
                        <div className="font-mono text-[10px] text-ink-faint">{item.itemCode}</div>
                      </td>
                      <td className="p-2 text-center font-mono text-ink-muted">{item.uom}</td>
                      <td className="p-2 text-center font-mono font-bold text-ink-muted">{item.receivedQty}</td>
                      <td className="p-2 bg-rose-50/50 dark:bg-rose-500/10">
                        <input
                          type="number"
                          min={1}
                          max={item.receivedQty}
                          value={item.returnQty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...partialReturnItems];
                            updated[idx].returnQty = val;
                            setPartialReturnItems(updated);
                          }}
                          className="w-full border border-rose-300 dark:border-rose-500/30 rounded p-1 text-center font-bold text-rose-700 dark:text-rose-300 bg-surface font-mono"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.condition}
                          onChange={(e) => {
                            const updated = [...partialReturnItems];
                            updated[idx].condition = e.target.value as any;
                            setPartialReturnItems(updated);
                          }}
                          className="w-full border border-line-strong rounded p-1 text-xs bg-surface"
                        >
                          <option value="DAMAGED">Transit Damaged</option>
                          <option value="DEFECTIVE">QC Defect</option>
                          <option value="WRONG_SPECIFICATION">Wrong Spec</option>
                          <option value="EXCESS">Excess Shipment</option>
                          <option value="EXPIRED">Near Expiry</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.reason}
                          onChange={(e) => {
                            const updated = [...partialReturnItems];
                            updated[idx].reason = e.target.value;
                            setPartialReturnItems(updated);
                          }}
                          className="w-full border border-line-strong rounded p-1 text-xs bg-surface"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-rose-700 dark:text-rose-300 whitespace-nowrap">
                        {formatCurrency(item.returnQty * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-canvas p-2.5 rounded border border-line">
              <span className="font-semibold text-ink-muted">Total Return Credit Value:</span>
              <span className="text-base font-bold font-mono text-rose-700 dark:text-rose-300">
                {formatCurrency(partialReturnItems.reduce((acc, it) => acc + it.returnQty * it.unitPrice, 0))}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setPartialReturnTarget(null)}
                className="px-4 py-1.5 border border-line rounded text-ink-muted font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPartialReturn}
                disabled={returnMutation.isPending}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold rounded shadow-xs transition inline-flex items-center gap-1.5"
              >
                {returnMutation.isPending && <Spinner className="size-3.5" />}
                Confirm Partial Return & Post
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 6. VIEW RETURN DETAILS MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(viewReturnTarget)}
        onClose={() => setViewReturnTarget(null)}
        title={`Purchase Return Note: ${viewReturnTarget?.returnNo || ""}`}
        subtitle={`Office: ${viewReturnTarget?.officeName || ""} • Date: ${viewReturnTarget?.returnDate || ""}`}
        maxWidth="2xl"
      >
        {viewReturnTarget && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-canvas p-3 rounded border border-line">
              <div>
                <span className="text-[10px] text-ink-faint font-bold uppercase block">Voucher Ref</span>
                <p className="font-bold text-ink text-sm">{viewReturnTarget.returnNo}</p>
                <p className="text-ink-muted">PO Number: {viewReturnTarget.poNo}</p>
                <p className="text-ink-muted">Supplier: {viewReturnTarget.supplier}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-faint font-bold uppercase block">Settlement Details</span>
                <p className="font-bold text-ink text-sm">{viewReturnTarget.returnType}</p>
                <p className="text-ink-muted">Status: <span className="font-bold text-emerald-600 dark:text-emerald-400">{viewReturnTarget.status}</span></p>
                <p className="text-ink-muted">Remarks: {viewReturnTarget.remarks}</p>
              </div>
            </div>

            <div className="border border-line rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-control text-ink-muted font-semibold">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">UoM</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Debit Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {viewReturnTarget.items?.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">
                        <div className="font-bold text-ink">{it.itemName}</div>
                        <div className="font-mono text-[10px] text-ink-faint">{it.itemCode}</div>
                      </td>
                      <td className="p-2 text-center">{it.uom}</td>
                      <td className="p-2 text-center font-mono font-bold text-rose-700 dark:text-rose-300">{it.quantity}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right font-mono font-bold text-ink">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-canvas p-3 rounded border border-line">
              <span className="text-xs font-semibold text-ink-muted">Total Return Value:</span>
              <span className="text-base font-bold font-mono text-rose-700 dark:text-rose-300">{formatCurrency(viewReturnTarget.amount)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewReturnTarget(null)}
                className="px-4 py-1.5 border border-line rounded text-ink-muted font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintReturnTarget(viewReturnTarget);
                  setViewReturnTarget(null);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 7. PRINT RETURN VOUCHER PREVIEW MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(printReturnTarget)}
        onClose={() => setPrintReturnTarget(null)}
        title="Debit Note / Purchase Return Voucher - Print Preview"
        subtitle="Official Reversal Document for Outward Store Stock and Financial Adjustment"
        maxWidth="4xl"
      >
        {printReturnTarget && (() => {
          const itemsList = printReturnTarget.items ?? [];
          const totalQty = itemsList.reduce((s, it) => s + Number(it.quantity || 0), 0);
          return (
            <div className="space-y-4 text-xs">
              <PrintablePurchaseDoc
                context={context}
                officeId={printReturnTarget.officeId}
                officeName={printReturnTarget.officeName}
                title="Purchase Return / Debit Note"
                metaLeft={[
                  ["Return No", printReturnTarget.returnNo],
                  ["Supplier Name", printReturnTarget.supplier],
                  ["Office Name", printReturnTarget.officeName],
                  ["Warehouse Name", printReturnTarget.warehouseName || "-"],
                  ["Remarks / Reason", printReturnTarget.remarks || ""],
                ]}
                metaRight={[
                  ["Return Date", fmtPrintDate(printReturnTarget.returnDate)],
                  ["GRN No", printReturnTarget.grnNumber || "Without Ref."],
                  ["PO No", printReturnTarget.poNo],
                  ["Return Type", printReturnTarget.returnType],
                  ["Status", printReturnTarget.status],
                ]}
                columns={[
                  { header: "SL", align: "center", widthClass: "w-10" },
                  { header: "Item Code/Model", align: "left", widthClass: "w-28" },
                  { header: "Item Name", align: "left" },
                  { header: "UOM", align: "center", widthClass: "w-14" },
                  { header: "Return Qty", align: "right", widthClass: "w-24" },
                  { header: "Unit Rate", align: "right", widthClass: "w-24" },
                  { header: "Debit Amount", align: "right", widthClass: "w-28" },
                ]}
                rows={itemsList.map((it, idx) => [
                  idx + 1,
                  it.itemCode,
                  it.itemName,
                  it.uom || "PCS",
                  fmtPrintNum(it.quantity),
                  fmtPrintNum(it.unitPrice),
                  fmtPrintNum(it.lineTotal),
                ])}
                totalRows={[["", "", "", "Total", fmtPrintNum(totalQty), "", fmtPrintNum(printReturnTarget.amount)]]}
                signatures={[
                  { roleLabel: "Prepared By", name: printReturnTarget.createdBy },
                  { roleLabel: "Approved By" },
                  { roleLabel: "Supplier Ack.", name: printReturnTarget.supplier, designation: "Supplier" },
                ]}
              />
              <PurchasePrintToolbar
                pdfUrl={`/api/v1/purchase/returns/${encodeURIComponent(printReturnTarget.id)}/pdf`}
                onClose={() => setPrintReturnTarget(null)}
                canExportPdf={perms.returns.export}
              />
            </div>
          );
        })()}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 8. CANCEL RETURN MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(cancelReturnTarget)}
        onClose={() => !cancelMutation.isPending && setCancelReturnTarget(null)}
        title="Cancel Purchase Return"
        subtitle={`Voucher: ${cancelReturnTarget?.returnNo || ""}`}
        maxWidth="md"
      >
        {cancelReturnTarget && (
          <form
            className="space-y-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              cancelMutation.mutate({ id: cancelReturnTarget.id, comments: cancelReason });
            }}
          >
            <p className="text-ink-muted">
              The returned goods come back into stock and {formatCurrency(cancelReturnTarget.amount)} is owed to {cancelReturnTarget.supplier} again.
            </p>
            <div>
              <label htmlFor="cancel-return-reason" className="block text-ink-muted font-semibold mb-1">Reason *</label>
              <textarea
                id="cancel-return-reason"
                required
                maxLength={300}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full border border-line-strong rounded p-2 text-xs h-20"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelReturnTarget(null)}
                disabled={cancelMutation.isPending}
                className="h-9 px-4 border border-line rounded text-ink-muted"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={cancelMutation.isPending}
                className="h-9 px-4 bg-rose-600 text-white rounded font-bold hover:bg-rose-700 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {cancelMutation.isPending && <Spinner className="size-3.5" />}
                Cancel Return
              </button>
            </div>
          </form>
        )}
      </ModalDialog>
      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={invalidateAll}
        noun="return documents"
        templateUrl="/api/v1/purchase/returns/import"
        maxRows={2000}
        matchHint="GRN Number: put the GRN number to return against it, or WITHOUT_REF for a return without reference (needs Supplier, Office, Warehouse and Unit Price). Rows with the same Ref are saved as one return."
        upload={(file) => uploadPurchaseBulk("/api/v1/purchase/returns/import", file)}
      />
    </div>
  );
}
