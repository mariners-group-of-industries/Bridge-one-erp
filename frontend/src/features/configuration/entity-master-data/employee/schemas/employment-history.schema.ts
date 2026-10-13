import { z } from "zod";

export const employmentEntrySchema = z.object({
  companyName: z.string().min(1).max(200),
  jobTitle:    z.string().min(1).max(150),
  location:    z.string().min(1).max(150),
  description: z.string().max(1000).optional().or(z.literal("")),
  fromDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const upsertEmploymentHistorySchema = z.object({
  entries: z.array(employmentEntrySchema),
});

export type EmploymentEntryInput = z.infer<typeof employmentEntrySchema>;
export type UpsertEmploymentHistoryInput = z.infer<typeof upsertEmploymentHistorySchema>;

export interface EmploymentHistoryDto {
  id:          string;
  companyName: string;
  jobTitle:    string;
  location:    string;
  description: string;
  fromDate:    string;
  toDate:      string;
}
