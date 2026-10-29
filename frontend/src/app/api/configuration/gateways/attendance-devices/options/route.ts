import { deviceFormOptions } from "@/features/configuration/gateways/attendance-device/server/attendance-device.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await deviceFormOptions(actor)));
