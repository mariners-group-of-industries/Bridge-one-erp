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
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "File exceeds 25 MB maximum limit" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeKey = `connect/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const contentType = file.type || "application/octet-stream";

    let fileUrl: string;

    // 1. Try Cloudflare R2 / S3 Object Storage Driver (10 GB Free Tier, $0 Egress)
    const r2Config = r2ConfigFromEnv();
    if (r2Config) {
      const r2 = new R2Storage(r2Config);
      fileUrl = await r2.put(safeKey, buffer, contentType);
    } else {
      // 2. Fallback to local storage for offline development
      const uploadDir = path.join(process.cwd(), "public", "uploads", "connect");
      await fs.mkdir(uploadDir, { recursive: true });
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = path.join(uploadDir, safeName);
      await fs.writeFile(filePath, buffer);
      fileUrl = `/uploads/connect/${safeName}`;
    }

    return NextResponse.json({
      success: true,
      attachment: {
        id: `att-${Date.now()}`,
        name: file.name,
        sizeBytes: file.size,
        mimeType: contentType,
        url: fileUrl,
        type: contentType.startsWith("image/")
          ? "image"
          : contentType.includes("pdf")
          ? "doc"
          : "file",
      },
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
