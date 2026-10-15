import { z } from "zod";

// Wallet Setup (Configuration › Sales Config). Shared by the form and the API.
// "" means "not set"; the service stores NULL.

const optionalId = z
  .union([z.uuid("Select a valid option."), z.literal("")])
  .optional()
  .default("");

export const WALLET_FLAGS = [
  { key: "isRounding", label: "Is Rounding" },
  { key: "isCoupon", label: "Is Coupon" },
  { key: "isWalletCharge", label: "Is Wallet Charge" },
  { key: "isReferenceRequired", label: "Is Reference Required" },
  { key: "isMfs", label: "Is MFS" },
] as const;
export type WalletFlag = (typeof WALLET_FLAGS)[number]["key"];

export const walletInputSchema = z
  .object({
    businessUnitId: z.uuid("Select a business unit."),
    name: z.string().trim().min(1, "Enter the wallet name.").max(100, "At most 100 characters."),
    commissionPercent: z
      .string()
      .trim()
      .min(1, "Enter the commission.")
      .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100, { message: "Enter a percentage from 0 to 100 (up to 2 decimals)." }),
    isCash: z.boolean().optional().default(false),
    bankAccountId: optionalId,
    officeId: optionalId,
    referenceCode: z.string().trim().max(50, "At most 50 characters.").optional().default(""),
    isRounding: z.boolean().optional().default(false),
    isCoupon: z.boolean().optional().default(false),
    isWalletCharge: z.boolean().optional().default(false),
    isReferenceRequired: z.boolean().optional().default(false),
    isMfs: z.boolean().optional().default(false),
  })
  .refine((data) => data.isCash || data.bankAccountId !== "", { message: "Select the bank account (or mark the wallet as cash).", path: ["bankAccountId"] });

export type WalletInput = z.input<typeof walletInputSchema>;
export type WalletData = z.output<typeof walletInputSchema>;

export const walletListQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});
export type WalletListQuery = z.input<typeof walletListQuerySchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface WalletAttachmentDto {
  name: string;
  type: string;
  size: number;
}

export interface WalletDto extends WalletData {
  id: string;
  isActive: boolean;
  attachment: WalletAttachmentDto | null;
}

export interface WalletRow {
  id: string;
  name: string;
  commissionPercent: string;
  isCash: boolean;
  /** Bank account number, or null for cash wallets. */
  accountNo: string | null;
  referenceCode: string | null;
  isRounding: boolean;
  isCoupon: boolean;
  isWalletCharge: boolean;
}

export interface WalletList {
  rows: WalletRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WalletFormOptions {
  businessUnits: { id: string; name: string }[];
  offices: { id: string; name: string; businessUnitId: string }[];
  bankAccounts: { id: string; accountNumber: string; bankName: string; branchName: string }[];
}
