"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { amountInWords } from "../../lib/amount-in-words";
import { formatDay } from "../../lib/use-today";
import { paths } from "../../paths";
import { altQty } from "../lib/order-totals";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS, type OrderDetail } from "../schemas/order.schema";
import { fetchOrder } from "../services/order.api";

/**
 * A4 sales order for printing / "Save as PDF". Always light (data-theme) so a
 * dark-mode user never prints light text.
 */
export function OrderPrintView({ id }: { id: string }) {
  const order = useResource(id, () => fetchOrder(id));
  return (
    <div data-theme="light" className="min-h-screen bg-surface text-ink print:min-h-0">
      <div className="mx-auto flex max-w-[210mm] items-center gap-2 px-6 py-3 print:hidden">
        <Link href={paths.order(id)} className={buttonClasses("ghost")}>
          <ArrowLeft aria-hidden="true" />
          Back to order
        </Link>
        <Button variant="primary" className="ml-auto" onClick={() => window.print()} disabled={!order.data}>
          <Printer aria-hidden="true" />
          Print / Save as PDF
        </Button>
      </div>
      {order.error ? (
        <ErrorState message={errorMessage(order.error)} onRetry={order.reload} />
      ) : !order.data ? (
        <LoadingState />
      ) : (
        <PrintDocument order={order.data} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-1">
      <dt className="text-ink-muted">{label}</dt>
      <dd>: {value || "N/A"}</dd>
    </div>
  );
}

function PrintDocument({ order }: { order: OrderDetail }) {
  const altTotal = order.lines.reduce((sum, line) => sum + (altQty(line.qty, line.altUomFactor) ?? 0), 0);
  return (
    <article className="mx-auto flex max-w-[210mm] flex-col gap-4 px-6 pb-10 text-[11px] leading-snug print:px-0 print:pb-0">
      <header className="flex items-start justify-between gap-4 border-b border-line-strong pb-3">
        <div>
          <h1 className="text-lg font-bold">{order.companyName}</h1>
          <p className="font-medium">{order.officeName}</p>
          <p className="text-ink-muted">{order.officeAddress}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold tracking-wide">SALES ORDER</p>
          <p className="font-medium">{order.number}</p>
          <p className="text-ink-muted">{ORDER_STATUS_LABELS[order.status]}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1">
        <dl className="flex flex-col gap-0.5">
          <Row label="Customer" value={`${order.customerName} (${order.customerCode})`} />
          <Row label="Mobile" value={order.customerPhone} />
          <Row label="Billing Address" value={order.billingAddress} />
          <Row label="Shipping Address" value={order.shippingAddress} />
          <Row label="Contact To" value={order.contactPerson} />
          <Row label="Territory" value={order.territory} />
          <Row label="Sales Force" value={order.salesPersonName} />
        </dl>
        <dl className="flex flex-col gap-0.5">
          <Row label="Order Date" value={formatDay(order.orderDate)} />
          <Row label="Exp. Delivery" value={formatDay(order.expectedDeliveryDate)} />
          <Row label="Type" value={ORDER_TYPE_LABELS[order.orderType]} />
          <Row label="Payment" value={`${PAYMENT_METHOD_LABELS[order.paymentMethod]} · ${order.paymentTermDays} days`} />
          <Row label="Customer PO" value={[order.refCustomerPo, order.refCustomerPoDate && formatDay(order.refCustomerPoDate)].filter(Boolean).join(" · ")} />
          <Row label="Quotation No" value={order.quotationNumber} />
          <Row label="VAT" value={order.priceIncludesVat ? "Inclusive" : "Exclusive"} />
        </dl>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-line-strong text-left">
            {["SL", "Code", "Item", "UOM", "Qty", "Alt. Qty", "Price", "Disc %", "VAT %", "Total"].map((header, index) => (
              <th key={header} scope="col" className={index >= 4 ? "px-1.5 py-1 text-right" : "px-1.5 py-1"}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => {
            const alt = altQty(line.qty, line.altUomFactor);
            return (
              <tr key={line.id} className="border-b border-line break-inside-avoid">
                <td className="px-1.5 py-1">{line.lineNo}</td>
                <td className="px-1.5 py-1 whitespace-nowrap">{line.itemCode}</td>
                <td className="px-1.5 py-1">{line.itemName}</td>
                <td className="px-1.5 py-1">{line.uom}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{formatQty(line.qty)}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{alt === null ? "" : `${formatQty(alt)} ${line.altUom}`}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{line.unitPrice.toFixed(2)}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{line.discountPercent.toFixed(2)}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{line.vatPercent.toFixed(2)}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{formatAmount(line.lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-b border-line-strong font-semibold">
            <td colSpan={4} className="px-1.5 py-1 text-right">
              Total
            </td>
            <td className="px-1.5 py-1 text-right tabular-nums">{formatQty(order.totalQty)}</td>
            <td className="px-1.5 py-1 text-right tabular-nums">{altTotal ? formatQty(Math.round(altTotal * 1000) / 1000) : ""}</td>
            <td colSpan={3} />
            <td className="px-1.5 py-1 text-right tabular-nums">{formatAmount(order.itemsTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <section className="flex items-start justify-between gap-6 break-inside-avoid">
        <div className="flex flex-1 flex-col gap-2">
          <p>
            <span className="font-semibold">Amount in Words: </span>
            {amountInWords(order.salesTotal)}
          </p>
          {order.terms && (
            <div>
              <p className="font-semibold">Terms &amp; Conditions:</p>
              <p className="whitespace-pre-line">{order.terms}</p>
            </div>
          )}
          <p>
            <span className="font-semibold">Remarks: </span>
            {order.remarks ?? "N/A"}
          </p>
        </div>
        <dl className="flex w-60 flex-col gap-0.5">
          {[
            ["Total", order.itemsTotal],
            ["Discount", order.discountAmount],
            ["Item Price (without VAT)", order.itemsBase],
            ["Total VAT", order.vatAmount],
            ["Total AIT", order.aitAmount],
            ["Delivery Charge", order.deliveryCharge],
            ["Unloading Charge", order.unloadingCharge],
          ]
            .filter(([label, value]) => value !== 0 || label === "Total" || label === "Total VAT")
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt>{label}</dt>
                <dd className="tabular-nums">{formatAmount(value as number)}</dd>
              </div>
            ))}
          <div className="mt-1 flex justify-between gap-2 border-t border-line-strong pt-1 font-semibold">
            <dt>Sales Total</dt>
            <dd className="tabular-nums">{formatAmount(order.salesTotal)}</dd>
          </div>
        </dl>
      </section>

      <footer className="mt-12 grid grid-cols-3 gap-6 text-center break-inside-avoid">
        {["Prepared By", "Checked By", "Authorised By"].map((label) => (
          <p key={label} className="border-t border-line-strong pt-1">
            {label}
          </p>
        ))}
      </footer>
      <p className="text-right text-[9px] text-ink-faint">Printed {formatDateTime(new Date())}</p>
    </article>
  );
}
