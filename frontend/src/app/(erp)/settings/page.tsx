"use client";

import { useState, useEffect } from "react";
import { Moon, Sun, Monitor, Bell, BellOff, Globe } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { applyTheme, readTheme } from "@/lib/theme";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark" | "system";

export default function SettingsPage() {
  const { toast } = useToast();
  const [theme, setTheme] = useState<Theme>("light");
  const [notifications, setNotifications] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    setTheme((localStorage.getItem("theme") as Theme) ?? "light");
    setCompactMode(localStorage.getItem("compactMode") === "true");
    const notif = localStorage.getItem("notifications");
    setNotifications(notif === null ? true : notif === "true");
    setLanguage(localStorage.getItem("language") ?? "en");
  }, []);

  function handleTheme(t: Theme) {
    setTheme(t);
    applyTheme(t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t);
    localStorage.setItem("theme", t);
  }

  function handleSave() {
    localStorage.setItem("compactMode", String(compactMode));
    localStorage.setItem("notifications", String(notifications));
    localStorage.setItem("language", language);
    toast({ title: "Settings saved.", variant: "success" });
  }

  return (
    <>
      <PageHead title="Settings" subtitle="Manage your display and notification preferences." />
      <PageContainer>
        <div className="mt-4 max-w-2xl space-y-6">

          {/* Appearance */}
          <Section title="Appearance">
            <p className="mb-3 text-xs text-ink-faint">Choose how BridgeOne looks for you.</p>
            <div className="grid grid-cols-3 gap-3">
              <ThemeOption icon={<Sun className="size-5" />} label="Light" active={theme === "light"} onClick={() => handleTheme("light")} />
              <ThemeOption icon={<Moon className="size-5" />} label="Dark" active={theme === "dark"} onClick={() => handleTheme("dark")} />
              <ThemeOption icon={<Monitor className="size-5" />} label="System" active={theme === "system"} onClick={() => handleTheme("system")} />
            </div>
          </Section>

          {/* Display */}
          <Section title="Display">
            <Toggle
              label="Compact Mode"
              description="Reduce spacing and padding across the interface."
              checked={compactMode}
              onChange={setCompactMode}
            />
          </Section>

          {/* Notifications */}
          <Section title="Notifications">
            <Toggle
              label="In-app Notifications"
              description="Show notification alerts inside the app."
              checked={notifications}
              onChange={setNotifications}
              icon={notifications ? <Bell className="size-4 text-accent" /> : <BellOff className="size-4 text-ink-faint" />}
            />
          </Section>

          {/* Language */}
          <Section title="Language & Region">
            <div className="flex items-center gap-3">
              <Globe className="size-4 shrink-0 text-ink-faint" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">Display Language</span>
                <span className="text-xs text-ink-faint">Select your preferred language.</span>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="ml-auto rounded border border-line bg-canvas px-3 py-1.5 text-sm text-ink focus:outline-2 focus:outline-accent"
              >
                <option value="en">English</option>
                <option value="bn">বাংলা (Bengali)</option>
              </select>
            </div>
          </Section>

          <div className="flex justify-end">
            <Button variant="accent" onClick={handleSave}>Save Settings</Button>
          </div>

        </div>
      </PageContainer>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-xs">
      <h2 className="mb-4 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

function ThemeOption({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-colors",
        active ? "border-accent bg-accent-soft text-accent-strong dark:text-accent" : "border-line bg-canvas text-ink-muted hover:bg-control",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Toggle({ label, description, checked, onChange, icon }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-xs text-ink-faint">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "ml-auto flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors",
          checked ? "border-accent bg-accent" : "border-line bg-control",
        )}
      >
        <span className={cn("size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
