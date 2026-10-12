import { z } from "zod";
import { requiredEmail, requiredText } from "@/lib/validation/fields";

export const companyInputSchema = z.object({
  name: requiredText("Company name", 150),
  address: requiredText("Company address", 500),
  email: requiredEmail("Contact email"),
});

export type CompanyInput = z.infer<typeof companyInputSchema>;
