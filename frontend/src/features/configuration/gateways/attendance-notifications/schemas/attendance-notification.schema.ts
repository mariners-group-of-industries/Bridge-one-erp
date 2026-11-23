import { z } from "zod";

export const DEFAULT_ATTENDANCE_MESSAGE_TEMPLATE = [
  "Assalamualaikum Sir,",
  "Name: {employee_name} (ID: {employee_id})",
  "Desig: {designation}",
  "In-Time: {date} at {time} ({status} as per software report)",
].join("\n");

export const notificationSettingSchema = z.object({
  enabled: z.boolean(),
  notifyCheckIn: z.boolean(),
  notifyLate: z.boolean(),
  notifyCheckOut: z.boolean(),
  whatsappGroupId: z
    .string()
    .trim()
    .max(120)
    .refine((v) => !v || v.endsWith("@g.us"), "WhatsApp Group ID must end with @g.us")
    .optional()
    .nullable(),
  whatsappGroupName: z.string().trim().max(200).optional().nullable(),
  departmentFilter: z.string().trim().max(500).optional().nullable(),
  messageTemplate: z.string().trim().min(5, "Message template is required").max(1500),
});

export type NotificationSettingInput = z.infer<typeof notificationSettingSchema>;

export const testNotificationSchema = z.object({
  groupId: z
    .string()
    .trim()
    .refine((v) => !v || v.endsWith("@g.us"), "WhatsApp Group ID must end with @g.us")
    .optional()
    .nullable(),
  message: z.string().trim().min(1).max(1500).optional(),
});
