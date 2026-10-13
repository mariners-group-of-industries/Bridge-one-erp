import { z } from "zod";

export const academicEntrySchema = z.object({
  isForeigner:  z.boolean(),
  institute:    z.string().min(1).max(200),
  degree:       z.string().min(1).max(150),
  fieldOfStudy: z.string().min(1).max(150),
  result:       z.string().min(1).max(50),
  scale:        z.string().min(1).max(20),
  startDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  finishDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const upsertAcademicsSchema = z.object({
  entries: z.array(academicEntrySchema),
});

export type AcademicEntryInput = z.infer<typeof academicEntrySchema>;
export type UpsertAcademicsInput = z.infer<typeof upsertAcademicsSchema>;

export interface AcademicDto {
  id:           string;
  isForeigner:  boolean;
  institute:    string;
  degree:       string;
  fieldOfStudy: string;
  result:       string;
  scale:        string;
  startDate:    string;
  finishDate:   string;
}
