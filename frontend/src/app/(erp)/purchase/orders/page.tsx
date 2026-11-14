"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Eye, Pencil, Plus, Printer, RotateCcw, Search, Trash2, X } from "lucide-react";
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
import { orderTotals, priceLine } from "@/lib/purchase-store/rules";
import { PURCHASE_QUERY_KEYS, downloadCsv } from "@/features/purchase/lib/client";
import { usePurchasePermissions } from "@/features/purchase/lib/usePurchasePermissions";
import type { Item, Office, PurchaseOrder, PurchaseRequisition, Supplier, Warehouse } from "@bridgeone/contracts";

type Tab = "LOCAL_PO" | "REQUISITION_SUMMARY" | "PURCHASE_METHOD";
type Order = PurchaseOrder & { isClosed?: boolean; notes?: string };

interface SummaryRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  subCategory: string;
  uom: string;
  quantity: number;
  requisitions: number;
  currentStock: number;
}

interface FormLine {
  key: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  orderedQuantity: number;
  unitPrice: number;
  discountPercentage: number;
  taxPercentage: number;
}

interface OrderForm {
  editId: string | null;
  requisitionId: string;
  supplierId: string;
  officeId: string;
  warehouseId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  referenceNumber: string;
  projectCostCenter: string;
  paymentTerms: string;
  deliveryTerms: string;
  shippingFee: number;
  notes: string;
  lines: FormLine[];
}

const METHOD_LABEL: Record<string, string> = {
  DIRECT: "Purchase Order Method",
  QUOTATION: "Quotation Method",
  TENDER: "Tender Method",
  CONTRACT: "Contract / Rate Agreement",
};

let lineKey = 0;
const newLine = (partial: Partial<FormLine> = {}): FormLine => ({
  key: ++lineKey,
  itemId: "",
  itemCode: "",
  itemName: "",
  uom: "",
  orderedQuantity: 1,
  unitPrice: 0,
  discountPercentage: 0,
  taxPercentage: 0,
  ...partial,
});

const inputCls =
  "w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500";
const btnPrimary =
  "h-9 px-4 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs rounded inline-flex items-center justify-center gap-1.5 shadow-xs transition";
const btnGhost = "h-9 px-4 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 text-xs font-semibold";
const iconBtn = "inline-flex items-center justify-center size-5.5 rounded hover:bg-slate-200 text-slate-700 transition disabled:opacity-30 disabled:hover:bg-transparent";

function formatEta(dateStr?: string) {
  if (!dateStr) return "—";
  const dt = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return `00.00h (${dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })})`;
}

function statusLabel(po: Order) {
  if (po.isClosed) return { text: "Closed", cls: "text-slate-600" };
  switch (po.status) {
    case "PENDING_APPROVAL":
      return { text: "Pending Approval", cls: "text-amber-600" };
    case "APPROVED":
      return { text: "Approved", cls: "text-sky-700" };
    case "PARTIALLY_RECEIVED":
      return { text: "Partially Received", cls: "text-purple-700" };
    case "COMPLETED":
      return { text: "Received", cls: "text-emerald-700" };
    case "CANCELLED":
      return { text: "Cancelled", cls: "text-rose-600" };
    default:
      return { text: po.status, cls: "text-slate-600" };
  }
}

const anyReceived = (po: Order) => po.items.some((i) => i.receivedQuantity > 0);
const canEdit = (po: Order) => !po.isClosed && (po.status === "APPROVED" || po.status === "PENDING_APPROVAL" || po.status === "DRAFT") && !anyReceived(po);
const canCloseOrCancel = (po: Order) => !po.isClosed && (po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED" || po.status === "PENDING_APPROVAL" || po.status === "DRAFT");
const canReverse = (po: Order) => Boolean(po.isClosed) || (po.status === "APPROVED" && !anyReceived(po));

function Pager({ total, page, size, onPage, onSize }: { total: number; page: number; size: number; onPage: (p: number) => void; onSize: (s: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(total, page * size);
  return (
    <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-6 text-xs text-slate-600">
      <label className="flex items-center gap-1.5">
        <span>Rows per page:</span>
        <select value={size} onChange={(e) => onSize(Number(e.target.value))} className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white">
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <span>
        {from}-{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={iconBtn}>
          &lt;
        </button>
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className={iconBtn}>
          &gt;
        </button>
      </div>
    </div>
  );
}

function usePaging<T>(rows: T[]) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  return {
    slice: rows.slice((current - 1) * size, current * size),
    offset: (current - 1) * size,
    pager: <Pager total={rows.length} page={current} size={size} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />,
  };
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("LOCAL_PO");
  const [search, setSearch] = useState("");

  // Local PO filters
  const [officeFilter, setOfficeFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createdByFilter, setCreatedByFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Requisition summary filters
  const [sumOffice, setSumOffice] = useState("ALL");
  const [sumFrom, setSumFrom] = useState("");
  const [sumTo, setSumTo] = useState("");

  // Purchase method filters
  const [pmOffice, setPmOffice] = useState("ALL");
  const [pmWarehouse, setPmWarehouse] = useState("ALL");
  const [pmBuyerName, setPmBuyerName] = useState("");
  const [pmBuyerOffice, setPmBuyerOffice] = useState("ALL");
  const [pmReqType, setPmReqType] = useState("ALL");
  const [pmFrom, setPmFrom] = useState("");
  const [pmTo, setPmTo] = useState("");

  // Dialogs
  const [form, setForm] = useState<OrderForm | null>(null);
  const [viewPO, setViewPO] = useState<Order | null>(null);
  const [printPO, setPrintPO] = useState<Order | null>(null);
  const [actionPO, setActionPO] = useState<{ po: Order; action: "close" | "cancel" | "reverse" | "approve" } | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [viewReq, setViewReq] = useState<PurchaseRequisition | null>(null);

  // Master data & permissions
  const perms = usePurchasePermissions();
  const { data: offices = [] } = useQuery<Office[]>({ queryKey: ["offices"], queryFn: () => fetchApi("/master/offices") });
  const { data: warehouses = [] } = useQuery<Warehouse[]>({ queryKey: ["warehouses", "ALL"], queryFn: () => fetchApi("/master/warehouses") });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => fetchApi("/master/suppliers") });
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["items"], queryFn: () => fetchApi("/master/items") });
  const { data: context } = useQuery<PrintHeaderContext>({ queryKey: ["context"], queryFn: () => fetchApi("/master/context") });

  const { data: orders = [], isFetching: ordersLoading, refetch } = useQuery<Order[]>({
    queryKey: ["purchaseOrders", officeFilter, supplierFilter, statusFilter, fromDate, toDate],
    queryFn: () => {
      const p = new URLSearchParams();
      if (officeFilter !== "ALL") p.set("officeId", officeFilter);
      if (supplierFilter !== "ALL") p.set("supplierId", supplierFilter);
      if (statusFilter !== "ALL") p.set("status", statusFilter);
      if (fromDate) p.set("fromDate", fromDate);
      if (toDate) p.set("toDate", toDate);
      return fetchApi(`/purchase/orders?${p.toString()}`);
    },
  });
  const { data: approvedReqs = [], isFetching: approvedReqsLoading } = useQuery<PurchaseRequisition[]>({
    queryKey: ["approvedReqs"],
    queryFn: () => fetchApi("/purchase/requisitions?status=APPROVED"),
  });
  const { data: summary = [], isFetching: summaryLoading } = useQuery<SummaryRow[]>({
    queryKey: ["requisitionSummary", sumOffice, sumFrom, sumTo],
    enabled: activeTab === "REQUISITION_SUMMARY",
    queryFn: () => {
      const p = new URLSearchParams();
      if (sumOffice !== "ALL") p.set("officeId", sumOffice);
      if (sumFrom) p.set("fromDate", sumFrom);
      if (sumTo) p.set("toDate", sumTo);
      return fetchApi(`/purchase/requisitions/summary?${p.toString()}`);
    },
  });

  const officeName = (id: string) => offices.find((o) => o.id === id)?.name ?? "";
  const warehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "";

  // ---------------------------------------------------------------
  // Derived lists
  // ---------------------------------------------------------------
  const creators = useMemo(() => [...new Set(orders.map((o) => o.createdBy))].sort(), [orders]);
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (createdByFilter !== "ALL" && o.createdBy !== createdByFilter) return false;
      if (!q) return true;
      return [o.poNumber, o.supplierName, o.officeName, o.createdBy, o.referenceNumber ?? "", o.requisitionNumber ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [orders, search, createdByFilter]);

  const filteredSummary = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summary.filter((r) => !q || [r.itemCode, r.itemName, r.category, r.subCategory].some((v) => v.toLowerCase().includes(q)));
  }, [summary, search]);

  const methodReqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const buyerQ = pmBuyerName.trim().toLowerCase();
    return approvedReqs.filter((r) => {
      if (pmOffice !== "ALL" && r.officeId !== pmOffice) return false;
      if (pmWarehouse !== "ALL" && r.warehouseId !== pmWarehouse) return false;
      if (pmBuyerOffice !== "ALL" && r.officeId !== pmBuyerOffice) return false;
      if (buyerQ && ![r.requesterName, r.createdBy].some((v) => v.toLowerCase().includes(buyerQ))) return false;
      if (pmReqType !== "ALL" && r.requestType !== pmReqType) return false;
      if (pmFrom && r.requestDate < pmFrom) return false;
      if (pmTo && r.requestDate > pmTo) return false;
      if (q && ![r.requisitionNumber, r.requesterName, r.department, r.remarks ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [approvedReqs, pmOffice, pmWarehouse, pmBuyerName, pmBuyerOffice, pmReqType, pmFrom, pmTo, search]);

  const ordersPage = usePaging(filteredOrders);
  const summaryPage = usePaging(filteredSummary);
  const methodPage = usePaging(methodReqs);

  // ---------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------
  const invalidate = () => {
    for (const key of PURCHASE_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };

  const saveMutation = useMutation({
    mutationFn: (f: OrderForm) => {
      const payload = {
        companyId: "comp-bridgeone-01",
        requisitionId: f.requisitionId || undefined,
        supplierId: f.supplierId,
        officeId: f.officeId,
        warehouseId: f.warehouseId,
        orderDate: f.orderDate,
        expectedDeliveryDate: f.expectedDeliveryDate,
        referenceNumber: f.referenceNumber || undefined,
        projectCostCenter: f.projectCostCenter || undefined,
        paymentTerms: f.paymentTerms,
        deliveryTerms: f.deliveryTerms,
        shippingFee: Number(f.shippingFee) || 0,
        notes: f.notes || undefined,
        items: f.lines.map((l) => ({
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          orderedQuantity: Number(l.orderedQuantity),
          unitPrice: Number(l.unitPrice),
          discountPercentage: Number(l.discountPercentage) || 0,
          taxPercentage: Number(l.taxPercentage) || 0,
          lineTotal: priceLine(Number(l.orderedQuantity), Number(l.unitPrice), Number(l.discountPercentage), Number(l.taxPercentage)).lineTotal,
        })),
      };
      return f.editId
        ? fetchApi<Order>(`/purchase/orders/${f.editId}`, { method: "PUT", body: JSON.stringify(payload) })
        : fetchApi<Order>("/purchase/orders", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: (po, f) => {
      invalidate();
      setForm(null);
      toast.success(f.editId ? `Purchase order ${po.poNumber} updated.` : `Purchase order ${po.poNumber} issued to ${po.supplierName}.`, {
        title: f.editId ? "Order Updated" : "Order Created",
      });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Purchase Order" }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, comments }: { id: string; action: string; comments: string }) =>
      fetchApi<Order>(`/purchase/orders/${id}/${action}`, { method: "POST", body: JSON.stringify({ comments }) }),
    onSuccess: (po, vars) => {
      invalidate();
      setActionPO(null);
      const verb = { close: "closed", cancel: "cancelled", reverse: "reversed", approve: "approved" }[vars.action] ?? "updated";
      toast.success(`Purchase order ${po.poNumber} ${verb}.`, { title: "Order Updated" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Order Action Failed" }),
  });

  const methodMutation = useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) =>
      fetchApi<PurchaseRequisition>(`/purchase/requisitions/${id}/method`, { method: "POST", body: JSON.stringify({ purchaseMethod: method }) }),
    onSuccess: (req) => {
      queryClient.invalidateQueries({ queryKey: ["approvedReqs"] });
      toast.success(`${req.requisitionNumber}: ${METHOD_LABEL[req.purchaseMethod] ?? req.purchaseMethod}.`, { title: "Purchase Method Saved" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Purchase Method" }),
  });

  // ---------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------
  const openCreate = (req?: PurchaseRequisition) => {
    router.push(req ? `/purchase/orders/create?requisitionId=${req.id}` : "/purchase/orders/create");
  };

  const openEdit = (po: Order) =>
    setForm({
      editId: po.id,
      requisitionId: po.requisitionId ?? "",
      supplierId: po.supplierId,
      officeId: po.officeId,
      warehouseId: po.warehouseId,
      orderDate: po.orderDate,
      expectedDeliveryDate: po.expectedDeliveryDate,
      referenceNumber: po.referenceNumber ?? "",
      projectCostCenter: po.projectCostCenter ?? "",
      paymentTerms: po.paymentTerms,
      deliveryTerms: po.deliveryTerms,
      shippingFee: po.shippingFee,
      notes: po.notes ?? "",
      lines: po.items.map((i) =>
        newLine({
          itemId: i.itemId,
          itemCode: i.itemCode,
          itemName: i.itemName,
          uom: i.uom,
          orderedQuantity: i.orderedQuantity,
          unitPrice: i.unitPrice,
          discountPercentage: i.discountPercentage,
          taxPercentage: i.taxPercentage,
        }),
      ),
    });

  const patchForm = (patch: Partial<OrderForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const patchLine = (key: number, patch: Partial<FormLine>) =>
    setForm((f) => (f ? { ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) } : f));

  const selectRequisition = (reqId: string) => {
    const req = approvedReqs.find((r) => r.id === reqId);
    if (!req) {
      patchForm({ requisitionId: "" });
      return;
    }
    patchForm({
      requisitionId: req.id,
      officeId: req.officeId,
      warehouseId: req.warehouseId,
      lines: req.items.map((i) => newLine({ itemId: i.itemId, itemCode: i.itemCode, itemName: i.itemName, uom: i.uom, orderedQuantity: i.quantity, unitPrice: i.estimatedUnitPrice })),
    });
  };

  const pricedLines = form?.lines.map((l) => priceLine(Number(l.orderedQuantity) || 0, Number(l.unitPrice) || 0, Number(l.discountPercentage) || 0, Number(l.taxPercentage) || 0)) ?? [];
  const totals = orderTotals(pricedLines, Number(form?.shippingFee) || 0);
  const formWarehouses = warehouses.filter((w) => !form?.officeId || w.officeId === form.officeId);

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.supplierId) return toast.error("Select the supplier.", { title: "Purchase Order" });
    if (!form.warehouseId) return toast.error("Select the receiving warehouse.", { title: "Purchase Order" });
    const bad = form.lines.findIndex((l) => !l.itemId || !(Number(l.orderedQuantity) > 0));
    if (bad >= 0) return toast.error(`Line ${bad + 1}: select an item and enter a quantity.`, { title: "Purchase Order" });
    saveMutation.mutate(form);
  };

  // ---------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------
  const handleExport = () => {
    if (activeTab === "LOCAL_PO") {
      downloadCsv(
        "purchase_orders.csv",
        ["SL", "PO Date", "Recr. Date", "Reference No", "PO No", "Office", "Project/Outlet/Ref.", "Supplier", "Created By", "Amount (BDT)", "ETA Estimated Time of Arrival", "Status", "Review Comment"],
        filteredOrders.map((o, i) => [
          i + 1,
          o.orderDate,
          o.expectedDeliveryDate,
          o.referenceNumber ?? "N/A",
          o.poNumber,
          o.officeName,
          o.projectCostCenter ?? "",
          o.supplierName,
          o.createdBy,
          o.totalAmount,
          o.expectedDeliveryDate,
          statusLabel(o).text,
          o.approvalHistory?.[o.approvalHistory.length - 1]?.comments ?? "",
        ]),
      );
    } else if (activeTab === "REQUISITION_SUMMARY") {
      downloadCsv(
        "requisition_summary.csv",
        ["SL", "Item Code", "Item Name", "Category", "Sub-Category", "UoM", "Quantity", "Current Stock"],
        filteredSummary.map((r, i) => [i + 1, r.itemCode, r.itemName, r.category, r.subCategory, r.uom, r.quantity, r.currentStock]),
      );
    } else {
      downloadCsv(
        "purchase_method.csv",
        ["SL", "Requisition Code", "Date", "User Type", "User", "Buyer Name", "Buyer Office", "Method", "Budget", "Created By", "Remarks", "Status"],
        methodReqs.map((r, i) => [
          i + 1,
          r.requisitionNumber,
          r.requestDate,
          r.department ? "Department" : "Employee",
          r.department || r.requesterName,
          r.requesterName || "N/A",
          officeName(r.officeId) || "N/A",
          METHOD_LABEL[r.purchaseMethod] ?? r.purchaseMethod,
          r.totalEstimatedAmount,
          r.createdBy,
          r.remarks ?? "",
          r.status === "APPROVED" ? "Approved" : r.status,
        ]),
      );
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "LOCAL_PO", label: "LOCAL PO" },
    { id: "REQUISITION_SUMMARY", label: "REQUISITION SUMMARY" },
    { id: "PURCHASE_METHOD", label: "PURCHASE METHOD" },
  ];

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Order</h1>
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
          {perms.orders.export && (
            <button type="button" onClick={handleExport} className={btnPrimary} title="Download Excel (CSV)">
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          )}
          {activeTab === "LOCAL_PO" && perms.orders.create && (
            <button type="button" onClick={() => openCreate()} className={btnPrimary}>
              <Plus className="w-4 h-4" />
              <span>Create Local Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex items-center gap-8 border-b border-slate-200 bg-white px-3 pt-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`pb-2.5 pt-2 text-xs font-bold tracking-wide border-b-2 whitespace-nowrap transition ${
              activeTab === t.id ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: LOCAL PO */}
      {activeTab === "LOCAL_PO" && (
        <div className="space-y-3">
          <div className="bg-white rounded border border-slate-200/90 p-3.5 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Office</span>
                <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">All Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Filter By</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PARTIALLY_RECEIVED">Partially Received</option>
                  <option value="COMPLETED">Received / Closed</option>
                  <option value="CLOSED">Closed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Created By</span>
                <select value={createdByFilter} onChange={(e) => setCreatedByFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">Anyone</option>
                  {creators.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Select Supplier</span>
                <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">Select/Search Supplier (All)</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
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
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => refetch()} disabled={ordersLoading} className={btnPrimary}>
                {ordersLoading && <Spinner className="size-3.5" />}
                VIEW
              </button>
              {(officeFilter !== "ALL" || supplierFilter !== "ALL" || statusFilter !== "ALL" || createdByFilter !== "ALL" || fromDate || toDate || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setOfficeFilter("ALL");
                    setSupplierFilter("ALL");
                    setStatusFilter("ALL");
                    setCreatedByFilter("ALL");
                    setFromDate("");
                    setToDate("");
                    setSearch("");
                  }}
                  className="h-9 px-2 text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="erp-table-container">
              <table className="erp-table erp-table-compact">
                <thead>
                  <tr>
                    <th className="w-7 text-center whitespace-nowrap">SL</th>
                    <th className="w-[125px] min-w-[120px] text-center whitespace-nowrap">Actions</th>
                    <th className="whitespace-nowrap">PO Date</th>
                    <th className="whitespace-nowrap">Recr. Date</th>
                    <th className="text-center">Reference No</th>
                    <th className="whitespace-nowrap">PO No</th>
                    <th>Office</th>
                    <th>Project / Ref.</th>
                    <th>Supplier</th>
                    <th>Created By</th>
                    <th className="text-right whitespace-nowrap">Amount (BDT)</th>
                    <th className="text-center leading-tight">ETA / Arrival</th>
                    <th className="text-center whitespace-nowrap">Status</th>
                    <th className="max-w-[120px] text-center">Review Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersPage.slice.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="text-center py-10 text-slate-400">
                        {ordersLoading ? "Loading purchase orders…" : "No purchase orders match the filters."}
                      </td>
                    </tr>
                  ) : (
                    ordersPage.slice.map((row, idx) => {
                      const st = statusLabel(row);
                      const reviewComment = row.approvalHistory?.[row.approvalHistory.length - 1]?.comments;
                      return (
                        <tr key={row.id}>
                          <td className="text-center font-mono text-[11px] text-slate-500">{ordersPage.offset + idx + 1}</td>
                          <td className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                disabled={!canEdit(row) || !perms.orders.edit}
                                onClick={() => openEdit(row)}
                                className={iconBtn}
                                title={!perms.orders.edit ? "Requires Edit permission in Configuration" : "Edit"}
                                aria-label="Edit purchase order"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => setPrintPO(row)} className={iconBtn} title="Print" aria-label="Print purchase order">
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => setViewPO(row)} className={iconBtn} title="View" aria-label="View purchase order">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {row.status === "PENDING_APPROVAL" && (
                                <button
                                  type="button"
                                  disabled={!perms.canApproveOrder(row.officeId, row.totalAmount)}
                                  onClick={() => {
                                    setActionPO({ po: row, action: "approve" });
                                    setActionComment("");
                                  }}
                                  className={`${iconBtn} hover:bg-emerald-100 hover:text-emerald-700`}
                                  title={
                                    !perms.canApproveOrder(row.officeId, row.totalAmount)
                                      ? "Requires Approve permission & Approval Setup eligibility in Configuration"
                                      : "Approve"
                                  }
                                  aria-label="Approve purchase order"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={!canCloseOrCancel(row) || (anyReceived(row) ? !perms.orders.edit : !perms.orders.delete)}
                                onClick={() => {
                                  setActionPO({ po: row, action: anyReceived(row) ? "close" : "cancel" });
                                  setActionComment("");
                                }}
                                className={`${iconBtn} hover:bg-rose-100 hover:text-rose-700`}
                                title={
                                  anyReceived(row)
                                    ? !perms.orders.edit
                                      ? "Requires Edit permission in Configuration to close order"
                                      : "Close (stop receiving)"
                                    : !perms.orders.delete
                                      ? "Requires Delete permission in Configuration to cancel order"
                                      : "Cancel order"
                                }
                                aria-label="Close or cancel purchase order"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!canReverse(row) || !perms.orders.edit}
                                onClick={() => {
                                  setActionPO({ po: row, action: "reverse" });
                                  setActionComment("");
                                }}
                                className={`${iconBtn} hover:bg-amber-100 hover:text-amber-800`}
                                title={!perms.orders.edit ? "Requires Edit permission in Configuration" : "Reverse status"}
                                aria-label="Reverse purchase order status"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="whitespace-nowrap font-mono text-[11px] text-center">{row.orderDate}</td>
                          <td className="whitespace-nowrap font-mono text-[11px] text-center">{row.expectedDeliveryDate}</td>
                          <td className="text-slate-500 font-mono text-[11px] text-center">{row.referenceNumber || "—"}</td>
                          <td className="whitespace-nowrap">
                            <button type="button" onClick={() => setViewPO(row)} className="font-mono text-sky-700 font-semibold hover:underline">
                              {row.poNumber}
                            </button>
                          </td>
                          <td className="leading-tight">{row.officeName}</td>
                          <td className="text-slate-500 text-[11px]">{row.projectCostCenter || "—"}</td>
                          <td className="font-medium text-slate-900 leading-tight">{row.supplierName}</td>
                          <td className="text-slate-700 text-[11px] leading-tight">{row.createdBy}</td>
                          <td className="text-right font-mono font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(row.totalAmount)}</td>
                          <td className="text-slate-600 text-[11px] text-center whitespace-nowrap">{formatEta(row.expectedDeliveryDate)}</td>
                          <td className={`text-center text-[11px] font-semibold whitespace-nowrap ${st.cls}`}>{st.text}</td>
                          <td className="text-slate-500 text-[11px] max-w-[120px] truncate" title={reviewComment || ""}>{reviewComment || "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {ordersPage.pager}
          </div>
        </div>
      )}

      {/* TAB 2: REQUISITION SUMMARY */}
      {activeTab === "REQUISITION_SUMMARY" && (
        <div className="space-y-3">
          <div className="bg-white rounded border border-slate-200/90 p-3.5 shadow-2xs">
            <p className="text-[11px] text-slate-500 mb-2">Items on approved requisitions that are not ordered yet, with the current stock.</p>
            <div className="flex flex-wrap items-end gap-3.5">
              <label className="block w-48">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Office</span>
                <select value={sumOffice} onChange={(e) => setSumOffice(e.target.value)} className={inputCls}>
                  <option value="ALL">All Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block w-44">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</span>
                <input type="date" value={sumFrom} onChange={(e) => setSumFrom(e.target.value)} className={inputCls} />
              </label>
              <label className="block w-44">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</span>
                <input type="date" value={sumTo} onChange={(e) => setSumTo(e.target.value)} className={inputCls} />
              </label>
              <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ["requisitionSummary"] })} disabled={summaryLoading} className={btnPrimary}>
                {summaryLoading && <Spinner className="size-3.5" />}
                VIEW
              </button>
            </div>
          </div>
          <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="erp-table-container">
              <table className="erp-table erp-table-compact">
                <thead>
                  <tr>
                    <th className="w-12 text-center">SL</th>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Sub-Category</th>
                    <th className="text-center">UoM</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Current Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryPage.slice.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400">
                        {summaryLoading ? "Loading…" : "No approved requisition items are waiting for an order."}
                      </td>
                    </tr>
                  ) : (
                    summaryPage.slice.map((row, idx) => (
                      <tr key={`${row.itemId}-${row.itemCode}`}>
                        <td className="text-center font-mono text-slate-600">{summaryPage.offset + idx + 1}</td>
                        <td className="font-mono text-blue-700 font-semibold">{row.itemCode}</td>
                        <td className="font-semibold text-slate-800">{row.itemName}</td>
                        <td>{row.category}</td>
                        <td className="text-slate-500">{row.subCategory || "—"}</td>
                        <td className="text-center">{row.uom}</td>
                        <td className="text-right font-mono font-bold text-slate-900">{row.quantity.toLocaleString("en-US", { maximumFractionDigits: 3 })}</td>
                        <td className={`text-right font-mono font-semibold ${row.currentStock < row.quantity ? "text-rose-600" : "text-slate-700"}`}>
                          {row.currentStock.toLocaleString("en-US", { maximumFractionDigits: 3 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {summaryPage.pager}
          </div>
        </div>
      )}

      {/* TAB 3: PURCHASE METHOD */}
      {activeTab === "PURCHASE_METHOD" && (
        <div className="space-y-3">
          <div className="bg-white rounded border border-slate-200/90 p-3.5 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Office</span>
                <select
                  value={pmOffice}
                  onChange={(e) => {
                    setPmOffice(e.target.value);
                    setPmWarehouse("ALL");
                  }}
                  className={inputCls}
                >
                  <option value="ALL">All Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Warehouse</span>
                <select value={pmWarehouse} onChange={(e) => setPmWarehouse(e.target.value)} className={inputCls}>
                  <option value="ALL">All Warehouses</option>
                  {warehouses
                    .filter((w) => pmOffice === "ALL" || w.officeId === pmOffice)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Buyer Name</span>
                <input
                  type="text"
                  value={pmBuyerName}
                  onChange={(e) => setPmBuyerName(e.target.value)}
                  placeholder="Select/Search Buyer Name (min 3 letters)"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Buyer Office</span>
                <select value={pmBuyerOffice} onChange={(e) => setPmBuyerOffice(e.target.value)} className={inputCls}>
                  <option value="ALL">All Buyer Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Req Type</span>
                <select value={pmReqType} onChange={(e) => setPmReqType(e.target.value)} className={inputCls}>
                  <option value="ALL">All Types</option>
                  <option value="LOCAL">Local</option>
                  <option value="IMPORT">Import</option>
                  <option value="INTER_BRANCH">Inter Branch</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</span>
                <input type="date" value={pmFrom} onChange={(e) => setPmFrom(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</span>
                <input type="date" value={pmTo} onChange={(e) => setPmTo(e.target.value)} className={inputCls} />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["approvedReqs"] })}
                disabled={approvedReqsLoading}
                className={btnPrimary}
              >
                {approvedReqsLoading && <Spinner className="size-3.5" />}
                VIEW
              </button>
              {(pmOffice !== "ALL" || pmWarehouse !== "ALL" || pmBuyerName || pmBuyerOffice !== "ALL" || pmReqType !== "ALL" || pmFrom || pmTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setPmOffice("ALL");
                    setPmWarehouse("ALL");
                    setPmBuyerName("");
                    setPmBuyerOffice("ALL");
                    setPmReqType("ALL");
                    setPmFrom("");
                    setPmTo("");
                  }}
                  className="h-9 px-2 text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
          <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="erp-table-container">
              <table className="erp-table erp-table-compact">
                <thead>
                  <tr>
                    <th className="w-12 text-center">SL</th>
                    <th className="w-24 text-center">Actions</th>
                    <th>Requisition Code</th>
                    <th>Date</th>
                    <th>User Type</th>
                    <th>User</th>
                    <th>Buyer Name</th>
                    <th>Buyer Office</th>
                    <th>Method</th>
                    <th className="text-right">Budget</th>
                    <th>Created By</th>
                    <th>Remarks</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {methodPage.slice.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-10 text-slate-400">
                        No approved requisitions are waiting for a purchase order.
                      </td>
                    </tr>
                  ) : (
                    methodPage.slice.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="text-center font-mono text-slate-600">{methodPage.offset + idx + 1}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button type="button" onClick={() => setViewReq(row)} className={iconBtn} title="View requisition" aria-label="View requisition">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!perms.orders.create}
                              onClick={() => openCreate(row)}
                              className={`${iconBtn} hover:bg-emerald-100 hover:text-emerald-700`}
                              title={!perms.orders.create ? "Requires Create permission in Configuration" : "Create purchase order"}
                              aria-label="Create purchase order from requisition"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="font-mono text-sky-700 font-semibold">{row.requisitionNumber}</td>
                        <td>{row.requestDate}</td>
                        <td className="text-slate-600">{row.department ? "Department" : "Employee"}</td>
                        <td className="font-medium text-slate-800">{row.department || row.requesterName}</td>
                        <td>{row.requesterName || "N/A"}</td>
                        <td>{officeName(row.officeId) || "N/A"}</td>
                        <td>
                          <select
                            value={row.purchaseMethod}
                            disabled={methodMutation.isPending || !perms.requisitions.edit}
                            onChange={(e) => methodMutation.mutate({ id: row.id, method: e.target.value })}
                            aria-label={`Purchase method for ${row.requisitionNumber}`}
                            title={!perms.requisitions.edit ? "Requires Requisition Edit permission in Configuration" : undefined}
                            className="h-7 border border-slate-300 rounded px-2 text-xs bg-white text-slate-700 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {Object.entries(METHOD_LABEL).map(([v, label]) => (
                              <option key={v} value={v}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-right font-mono font-bold text-slate-900">{formatCurrency(row.totalEstimatedAmount)}</td>
                        <td>{row.createdBy}</td>
                        <td className="text-slate-600">{row.remarks || "—"}</td>
                        <td className="text-center text-[11px] font-semibold text-emerald-700">{row.status === "APPROVED" ? "Approved" : row.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {methodPage.pager}
          </div>
        </div>
      )}

      {/* CREATE / EDIT ORDER */}
      <ModalDialog
        isOpen={Boolean(form)}
        onClose={() => !saveMutation.isPending && setForm(null)}
        title={form?.editId ? "Edit Purchase Order" : "Create Local Purchase Order"}
        subtitle={form?.editId ? "Changes are allowed until goods are received" : "Issue a purchase order to an approved supplier"}
        maxWidth="4xl"
      >
        {form && (
          <form onSubmit={submitForm} className="space-y-4 text-xs">
            {!form.editId && (
              <label className="p-2.5 bg-sky-50/70 border border-sky-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-semibold text-sky-900">Link an approved requisition (optional)</span>
                <select value={form.requisitionId} onChange={(e) => selectRequisition(e.target.value)} className="h-8 border border-sky-300 rounded px-2 bg-white text-xs sm:max-w-xs w-full">
                  <option value="">— Direct PO (no requisition) —</option>
                  {approvedReqs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.requisitionNumber} · {r.department} ({formatCurrency(r.totalEstimatedAmount)})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Supplier *</span>
                <select value={form.supplierId} onChange={(e) => patchForm({ supplierId: e.target.value })} className={inputCls} required>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Office *</span>
                <select
                  value={form.officeId}
                  onChange={(e) => patchForm({ officeId: e.target.value, warehouseId: warehouses.find((w) => w.officeId === e.target.value)?.id ?? "" })}
                  className={inputCls}
                  required
                  disabled={Boolean(form.requisitionId)}
                >
                  <option value="">Select office</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Receiving Warehouse *</span>
                <select value={form.warehouseId} onChange={(e) => patchForm({ warehouseId: e.target.value })} className={inputCls} required>
                  <option value="">Select warehouse</option>
                  {formWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Order Date *</span>
                <input type="date" value={form.orderDate} onChange={(e) => patchForm({ orderDate: e.target.value })} className={inputCls} required />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Expected Delivery *</span>
                <input type="date" min={form.orderDate} value={form.expectedDeliveryDate} onChange={(e) => patchForm({ expectedDeliveryDate: e.target.value })} className={inputCls} required />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Supplier Ref / Quotation No</span>
                <input type="text" maxLength={100} value={form.referenceNumber} onChange={(e) => patchForm({ referenceNumber: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Project / Cost Center</span>
                <input type="text" maxLength={100} value={form.projectCostCenter} onChange={(e) => patchForm({ projectCostCenter: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Payment Terms</span>
                <input type="text" value={form.paymentTerms} onChange={(e) => patchForm({ paymentTerms: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-slate-600 font-medium mb-1">Delivery Terms</span>
                <input type="text" value={form.deliveryTerms} onChange={(e) => patchForm({ deliveryTerms: e.target.value })} className={inputCls} />
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Line Items</h4>
                <button type="button" onClick={() => patchForm({ lines: [...form.lines, newLine()] })} className="h-8 px-3 border border-blue-300 text-blue-700 rounded hover:bg-blue-50 font-semibold inline-flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>
              <div className="border border-slate-200 rounded overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                    <tr>
                      <th className="p-2">Item *</th>
                      <th className="p-2 w-14">UoM</th>
                      <th className="p-2 w-20">Qty *</th>
                      <th className="p-2 w-24">Unit Price</th>
                      <th className="p-2 w-16">Disc %</th>
                      <th className="p-2 w-16">VAT %</th>
                      <th className="p-2 w-28 text-right">Line Total</th>
                      <th className="p-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {form.lines.map((line, idx) => (
                      <tr key={line.key}>
                        <td className="p-2">
                          <select
                            value={line.itemId}
                            aria-label={`Item for line ${idx + 1}`}
                            onChange={(e) => {
                              const it = items.find((i) => i.id === e.target.value);
                              patchLine(line.key, it ? { itemId: it.id, itemCode: it.code, itemName: it.name, uom: it.uom, unitPrice: line.unitPrice || it.standardPrice } : { itemId: "" });
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
                        <td className="p-2 text-slate-600 font-mono">{line.uom || "—"}</td>
                        <td className="p-2">
                          <input type="number" min="0.001" step="any" aria-label={`Quantity for line ${idx + 1}`} value={line.orderedQuantity} onChange={(e) => patchLine(line.key, { orderedQuantity: Number(e.target.value) })} className={`${inputCls} font-mono`} />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" step="any" aria-label={`Unit price for line ${idx + 1}`} value={line.unitPrice} onChange={(e) => patchLine(line.key, { unitPrice: Number(e.target.value) })} className={`${inputCls} font-mono`} />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" max="100" step="any" aria-label={`Discount for line ${idx + 1}`} value={line.discountPercentage} onChange={(e) => patchLine(line.key, { discountPercentage: Number(e.target.value) })} className={`${inputCls} font-mono`} />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" max="100" step="any" aria-label={`VAT for line ${idx + 1}`} value={line.taxPercentage} onChange={(e) => patchLine(line.key, { taxPercentage: Number(e.target.value) })} className={`${inputCls} font-mono`} />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-800">{formatCurrency(pricedLines[idx]?.lineTotal ?? 0)}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            disabled={form.lines.length === 1}
                            onClick={() => patchForm({ lines: form.lines.filter((l) => l.key !== line.key) })}
                            className={`${iconBtn} hover:bg-rose-100 hover:text-rose-700`}
                            aria-label={`Remove line ${idx + 1}`}
                            title="Remove line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 justify-between">
              <label className="block flex-1">
                <span className="block text-slate-600 font-medium mb-1">Notes to Supplier</span>
                <textarea value={form.notes} maxLength={600} onChange={(e) => patchForm({ notes: e.target.value })} className="w-full border border-slate-300 rounded p-2 text-xs h-20" />
              </label>
              <div className="md:w-72 space-y-1.5 bg-slate-50 p-3 rounded border border-slate-200">
                <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-mono">{formatCurrency(totals.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Discount</span><span className="font-mono text-rose-600">− {formatCurrency(totals.totalDiscount)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">VAT</span><span className="font-mono">{formatCurrency(totals.totalTax)}</span></div>
                <label className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Shipping</span>
                  <input type="number" min="0" step="any" value={form.shippingFee} onChange={(e) => patchForm({ shippingFee: Number(e.target.value) })} className="w-28 h-7 border border-slate-300 rounded px-2 text-right font-mono text-xs bg-white" />
                </label>
                <div className="flex justify-between pt-1.5 border-t border-slate-300 font-bold text-slate-900 text-sm"><span>Total</span><span className="font-mono text-sky-800">{formatCurrency(totals.totalAmount)}</span></div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setForm(null)} disabled={saveMutation.isPending} className={btnGhost}>
                Cancel
              </button>
              <button type="submit" disabled={saveMutation.isPending} className={btnPrimary}>
                {saveMutation.isPending && <Spinner className="size-3.5" />}
                {form.editId ? "Save Changes" : "Issue Purchase Order"}
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* VIEW ORDER */}
      <ModalDialog isOpen={Boolean(viewPO)} onClose={() => setViewPO(null)} title={`Purchase Order ${viewPO?.poNumber ?? ""}`} subtitle={`${viewPO?.supplierName ?? ""} · ${viewPO?.orderDate ?? ""}`} maxWidth="4xl">
        {viewPO && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Supplier</span>
                <p className="font-bold text-slate-900 text-sm">{viewPO.supplierName}</p>
                <p className="text-slate-600">Reference: {viewPO.referenceNumber || "—"}</p>
                <p className="text-slate-600">Terms: {viewPO.paymentTerms || "—"} · {viewPO.deliveryTerms || "—"}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Deliver To</span>
                <p className="font-bold text-slate-900 text-sm">{viewPO.warehouseName}</p>
                <p className="text-slate-600">{viewPO.officeName} · by {viewPO.expectedDeliveryDate}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Status</span>
                <p className={`font-bold text-sm ${statusLabel(viewPO).cls}`}>{statusLabel(viewPO).text}</p>
                <p className="text-slate-600">Requisition: {viewPO.requisitionNumber || "—"}</p>
              </div>
            </div>
            <div className="border border-slate-200 rounded overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-right">Ordered</th>
                    <th className="p-2 text-right">Received</th>
                    <th className="p-2 text-right">Outstanding</th>
                    <th className="p-2 text-right">Returned</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Disc / VAT</th>
                    <th className="p-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewPO.items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2">
                        <div className="font-semibold text-slate-900">{it.itemName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{it.itemCode} · {it.uom}</div>
                      </td>
                      <td className="p-2 text-right font-mono">{it.orderedQuantity}</td>
                      <td className="p-2 text-right font-mono text-emerald-700">{it.receivedQuantity}</td>
                      <td className="p-2 text-right font-mono text-amber-700">{it.outstandingQuantity}</td>
                      <td className="p-2 text-right font-mono text-rose-600">{it.returnedQuantity}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right font-mono text-slate-500">{it.discountPercentage}% / {it.taxPercentage}%</td>
                      <td className="p-2 text-right font-mono font-bold">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex-1 bg-white border border-slate-200 rounded p-3">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">History</span>
                {viewPO.approvalHistory.length === 0 ? (
                  <p className="text-slate-400">No history recorded.</p>
                ) : (
                  <ul className="space-y-1">
                    {viewPO.approvalHistory.map((h) => (
                      <li key={h.id}>
                        <span className="font-semibold text-slate-800">{h.action.replace(/_/g, " ")}</span> by {h.actorName}
                        <span className="text-slate-400"> · {new Date(h.timestamp).toLocaleString()}</span>
                        {h.comments && <span className="text-slate-600"> — {h.comments}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="sm:w-64 space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(viewPO.subtotal)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span className="font-mono">− {formatCurrency(viewPO.totalDiscount)}</span></div>
                <div className="flex justify-between"><span>VAT</span><span className="font-mono">{formatCurrency(viewPO.totalTax)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span className="font-mono">{formatCurrency(viewPO.shippingFee)}</span></div>
                <div className="flex justify-between pt-1 border-t border-slate-300 font-bold text-sm"><span>Total</span><span className="font-mono text-sky-800">{formatCurrency(viewPO.totalAmount)}</span></div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setViewPO(null)} className={btnGhost}>
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintPO(viewPO);
                  setViewPO(null);
                }}
                className={btnPrimary}
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* PRINT ORDER */}
      <ModalDialog isOpen={Boolean(printPO)} onClose={() => setPrintPO(null)} title="Purchase Order — Print Preview" maxWidth="4xl">
        {printPO && (() => {
          const approvedEntry = [...(printPO.approvalHistory || [])].reverse().find((h) => /approv/i.test(h.action));
          const totalQty = printPO.items.reduce((s, it) => s + Number(it.orderedQuantity || 0), 0);
          return (
            <div className="space-y-4 text-xs">
              <PrintablePurchaseDoc
                context={context}
                officeId={printPO.officeId}
                officeName={printPO.officeName}
                title="Purchase Order"
                metaLeft={[
                  ["PO No", printPO.poNumber],
                  ["Supplier Name", printPO.supplierName],
                  ["Office Name", printPO.officeName],
                  ["Warehouse Name", printPO.warehouseName],
                  ["Remarks / Terms", printPO.notes || printPO.paymentTerms || ""],
                ]}
                metaRight={[
                  ["PO Date", fmtPrintDate(printPO.orderDate)],
                  ["Expected Date", fmtPrintDate(printPO.expectedDeliveryDate)],
                  ["Requisition No", printPO.requisitionNumber || "Direct"],
                  ["Reference No", printPO.referenceNumber || "-"],
                  ["Status", printPO.status],
                ]}
                columns={[
                  { header: "SL", align: "center", widthClass: "w-10" },
                  { header: "Item Code/Model", align: "left", widthClass: "w-28" },
                  { header: "Item Name", align: "left" },
                  { header: "UOM", align: "center", widthClass: "w-14" },
                  { header: "Order Qty", align: "right", widthClass: "w-20" },
                  { header: "Unit Rate", align: "right", widthClass: "w-24" },
                  { header: "VAT %", align: "right", widthClass: "w-16" },
                  { header: "Amount (BDT)", align: "right", widthClass: "w-28" },
                ]}
                rows={printPO.items.map((it, i) => [
                  i + 1,
                  it.itemCode,
                  it.itemName,
                  it.uom || "PCS",
                  fmtPrintNum(it.orderedQuantity),
                  fmtPrintNum(it.unitPrice),
                  fmtPrintNum(it.taxPercentage ?? 0),
                  fmtPrintNum(it.lineTotal),
                ])}
                totalRows={[["", "", "", "Total", fmtPrintNum(totalQty), "", "", fmtPrintNum(printPO.totalAmount)]]}
                signatures={[
                  { roleLabel: "Prepared By", name: printPO.createdBy },
                  { roleLabel: "Approved By", name: approvedEntry?.actorName },
                  { roleLabel: "Supplier / Receiver", name: printPO.supplierName, designation: "Supplier" },
                ]}
              />
              <PurchasePrintToolbar
                pdfUrl={`/api/v1/purchase/orders/${encodeURIComponent(printPO.id)}/pdf`}
                onClose={() => setPrintPO(null)}
                canExportPdf={perms.orders.export}
              />
            </div>
          );
        })()}
      </ModalDialog>

      {/* ORDER ACTION (approve / close / cancel / reverse) */}
      <ModalDialog
        isOpen={Boolean(actionPO)}
        onClose={() => !actionMutation.isPending && setActionPO(null)}
        title={
          actionPO?.action === "approve"
            ? "Approve Purchase Order"
            : actionPO?.action === "close"
              ? "Close Purchase Order"
              : actionPO?.action === "cancel"
                ? "Cancel Purchase Order"
                : "Reverse Purchase Order"
        }
        subtitle={actionPO?.po.poNumber}
        maxWidth="md"
      >
        {actionPO && (
          <form
            className="space-y-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              actionMutation.mutate({ id: actionPO.po.id, action: actionPO.action, comments: actionComment });
            }}
          >
            <p className="text-slate-600">
              {actionPO.action === "approve" && "The order becomes available for goods receiving."}
              {actionPO.action === "close" && "Goods have already been received. Closing stops further receiving; the outstanding quantity is dropped."}
              {actionPO.action === "cancel" && "Nothing has been received yet. Cancelling voids the order and frees its requisition for a new order."}
              {actionPO.action === "reverse" && (actionPO.po.isClosed ? "Re-opens the closed order for receiving." : "Moves the order back to pending approval.")}
            </p>
            <label className="block">
              <span className="block text-slate-700 font-semibold mb-1">Comment {actionPO.action !== "approve" && "*"}</span>
              <textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                required={actionPO.action !== "approve"}
                maxLength={300}
                className="w-full border border-slate-300 rounded p-2 text-xs h-20"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setActionPO(null)} disabled={actionMutation.isPending} className={btnGhost}>
                Back
              </button>
              <button
                type="submit"
                disabled={actionMutation.isPending}
                className={`h-9 px-4 rounded text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 ${
                  actionPO.action === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : actionPO.action === "reverse" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {actionMutation.isPending && <Spinner className="size-3.5" />}
                Confirm
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* VIEW REQUISITION */}
      <ModalDialog isOpen={Boolean(viewReq)} onClose={() => setViewReq(null)} title={`Requisition ${viewReq?.requisitionNumber ?? ""}`} subtitle={viewReq?.department} maxWidth="2xl">
        {viewReq && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Requested By</span>
                <p className="font-bold text-slate-900 text-sm">{viewReq.requesterName}</p>
                <p className="text-slate-600">{officeName(viewReq.officeId)} · {warehouseName(viewReq.warehouseId)}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Dates & Budget</span>
                <p className="text-slate-700">{viewReq.requestDate} → needed by {viewReq.requiredDeliveryDate}</p>
                <p className="font-bold font-mono text-emerald-700">{formatCurrency(viewReq.totalEstimatedAmount)}</p>
              </div>
            </div>
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-100 font-semibold">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Est. Price</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewReq.items.map((i) => (
                  <tr key={i.id}>
                    <td className="p-2">{i.itemCode} — {i.itemName}</td>
                    <td className="p-2 text-right font-mono">{i.quantity} {i.uom}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(i.estimatedUnitPrice)}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-slate-600">Justification: {viewReq.businessJustification}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setViewReq(null)} className={btnGhost}>
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const req = viewReq;
                  setViewReq(null);
                  openCreate(req);
                }}
                className={btnPrimary}
              >
                Create Purchase Order
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
