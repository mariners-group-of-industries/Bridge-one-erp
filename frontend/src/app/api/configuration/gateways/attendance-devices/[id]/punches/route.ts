import { punchUploadSchema } from "@/features/configuration/gateways/attendance-device/schemas/attendance-device.schema";
import { uploadPunches } from "@/features/configuration/gateways/attendance-device/server/attendance-device.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Attendance agent upload: { punches: [{ userId, time, state? }], error?, serialNumber? }. Needs a Read & write API token. */
export const POST = apiHandler("configuration:write", async (request, context: Context, actor) =>
  ok(await uploadPunches(actor, parseId((await context.params).id, "Attendance device"), await parseJson(request, punchUploadSchema))),
);
