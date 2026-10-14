"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatAmount } from "../../dashboard/lib/format";
import { amountInWords } from "../../lib/amount-in-words";
import { formatDay, useToday } from "../../lib/use-today";
import { paths } from "../../paths";
import { COLLECTION_KIND_LABELS, COLLECTION_METHOD_LABELS } from "../schemas/collection.schema";
import { fetchBill, fetchCollection } from "../services/collection.api";

/** A4 page frame: toolbar (screen only) and the document. Always light. */
function Frame({ back, ready, children }: { back: string; ready: boolean; children: ReactNode }) {
  return (
    <div data-theme="light" className="min-h-screen bg-surface text-ink print:min-h-0">
      <div className="mx-auto flex max-w-[210mm] items-center gap-2 px-6 py-3 print:hidden">
        <Link href={back} className={buttonClasses("ghost")}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Link>
        <Button variant="primary" className="ml-auto" onClick={() => window.print()} disabled={!ready}>
          <Printer aria-hidden="true" />
          Print / Save as PDF
        </Button>
      </div>
      {children}
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

function Header({ company, office, address, title, number }: { company: string; office: string | null; address: string | null; title: string; number: string }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line-strong pb-3">
      <div>
        <h1 className="text-lg font-bold">{company}</h1>
        <p className="font-medium">{office}</p>
        <p className="text-ink-muted">{address}</p>
      </div>
      <div className="text-right">
        <p className="text-base font-bold tracking-wide uppercase">{title}</p>
        <p className="font-medium">{number}</p>
      </div>
    </header>
  );
}

function Signatures({ labels }: { labels: string[] }) {
  return (
    <footer className="mt-12 grid grid-cols-3 gap-6 text-center break-inside-avoid">
      {labels.map((label) => (
        <p key={label} className="border-t border-line-strong pt-1">
          {label}
        </p>
      ))}
    </footer>
  );
}

const ARTICLE = "mx-auto flex max-w-[210mm] flex-col gap-4 px-6 pb-10 text-[11px] leading-snug print:px-0 print:pb-0";
const TH = "px-1.5 py-1";
const NUM = "px-1.5 py-1 text-right tabular-nums";

export function CollectionPrintView({ id }: { id: string }) {
  const record = useResource(id, () => fetchCollection(id));
  const data = record.data;
  return (
    <Frame back={paths.collection(id)} ready={!!data}>
      {record.error ? (
        <ErrorState message={errorMessage(record.error)} onRetry={record.reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <article className={ARTICLE}>
          <Header company={data.companyName} office={data.officeName} address={data.officeAddress} title="Money Receipt" number={data.number} />
          {data.status === "CANCELLED" && <p className="font-semibold text-danger uppercase">Cancelled: {data.cancelReason}</p>}
          <section className="grid grid-cols-2 gap-x-6">
            <dl className="flex flex-col gap-0.5">
              <Row label="Received From" value={`${data.customerName} (${data.customerCode})`} />
              <Row label="Mobile" value={data.customerPhone} />
              <Row label="Address" value={data.customerAddress} />
              <Row label="Collect By" value={data.salesPersonName} />
            </dl>
            <dl className="flex flex-col gap-0.5">
              <Row label="Date" value={formatDay(data.collectionDate)} />
              <Row label="Type" value={COLLECTION_KIND_LABELS[data.kind]} />
              <Row label="Payment Method" value={COLLECTION_METHOD_LABELS[data.method]} />
              <Row label="Reference" value={[data.reference, data.bankName].filter(Boolean).join(" · ")} />
            </dl>
          </section>
          {data.allocations.length > 0 && (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-line-strong text-left">
                  <th className={TH}>SL</th>
                  <th className={TH}>Invoice No</th>
                  <th className={TH}>Invoice Date</th>
                  <th className={`${TH} text-right`}>Invoice Amount</th>
                  <th className={`${TH} text-right`}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {data.allocations.map((row, index) => (
                  <tr key={row.deliveryId} className="border-b border-line">
                    <td className={TH}>{index + 1}</td>
                    <td className={TH}>{row.invoiceNumber}</td>
                    <td className={TH}>{formatDay(row.invoiceDate)}</td>
                    <td className={NUM}>{formatAmount(row.invoiceAmount)}</td>
                    <td className={NUM}>{formatAmount(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-sm">
            <span className="font-semibold">Amount: </span>
            {formatAmount(data.amount)} <span className="text-ink-muted">({amountInWords(data.amount)})</span>
          </p>
          {data.kind === "ADVANCE" && <p>Advance balance not yet adjusted: {formatAmount(data.unallocated)}</p>}
          <p>
            <span className="font-semibold">Remarks: </span>
            {data.remarks ?? "N/A"}
          </p>
          <Signatures labels={["Received By", "Checked By", "Customer Signature"]} />
        </article>
      )}
    </Frame>
  );
}

export function BillPrintView({ id }: { id: string }) {
  const today = useToday();
  const bill = useResource(today ? `bill:${id}` : null, () => fetchBill(id, today!));
  const data = bill.data;
  return (
    <Frame back={paths.bill(id)} ready={!!data}>
      {bill.error ? (
        <ErrorState message={errorMessage(bill.error)} onRetry={bill.reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <article className={ARTICLE}>
          <Header company={data.companyName} office={data.officeName} address={data.officeAddress} title="Bill" number={data.number} />
          {data.status === "CANCELLED" && <p className="font-semibold text-danger uppercase">Cancelled: {data.cancelReason}</p>}
          <section className="grid grid-cols-2 gap-x-6">
            <dl className="flex flex-col gap-0.5">
              <Row label="Customer" value={`${data.customerName} (${data.customerCode})`} />
              <Row label="Mobile" value={data.customerPhone} />
              <Row label="Address" value={data.customerAddress} />
            </dl>
            <dl className="flex flex-col gap-0.5">
              <Row label="Bill Date" value={formatDay(data.billDate)} />
              <Row label="Invoices" value={String(data.invoices)} />
              <Row label="Remarks" value={data.remarks} />
            </dl>
          </section>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-line-strong text-left">
                <th className={TH}>SL</th>
                <th className={TH}>Invoice No</th>
                <th className={TH}>Challan No</th>
                <th className={TH}>Invoice Date</th>
                <th className={TH}>Due Date</th>
                <th className={`${TH} text-right`}>Invoice Amount</th>
                <th className={`${TH} text-right`}>Due</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line, index) => (
                <tr key={line.deliveryId} className="border-b border-line break-inside-avoid">
                  <td className={TH}>{index + 1}</td>
                  <td className={TH}>{line.invoiceNumber}</td>
                  <td className={TH}>{line.challanNo}</td>
                  <td className={TH}>{formatDay(line.invoiceDate)}</td>
                  <td className={TH}>{formatDay(line.dueDate)}</td>
                  <td className={NUM}>{formatAmount(line.invoiceAmount)}</td>
                  <td className={NUM}>{formatAmount(line.billedAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-b border-line-strong font-semibold">
                <td colSpan={6} className={`${TH} text-right`}>
                  Total
                </td>
                <td className={NUM}>{formatAmount(data.billAmount)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-sm">
            <span className="font-semibold">Amount in Words: </span>
            {amountInWords(data.billAmount)}
          </p>
          <Signatures labels={["Prepared By", "Authorised By", "Received By (Customer)"]} />
        </article>
      )}
    </Frame>
  );
}
