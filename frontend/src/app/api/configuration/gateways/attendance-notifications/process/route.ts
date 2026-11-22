import { apiHandler, ok } from "@/lib/api/handler";
import { processPendingAttendanceNotifications } from "@/features/configuration/gateways/attendance-notifications/server/attendance-notification.service";

export const POST = apiHandler("configuration:write", async () => ok({ sent: await processPendingAttendanceNotifications(50) }));
