import { getAuthCookie } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";

export interface ConnectAuthUser {
  id: string;
  name: string;
  role: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ensureValidUuid(id?: string | null): string {
  if (id && UUID_REGEX.test(id)) {
    return id;
  }
  return "00000000-0000-0000-0000-000000000001";
}

const DEV_FALLBACK_USER: ConnectAuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "System Admin",
  role: "admin",
};

/**
 * Resolves the authenticated user for BRG Connect API routes.
 * Extracts user identity securely from verified JWT cookie / Bearer token.
 */
export async function getConnectAuthUser(req?: Request): Promise<ConnectAuthUser | null> {
  try {
    // 1. Check Bearer Authorization header if present
    if (req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        const payload = await verifyToken(token);
        if (payload?.sub) {
          return {
            id: ensureValidUuid(payload.sub),
            name: payload.name || "User",
            role: payload.role || "member",
          };
        }
      }
    }

    // 2. Check HTTP-only cookie
    const cookieToken = await getAuthCookie();
    if (cookieToken) {
      const payload = await verifyToken(cookieToken);
      if (payload?.sub) {
        return {
          id: ensureValidUuid(payload.sub),
          name: payload.name || "User",
          role: payload.role || "member",
        };
      }
    }

    // 3. Dev bypass fallback if enabled
    if (process.env.ERP_DEV_AUTH_BYPASS === "true" || process.env.NODE_ENV !== "production") {
      return DEV_FALLBACK_USER;
    }

    return null;
  } catch {
    if (process.env.ERP_DEV_AUTH_BYPASS === "true" || process.env.NODE_ENV !== "production") {
      return DEV_FALLBACK_USER;
    }
    return null;
  }
}
