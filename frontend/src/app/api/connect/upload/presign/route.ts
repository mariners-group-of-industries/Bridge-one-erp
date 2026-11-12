import { NextResponse } from "next/server";
import { getConnectAuthUser } from "@/lib/connect/auth";
import { R2Storage, r2ConfigFromEnv } from "@/lib/storage/r2";
import { connectRoute } from "@/lib/connect/route";

async function handlePOST(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { filename, contentType } = body;
    if (!filename) {
      return NextResponse.json({ success: false, error: "Filename is required" }, { status: 400 });
    }

    const r2Config = r2ConfigFromEnv();
    if (!r2Config) {
      return NextResponse.json(
        { success: false, error: "Cloudflare R2 is not configured" },
        { status: 400 }
      );
    }

    const safeKey = `connect/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const r2 = new R2Storage(r2Config);
    const presignedUrl = await r2.getPresignedUploadUrl(
      safeKey,
      contentType || "application/octet-stream"
    );

    const publicUrl = r2Config.publicUrl
      ? `${r2Config.publicUrl.replace(/\/+$/, "")}/${safeKey}`
      : `/api/storage/${safeKey}`;

    return NextResponse.json({
      success: true,
      presignedUrl,
      key: safeKey,
      publicUrl,
    });
  } catch (error) {
    console.error("Presign upload error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate presigned URL" }, { status: 500 });
  }
}

export const POST = connectRoute("configuration:write", handlePOST);
