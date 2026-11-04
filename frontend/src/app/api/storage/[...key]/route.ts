import { NextResponse } from "next/server";
import { getConnectAuthUser } from "@/lib/connect/auth";
import { R2Storage, r2ConfigFromEnv } from "@/lib/storage/r2";
import fs from "fs/promises";
import path from "path";

// MIME type map for secure and correct content delivery
const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
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

export async function GET(
  req: Request,
  props: { params: Promise<{ key: string[] | string }> }
) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await props.params;
    const rawKey = resolvedParams?.key;
    const key = Array.isArray(rawKey)
      ? rawKey.join("/")
      : typeof rawKey === "string"
      ? rawKey
      : "";

    if (!key) {
      return NextResponse.json({ error: "File key required" }, { status: 400 });
    }

    const ext = key.split(".").pop()?.toLowerCase() || "";
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // 1. Fetch from Cloudflare R2 Object Storage
    const r2Config = r2ConfigFromEnv();
    if (r2Config) {
      const r2 = new R2Storage(r2Config);
      const data = await r2.get(key);
      if (data) {
        return new NextResponse(Buffer.from(data), {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": ext === "pdf" || contentType.startsWith("image/") || contentType.startsWith("audio/")
              ? "inline"
              : `attachment; filename="${path.basename(key)}"`,
          },
        });
      }
    }

    // 2. Fallback to local uploads directory for development
    try {
      const localPath = path.join(process.cwd(), "public", "uploads", key);
      const localData = await fs.readFile(localPath);
      return new NextResponse(localData, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      // Local file not found
    }

    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (error) {
    console.error("Storage download error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
