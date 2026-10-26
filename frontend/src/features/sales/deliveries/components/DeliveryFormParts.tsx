"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CONTROL, Checkbox, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { cn } from "@/lib/cn";
import { formatAmount } from "../../dashboard/lib/format";
import { requiredNumber } from "../../lib/form";
import type { OfficeOption } from "../../masters/schemas/masters.schema";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type OrderType, type PaymentMethod } from "../../orders/schemas/order.schema";
import type { DeliveryDetail, WarehouseOption } from "../schemas/delivery.schema";

/** Header fields shared by order, direct and exchange deliveries (form strings). */
export interface HeaderValues {
  officeId: string;
  warehouseId: string;
  deliveryDate: string;
  deliveryTime: string;
  salesPersonId: string;
  shipToAddressId: string;
  shippingAddress: string;
  contactPerson: string;
  challanNo: string;
  vatChallanNo: string;
  refCustomerPo: string;
  refCustomerPoDate: string;
  refInvoice: string;
  refProjectOutlet: string;
  remarks: string;
  terms: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  transporterName: string;
  vehicleId: string;
  driverEmployeeId: string;
  /** Display only: the chosen driver's name. */
  driverEmployeeName: string;
  securityCode: string;
  referredBy: string;
  buyerName: string;
  buyerMobile: string;
  salesType: OrderType;
  paymentMethod: PaymentMethod;
  paymentTermDays: string;
  deliveryCharge: string;
  unloadingCharge: string;
  paidAmount: string;
}

export function blankHeader(today: string, nowTime: string): HeaderValues {
  return {
    officeId: "",
    warehouseId: "",
    deliveryDate: today,
    deliveryTime: nowTime,
    salesPersonId: "",
    shipToAddressId: "",
    shippingAddress: "",
    contactPerson: "",
    challanNo: "",
    vatChallanNo: "",
    refCustomerPo: "",
    refCustomerPoDate: "",
    refInvoice: "",
    refProjectOutlet: "",
    remarks: "",
    terms: "",
    vehicleNo: "",
    driverName: "",
    driverPhone: "",
    transporterName: "",
    vehicleId: "",
    driverEmployeeId: "",
    driverEmployeeName: "",
    securityCode: "",
    referredBy: "",
    buyerName: "",
    buyerMobile: "",
    salesType: "SALES",
    paymentMethod: "CASH",
    paymentTermDays: "0",
    deliveryCharge: "0",
    unloadingCharge: "0",
    paidAmount: "0",
  };
}

export function headerFromDelivery(delivery: DeliveryDetail): HeaderValues {
  return {
    officeId: delivery.officeId ?? "",
    warehouseId: delivery.warehouseId ?? "",
    deliveryDate: delivery.deliveryDate,
    deliveryTime: delivery.deliveryTime ?? "",
    salesPersonId: delivery.salesPersonId ?? "",
    shipToAddressId: delivery.shipToAddressId ?? "",
    shippingAddress: delivery.shipToAddressId ? "" : (delivery.shippingAddress ?? ""),
    contactPerson: delivery.contactPerson ?? "",
    challanNo: delivery.challanNo ?? "",
    vatChallanNo: delivery.vatChallanNo ?? "",
    refCustomerPo: delivery.refCustomerPo ?? "",
    refCustomerPoDate: delivery.refCustomerPoDate ?? "",
    refInvoice: delivery.refInvoice ?? "",
    refProjectOutlet: delivery.refProjectOutlet ?? "",
    remarks: delivery.remarks ?? "",
    terms: delivery.terms ?? "",
    vehicleNo: delivery.vehicleNo ?? "",
    driverName: delivery.driverName ?? "",
    driverPhone: delivery.driverPhone ?? "",
    transporterName: delivery.transporterName ?? "",
    vehicleId: delivery.vehicleId ?? "",
    driverEmployeeId: delivery.driverEmployeeId ?? "",
    driverEmployeeName: delivery.driverEmployeeName ?? "",
    securityCode: delivery.securityCode ?? "",
    referredBy: delivery.referredBy ?? "",
    buyerName: delivery.buyerName ?? "",
    buyerMobile: delivery.buyerMobile ?? "",
    salesType: delivery.salesType,
    paymentMethod: delivery.paymentMethod,
    paymentTermDays: String(delivery.paymentTermDays),
    deliveryCharge: String(delivery.deliveryCharge),
    unloadingCharge: String(delivery.unloadingCharge),
    paidAmount: String(delivery.paidAmount),
  };
}

/** Form strings → API header fields. */
export function headerInput(values: HeaderValues) {
  return {
    officeId: values.officeId,
    warehouseId: values.warehouseId,
    deliveryDate: values.deliveryDate,
    deliveryTime: values.deliveryTime || null,
    salesPersonId: values.salesPersonId || null,
    shipToAddressId: values.shipToAddressId || null,
    shippingAddress: values.shippingAddress,
    contactPerson: values.contactPerson,
    challanNo: values.challanNo,
    vatChallanNo: values.vatChallanNo,
    refCustomerPo: values.refCustomerPo,
    refCustomerPoDate: values.refCustomerPoDate || null,
    refInvoice: values.refInvoice,
    refProjectOutlet: values.refProjectOutlet,
    remarks: values.remarks,
    terms: values.terms,
    vehicleNo: values.vehicleNo,
    driverName: values.driverName,
    driverPhone: values.driverPhone,
    transporterName: values.transporterName,
    vehicleId: values.vehicleId || null,
    driverEmployeeId: values.driverEmployeeId || null,
    securityCode: values.securityCode,
    referredBy: values.referredBy,
    buyerName: values.buyerName,
    buyerMobile: values.buyerMobile,
    salesType: values.salesType,
    paymentMethod: values.paymentMethod,
    paymentTermDays: requiredNumber(values.paymentTermDays || "0"),
    deliveryCharge: requiredNumber(values.deliveryCharge || "0"),
    unloadingCharge: requiredNumber(values.unloadingCharge || "0"),
    paidAmount: requiredNumber(values.paidAmount || "0"),
  };
}

/** Local time "HH:MM" now. */
export function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

interface TransportProps {
  values: HeaderValues;
  errors: Record<string, string>;
  set: <K extends keyof HeaderValues>(key: K, value: HeaderValues[K]) => void;
  offices: OfficeOption[];
  /** Restrict offices to one business unit (existing documents). */
  businessUnitId?: string | null;
  warehouses: WarehouseOption[];
  salesPersons: { id: string; name: string }[];
  addresses: { id: string; label: string; address: string }[];
}

/** "Transportation Details": where, when, who and the document references. */
export function TransportSection({ values, errors, set, offices, businessUnitId, warehouses, salesPersons, addresses }: TransportProps) {
  const [showMore, setShowMore] = useState(Boolean(values.terms));
  const officeWarehouses = warehouses.filter((warehouse) => warehouse.officeId === values.officeId);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {addresses.length > 0 ? (
          <SelectField
            label="Ship To"
            className="xl:col-span-2"
            value={values.shipToAddressId}
            options={[{ value: "", label: "Type another address…" }, ...addresses.map((address) => ({ value: address.id, label: `${address.label}: ${address.address}` }))]}
            onChange={(event) => set("shipToAddressId", event.target.value)}
          />
        ) : null}
        {(addresses.length === 0 || !values.shipToAddressId) && (
          <TextField
            label={addresses.length ? "Ship To (address)" : "Ship To"}
            className="xl:col-span-2"
            value={values.shippingAddress}
            error={errors.shippingAddress}
            onChange={(event) => set("shippingAddress", event.target.value)}
          />
        )}
        <SelectField
          label="Sales Force"
          value={values.salesPersonId}
          error={errors.salesPersonId}
          options={[{ value: "", label: "None" }, ...salesPersons.map((person) => ({ value: person.id, label: person.name }))]}
          onChange={(event) => set("salesPersonId", event.target.value)}
        />
        <TextField label="Delivery Date" type="date" required value={values.deliveryDate} error={errors.deliveryDate} onChange={(event) => set("deliveryDate", event.target.value)} />
        <TextField label="Delivery Time" type="time" value={values.deliveryTime} error={errors.deliveryTime} onChange={(event) => set("deliveryTime", event.target.value)} />
        <TextField label="Contact To" value={values.contactPerson} error={errors.contactPerson} onChange={(event) => set("contactPerson", event.target.value)} />
        <TextField label="Challan No" hint="Blank = next number" value={values.challanNo} error={errors.challanNo} onChange={(event) => set("challanNo", event.target.value)} />
        <TextField label="VAT Challan No" value={values.vatChallanNo} error={errors.vatChallanNo} onChange={(event) => set("vatChallanNo", event.target.value)} />
        <TextField label="Ref Customer PO" value={values.refCustomerPo} error={errors.refCustomerPo} onChange={(event) => set("refCustomerPo", event.target.value)} />
        <TextField label="Ref Customer PO Date" type="date" value={values.refCustomerPoDate} error={errors.refCustomerPoDate} onChange={(event) => set("refCustomerPoDate", event.target.value)} />
        <TextField label="Ref Invoice" value={values.refInvoice} error={errors.refInvoice} onChange={(event) => set("refInvoice", event.target.value)} />
        <TextField label="Project / Outlet / Ref" value={values.refProjectOutlet} error={errors.refProjectOutlet} onChange={(event) => set("refProjectOutlet", event.target.value)} />
        <SelectField
          label="Office"
          required
          value={values.officeId}
          error={errors.officeId}
          options={[
            { value: "", label: "Select office" },
            ...offices
              .filter((office) => !businessUnitId || office.businessUnitId === businessUnitId)
              .map((office) => ({ value: office.id, label: office.name })),
          ]}
          onChange={(event) => {
            set("officeId", event.target.value);
            set("warehouseId", warehouses.find((warehouse) => warehouse.officeId === event.target.value)?.id ?? "");
          }}
        />
        <SelectField
          label="Warehouse (Location)"
          required
          value={values.warehouseId}
          error={errors.warehouseId}
          hint={values.officeId && officeWarehouses.length === 0 ? "This office has no warehouse. Add one in Configuration." : undefined}
          options={[{ value: "", label: "Select warehouse" }, ...officeWarehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))]}
          onChange={(event) => set("warehouseId", event.target.value)}
        />
        <TextField label="Remarks" className="xl:col-span-2" value={values.remarks} error={errors.remarks} onChange={(event) => set("remarks", event.target.value)} />
      </div>
      <div>
        <Button size="sm" onClick={() => setShowMore((value) => !value)} aria-expanded={showMore}>
          {showMore ? "Hide Terms" : "Terms & Conditions"}
        </Button>
      </div>
      {showMore && (
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
          <TextAreaField label="Terms & Conditions" className="sm:col-span-3" rows={5} value={values.terms} error={errors.terms} onChange={(event) => set("terms", event.target.value)} />
        </div>
      )}
    </div>
  );
}

interface SummaryProps {
  values: HeaderValues;
  errors: Record<string, string>;
  set: <K extends keyof HeaderValues>(key: K, value: HeaderValues[K]) => void;
  itemsTotal: number;
  itemsBase: number;
  vatAmount: number;
  aitAmount: number;
  discountAmount: number;
  /** Editable discount (direct / exchange); read-only when shared from the order. */
  onDiscountChange?: (value: string) => void;
  discountText?: string;
  /** Exchange: value of goods taken back. */
  returnAmount?: number;
  total: number;
}

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Totals, charges and the payment collected on delivery. */
export function DeliverySummary({ values, errors, set, itemsTotal, itemsBase, vatAmount, aitAmount, discountAmount, onDiscountChange, discountText, returnAmount, total }: SummaryProps) {
  const collectable = Math.max(0, total - (returnAmount ?? 0));
  const paidAll = collectable > 0 && Math.abs(toNumber(values.paidAmount) - collectable) < 0.005;
  return (
    <dl className="flex flex-col gap-2 text-sm">
      <Row label="Item Price" value={formatAmount(itemsTotal)} />
      <div className="flex items-center justify-between gap-3">
        <dt className="text-ink-muted">Discount</dt>
        <dd>
          {onDiscountChange ? (
            <input
              aria-label="Discount amount"
              type="number"
              min={0}
              step="any"
              value={discountText}
              onChange={(event) => onDiscountChange(event.target.value)}
              className={cn(CONTROL, "h-7 w-28 text-right tabular-nums", errors.discountAmount && "ring-1 ring-danger")}
            />
          ) : (
            <span className="tabular-nums" title="Share of the order discount">
              {formatAmount(discountAmount)}
            </span>
          )}
        </dd>
      </div>
      <Row label="Item Total (after discount)" value={formatAmount(itemsTotal - discountAmount)} />
      <Row label="Total VAT" value={formatAmount(vatAmount)} />
      {aitAmount > 0 && <Row label="Total AIT" value={formatAmount(aitAmount)} />}
      <Row label="Item Total (Without VAT)" value={formatAmount(itemsBase)} />
      <Money label="Delivery Charge" value={values.deliveryCharge} error={errors.deliveryCharge} onChange={(value) => set("deliveryCharge", value)} />
      <Money label="Unloading Charge" value={values.unloadingCharge} error={errors.unloadingCharge} onChange={(value) => set("unloadingCharge", value)} />
      <div className="mt-1 border-t border-line pt-2">
        <Row label="Sales Total" value={formatAmount(total)} strong />
      </div>
      {returnAmount !== undefined && (
        <>
          <Row label="Less: Goods Taken Back" value={`− ${formatAmount(returnAmount)}`} />
          <Row label="Net Receivable" value={formatAmount(collectable)} strong />
        </>
      )}
      <div className="flex items-center justify-between gap-3">
        <dt className="text-ink-muted">Payment Type</dt>
        <dd>
          <select
            aria-label="Payment type"
            value={values.paymentMethod}
            onChange={(event) => set("paymentMethod", event.target.value as PaymentMethod)}
            className={cn(CONTROL, "h-7 w-40")}
          >
            {PAYMENT_METHODS.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_METHOD_LABELS[value]}
              </option>
            ))}
          </select>
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-ink-muted">Payment Term Days</dt>
        <dd>
          <input
            aria-label="Payment term days"
            type="number"
            min={0}
            max={365}
            value={values.paymentTermDays}
            onChange={(event) => set("paymentTermDays", event.target.value)}
            className={cn(CONTROL, "h-7 w-28 text-right tabular-nums", errors.paymentTermDays && "ring-1 ring-danger")}
          />
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-2 text-ink-muted">
          Payment Amount
          <label className="inline-flex items-center gap-1 text-xs">
            <Checkbox checked={paidAll} onChange={(event) => set("paidAmount", event.target.checked ? String(collectable) : "0")} />
            All?
          </label>
        </dt>
        <dd>
          <input
            aria-label="Payment amount"
            type="number"
            min={0}
            step="any"
            value={values.paidAmount}
            onChange={(event) => set("paidAmount", event.target.value)}
            className={cn(CONTROL, "h-7 w-28 text-right tabular-nums", errors.paidAmount && "ring-1 ring-danger")}
          />
        </dd>
      </div>
      {errors.paidAmount && <p className="text-right text-xs text-danger">{errors.paidAmount}</p>}
      <p className="text-xs text-ink-faint">Money collected now is saved as a Sales Collection; the rest is due after the payment term.</p>
    </dl>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-muted"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-base font-semibold text-ink" : "text-ink")}>{value}</dd>
    </div>
  );
}

function Money({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd>
        <input
          aria-label={label}
          type="number"
          min={0}
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(CONTROL, "h-7 w-28 text-right tabular-nums", error && "ring-1 ring-danger")}
        />
      </dd>
    </div>
  );
}
