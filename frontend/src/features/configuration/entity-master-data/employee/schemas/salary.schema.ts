import { z } from "zod";

const dec = z.string().regex(/^\d*\.?\d*$/).or(z.literal(""));

export const salaryAdjustmentSchema = z.object({
  fromMonth: z.string().regex(/^\d{4}-\d{2}$/),
  toMonth:   z.string().regex(/^\d{4}-\d{2}$/),
  type:      z.enum(["addition", "deduction"]),
  amount:    z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const upsertSalarySchema = z.object({
  salaryType:      z.enum(["regular", "day-basis"]),
  salaryOption:    z.enum(["gross", "structure-basic", "structure-gross"]),
  grossOnly:       dec.optional(),
  structBasic:     dec.optional(),
  structGross:     dec.optional(),
  sgGross:         dec.optional(),
  sgBasic:         dec.optional(),
  sgHouseRent:     dec.optional(),
  sgMedical:       dec.optional(),
  sgConveyance:    dec.optional(),
  sgMobile:        dec.optional(),
  sgFood:          dec.optional(),
  sgExtra:         dec.optional(),
  disbursementMode: z.enum(["cash", "bank", "mfs", "multiple"]),
  eligibleOT:      z.boolean(),
  eligiblePF:      z.boolean(),
  bankName:        z.string().max(150).optional().or(z.literal("")),
  branchName:      z.string().max(150).optional().or(z.literal("")),
  bankAccountName: z.string().max(150).optional().or(z.literal("")),
  bankAccountNo:   z.string().max(50).optional().or(z.literal("")),
  routingNo:       z.string().max(50).optional().or(z.literal("")),
  mfsProvider:     z.string().max(50).optional().or(z.literal("")),
  mfsNumber:       z.string().max(30).optional().or(z.literal("")),
  mfsAccountName:  z.string().max(150).optional().or(z.literal("")),
  adjustments:     z.array(salaryAdjustmentSchema),
});

export type UpsertSalaryInput = z.infer<typeof upsertSalarySchema>;

export interface SalaryAdjustmentDto {
  id:        string;
  fromMonth: string;
  toMonth:   string;
  type:      "addition" | "deduction";
  amount:    string;
}

export interface SalaryDto {
  salaryType:      string;
  salaryOption:    string;
  grossOnly:       string;
  structBasic:     string;
  structGross:     string;
  sgGross:         string;
  sgBasic:         string;
  sgHouseRent:     string;
  sgMedical:       string;
  sgConveyance:    string;
  sgMobile:        string;
  sgFood:          string;
  sgExtra:         string;
  disbursementMode: string;
  eligibleOT:      boolean;
  eligiblePF:      boolean;
  bankName:        string;
  branchName:      string;
  bankAccountName: string;
  bankAccountNo:   string;
  routingNo:       string;
  mfsProvider:     string;
  mfsNumber:       string;
  mfsAccountName:  string;
  adjustments:     SalaryAdjustmentDto[];
}
