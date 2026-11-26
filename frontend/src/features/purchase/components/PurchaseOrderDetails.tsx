"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import type { PurchaseOrder, Supplier } from "@bridgeone/contracts";
import { fetchApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { downloadCsv } from "@/features/purchase/lib/client";
import { BatchMark, useBatchItemIds } from "./BatchMark";

type Order = PurchaseOrder & { isClosed?: boolean; notes?: string };

interface AdvanceRow {
  id: string;
  number: string;
  paymentDate: string;
  orderNumber: string;
  method: string;
  referenceNumber: string;
  remarks: string;
  amount: number;
}

type Tab = "ITEMS" | "ADVANCE" | "APPROVAL";

const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const stamp = (iso?: string) => {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDate(iso.slice(0, 10))} | ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
};

/** Reads the "Key: value | Key: value" segments the create form stores in the order notes. */
function parseNotes(notes?: string) {
  const fields: Record<string, string> = {};
  const free: string[] = [];
  for (const raw of (notes ?? "").split(" | ")) {
    const seg = raw.trim();
    if (!seg) continue;
    const m = seg.match(/^(Urgency|Ship To|Shipment Doc|Sales Inv|VAT Challan|Delivery No|Terms|Attachments):\s*([\s\S]*)$/);
    if (m) fields[m[1]] = m[2];
    else free.push(seg);
  }
  const vat = fields["VAT Challan"] ?? "";
  const vatMatch = vat.match(/^(.*?)\s*\((\d{4}-\d{2}-\d{2})\)$/);
  return {
    remarks: free.join(" | "),
    shippingAddress: fields["Ship To"],
    shipmentDoc: fields["Shipment Doc"],
    salesInvoice: fields["Sales Inv"],
    vatChallan: vatMatch ? vatMatch[1] : vat || undefined,
    challanDate: vatMatch ? vatMatch[2] : undefined,
    deliveryNumber: fields["Delivery No"],
    terms: fields["Terms"],
  };
}

function Row({ label, value, tone }: { label: string; value?: React.ReactNode; tone?: string }) {
  return (
    <div className="grid grid-cols-[150px_12px_1fr] items-start py-[1px]">
      <span className="font-semibold text-ink">{label}</span>
      <span className="text-ink-faint">:</span>
      <span className={tone ?? "text-ink-muted"}>{value === undefined || value === null || value === "" ? "N/A" : value}</span>
    </div>
  );
}

export function PurchaseOrderDetails({
  po,
  supplier,
  status,
  onClose,
  onPrint,
}: {
  po: Order;
  supplier?: Supplier;
  status: { text: string; cls: string };
  onClose: () => void;
  onPrint: () => void;
}) {
  const [tab, setTab] = useState<Tab>("ITEMS");
  const n = parseNotes(po.notes);
  const history = po.approvalHistory ?? [];
  const approved = [...history].reverse().find((h) => h.action === "APPROVED");
  const modified = [...history].reverse().find((h) => /UPDATED|EDITED|MODIFIED/.test(h.action));
  const review = [...history].reverse().find((h) => h.comments)?.comments;
  const batchItems = useBatchItemIds();

  const { data: advances = [], isLoading: advancesLoading } = useQuery<AdvanceRow[]>({
    queryKey: ["supplierAdvances", "details", "order", po.poNumber],
    enabled: tab === "ADVANCE",
    queryFn: () => fetchApi("/purchase/supplier-payments/advances?details=true"),
    select: (rows) => rows.filter((r) => r.orderNumber === po.poNumber),
  });

  const exportExcel = () =>
    downloadCsv(
      `${po.poNumber}.csv`,
      ["SL", "Code/SKU", "Item Name", "UoM", "Order Quantity", "Unit Price", "Discount %", "VAT %", "Total"],
      po.items.map((it, i) => [i + 1, it.itemCode, it.itemName, it.uom, it.orderedQuantity, it.unitPrice, it.discountPercentage, it.taxPercentage, it.lineTotal]),
    );

  const tabCls = (t: Tab) =>
    `min-h-6 pb-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
      tab === t ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]" : "text-ink-faint hover:text-ink"
    }`;

  return (
    <div className="space-y-4 text-xs">
      <div className="flex justify-end gap-2 print:hidden">
        <button type="button" onClick={onPrint} aria-label="Print purchase order" className="inline-flex size-8 items-center justify-center rounded text-ink hover:bg-hover">
          <Printer className="size-4" />
        </button>
        <button type="button" onClick={exportExcel} className="h-8 px-3 bg-[#2563eb] hover:bg-blue-700 text-white rounded font-semibold inline-flex items-center gap-1.5">
          <Download className="size-3.5" /> Excel
        </button>
      </div>

      <div className="border border-line rounded">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-line">
          <p className="text-sm text-ink">
            Office Name: <span className="font-semibold">{po.officeName}</span>
          </p>
          <p className="text-sm text-ink">
            TOTAL:<span className="font-semibold">{fmt(po.totalAmount)}</span> <span className="text-ink-faint">|</span>{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">{po.poNumber}</span>
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 px-4 py-3">
          <div>
            <Row label="Supplier Name" value={po.supplierName} />
            <Row label="Supplier Address" value={supplier?.address} />
            <Row label="Supplier Mobile" value={supplier?.phone} />
            <Row label="Approved By" value={approved?.actorName} />
            <Row label="Reference No." value={po.referenceNumber} />
            <Row label="Challan Date" value={n.challanDate ? formatDate(n.challanDate) : undefined} />
            <Row label="Delivery Number" value={n.deliveryNumber} />
            <Row label="Requisition No" value={po.requisitionNumber} />
            <Row label="Warehouse" value={po.warehouseName} />
            <Row label="Review Comments" value={review} />
            <Row label="Status" value={status.text} tone={`font-semibold ${status.cls}`} />
          </div>
          <div>
            <Row label="Order Date Time" value={stamp(po.createdAt)} />
            <Row label="Shipment Document Number" value={n.shipmentDoc} />
            <Row label="Ref. Invoice Number" value={n.salesInvoice} />
            <Row label="VAT Challan Number" value={n.vatChallan} />
            <Row label="PO Date" value={formatDate(po.orderDate)} />
            <Row label="Created By" value={po.createdBy} />
            <Row label="VAT/SD/AIT" value="Exclusive" tone="text-blue-600 dark:text-blue-400" />
            <Row label="Shipping Address" value={n.shippingAddress || po.deliveryTerms} />
            <Row label="Remarks" value={n.remarks} />
            <Row label="Expected Receive Date" value={formatDate(po.expectedDeliveryDate)} />
            <Row label="Payment Terms" value={po.paymentTerms} />
            <Row label="Last Modified By" value={modified ? `${modified.actorName} · ${stamp(modified.timestamp)}` : "Not Modified Yet"} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-line" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "ITEMS"} onClick={() => setTab("ITEMS")} className={tabCls("ITEMS")}>
          Item List
        </button>
        <button type="button" role="tab" aria-selected={tab === "ADVANCE"} onClick={() => setTab("ADVANCE")} className={tabCls("ADVANCE")}>
          Advance Payment Details
        </button>
        <button type="button" role="tab" aria-selected={tab === "APPROVAL"} onClick={() => setTab("APPROVAL")} className={tabCls("APPROVAL")}>
          Approval Status
        </button>
      </div>

      {tab === "ITEMS" && (
        <div className="border border-grid-line rounded overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-grid-head text-grid-head-ink font-semibold border-b border-grid-head-line">
                <th className="px-2.5 py-2 border-r border-grid-head-line w-10">SL</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">Code/SKU</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">Item Name</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line text-right">Order Quantity</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line text-right">Received</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line text-right">Unit Price(Tk)</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line text-right">Discount</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line text-right">VAT</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">Specification</th>
                <th className="px-2.5 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((it, i) => (
                <tr key={it.id ?? i} className="border-b border-grid-line">
                  <td className="px-2.5 py-1.5 border-r border-grid-line">{i + 1}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line font-mono">{it.itemCode}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line">
                    {batchItems.has(it.itemId) && <BatchMark />}
                    {it.itemName}
                  </td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">
                    {fmt(it.orderedQuantity)} ({it.uom})
                  </td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmt(it.receivedQuantity)}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmt(it.unitPrice)}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmt(it.discountPercentage)} (%)</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmt(it.taxPercentage)} (%)</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-ink-muted">{it.remarks}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono">{fmt(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "ADVANCE" && (
        <div className="border border-grid-line rounded overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-grid-head text-grid-head-ink font-semibold border-b border-grid-head-line">
                <th className="px-2.5 py-2 border-r border-grid-head-line w-10">SL</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">Payment No</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">Date</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">Method</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">Reference</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">Remarks</th>
                <th className="px-2.5 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {advancesLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-ink-muted">
                    Loading…
                  </td>
                </tr>
              ) : advances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-ink-muted">
                    No advance payment against this order.
                  </td>
                </tr>
              ) : (
                advances.map((a, i) => (
                  <tr key={a.id} className="border-b border-grid-line">
                    <td className="px-2.5 py-1.5 border-r border-grid-line">{i + 1}</td>
                    <td className="px-2.5 py-1.5 border-r border-grid-line font-mono">{a.number}</td>
                    <td className="px-2.5 py-1.5 border-r border-grid-line">{formatDate(a.paymentDate)}</td>
                    <td className="px-2.5 py-1.5 border-r border-grid-line">{a.method}</td>
                    <td className="px-2.5 py-1.5 border-r border-grid-line">{a.referenceNumber || "N/A"}</td>
                    <td className="px-2.5 py-1.5 border-r border-grid-line">{a.remarks || "N/A"}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">{fmt(a.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "APPROVAL" && (
        <div className="border border-grid-line rounded overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-grid-head text-grid-head-ink font-semibold border-b border-grid-head-line">
                <th className="px-3 py-2 border-r border-grid-head-line w-10 text-center">SL</th>
                <th className="px-3 py-2 border-r border-grid-head-line">Action</th>
                <th className="px-3 py-2 border-r border-grid-head-line">Actor Name</th>
                <th className="px-3 py-2 border-r border-grid-head-line">Comment</th>
                <th className="px-3 py-2">Date Time</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink-muted">
                    No approval history recorded yet.
                  </td>
                </tr>
              ) : (
                history.map((h, i) => (
                  <tr key={h.id} className="border-b border-grid-line">
                    <td className="px-3 py-2 border-r border-grid-line text-center">{i + 1}</td>
                    <td className="px-3 py-2 border-r border-grid-line font-semibold text-ink">{h.action.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 border-r border-grid-line">{h.actorName}</td>
                    <td className="px-3 py-2 border-r border-grid-line text-ink-muted">{h.comments || "N/A"}</td>
                    <td className="px-3 py-2 font-mono text-ink-muted">{stamp(h.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          {n.terms && (
            <>
              <p className="text-sm font-semibold text-ink mb-1">Terms And Conditions :</p>
              <p className="whitespace-pre-line text-ink leading-relaxed">{n.terms}</p>
            </>
          )}
        </div>
        <div className="lg:w-80 border border-line rounded divide-y divide-line text-sm">
          <div className="flex justify-between px-3 py-1.5">
            <span>Item Price:</span>
            <span className="font-mono">{fmt(po.subtotal)}</span>
          </div>
          <div className="flex justify-between px-3 py-1.5">
            <span>Total Discount:</span>
            <span className="font-mono">{fmt(po.totalDiscount)}</span>
          </div>
          <div className="flex justify-between px-3 py-1.5">
            <span>Total VAT:</span>
            <span className="font-mono">{fmt(po.totalTax)}</span>
          </div>
          <div className="flex justify-between px-3 py-1.5 font-semibold">
            <span>Total Price:</span>
            <span className="font-mono">{fmt(po.totalAmount)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onClose} className="h-8 px-4 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded font-bold uppercase text-xs">
          Close
        </button>
      </div>
    </div>
  );
}
