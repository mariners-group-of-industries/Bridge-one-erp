export interface GatewayHealth {
  configured: boolean;
  connected: boolean;
  phone: string | null;
  qrPending: boolean;
  error?: string;
}

export interface GatewayGroup {
  id: string;
  name: string;
}

function gatewayConfig(): { url: string; token: string } | null {
  const url = (process.env.WHATSAPP_GATEWAY_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.WHATSAPP_GATEWAY_TOKEN || "").trim();
  if (!url || !token) return null;
  return { url, token };
}

async function gatewayFetch<T>(path: string, init: RequestInit = {}, timeoutMs = 4000): Promise<T> {
  const cfg = gatewayConfig();
  if (!cfg) {
    throw new Error("WhatsApp gateway is not configured (WHATSAPP_GATEWAY_URL / WHATSAPP_GATEWAY_TOKEN missing).");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(body.error || `Gateway responded with HTTP ${res.status}`));
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function getGatewayHealth(): Promise<GatewayHealth> {
  if (!gatewayConfig()) {
    return { configured: false, connected: false, phone: null, qrPending: false };
  }
  try {
    const data = await gatewayFetch<{ connected?: boolean; phone?: string | null; qrPending?: boolean }>("/health", {}, 3000);
    return {
      configured: true,
      connected: Boolean(data.connected),
      phone: data.phone ?? null,
      qrPending: Boolean(data.qrPending),
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      phone: null,
      qrPending: false,
      error: err instanceof Error ? err.message : "Gateway unreachable",
    };
  }
}

export async function listGatewayGroups(): Promise<GatewayGroup[]> {
  const data = await gatewayFetch<{ groups?: GatewayGroup[] }>("/groups", {}, 4000);
  return Array.isArray(data.groups) ? data.groups : [];
}

export async function sendGatewayMessage(groupId: string, message: string): Promise<{ accepted: boolean; messageId: string | null }> {
  const data = await gatewayFetch<{ accepted?: boolean; messageId?: string | null }>(
    "/send",
    {
      method: "POST",
      body: JSON.stringify({ groupId, message }),
    },
    15000,
  );
  return { accepted: Boolean(data.accepted), messageId: data.messageId ?? null };
}
