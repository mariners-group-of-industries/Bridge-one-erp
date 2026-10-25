"use client";

import { AlertCircle, Eye, EyeOff, Lock, Moon, Phone, Sun } from "lucide-react";
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
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  function handleToggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid phone number or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-between bg-canvas px-4 py-8">
      {/* Top right theme toggle */}
      <div className="w-full max-w-sm flex justify-end">
        <button
          type="button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          onClick={handleToggleTheme}
          className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-faint shadow-xs transition-colors hover:bg-hover hover:text-ink"
        >
          {theme === "dark" ? (
            <Sun className="size-4 text-amber-400" />
          ) : (
            <Moon className="size-4" />
          )}
        </button>
      </div>

      {/* Centered Login Card */}
      <div className="w-full max-w-sm my-auto">
        <div className="rounded-2xl border border-line bg-surface p-7 sm:p-8 shadow-sm">
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 border border-slate-200/80 shadow-xs dark:border-slate-700">
              <img
                src="/logo.png"
                alt="BridgeOne ERP"
                className="h-8 w-auto object-contain"
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-ink">
              Welcome back
            </h1>
            <p className="mt-1 text-xs text-ink-faint">
              Sign in to your BridgeOne account
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 p-3 text-xs text-danger"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-danger" />
              <p className="leading-tight">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-xs font-medium text-ink">
                Phone Number
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
                  <Phone className="size-4" />
                </span>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  autoFocus
                  required
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-canvas/50 pl-10 pr-3.5 text-sm text-ink placeholder:text-ink-faint/60 transition-colors focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium text-ink">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
                  <Lock className="size-4" />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-canvas/50 pl-10 pr-10 text-sm text-ink placeholder:text-ink-faint/60 transition-colors focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-faint hover:text-ink focus:outline-none"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-fg shadow-xs transition-opacity hover:opacity-95 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full text-center text-xs text-ink-faint">
        © {YEAR} Mariners Group · BridgeOne ERP
      </footer>
    </div>
  );
}


