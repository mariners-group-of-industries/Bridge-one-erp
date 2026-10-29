import { deviceInputSchema } from "@/features/configuration/gateways/attendance-device/schemas/attendance-device.schema";
import { deleteDevice, updateDevice } from "@/features/configuration/gateways/attendance-device/server/attendance-device.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };
const idOf = async (context: Context) => parseId((await context.params).id, "Attendance device");

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => ok(await updateDevice(actor, await idOf(context), await parseJson(request, deviceInputSchema))));

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  await deleteDevice(actor, await idOf(context));
  return noContent();
});
