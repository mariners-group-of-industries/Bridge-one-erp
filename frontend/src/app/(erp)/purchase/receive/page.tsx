"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Eye, PackageCheck, Plus, Printer, RotateCcw, Search, Truck, Upload, X } from "lucide-react";
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
import { effectiveUnitCost } from "@/lib/purchase-store/rules";
import { PURCHASE_QUERY_KEYS, downloadCsv, localToday, uploadPurchaseBulk, tableDate } from "@/features/purchase/lib/client";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { GoodsReceiptDetails } from "@/features/purchase/components/GoodsReceiptDetails";
import { ClosePurchaseOrderDialog } from "@/features/purchase/components/ClosePurchaseOrderDialog";
import { usePurchasePermissions } from "@/features/purchase/lib/usePurchasePermissions";
import type { GoodsReceipt, Item, Office, PurchaseOrder, Supplier, SupplierInvoiceItem } from "@bridgeone/contracts";
import { NativeDateInput } from "@/components/ui/date-input";
import { formatDate } from "@/lib/format";

const parsePoTag = (notes: string | undefined, prefix: string): string => {
  if (!notes) return "";
  for (const part of notes.split("|")) {
    const t = part.trim();
    if (t.startsWith(prefix)) return t.slice(prefix.length).trim();
  }
  return "";
};

const poDocFields = (po: PurchaseOrder) => ({
  shipmentDocumentNumber: parsePoTag(po.notes, "Shipment Doc:") || "",
  supplierInvoiceNumber: parsePoTag(po.notes, "Sales Inv:") || "",
  vatChallanNumber: parsePoTag(po.notes, "VAT Challan:") || "",
  deliveryNumber: parsePoTag(po.notes, "Delivery No:") || po.referenceNumber || "",
});

type Tab = "APPROVED_PO" | "RECEIVED_PO";
type Receipt = GoodsReceipt & {
  challanNumber?: string;
  gatePassNumber?: string;
  remarks?: string;
  vatChallanNumber?: string;
  supplierInvoiceNumber?: string;
  shipmentDocumentNumber?: string;
};

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
  shipmentDocumentNumber: string;
  challanDate: string;
  gatePassNumber: string;
  vatChallanNumber: string;
  supplierInvoiceNumber: string;
  remarks: string;
  lines: ReceiveLine[];
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

function formatEta(dateStr?: string) {
  if (!dateStr) return "—";
  const dt = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return `00.00h (${dt.toLocaleDateString("en-GB", { weekday: "short" })}, ${tableDate(dateStr)})`;
}

const inputCls =
  "w-full h-8 border border-line-strong rounded px-2 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500";
const btnPrimary =
  "h-9 px-4 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs rounded inline-flex items-center justify-center gap-1.5 shadow-xs transition";
const btnGhost = "h-9 px-4 border border-line-strong rounded text-ink-muted hover:bg-canvas text-xs font-semibold";
const iconBtn = "inline-flex size-6 items-center justify-center rounded transition-colors disabled:opacity-30 disabled:pointer-events-none hover:bg-control text-ink-muted hover:text-ink";

const qtyFmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

function receiptStatus(g: Receipt) {
  switch (g.status) {
    case "CANCELLED":
      return { text: "Cancelled", cls: "text-rose-600 dark:text-rose-400" };
    case "DRAFT":
      // Waiting for its "Goods Receipt" approval stages; stock is booked on the last one.
      return { text: "Pending Approval", cls: "text-amber-700 dark:text-amber-300" };
    case "PARTIALLY_RETURNED":
      return { text: "Partly Returned", cls: "text-amber-700 dark:text-amber-300" };
    case "FULLY_RETURNED":
      return { text: "Returned", cls: "text-ink-muted" };
    default:
      return { text: "Received", cls: "text-emerald-700 dark:text-emerald-300" };
  }
}

function Pager({
  total,
  page,
  size,
  onPage,
  onSize,
}: {
  total: number;
  page: number;
  size: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pages);
  const from = total ? (current - 1) * size + 1 : 0;
  const to = Math.min(total, current * size);

  return (
    <div className="px-3 py-2 border-t border-line bg-canvas flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <select
          value={size}
          onChange={(e) => {
            onSize(Number(e.target.value));
            onPage(1);
          }}
          className="bg-surface border border-line-strong rounded px-1.5 py-0.5 text-xs text-ink-muted focus:outline-none"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-ink-faint">|</span>
        <span>
          Showing {from} to {to} of {total} records
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => onPage(1)}
          className="inline-flex size-6 items-center justify-center rounded hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
          title="First Page"
          aria-label="First Page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => onPage(Math.max(1, current - 1))}
          className="inline-flex size-6 items-center justify-center rounded hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 font-medium text-ink-muted">
          Page {current} of {pages}
        </span>
        <button
          type="button"
          disabled={current >= pages}
          onClick={() => onPage(Math.min(pages, current + 1))}
          className="inline-flex size-6 items-center justify-center rounded hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={current >= pages}
          onClick={() => onPage(pages)}
          className="inline-flex size-6 items-center justify-center rounded hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
          title="Last Page"
          aria-label="Last Page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function usePaging<T>(rows: T[], defaultSize = 50) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(defaultSize);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  return {
    slice: rows.slice((current - 1) * size, current * size),
    offset: (current - 1) * size,
    pager: (
      <Pager
        total={rows.length}
        page={current}
        size={size}
        onPage={setPage}
        onSize={(s) => {
          setSize(s);
          setPage(1);
        }}
      />
    ),
  };
}

export default function PurchaseReceivePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const perms = usePurchasePermissions();
  const [activeTab, setActiveTab] = useState<Tab>("APPROVED_PO");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Approved PO tab filters
  const [poOfficeFilter, setPoOfficeFilter] = useState("ALL");
  const [poSupplierFilter, setPoSupplierFilter] = useState("ALL");
  const [poStatusFilter, setPoStatusFilter] = useState("ALL");
  const [poExpDate, setPoExpDate] = useState("");
  const [poFromDate, setPoFromDate] = useState("");
  const [poToDate, setPoToDate] = useState("");

  // Received PO tab filters
  const [recOfficeFilter, setRecOfficeFilter] = useState("ALL");
  const [grnTypeFilter, setGrnTypeFilter] = useState("ALL");
  const [lcNoFilter, setLcNoFilter] = useState("ALL");
  const [itemTypeFilter, setItemTypeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Dialogs
  const [receiveForm, setReceiveForm] = useState<ReceiveForm | null>(null);
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
  const { data: offices = [] } = useQuery<Office[]>({ queryKey: ["offices"], queryFn: () => fetchApi("/master/offices") });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => fetchApi("/master/suppliers") });
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["items"], queryFn: () => fetchApi("/master/items") });
  const { data: context } = useQuery<PrintHeaderContext>({ queryKey: ["context"], queryFn: () => fetchApi("/master/context") });
  const { data: approvedPOs = [], isFetching: posLoading, refetch: refetchApprovedPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ["approvedPOs"],
    queryFn: () => fetchApi("/purchase/receipts/approved-orders"),
  });
  const { data: receipts = [], isFetching: grnLoading, refetch: refetchGRNs } = useQuery<Receipt[]>({
    queryKey: ["receivedGRNs"],
    queryFn: () => fetchApi("/purchase/receipts"),
  });
  const { data: invoices = [] } = useQuery<SupplierInvoiceItem[]>({
    queryKey: ["supplierInvoices"],
    queryFn: () => fetchApi("/purchase/supplier-payments/invoices"),
  });
  const { data: eligible = [] } = useQuery<GoodsReceipt[]>({
    queryKey: ["eligibleGRNs"],
    queryFn: () => fetchApi("/purchase/returns/eligible-receipts"),
  });
  const eligibleIds = useMemo(() => new Set(eligible.map((g) => g.id)), [eligible]);

  const itemTypeById = useMemo(() => new Map(items.map((i) => [i.id, i.itemType || "Inventory Item"])), [items]);
  const itemTypes = useMemo(() => [...new Set(items.map((i) => i.itemType || "Inventory Item"))].sort(), [items]);
  const lcNumbers = useMemo(() => [...new Set(receipts.map((g) => g.shipmentDocumentNumber).filter((v): v is string => Boolean(v)))].sort(), [receipts]);
  const pendingByGrnId = useMemo(() => new Map(invoices.filter((i) => i.receiptId).map((i) => [i.receiptId!, i.dueAmount])), [invoices]);

  const pendingPOs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return approvedPOs.filter((o) => {
      if (poOfficeFilter !== "ALL" && o.officeId !== poOfficeFilter) return false;
      if (poSupplierFilter !== "ALL" && o.supplierId !== poSupplierFilter) return false;
      if (poStatusFilter !== "ALL" && o.status !== poStatusFilter) return false;
      if (poExpDate && o.expectedDeliveryDate !== poExpDate) return false;
      if (poFromDate && o.orderDate < poFromDate) return false;
      if (poToDate && o.orderDate > poToDate) return false;
      if (q && ![o.poNumber, o.supplierName, o.officeName, o.warehouseName, o.createdBy, o.requisitionNumber ?? "", o.referenceNumber ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [approvedPOs, poOfficeFilter, poSupplierFilter, poStatusFilter, poExpDate, poFromDate, poToDate, search]);

  const filteredGRNs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return receipts.filter((g) => {
      if (recOfficeFilter !== "ALL" && g.officeId !== recOfficeFilter) return false;
      if (grnTypeFilter === "DIRECT" && g.poNumber !== "DIRECT-PO") return false;
      if (grnTypeFilter === "PO" && g.poNumber === "DIRECT-PO") return false;
      if (lcNoFilter !== "ALL" && (g.shipmentDocumentNumber || "") !== lcNoFilter) return false;
      if (itemTypeFilter !== "ALL" && !g.items.some((it) => (itemTypeById.get(it.itemId) || "Inventory Item") === itemTypeFilter)) return false;
      if (fromDate && g.receiptDate < fromDate) return false;
      if (toDate && g.receiptDate > toDate) return false;
      if (q && ![g.grnNumber, g.poNumber, g.supplierName, g.officeName, g.challanNumber ?? "", g.vatChallanNumber ?? "", g.supplierInvoiceNumber ?? "", g.preparedBy].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [receipts, search, recOfficeFilter, grnTypeFilter, lcNoFilter, itemTypeFilter, itemTypeById, fromDate, toDate]);

  const pendingPOsPage = usePaging(pendingPOs, 50);
  const filteredGRNsPage = usePaging(filteredGRNs, 50);

  const invalidate = () => {
    for (const key of PURCHASE_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };

  // ---------------------------------------------------------------
  // Receive against PO
  // ---------------------------------------------------------------
  const openReceive = (po: PurchaseOrder) => {
    const docs = poDocFields(po);
    setReceiveForm({
      po,
      receiptDate: today(),
      challanNumber: "",
      shipmentDocumentNumber: docs.shipmentDocumentNumber,
      challanDate: "",
      gatePassNumber: docs.deliveryNumber,
      vatChallanNumber: docs.vatChallanNumber,
      supplierInvoiceNumber: docs.supplierInvoiceNumber,
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
  };

  const patchReceiveLine = (idx: number, patch: Partial<ReceiveLine>) =>
    setReceiveForm((f) => (f ? { ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) } : f));

  const receiveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => fetchApi<Receipt>("/purchase/receipts", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (grn) => {
      invalidate();
      setReceiveForm(null);
      if (grn.status === "DRAFT") toast.success(`${grn.grnNumber} saved; stock is booked once its Goods Receipt approval is complete.`, { title: "Sent for Approval" });
      else toast.success(`${grn.grnNumber} posted: ${formatCurrency(grn.totalReceivedAmount)} received into ${grn.warehouseName}.`, { title: "Goods Received" });
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
    // The receipt keeps one challan / shipment document number; when both are given
    // the shipment document number is kept in the remarks so it is not lost.
    const challan = receiveForm.challanNumber.trim();
    const shipmentDoc = receiveForm.shipmentDocumentNumber.trim();
    const remarks = [receiveForm.remarks.trim(), challan && shipmentDoc && shipmentDoc !== challan ? `Shipment Doc: ${shipmentDoc}` : ""].filter(Boolean).join(" | ");
    receiveMutation.mutate({
      companyId: "comp-bridgeone-01",
      purchaseOrderId: receiveForm.po.id,
      receiptDate: receiveForm.receiptDate,
      challanDate: receiveForm.challanDate || undefined,
      shipmentDocumentNumber: shipmentDoc || undefined,
      challanNumber: challan || shipmentDoc || undefined,
      gatePassNumber: receiveForm.gatePassNumber || undefined,
      vatChallanNumber: receiveForm.vatChallanNumber || undefined,
      supplierInvoiceNumber: receiveForm.supplierInvoiceNumber || undefined,
      remarks: remarks || undefined,
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
    mutationFn: (payload: Record<string, unknown>) => fetchApi<{ returnNumber: string; totalReturnAmount: number; status?: string }>("/purchase/returns", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (ret) => {
      invalidate();
      setReturnGRN(null);
      if (ret.status === "PENDING_APPROVAL") toast.success(`${ret.returnNumber} saved; the goods leave stock once its Purchase Return approval is complete.`, { title: "Sent for Approval" });
      else toast.success(`${ret.returnNumber} posted (${formatCurrency(ret.totalReturnAmount)}). Stock and supplier balance updated.`, { title: "Purchase Return" });
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
        ["SL", "PO Date", "Received Date", "Requisition No", "PO Number", "Supplier", "Office", "Shipment No", "Shipment Document No.", "VAT Challan No", "Sales Invoice No", "Delivery No", "Prepared By", "ETA", "Status"],
        pendingPOs.map((o, i) => {
          const docs = poDocFields(o);
          return [
            i + 1,
            o.orderDate,
            o.expectedDeliveryDate,
            o.requisitionNumber ?? "N/A",
            o.poNumber,
            o.supplierName,
            o.officeName,
            docs.shipmentDocumentNumber || "N/A",
            docs.shipmentDocumentNumber || "N/A",
            docs.vatChallanNumber || "N/A",
            docs.supplierInvoiceNumber || "N/A",
            docs.deliveryNumber || "N/A",
            o.createdBy,
            formatEta(o.expectedDeliveryDate),
            o.status === "PARTIALLY_RECEIVED" ? "Partially Received" : "Approved",
          ];
        }),
      );
    } else {
      downloadCsv(
        "goods_receipts.csv",
        ["SL", "Receive Date", "Office", "PO No", "Invoice/GRN", "Challan No", "Shipment Document No.", "VAT Challan No", "Sales Invoice No", "Delivery No", "Warehouse", "Supplier", "Total Qty", "Total (BDT)", "Pending (BDT)", "Prepared By"],
        filteredGRNs.map((g, i) => [
          i + 1,
          g.receiptDate,
          g.officeName,
          g.poNumber === "DIRECT-PO" ? "Direct" : g.poNumber,
          g.grnNumber,
          g.challanNumber || "N/A",
          g.shipmentDocumentNumber || "N/A",
          g.vatChallanNumber || "N/A",
          g.supplierInvoiceNumber || "N/A",
          g.gatePassNumber || "N/A",
          g.warehouseName,
          g.supplierName,
          g.items.reduce((s, it) => s + it.currentReceivedQuantity, 0),
          g.totalReceivedAmount,
          pendingByGrnId.get(g.id) ?? (g.status === "CANCELLED" ? 0 : g.totalReceivedAmount),
          g.preparedBy,
        ]),
      );
    }
  };

  const receiveTotal = receiveForm?.lines.reduce((s, l) => s + Math.max(0, l.received - l.rejected) * l.rate, 0) ?? 0;
  const returnTotal = returnLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  return (
    <div className="flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden font-sans bg-surface p-3 space-y-2">
      {/* Fixed Top Controls */}
      <div className="shrink-0 space-y-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-ink tracking-tight">Purchase Receive</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search...."
                aria-label="Search"
                className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-surface placeholder:text-ink-faint"
              />
              <Search className="w-3.5 h-3.5 text-ink-faint absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {perms.receive.import && (
              <button type="button" onClick={() => setBulkOpen(true)} className={btnGhost} title="Bulk upload goods receipts from an Excel file">
                <Upload className="w-3.5 h-3.5 inline -mt-0.5" /> Bulk Upload
              </button>
            )}
            {perms.receive.export && (
              <button type="button" onClick={handleExport} className={btnPrimary} title="Download Excel (CSV)">
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
            )}
            {perms.receive.create && (
              <button type="button" onClick={() => router.push("/purchase/receive/create")} className={btnPrimary}>
                <Plus className="w-4 h-4" /> Direct Receive
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" className="flex items-center gap-6 border-b border-line pt-1">
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
              className={`pb-2 text-xs font-bold tracking-wide border-b-2 transition ${activeTab === id ? "border-[#2563eb] text-primary -mb-[1px]" : "border-transparent text-ink-faint hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: Approved POs waiting for goods */}
      {activeTab === "APPROVED_PO" && (
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          <div className="shrink-0 py-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-2">
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">Office</span>
                <select value={poOfficeFilter} onChange={(e) => setPoOfficeFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">All Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">Supplier</span>
                <select value={poSupplierFilter} onChange={(e) => setPoSupplierFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">Status</span>
                <select value={poStatusFilter} onChange={(e) => setPoStatusFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">All Status</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PARTIALLY_RECEIVED">Partially Received</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">From Date</span>
                <NativeDateInput type="date" value={poFromDate} onChange={(e) => setPoFromDate(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">To Date</span>
                <NativeDateInput type="date" value={poToDate} onChange={(e) => setPoToDate(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">Exp. Receive Date</span>
                <NativeDateInput type="date" value={poExpDate} onChange={(e) => setPoExpDate(e.target.value)} className={inputCls} />
              </label>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => refetchApprovedPOs()} disabled={posLoading} className={btnPrimary}>
                {posLoading && <Spinner className="size-3.5" />}
                VIEW
              </button>
              {(poOfficeFilter !== "ALL" || poSupplierFilter !== "ALL" || poStatusFilter !== "ALL" || poExpDate || poFromDate || poToDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setPoOfficeFilter("ALL");
                    setPoSupplierFilter("ALL");
                    setPoStatusFilter("ALL");
                    setPoExpDate("");
                    setPoFromDate("");
                    setPoToDate("");
                  }}
                  className="h-9 px-2 text-xs text-ink-faint hover:text-ink underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Table Card (Only Table Scrolls) */}
          <div className="flex-1 min-h-0 bg-surface rounded border border-line/90 shadow-2xs overflow-hidden flex flex-col">
            <div className="erp-table-container flex-1 min-h-0 overflow-auto">
              <table className="erp-table erp-table-compact">
                <thead>
                  <tr>
                    <th className="w-7 text-center whitespace-nowrap">SL</th>
                    <th className="w-[75px] min-w-[70px] text-center whitespace-nowrap">Actions</th>
                    <th className="whitespace-nowrap">PO Date</th>
                    <th className="whitespace-nowrap">Received Date</th>
                    <th className="whitespace-nowrap">Requisition No</th>
                    <th className="whitespace-nowrap">PO Number</th>
                    <th>Supplier</th>
                    <th>Office</th>
                    <th className="text-center font-mono">Shipment No</th>
                    <th className="text-center font-mono">Shipment Doc No.</th>
                    <th className="text-center font-mono">VAT Challan No</th>
                    <th className="text-center font-mono">Sales Invoice No</th>
                    <th className="text-center font-mono">Delivery No</th>
                    <th>Prepared By</th>
                    <th className="text-center whitespace-nowrap">ETA</th>
                    <th className="text-center whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPOs.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="text-center py-10 text-ink-faint">
                        {posLoading ? "Loading…" : "No approved purchase orders are waiting for goods."}
                      </td>
                    </tr>
                  ) : (
                    pendingPOsPage.slice.map((po, idx) => {
                      const overdue = po.expectedDeliveryDate < today();
                      const docs = poDocFields(po);
                      return (
                        <tr key={po.id}>
                          <td className="text-center font-mono text-[11px] text-ink-faint">{pendingPOsPage.offset + idx + 1}</td>
                          <td className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                disabled={!perms.orders.edit}
                                onClick={() => setClosePO(po)}
                                className={`${iconBtn} hover:bg-rose-100 dark:hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-rose-300`}
                                title={!perms.orders.edit ? "Requires Purchase Order Edit permission in Configuration" : "Close"}
                                aria-label={`Close ${po.poNumber}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!perms.receive.create}
                                onClick={() => openReceive(po)}
                                className={`${iconBtn} hover:bg-emerald-100 dark:hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300`}
                                title={!perms.receive.create ? "Requires Create permission in Configuration" : "Receive goods"}
                                aria-label={`Receive goods for ${po.poNumber}`}
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="whitespace-nowrap font-mono text-[11px] text-center">{tableDate(po.orderDate)}</td>
                          <td className={`whitespace-nowrap font-mono text-[11px] text-center ${overdue ? "text-rose-600 dark:text-rose-400 font-semibold" : ""}`}>{tableDate(po.expectedDeliveryDate)}</td>
                          <td className="font-mono text-[11px] text-ink-faint text-center">{po.requisitionNumber || "—"}</td>
                          <td className="whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openReceive(po)}
                              className="inline-flex items-center gap-1.5 font-mono text-sky-700 dark:text-sky-300 font-semibold hover:underline"
                            >
                              <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>{po.poNumber}</span>
                            </button>
                          </td>
                          <td className="font-medium text-ink leading-tight">{po.supplierName}</td>
                          <td className="leading-tight">{po.officeName}</td>
                          <td className="text-ink-faint font-mono text-[11px] text-center">{docs.shipmentDocumentNumber || "—"}</td>
                          <td className="text-ink-faint font-mono text-[11px] text-center">{docs.shipmentDocumentNumber || "—"}</td>
                          <td className="text-ink-faint font-mono text-[11px] text-center">{docs.vatChallanNumber || "—"}</td>
                          <td className="text-ink-faint font-mono text-[11px] text-center">{docs.supplierInvoiceNumber || "—"}</td>
                          <td className="text-ink-faint font-mono text-[11px] text-center">{docs.deliveryNumber || "—"}</td>
                          <td className="text-ink-muted text-[11px] leading-tight">{po.createdBy}</td>
                          <td className="text-ink-muted text-[11px] text-center whitespace-nowrap">{formatEta(po.expectedDeliveryDate)}</td>
                          <td className={`text-center text-[11px] font-semibold whitespace-nowrap ${po.status === "PARTIALLY_RECEIVED" ? "text-purple-700 dark:text-purple-300" : "text-sky-700 dark:text-sky-300"}`}>
                            {po.status === "PARTIALLY_RECEIVED" ? "Partially Received" : "Approved"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="shrink-0">{pendingPOsPage.pager}</div>
          </div>
        </div>
      )}

      {/* TAB 2: Goods receipts */}
      {activeTab === "RECEIVED_PO" && (
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          <div className="shrink-0 py-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">Office</span>
                <select value={recOfficeFilter} onChange={(e) => setRecOfficeFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">All</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">GRN Type</span>
                <select value={grnTypeFilter} onChange={(e) => setGrnTypeFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">All</option>
                  <option value="PO">Local PO</option>
                  <option value="DIRECT">Direct</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">LC NO</span>
                <select value={lcNoFilter} onChange={(e) => setLcNoFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">LC NO</option>
                  {lcNumbers.map((lc) => (
                    <option key={lc} value={lc}>
                      {lc}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">Item type</span>
                <select value={itemTypeFilter} onChange={(e) => setItemTypeFilter(e.target.value)} className={inputCls}>
                  <option value="ALL">Select Item Type</option>
                  {itemTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">From Date</span>
                <NativeDateInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink-muted mb-1">To Date</span>
                <NativeDateInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => refetchGRNs()} disabled={grnLoading} className={btnPrimary}>
                {grnLoading && <Spinner className="size-3.5" />} VIEW
              </button>
              {(recOfficeFilter !== "ALL" || grnTypeFilter !== "ALL" || lcNoFilter !== "ALL" || itemTypeFilter !== "ALL" || fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setRecOfficeFilter("ALL");
                    setGrnTypeFilter("ALL");
                    setLcNoFilter("ALL");
                    setItemTypeFilter("ALL");
                    setFromDate("");
                    setToDate("");
                  }}
                  className="h-9 px-2 text-xs text-ink-faint hover:text-ink underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
          {/* Table Card (Only Table Scrolls) */}
          <div className="flex-1 min-h-0 bg-surface rounded border border-line/90 shadow-2xs overflow-hidden flex flex-col">
            <div className="erp-table-container flex-1 min-h-0 overflow-auto">
              <table className="erp-table erp-table-compact">
                <thead>
                  <tr>
                    <th className="w-7 text-center whitespace-nowrap">SL</th>
                    <th className="w-[100px] min-w-[95px] text-center whitespace-nowrap">Actions</th>
                    <th className="whitespace-nowrap">Receive Date</th>
                    <th>Office</th>
                    <th className="whitespace-nowrap">PO No</th>
                    <th className="whitespace-nowrap">Invoice/GRN</th>
                    <th className="whitespace-nowrap">Challan No</th>
                    <th className="text-center font-mono">Shipment Doc No.</th>
                    <th className="text-center font-mono">VAT Challan No</th>
                    <th className="text-center font-mono">Sales Invoice No</th>
                    <th className="text-center font-mono">Delivery No</th>
                    <th>Warehouse</th>
                    <th>Supplier</th>
                    <th className="text-right whitespace-nowrap">Total Qty</th>
                    <th className="text-right whitespace-nowrap">Total (BDT)</th>
                    <th className="text-right whitespace-nowrap">Pending (BDT)</th>
                    <th>Prepared By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGRNs.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="text-center py-10 text-ink-faint">
                        {grnLoading ? "Loading…" : "No goods receipts match the filters."}
                      </td>
                    </tr>
                  ) : (
                    filteredGRNsPage.slice.map((g, idx) => {
                      const totalQty = g.items.reduce((s, it) => s + it.currentReceivedQuantity, 0);
                      const pendingAmt = pendingByGrnId.get(g.id) ?? (g.status === "CANCELLED" ? 0 : g.totalReceivedAmount);
                      return (
                        <tr key={g.id}>
                          <td className="text-center font-mono text-[11px] text-ink-faint">{filteredGRNsPage.offset + idx + 1}</td>
                          <td className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-0.5">
                              <button type="button" onClick={() => setViewGRN(g)} className={iconBtn} title="View" aria-label={`View ${g.grnNumber}`}>
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => setPrintGRN(g)} className={iconBtn} title="Print" aria-label={`Print ${g.grnNumber}`}>
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!eligibleIds.has(g.id) || !perms.returns.create}
                                onClick={() => openReturn(g)}
                                className={`${iconBtn} hover:bg-amber-100 dark:hover:bg-amber-500/15 hover:text-amber-800 dark:hover:text-amber-300`}
                                title={!perms.returns.create ? "Requires Purchase Return Create permission in Configuration" : "Return goods to supplier"}
                                aria-label={`Return goods from ${g.grnNumber}`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={g.status !== "RECEIVED" || !perms.receive.delete}
                                onClick={() => {
                                  setCancelGRN(g);
                                  setComment("");
                                }}
                                className={`${iconBtn} hover:bg-rose-100 dark:hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-rose-300`}
                                title={!perms.receive.delete ? "Requires Delete permission in Configuration" : "Cancel receipt"}
                                aria-label={`Cancel ${g.grnNumber}`}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="whitespace-nowrap font-mono text-[11px] text-center">{tableDate(g.receiptDate)}</td>
                          <td className="leading-tight">{g.officeName}</td>
                          <td className="font-mono text-[11px] whitespace-nowrap">{g.poNumber === "DIRECT-PO" ? "Direct" : g.poNumber}</td>
                          <td className="whitespace-nowrap">
                            <button type="button" onClick={() => setViewGRN(g)} className="inline-flex items-center gap-1.5 font-mono text-sky-700 dark:text-sky-300 font-semibold hover:underline">
                              <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>{g.grnNumber}</span>
                            </button>
                          </td>
                          <td className="font-mono text-[11px] whitespace-nowrap text-ink-muted">{g.challanNumber || "—"}</td>
                          <td className="font-mono text-[11px] text-ink-faint text-center">{g.shipmentDocumentNumber || "—"}</td>
                          <td className="font-mono text-[11px] text-ink-faint text-center">{g.vatChallanNumber || "—"}</td>
                          <td className="font-mono text-[11px] text-ink-faint text-center">{g.supplierInvoiceNumber || "—"}</td>
                          <td className="font-mono text-[11px] text-ink-faint text-center">{g.gatePassNumber || "—"}</td>
                          <td className="leading-tight">{g.warehouseName}</td>
                          <td className="font-medium text-ink leading-tight">{g.supplierName}</td>
                          <td className="text-right font-mono text-[11px] whitespace-nowrap">{qtyFmt(totalQty)}</td>
                          <td className="text-right font-mono font-semibold text-ink whitespace-nowrap">{formatCurrency(g.totalReceivedAmount)}</td>
                          <td className="text-right font-mono font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatCurrency(pendingAmt)}</td>
                          <td className="text-ink-muted text-[11px] leading-tight">{g.preparedBy}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="shrink-0">{filteredGRNsPage.pager}</div>
          </div>
        </div>
      )}

      {/* RECEIVE AGAINST PO */}
      <ModalDialog isOpen={Boolean(receiveForm)} onClose={() => !receiveMutation.isPending && setReceiveForm(null)} title="Receive From PO" maxWidth="6xl">
        {receiveForm &&
          (() => {
            const po = receiveForm.po;
            const supplier = suppliers.find((s) => s.id === po.supplierId);
            const shipTo = parsePoTag(po.notes, "Ship To:") || po.deliveryTerms;
            const set = (patch: Partial<ReceiveForm>) => setReceiveForm({ ...receiveForm, ...patch });
            const totalQty = receiveForm.lines.reduce((s, l) => s + Math.max(0, l.received - l.rejected), 0);
            // Nothing is paid at receive time, so the whole receipt value is pending.
            const pendingAmount = receiveTotal;
            const allCleared = receiveForm.lines.every((l) => l.received === 0);
            const info = (label: string, value: React.ReactNode, tone = "text-ink") => (
              <div className="grid grid-cols-[120px_12px_1fr] py-[1px]">
                <span className="font-semibold text-ink">{label}</span>
                <span className="text-ink-faint">:</span>
                <span className={tone}>{value || "N/A"}</span>
              </div>
            );
            const field = (label: string, node: React.ReactNode, required = false) => (
              <label className="block">
                <span className="block text-ink font-medium mb-1">
                  {label}
                  {required && <span className="text-rose-600"> *</span>}
                </span>
                {node}
              </label>
            );
            return (
              <form onSubmit={submitReceive} className="space-y-4 text-xs">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setReceiveForm(null)} disabled={receiveMutation.isPending} className="h-8 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded font-semibold">
                    Close &amp; Back
                  </button>
                  <button type="submit" disabled={receiveMutation.isPending} className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white rounded font-semibold inline-flex items-center gap-1.5">
                    {receiveMutation.isPending ? <Spinner className="size-3.5" /> : <Truck className="w-3.5 h-3.5" />} Receive
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 border border-line rounded p-3">
                  <div>
                    {info("Order No", po.poNumber, "font-semibold text-blue-600 dark:text-blue-400")}
                    {info("Supplier", po.supplierName)}
                    {info("Status", po.status === "PARTIALLY_RECEIVED" ? "Partially Received" : "Approved", "font-semibold text-emerald-600 dark:text-emerald-400")}
                    {info("Remarks", parsePoTag(po.notes, "Remarks:") || "")}
                  </div>
                  <div>
                    {info("Office Name", po.officeName)}
                    {info("Supplier Address", supplier?.address)}
                    {info("Shipping Address", shipTo)}
                  </div>
                  <div>
                    {info("PO Date", formatDate(po.orderDate))}
                    {info("Purchase Type", "Local")}
                    {info("Requisition No", po.requisitionNumber)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 border border-line rounded p-3">
                  {field("Receive Date", <NativeDateInput type="date" required min={po.orderDate} value={receiveForm.receiptDate} onChange={(e) => set({ receiptDate: e.target.value })} className={inputCls} />, true)}
                  {field("Challan No", <input type="text" maxLength={100} placeholder="Challan No" value={receiveForm.challanNumber} onChange={(e) => set({ challanNumber: e.target.value })} className={inputCls} />)}
                  {field("Shipment Document Number", <input type="text" maxLength={100} placeholder="Shipment Document Number" value={receiveForm.shipmentDocumentNumber} onChange={(e) => set({ shipmentDocumentNumber: e.target.value })} className={inputCls} />)}
                  {field("Sales Invoice Number", <input type="text" maxLength={100} placeholder="Sales Invoice Number" value={receiveForm.supplierInvoiceNumber} onChange={(e) => set({ supplierInvoiceNumber: e.target.value })} className={inputCls} />)}
                  {field("VAT Challan Number", <input type="text" maxLength={100} placeholder="VAT Challan Number" value={receiveForm.vatChallanNumber} onChange={(e) => set({ vatChallanNumber: e.target.value })} className={inputCls} />)}
                  {field("Challan Date", <NativeDateInput type="date" value={receiveForm.challanDate} onChange={(e) => set({ challanDate: e.target.value })} className={inputCls} />)}
                  {field("Delivery Number", <input type="text" maxLength={100} placeholder="Delivery Number" value={receiveForm.gatePassNumber} onChange={(e) => set({ gatePassNumber: e.target.value })} className={inputCls} />)}
                  {field("Remarks", <input type="text" maxLength={500} placeholder="Remarks" value={receiveForm.remarks} onChange={(e) => set({ remarks: e.target.value })} className={inputCls} />)}
                  {field("Office", <input type="text" readOnly value={po.officeName} className={`${inputCls} bg-canvas`} />, true)}
                  {field("Warehouse (Location)", <input type="text" readOnly value={po.warehouseName} className={`${inputCls} bg-canvas`} />, true)}
                </div>

                <div className="border border-grid-line rounded overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-grid-head text-grid-head-ink font-semibold border-b border-grid-head-line">
                        <th className="px-2 py-2 border-r border-grid-head-line w-10">SL</th>
                        <th className="px-2 py-2 border-r border-grid-head-line">Item Code</th>
                        <th className="px-2 py-2 border-r border-grid-head-line">Name</th>
                        <th className="px-2 py-2 border-r border-grid-head-line text-right">Billed QTY</th>
                        <th className="px-2 py-2 border-r border-grid-head-line text-right">Order QTY</th>
                        <th className="px-2 py-2 border-r border-grid-head-line text-right">Rcvd. QTY</th>
                        <th className="px-2 py-2 border-r border-grid-head-line text-right">Rem. QTY</th>
                        <th className="px-2 py-2 border-r border-grid-head-line">Specification</th>
                        <th className="px-2 py-2 border-r border-grid-head-line text-right">Rate</th>
                        <th className="px-2 py-2 border-r border-grid-head-line w-40 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            Rec. Qty
                            <label className="inline-flex items-center gap-1 font-normal cursor-pointer">
                              <input
                                type="checkbox"
                                className="size-4"
                                checked={allCleared}
                                onChange={(e) => set({ lines: receiveForm.lines.map((l) => ({ ...l, received: e.target.checked ? 0 : l.outstanding, rejected: e.target.checked ? 0 : l.rejected })) })}
                              />
                              (clear all)
                            </label>
                          </span>
                        </th>
                        <th className="px-2 py-2 w-24">Rejected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiveForm.lines.map((l, idx) => {
                        const err = lineError(l);
                        const spec = po.items.find((it) => it.id === l.poItemId)?.remarks;
                        return (
                          <tr key={l.poItemId || idx} className={`border-b border-grid-line ${err ? "bg-rose-50 dark:bg-rose-500/10" : ""}`}>
                            <td className="px-2 py-1.5 border-r border-grid-line">{idx + 1}</td>
                            <td className="px-2 py-1.5 border-r border-grid-line font-mono">{l.itemCode}</td>
                            <td className="px-2 py-1.5 border-r border-grid-line">
                              {l.itemName}
                              {err && <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">{err}</div>}
                            </td>
                            <td className="px-2 py-1.5 border-r border-grid-line text-right font-mono">{qtyFmt(l.orderedQuantity)}</td>
                            <td className="px-2 py-1.5 border-r border-grid-line text-right font-mono">
                              {qtyFmt(l.orderedQuantity)} {l.uom}
                            </td>
                            <td className="px-2 py-1.5 border-r border-grid-line text-right font-mono">{qtyFmt(l.previouslyReceivedQuantity)}</td>
                            <td className="px-2 py-1.5 border-r border-grid-line text-right font-mono">{qtyFmt(l.outstanding)}</td>
                            <td className="px-2 py-1.5 border-r border-grid-line text-ink-muted">{spec}</td>
                            <td className="px-2 py-1.5 border-r border-grid-line text-right font-mono">{formatCurrency(l.rate)}</td>
                            <td className="px-2 py-1.5 border-r border-grid-line">
                              <input type="number" min="0" step="any" aria-label={`Receive quantity for ${l.itemName}`} value={l.received} onChange={(e) => patchReceiveLine(idx, { received: Number(e.target.value) })} className={`${inputCls} text-right font-mono`} />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" min="0" step="any" aria-label={`Rejected quantity for ${l.itemName}`} value={l.rejected} onChange={(e) => patchReceiveLine(idx, { rejected: Number(e.target.value) })} className={`${inputCls} text-right font-mono`} />
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="font-semibold">
                        <td className="px-2 py-1.5 border-r border-grid-line" colSpan={3}>
                          Total
                        </td>
                        <td className="px-2 py-1.5 border-r border-grid-line text-right font-mono">{qtyFmt(receiveForm.lines.reduce((s, l) => s + l.orderedQuantity, 0))}</td>
                        <td className="px-2 py-1.5 border-r border-grid-line text-right font-mono">{qtyFmt(receiveForm.lines.reduce((s, l) => s + l.orderedQuantity, 0))}</td>
                        <td className="px-2 py-1.5 border-r border-grid-line text-right font-mono">{qtyFmt(receiveForm.lines.reduce((s, l) => s + l.previouslyReceivedQuantity, 0))}</td>
                        <td className="px-2 py-1.5 border-r border-grid-line text-right font-mono">{qtyFmt(receiveForm.lines.reduce((s, l) => s + l.outstanding, 0))}</td>
                        <td colSpan={4} />
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className="w-full sm:w-96 border border-line rounded p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between font-semibold">
                      <span>Total Qty :</span>
                      <span className="font-mono">{qtyFmt(totalQty)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Item Total (with VAT) :</span>
                      <span className="font-mono">{formatCurrency(receiveTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending Amount:</span>
                      <span className="font-mono">{formatCurrency(pendingAmount)}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t border-line">
                      <span>Purchase Total:</span>
                      <span className="font-mono">{formatCurrency(receiveTotal)}</span>
                    </div>
                    <p className="text-[11px] text-ink-faint pt-1">Only accepted quantity (received − rejected) goes into stock and is owed to the supplier.</p>
                  </div>
                </div>
              </form>
            );
          })()}
      </ModalDialog>

      {/* VIEW GRN */}
      <ModalDialog isOpen={Boolean(viewGRN)} onClose={() => setViewGRN(null)} title="Purchase Received Details" maxWidth="6xl">
        {viewGRN && (
          <GoodsReceiptDetails
            grn={viewGRN}
            supplier={suppliers.find((s) => s.id === viewGRN.supplierId)}
            status={receiptStatus(viewGRN)}
            onClose={() => setViewGRN(null)}
            onPrint={() => {
              setPrintGRN(viewGRN);
              setViewGRN(null);
            }}
          />
        )}
      </ModalDialog>

      {/* PRINT GRN */}
      <ModalDialog isOpen={Boolean(printGRN)} onClose={() => setPrintGRN(null)} title="Goods Receipt Note — Print Preview" maxWidth="4xl">
        {printGRN && (() => {
          const totalOrd = printGRN.items.reduce((s, it) => s + Number(it.orderedQuantity || 0), 0);
          const totalRecv = printGRN.items.reduce((s, it) => s + Number(it.currentReceivedQuantity || 0), 0);
          const totalRej = printGRN.items.reduce((s, it) => s + Number(it.rejectedDamagedQuantity || 0), 0);
          return (
            <div className="space-y-4 text-xs">
              <PrintablePurchaseDoc
                context={context}
                officeId={printGRN.officeId}
                officeName={printGRN.officeName}
                title="Goods Receipt Note (GRN)"
                metaLeft={[
                  ["GRN No", printGRN.grnNumber],
                  ["Supplier Name", printGRN.supplierName],
                  ["Office Name", printGRN.officeName],
                  ["Warehouse Name", printGRN.warehouseName],
                  ["Remarks", printGRN.remarks || ""],
                ]}
                metaRight={[
                  ["Receive Date", fmtPrintDate(printGRN.receiptDate)],
                  ["PO No", printGRN.poNumber || "Direct"],
                  ["Challan No", printGRN.challanNumber || "-"],
                  ["Invoice / VAT Challan", [printGRN.supplierInvoiceNumber, printGRN.vatChallanNumber].filter(Boolean).join(" / ") || "-"],
                  ["Status", printGRN.status],
                ]}
                columns={[
                  { header: "SL", align: "center", widthClass: "w-10" },
                  { header: "Item Code/Model", align: "left", widthClass: "w-28" },
                  { header: "Item Name", align: "left" },
                  { header: "UOM", align: "center", widthClass: "w-14" },
                  { header: "Order Qty", align: "right", widthClass: "w-20" },
                  { header: "Recv. Qty", align: "right", widthClass: "w-20" },
                  { header: "Rej. Qty", align: "right", widthClass: "w-20" },
                  { header: "Amount", align: "right", widthClass: "w-28" },
                ]}
                rows={printGRN.items.map((it, i) => [
                  i + 1,
                  it.itemCode,
                  it.itemName,
                  it.uom || "PCS",
                  fmtPrintNum(it.orderedQuantity),
                  fmtPrintNum(it.currentReceivedQuantity),
                  fmtPrintNum(it.rejectedDamagedQuantity),
                  fmtPrintNum(it.lineTotal),
                ])}
                totalRows={[["", "", "", "Total", fmtPrintNum(totalOrd), fmtPrintNum(totalRecv), fmtPrintNum(totalRej), fmtPrintNum(printGRN.totalReceivedAmount)]]}
                signatures={[
                  { roleLabel: "Received By", name: printGRN.preparedBy },
                  { roleLabel: "Quality Checked By" },
                  { roleLabel: "Store In-Charge" },
                ]}
              />
              <PurchasePrintToolbar
                pdfUrl={`/api/v1/purchase/receipts/${encodeURIComponent(printGRN.id)}/pdf`}
                onClose={() => setPrintGRN(null)}
                canExportPdf={perms.receive.export}
              />
            </div>
          );
        })()}
      </ModalDialog>

      {/* CLOSE PO BALANCE */}
      <ClosePurchaseOrderDialog
        po={closePO}
        pending={closeMutation.isPending}
        onCancel={() => setClosePO(null)}
        onConfirm={(po) => closeMutation.mutate({ id: po.id, comments: "Closed from Purchase Receive" })}
      />

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
            <p className="text-ink-muted">
              The received goods leave {cancelGRN.warehouseName} again, the order is re-opened for receiving and {formatCurrency(cancelGRN.totalReceivedAmount)} is taken off the supplier balance. Not allowed if
              the stock was already used, or a return, bill or payment exists for this receipt.
            </p>
            <label className="block">
              <span className="block text-ink-muted font-semibold mb-1">Reason *</span>
              <textarea required maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} className="w-full border border-line-strong rounded p-2 text-xs h-20" />
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
                <span className="block text-ink-muted font-medium mb-1">Return Date *</span>
                <NativeDateInput type="date" required min={returnGRN.receiptDate} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-ink-muted font-medium mb-1">Reason *</span>
                <input type="text" required maxLength={300} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Damaged, wrong specification, expired…" className={inputCls} />
              </label>
            </div>
            <table className="w-full text-left border border-line">
              <thead className="bg-control font-semibold">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Returnable</th>
                  <th className="p-2 w-28">Return Qty</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {returnLines.map((l, idx) => (
                  <tr key={`${l.itemId}-${idx}`} className={l.qty > l.available + 1e-9 ? "bg-rose-50 dark:bg-rose-500/10" : ""}>
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
                Credit: <span className="font-mono text-sky-800 dark:text-sky-300">{formatCurrency(returnTotal)}</span>
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
      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={invalidate}
        noun="goods receipts"
        templateUrl="/api/v1/purchase/receive/import"
        maxRows={2000}
        matchHint="PO Number: put the PO number to receive against it, or DIRECT for a direct receive (needs Supplier, Office, Warehouse and Unit Price). Rows with the same Ref are saved as one receipt."
        upload={(file) => uploadPurchaseBulk("/api/v1/purchase/receive/import", file)}
      />
    </div>
  );
}
