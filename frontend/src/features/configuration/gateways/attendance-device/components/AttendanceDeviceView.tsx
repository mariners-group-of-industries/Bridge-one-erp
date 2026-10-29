"use client";

import { Fingerprint, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { Checkbox, EmptyBlock, Field, FormGrid, Input, Notice, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import { gatewaysPaths } from "../../paths";
import { deviceInputSchema, type DeviceInput, type DeviceRow } from "../schemas/attendance-device.schema";
import { attendanceDeviceApi } from "../services/attendance-device.api";

const BREADCRUMBS = entityMasterDataBreadcrumbs(gatewaysPaths.attendanceDevices);
const HEADERS = ["SL", "Action", "Device", "IP Address : Port", "Office", "Status", "Last Sync", "Punches", "Unmatched"];
const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "Never";
/** The agent syncs every few minutes; older than this means it has stopped. */
const STALE_MS = 30 * 60_000;

function syncStatus(row: DeviceRow): { label: string; tone: string } {
  if (!row.isActive) return { label: "Inactive", tone: "border-line bg-control text-ink-faint" };
  if (row.lastError) return { label: "Error", tone: "border-danger/40 bg-danger/10 text-danger" };
  if (!row.lastSyncAt) return { label: "Waiting for agent", tone: "border-warning/40 bg-warning/10 text-warning" };
  if (Date.now() - Date.parse(row.lastSyncAt) > STALE_MS) return { label: "Not syncing", tone: "border-warning/40 bg-warning/10 text-warning" };
  return { label: "Syncing", tone: "border-success/40 bg-success/10 text-success" };
}

export function AttendanceDeviceView() {
  const toast = useToast();
  const devices = useResource("attendance-devices", attendanceDeviceApi.list);
  const [editing, setEditing] = useState<DeviceRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<DeviceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const origin = typeof window === "undefined" ? "https://your-erp-domain" : window.location.origin;

  return (
    <PageContainer full>
      <PageHead
        title="Attendance Devices"
        subtitle="Biometric terminals on your office network. The attendance agent reads them and their punches appear in HRM › Attendance."
        breadcrumbs={BREADCRUMBS}
        actions={
          <Button variant="accent" onClick={() => setEditing("new")}>
            <Plus /> Add Device
          </Button>
        }
      />

      <section aria-label="Devices" className="rounded border border-line bg-surface shadow-xs">
        {devices.error ? (
          <ErrorState message={devices.error.message} onRetry={devices.reload} />
        ) : !devices.data ? (
          <LoadingState label="Loading devices…" />
        ) : devices.data.length === 0 ? (
          <div className="p-5">
            <EmptyBlock icon={<Fingerprint />} title="No attendance devices yet">
              <Button variant="accent" size="sm" className="mt-3" onClick={() => setEditing("new")}>
                <Plus /> Add Device
              </Button>
            </EmptyBlock>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-grid w-full min-w-max">
              <thead>
                <tr>
                  {HEADERS.map((h) => (
                    <th key={h} scope="col" className="px-2.5 py-2 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.data.map((row, index) => {
                  const status = syncStatus(row);
                  return (
                    <tr key={row.id}>
                      <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{index + 1}</td>
                      <td className="w-24 px-1.5 py-1">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="hover:text-accent-strong" aria-label={`Edit ${row.name}`} title="Edit" onClick={() => setEditing(row)}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Delete ${row.name}`} title="Delete" onClick={() => setDeleting(row)}>
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <span className="font-medium text-ink">{row.name}</span>
                        {row.serialNumber && <span className="block text-xs text-ink-faint">SN {row.serialNumber}</span>}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-xs whitespace-nowrap">
                        {row.ipAddress}:{row.port}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{row.officeName ?? <span className="text-ink-faint">—</span>}</td>
                      <td className="px-2.5 py-2" title={row.lastError ?? undefined}>
                        <span className={cn("inline-flex rounded border px-1.5 text-xs font-medium whitespace-nowrap", status.tone)}>{status.label}</span>
                        {row.lastError && <span className="block max-w-56 truncate text-xs text-danger">{row.lastError}</span>}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">
                        {dateTime(row.lastSyncAt)}
                        {row.lastSyncCount !== null && row.lastSyncAt && <span className="block text-xs text-ink-faint">{row.lastSyncCount} new</span>}
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{row.punchCount.toLocaleString()}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums" title="Punches whose device user number matches no employee's Attendance ID">
                        <span className={row.unmatchedCount ? "font-semibold text-warning" : "text-ink-faint"}>{row.unmatchedCount.toLocaleString()}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Agent setup" className="rounded border border-line bg-surface p-4 shadow-xs">
        <h2 className="text-sm font-semibold text-ink">Connect a device (attendance agent)</h2>
        <p className="mt-1 text-xs text-ink-faint">
          The agent runs on any always-on PC in the same office network as the device. It reads new punches over the LAN every few minutes and uploads them here. The device keeps sending to
          its cloud server (e.g. iBOS) as before.
        </p>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm text-ink">
          <li>Add the device above with its IP address (Device › Comm. › Ethernet) and TCP port (normally 4370). Choose its office so punches are matched to that business unit.</li>
          <li>
            In each employee&apos;s profile, set <strong>Attendance ID</strong> to their user number on the device. Unmatched punches are kept and linked automatically once the ID is set.
          </li>
          <li>
            Generate a <strong>Read &amp; write</strong> token in{" "}
            <Link href={gatewaysPaths.apiConfiguration} className="inline-flex items-center gap-1 font-medium text-accent-strong hover:underline dark:text-accent">
              <KeyRound className="size-3.5" aria-hidden="true" /> API Configuration
            </Link>
            .
          </li>
          <li>
            On the office PC (Node.js 20.12+), copy the <code className="rounded bg-control px-1 text-xs">tools/zk-attendance-agent</code> folder from the repository, create a{" "}
            <code className="rounded bg-control px-1 text-xs">.env</code> file in it with these two lines, then run <code className="rounded bg-control px-1 text-xs">npm install</code> and{" "}
            <code className="rounded bg-control px-1 text-xs">npm start</code>:
            <pre className="mt-1.5 overflow-x-auto rounded border border-line bg-canvas px-3 py-2 text-xs text-ink">
              <code>{`ERP_URL=${origin}
ERP_TOKEN=<your token>`}</code>
            </pre>
          </li>
          <li>The device&apos;s status above changes to “Syncing”, and punches appear in HRM › Attendance › Daily.</li>
        </ol>
      </section>

      <DeviceDialog value={editing} onClose={() => setEditing(null)} onSaved={devices.reload} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete device?"
        message={deleting ? (deleting.punchCount ? `"${deleting.name}" has attendance punches, so it cannot be deleted. Edit it and untick Active instead.` : `Delete "${deleting.name}"?`) : ""}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await attendanceDeviceApi.remove(deleting.id);
            toast.success(`"${deleting.name}" deleted.`);
            setDeleting(null);
            devices.reload();
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </PageContainer>
  );
}

const EMPTY: DeviceInput = { name: "", ipAddress: "", port: 4370, serialNumber: "", officeId: "", isActive: true };

function DeviceDialog({ value, onClose, onSaved }: { value: DeviceRow | "new" | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const options = useResource(value ? "attendance-device-options" : null, attendanceDeviceApi.options);
  const [form, setForm] = useState<DeviceInput>(EMPTY);
  const [seen, setSeen] = useState<typeof value>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (value !== seen) {
    setSeen(value);
    setErrors({});
    setFormError(null);
    setForm(value && value !== "new" ? { name: value.name, ipAddress: value.ipAddress, port: value.port, serialNumber: value.serialNumber, officeId: value.officeId, isActive: value.isActive } : EMPTY);
  }

  const save = async () => {
    const parsed = deviceInputSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (value === "new") await attendanceDeviceApi.create(form);
      else if (value) await attendanceDeviceApi.update(value.id, form);
      toast.success(`Device "${form.name.trim()}" saved.`);
      onSaved();
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={value !== null}
      title={value === "new" ? "Add Device" : "Edit Device"}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button type="submit" variant="accent" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {formError && <Notice tone="error">{formError}</Notice>}
        <FormGrid cols={2}>
          <Field label="Device Name" required error={errors.name} span={2}>
            {(id) => <Input id={id} autoFocus value={form.name} maxLength={100} placeholder="e.g. Head Office Gate" onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          </Field>
          <Field label="IP Address" required error={errors.ipAddress}>
            {(id) => <Input id={id} value={form.ipAddress} maxLength={64} placeholder="192.168.0.119" className="font-mono" onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} />}
          </Field>
          <Field label="TCP Port" required error={errors.port}>
            {(id) => <Input id={id} inputMode="numeric" value={String(form.port ?? "")} className="font-mono" onChange={(e) => /^\d{0,5}$/.test(e.target.value) && setForm({ ...form, port: e.target.value === "" ? ("" as never) : Number(e.target.value) })} />}
          </Field>
          <Field label="Office" error={errors.officeId} hint="Punches are matched to employees of this office's business unit.">
            {(id) => (
              <Select id={id} value={form.officeId ?? ""} placeholder="Any office" options={(options.data?.offices ?? []).map((o) => ({ value: o.id, label: o.name }))} onChange={(e) => setForm({ ...form, officeId: e.target.value })} />
            )}
          </Field>
          <Field label="Serial Number" error={errors.serialNumber} hint="Optional, for your reference.">
            {(id) => <Input id={id} value={form.serialNumber ?? ""} maxLength={60} className="font-mono" onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />}
          </Field>
        </FormGrid>
        <Checkbox label="Active (the agent reads this device)" checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
      </div>
    </Dialog>
  );
}

