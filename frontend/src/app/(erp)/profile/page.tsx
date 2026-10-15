"use client";

import { useEffect, useState } from "react";
import { User, Lock, Phone, BadgeCheck, Calendar, ShieldCheck } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface Profile {
  id: string;
  name: string;
  phone: string;
  role: string;
  isMaster: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  initials: string;
}

const inputCls = "h-9 w-full rounded border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-accent disabled:opacity-50";

export default function ProfilePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setName(data.name);
        setPhone(data.phone);
      });
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile((p) => (p ? { ...p, ...data } : p));
      toast({ title: "Profile updated successfully.", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to update profile.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "New passwords do not match.", variant: "error" });
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed successfully.", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to change password.", variant: "error" });
    } finally {
      setChangingPw(false);
    }
  }

  if (!profile) return null;

  return (
    <>
      <PageHead title="My Profile" subtitle="View and update your account information." />
      <PageContainer>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">

          {/* Avatar card */}
          <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface p-6 shadow-xs">
            <span className="flex size-20 items-center justify-center rounded-full bg-accent-strong text-2xl font-bold text-white">
              {profile.initials}
            </span>
            <div className="text-center">
              <p className="text-base font-semibold text-ink">{profile.name}</p>
              <p className="text-sm text-ink-faint">{profile.phone}</p>
            </div>
            <div className="w-full space-y-2.5 border-t border-line pt-4 text-sm">
              <InfoRow icon={<BadgeCheck />} label="Role" value={profile.role} />
              {profile.isMaster && <InfoRow icon={<ShieldCheck />} label="Access" value="Master Account" />}
              <InfoRow icon={<Calendar />} label="Member since" value={new Date(profile.createdAt).toLocaleDateString()} />
              {profile.lastLoginAt && (
                <InfoRow icon={<Calendar />} label="Last login" value={new Date(profile.lastLoginAt).toLocaleString()} />
              )}
            </div>
          </div>

          {/* Edit forms */}
          <div className="flex flex-col gap-6 lg:col-span-2">

            {/* Personal info */}
            <div className="rounded-xl border border-line bg-surface p-6 shadow-xs">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                <User className="size-4 text-accent" /> Personal Information
              </h2>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full Name">
                    <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="Your full name" />
                  </Field>
                  <Field label="Phone Number">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} required className={`${inputCls} pl-9`} placeholder="Phone number" />
                    </div>
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="accent" loading={saving}>Save Changes</Button>
                </div>
              </form>
            </div>

            {/* Change password */}
            <div className="rounded-xl border border-line bg-surface p-6 shadow-xs">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                <Lock className="size-4 text-accent" /> Change Password
              </h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <Field label="Current Password">
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className={inputCls} placeholder="Enter current password" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="New Password">
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className={inputCls} placeholder="Min. 8 characters" />
                  </Field>
                  <Field label="Confirm New Password">
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputCls} placeholder="Repeat new password" />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="accent" loading={changingPw}>Update Password</Button>
                </div>
              </form>
            </div>

          </div>
        </div>
      </PageContainer>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-ink-faint">
      {icon}
      <span className="text-ink-faint">{label}</span>
      <span className="ml-auto font-medium text-ink">{value}</span>
    </div>
  );
}
