import { apiHandler, ok, parseJson } from "@/lib/api/handler";
import { notificationSettingSchema } from "@/features/configuration/gateways/attendance-notifications/schemas/attendance-notification.schema";
import {
  getNotificationDashboard,
  saveNotificationSettings,
} from "@/features/configuration/gateways/attendance-notifications/server/attendance-notification.service";

export const GET = apiHandler("configuration:read", async () => ok(await getNotificationDashboard()));

export const PUT = apiHandler("configuration:write", async (request, _context, actor) =>
  ok(await saveNotificationSettings(actor, await parseJson(request, notificationSettingSchema))),
);
