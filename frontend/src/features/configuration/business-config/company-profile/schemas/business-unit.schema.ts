import { z } from "zod";
import { requiredEmail, requiredPhone, requiredText } from "@/lib/validation/fields";

export const DATE_FORMATS = [
  "DD_MM_YYYY_SLASH",
  "MM_DD_YYYY_SLASH",
  "YYYY_MM_DD_DASH",
  "DD_MM_YYYY_DASH",
] as const;

export type DateFormat = (typeof DATE_FORMATS)[number];

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  DD_MM_YYYY_SLASH: "DD/MM/YYYY",
  MM_DD_YYYY_SLASH: "MM/DD/YYYY",
  YYYY_MM_DD_DASH: "YYYY-MM-DD",
  DD_MM_YYYY_DASH: "DD-MM-YYYY",
};

export const businessUnitInputSchema = z.object({
  name: requiredText("Business unit name", 150),
  address: requiredText("Business unit address", 500),
  contactNumber: requiredPhone("Contact number"),
  email: requiredEmail("Business unit email"),
  dateFormat: z.enum(DATE_FORMATS, { error: "Select a date format." }),
});

export type BusinessUnitInput = z.infer<typeof businessUnitInputSchema>;
