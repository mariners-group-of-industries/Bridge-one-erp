import type { ZodError } from "zod";
import { ApiClientError } from "@/lib/api/client";

/** Zod issues → { "lines.0.qty": "message" } (first message per field). */
export function issuesToErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[issue.path.join(".")] ??= issue.message;
  return errors;
}

/** Field errors returned by the API, if any. */
export function apiFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiClientError)) return {};
  return Object.fromEntries(Object.entries(error.fieldErrors).map(([key, messages]) => [key, messages[0] ?? ""]));
}

/** "" → null, otherwise the number (NaN stays NaN so validation reports it). */
export function optionalNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

/** "" → NaN so required-number validation reports it. */
export function requiredNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/** Number → input string ("" for null). */
export function numberText(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
