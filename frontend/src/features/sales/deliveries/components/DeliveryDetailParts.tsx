"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { formatAmount } from "../../dashboard/lib/format";
import { formatDay } from "../../lib/use-today";
import { ORDER_TYPE_LABELS } from "../../orders/schemas/order.schema";
import { paths } from "../../paths";
import { DELIVERY_TYPE_LABELS, type DeliveryDetail } from "../schemas/delivery.schema";

export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-2 text-xs">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="text-ink-muted">: {value || "N/A"}</dd>
    </div>
  );
}

export const deliveryKind = (delivery: DeliveryDetail) =>
  delivery.orderFullyDelivered === null ? DELIVERY_TYPE_LABELS[delivery.deliveryType] : delivery.orderFullyDelivered ? "Fully Delivered" : "Partially Delivered";

/** "Office Name : …" on the left, the document totals / numbers and icons on the right. */
export function DeliveryBanner({ delivery, children, showTotal }: { delivery: DeliveryDetail; children?: ReactNode; showTotal?: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
      <h2 className="flex items-center gap-2 text-base text-ink">
        <FileText aria-hidden="true" className="size-4" />
        Office Name : <span className="font-semibold">{delivery.officeName ?? "N/A"}</span>
      </h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {showTotal && (
          <>
            <span className="font-semibold text-danger">{ORDER_TYPE_LABELS[delivery.salesType]}</span>
            <span className="text-ink-faint">|</span>
            <span className="text-ink-muted">
              Total <span className="font-semibold text-ink tabular-nums">{formatAmount(delivery.totalAmount)}</span>
            </span>
            <span className="text-ink-faint">|</span>
          </>
        )}
        <span className="text-ink-muted">
          Sales Invoice <span className="font-semibold text-accent-strong">{delivery.number}</span>
        </span>
        {children}
      </div>
    </div>
  );
}

/** Customer, references and dates of a delivery (two columns). */
export function DeliveryInfo({ delivery, extraLeft, extraRight }: { delivery: DeliveryDetail; extraLeft?: ReactNode; extraRight?: ReactNode }) {
  const customer = [delivery.customerName, delivery.customerPhone].filter(Boolean).join(" · ");
  return (
    <div className="grid gap-x-8 gap-y-1 lg:grid-cols-2">
      <dl className="flex flex-col gap-1">
        <Detail label="Customer" value={delivery.buyerName ? `${customer} (${delivery.buyerName}${delivery.buyerMobile ? `, ${delivery.buyerMobile}` : ""})` : customer} />
        <Detail label="Customer Code" value={delivery.customerCode} />
        <Detail label="Referred By" value={delivery.referredBy} />
        <Detail label="Billing Address" value={delivery.billingAddress} />
        <Detail label="Shipping Address" value={delivery.shippingAddress} />
        <Detail label="Ref Customer PO" value={delivery.refCustomerPo} />
        <Detail label="Ref Customer PO Date" value={delivery.refCustomerPoDate && formatDay(delivery.refCustomerPoDate)} />
        <Detail label="Ref Invoice" value={delivery.refInvoice} />
        <Detail label="Sales Force" value={delivery.salesPersonName} />
        <Detail label="Warehouse Name" value={delivery.warehouseName} />
        {extraLeft}
      </dl>
      <dl className="flex flex-col gap-1">
        <Detail
          label="Sales Order No."
          value={
            delivery.salesOrderId && (
              <Link href={paths.order(delivery.salesOrderId)} className="text-accent-strong hover:underline">
                {delivery.orderNumber}
              </Link>
            )
          }
        />
        <Detail label="Invoice Type" value={delivery.invoiceType} />
        <Detail label="Delivery Type" value={deliveryKind(delivery)} />
        <Detail label="Exp. Delivery Date" value={delivery.expectedDeliveryDate && formatDay(delivery.expectedDeliveryDate)} />
        <Detail label="Delivery Date" value={formatDay(delivery.deliveryDate)} />
        <Detail label="Delivery Time" value={delivery.deliveryTime} />
        <Detail label="Actual Delivery Date" value={delivery.actualDeliveryDate && formatDay(delivery.actualDeliveryDate)} />
        <Detail label="VAT/SD/AIT" value={delivery.priceIncludesVat ? "Inclusive" : "Exclusive"} />
        <Detail label="Challan No" value={delivery.challanNo} />
        <Detail label="Delivered By" value={delivery.createdBy} />
        <Detail label="Confirmed By" value={delivery.confirmedBy && delivery.confirmedAt && `${delivery.confirmedBy} · ${formatDateTime(delivery.confirmedAt)}`} />
        {extraRight}
      </dl>
    </div>
  );
}

/** Vehicle, driver and transport charges. */
export function TransportDetails({ delivery }: { delivery: DeliveryDetail }) {
  return (
    <dl className="grid gap-x-8 gap-y-1 p-4 md:grid-cols-2">
      <Detail label="Vehicle No" value={delivery.vehicleNo} />
      <Detail label="Vehicle Size" value={delivery.vehicleSize} />
      <Detail label="Driver (Employee)" value={delivery.driverEmployeeName} />
      <Detail label="Driver Name (External)" value={delivery.driverName} />
      <Detail label="Contact No" value={delivery.driverPhone} />
      <Detail label="Security Code" value={delivery.securityCode} />
      <Detail label="Transporter" value={delivery.transporterName} />
      <Detail label="Delivery Charge" value={formatAmount(delivery.deliveryCharge)} />
      <Detail label="Unloading Charge" value={formatAmount(delivery.unloadingCharge)} />
    </dl>
  );
}

export function TermsAndRemarks({ delivery, words }: { delivery: DeliveryDetail; words?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 text-xs")}>
      {words && (
        <p>
          <span className="font-semibold text-ink">Amount In Word: </span>
          <span className="text-ink-muted">{words}</span>
        </p>
      )}
      <p>
        <span className="font-semibold text-ink">Terms &amp; Condition: </span>
        <span className="whitespace-pre-line text-ink-muted">{delivery.terms ?? ""}</span>
      </p>
      <p>
        <span className="font-semibold text-ink">Remarks: </span>
        <span className="text-ink-muted">{delivery.remarks ?? "N/A"}</span>
      </p>
    </div>
  );
}
