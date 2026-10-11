"use client";

import {
  Bell,
  Building2,
  ChevronDown,
  Flag,
  Heart,
  Keyboard,
  LogOut,
  Mic,
  Moon,
  PanelLeft,
  QrCode,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { useSession } from "@/lib/auth/session";
import { applyTheme, readTheme } from "@/lib/theme";
import { cn } from "@/lib/cn";

interface NavbarProps {
  onToggleSidebar: () => void;
  sidebarHidden: boolean;
  onOpenSearch: () => void;
}

export function Navbar({ onToggleSidebar, sidebarHidden, onOpenSearch }: NavbarProps) {
  const { user, logout } = useSession();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-1 border-b border-line bg-surface px-2 sm:px-3">
      {/* Sidebar toggle */}
      <NavIconBtn
        aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
        onClick={onToggleSidebar}
      >
        <PanelLeft className="size-4" />
      </NavIconBtn>

      {/* Logo */}
      <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg px-1 focus-visible:outline-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg">
          B
        </span>
        <span className="hidden text-base font-semibold text-ink sm:inline">BridgeOne</span>
      </Link>

      {/* Search bar */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="mx-2 flex h-8 flex-1 max-w-xs items-center gap-2 rounded-lg border border-line bg-canvas px-3 text-sm text-ink-faint hover:bg-control focus-visible:outline-2 sm:max-w-sm"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <span className="hidden sm:inline-flex"><Kbd>Ctrl K</Kbd></span>
      </button>

      <div className="ml-auto flex items-center gap-0.5">
        {/* Notification */}
        <div className="relative">
          <NavIconBtn aria-label="Notifications" onClick={() => setNotifOpen((v) => !v)}>
            <Bell className="size-4" />
            <span className="absolute top-1 right-1 size-1.5 rounded-full bg-danger" />
          </NavIconBtn>
          {notifOpen && (
            <Popover onClose={() => setNotifOpen(false)} className="right-0 w-72">
              <p className="px-4 py-3 text-sm font-semibold text-ink border-b border-line">Notifications</p>
              <p className="px-4 py-6 text-center text-sm text-ink-faint">No new notifications.</p>
            </Popover>
          )}
        </div>

        {/* Report Issue */}
        <NavIconBtn aria-label="Report issue" onClick={() => alert("Report issue — coming soon.")}>
          <Flag className="size-4" />
        </NavIconBtn>

        {/* Voice command */}
        <NavIconBtn aria-label="Voice command" onClick={() => alert("Voice command — coming soon.")}>
          <Mic className="size-4" />
        </NavIconBtn>

        {/* QR Code */}
        <div className="relative">
          <NavIconBtn aria-label="QR code" onClick={() => setQrOpen((v) => !v)}>
            <QrCode className="size-4" />
          </NavIconBtn>
          {qrOpen && (
            <Popover onClose={() => setQrOpen(false)} className="right-0 w-56">
              <p className="px-4 py-3 text-sm font-semibold text-ink border-b border-line">QR Code</p>
              <div className="flex flex-col items-center gap-2 px-4 py-4">
                <div className="size-24 rounded-lg bg-control flex items-center justify-center text-ink-faint text-xs">
                  QR coming soon
                </div>
              </div>
            </Popover>
          )}
        </div>

        {/* Favourites */}
        <div className="relative">
          <NavIconBtn aria-label="Favourites" onClick={() => setFavOpen((v) => !v)}>
            <Heart className="size-4" />
          </NavIconBtn>
          {favOpen && (
            <Popover onClose={() => setFavOpen(false)} className="right-0 w-64">
              <p className="px-4 py-3 text-sm font-semibold text-ink border-b border-line">Favourites</p>
              <p className="px-4 py-6 text-center text-sm text-ink-faint">No favourites yet.</p>
            </Popover>
          )}
        </div>

        {/* Theme toggle */}
        <NavIconBtn
          aria-label="Toggle theme"
          onClick={() => applyTheme(readTheme() === "dark" ? "light" : "dark")}
        >
          <Moon className="size-4 dark:hidden" />
          <Sun className="size-4 hidden dark:block" />
        </NavIconBtn>

        <div className="mx-1 h-5 w-px bg-line" />

        {/* Business unit switcher */}
        <BusinessUnitSwitcher />

        <div className="mx-1 h-5 w-px bg-line" />

        {/* Profile */}
        <div className="relative">
          <button
            type="button"
            aria-label="Profile menu"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm hover:bg-control focus-visible:outline-2"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg">
              {user?.initials ?? "?"}
            </span>
            <span className="hidden max-w-24 truncate text-sm text-ink sm:inline">{user?.name ?? "Guest"}</span>
            <ChevronDown className="size-3 text-ink-faint" />
          </button>

          {profileOpen && (
            <Popover onClose={() => setProfileOpen(false)} className="right-0 w-64">
              {/* User info */}
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg">
                  {user?.initials ?? "?"}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-ink">{user?.name ?? "Guest"}</span>
                  <span className="truncate text-xs text-ink-faint">{user?.role ?? ""}</span>
                  <span className="truncate text-xs text-ink-faint">{user?.phone ?? ""}</span>
                </div>
              </div>

              {/* Menu items */}
              <div className="p-1">
                <ProfileMenuItem icon={<User />} label="My Profile" onClick={() => { setProfileOpen(false); alert("Profile — coming soon."); }} />
                <ProfileMenuItem icon={<Settings />} label="Settings" onClick={() => { setProfileOpen(false); alert("Settings — coming soon."); }} />
                <ProfileMenuItem icon={<Keyboard />} label="Keyboard Shortcuts" onClick={() => { setProfileOpen(false); }} />
                <ProfileMenuItem
                  icon={readTheme() === "dark" ? <Sun /> : <Moon />}
                  label={readTheme() === "dark" ? "Light Mode" : "Dark Mode"}
                  onClick={() => { applyTheme(readTheme() === "dark" ? "light" : "dark"); setProfileOpen(false); }}
                />
                <div className="my-1 h-px bg-line" />
                <ProfileMenuItem icon={<LogOut />} label="Sign Out" danger onClick={() => { setProfileOpen(false); handleLogout(); }} />
              </div>
            </Popover>
          )}
        </div>
      </div>
    </header>
  );
}

function BusinessUnitSwitcher() {
  const [open, setOpen] = useState(false);
  // TODO: wire to real business units from context
  const units = [{ id: "1", name: "Mariners Group" }];
  const [selected, setSelected] = useState(units[0]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-control focus-visible:outline-2"
      >
        <Building2 className="size-4 text-ink-faint" />
        <span className="hidden max-w-28 truncate text-sm text-ink sm:inline">{selected.name}</span>
        <ChevronDown className="size-3 text-ink-faint" />
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)} className="right-0 w-56">
          <p className="px-3 py-2 text-xs font-medium text-ink-faint uppercase border-b border-line">Business Unit</p>
          <div className="p-1">
            {units.map((unit) => (
              <button
                key={unit.id}
                type="button"
                onClick={() => { setSelected(unit); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-ink hover:bg-control",
                  unit.id === selected.id && "bg-control font-medium",
                )}
              >
                <Building2 className="size-4 text-ink-faint" />
                {unit.name}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}

function NavIconBtn({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex size-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-control hover:text-ink focus-visible:outline-2",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Popover({ children, onClose, className }: { children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn("absolute top-full z-50 mt-1 rounded-lg border border-line bg-surface shadow-dropdown", className)}
    >
      {children}
    </div>
  );
}

function ProfileMenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-control [&_svg]:size-4 [&_svg]:text-ink-faint",
        danger ? "text-danger" : "text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
