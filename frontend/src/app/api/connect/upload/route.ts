import { NextResponse } from "next/server";
import { getConnectAuthUser } from "@/lib/connect/auth";
import { R2Storage, r2ConfigFromEnv } from "@/lib/storage/r2";
import fs from "fs/promises";
import path from "path";

// 25 MB max file size limit for enterprise security & performance
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    // Support bulk files ("files") and single file ("file")
    const rawFiles = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter((f): f is File => f instanceof File && f.size > 0);

    if (rawFiles.length === 0) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const r2Config = r2ConfigFromEnv();
    const uploadedAttachments = [];

    for (const file of rawFiles) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, error: `File "${file.name}" exceeds 25 MB maximum limit` },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const safeKey = `connect/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const contentType = file.type || "application/octet-stream";

      let fileUrl: string | null = null;

      // 1. Primary: Cloudflare R2 Object Storage
      if (r2Config) {
        try {
          const r2 = new R2Storage(r2Config);
          fileUrl = await r2.put(safeKey, buffer, contentType);
        } catch (r2Err) {
          console.error("[Upload] Cloudflare R2 upload error:", r2Err);
        }
      }

      // 2. Fallback: Local disk storage (wrapped in try/catch for read-only environments)
      if (!fileUrl) {
        try {
          const uploadDir = path.join(process.cwd(), "public", "uploads", "connect");
          await fs.mkdir(uploadDir, { recursive: true });
          const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
          const filePath = path.join(uploadDir, safeName);
          await fs.writeFile(filePath, buffer);
          fileUrl = `/uploads/connect/${safeName}`;
        } catch (diskErr) {
          console.warn("[Upload] Local disk storage unavailable:", diskErr);
        }
      }

      // 3. Fallback for files if cloud and local disk are unavailable: Data URI
      if (!fileUrl) {
        if (buffer.length <= 4 * 1024 * 1024) {
          fileUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
        } else {
          return NextResponse.json(
            { success: false, error: `Could not store file "${file.name}". Storage driver unavailable.` },
            { status: 500 }
          );
        }
      }

      const attachmentType = contentType.startsWith("image/")
        ? "image"
        : contentType.startsWith("audio/")
        ? "audio"
        : contentType.includes("pdf") ||
          contentType.includes("document") ||
          contentType.includes("sheet") ||
          contentType.includes("excel")
        ? "doc"
        : "file";

      uploadedAttachments.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        fileKey: safeKey,
        sizeBytes: file.size,
        mimeType: contentType,
        url: fileUrl,
        type: attachmentType,
      });
    }

    return NextResponse.json({
      success: true,
      attachment: uploadedAttachments[0], // backward compatibility
      attachments: uploadedAttachments,   // bulk attachments
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    const msg = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
