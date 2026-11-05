"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Eye,
  Printer,
  Edit,
  Plus,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { toast } from "@/components/purchase/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  PurchaseReturn,
  GoodsReceipt,
  Supplier,
  Warehouse,
  Item,
} from "@bridgeone/contracts";

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
  sl: number;
  officeName: string;
  returnDate: string;
  poNo: string;
  returnNo: string;
  remarks: string;
  supplier: string;
  amount: number;
  returnType: string;
  status: "Approved" | "Pending" | "Draft" | "Rejected";
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
  const queryClient = useQueryClient();

  // Active Tab: RECEIVED_LIST or RETURN_LIST
  const [activeTab, setActiveTab] = useState<"RECEIVED_LIST" | "RETURN_LIST">("RECEIVED_LIST");

  // Global Search
  const [searchTerm, setSearchTerm] = useState("");

  // Tab 2 Filters
  const [filterOffice, setFilterOffice] = useState("All");
  const [filterStatus, setFilterStatus] = useState("Status");
  const [filterFromDate, setFilterFromDate] = useState("09/10/2026");
  const [filterToDate, setFilterToDate] = useState("10/11/2026");

  // Pagination states
  const [receivedRowsPerPage, setReceivedRowsPerPage] = useState(50);
  const [receivedPage, setReceivedPage] = useState(1);
  const [returnRowsPerPage, setReturnRowsPerPage] = useState(50);
  const [returnPage, setReturnPage] = useState(1);

  // Modals state
  const [fullReturnTarget, setFullReturnTarget] = useState<ReceivedRow | null>(null);
  const [partialReturnTarget, setPartialReturnTarget] = useState<ReceivedRow | null>(null);
  const [isReturnWithoutRefOpen, setIsReturnWithoutRefOpen] = useState(false);
  const [viewReturnTarget, setViewReturnTarget] = useState<ReturnRow | null>(null);
  const [printReturnTarget, setPrintReturnTarget] = useState<ReturnRow | null>(null);
  const [editReturnTarget, setEditReturnTarget] = useState<ReturnRow | null>(null);

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

  // Return Without Ref Form State
  const [noRefSupplierId, setNoRefSupplierId] = useState("");
  const [noRefWarehouseId, setNoRefWarehouseId] = useState("");
  const [noRefDate, setNoRefDate] = useState(new Date().toISOString().split("T")[0]);
  const [noRefItemId, setNoRefItemId] = useState("");
  const [noRefUnitPrice, setNoRefUnitPrice] = useState(0);
  const [noRefRemarks, setNoRefRemarks] = useState("");
  const [noRefQty, setNoRefQty] = useState(1);

  // API Queries with TanStack
  const { data: serverEligible } = useQuery<GoodsReceipt[]>({
    queryKey: ["eligibleGRNs"],
    queryFn: () => fetchApi("/purchase/returns/eligible-receipts"),
    staleTime: 60000,
  });

  const { data: serverReturns } = useQuery<PurchaseReturn[]>({
    queryKey: ["returnsList"],
    queryFn: () => fetchApi("/purchase/returns"),
    staleTime: 60000,
  });

  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => fetchApi("/master/suppliers") });
  const { data: warehouses } = useQuery<Warehouse[]>({ queryKey: ["warehouses"], queryFn: () => fetchApi("/master/warehouses") });
  const { data: itemsCatalog } = useQuery<Item[]>({ queryKey: ["items"], queryFn: () => fetchApi("/master/items") });

  // Lists come from the server: receipts that can be returned, and posted returns.
  const receivedList = useMemo<ReceivedRow[]>(
    () =>
      (serverEligible ?? [])
        .filter((g) => g.status === "RECEIVED")
        .map((g, i) => ({
          sl: i + 1,
          grnId: g.id,
          receiveDate: g.receiptDate,
          poNo: g.poNumber,
          returnInvoiceNo: g.grnNumber,
          remarks: g.remarks ?? "",
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
        sl: i + 1,
        officeName: r.officeName,
        returnDate: r.returnDate,
        poNo: r.poNumber,
        returnNo: r.returnNumber,
        remarks: r.items[0]?.reason ?? "",
        supplier: r.supplierName,
        amount: r.totalReturnAmount,
        returnType: r.grnNumber === "Direct Return" ? "Direct / Ad-hoc" : "Against GRN",
        status: r.status === "CANCELLED" ? "Rejected" : "Approved",
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
    [serverReturns],
  );

  // Posts the return: stock leaves the warehouse and the supplier balance goes down.
  const returnMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => fetchApi<PurchaseReturn>("/purchase/returns", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["returnsList"] });
      queryClient.invalidateQueries({ queryKey: ["eligibleGRNs"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setFullReturnTarget(null);
      setPartialReturnTarget(null);
      setIsReturnWithoutRefOpen(false);
      setActiveTab("RETURN_LIST");
      toast.success(`Return ${data.returnNumber} posted. Stock and supplier balance updated.`, { title: "Purchase Return Posted" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Return Failed" }),
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
  const today = () => new Date().toISOString().split("T")[0];

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

  // Submit Return Without Ref: stock leaves the selected warehouse.
  const handleConfirmReturnWithoutRef = (e: React.FormEvent) => {
    e.preventDefault();
    const item = itemsCatalog?.find((i) => i.id === noRefItemId);
    if (!item) {
      toast.error("Select the item being returned.", { title: "Purchase Return" });
      return;
    }
    submitReturn(
      "WITHOUT_REF",
      noRefDate,
      [{ itemId: item.id, itemCode: item.code, itemName: item.name, uom: item.uom, receivedQty: noRefQty, returnQty: noRefQty, unitPrice: noRefUnitPrice, reason: noRefRemarks }],
      { supplierId: noRefSupplierId, warehouseId: noRefWarehouseId, remarks: noRefRemarks },
    );
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
      if (filterStatus !== "Status" && filterStatus !== "All" && row.status !== filterStatus) return false;
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
  }, [returnList, filterOffice, filterStatus, searchTerm]);

  // Paginated Return List
  const totalReturnPages = Math.ceil(filteredReturns.length / returnRowsPerPage) || 1;
  const paginatedReturns = useMemo(() => {
    const start = (returnPage - 1) * returnRowsPerPage;
    return filteredReturns.slice(start, start + returnRowsPerPage);
  }, [filteredReturns, returnPage, returnRowsPerPage]);

  // Export to CSV
  const handleExportCSV = () => {
    if (activeTab === "RECEIVED_LIST") {
      const headers = ["SL", "Receive Date", "PO No", "Return Invoice No", "Remarks", "Supplier", "Amount (BDT)"];
      const rows = filteredReceived.map((r, idx) => [
        idx + 1,
        r.receiveDate,
        r.poNo,
        r.returnInvoiceNo,
        `"${r.remarks}"`,
        `"${r.supplier}"`,
        r.amount,
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `purchase_receive_for_return_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ["SL", "Office Name", "Return Date", "PO No", "Return No", "Remarks", "Supplier", "Amount", "Return Type", "Status"];
      const rows = filteredReturns.map((r, idx) => [
        idx + 1,
        `"${r.officeName}"`,
        r.returnDate,
        r.poNo,
        r.returnNo,
        `"${r.remarks}"`,
        `"${r.supplier}"`,
        r.amount,
        r.returnType,
        r.status,
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `purchase_returns_list_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-3 p-1">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER (Exact Unified Box Layout) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Return</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input matching Screenshot */}
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

          {/* Export to CSV / Excel Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            title="Download CSV / Excel"
            className="h-9 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          {/* + Return Without Ref. Blue Button */}
          <button
            type="button"
            onClick={() => setIsReturnWithoutRefOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Return Without Ref.</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TABS NAVIGATION */}
      {/* ------------------------------------------------------------- */}
      <div className="flex border-b border-slate-200 gap-8 text-xs font-bold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setActiveTab("RECEIVED_LIST")}
          className={`pb-2 transition ${
            activeTab === "RECEIVED_LIST"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          RECEIVED LIST
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RETURN_LIST")}
          className={`pb-2 transition ${
            activeTab === "RETURN_LIST"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          RETURN LIST
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: RECEIVED LIST (SCREENSHOT 1) */}
      {/* ============================================================= */}
      {activeTab === "RECEIVED_LIST" && (
        <div className="space-y-2">
          {/* Table Container with All Borders */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Receive Date</th>
                  <th className="p-2 border border-slate-300 w-36">PO No</th>
                  <th className="p-2 border border-slate-300 w-44">Return Invoice No</th>
                  <th className="p-2 border border-slate-300">Remarks</th>
                  <th className="p-2 border border-slate-300">Supplier</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Amount</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredReceived.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No eligible receipts found for return.
                    </td>
                  </tr>
                ) : (
                  paginatedReceived.map((row, idx) => {
                    const serialNo = (receivedPage - 1) * receivedRowsPerPage + idx + 1;
                    return (
                      <tr key={row.sl || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                          {serialNo}
                        </td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                          {row.receiveDate}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                          {row.poNo}
                        </td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-slate-900 font-medium">
                            <Truck className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                            <span>{row.returnInvoiceNo}</span>
                          </span>
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-600 max-w-xs truncate" title={row.remarks}>
                          {row.remarks}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-900" title={row.supplier}>
                          {row.supplier}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 text-xs">
                            <button
                              type="button"
                              onClick={() => handleOpenFullReturn(row)}
                              className="text-blue-600 hover:underline font-medium hover:text-blue-800"
                              title="Return all items from this receipt"
                            >
                              Full
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleOpenPartialReturn(row)}
                              className="text-blue-600 hover:underline font-medium hover:text-blue-800"
                              title="Select specific items and quantities to return"
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
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={receivedRowsPerPage}
                onChange={(e) => {
                  setReceivedRowsPerPage(Number(e.target.value));
                  setReceivedPage(1);
                }}
                className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs"
              >
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
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={receivedPage >= totalReceivedPages}
                  onClick={() => setReceivedPage((p) => Math.min(totalReceivedPages, p + 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
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
        <div className="space-y-2">
          {/* Filter Card matching Screenshot 2 */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-xs">
            {/* Office Filter */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">Office</label>
              <select
                value={filterOffice}
                onChange={(e) => setFilterOffice(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All</option>
                <option value="Marinozz">Marinozz</option>
                <option value="Dhaka Head Office">Dhaka Head Office</option>
                <option value="MOHS Eco">MOHS Eco</option>
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="Status">Status</option>
                <option value="All">All</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Draft">Draft</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">From Date</label>
              <input
                type="text"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                placeholder="09/10/2026"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">To Date</label>
              <input
                type="text"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                placeholder="10/11/2026"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* View Button */}
            <div>
              <button
                type="button"
                className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
              >
                View
              </button>
            </div>
          </div>

          {/* Table Container with All Borders */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Actions</th>
                  <th className="p-2 border border-slate-300 w-36">Office Name</th>
                  <th className="p-2 border border-slate-300 w-24">Return Date</th>
                  <th className="p-2 border border-slate-300 w-24">PO No</th>
                  <th className="p-2 border border-slate-300 w-44">Return No</th>
                  <th className="p-2 border border-slate-300 w-36">Remarks</th>
                  <th className="p-2 border border-slate-300">Supplier</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Amount</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Return Type</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      No purchase return records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedReturns.map((row, idx) => {
                    const serialNo = (returnPage - 1) * returnRowsPerPage + idx + 1;
                    return (
                      <tr key={row.sl || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                          {serialNo}
                        </td>

                        {/* Actions: View, Print, Edit */}
                        <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2 text-slate-600">
                            <button
                              type="button"
                              onClick={() => setViewReturnTarget(row)}
                              className="p-1 hover:text-blue-600 transition"
                              title="View Return Note"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrintReturnTarget(row)}
                              className="p-1 hover:text-blue-600 transition"
                              title="Print Debit Note / Return Voucher"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditReturnTarget(row)}
                              className="p-1 hover:text-blue-600 transition"
                              title="Edit Return Information"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="p-2 border border-slate-300 text-slate-700 whitespace-nowrap">
                          {row.officeName}
                        </td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                          {row.returnDate}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                          {row.poNo}
                        </td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-slate-900 font-medium">
                            <Truck className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                            <span>{row.returnNo}</span>
                          </span>
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-600 max-w-xs truncate" title={row.remarks}>
                          {row.remarks}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-900" title={row.supplier}>
                          {row.supplier}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                          <span className="text-amber-700 font-medium">
                            {row.returnType}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                          <span className="text-emerald-700 font-semibold">
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
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={returnRowsPerPage}
                onChange={(e) => {
                  setReturnRowsPerPage(Number(e.target.value));
                  setReturnPage(1);
                }}
                className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs"
              >
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
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={returnPage >= totalReturnPages}
                  onClick={() => setReturnPage((p) => Math.min(totalReturnPages, p + 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Confirm Full Consignment Return</span>
              </div>
              <p className="text-[11px] text-rose-700">
                This action will reverse 100% of the received inventory from warehouse, generate a debit note voucher, and reduce supplier payables by <strong>BDT {formatCurrency(fullReturnTarget.amount)}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">PO Reference</span>
                <span className="font-semibold text-slate-800 font-mono">{fullReturnTarget.poNo}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Receive Date</span>
                <span className="font-semibold text-slate-800">{fullReturnTarget.receiveDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Warehouse Office</span>
                <span className="font-semibold text-slate-800">{fullReturnTarget.office}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Refund Amount</span>
                <span className="font-bold text-rose-700 font-mono">{formatCurrency(fullReturnTarget.amount)}</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Audit Reason for Full Return *</label>
              <textarea
                value={fullReturnReason}
                onChange={(e) => setFullReturnReason(e.target.value)}
                rows={3}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setFullReturnTarget(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFullReturn}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-xs transition"
              >
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
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800">{partialReturnTarget.returnInvoiceNo}</p>
                <p className="text-[11px] text-slate-500">PO: {partialReturnTarget.poNo} • {partialReturnTarget.supplier}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Consignment Total</span>
                <span className="font-bold font-mono text-slate-900">{formatCurrency(partialReturnTarget.amount)}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center w-16">UoM</th>
                    <th className="p-2 text-center w-24">Recv Qty</th>
                    <th className="p-2 w-28 text-center bg-rose-50 text-rose-800">Return Qty *</th>
                    <th className="p-2 w-36">Defect Condition</th>
                    <th className="p-2">Inspection Remarks</th>
                    <th className="p-2 text-right w-28">Debit Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partialReturnItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2">
                        <div className="font-semibold text-slate-900">{item.itemName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{item.itemCode}</div>
                      </td>
                      <td className="p-2 text-center font-mono text-slate-600">{item.uom}</td>
                      <td className="p-2 text-center font-mono font-bold text-slate-700">{item.receivedQty}</td>
                      <td className="p-2 bg-rose-50/50">
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
                          className="w-full border border-rose-300 rounded p-1 text-center font-bold text-rose-700 bg-white font-mono"
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
                          className="w-full border border-slate-300 rounded p-1 text-xs bg-white"
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
                          className="w-full border border-slate-300 rounded p-1 text-xs bg-white"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                        {formatCurrency(item.returnQty * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-200">
              <span className="font-semibold text-slate-700">Total Return Credit Value:</span>
              <span className="text-base font-bold font-mono text-rose-700">
                {formatCurrency(partialReturnItems.reduce((acc, it) => acc + it.returnQty * it.unitPrice, 0))}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setPartialReturnTarget(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPartialReturn}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-xs transition"
              >
                Confirm Partial Return & Post
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 5. RETURN WITHOUT REF MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={isReturnWithoutRefOpen}
        onClose={() => setIsReturnWithoutRefOpen(false)}
        title="Direct Purchase Return (Without GRN Ref)"
        subtitle="Issue outward stock return & debit note without previous receiving reference"
        maxWidth="2xl"
      >
        <form onSubmit={handleConfirmReturnWithoutRef} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Supplier / Vendor *</label>
              <select
                value={noRefSupplierId}
                onChange={(e) => setNoRefSupplierId(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                required
              >
                <option value="">Select supplier</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Return From Warehouse *</label>
              <select
                value={noRefWarehouseId}
                onChange={(e) => setNoRefWarehouseId(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                required
              >
                <option value="">Select warehouse</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Return Date *</label>
              <input
                type="date"
                value={noRefDate}
                onChange={(e) => setNoRefDate(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Unit Price (BDT) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={noRefUnitPrice}
                onChange={(e) => setNoRefUnitPrice(Number(e.target.value))}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white font-mono font-bold"
                required
              />
              <p className="mt-1 text-slate-500">Return value: {formatCurrency(noRefUnitPrice * noRefQty)}</p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Item *</label>
              <select
                value={noRefItemId}
                onChange={(e) => {
                  setNoRefItemId(e.target.value);
                  const picked = itemsCatalog?.find((i) => i.id === e.target.value);
                  if (picked) setNoRefUnitPrice(picked.standardPrice);
                }}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                required
              >
                <option value="">Select item</option>
                {itemsCatalog?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} · {i.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={noRefQty}
                onChange={(e) => setNoRefQty(Number(e.target.value))}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white font-mono"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Remarks / Rejection Grounds</label>
              <input
                type="text"
                value={noRefRemarks}
                onChange={(e) => setNoRefRemarks(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setIsReturnWithoutRefOpen(false)}
              className="px-4 py-1.5 border border-slate-200 rounded font-medium text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-xs transition"
            >
              Save Direct Return
            </button>
          </div>
        </form>
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
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Voucher Ref</span>
                <p className="font-bold text-slate-900 text-sm">{viewReturnTarget.returnNo}</p>
                <p className="text-slate-600">PO Number: {viewReturnTarget.poNo}</p>
                <p className="text-slate-600">Supplier: {viewReturnTarget.supplier}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Settlement Details</span>
                <p className="font-bold text-slate-900 text-sm">{viewReturnTarget.returnType}</p>
                <p className="text-slate-600">Status: <span className="font-bold text-emerald-600">{viewReturnTarget.status}</span></p>
                <p className="text-slate-600">Remarks: {viewReturnTarget.remarks}</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">UoM</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Debit Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewReturnTarget.items?.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{it.itemCode}</div>
                      </td>
                      <td className="p-2 text-center">{it.uom}</td>
                      <td className="p-2 text-center font-mono font-bold text-rose-700">{it.quantity}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Total Return Value:</span>
              <span className="text-base font-bold font-mono text-rose-700">{formatCurrency(viewReturnTarget.amount)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewReturnTarget(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-700 font-semibold"
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
        {printReturnTarget && (
          <div className="space-y-4 text-xs">
            <div className="bg-white p-6 border border-slate-200 rounded shadow-sm text-slate-800 space-y-4 print:p-0 print:border-none">
              {/* Organization Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  {/* Company Logo */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="BridgeOne Logo" className="h-10 w-auto object-contain" />
                  <div>
                    <h2 className="font-bold text-base text-slate-900 tracking-wide uppercase">BridgeOne ERP Industries Ltd.</h2>
                    <p className="text-[11px] text-slate-500">Corporate Head Office, Gulshan-2, Dhaka • Sirajganj Industrial Park</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded text-xs">
                    PURCHASE DEBIT NOTE
                  </span>
                  <p className="font-mono font-bold text-slate-900 text-sm mt-1">{printReturnTarget.returnNo}</p>
                  <p className="text-[10px] text-slate-400">Date: {printReturnTarget.returnDate}</p>
                </div>
              </div>

              {/* Vendor & Return Metadata */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
                <div>
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase mb-1">Debited Vendor</h4>
                  <p className="font-bold text-slate-900">{printReturnTarget.supplier}</p>
                  <p className="text-slate-600">PO Reference: <span className="font-mono font-semibold">{printReturnTarget.poNo}</span></p>
                  <p className="text-slate-600">Settlement Type: {printReturnTarget.returnType}</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase mb-1">Reversal Destination</h4>
                  <p className="font-semibold text-slate-800">Originating Office: {printReturnTarget.officeName}</p>
                  <p className="text-slate-600">Reversal Reason: {printReturnTarget.remarks}</p>
                  <p className="text-slate-600">Audit Status: <span className="font-bold text-emerald-600">{printReturnTarget.status}</span></p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold">
                    <tr>
                      <th className="p-2 border-b w-8 text-center">#</th>
                      <th className="p-2 border-b">Item Code & Name</th>
                      <th className="p-2 border-b text-center w-16">UoM</th>
                      <th className="p-2 border-b text-center w-24">Returned Qty</th>
                      <th className="p-2 border-b text-right w-28">Unit Price</th>
                      <th className="p-2 border-b text-right w-32">Debit Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {printReturnTarget.items?.map((it: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2">
                          <div className="font-semibold text-slate-900">{it.itemName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{it.itemCode}</div>
                        </td>
                        <td className="p-2 text-center font-mono">{it.uom}</td>
                        <td className="p-2 text-center font-mono font-bold text-rose-700">{it.quantity}</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={5} className="p-2 text-right font-bold text-slate-700">Total Debit Value:</td>
                      <td className="p-2 text-right font-bold font-mono text-rose-700 text-sm">
                        {formatCurrency(printReturnTarget.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 4-Tier Sign-off Blocks */}
              <div className="pt-12 grid grid-cols-4 gap-4 text-center text-[10px] text-slate-500">
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Fuad Hossain</span>
                  <span>Store In-charge</span>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Quality Inspector</span>
                  <span>QC Inspection Team</span>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Accounts & Finance</span>
                  <span>Payables Reconciliation</span>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Factory Head</span>
                  <span>Authorized Signatory</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPrintReturnTarget(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-700 font-semibold"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 8. EDIT RETURN MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(editReturnTarget)}
        onClose={() => setEditReturnTarget(null)}
        title="Edit Purchase Return"
        subtitle={`Voucher: ${editReturnTarget?.returnNo || ""}`}
        maxWidth="md"
      >
        {editReturnTarget && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Remarks</label>
              <input
                type="text"
                value={editReturnTarget.remarks}
                onChange={(e) => setEditReturnTarget({ ...editReturnTarget, remarks: e.target.value })}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Status</label>
              <select
                value={editReturnTarget.status}
                onChange={(e) => setEditReturnTarget({ ...editReturnTarget, status: e.target.value as any })}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              >
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditReturnTarget(null)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  // There is no update endpoint: a posted return has already moved stock.
                  setEditReturnTarget(null);
                  toast.error(`Return ${editReturnTarget.returnNo} is posted and has moved stock, so it cannot be edited.`);
                }}
                className="px-4 py-1.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
