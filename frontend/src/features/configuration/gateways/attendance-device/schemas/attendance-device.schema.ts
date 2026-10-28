import { z } from "zod";

// Attendance Devices (Configuration › Community & Gateways): biometric terminals
// read by the attendance agent, and the punches it uploads.

export const MAX_PUNCHES_PER_UPLOAD = 10_000;

const host = z
  .string()
  .trim()
  .min(1, "Enter the device's IP address.")
  .max(64)
  .refine((v) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v) ? v.split(".").every((n) => Number(n) <= 255) : /^[a-z0-9.-]+$/i.test(v), { message: "Enter an IP address like 192.168.0.119." });

export const deviceInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a device name.").max(100, "At most 100 characters."),
  ipAddress: host,
  port: z.coerce.number({ message: "Enter the TCP port." }).int().min(1).max(65535).optional().default(4370),
  serialNumber: z.string().trim().max(60).optional().default(""),
  officeId: z.union([z.uuid("Select a valid office."), z.literal("")]).optional().default(""),
  isActive: z.boolean().optional().default(true),
});
export type DeviceInput = z.input<typeof deviceInputSchema>;

export const punchUploadSchema = z.object({
  punches: z
    .array(
      z.object({
        /** User number on the device (matched to the employee's Attendance ID). */
        userId: z.string().trim().min(1).max(30),
        /** ISO date-time with offset, e.g. 2026-10-28T09:02:11+06:00. */
        time: z.iso.datetime({ offset: true, message: "Punch time must be an ISO date-time." }),
        state: z.number().int().min(0).max(255).nullable().optional(),
      }),
    )
    .max(MAX_PUNCHES_PER_UPLOAD, `Upload at most ${MAX_PUNCHES_PER_UPLOAD} punches at a time.`),
  /** Set by the agent when it could not read the device. */
  error: z.string().trim().max(500).optional(),
  serialNumber: z.string().trim().max(60).optional(),
});
export type PunchUpload = z.input<typeof punchUploadSchema>;

export interface DeviceRow {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  serialNumber: string;
  officeId: string;
  officeName: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncCount: number | null;
  lastError: string | null;
  /** Latest punch stored for this device (the agent uploads from here on). */
  lastPunchAt: string | null;
  punchCount: number;
  unmatchedCount: number;
}

export interface PunchUploadResult {
  received: number;
  inserted: number;
  duplicates: number;
  /** Punches (new or older) still without an employee for this device. */
  unmatched: number;
}

export interface DeviceFormOptions {
  offices: { id: string; name: string }[];
}
