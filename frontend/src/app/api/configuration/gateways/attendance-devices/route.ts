import { deviceInputSchema } from "@/features/configuration/gateways/attendance-device/schemas/attendance-device.schema";
import { createDevice, listDevices } from "@/features/configuration/gateways/attendance-device/server/attendance-device.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** Devices with their sync status. The attendance agent reads this list too. */
export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await listDevices(actor)));

export const POST = apiHandler("configuration:write", async (request, _context, actor) => ok(await createDevice(actor, await parseJson(request, deviceInputSchema)), 201));
