import { z } from "zod";

export const POS_PAYMENT_METHODS = ["CASH", "CARD", "MFS", "VOUCHER"] as const;
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PosPaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card (POS Terminal)",
  MFS: "MFS (bKash/Nagad)",
  VOUCHER: "Gift Voucher / Points",
};

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

export const counterSchema = z.object({
  name: z.string().trim().min(1, "Enter the counter name.").max(100),
  warehouseId: z.uuid("Select the warehouse the counter sells from."),
  floorName: text(200),
  userName: text(150),
  receiptMessage: text(300),
  isEcommerce: z.boolean().default(false),
});
export type CounterInput = z.infer<typeof counterSchema>;

export const counterPatchSchema = counterSchema.partial().extend({ isActive: z.boolean().optional() });

export const saleSchema = z.object({
  counterId: z.uuid("Select a counter."),
  customerName: text(150),
  customerMobile: text(30),
  tableRef: text(100),
  discount: z.number().finite().min(0).default(0),
  vatPercent: z.number().finite().min(0).max(100).default(0),
  paymentMethod: z.enum(POS_PAYMENT_METHODS),
  paidAmount: z.number().finite().min(0),
  lines: z
    .array(
      z.object({
        itemId: z.uuid(),
        qty: z.number().finite().positive("Quantity must be greater than 0."),
        rate: z.number().finite().min(0),
        discount: z.number().finite().min(0).default(0),
      }),
    )
    .min(1, "Add at least one item.")
    .max(200),
});
export type SaleInput = z.infer<typeof saleSchema>;

export const voidSchema = z.object({ reason: z.string().trim().min(1, "Enter why the sale is voided.").max(300) });

export interface PosCounter {
  id: string;
  code: string;
  name: string;
  warehouseId: string;
  warehouseName: string;
  officeName: string;
  floorName: string | null;
  userName: string | null;
  receiptMessage: string | null;
  isEcommerce: boolean;
  isActive: boolean;
}

export interface PosSaleLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  uom: string;
  qty: number;
  rate: number;
  discount: number;
  amount: number;
}

export interface PosSale {
  id: string;
  number: string;
  saleDate: string;
  soldAt: string;
  counterId: string;
  counterName: string;
  warehouseName: string;
  customerName: string | null;
  customerMobile: string | null;
  tableRef: string | null;
  subtotal: number;
  discount: number;
  vatPercent: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: PosPaymentMethod;
  status: "COMPLETED" | "VOIDED";
  voidReason: string | null;
  createdBy: string;
  voidedBy: string | null;
  lines: PosSaleLine[];
}

/** The totals of a sale, rounded to paisa (shared by the terminal and the server). */
export function saleTotals(lines: { qty: number; rate: number; discount?: number }[], discount: number, vatPercent: number) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal = r2(lines.reduce((t, l) => t + Math.max(0, l.qty * l.rate - (l.discount ?? 0)), 0));
  const taxable = Math.max(0, subtotal - discount);
  const vatAmount = r2((taxable * vatPercent) / 100);
  return { subtotal, taxable: r2(taxable), vatAmount, total: r2(taxable + vatAmount) };
}
