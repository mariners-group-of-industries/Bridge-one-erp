import { ApiClientError } from "@/lib/api/client";

/** Downloads a file response (Excel / PDF); API errors are thrown like `apiRequest`. */
export async function downloadFile(path: string, fallbackName: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Unable to reach the server. Check your connection.");
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiClientError(response.status, "INTERNAL_ERROR", payload?.error?.message ?? `Download failed (${response.status}).`);
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1];
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name ? decodeURIComponent(name) : fallbackName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
