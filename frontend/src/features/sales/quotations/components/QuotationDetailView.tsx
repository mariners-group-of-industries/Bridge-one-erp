"use client";

import { ArrowLeft, Ban, CheckCircle2, Copy, Pencil, Printer, RotateCcw, ShoppingCart, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/form-field";
import { RichTextView } from "@/components/ui/rich-text-editor";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatAmount } from "../../dashboard/lib/format";
import { formatDay, useToday } from "../../lib/use-today";
import { paths } from "../../paths";
import { displayStatus, type QuotationAction, type QuotationDetail } from "../schemas/quotation.schema";
import { changeQuotationStatus, deleteQuotation, fetchQuotation, quotationPdfUrl } from "../services/quotation.api";
import { QuotationStatusIndicator } from "./QuotationStatusIndicator";

function Pair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_auto_1fr] gap-x-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <span aria-hidden="true" className="text-ink-faint">
        :
      </span>
      <dd className="font-medium text-ink">{value || "N/A"}</dd>
    </div>
  );
}

/** /sales/quotations/[id]: the quotation with its approval actions. */
export function QuotationDetailView({ id }: { id: string }) {
  const today = useToday();
  const quotation = useResource(`quotation:${id}`, () => fetchQuotation(id));
  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.quotations} aria-label="Back to Sales Quotation" className="rounded-md p-1 text-ink-muted hover:bg-control hover:text-ink">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            {quotation.data?.number ?? "Sales Quotation"}
          </span>
        }
      />
      {quotation.error ? (
        <Card>
          <ErrorState message={errorMessage(quotation.error)} onRetry={quotation.reload} />
        </Card>
      ) : !quotation.data || !today ? (
        <LoadingState />
      ) : (
        <Detail quotation={quotation.data} today={today} onChanged={(next) => quotation.mutate(() => next)} />
      )}
    </PageContainer>
  );
}

const ACTION_LABELS: Record<QuotationAction, string> = { approve: "Approve", reject: "Reject", cancel: "Cancel", reopen: "Reopen" };

function Detail({ quotation, today, onChanged }: { quotation: QuotationDetail; today: string; onChanged: (quotation: QuotationDetail) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [acting, setActing] = useState<QuotationAction | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = displayStatus(quotation.status, quotation.validTill, today);

  async function act() {
    if (!acting) return;
    if (acting === "reject" && !reason.trim()) return setError("Enter why the quotation is rejected.");
    setBusy(true);
    try {
      const updated = await changeQuotationStatus(quotation.id, acting, quotation.updatedAt, reason.trim() || undefined);
      toast.success(`${quotation.number}: ${ACTION_LABELS[acting]} done.`);
      onChanged(updated);
      setActing(null);
      setReason("");
      setError(undefined);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteQuotation(quotation.id);
      toast.success(`${quotation.number} deleted.`);
      router.push(paths.quotations);
    } catch (failure) {
      toast.error(errorMessage(failure));
      setBusy(false);
      setDeleting(false);
    }
  }

  const actions: QuotationAction[] =
    quotation.status === "DRAFT" ? ["approve", "reject"] : quotation.status === "SUBMITTED" ? ["reject", "cancel"] : quotation.status === "LOST" ? ["reopen", "cancel"] : [];
  const ICONS: Record<QuotationAction, ReactNode> = {
    approve: <CheckCircle2 aria-hidden="true" />,
    reject: <XCircle aria-hidden="true" />,
    cancel: <Ban aria-hidden="true" />,
    reopen: <RotateCcw aria-hidden="true" />,
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-base font-semibold text-ink">{quotation.quotationType} Details</h2>
          {actions.map((action) => (
            <Button key={action} size="sm" variant={action === "approve" ? "primary" : action === "reopen" ? "secondary" : "danger"} onClick={() => setActing(action)}>
              {ICONS[action]}
              {ACTION_LABELS[action]}
            </Button>
          ))}
          {quotation.status === "SUBMITTED" && status !== "EXPIRED" && (
            <Link href={`${paths.newOrder}?quotation=${quotation.id}`} className={buttonClasses("accent", "sm")}>
              <ShoppingCart aria-hidden="true" />
              Create Sales Order
            </Link>
          )}
          {quotation.status === "DRAFT" && (
            <>
              <Link href={paths.editQuotation(quotation.id)} className={buttonClasses("secondary", "sm")}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            </>
          )}
          <Link href={`${paths.newQuotation}?copy=${quotation.id}`} className={buttonClasses("ghost", "sm")}>
            <Copy aria-hidden="true" />
            Duplicate
          </Link>
          <a href={quotationPdfUrl(quotation.id)} target="_blank" rel="noopener" aria-label="Print quotation" title="Print" className={buttonClasses("ghost", "icon")}>
            <Printer aria-hidden="true" />
          </a>
          <QuotationStatusIndicator status={status} />
        </div>
        <dl className="grid gap-x-10 gap-y-1.5 md:grid-cols-2">
          <Pair label="Quotation Code" value={quotation.number} />
          <Pair label="Create Date" value={formatDay(quotation.quotationDate)} />
          <Pair label="Office" value={quotation.officeName} />
          <Pair label="Valid Till Date" value={formatDay(quotation.validTill)} />
          <Pair label="Customer" value={`${quotation.customerCode} - ${quotation.customerName}`} />
          <Pair label="Mobile No." value={quotation.contactMobile} />
          <Pair label="Billing Address" value={quotation.billingAddress} />
          <Pair label="Billing Contact" value={[quotation.billingContactPerson, quotation.billingContactNo].filter(Boolean).join(" · ")} />
          <Pair label="Reference" value={quotation.reference} />
          <Pair label="Subject" value={quotation.subject} />
          <Pair label="Prices" value={quotation.includingVat ? "Including VAT" : "Excluding VAT"} />
          {quotation.lostReason && <Pair label="Reject Reason" value={quotation.lostReason} />}
        </dl>
      </Card>

      {quotation.remarksBody && (
        <Card className="p-4">
          <RichTextView value={quotation.remarksBody} />
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full text-sm">
            <thead className="bg-accent-soft text-xs text-ink">
              <tr>
                {["SL", "Code", "Name", "Quantity", "Unit Price", "Discount", "VAT (%)", "AIT (%)", "Total Amount", "Warranty", "Delivery Date"].map((header) => (
                  <th key={header} scope="col" className={`px-2 py-2 font-semibold whitespace-nowrap ${["SL", "Code", "Name", "Warranty", "Delivery Date"].includes(header) ? "text-left" : "text-right"}`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotation.lines.map((line, index) => (
                <tr key={line.id} className="border-t border-line">
                  <td className="px-2 py-1.5 text-ink-muted tabular-nums">{index + 1}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-ink-muted">{line.itemCode}</td>
                  <td className="px-2 py-1.5 text-ink">{line.itemName}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                    {line.qty.toLocaleString("en-US")} {line.uom}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatAmount(line.rate)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" title={`${line.discountPercent}%`}>
                    {formatAmount(line.discountAmount)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{line.vatPercent}%</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{line.aitPercent}%</td>
                  <td className="px-2 py-1.5 text-right font-medium text-ink tabular-nums">{formatAmount(line.amount)}</td>
                  <td className="px-2 py-1.5 text-ink-muted">{line.warranty ?? "—"}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-ink-muted">{line.deliveryDate ? formatDay(line.deliveryDate) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt className="text-ink-muted">Sub Total</dt>
          <dd className="text-right tabular-nums">{formatAmount(quotation.subTotal)}</dd>
          <dt className="text-ink-muted">Discount</dt>
          <dd className="text-right tabular-nums">− {formatAmount(quotation.discountAmount)}</dd>
          <dt className="text-ink-muted">VAT{quotation.includingVat ? " (included)" : ""}</dt>
          <dd className="text-right tabular-nums">{formatAmount(quotation.vatAmount)}</dd>
          <dt className="text-ink-muted">AIT</dt>
          <dd className="text-right tabular-nums">{formatAmount(quotation.aitAmount)}</dd>
          <dt className="border-t border-line pt-1 font-semibold text-ink">Grand Total</dt>
          <dd className="border-t border-line pt-1 text-right font-semibold text-ink tabular-nums">{formatAmount(quotation.grandTotal)}</dd>
        </dl>
      </Card>

      {quotation.remarksFooter && (
        <Card className="p-4">
          <RichTextView value={quotation.remarksFooter} />
        </Card>
      )}

      {quotation.termsList.length > 0 && (
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="text-base font-semibold text-ink">Terms &amp; Conditions</h2>
          <ol className="list-decimal pl-5 text-sm text-ink">
            {quotation.termsList.map((term, index) => (
              <li key={index}>
                {term.text}
                {term.optional && <span className="ml-1 text-xs text-ink-faint">(optional)</span>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Dialog
        open={acting !== null}
        title={acting ? `${ACTION_LABELS[acting]} ${quotation.number}` : ""}
        onClose={busy ? () => undefined : () => (setActing(null), setError(undefined))}
        onSubmit={act}
        footer={
          <>
            <Button onClick={() => setActing(null)} disabled={busy}>
              Back
            </Button>
            <Button type="submit" variant={acting === "approve" || acting === "reopen" ? "primary" : "danger"} loading={busy}>
              {acting ? ACTION_LABELS[acting] : ""}
            </Button>
          </>
        }
      >
        <TextAreaField
          label={acting === "reject" ? "Reason" : "Comment (optional)"}
          required={acting === "reject"}
          maxLength={500}
          value={reason}
          error={error}
          hint={acting === "approve" ? "An approved quotation can be turned into a sales order." : undefined}
          onChange={(event) => setReason(event.target.value)}
        />
      </Dialog>
      <ConfirmDialog
        open={deleting}
        title={`Delete ${quotation.number}?`}
        message="Only pending quotations can be deleted. This cannot be undone."
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(false)}
      />
    </div>
  );
}
