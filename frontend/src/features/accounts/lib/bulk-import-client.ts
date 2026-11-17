"use client";

import { apiRequest } from "@/lib/api/client";

export interface BulkImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

/** Uploads a filled template to `/api/accounts/<doc>/import`. */
export async function uploadAccountImport(path: string, file: File): Promise<BulkImportResult> {
  const form = new FormData();
  form.set("file", file);
  return apiRequest<BulkImportResult>(path, { method: "POST", body: form });
}
