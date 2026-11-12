"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Download, Eye, PackageCheck, Plus, Printer, RotateCcw, Search, Trash2, Truck, X } from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { toast } from "@/components/purchase/Toast";
import { Spinner } from "@/components/ui/spinner";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { effectiveUnitCost } from "@/lib/purchase-store/rules";
import { PURCHASE_QUERY_KEYS, downloadCsv, localToday } from "@/features/purchase/lib/client";
import type { GoodsReceipt, Item, PurchaseOrder, Supplier, Warehouse } from "@bridgeone/contracts";

type Tab = "APPROVED_PO" | "RECEIVED_PO";
type Receipt = GoodsReceipt & { challanNumber?: string; gatePassNumber?: string; remarks?: string; vatChallanNumber?: string; supplierInvoiceNumber?: string };

interface ReceiveLine {
  poItemId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  outstanding: number;
  received: number;
  rejected: number;
  rate: number;
}

interface ReceiveForm {
  po: PurchaseOrder;
  receiptDate: string;
  challanNumber: string;
  gatePassNumber: string;
  vatChallanNumber: string;
  supplierInvoiceNumber: string;
  remarks: string;
  lines: ReceiveLine[];
}

interface DirectLine {
  key: number;
  itemId: string;
  qty: number;
  unitPrice: number;
}

interface ReturnLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  available: number;
  qty: number;
  unitPrice: number;
}

const today = localToday;
let lineKey = 0;

const inputCls =
  "w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500";
const btnPrimary =
  "h-9 px-4 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs rounded inline-flex items-center justify-center gap-1.5 shadow-xs transition";
const btnGhost = "h-9 px-4 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 text-xs font-semibold";
const iconBtn = "inline-flex items-center justify-center size-7 rounded hover:bg-slate-200 text-slate-700 transition disabled:opacity-30 disabled:hover:bg-transparent";

const qtyFmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

function receiptStatus(g: Receipt) {
  switch (g.status) {
    case "CANCELLED":
      return { text: "Cancelled", cls: "text-rose-600" };
    case "PARTIALLY_RETURNED":
      return { text: "Partly Returned", cls: "text-amber-700" };
    case "FULLY_RETURNED":
      return { text: "Returned", cls: "text-slate-600" };
    default:
      return { text: "Received", cls: "text-emerald-700" };
  }
}

export default function PurchaseReceivePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("APPROVED_PO");
  const [search, setSearch] = useState("");

  // Received tab filters
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Dialogs
  const [receiveForm, setReceiveForm] = useState<ReceiveForm | null>(null);
  const [directOpen, setDirectOpen] = useState(false);
  const [dirSupplierId, setDirSupplierId] = useState("");
  const [dirWarehouseId, setDirWarehouseId] = useState("");
  const [dirChallan, setDirChallan] = useState("");
  const [dirDate, setDirDate] = useState(today());
  const [dirLines, setDirLines] = useState<DirectLine[]>([]);
  const [viewGRN, setViewGRN] = useState<Receipt | null>(null);
  const [printGRN, setPrintGRN] = useState<Receipt | null>(null);
  const [closePO, setClosePO] = useState<PurchaseOrder | null>(null);
  const [cancelGRN, setCancelGRN] = useState<Receipt | null>(null);
  const [comment, setComment] = useState("");
  const [returnGRN, setReturnGRN] = useState<Receipt | null>(null);
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [returnDate, setReturnDate] = useState(today());

  // Data
  const { data: warehouses = [] } = useQuery<Warehouse[]>({ queryKey: ["warehouses", "ALL"], queryFn: () => fetchApi("/master/warehouses") });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => fetchApi("/master/suppliers") });
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["items"], queryFn: () => fetchApi("/master/items") });
  const { data: context } = useQuery<{ company: { name: string } }>({ queryKey: ["context"], queryFn: () => fetchApi("/master/context") });
  const { data: approvedPOs = [], isFetching: posLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["approvedPOs"],
    queryFn: () => fetchApi("/purchase/receipts/approved-orders"),
  });
  const { data: receipts = [], isFetching: grnLoading, refetch: refetchGRNs } = useQuery<Receipt[]>({
    queryKey: ["receivedGRNs"],
    queryFn: () => fetchApi("/purchase/receipts"),
  });
  const { data: eligible = [] } = useQuery<GoodsReceipt[]>({
    queryKey: ["eligibleGRNs"],
    queryFn: () => fetchApi("/purchase/returns/eligible-receipts"),
  });
  const eligibleIds = useMemo(() => new Set(eligible.map((g) => g.id)), [eligible]);

  const pendingPOs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return approvedPOs.filter((o) => !q || [o.poNumber, o.supplierName, o.officeName, o.warehouseName, o.createdBy, o.requisitionNumber ?? ""].some((v) => v.toLowerCase().includes(q)));
  }, [approvedPOs, search]);

  const filteredGRNs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return receipts.filter((g) => {
      if (warehouseFilter !== "ALL" && g.warehouseId !== warehouseFilter) return false;
      if (supplierFilter !== "ALL" && g.supplierId !== supplierFilter) return false;
      if (statusFilter !== "ALL" && g.status !== statusFilter) return false;
      if (fromDate && g.receiptDate < fromDate) return false;
      if (toDate && g.receiptDate > toDate) return false;
      if (q && ![g.grnNumber, g.poNumber, g.supplierName, g.challanNumber ?? "", g.preparedBy].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [receipts, search, warehouseFilter, supplierFilter, statusFilter, fromDate, toDate]);

  const invalidate = () => {
    for (const key of PURCHASE_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };

  // ---------------------------------------------------------------
  // Receive against PO
  // ---------------------------------------------------------------
  const openReceive = (po: PurchaseOrder) =>
    setReceiveForm({
      po,
      receiptDate: today(),
      challanNumber: "",
      gatePassNumber: "",
      vatChallanNumber: "",
      supplierInvoiceNumber: "",
      remarks: "",
      lines: po.items
        .filter((it) => it.outstandingQuantity > 0)
        .map((it) => ({
          poItemId: it.id ?? "",
          itemId: it.itemId,
          itemCode: it.itemCode,
          itemName: it.itemName,
          uom: it.uom,
          orderedQuantity: it.orderedQuantity,
          previouslyReceivedQuantity: it.receivedQuantity,
          outstanding: it.outstandingQuantity,
          received: it.outstandingQuantity,
          rejected: 0,
          rate: effectiveUnitCost(it.lineTotal, it.orderedQuantity),
        })),
    });

  const patchReceiveLine = (idx: number, patch: Partial<ReceiveLine>) =>
    setReceiveForm((f) => (f ? { ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) } : f));

  const receiveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => fetchApi<Receipt>("/purchase/receipts", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (grn) => {
      invalidate();
      setReceiveForm(null);
      setDirectOpen(false);
      toast.success(`${grn.grnNumber} posted: ${formatCurrency(grn.totalReceivedAmount)} received into ${grn.warehouseName}.`, { title: "Goods Received" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Receipt Failed" }),
  });

  const lineError = (l: ReceiveLine) => {
    if (l.received < 0 || l.rejected < 0) return "Quantities cannot be negative.";
    if (l.rejected > l.received) return "Rejected is more than received.";
    if (l.received - l.rejected > l.outstanding + 1e-9) return `Only ${qtyFmt(l.outstanding)} is due.`;
    return null;
  };

  const submitReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveForm) return;
    const lines = receiveForm.lines.filter((l) => l.received > 0);
    if (!lines.length) return toast.error("Enter a received quantity for at least one item.", { title: "Goods Receipt" });
    const bad = lines.find((l) => lineError(l));
    if (bad) return toast.error(`${bad.itemName}: ${lineError(bad)}`, { title: "Goods Receipt" });
    receiveMutation.mutate({
      companyId: "comp-bridgeone-01",
      purchaseOrderId: receiveForm.po.id,
      receiptDate: receiveForm.receiptDate,
      shipmentDocumentNumber: receiveForm.challanNumber || undefined,
      challanNumber: receiveForm.challanNumber || undefined,
      gatePassNumber: receiveForm.gatePassNumber || undefined,
      vatChallanNumber: receiveForm.vatChallanNumber || undefined,
      supplierInvoiceNumber: receiveForm.supplierInvoiceNumber || undefined,
      remarks: receiveForm.remarks || undefined,
      items: lines.map((l) => ({
        poItemId: l.poItemId,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        uom: l.uom,
        orderedQuantity: l.orderedQuantity,
        previouslyReceivedQuantity: l.previouslyReceivedQuantity,
        currentReceivedQuantity: l.received,
        rejectedDamagedQuantity: l.rejected,
        unitPrice: l.rate,
        lineTotal: (l.received - l.rejected) * l.rate,
      })),
    });
  };

  // ---------------------------------------------------------------
  // Direct receive (no PO)
  // ---------------------------------------------------------------
  const openDirect = () => {
    setDirSupplierId("");
    setDirWarehouseId(warehouses[0]?.id ?? "");
    setDirChallan("");
    setDirDate(today());
    setDirLines([{ key: ++lineKey, itemId: "", qty: 1, unitPrice: 0 }]);
    setDirectOpen(true);
  };

  const submitDirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirSupplierId) return toast.error("Select the supplier.", { title: "Direct Receive" });
    if (!dirWarehouseId) return toast.error("Select the warehouse.", { title: "Direct Receive" });
    const lines = dirLines.filter((l) => l.itemId && l.qty > 0);
    if (!lines.length) return toast.error("Select at least one item with a quantity.", { title: "Direct Receive" });
    receiveMutation.mutate({
      companyId: "comp-bridgeone-01",
      purchaseOrderId: "DIRECT",
      receiptDate: dirDate,
      shipmentDocumentNumber: dirChallan || undefined,
      challanNumber: dirChallan || undefined,
      supplierId: dirSupplierId,
      warehouseId: dirWarehouseId,
      officeId: warehouses.find((w) => w.id === dirWarehouseId)?.officeId,
      items: lines.map((l) => {
        const it = items.find((i) => i.id === l.itemId)!;
        return {
          poItemId: "",
          itemId: it.id,
          itemCode: it.code,
          itemName: it.name,
          uom: it.uom,
          orderedQuantity: l.qty,
          previouslyReceivedQuantity: 0,
          currentReceivedQuantity: l.qty,
          rejectedDamagedQuantity: 0,
          unitPrice: l.unitPrice,
          lineTotal: l.qty * l.unitPrice,
        };
      }),
    });
  };

  // ---------------------------------------------------------------
  // Close PO balance / cancel GRN / return
  // ---------------------------------------------------------------
  const closeMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) => fetchApi<PurchaseOrder>(`/purchase/orders/${id}/close`, { method: "POST", body: JSON.stringify({ comments }) }),
    onSuccess: (po) => {
      invalidate();
      setClosePO(null);
      toast.success(`${po.poNumber} closed; no more goods will be received against it.`, { title: "Order Closed" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Close Failed" }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) => fetchApi<Receipt>(`/purchase/receipts/${id}/cancel`, { method: "POST", body: JSON.stringify({ comments }) }),
    onSuccess: (grn) => {
      invalidate();
      setCancelGRN(null);
      toast.success(`${grn.grnNumber} cancelled. Stock and the supplier balance were reversed.`, { title: "Receipt Cancelled" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Cancel Failed" }),
  });

  const openReturn = (g: Receipt) => {
    const source = eligible.find((e) => e.id === g.id);
    if (!source) return toast.error("Everything on this receipt has already been returned.", { title: "Purchase Return" });
    setReturnGRN(g);
    setReturnReason("");
    setReturnDate(today());
    setReturnLines(
      source.items.map((it) => ({
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        available: it.currentReceivedQuantity,
        qty: 0,
        unitPrice: it.unitPrice,
      })),
    );
  };

  const returnMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => fetchApi<{ returnNumber: string; totalReturnAmount: number }>("/purchase/returns", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (ret) => {
      invalidate();
      setReturnGRN(null);
      toast.success(`${ret.returnNumber} posted (${formatCurrency(ret.totalReturnAmount)}). Stock and supplier balance updated.`, { title: "Purchase Return" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Return Failed" }),
  });

  const submitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnGRN) return;
    const lines = returnLines.filter((l) => l.qty > 0);
    if (!lines.length) return toast.error("Enter a return quantity for at least one item.", { title: "Purchase Return" });
    const over = lines.find((l) => l.qty > l.available + 1e-9);
    if (over) return toast.error(`${over.itemName}: only ${qtyFmt(over.available)} can be returned.`, { title: "Purchase Return" });
    returnMutation.mutate({
      companyId: "comp-bridgeone-01",
      goodsReceiptId: returnGRN.id,
      returnDate,
      returnType: "REFUND_CREDIT",
      remarks: returnReason,
      items: lines.map((l) => ({
        grnItemId: "",
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        uom: l.uom,
        receivedQuantity: l.available,
        previouslyReturnedQuantity: 0,
        eligibleReturnQuantity: l.available,
        returnQuantity: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.qty * l.unitPrice,
        reason: returnReason || "Returned to supplier",
        condition: "DAMAGED",
      })),
    });
  };

  const handleExport = () => {
    if (activeTab === "APPROVED_PO") {
      downloadCsv(
        "pending_receipts.csv",
        ["SL", "PO Date", "Expected Date", "Requisition No", "PO No", "Supplier", "Office", "Warehouse", "Outstanding Qty", "Status"],
        pendingPOs.map((o, i) => [i + 1, o.orderDate, o.expectedDeliveryDate, o.requisitionNumber ?? "", o.poNumber, o.supplierName, o.officeName, o.warehouseName, o.items.reduce((s, it) => s + it.outstandingQuantity, 0), o.status]),
      );
    } else {
      downloadCsv(
        "goods_receipts.csv",
        ["SL", "Receive Date", "GRN No", "PO No", "Challan No", "Warehouse", "Supplier", "Received Qty", "Rejected Qty", "Amount (BDT)", "Prepared By", "Status"],
        filteredGRNs.map((g, i) => [
          i + 1,
          g.receiptDate,
          g.grnNumber,
          g.poNumber,
          g.challanNumber ?? "",
          g.warehouseName,
          g.supplierName,
          g.items.reduce((s, it) => s + it.currentReceivedQuantity, 0),
          g.items.reduce((s, it) => s + it.rejectedDamagedQuantity, 0),
          g.totalReceivedAmount,
          g.preparedBy,
          receiptStatus(g).text,
        ]),
      );
    }
  };

  const receiveTotal = receiveForm?.lines.reduce((s, l) => s + Math.max(0, l.received - l.rejected) * l.rate, 0) ?? 0;
  const directTotal = dirLines.reduce((s, l) => s + (l.itemId ? l.qty * l.unitPrice : 0), 0);
  const returnTotal = returnLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Receive</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search...."
              aria-label="Search"
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button type="button" onClick={handleExport} className={btnPrimary} title="Download Excel (CSV)">
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
          <button type="button" onClick={() => router.push("/purchase/receive/create")} className={btnPrimary}>
            <Plus className="w-4 h-4" /> Direct Receive
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex items-center gap-8 border-b border-slate-200 bg-white px-3 pt-1">
        {(
          [
            ["APPROVED_PO", `APPROVED PO (${approvedPOs.length})`],
            ["RECEIVED_PO", "RECEIVED PO"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`pb-2.5 pt-2 text-xs font-bold tracking-wide border-b-2 transition ${activeTab === id ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: Approved POs waiting for goods */}
      {activeTab === "APPROVED_PO" && (
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="erp-table-container">
            <table className="erp-table">
              <thead>
                <tr>
                  <th className="w-12 text-center">SL</th>
                  <th className="w-24 text-center">Actions</th>
                  <th>PO Date</th>
                  <th>Expected Date</th>
                  <th>Requisition No</th>
                  <th>PO No</th>
                  <th>Supplier</th>
                  <th>Office</th>
                  <th>Warehouse</th>
                  <th className="text-right">Ordered</th>
                  <th className="text-right">Outstanding</th>
                  <th>Prepared By</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingPOs.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-10 text-slate-400">
                      {posLoading ? "Loading…" : "No approved purchase orders are waiting for goods."}
                    </td>
                  </tr>
                ) : (
                  pendingPOs.map((po, idx) => {
                    const ordered = po.items.reduce((s, it) => s + it.orderedQuantity, 0);
                    const outstanding = po.items.reduce((s, it) => s + it.outstandingQuantity, 0);
                    const overdue = po.expectedDeliveryDate < today();
                    return (
                      <tr key={po.id}>
                        <td className="text-center font-mono text-slate-600">{idx + 1}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button type="button" onClick={() => openReceive(po)} className={`${iconBtn} hover:bg-emerald-100 hover:text-emerald-700`} title="Receive goods" aria-label={`Receive goods for ${po.poNumber}`}>
                              <PackageCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={po.status !== "PARTIALLY_RECEIVED"}
                              onClick={() => {
                                setClosePO(po);
                                setComment("");
                              }}
                              className={`${iconBtn} hover:bg-rose-100 hover:text-rose-700`}
                              title={po.status === "PARTIALLY_RECEIVED" ? "Close remaining balance" : "Only partly received orders can be closed here; cancel unreceived orders from Purchase Order"}
                              aria-label={`Close remaining balance of ${po.poNumber}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td>{po.orderDate}</td>
                        <td className={overdue ? "text-rose-600 font-semibold" : ""}>{po.expectedDeliveryDate}</td>
                        <td className="font-mono text-[11px]">{po.requisitionNumber || "—"}</td>
                        <td className="font-mono text-sky-700 font-semibold">{po.poNumber}</td>
                        <td className="font-medium text-slate-900">{po.supplierName}</td>
                        <td>{po.officeName}</td>
                        <td>{po.warehouseName}</td>
                        <td className="text-right font-mono">{qtyFmt(ordered)}</td>
                        <td className="text-right font-mono font-bold text-amber-700">{qtyFmt(outstanding)}</td>
                        <td>{po.createdBy}</td>
                        <td className={`text-center text-[11px] font-semibold ${po.status === "PARTIALLY_RECEIVED" ? "text-purple-700" : "text-sky-700"}`}>
                          {po.status === "PARTIALLY_RECEIVED" ? "Partially Received" : "Approved"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Goods receipts */}
      {activeTab === "RECEIVED_PO" && (
        <div className="space-y-3">
          <div className="bg-white rounded border border-slate-200/90 p-3.5 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Warehouse</span>
                <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Supplier</span>
                <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Status</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">All</option>
                  <option value="RECEIVED">Received</option>
                  <option value="PARTIALLY_RETURNED">Partly Returned</option>
                  <option value="FULLY_RETURNED">Returned</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</span>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
              </label>
              <div className="flex items-end">
                <button type="button" onClick={() => refetchGRNs()} disabled={grnLoading} className={btnPrimary}>
                  {grnLoading && <Spinner className="size-3.5" />} VIEW
                </button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="erp-table-container">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th className="w-12 text-center">SL</th>
                    <th className="w-[130px] text-center">Actions</th>
                    <th>Receive Date</th>
                    <th>GRN No</th>
                    <th>PO No</th>
                    <th>Challan No</th>
                    <th>Warehouse</th>
                    <th>Supplier</th>
                    <th className="text-right">Received</th>
                    <th className="text-right">Rejected</th>
                    <th className="text-right">Amount (BDT)</th>
                    <th>Prepared By</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGRNs.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-10 text-slate-400">
                        {grnLoading ? "Loading…" : "No goods receipts match the filters."}
                      </td>
                    </tr>
                  ) : (
                    filteredGRNs.map((g, idx) => {
                      const st = receiptStatus(g);
                      return (
                        <tr key={g.id}>
                          <td className="text-center font-mono text-slate-600">{idx + 1}</td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <button type="button" onClick={() => setViewGRN(g)} className={iconBtn} title="View" aria-label={`View ${g.grnNumber}`}>
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => setPrintGRN(g)} className={iconBtn} title="Print" aria-label={`Print ${g.grnNumber}`}>
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!eligibleIds.has(g.id)}
                                onClick={() => openReturn(g)}
                                className={`${iconBtn} hover:bg-amber-100 hover:text-amber-800`}
                                title="Return goods to supplier"
                                aria-label={`Return goods from ${g.grnNumber}`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={g.status !== "RECEIVED"}
                                onClick={() => {
                                  setCancelGRN(g);
                                  setComment("");
                                }}
                                className={`${iconBtn} hover:bg-rose-100 hover:text-rose-700`}
                                title="Cancel receipt"
                                aria-label={`Cancel ${g.grnNumber}`}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td>{g.receiptDate}</td>
                          <td>
                            <button type="button" onClick={() => setViewGRN(g)} className="font-mono text-sky-700 font-semibold hover:underline">
                              {g.grnNumber}
                            </button>
                          </td>
                          <td className="font-mono text-[11px]">{g.poNumber}</td>
                          <td className="font-mono text-[11px]">{g.challanNumber || "—"}</td>
                          <td>{g.warehouseName}</td>
                          <td className="font-medium text-slate-900">{g.supplierName}</td>
                          <td className="text-right font-mono">{qtyFmt(g.items.reduce((s, it) => s + it.currentReceivedQuantity, 0))}</td>
                          <td className="text-right font-mono text-rose-600">{qtyFmt(g.items.reduce((s, it) => s + it.rejectedDamagedQuantity, 0))}</td>
                          <td className="text-right font-mono font-bold">{formatCurrency(g.totalReceivedAmount)}</td>
                          <td>{g.preparedBy}</td>
                          <td className={`text-center text-[11px] font-semibold ${st.cls}`}>{st.text}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE AGAINST PO */}
      <ModalDialog
        isOpen={Boolean(receiveForm)}
        onClose={() => !receiveMutation.isPending && setReceiveForm(null)}
        title={`Receive Goods — ${receiveForm?.po.poNumber ?? ""}`}
        subtitle={`${receiveForm?.po.supplierName ?? ""} → ${receiveForm?.po.warehouseName ?? ""}`}
        maxWidth="4xl"
      >
        {receiveForm && (
          <form onSubmit={submitReceive} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Receive Date *</span>
                <input type="date" required min={receiveForm.po.orderDate} value={receiveForm.receiptDate} onChange={(e) => setReceiveForm({ ...receiveForm, receiptDate: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Supplier Challan No</span>
                <input type="text" maxLength={100} value={receiveForm.challanNumber} onChange={(e) => setReceiveForm({ ...receiveForm, challanNumber: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Gate Pass / Delivery Note</span>
                <input type="text" maxLength={100} value={receiveForm.gatePassNumber} onChange={(e) => setReceiveForm({ ...receiveForm, gatePassNumber: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">VAT Challan (Mushak) No</span>
                <input type="text" maxLength={100} value={receiveForm.vatChallanNumber} onChange={(e) => setReceiveForm({ ...receiveForm, vatChallanNumber: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Supplier Invoice No</span>
                <input type="text" maxLength={100} value={receiveForm.supplierInvoiceNumber} onChange={(e) => setReceiveForm({ ...receiveForm, supplierInvoiceNumber: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Remarks</span>
                <input type="text" maxLength={500} value={receiveForm.remarks} onChange={(e) => setReceiveForm({ ...receiveForm, remarks: e.target.value })} className={inputCls} />
              </label>
            </div>
            <div className="border border-slate-200 rounded overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-right">Ordered</th>
                    <th className="p-2 text-right">Received Before</th>
                    <th className="p-2 text-right">Due</th>
                    <th className="p-2 w-24">Receive Now</th>
                    <th className="p-2 w-24">Rejected</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Accepted Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receiveForm.lines.map((l, idx) => {
                    const err = lineError(l);
                    return (
                      <tr key={l.poItemId || idx} className={err ? "bg-rose-50" : ""}>
                        <td className="p-2">
                          <div className="font-semibold text-slate-900">{l.itemName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{l.itemCode} · {l.uom}</div>
                          {err && <div className="text-[10px] text-rose-600 font-semibold">{err}</div>}
                        </td>
                        <td className="p-2 text-right font-mono">{qtyFmt(l.orderedQuantity)}</td>
                        <td className="p-2 text-right font-mono text-slate-500">{qtyFmt(l.previouslyReceivedQuantity)}</td>
                        <td className="p-2 text-right font-mono font-bold text-amber-700">{qtyFmt(l.outstanding)}</td>
                        <td className="p-2">
                          <input type="number" min="0" step="any" aria-label={`Receive quantity for ${l.itemName}`} value={l.received} onChange={(e) => patchReceiveLine(idx, { received: Number(e.target.value) })} className={`${inputCls} font-mono`} />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" step="any" aria-label={`Rejected quantity for ${l.itemName}`} value={l.rejected} onChange={(e) => patchReceiveLine(idx, { rejected: Number(e.target.value) })} className={`${inputCls} font-mono`} />
                        </td>
                        <td className="p-2 text-right font-mono">{formatCurrency(l.rate)}</td>
                        <td className="p-2 text-right font-mono font-bold">{formatCurrency(Math.max(0, l.received - l.rejected) * l.rate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500">Only accepted quantity (received − rejected) goes into stock and is owed to the supplier.</p>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t">
              <span className="font-semibold text-slate-700">
                Accepted value: <span className="font-mono text-sky-800 text-sm">{formatCurrency(receiveTotal)}</span>
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setReceiveForm(null)} disabled={receiveMutation.isPending} className={btnGhost}>
                  Cancel
                </button>
                <button type="submit" disabled={receiveMutation.isPending} className={btnPrimary}>
                  {receiveMutation.isPending ? <Spinner className="size-3.5" /> : <Truck className="w-3.5 h-3.5" />} Post Goods Receipt
                </button>
              </div>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* DIRECT RECEIVE */}
      <ModalDialog isOpen={directOpen} onClose={() => !receiveMutation.isPending && setDirectOpen(false)} title="Direct Goods Receive (without PO)" subtitle="A purchase order is created for the receipt automatically" maxWidth="4xl">
        <form onSubmit={submitDirect} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="block">
              <span className="block text-slate-600 font-medium mb-1">Supplier *</span>
              <select value={dirSupplierId} onChange={(e) => setDirSupplierId(e.target.value)} className={inputCls} required>
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-slate-600 font-medium mb-1">Warehouse *</span>
              <select value={dirWarehouseId} onChange={(e) => setDirWarehouseId(e.target.value)} className={inputCls} required>
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-slate-600 font-medium mb-1">Receive Date *</span>
              <input type="date" required value={dirDate} onChange={(e) => setDirDate(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-slate-600 font-medium mb-1">Challan No</span>
              <input type="text" maxLength={100} value={dirChallan} onChange={(e) => setDirChallan(e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => setDirLines([...dirLines, { key: ++lineKey, itemId: "", qty: 1, unitPrice: 0 }])} className="h-8 px-3 border border-blue-300 text-blue-700 rounded hover:bg-blue-50 font-semibold inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>
          <div className="border border-slate-200 rounded overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                <tr>
                  <th className="p-2">Item *</th>
                  <th className="p-2 w-16">UoM</th>
                  <th className="p-2 w-24">Qty *</th>
                  <th className="p-2 w-28">Unit Price</th>
                  <th className="p-2 w-28 text-right">Amount</th>
                  <th className="p-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dirLines.map((l, idx) => (
                  <tr key={l.key}>
                    <td className="p-2">
                      <select
                        value={l.itemId}
                        aria-label={`Item for line ${idx + 1}`}
                        onChange={(e) => {
                          const it = items.find((i) => i.id === e.target.value);
                          setDirLines(dirLines.map((x) => (x.key === l.key ? { ...x, itemId: e.target.value, unitPrice: x.unitPrice || it?.standardPrice || 0 } : x)));
                        }}
                        className={inputCls}
                      >
                        <option value="">Select item</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.code} — {i.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 font-mono text-slate-600">{items.find((i) => i.id === l.itemId)?.uom ?? "—"}</td>
                    <td className="p-2">
                      <input type="number" min="0.001" step="any" aria-label={`Quantity for line ${idx + 1}`} value={l.qty} onChange={(e) => setDirLines(dirLines.map((x) => (x.key === l.key ? { ...x, qty: Number(e.target.value) } : x)))} className={`${inputCls} font-mono`} />
                    </td>
                    <td className="p-2">
                      <input type="number" min="0" step="any" aria-label={`Unit price for line ${idx + 1}`} value={l.unitPrice} onChange={(e) => setDirLines(dirLines.map((x) => (x.key === l.key ? { ...x, unitPrice: Number(e.target.value) } : x)))} className={`${inputCls} font-mono`} />
                    </td>
                    <td className="p-2 text-right font-mono font-bold">{formatCurrency(l.qty * l.unitPrice)}</td>
                    <td className="p-2 text-center">
                      <button type="button" disabled={dirLines.length === 1} onClick={() => setDirLines(dirLines.filter((x) => x.key !== l.key))} className={`${iconBtn} hover:bg-rose-100 hover:text-rose-700`} aria-label={`Remove line ${idx + 1}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t">
            <span className="font-semibold text-slate-700">
              Total: <span className="font-mono text-sky-800 text-sm">{formatCurrency(directTotal)}</span>
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDirectOpen(false)} disabled={receiveMutation.isPending} className={btnGhost}>
                Cancel
              </button>
              <button type="submit" disabled={receiveMutation.isPending} className={btnPrimary}>
                {receiveMutation.isPending ? <Spinner className="size-3.5" /> : <Truck className="w-3.5 h-3.5" />} Post Direct Receipt
              </button>
            </div>
          </div>
        </form>
      </ModalDialog>

      {/* VIEW GRN */}
      <ModalDialog isOpen={Boolean(viewGRN)} onClose={() => setViewGRN(null)} title={`Goods Receipt ${viewGRN?.grnNumber ?? ""}`} subtitle={`${viewGRN?.supplierName ?? ""} · ${viewGRN?.receiptDate ?? ""}`} maxWidth="2xl">
        {viewGRN && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Documents</span>
                <p className="text-slate-700">PO: <span className="font-mono">{viewGRN.poNumber}</span></p>
                <p className="text-slate-700">Challan: {viewGRN.challanNumber || "—"}</p>
                <p className="text-slate-700">Gate pass: {viewGRN.gatePassNumber || "—"}</p>
                <p className="text-slate-700">Supplier invoice: {viewGRN.supplierInvoiceNumber || "—"}</p>
                <p className="text-slate-700">VAT challan: {viewGRN.vatChallanNumber || "—"}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Received Into</span>
                <p className="font-bold text-slate-900">{viewGRN.warehouseName}</p>
                <p className="text-slate-600">{viewGRN.officeName} · by {viewGRN.preparedBy}</p>
                <p className={`font-semibold ${receiptStatus(viewGRN).cls}`}>{receiptStatus(viewGRN).text}</p>
              </div>
            </div>
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-100 font-semibold">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Received</th>
                  <th className="p-2 text-right">Rejected</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewGRN.items.map((it) => (
                  <tr key={it.id}>
                    <td className="p-2">
                      <div className="font-semibold">{it.itemName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{it.itemCode} · {it.uom}</div>
                    </td>
                    <td className="p-2 text-right font-mono">{qtyFmt(it.currentReceivedQuantity)}</td>
                    <td className="p-2 text-right font-mono text-rose-600">{qtyFmt(it.rejectedDamagedQuantity)}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                    <td className="p-2 text-right font-mono font-bold">{formatCurrency(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewGRN.remarks && <p className="text-slate-600 whitespace-pre-line">Remarks: {viewGRN.remarks}</p>}
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200">
              <span className="font-semibold text-slate-700">Total accepted value</span>
              <span className="text-base font-bold font-mono text-sky-800">{formatCurrency(viewGRN.totalReceivedAmount)}</span>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setViewGRN(null)} className={btnGhost}>
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintGRN(viewGRN);
                  setViewGRN(null);
                }}
                className={btnPrimary}
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* PRINT GRN */}
      <ModalDialog isOpen={Boolean(printGRN)} onClose={() => setPrintGRN(null)} title="Goods Receipt Note — Print Preview" maxWidth="4xl">
        {printGRN && (
          <div className="space-y-4 text-xs">
            <div className="bg-white p-6 border border-slate-200 rounded text-slate-800 space-y-4 print:p-0 print:border-none">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3.5">
                  <Image src="/logo.png" width={8452} height={1738} alt="Company logo" className="h-10 w-auto object-contain" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">{context?.company?.name ?? ""}</h2>
                    <p className="text-slate-500 text-[11px]">{printGRN.officeName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-2.5 py-1 bg-slate-100 rounded text-[11px] font-bold text-slate-700 border border-slate-300">GOODS RECEIPT NOTE</div>
                  <div className="text-sm font-bold text-sky-800 font-mono mt-1">{printGRN.grnNumber}</div>
                  <div className="text-[11px] text-slate-500">Date: {printGRN.receiptDate}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-1 uppercase text-[10px]">Supplier</span>
                  <div className="font-bold text-slate-900 text-sm">{printGRN.supplierName}</div>
                  <div className="text-slate-500 text-[11px]">PO: {printGRN.poNumber} · Challan: {printGRN.challanNumber || "—"}</div>
                  <div className="text-slate-500 text-[11px]">
                    Invoice: {printGRN.supplierInvoiceNumber || "—"} · VAT challan: {printGRN.vatChallanNumber || "—"}
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-1 uppercase text-[10px]">Received Into</span>
                  <div className="font-bold text-slate-900 text-sm">{printGRN.warehouseName}</div>
                  <div className="text-slate-500 text-[11px]">Received by: {printGRN.preparedBy}</div>
                </div>
              </div>
              <table className="w-full text-left border border-slate-200">
                <thead className="bg-slate-100 font-semibold">
                  <tr>
                    <th className="p-2">SL</th>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-right">Ordered</th>
                    <th className="p-2 text-right">Received</th>
                    <th className="p-2 text-right">Rejected</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {printGRN.items.map((it, i) => (
                    <tr key={it.id}>
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2">{it.itemCode} — {it.itemName} ({it.uom})</td>
                      <td className="p-2 text-right font-mono">{qtyFmt(it.orderedQuantity)}</td>
                      <td className="p-2 text-right font-mono">{qtyFmt(it.currentReceivedQuantity)}</td>
                      <td className="p-2 text-right font-mono">{qtyFmt(it.rejectedDamagedQuantity)}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right font-mono font-bold">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end font-bold text-sm">
                Total: <span className="font-mono text-sky-800 ml-2">{formatCurrency(printGRN.totalReceivedAmount)}</span>
              </div>
              <div className="grid grid-cols-3 gap-6 pt-12 text-center text-slate-600">
                <div className="border-t border-slate-300 pt-1.5 font-medium">Received By</div>
                <div className="border-t border-slate-300 pt-1.5 font-medium">Quality Checked By</div>
                <div className="border-t border-slate-300 pt-1.5 font-medium">Store In-charge</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 print:hidden">
              <button type="button" onClick={() => setPrintGRN(null)} className={btnGhost}>
                Close
              </button>
              <button type="button" onClick={() => window.print()} className={btnPrimary}>
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* CLOSE PO BALANCE */}
      <ModalDialog isOpen={Boolean(closePO)} onClose={() => !closeMutation.isPending && setClosePO(null)} title="Close Remaining PO Balance" subtitle={closePO?.poNumber} maxWidth="md">
        {closePO && (
          <form
            className="space-y-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              closeMutation.mutate({ id: closePO.id, comments: comment });
            }}
          >
            <p className="text-slate-600">
              Stop receiving against <span className="font-mono font-bold">{closePO.poNumber}</span>. The outstanding{" "}
              {qtyFmt(closePO.items.reduce((s, it) => s + it.outstandingQuantity, 0))} units will not be received.
            </p>
            <label className="block">
              <span className="block text-slate-700 font-semibold mb-1">Reason *</span>
              <textarea required maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs h-20" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setClosePO(null)} disabled={closeMutation.isPending} className={btnGhost}>
                Back
              </button>
              <button type="submit" disabled={closeMutation.isPending} className="h-9 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded font-semibold inline-flex items-center gap-1.5">
                {closeMutation.isPending && <Spinner className="size-3.5" />} Close Balance
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* CANCEL GRN */}
      <ModalDialog isOpen={Boolean(cancelGRN)} onClose={() => !cancelMutation.isPending && setCancelGRN(null)} title="Cancel Goods Receipt" subtitle={cancelGRN?.grnNumber} maxWidth="md">
        {cancelGRN && (
          <form
            className="space-y-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              cancelMutation.mutate({ id: cancelGRN.id, comments: comment });
            }}
          >
            <p className="text-slate-600">
              The received goods leave {cancelGRN.warehouseName} again, the order is re-opened for receiving and {formatCurrency(cancelGRN.totalReceivedAmount)} is taken off the supplier balance. Not allowed if
              the stock was already used, or a return, bill or payment exists for this receipt.
            </p>
            <label className="block">
              <span className="block text-slate-700 font-semibold mb-1">Reason *</span>
              <textarea required maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs h-20" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelGRN(null)} disabled={cancelMutation.isPending} className={btnGhost}>
                Back
              </button>
              <button type="submit" disabled={cancelMutation.isPending} className="h-9 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded font-semibold inline-flex items-center gap-1.5">
                {cancelMutation.isPending && <Spinner className="size-3.5" />} Cancel Receipt
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* RETURN FROM GRN */}
      <ModalDialog isOpen={Boolean(returnGRN)} onClose={() => !returnMutation.isPending && setReturnGRN(null)} title="Return Goods to Supplier" subtitle={`${returnGRN?.grnNumber ?? ""} · ${returnGRN?.supplierName ?? ""}`} maxWidth="2xl">
        {returnGRN && (
          <form onSubmit={submitReturn} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Return Date *</span>
                <input type="date" required min={returnGRN.receiptDate} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Reason *</span>
                <input type="text" required maxLength={300} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Damaged, wrong specification, expired…" className={inputCls} />
              </label>
            </div>
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-100 font-semibold">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Returnable</th>
                  <th className="p-2 w-28">Return Qty</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returnLines.map((l, idx) => (
                  <tr key={`${l.itemId}-${idx}`} className={l.qty > l.available + 1e-9 ? "bg-rose-50" : ""}>
                    <td className="p-2">{l.itemCode} — {l.itemName}</td>
                    <td className="p-2 text-right font-mono">{qtyFmt(l.available)} {l.uom}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        max={l.available}
                        step="any"
                        aria-label={`Return quantity for ${l.itemName}`}
                        value={l.qty}
                        onChange={(e) => setReturnLines(returnLines.map((x, i) => (i === idx ? { ...x, qty: Number(e.target.value) } : x)))}
                        className={`${inputCls} font-mono`}
                      />
                    </td>
                    <td className="p-2 text-right font-mono">{formatCurrency(l.qty * l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t">
              <span className="font-semibold">
                Credit: <span className="font-mono text-sky-800">{formatCurrency(returnTotal)}</span>
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setReturnLines(returnLines.map((l) => ({ ...l, qty: l.available })))} className={btnGhost}>
                  Return All
                </button>
                <button type="button" onClick={() => setReturnGRN(null)} disabled={returnMutation.isPending} className={btnGhost}>
                  Cancel
                </button>
                <button type="submit" disabled={returnMutation.isPending} className={btnPrimary}>
                  {returnMutation.isPending && <Spinner className="size-3.5" />} Post Return
                </button>
              </div>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
}
