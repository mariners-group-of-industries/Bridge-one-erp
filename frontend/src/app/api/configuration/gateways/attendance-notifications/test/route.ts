import { apiHandler, ok, parseJson } from "@/lib/api/handler";
import { testNotificationSchema } from "@/features/configuration/gateways/attendance-notifications/schemas/attendance-notification.schema";
import { sendTestAttendanceNotification } from "@/features/configuration/gateways/attendance-notifications/server/attendance-notification.service";

export const POST = apiHandler("configuration:write", async (request, _context, actor) =>
  ok(await sendTestAttendanceNotification(actor, await parseJson(request, testNotificationSchema))),
);
