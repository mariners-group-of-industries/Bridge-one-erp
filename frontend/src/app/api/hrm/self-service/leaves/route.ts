import { applyLeave, listLeaves } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { validateAttachment } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

const employeeParam = (request: Request) => new URL(request.url).searchParams.get("employeeId") || undefined;

export const GET = apiHandler("employees:read", async (request, _context, actor) => ok(await listLeaves(actor, employeeParam(request))));

/** multipart/form-data: `data` (the application as JSON) plus up to three `files`. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Expected a multipart/form-data upload.");
  }
  let data: unknown;
  try {
    data = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    throw badRequest("The application details are missing.");
  }
  const uploads = form.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
  // Reject on declared size/type before buffering the content.
  for (const file of uploads) validateAttachment({ name: file.name, type: file.type, size: file.size });
  const files = await Promise.all(uploads.map(async (file) => ({ name: file.name, type: file.type, size: file.size, bytes: new Uint8Array(await file.arrayBuffer()) })));
  return ok(await applyLeave(actor, data as Parameters<typeof applyLeave>[1], files), 201);
});
