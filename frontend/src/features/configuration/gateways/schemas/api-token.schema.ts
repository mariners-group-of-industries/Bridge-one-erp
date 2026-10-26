import { z } from "zod";

// API Configuration (Configuration › Community & Gateways): tokens other systems
// use to call the API with `Authorization: Bearer <token>`.

export const TOKEN_ACCESS = [
  { value: "READ", label: "Read only (GET)" },
  { value: "READ_WRITE", label: "Read & write" },
] as const;

export const TOKEN_EXPIRY = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
  { value: "never", label: "Never" },
] as const;

export const generateTokenSchema = z.object({
  name: z.string().trim().min(1, "Enter a name for the token.").max(100, "At most 100 characters."),
  access: z.enum(["READ", "READ_WRITE"], { message: "Select the access level." }),
  expiry: z.enum(["30", "90", "180", "365", "never"], { message: "Select when the token expires." }),
});
export type GenerateTokenInput = z.input<typeof generateTokenSchema>;

export type TokenStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export interface ApiTokenRow {
  id: string;
  name: string;
  /** First characters of the token, for recognising it ("b1_AbC12345…"). */
  tokenPrefix: string;
  access: "READ" | "READ_WRITE";
  status: TokenStatus;
  createdByName: string | null;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

/** Returned once, right after generating: the only time the full token is visible. */
export interface GeneratedToken extends ApiTokenRow {
  token: string;
}
