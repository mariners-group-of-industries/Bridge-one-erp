"use client";

import { Paperclip, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ALLOWED_SUPPLIER_ATTACHMENT_TYPES, MAX_SUPPLIER_ATTACHMENT_BYTES } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { SearchPick } from "../../components/SearchPick";
import { formatAmount } from "../../dashboard/lib/format";
import { DriverPick } from "../../deliveries/components/DeliveryVehicle";
import { issuesToErrors, requiredNumber } from "../../lib/form";
import type { CustomerOption, SalesLookups } from "../../masters/schemas/masters.schema";
import { fetchCustomers, fetchSalesLookups } from "../../masters/services/masters.api";
import { fetchOrders } from "../../orders/services/order.api";
import { paths } from "../../paths";
import { VOUCHER_TYPES, VOUCHER_TYPE_LABELS, advanceVoucherSchema, type GlAccountOption, type VoucherType } from "../schemas/collection.schema";
import { addCollectionAttachment, createAdvanceVoucher, fetchGlAccounts } from "../services/collection.api";

interface Row {
  key: string;
  customerId: string;
  salesOrderId: string;
  adjustmentAmount: string;
  amount: string;
  remarks: string;
}

const blankRow = (): Row => ({ key: crypto.randomUUID(), customerId: "", salesOrderId: "", adjustmentAmount: "", amount: "", remarks: "" });
const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const accountLabel = (account: GlAccountOption) => `${account.code} - ${account.name}`;

/** "Advance" on Sales Collection: the Advance Collection voucher in a dialog. */
export function AdvanceCollectionDialog({ today, onClose }: { today: string; onClose: () => void }) {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const accounts = useResource("gl-accounts", fetchGlAccounts);
  return (
    <Dialog open title="Advance Collection" size="xl" className="max-w-7xl" onClose={onClose}>
      {lookups.data && accounts.data ? (
        <AdvanceCollectionForm today={today} lookups={lookups.data} accounts={accounts.data} onCancel={onClose} onSaved={onClose} />
      ) : (
        <LoadingState />
      )}
    </Dialog>
  );
}

export function AdvanceCollectionForm({
  today,
  lookups,
  accounts,
  onCancel,
  onSaved,
}: {
  today: string;
  lookups: SalesLookups;
  accounts: GlAccountOption[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [header, setHeader] = useState({
    officeId: lookups.offices[0]?.id ?? "",
    collectionDate: today,
    voucherType: "CASH_RECEIVE" as VoucherType,
    project: "",
    narration: "",
    controlAmount: "",
    cashAccountId: "",
    cashRemarks: "",
    adjustAccountId: "",
  });
  const [employee, setEmployee] = useState<{ id: string; name: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof header, value: string) => setHeader((current) => ({ ...current, [key]: value }));
  /** Attachment: uploaded once the voucher is saved. */
  const [files, setFiles] = useState<File[]>([]);

  function queueFiles(list: FileList | null) {
    const accepted = Array.from(list ?? []).filter((file) => {
      if (!(ALLOWED_SUPPLIER_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: only PDF, PNG, JPEG or WebP files are allowed.`);
        return false;
      }
      if (file.size > MAX_SUPPLIER_ATTACHMENT_BYTES) {
        toast.error(`${file.name}: files must be 5 MB or smaller.`);
        return false;
      }
      return true;
    });
    if (accepted.length) setFiles((current) => [...current, ...accepted]);
  }

  const businessUnitId = lookups.offices.find((office) => office.id === header.officeId)?.businessUnitId ?? null;
  const customers = useResource(businessUnitId && `customers:${businessUnitId}`, () => fetchCustomers(businessUnitId!));
  const total = rows.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const accountOptions = accounts.map((account) => ({ id: account.id, label: accountLabel(account) }));
  const receivable = accounts.find((account) => /receivable/i.test(account.name));

  const update = (key: string, patch: Partial<Row>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  async function save() {
    if (busy) return;
    const filled = rows.filter((row) => row.customerId || row.amount);
    const input = {
      officeId: header.officeId,
      collectionDate: header.collectionDate,
      employeeId: employee?.id ?? "",
      voucherType: header.voucherType,
      project: header.project,
      narration: header.narration,
      controlAmount: header.controlAmount.trim() ? requiredNumber(header.controlAmount) : null,
      cashAccountId: header.cashAccountId,
      cashRemarks: header.cashRemarks,
      adjustAccountId: header.adjustAccountId || null,
      rows: filled.map((row) => ({
        customerId: row.customerId,
        salesOrderId: row.salesOrderId || null,
        adjustmentAmount: row.adjustmentAmount.trim() ? requiredNumber(row.adjustmentAmount) : 0,
        amount: requiredNumber(row.amount),
        remarks: row.remarks,
      })),
    };
    const parsed = advanceVoucherSchema.safeParse(input);
    if (!parsed.success) {
      const next = issuesToErrors(parsed.error);
      setErrors(next);
      toast.error(Object.values(next)[0] ?? "Please correct the highlighted fields.");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = await createAdvanceVoucher(input);
      // The voucher saves one collection per row: each keeps a copy of the files.
      const failed: string[] = [];
      for (const collection of saved) {
        for (const file of files) {
          try {
            await addCollectionAttachment(collection.id, file);
          } catch (error) {
            failed.push(`${collection.number} · ${file.name}: ${errorMessage(error)}`);
          }
        }
      }
      if (failed.length) toast.error(`Advance saved, but some attachments failed. ${failed.join(" ")}`);
      else toast.success(`Advance saved: ${saved.map((row) => row.number).join(", ")}.`);
      onSaved();
      router.replace(paths.collectionTab("advance"));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <DriverPick
          businessUnitId={businessUnitId}
          label="Employee"
          required
          placeholder="Select/Search Employee (min 3 letters)"
          error={errors.employeeId}
          selected={employee}
          onChange={(next) => setEmployee(next ? { id: next.id, name: next.name } : null)}
        />
        <TextField label="Date" type="date" required value={header.collectionDate} error={errors.collectionDate} onChange={(event) => set("collectionDate", event.target.value)} />
        <SelectField
          label="Office"
          required
          value={header.officeId}
          error={errors.officeId}
          options={[{ value: "", label: "Office" }, ...lookups.offices.map((office) => ({ value: office.id, label: office.name }))]}
          onChange={(event) => {
            set("officeId", event.target.value);
            setRows([blankRow()]);
          }}
        />
        <SelectField
          label="Voucher Type"
          value={header.voucherType}
          options={VOUCHER_TYPES.map((value) => ({ value, label: VOUCHER_TYPE_LABELS[value] }))}
          onChange={(event) => set("voucherType", event.target.value)}
        />
        <TextField label="Project" placeholder="Project" value={header.project} error={errors.project} onChange={(event) => set("project", event.target.value)} />
        <TextField label="Narration" placeholder="Narration" value={header.narration} error={errors.narration} onChange={(event) => set("narration", event.target.value)} />
        <TextField
          label="Control Amount"
          type="number"
          min={0}
          step="any"
          placeholder="Control Amount"
          hint={header.controlAmount ? `Rows total ${formatAmount(total)}` : undefined}
          value={header.controlAmount}
          error={errors.controlAmount}
          onChange={(event) => set("controlAmount", event.target.value)}
        />
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-5">
          <span className="text-xs text-ink-muted">Attachment</span>
          <div className="flex flex-wrap items-center gap-2">
            <label title="Attach files (PDF, PNG, JPEG or WebP, up to 5 MB each)" className={cn(buttonClasses("ghost", "icon"), "cursor-pointer text-accent-strong")}>
              <Paperclip aria-hidden="true" />
              <span className="sr-only">Attach files</span>
              <input
                type="file"
                multiple
                accept={ALLOWED_SUPPLIER_ATTACHMENT_TYPES.join(",")}
                className="sr-only"
                onChange={(event) => {
                  queueFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            {files.length === 0 && <span className="text-xs text-ink-faint">PDF or image, up to 5 MB each. Uploaded when you save.</span>}
            {files.map((file, index) => (
              <span key={`${file.name}-${index}`} className="flex items-center gap-1 rounded border border-dashed border-line px-2 py-1 text-xs">
                {file.name}
                <button type="button" aria-label={`Remove ${file.name}`} className="text-ink-faint hover:text-danger" onClick={() => setFiles((current) => current.filter((_, at) => at !== index))}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchPick
            label="Cash Account"
            required
            placeholder="Cash Account (min 3 letters)"
            error={errors.cashAccountId}
            options={accountOptions}
            selectedId={header.cashAccountId}
            onPick={(id) => set("cashAccountId", id ?? "")}
          />
          <TextField label="Cash Remarks" placeholder="Cash Remarks" value={header.cashRemarks} error={errors.cashRemarks} onChange={(event) => set("cashRemarks", event.target.value)} />
          <SearchPick
            label="Adjustment GL"
            placeholder="Adjustment GL (min 3 letters)"
            options={accountOptions}
            selectedId={header.adjustAccountId}
            onPick={(id) => set("adjustAccountId", id ?? "")}
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[1000px] text-xs">
            <thead className="bg-accent-soft font-semibold text-ink">
              <tr>
                {["A/C Code", "Accounts Head", "Partner Name", "SO No", "Adjustment Amount", "Amount", "Remarks", "Action"].map((label, index) => (
                  <th key={label} scope="col" className={cn("px-2 py-2", index === 5 ? "text-right" : "text-left")}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, index) => (
                <AdvanceRow
                  key={row.key}
                  row={row}
                  index={index}
                  receivable={receivable}
                  customers={customers.data ?? []}
                  errors={errors}
                  onChange={(patch) => update(row.key, patch)}
                  onAdd={() => setRows((current) => [...current, blankRow()])}
                  onRemove={rows.length > 1 ? () => setRows((current) => current.filter((candidate) => candidate.key !== row.key)) : undefined}
                />
              ))}
            </tbody>
            <tfoot className="border-t border-line-strong bg-canvas font-semibold text-ink">
              <tr>
                <td colSpan={5} className="px-2 py-2 text-right">
                  Total
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatAmount(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        {errors.rows && <p className="text-xs text-danger">{errors.rows}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" className="text-danger" onClick={onCancel} disabled={busy}>
          CLOSE
        </Button>
        <Button variant="primary" onClick={save} loading={busy}>
          SAVE
        </Button>
      </div>
    </div>
  );
}

function AdvanceRow({
  row,
  index,
  receivable,
  customers,
  errors,
  onChange,
  onAdd,
  onRemove,
}: {
  row: Row;
  index: number;
  receivable: GlAccountOption | undefined;
  customers: CustomerOption[];
  errors: Record<string, string>;
  onChange: (patch: Partial<Row>) => void;
  onAdd: () => void;
  onRemove?: () => void;
}) {
  const orders = useResource(row.customerId ? `advance-orders:${row.customerId}` : null, () => fetchOrders({ customerId: row.customerId }));
  const open = (orders.data?.rows ?? []).filter((order) => order.status !== "CANCELLED" && order.status !== "DRAFT");
  const rowError = ["customerId", "amount", "adjustmentAmount", "remarks"].map((field) => errors[`rows.${index}.${field}`]).find(Boolean);
  return (
    <tr className="align-top">
      <td className="px-2 py-2 text-ink-muted">{receivable?.code ?? ""}</td>
      <td className="px-2 py-2 text-ink">{receivable ? `${receivable.name} [Accounts Receivable]` : "Accounts receivable"}</td>
      <td className="w-64 px-2 py-1.5">
        <SearchPick
          key={customers.length}
          label={`Partner, row ${index + 1}`}
          hideLabel
          placeholder="Select/Search Customer (min 3 letters)"
          options={customers.map((customer) => ({ id: customer.id, label: `${customer.name} (${customer.code})` }))}
          selectedId={row.customerId}
          onPick={(id) => onChange({ customerId: id ?? "", salesOrderId: "" })}
        />
        {rowError && <p className="mt-0.5 text-xs text-danger">{rowError}</p>}
      </td>
      <td className="w-44 px-2 py-1.5">
        <select
          aria-label={`SO No, row ${index + 1}`}
          value={row.salesOrderId}
          disabled={!row.customerId}
          onChange={(event) => onChange({ salesOrderId: event.target.value })}
          className={cn(CONTROL, "h-7")}
        >
          <option value="">SO No</option>
          {open.map((order) => (
            <option key={order.id} value={order.id}>
              {order.number}
            </option>
          ))}
        </select>
      </td>
      <td className="w-36 px-2 py-1.5">
        <input
          aria-label={`Adjustment amount, row ${index + 1}`}
          type="number"
          min={0}
          step="any"
          placeholder="Adjustment Amount"
          value={row.adjustmentAmount}
          onChange={(event) => onChange({ adjustmentAmount: event.target.value })}
          className={cn(CONTROL, "h-7 text-right tabular-nums")}
        />
      </td>
      <td className="w-36 px-2 py-1.5">
        <input
          aria-label={`Amount, row ${index + 1}`}
          type="number"
          min={0}
          step="any"
          placeholder="Amount"
          value={row.amount}
          onChange={(event) => onChange({ amount: event.target.value })}
          className={cn(CONTROL, "h-7 text-right tabular-nums")}
        />
      </td>
      <td className="w-44 px-2 py-1.5">
        <input aria-label={`Remarks, row ${index + 1}`} placeholder="Remarks" value={row.remarks} onChange={(event) => onChange({ remarks: event.target.value })} className={cn(CONTROL, "h-7")} />
      </td>
      <td className="px-2 py-1.5">
        <span className="flex gap-0.5">
          <Button variant="ghost" size="icon" aria-label="Add row" title="Add row" onClick={onAdd}>
            <Plus />
          </Button>
          {onRemove && (
            <Button variant="ghost" size="icon" aria-label={`Remove row ${index + 1}`} onClick={onRemove}>
              <Trash2 />
            </Button>
          )}
        </span>
      </td>
    </tr>
  );
}
