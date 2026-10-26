"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { LineTable } from "@/features/production/bom/components/BomDialogs";
import { round2, round4 } from "@/features/production/bom/lib/bom-totals";
import { OrderStatusBadge, day, money, qty2 } from "@/features/production/orders/components/OrderParts";
import { issuesToErrors } from "@/features/sales/lib/form";
import { useToday } from "@/features/sales/lib/use-today";
import { paths } from "../../paths";
import { SHIFTS, entryInputSchema, type EntryForm, type EntryInput } from "../schemas/entry.schema";
import { createEntry, fetchEntryForm } from "../services/entry.api";

/** Text → number for live figures ("" and junk count as 0). */
const n = (value: string) => {
  const parsed = Number(value);
  return value.trim() === "" || !Number.isFinite(parsed) ? 0 : parsed;
};

/** /production/entries/new?orderId= — read the search params inside <Suspense>. */
export function NewEntryView() {
  const orderId = useSearchParams().get("orderId");
  const today = useToday();
  const form = useResource(orderId ? `production-entry-form:${orderId}` : null, () => fetchEntryForm(orderId!));
  if (!orderId) return <Failed message="Choose a production order from the Approve Production Order list." />;
  if (form.error) return <Failed message={errorMessage(form.error)} onRetry={form.reload} />;
  if (!form.data || !today) return <LoadingState />;
  return <EntryFormBody key={orderId} form={form.data} today={today} />;
}

function Failed({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <PageContainer className="max-w-none">
      <PageHead title="Create Production Entry" />
      <Card>
        <ErrorState message={message} onRetry={onRetry} />
        <p className="px-4 pb-4 text-center text-sm">
          <Link href={paths.entries} className="text-accent-strong hover:underline">
            Back to Production Entry
          </Link>
        </p>
      </Card>
    </PageContainer>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "danger" | "success" }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={cn("text-base font-semibold tabular-nums", tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink")}>{value}</span>
    </div>
  );
}

function EntryFormBody({ form, today }: { form: EntryForm; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const { order } = form;
  const defaultCenter = form.workCenters.find((center) => center.id === order.workCenterId);
  const [values, setValues] = useState({
    entryDate: today < order.orderDate ? order.orderDate : today,
    shift: "General",
    workCenterId: defaultCenter?.id ?? "",
    departmentId: defaultCenter?.departmentId ?? "",
    departmentSectionId: defaultCenter?.departmentSectionId ?? "",
    outputWarehouseId: order.sourceWarehouseId,
    totalQty: "",
    rejectQty: "",
    hours: "",
    remarks: "",
  });
  /** Consumption the user typed; untouched lines follow the standard quantity. */
  const [typed, setTyped] = useState<Record<string, { actualQty?: string; wastageQty?: string; scrapQty?: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<typeof values>) => setValues((current) => ({ ...current, ...patch }));
  const sections = form.sections.filter((section) => section.departmentId === values.departmentId);
  const total = n(values.totalQty);
  const reject = n(values.rejectQty);
  const net = round4(Math.max(total - reject, 0));
  const excess = round4(Math.max(net - order.remainingQty, 0));

  const lines = form.materials.map((material) => {
    const standardQty = round4(material.perUnit * total);
    const entered = typed[material.itemId] ?? {};
    const actualText = entered.actualQty ?? String(standardQty);
    const actualQty = n(actualText);
    return {
      ...material,
      standardQty,
      actualText,
      actualQty,
      wastageText: entered.wastageQty ?? "",
      scrapText: entered.scrapQty ?? "",
      short: actualQty > material.stock + 1e-9,
    };
  });
  const standardCost = round2(lines.reduce((sum, line) => sum + line.standardQty * line.rate, 0));
  const actualCost = round2(lines.reduce((sum, line) => sum + line.actualQty * line.rate, 0));
  const variance = round2(actualCost - standardCost);
  const shortages = lines.filter((line) => line.short).length;

  function typeLine(itemId: string, field: "actualQty" | "wastageQty" | "scrapQty", value: string) {
    setTyped((current) => ({ ...current, [itemId]: { ...current[itemId], [field]: value } }));
  }

  function chooseWorkCenter(workCenterId: string) {
    const center = form.workCenters.find((row) => row.id === workCenterId);
    set({
      workCenterId,
      ...(center?.departmentId ? { departmentId: center.departmentId, departmentSectionId: center.departmentSectionId ?? "" } : {}),
    });
  }

  async function save() {
    const input: EntryInput = {
      orderId: order.id,
      entryDate: values.entryDate,
      shift: values.shift as EntryInput["shift"],
      workCenterId: values.workCenterId || null,
      departmentId: values.departmentId || null,
      departmentSectionId: values.departmentSectionId || null,
      outputWarehouseId: values.outputWarehouseId,
      totalQty: values.totalQty.trim() === "" ? Number.NaN : Number(values.totalQty),
      rejectQty: n(values.rejectQty),
      hours: n(values.hours),
      remarks: values.remarks || null,
      materials: lines.map((line) => ({
        itemId: line.itemId,
        actualQty: line.actualText.trim() === "" ? Number.NaN : Number(line.actualText),
        wastageQty: n(line.wastageText),
        scrapQty: n(line.scrapText),
      })),
    };
    const parsed = entryInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      toast.error(parsed.error.issues[0]?.message ?? "Please correct the highlighted fields.");
      return;
    }
    if (shortages > 0) {
      toast.error(`${shortages} material${shortages === 1 ? " is" : "s are"} short in ${order.sourceWarehouseName}.`);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = await createEntry(input);
      toast.success(`Production entry ${saved.number} posted: ${qty2(saved.netQty)} ${saved.uom} added to stock.`);
      router.push(paths.entryList);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  const cell = (itemId: string, field: "actualQty" | "wastageQty" | "scrapQty", value: string, label: string, invalid?: boolean) => (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={0}
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value}
      placeholder="0"
      onChange={(event) => typeLine(itemId, field, event.target.value)}
      className={cn(CONTROL, "h-7 w-24 text-right tabular-nums", invalid && "ring-1 ring-danger")}
    />
  );

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.entries} aria-label="Back to Production Entry" className="rounded-md p-1 text-ink-muted hover:bg-control hover:text-ink">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            Create Production Entry
          </span>
        }
        actions={
          <Button variant="primary" onClick={save} loading={busy}>
            <Save aria-hidden="true" />
            SAVE
          </Button>
        }
      />
      <div className="flex flex-col gap-4">
        <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
          <div className="flex min-w-60 flex-1 flex-col">
            <span className="text-xs text-ink-muted">Production Order</span>
            <span className="flex items-center gap-2 text-base font-semibold text-ink">
              {order.number} <OrderStatusBadge status={order.status} />
            </span>
            <span className="text-sm text-ink-muted">
              {order.itemCode} - {order.itemName} · {order.bomName} · {day(order.orderDate)}
            </span>
          </div>
          <Stat label="Order QTY" value={`${qty2(order.orderQty)} ${order.uom}`} />
          <Stat label="Produced QTY" value={qty2(order.producedQty)} />
          <Stat label="Remaining QTY" value={qty2(order.remainingQty)} />
          <Stat label="Sales Order" value={order.salesOrderNumber ?? "N/A"} />
        </Card>

        <Card className="p-4">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              label="Production Entry Date"
              required
              type="date"
              min={order.orderDate}
              value={values.entryDate}
              error={errors.entryDate}
              onChange={(event) => set({ entryDate: event.target.value })}
            />
            <SelectField label="Shift" required value={values.shift} error={errors.shift} options={SHIFTS.map((shift) => ({ value: shift, label: shift }))} onChange={(event) => set({ shift: event.target.value })} />
            <SelectField
              label="Work Center"
              value={values.workCenterId}
              error={errors.workCenterId}
              options={[{ value: "", label: "N/A" }, ...form.workCenters.map((center) => ({ value: center.id, label: `${center.code} - ${center.name}` }))]}
              onChange={(event) => chooseWorkCenter(event.target.value)}
            />
            <TextField
              label="Machine Hours"
              type="number"
              min={0}
              max={24}
              step="any"
              placeholder="0"
              value={values.hours}
              error={errors.hours}
              onChange={(event) => set({ hours: event.target.value })}
            />
            <SelectField
              label="Department"
              value={values.departmentId}
              error={errors.departmentId}
              options={[{ value: "", label: "N/A" }, ...form.departments.map((department) => ({ value: department.id, label: department.name }))]}
              onChange={(event) => set({ departmentId: event.target.value, departmentSectionId: "" })}
            />
            <SelectField
              label="Section"
              value={values.departmentSectionId}
              disabled={!values.departmentId}
              options={[{ value: "", label: "N/A" }, ...sections.map((section) => ({ value: section.id, label: section.name }))]}
              onChange={(event) => set({ departmentSectionId: event.target.value })}
            />
            <TextField label="Material From" value={order.sourceWarehouseName} readOnly hint="The production order's warehouse" />
            <SelectField
              label="Finished Goods To"
              required
              value={values.outputWarehouseId}
              error={errors.outputWarehouseId}
              options={form.warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
              onChange={(event) => set({ outputWarehouseId: event.target.value })}
            />
            <TextField
              label={`Total QTY (${order.uom})`}
              required
              type="number"
              min={0}
              step="any"
              placeholder="Produced in this batch"
              value={values.totalQty}
              error={errors.totalQty}
              onChange={(event) => set({ totalQty: event.target.value })}
            />
            <TextField
              label="Reject QTY"
              type="number"
              min={0}
              step="any"
              placeholder="0"
              value={values.rejectQty}
              error={errors.rejectQty}
              hint="Defective units: not added to stock"
              onChange={(event) => set({ rejectQty: event.target.value })}
            />
            <TextField
              label="Remarks"
              className="sm:col-span-2"
              maxLength={500}
              placeholder="Remarks"
              value={values.remarks}
              error={errors.remarks}
              onChange={(event) => set({ remarks: event.target.value })}
            />
          </div>
        </Card>

        <Card className="flex flex-wrap gap-x-10 gap-y-3 p-4">
          <Stat label="Net QTY (to stock)" value={`${qty2(net)} ${order.uom}`} />
          <Stat label="Excess QTY" value={qty2(excess)} tone={excess > 0 ? "danger" : undefined} />
          <Stat label="Net Weight" value={qty2(round4(net * order.netWeightPerUnit))} />
          <Stat label="Standard Material Cost" value={money(standardCost)} />
          <Stat label="Actual Material Cost" value={money(actualCost)} />
          <Stat label="Variance" value={money(variance)} tone={variance > 0 ? "danger" : variance < 0 ? "success" : undefined} />
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">Material Consumption</h2>
            <p className="text-xs text-ink-faint">Actual QTY leaves {order.sourceWarehouseName}; wastage and scrap are part of it.</p>
          </div>
          {errors.materials && (
            <p role="alert" className="text-sm text-danger">
              {errors.materials}
            </p>
          )}
          {shortages > 0 && (
            <p role="alert" className="text-sm text-danger">
              {shortages} material{shortages === 1 ? " is" : "s are"} short in {order.sourceWarehouseName}. Reduce the quantity or bring stock in first.
            </p>
          )}
          <LineTable
            columns={[
              { header: "SL", className: "w-12" },
              { header: "Item Code" },
              { header: "Item Name" },
              { header: "UoM" },
              { header: "Standard QTY", align: "right" },
              { header: "Actual Consumed", align: "right" },
              { header: "Wastage", align: "right" },
              { header: "Scrap", align: "right" },
              { header: "Stock", align: "right" },
              { header: "Variance QTY", align: "right" },
            ]}
            rows={lines.map((line, index) => {
              const varianceQty = round4(line.actualQty - line.standardQty);
              return [
                index + 1,
                line.code,
                <span key="name" className="text-ink">{line.name}</span>,
                line.uom,
                qty2(line.standardQty),
                cell(line.itemId, "actualQty", line.actualText, `Actual consumed ${line.name}`, line.short || !!errors[`materials.${index}.actualQty`]),
                cell(line.itemId, "wastageQty", line.wastageText, `Wastage ${line.name}`, !!errors[`materials.${index}.wastageQty`]),
                cell(line.itemId, "scrapQty", line.scrapText, `Scrap ${line.name}`, !!errors[`materials.${index}.scrapQty`]),
                <span key="stock" className={line.short ? "font-medium text-danger" : undefined}>
                  {qty2(line.stock)}
                </span>,
                <span key="v" className={varianceQty > 0 ? "text-danger" : varianceQty < 0 ? "text-success" : undefined}>
                  {qty2(varianceQty)}
                </span>,
              ];
            })}
            empty="This order has no input material."
          />
        </Card>
      </div>
    </PageContainer>
  );
}
