"use client";

import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/session";
import { applyTheme, readTheme } from "@/lib/theme";

const YEAR = new Date().getFullYear();

export default function LoginPage() {
  const { login, user } = useSession();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(phone, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh bg-canvas">

      {/* ── Left brand panel (hidden on mobile) ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-accent-strong p-10 lg:flex lg:w-[45%]">
        {/* Background pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white"
              style={{
                width: `${(i + 1) * 160}px`,
                height: `${(i + 1) * 160}px`,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/20 text-lg font-bold text-white backdrop-blur">
            B
          </span>
          <span className="text-lg font-semibold text-white">BridgeOne ERP</span>
        </div>

        {/* Center text */}
        <div className="relative space-y-4">
          <h2 className="text-3xl font-bold leading-snug text-white">
            Manage your business<br />from one place.
          </h2>
          <p className="text-sm leading-relaxed text-white/70">
            Streamline operations, track employees, manage sales and purchases — all in a single unified platform built for Mariners Group.
          </p>
        </div>

        {/* Footer */}
        <p className="relative text-xs text-white/40">
          © {YEAR} Mariners Group · BridgeOne ERP
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent-strong text-sm font-bold text-white">
              B
            </span>
            <span className="text-sm font-semibold text-ink">BridgeOne ERP</span>
          </div>
          <div className="hidden lg:block" />

          {/* Theme toggle */}
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => applyTheme(readTheme() === "dark" ? "light" : "dark")}
            className="flex size-9 items-center justify-center rounded-lg text-ink-faint hover:bg-control hover:text-ink"
          >
            <Moon className="size-4 dark:hidden" />
            <Sun className="hidden size-4 dark:block" />
          </button>
        </div>

        {/* Form centered */}
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">

            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
              <p className="mt-1 text-sm text-ink-faint">Sign in to your BridgeOne account</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="phone" className="text-sm font-medium text-ink">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  autoFocus
                  required
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-line"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-ink">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-line bg-surface pl-4 pr-11 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-line"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3">
                  <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-danger" />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 h-11 w-full rounded-xl bg-accent-strong text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in…
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-ink-faint lg:hidden">
              © {YEAR} Mariners Group · BridgeOne ERP
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
