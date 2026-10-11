import { assetKindFromSlug } from "@/features/configuration/business-config/company-profile/schemas/office.schema";
import {
  deleteOfficeAsset,
  putOfficeAsset,
  readOfficeAsset,
  validateAssetFile,
} from "@/features/configuration/business-config/company-profile/server/office-asset.service";
import { badRequest, notFound } from "@/lib/api/errors";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = RouteContext<"/api/configuration/offices/[officeId]/assets/[kind]">;

async function resolveParams(context: Context) {
  const params = await context.params;
  const kind = assetKindFromSlug(params.kind);
  if (!kind) throw notFound("Asset type");
  return { officeId: parseId(params.officeId, "Office"), kind };
}

/** Streams the stored file. Assets are served through the API so access stays authorised. */
export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const { officeId, kind } = await resolveParams(context);
  const asset = await readOfficeAsset(actor, officeId, kind);
  return new Response(new Blob([new Uint8Array(asset.bytes)], { type: asset.mimeType }), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.bytes.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
});

/** Upload or replace an asset. Expects multipart/form-data with a single `file` field. */
export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const { officeId, kind } = await resolveParams(context);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Expected a multipart/form-data upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("A file is required.");

  // Reject on declared size/type before buffering the content.
  validateAssetFile({ name: file.name, type: file.type, size: file.size });
  const bytes = new Uint8Array(await file.arrayBuffer());

  const asset = await putOfficeAsset(actor, officeId, kind, {
    name: file.name,
    type: file.type,
    size: bytes.byteLength,
    bytes,
  });
  return ok(asset);
});

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  const { officeId, kind } = await resolveParams(context);
  await deleteOfficeAsset(actor, officeId, kind);
  return noContent();
});
