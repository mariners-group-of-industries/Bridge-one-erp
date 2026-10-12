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
import { altQty } from "../../orders/lib/order-totals";
import { PAYMENT_METHOD_LABELS } from "../../orders/schemas/order.schema";
import { paths } from "../../paths";
import type { DeliveryDetail } from "../schemas/delivery.schema";
import { fetchDelivery } from "../services/delivery.api";

export type PrintDoc = "challan" | "challan-plain" | "mushak" | "invoice";
const TITLES: Record<PrintDoc, string> = {
  challan: "Delivery Challan",
  "challan-plain": "Delivery Challan",
  mushak: "Mushak 6.3",
  invoice: "Sales Invoice",
};

/** A4 documents for a delivery. Always light so dark mode never prints light text. */
export function DeliveryPrintView({ id, doc }: { id: string; doc: PrintDoc }) {
  const delivery = useResource(id, () => fetchDelivery(id));
  return (
    <div data-theme="light" className="min-h-screen bg-surface text-ink print:min-h-0">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-2 px-6 py-3 print:hidden">
        <Link href={paths.delivery(id)} className={buttonClasses("ghost")}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Link>
        {(Object.keys(TITLES) as PrintDoc[]).map((option) => (
          <Link key={option} href={paths.printDelivery(id, option)} aria-current={option === doc ? "page" : undefined} className={buttonClasses(option === doc ? "secondary" : "ghost", "sm")}>
            {option === "challan-plain" ? "Challan (no header)" : TITLES[option]}
          </Link>
        ))}
        <Button variant="primary" className="ml-auto" onClick={() => window.print()} disabled={!delivery.data}>
          <Printer aria-hidden="true" />
          Print / Save as PDF
        </Button>
      </div>
      {delivery.error ? (
        <ErrorState message={errorMessage(delivery.error)} onRetry={delivery.reload} />
      ) : !delivery.data ? (
        <LoadingState />
      ) : doc === "mushak" ? (
        <Mushak delivery={delivery.data} />
      ) : (
        <ChallanOrInvoice delivery={delivery.data} doc={doc} />
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

function CompanyHeader({ delivery, title }: { delivery: DeliveryDetail; title: string }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line-strong pb-3">
      <div>
        <h1 className="text-lg font-bold">{delivery.companyName}</h1>
        <p className="font-medium">{delivery.officeName}</p>
        <p className="text-ink-muted">{delivery.officeAddress}</p>
        {delivery.officeBin && <p className="text-ink-muted">BIN: {delivery.officeBin}</p>}
      </div>
      <div className="text-right">
        <p className="text-base font-bold tracking-wide uppercase">{title}</p>
        <p className="font-medium">{title.includes("Challan") ? delivery.challanNo : delivery.number}</p>
      </div>
    </header>
  );
}

function ChallanOrInvoice({ delivery, doc }: { delivery: DeliveryDetail; doc: Exclude<PrintDoc, "mushak"> }) {
  const priced = doc === "invoice";
  const altTotal = delivery.lines.reduce((sum, line) => sum + (altQty(line.qty, line.altUomFactor) ?? 0), 0);
  return (
    <article className="mx-auto flex max-w-[210mm] flex-col gap-4 px-6 pb-10 text-[11px] leading-snug print:px-0 print:pb-0">
      {doc === "challan-plain" ? (
        // Pre-printed letterhead: leave room for it and print only the title.
        <header className="flex items-end justify-between border-b border-line-strong pt-24 pb-2">
          <p className="text-base font-bold tracking-wide uppercase">Delivery Challan</p>
          <p className="font-medium">{delivery.challanNo}</p>
        </header>
      ) : (
        <CompanyHeader delivery={delivery} title={TITLES[doc]} />
      )}

      <section className="grid grid-cols-2 gap-x-6">
        <dl className="flex flex-col gap-0.5">
          <Row label="Customer" value={`${delivery.customerName} (${delivery.customerCode})`} />
          <Row label="Mobile" value={delivery.customerPhone} />
          <Row label="Billing Address" value={delivery.billingAddress} />
          <Row label="Shipping Address" value={delivery.shippingAddress} />
          <Row label="Contact To" value={delivery.contactPerson} />
          <Row label="Sales Force" value={delivery.salesPersonName} />
        </dl>
        <dl className="flex flex-col gap-0.5">
          <Row label="Invoice No" value={delivery.number} />
          <Row label="Challan No" value={delivery.challanNo} />
          <Row label="Delivery Date" value={`${formatDay(delivery.deliveryDate)}${delivery.deliveryTime ? ` ${delivery.deliveryTime}` : ""}`} />
          <Row label="Sales Order" value={delivery.orderNumber} />
          <Row label="Customer PO" value={[delivery.refCustomerPo, delivery.refCustomerPoDate && formatDay(delivery.refCustomerPoDate)].filter(Boolean).join(" · ")} />
          <Row label="Warehouse" value={delivery.warehouseName} />
          <Row label="Vehicle" value={[delivery.vehicleNo, delivery.driverName, delivery.driverPhone].filter(Boolean).join(" · ")} />
          {priced && <Row label="Payment" value={`${PAYMENT_METHOD_LABELS[delivery.paymentMethod]} · due ${formatDay(delivery.dueDate)}`} />}
        </dl>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-line-strong text-left">
            {(priced ? ["SL", "Code", "Item", "Qty", "Alt. Qty", "Price", "Disc %", "VAT %", "Total"] : ["SL", "Code", "Item", "Delivery Qty", "Delivery Alt. Qty"]).map((header, index) => (
              <th key={header} scope="col" className={index >= 3 ? "px-1.5 py-1 text-right" : "px-1.5 py-1"}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {delivery.lines.map((line) => {
            const alt = altQty(line.qty, line.altUomFactor);
            return (
              <tr key={line.id} className="border-b border-line break-inside-avoid">
                <td className="px-1.5 py-1">{line.lineNo}</td>
                <td className="px-1.5 py-1 whitespace-nowrap">{line.itemCode}</td>
                <td className="px-1.5 py-1">{line.itemName}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {formatQty(line.qty)} {line.uom}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">{alt === null ? "" : `${formatQty(alt)} ${line.altUom}`}</td>
                {priced && (
                  <>
                    <td className="px-1.5 py-1 text-right tabular-nums">{line.rate.toFixed(2)}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums">{line.discountPercent.toFixed(2)}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums">{line.vatPercent.toFixed(2)}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums">{formatAmount(line.amount)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-b border-line-strong font-semibold">
            <td colSpan={3} className="px-1.5 py-1 text-right">
              Total
            </td>
            <td className="px-1.5 py-1 text-right tabular-nums">{formatQty(delivery.totalQty)}</td>
            <td className="px-1.5 py-1 text-right tabular-nums">{altTotal ? formatQty(Math.round(altTotal * 1000) / 1000) : ""}</td>
            {priced && (
              <>
                <td colSpan={3} />
                <td className="px-1.5 py-1 text-right tabular-nums">{formatAmount(delivery.itemsTotal)}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>

      {priced && (
        <section className="flex items-start justify-between gap-6 break-inside-avoid">
          <p className="flex-1">
            <span className="font-semibold">Amount in Words: </span>
            {amountInWords(delivery.totalAmount)}
          </p>
          <dl className="flex w-60 flex-col gap-0.5">
            {[
              ["Item Price", delivery.itemsTotal],
              ["Discount", -delivery.discountAmount],
              ["Total VAT", delivery.vatAmount],
              ["Delivery Charge", delivery.deliveryCharge],
              ["Unloading Charge", delivery.unloadingCharge],
            ]
              .filter(([label, value]) => value !== 0 || label === "Item Price")
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt>{label}</dt>
                  <dd className="tabular-nums">{formatAmount(value as number)}</dd>
                </div>
              ))}
            <div className="mt-1 flex justify-between gap-2 border-t border-line-strong pt-1 font-semibold">
              <dt>Sales Total</dt>
              <dd className="tabular-nums">{formatAmount(delivery.totalAmount)}</dd>
            </div>
            {delivery.paidAmount > 0 && (
              <div className="flex justify-between gap-2">
                <dt>Paid</dt>
                <dd className="tabular-nums">{formatAmount(delivery.paidAmount)}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {delivery.terms && (
        <div>
          <p className="font-semibold">Terms &amp; Conditions:</p>
          <p className="whitespace-pre-line">{delivery.terms}</p>
        </div>
      )}
      <p>
        <span className="font-semibold">Remarks: </span>
        {delivery.remarks ?? "N/A"}
      </p>

      <footer className="mt-12 grid grid-cols-3 gap-6 text-center break-inside-avoid">
        {(priced ? ["Prepared By", "Checked By", "Authorised By"] : ["Delivered By", "Driver", "Received By (Customer)"]).map((label) => (
          <p key={label} className="border-t border-line-strong pt-1">
            {label}
          </p>
        ))}
      </footer>
      <p className="text-right text-[9px] text-ink-faint">Printed {formatDateTime(new Date())}</p>
    </article>
  );
}

/** NBR Mushak-6.3 tax invoice layout (seller/buyer BIN, per-line SD and VAT). */
function Mushak({ delivery }: { delivery: DeliveryDetail }) {
  return (
    <article className="mx-auto flex max-w-[210mm] flex-col gap-3 px-6 pb-10 text-[10.5px] leading-snug print:px-0 print:pb-0">
      <header className="flex items-start justify-between">
        <div className="w-24" />
        <div className="text-center">
          <p>Government of the People&apos;s Republic of Bangladesh</p>
          <p className="font-semibold">National Board of Revenue</p>
          <p className="mt-1 text-sm font-bold">Tax Invoice</p>
          <p>[See clauses (ga) and (cha) of sub-rule (1) of rule 40]</p>
        </div>
        <p className="w-24 border border-line-strong px-2 py-1 text-center font-bold">Mushak-6.3</p>
      </header>

      <dl className="flex flex-col gap-0.5 text-center">
        <p>
          Name of registered person: <span className="font-semibold">{delivery.companyName}</span>
        </p>
        <p>BIN of registered person: {delivery.officeBin ?? "—"}</p>
        <p>Address of invoice issuance: {delivery.officeAddress}</p>
      </dl>

      <section className="grid grid-cols-2 gap-x-6">
        <dl className="flex flex-col gap-0.5">
          <Row label="Buyer's name" value={delivery.customerName} />
          <Row label="Buyer's BIN" value={delivery.customerBin} />
          <Row label="Buyer's address" value={delivery.billingAddress} />
          <Row label="Destination" value={delivery.shippingAddress} />
          <Row label="Vehicle type & no." value={delivery.vehicleNo} />
        </dl>
        <dl className="flex flex-col gap-0.5">
          <Row label="Invoice no." value={delivery.vatChallanNo || delivery.number} />
          <Row label="Date of issue" value={formatDay(delivery.deliveryDate)} />
          <Row label="Time of issue" value={delivery.deliveryTime} />
          <Row label="Challan no." value={delivery.challanNo} />
        </dl>
      </section>

      <table className="w-full border-collapse border border-line-strong">
        <thead>
          <tr className="text-center">
            {["SL", "Description of goods", "Unit", "Quantity", "Unit price (Tk)", "Total price (Tk)", "SD rate", "SD (Tk)", "VAT rate", "VAT (Tk)", "Total incl. all duties & taxes (Tk)"].map((header) => (
              <th key={header} scope="col" className="border border-line-strong px-1 py-1 font-semibold">
                {header}
              </th>
            ))}
          </tr>
          <tr className="text-center text-[9px]">
            {Array.from({ length: 11 }, (_, index) => (
              <td key={index} className="border border-line-strong">
                ({index + 1})
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {delivery.lines.map((line) => {
            const unitBase = line.qty > 0 ? line.baseAmount / line.qty : 0;
            return (
              <tr key={line.id} className="break-inside-avoid">
                <td className="border border-line-strong px-1 py-1 text-center">{line.lineNo}</td>
                <td className="border border-line-strong px-1 py-1">{line.itemName}</td>
                <td className="border border-line-strong px-1 py-1 text-center">{line.uom}</td>
                <td className="border border-line-strong px-1 py-1 text-right tabular-nums">{formatQty(line.qty)}</td>
                <td className="border border-line-strong px-1 py-1 text-right tabular-nums">{unitBase.toFixed(2)}</td>
                <td className="border border-line-strong px-1 py-1 text-right tabular-nums">{formatAmount(line.baseAmount)}</td>
                <td className="border border-line-strong px-1 py-1 text-right tabular-nums">0%</td>
                <td className="border border-line-strong px-1 py-1 text-right tabular-nums">0.00</td>
                <td className="border border-line-strong px-1 py-1 text-right tabular-nums">{line.vatPercent}%</td>
                <td className="border border-line-strong px-1 py-1 text-right tabular-nums">{formatAmount(line.vatAmount)}</td>
                <td className="border border-line-strong px-1 py-1 text-right tabular-nums">{formatAmount(line.amount)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={5} className="border border-line-strong px-1 py-1 text-right">
              Total
            </td>
            <td className="border border-line-strong px-1 py-1 text-right tabular-nums">{formatAmount(delivery.itemsBase)}</td>
            <td className="border border-line-strong" />
            <td className="border border-line-strong px-1 py-1 text-right tabular-nums">0.00</td>
            <td className="border border-line-strong" />
            <td className="border border-line-strong px-1 py-1 text-right tabular-nums">{formatAmount(delivery.vatAmount)}</td>
            <td className="border border-line-strong px-1 py-1 text-right tabular-nums">{formatAmount(delivery.itemsTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <footer className="mt-12 flex justify-between gap-6 break-inside-avoid">
        <div>
          <p>Name of authorised person:</p>
          <p>Designation:</p>
        </div>
        <p className="w-48 border-t border-line-strong pt-1 text-center">Signature</p>
      </footer>
      <p className="text-right text-[9px] text-ink-faint">Printed {formatDateTime(new Date())}</p>
    </article>
  );
}
