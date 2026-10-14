"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { amountInWords } from "../../lib/amount-in-words";
import { formatDay } from "../../lib/use-today";
import { paths } from "../../paths";
import { RETURN_KIND_LABELS, RETURN_MODE_LABELS, RETURN_STATUS_LABELS, type ReturnDetail } from "../schemas/return.schema";
import { fetchReturn } from "../services/return.api";

/** A4 sales return (credit note). Always light so dark mode never prints light text. */
export function ReturnPrintView({ id }: { id: string }) {
  const record = useResource(id, () => fetchReturn(id));
  return (
    <div data-theme="light" className="min-h-screen bg-surface text-ink print:min-h-0">
      <div className="mx-auto flex max-w-[210mm] items-center gap-2 px-6 py-3 print:hidden">
        <Link href={paths.salesReturn(id)} className={buttonClasses("ghost")}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Link>
        <Button variant="primary" className="ml-auto" onClick={() => window.print()} disabled={!record.data}>
          <Printer aria-hidden="true" />
          Print / Save as PDF
        </Button>
      </div>
      {record.error ? (
        <ErrorState message={errorMessage(record.error)} onRetry={record.reload} />
      ) : !record.data ? (
        <LoadingState />
      ) : (
        <ReturnDocument record={record.data} />
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

function ReturnDocument({ record }: { record: ReturnDetail }) {
  const market = record.kind === "MARKET";
  return (
    <article className="mx-auto flex max-w-[210mm] flex-col gap-4 px-6 pb-10 text-[11px] leading-snug print:px-0 print:pb-0">
      <header className="flex items-start justify-between gap-4 border-b border-line-strong pb-3">
        <div>
          <h1 className="text-lg font-bold">{record.companyName}</h1>
          <p className="font-medium">{record.officeName}</p>
          <p className="text-ink-muted">{record.officeAddress}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold tracking-wide uppercase">{RETURN_KIND_LABELS[record.kind]}</p>
          <p className="font-medium">{record.number}</p>
          {record.status !== "SUBMITTED" && <p className="font-semibold text-danger uppercase">{RETURN_STATUS_LABELS[record.status]}</p>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-6">
        <dl className="flex flex-col gap-0.5">
          <Row label="Customer" value={`${record.customerName} (${record.customerCode})`} />
          <Row label="Mobile" value={record.customerPhone} />
          <Row label="Address" value={record.shippingAddress ?? record.customerAddress} />
          <Row label="Territory" value={record.territory} />
          <Row label="Sales Force" value={record.salesPersonName} />
          <Row label="Return Reason" value={record.reason} />
        </dl>
        <dl className="flex flex-col gap-0.5">
          <Row label="Return Date" value={formatDay(record.returnDate)} />
          <Row label="Return Type" value={RETURN_MODE_LABELS[record.mode]} />
          <Row label="Sales Invoice" value={record.deliveryNumber} />
          <Row label="Challan No" value={record.challanNo} />
          <Row label="Warehouse" value={record.warehouseName} />
          <Row label="Return Ref. No" value={[record.refNo, record.refDate && formatDay(record.refDate)].filter(Boolean).join(" · ")} />
          <Row label="Return Req. No" value={record.requestNo} />
        </dl>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-line-strong text-left">
            {["SL", "Code", "Item", "Reason", "Qty", "Price", "VAT %", "VAT", "Total", ...(market ? ["Factory Rec.", "QC Passed"] : [])].map((header, index) => (
              <th key={header} scope="col" className={index >= 4 ? "px-1.5 py-1 text-right" : "px-1.5 py-1"}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {record.lines.map((line) => (
            <tr key={line.id} className="border-b border-line break-inside-avoid">
              <td className="px-1.5 py-1">{line.lineNo}</td>
              <td className="px-1.5 py-1 whitespace-nowrap">{line.itemCode}</td>
              <td className="px-1.5 py-1">{line.itemName}</td>
              <td className="px-1.5 py-1">{line.reason ?? ""}</td>
              <td className="px-1.5 py-1 text-right tabular-nums">
                {formatQty(line.qty)} {line.uom}
              </td>
              <td className="px-1.5 py-1 text-right tabular-nums">{line.rate.toFixed(2)}</td>
              <td className="px-1.5 py-1 text-right tabular-nums">{line.vatPercent.toFixed(2)}</td>
              <td className="px-1.5 py-1 text-right tabular-nums">{formatAmount(line.vatAmount)}</td>
              <td className="px-1.5 py-1 text-right tabular-nums">{formatAmount(line.amount)}</td>
              {market && <td className="px-1.5 py-1 text-right tabular-nums">{line.receivedQty === null ? "" : formatQty(line.receivedQty)}</td>}
              {market && <td className="px-1.5 py-1 text-right tabular-nums">{line.qcQty === null ? "" : formatQty(line.qcQty)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-b border-line-strong font-semibold">
            <td colSpan={4} className="px-1.5 py-1 text-right">
              Total
            </td>
            <td className="px-1.5 py-1 text-right tabular-nums">{formatQty(record.totalQty)}</td>
            <td colSpan={2} />
            <td className="px-1.5 py-1 text-right tabular-nums">{formatAmount(record.vatAmount)}</td>
            <td className="px-1.5 py-1 text-right tabular-nums">{formatAmount(record.itemsTotal)}</td>
            {market && <td colSpan={2} />}
          </tr>
        </tfoot>
      </table>

      <section className="flex items-start justify-between gap-6 break-inside-avoid">
        <p className="flex-1">
          <span className="font-semibold">Amount in Words: </span>
          {amountInWords(record.totalAmount)}
        </p>
        <dl className="flex w-60 flex-col gap-0.5">
          {[
            ["Item Total (Without VAT)", record.itemsBase],
            ["Total VAT", record.vatAmount],
            ["Total AIT", record.aitAmount],
            ["Less: Discount", -record.discountAmount],
          ]
            .filter(([label, value]) => value !== 0 || label === "Item Total (Without VAT)")
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt>{label}</dt>
                <dd className="tabular-nums">{formatAmount(value as number)}</dd>
              </div>
            ))}
          <div className="mt-1 flex justify-between gap-2 border-t border-line-strong pt-1 font-semibold">
            <dt>Return Total</dt>
            <dd className="tabular-nums">{formatAmount(record.totalAmount)}</dd>
          </div>
        </dl>
      </section>

      <p>
        <span className="font-semibold">Remarks: </span>
        {record.remarks ?? "N/A"}
      </p>

      <footer className="mt-12 grid grid-cols-3 gap-6 text-center break-inside-avoid">
        {["Received By (Warehouse)", "Checked By", "Authorised By"].map((label) => (
          <p key={label} className="border-t border-line-strong pt-1">
            {label}
          </p>
        ))}
      </footer>
    </article>
  );
}
