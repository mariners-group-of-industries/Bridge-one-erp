import { NextResponse } from "next/server";
import { connectRoute } from "@/lib/connect/route";
import fs from "fs/promises";
import path from "path";

async function handlePOST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save under public/uploads/connect
    const uploadDir = path.join(process.cwd(), "public", "uploads", "connect");
    await fs.mkdir(uploadDir, { recursive: true });

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadDir, safeName);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/connect/${safeName}`;

    return NextResponse.json({
      success: true,
      attachment: {
        id: `att-${Date.now()}`,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type || "application/octet-stream",
        url: publicUrl,
        type: file.type.startsWith("image/") ? "image" : file.type.includes("pdf") ? "doc" : "file",
      },
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}


export const POST = connectRoute("configuration:write", handlePOST);
