import { myPhoto } from "@/features/ess/server/ess.service";
import { notFound } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/handler";

/** PNG, JPEG or WebP from the file's first bytes; anything else is not served as a photo. */
function imageType(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** The signed-in employee's own profile photo. */
export const GET = apiHandler("employees:read", async (_request, _context, actor) => {
  const bytes = new Uint8Array(await myPhoto(actor));
  const type = imageType(bytes);
  if (!type) throw notFound("Photo");
  return new Response(new Blob([bytes], { type }), {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" },
  });
});
