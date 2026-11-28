"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, FileText, List } from "lucide-react";
import type { PurchaseOrder } from "@bridgeone/contracts";
import { fetchApi } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

interface AdvanceRow {
  orderNumber: string;
  amount: number;
}

const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The reference ERP's "Close Purchase Order" screen: the order's items with
 * ordered / received / remaining quantity and its totals, then Cancel or Close Order.
 */
export function ClosePurchaseOrderDialog({
  po,
  pending,
  onCancel,
  onConfirm,
}: {
  po: PurchaseOrder | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (po: PurchaseOrder) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const { data: advance = 0 } = useQuery<AdvanceRow[], Error, number>({
    queryKey: ["supplierAdvances", "details", "order", po?.poNumber],
    enabled: Boolean(po),
    queryFn: () => fetchApi("/purchase/supplier-payments/advances?details=true"),
    select: (rows) => rows.filter((r) => r.orderNumber === po?.poNumber).reduce((s, r) => s + Number(r.amount || 0), 0),
  });

  useEffect(() => {
    if (!po) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [po, pending, onCancel]);

  if (!po) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface" role="dialog" aria-modal="true" aria-labelledby="close-po-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-9 sm:py-4">
        <h2 id="close-po-title" className="text-lg font-medium text-ink">
          Close Purchase Order
        </h2>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={pending} className="h-8 min-w-20 px-4 rounded bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-60">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(po)}
            disabled={pending}
            className="h-8 min-w-24 px-4 rounded bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {pending && <Spinner className="size-3.5" />}
            Close Order
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-9 space-y-2">
        <div className="rounded border border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <p className="inline-flex items-center gap-3 text-lg text-ink">
              <FileText className="size-5" aria-hidden /> Order Details
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink-muted">PURCHASE TOTAL</span>
              <span className="text-lg font-medium text-ink">{fmt(po.totalAmount)}</span>
              <span className="text-ink-muted">PO NO:</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">{po.poNumber}</span>
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                aria-label={showDetails ? "Hide order details" : "Show order details"}
                aria-expanded={showDetails}
                className="ml-2 inline-flex size-8 items-center justify-center rounded hover:bg-hover"
              >
                {showDetails ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
            </div>
          </div>
          {showDetails && (
            <div className="grid grid-cols-1 gap-x-8 gap-y-1 border-t border-line px-4 py-3 text-xs sm:grid-cols-3 sm:px-6">
              <p>
                <span className="font-semibold">Supplier:</span> {po.supplierName}
              </p>
              <p>
                <span className="font-semibold">Warehouse:</span> {po.warehouseName}
              </p>
              <p>
                <span className="font-semibold">PO Date:</span> {po.orderDate}
              </p>
            </div>
          )}
        </div>

        <div className="rounded border border-line">
          <div className="px-4 pt-5 pb-4 sm:px-6">
            <p className="inline-flex items-center gap-3 text-lg text-ink">
              <List className="size-5" aria-hidden /> Item Lists
            </p>
            <label className="mt-4 block max-w-60 text-xs text-ink-muted">
              Office
              <input readOnly value={po.officeName} className="mt-1 h-7 w-full rounded border border-line-strong bg-canvas px-2 text-xs text-ink" />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="bg-grid-head text-grid-head-ink font-semibold border-y border-grid-head-line">
                  <th className="px-2 py-2 border-r border-grid-head-line">Item Code</th>
                  <th className="px-2 py-2 border-r border-grid-head-line">Name</th>
                  <th className="px-2 py-2 border-r border-grid-head-line text-center">Order QTY</th>
                  <th className="px-2 py-2 border-r border-grid-head-line text-center">Received QTY</th>
                  <th className="px-2 py-2 text-center">Remaining QTY</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((it, i) => (
                  <tr key={it.id ?? i} className="border-b border-grid-line">
                    <td className="px-2 py-1.5 border-r border-grid-line font-mono">{it.itemCode}</td>
                    <td className="px-2 py-1.5 border-r border-grid-line">{it.itemName}</td>
                    <td className="px-2 py-1.5 border-r border-grid-line text-center font-mono">{it.orderedQuantity}</td>
                    <td className="px-2 py-1.5 border-r border-grid-line text-center font-mono">{it.receivedQuantity}</td>
                    <td className="px-2 py-1.5 text-center font-mono">{it.outstandingQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-sm rounded border border-line p-4 text-sm shadow-xs">
            <div className="flex justify-between border-b border-line py-1.5">
              <span>Item Price:</span>
              <span className="font-mono">{fmt(po.subtotal - po.totalDiscount)}</span>
            </div>
            <div className="flex justify-between border-b border-line py-1.5">
              <span>Total VAT (Tk):</span>
              <span className="font-mono">{fmt(po.totalTax)}</span>
            </div>
            <div className="flex justify-between py-1.5 font-semibold">
              <span>Advance Amount:</span>
              <span className="font-mono">{fmt(advance)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
