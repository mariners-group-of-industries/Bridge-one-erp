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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(phone: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server error (${res.status}). Please check server logs.`);
    }
    if (!res.ok) throw new Error(data?.error ?? "Login failed.");
    setUser(data as SessionUser);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
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
