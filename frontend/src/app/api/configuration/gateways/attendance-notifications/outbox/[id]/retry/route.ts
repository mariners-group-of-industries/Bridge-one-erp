import { apiHandler, ok, parseId } from "@/lib/api/handler";
import { retryNotificationOutboxItem } from "@/features/configuration/gateways/attendance-notifications/server/attendance-notification.service";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler("configuration:write", async (_request, context: Context) =>
  ok(await retryNotificationOutboxItem(parseId((await context.params).id, "Outbox item"))),
);
