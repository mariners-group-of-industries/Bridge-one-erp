export * from "./client";
export * from "./errors";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const baseUrl =
    API_BASE_URL ||
    (typeof window !== "undefined" ? "/api/v1" : "http://localhost:3000/api/v1");
  const url = `${baseUrl}${cleanEndpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-company-id": "comp-bridgeone-01",
      "x-user-id": "usr-bridgeone-procurement-mgr",
      "x-user-name": "Fuad Hossain",
      "x-user-role": "PURCHASE_MANAGER",
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let errMessage = `API Error: ${res.status} ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData?.error?.message) {
        errMessage = errData.error.message;
      }
    } catch (_) {}
    throw new Error(errMessage);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}
