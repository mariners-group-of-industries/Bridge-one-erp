import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { R2Storage, r2ConfigFromEnv } from "@/lib/storage/r2";
import fs from "fs/promises";
import path from "path";

// MIME type map for secure and correct content delivery.
// SVG is deliberately absent: it can carry script, so it is served as a download.
const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  webm: "audio/webm",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  json: "application/json",
};

/**
 * Only BRG Connect uploads are served here. Module attachments (customers,
 * suppliers, sales, accounts …) share the bucket but have their own routes and
 * permission checks, so they must not be reachable through this one.
 */
const SERVED_PREFIX = "connect/";
const KEY_PATTERN = /^connect\/[A-Za-z0-9._-]+$/;
const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");

/** The validated object key, or null for anything outside Connect uploads (incl. `..` traversal). */
function safeKey(raw: string[] | string | undefined): string | null {
  const key = Array.isArray(raw) ? raw.join("/") : typeof raw === "string" ? raw : "";
  if (!key.startsWith(SERVED_PREFIX) || !KEY_PATTERN.test(key) || key.split("/").some((s) => s === "." || s === "..")) return null;
  return key;
}

const notFound = () => NextResponse.json({ error: "File not found" }, { status: 404 });

function fileResponse(data: Uint8Array, key: string) {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const inline = ext === "pdf" || contentType.startsWith("image/") || contentType.startsWith("audio/") || contentType.startsWith("video/");
  return new NextResponse(Buffer.from(data), {
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      // Signed-in content: browsers may cache it, shared caches may not.
      "Cache-Control": "private, max-age=86400",
      "Content-Disposition": inline ? "inline" : `attachment; filename="${path.basename(key)}"`,
    },
  });
}

export const GET = apiHandler<{ params: Promise<{ key: string[] | string }> }>("configuration:read", async (_request, props) => {
  const key = safeKey((await props.params)?.key);
  if (!key) return notFound();

  // 1. Cloudflare R2 object storage
  const r2Config = r2ConfigFromEnv();
  if (r2Config) {
    try {
      const data = await new R2Storage(r2Config).get(key);
      if (data) return fileResponse(data, key);
    } catch (r2Err) {
      console.warn("[Storage] R2 get error, falling back to local disk:", r2Err);
    }
  }

  // 2. Local uploads directory (development). The resolved path must stay inside it.
  const localPath = path.resolve(UPLOADS_DIR, key);
  if (!localPath.startsWith(UPLOADS_DIR + path.sep)) return notFound();
  try {
    return fileResponse(await fs.readFile(localPath), key);
  } catch {
    return notFound();
  }
});
