import { apiHandler } from "@/lib/api/handler";
import type { Permission } from "@/lib/auth/actor";

type ConnectHandler = (request: Request, context: never) => Promise<Response>;

/**
 * Wraps a Connect route handler: signed-in users only, and the page permission
 * comes from src/lib/permissions/api-rules.ts (Connect pages under /connect).
 */
export function connectRoute(permission: Permission, handler: ConnectHandler) {
  return apiHandler<{ params: Promise<Record<string, string>> }>(permission, (request, context) => handler(request, context as never));
}
