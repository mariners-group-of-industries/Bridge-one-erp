"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { workspaces } from "@/lib/navigation/registry";
import type { Workspace } from "@/lib/navigation/types";
import { visibleWorkspaces } from "@/lib/permissions/navigation";
import { grantsAllow, grantsFromList, NO_ACCESS, type AccessGrants, type PermissionAction } from "@/lib/permissions/registry";

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  initials: string;
  isMaster?: boolean;
  /** Effective permission keys from /api/auth/me (["*"] = everything). */
  permissions?: string[];
  /** ERP Login "Hide Stock In Sales": Sales screens do not show stock levels. */
  hideStockInSales?: boolean;
}

interface SessionCtx {
  user: SessionUser | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  /** What the signed-in user holds; the server enforces the same rules on every request. */
  grants: AccessGrants;
  can: (featureKey: string, action?: PermissionAction) => boolean;
  /** The menus filtered to what the user may open. */
  workspaces: Workspace[];
}

const Ctx = createContext<SessionCtx | null>(null);

/** Sign-in, sign-out and session checks give up after this long instead of spinning forever. */
const AUTH_TIMEOUT_MS = 20_000;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store", signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(phone: string, password: string) {
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
        cache: "no-store",
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      });
    } catch (err) {
      throw new Error(
        err instanceof DOMException && err.name === "TimeoutError"
          ? "The server is taking too long to answer. Please try again."
          : "Could not reach the server. Check your connection and try again.",
      );
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server error (${res.status}). Please check server logs.`);
    }
    if (!res.ok) throw new Error(data?.error ?? "Login failed.");
    // The login response has no permissions; load them so menus and pages work without a reload.
    const me = await fetch("/api/auth/me", { cache: "no-store", signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setUser((me ?? data) as SessionUser);
  }

  /**
   * Ends the session on the server first, then reloads the sign-in page. A full
   * load drops every in-memory session and cached page of the signed-in user, so
   * the sign-in page can never see the old cookie or state.
   */
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) }).catch(() => undefined);
    setUser(null);
    window.location.replace("/login");
  }

  const grants = useMemo(() => (user?.permissions ? grantsFromList(user.permissions) : NO_ACCESS), [user]);
  const can = useCallback((featureKey: string, action: PermissionAction = "view") => grantsAllow(grants, featureKey, action), [grants]);
  const visible = useMemo(() => visibleWorkspaces(workspaces, grants), [grants]);

  return <Ctx.Provider value={{ user, loading, login, logout, grants, can, workspaces: visible }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
