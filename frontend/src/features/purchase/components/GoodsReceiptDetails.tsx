"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import type { GoodsReceipt, Supplier } from "@bridgeone/contracts";
import { fetchApi } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Receipt = GoodsReceipt & {
  challanNumber?: string;
  gatePassNumber?: string;
  remarks?: string;
  vatChallanNumber?: string;
  supplierInvoiceNumber?: string;
};

interface Voucher {
  voucherNumber: string;
  transactionDate: string;
  narration: string;
  status: string;
  totalDebit: number;
  totalCredit: number;
  lines: { accountCode: string; accountName: string; partnerName?: string; narration?: string; debit: number; credit: number }[];
}

type Tab = "ITEMS" | "ACCOUNTING" | "APPROVAL";

const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const stamp = (iso?: string) => {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDate(iso.slice(0, 10))} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};

function Row({ label, value, tone }: { label: string; value?: React.ReactNode; tone?: string }) {
  return (
    <div className="grid grid-cols-[150px_12px_1fr] items-start py-[1px]">
      <span className="font-semibold text-ink">{label}</span>
      <span className="text-ink-faint">:</span>
      <span className={tone ?? "text-ink-muted"}>{value === undefined || value === null || value === "" ? "N/A" : value}</span>
    </div>
  );
}

export function GoodsReceiptDetails({
  grn,
  supplier,
  status,
  onClose,
  onPrint,
}: {
  grn: Receipt;
  supplier?: Supplier;
  status: { text: string; cls: string };
  onClose: () => void;
  onPrint: () => void;
}) {
  const [tab, setTab] = useState<Tab>("ITEMS");
  const isDirect = grn.poNumber === "DIRECT-PO";
  const totalQty = grn.items.reduce((s, it) => s + Number(it.currentReceivedQuantity || 0) - Number(it.rejectedDamagedQuantity || 0), 0);
  const itemPrice = grn.items.reduce((s, it) => s + Number(it.lineTotal || 0), 0);

  const { data: voucher, isLoading: voucherLoading, error: voucherError } = useQuery<Voucher | null>({
    queryKey: ["grnAccounting", grn.id],
    enabled: tab === "ACCOUNTING",
    queryFn: () => fetchApi(`/purchase/receipts/${grn.id}/accounting`),
  });

  const tabCls = (t: Tab) =>
    `min-h-6 pb-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
      tab === t ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]" : "text-ink-faint hover:text-ink"
    }`;

  return (
    <div className="space-y-4 text-xs">
      <div className="border border-line rounded">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-line text-sm text-ink">
          <p>
            Office Name: <span className="font-semibold">{grn.officeName}</span>
          </p>
          <p>
            Warehouse Name: <span className="font-semibold">{grn.warehouseName}</span>
          </p>
          <p>
            TOTAL: <span className="font-semibold">{fmt(grn.totalReceivedAmount)}</span> <span className="text-ink-faint">|</span>{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">{grn.grnNumber}</span>
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 px-4 py-3">
          <div>
            <Row label="Supplier Name" value={supplier?.code ? `${supplier.code} - ${grn.supplierName}${supplier.phone ? ` (${supplier.phone})` : ""}` : grn.supplierName} />
            <Row label="Supplier Address" value={supplier?.address} />
            <Row label="Supplier Mobile" value={supplier?.phone} />
            <Row label="PO No" value={isDirect ? "Direct" : grn.poNumber} />
            <Row label="Request No" value={grn.requisitionNumber} />
            <Row label="Challan No" value={grn.challanNumber} />
            <Row label="VAT Challan No" value={grn.vatChallanNumber} />
            <Row label="VAT" value="Exclusive" />
          </div>
          <div>
            <Row label="Receive Date Time" value={stamp(grn.createdAt)} />
            <Row label="Receive Date" value={formatDate(grn.receiptDate)} />
            <Row label="Created By" value={grn.preparedBy} />
            <Row label="Sales Invoice No" value={grn.supplierInvoiceNumber} />
            <Row label="Delivery No" value={grn.gatePassNumber} />
            <Row label="Remarks" value={grn.remarks} />
            <Row label="Status" value={status.text} tone={`font-semibold ${status.cls}`} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-line">
        <div className="flex items-center gap-6" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "ITEMS"} onClick={() => setTab("ITEMS")} className={tabCls("ITEMS")}>
            Item List
          </button>
          <button type="button" role="tab" aria-selected={tab === "ACCOUNTING"} onClick={() => setTab("ACCOUNTING")} className={tabCls("ACCOUNTING")}>
            Accounting
          </button>
          <button type="button" role="tab" aria-selected={tab === "APPROVAL"} onClick={() => setTab("APPROVAL")} className={tabCls("APPROVAL")}>
            Approval Status
          </button>
        </div>
        <button type="button" onClick={onPrint} aria-label="Print goods receipt" className="mb-1 inline-flex size-8 items-center justify-center rounded text-blue-600 hover:bg-hover print:hidden">
          <Printer className="size-4" />
        </button>
      </div>

      {tab === "ITEMS" && (
        <div className="border border-grid-line rounded overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-grid-head text-grid-head-ink font-semibold border-b border-grid-head-line">
                <th className="px-2.5 py-2 border-r border-grid-head-line">Item Code</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">Item Name</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">UOM</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line text-right">Order QTY</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line text-right">Receive QTY</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line text-right">Rejected</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line">Specification</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line text-right">Unit Price(BDT)</th>
                <th className="px-2.5 py-2 border-r border-grid-head-line text-right">VAT</th>
                <th className="px-2.5 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {grn.items.map((it, i) => (
                <tr key={it.id ?? i} className="border-b border-grid-line">
                  <td className="px-2.5 py-1.5 border-r border-grid-line font-mono">{it.itemCode}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line">{it.itemName}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line">{it.uom}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmt(it.orderedQuantity)}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">
                    {fmt(it.currentReceivedQuantity)}({it.uom})
                  </td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmt(it.rejectedDamagedQuantity)}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-ink-muted">{it.remarks}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmt(it.unitPrice)}</td>
                  <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmt(it.taxPercentage ?? 0)} (%)</td>
                  <td className="px-2.5 py-1.5 text-right font-mono">{fmt(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "ACCOUNTING" && (
        <div className="border border-grid-line rounded overflow-x-auto">
          {voucherLoading ? (
            <p className="px-3 py-6 text-center text-ink-muted">Loading…</p>
          ) : voucherError ? (
            <p className="px-3 py-6 text-center text-rose-600">{(voucherError as Error).message}</p>
          ) : !voucher ? (
            <p className="px-3 py-6 text-center text-ink-muted">No journal voucher has been posted for this receipt yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-1 px-3 py-2 border-b border-grid-line">
                <span>
                  Voucher: <span className="font-mono font-semibold">{voucher.voucherNumber}</span>
                </span>
                <span>Date: {formatDate(voucher.transactionDate)}</span>
                <span>Status: {voucher.status}</span>
                <span className="text-ink-muted">{voucher.narration}</span>
              </div>
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-grid-head text-grid-head-ink font-semibold border-b border-grid-head-line">
                    <th className="px-2.5 py-2 border-r border-grid-head-line">Account Code</th>
                    <th className="px-2.5 py-2 border-r border-grid-head-line">Account Name</th>
                    <th className="px-2.5 py-2 border-r border-grid-head-line">Partner</th>
                    <th className="px-2.5 py-2 border-r border-grid-head-line text-right">Debit</th>
                    <th className="px-2.5 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {voucher.lines.map((l, i) => (
                    <tr key={i} className="border-b border-grid-line">
                      <td className="px-2.5 py-1.5 border-r border-grid-line font-mono">{l.accountCode}</td>
                      <td className="px-2.5 py-1.5 border-r border-grid-line">{l.accountName}</td>
                      <td className="px-2.5 py-1.5 border-r border-grid-line">{l.partnerName || ""}</td>
                      <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{l.debit ? fmt(l.debit) : ""}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">{l.credit ? fmt(l.credit) : ""}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan={3} className="px-2.5 py-1.5 border-r border-grid-line text-right">
                      Total
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmt(voucher.totalDebit)}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">{fmt(voucher.totalCredit)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tab === "APPROVAL" && (
        <div className="border border-grid-line rounded overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-grid-head text-grid-head-ink font-semibold border-b border-grid-head-line">
                <th className="px-3 py-2 border-r border-grid-head-line w-10 text-center">SL</th>
                <th className="px-3 py-2 border-r border-grid-head-line">Status</th>
                <th className="px-3 py-2 border-r border-grid-head-line">Prepared By</th>
                <th className="px-3 py-2">Date Time</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-grid-line">
                <td className="px-3 py-2 border-r border-grid-line text-center">1</td>
                <td className={`px-3 py-2 border-r border-grid-line font-semibold ${status.cls}`}>{status.text}</td>
                <td className="px-3 py-2 border-r border-grid-line">{grn.preparedBy}</td>
                <td className="px-3 py-2 font-mono text-ink-muted">{stamp(grn.createdAt)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <div className="w-full sm:w-80 border border-line rounded divide-y divide-line text-sm">
          <div className="flex justify-between px-3 py-1.5">
            <span>Total Qty:</span>
            <span className="font-mono">{fmt(totalQty)}</span>
          </div>
          <div className="flex justify-between px-3 py-1.5">
            <span>Item Price:</span>
            <span className="font-mono">{fmt(itemPrice)}</span>
          </div>
          <div className="flex justify-between px-3 py-1.5 font-semibold">
            <span>Total Price:</span>
            <span className="font-mono">{fmt(grn.totalReceivedAmount)}</span>
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
