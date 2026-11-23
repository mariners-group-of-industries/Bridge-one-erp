"use client";

import { AlertTriangle, CheckCircle2, MessageSquare, RefreshCw, RotateCcw, Send, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { Checkbox, Field, FormGrid, Input, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import { gatewaysPaths } from "../../paths";
import { DEFAULT_ATTENDANCE_MESSAGE_TEMPLATE, type NotificationSettingInput } from "../schemas/attendance-notification.schema";
import { attendanceNotificationsApi, type NotificationOutboxRow } from "../services/attendance-notifications.api";

const BREADCRUMBS = entityMasterDataBreadcrumbs(gatewaysPaths.attendanceNotifications);

const statusBadge = (status: string) => {
  if (status === "SENT") return "bg-success/10 text-success border-success/30";
  if (status === "FAILED") return "bg-danger/10 text-danger border-danger/30";
  return "bg-warning/10 text-warning border-warning/30";
};

const formatStamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

export function AttendanceNotificationsView() {
  const toast = useToast();
  const res = useResource("attendance-notifications", attendanceNotificationsApi.dashboard);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<NotificationSettingInput>>({});

  const server = res.data?.settings;
  const form: NotificationSettingInput = {
    enabled: draft.enabled ?? server?.enabled ?? false,
    notifyCheckIn: draft.notifyCheckIn ?? server?.notifyCheckIn ?? true,
    notifyLate: draft.notifyLate ?? server?.notifyLate ?? true,
    notifyCheckOut: draft.notifyCheckOut ?? server?.notifyCheckOut ?? false,
    whatsappGroupId: draft.whatsappGroupId !== undefined ? draft.whatsappGroupId : (server?.whatsappGroupId ?? ""),
    whatsappGroupName: draft.whatsappGroupName !== undefined ? draft.whatsappGroupName : (server?.whatsappGroupName ?? ""),
    departmentFilter: draft.departmentFilter !== undefined ? draft.departmentFilter : (server?.departmentFilter ?? ""),
    messageTemplate: draft.messageTemplate ?? server?.messageTemplate ?? DEFAULT_ATTENDANCE_MESSAGE_TEMPLATE,
  };

  const patch = (next: Partial<NotificationSettingInput>) => setDraft((prev) => ({ ...prev, ...next }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await attendanceNotificationsApi.saveSettings({
        enabled: form.enabled,
        notifyCheckIn: form.notifyCheckIn,
        notifyLate: form.notifyLate,
        notifyCheckOut: form.notifyCheckOut,
        whatsappGroupId: (form.whatsappGroupId || "").trim() || null,
        whatsappGroupName: (form.whatsappGroupName || "").trim() || null,
        departmentFilter: (form.departmentFilter || "").trim() || null,
        messageTemplate: form.messageTemplate,
      });
      setDraft({});
      toast.success("Attendance notification settings saved.");
      res.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await attendanceNotificationsApi.sendTest({ groupId: (form.whatsappGroupId || "").trim() || null });
      toast.success("Test notification sent to the WhatsApp group.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const { sent } = await attendanceNotificationsApi.processQueue();
      toast.success(sent > 0 ? `Processed queue: ${sent} message(s) sent.` : "No pending messages were ready to send.");
      res.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleRetry = async (row: NotificationOutboxRow) => {
    setRetryingId(row.id);
    try {
      const updated = await attendanceNotificationsApi.retryItem(row.id);
      if (updated.status === "SENT") {
        toast.success(`Message for ${row.employeeName} sent.`);
      } else {
        toast.error(updated.lastError || "Retry failed.");
      }
      res.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <PageContainer full>
      <PageHead
        breadcrumbs={BREADCRUMBS}
        title="Attendance Notifications"
        subtitle="Automatically send employee check-in and late alerts to an existing WhatsApp group."
        actions={
          <>
            <Button variant="secondary" onClick={res.reload} loading={res.loading && !!res.data}>
              {!(res.loading && res.data) && <RefreshCw aria-hidden="true" />}
              Refresh
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving} disabled={!res.data}>
              Save Settings
            </Button>
          </>
        }
      />

      {res.error && !res.data ? (
        <Card>
          <ErrorState message={errorMessage(res.error)} onRetry={res.reload} />
        </Card>
      ) : !res.data ? (
        <Card>
          <LoadingState label="Loading attendance notification settings…" />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-ink">
            <strong>Unofficial Linked-Device Gateway:</strong> WhatsApp Web automation (`whatsapp-web.js`) is not an official Meta group API. Use a dedicated notification phone number and keep ERP attendance logs as your source of record.
          </div>

          {/* Gateway & Summary Strip */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Card className="flex items-center gap-3 p-4">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  res.data.gateway.connected ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                )}
              >
                {res.data.gateway.connected ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
              </span>
              <div className="min-w-0">
                <div className="text-xs text-ink-muted">WhatsApp Gateway</div>
                <div className="truncate text-sm font-semibold text-ink">
                  {!res.data.gateway.configured
                    ? "Not configured"
                    : res.data.gateway.connected
                      ? `Connected (${res.data.gateway.phone || "Linked"})`
                      : res.data.gateway.qrPending
                        ? "QR scan required"
                        : "Offline"}
                </div>
                {res.data.gateway.error && <div className="truncate text-[11px] text-danger">{res.data.gateway.error}</div>}
              </div>
            </Card>

            <Card className="flex items-center gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
                <CheckCircle2 className="size-4" />
              </span>
              <div>
                <div className="text-xs text-ink-muted">Sent</div>
                <div className="text-lg font-bold text-ink tabular-nums">{res.data.summary.sent}</div>
              </div>
            </Card>

            <Card className="flex items-center gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
                <MessageSquare className="size-4" />
              </span>
              <div>
                <div className="text-xs text-ink-muted">Pending</div>
                <div className="text-lg font-bold text-ink tabular-nums">{res.data.summary.pending}</div>
              </div>
            </Card>

            <Card className="flex items-center gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-danger/10 text-danger">
                <AlertTriangle className="size-4" />
              </span>
              <div>
                <div className="text-xs text-ink-muted">Failed</div>
                <div className="text-lg font-bold text-ink tabular-nums">{res.data.summary.failed}</div>
              </div>
            </Card>
          </div>

          {/* Settings Card */}
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Notification Configuration</h2>
                <p className="text-xs text-ink-muted">Triggered automatically when ZKTeco punches are saved to the ERP.</p>
              </div>
              <Button variant="secondary" onClick={handleTest} loading={testing} disabled={!(form.whatsappGroupId || "").trim()}>
                {!testing && <Send aria-hidden="true" />}
                Send Test Message
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-6">
                <Checkbox label="Enable automatic WhatsApp notifications" checked={form.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
                <Checkbox label="Notify on Present Check-In" checked={form.notifyCheckIn} onChange={(e) => patch({ notifyCheckIn: e.target.checked })} />
                <Checkbox label="Notify on Late Attendance" checked={form.notifyLate} onChange={(e) => patch({ notifyLate: e.target.checked })} />
                <Checkbox label="Notify on Check-Out" checked={form.notifyCheckOut} onChange={(e) => patch({ notifyCheckOut: e.target.checked })} />
              </div>

              <FormGrid>
                {res.data.groups.length > 0 && (
                  <Field label="Select Linked WhatsApp Group">
                    <Select
                      value={form.whatsappGroupId || ""}
                      placeholder="-- Choose a group --"
                      options={res.data.groups.map((g) => ({ value: g.id, label: `${g.name} (${g.id})` }))}
                      onChange={(e) => {
                        const id = e.target.value;
                        const found = res.data?.groups.find((g) => g.id === id);
                        patch({ whatsappGroupId: id, ...(found ? { whatsappGroupName: found.name } : {}) });
                      }}
                    />
                  </Field>
                )}

                <Field label="WhatsApp Group ID (@g.us)" required>
                  <Input
                    value={form.whatsappGroupId || ""}
                    onChange={(e) => patch({ whatsappGroupId: e.target.value })}
                    placeholder="1203630xxxxxxxxx@g.us"
                  />
                </Field>

                <Field label="Department Filter (optional, comma-separated)">
                  <Input
                    value={form.departmentFilter || ""}
                    onChange={(e) => patch({ departmentFilter: e.target.value })}
                    placeholder="Leave empty for all departments"
                  />
                </Field>
              </FormGrid>

              <Field label="Message Template">
                <textarea
                  rows={5}
                  value={form.messageTemplate}
                  onChange={(e) => patch({ messageTemplate: e.target.value })}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs text-ink focus:border-accent-line focus:outline-none"
                />
                <span className="mt-1 block text-[11px] text-ink-faint">
                  Variables: {"{employee_name}"}, {"{employee_id}"}, {"{designation}"}, {"{department}"}, {"{date}"}, {"{time}"}, {"{status}"}
                </span>
              </Field>
            </div>
          </Card>

          {/* Delivery Logs */}
          <Card>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Delivery Logs & Outbox</h2>
                <p className="text-xs text-ink-muted">Recent 50 notification attempts (deduplicated per employee per day).</p>
              </div>
              <Button variant="secondary" onClick={handleProcess} loading={processing}>
                Process Pending Queue
              </Button>
            </header>

            {res.data.logs.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-ink-muted">No attendance notifications queued yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-[11px] font-semibold text-ink-faint uppercase">
                      <th className="px-4 py-2.5">Employee</th>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">ERP Status</th>
                      <th className="px-4 py-2.5">Delivery</th>
                      <th className="px-4 py-2.5">Attempts</th>
                      <th className="px-4 py-2.5">Sent / Error</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {res.data.logs.map((row) => (
                      <tr key={row.id} className="hover:bg-canvas/60">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-ink">{row.employeeName}</div>
                          <div className="text-[11px] text-ink-faint">
                            {row.employeeCode} · {row.designation || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-ink-muted">{row.attendanceDate}</td>
                        <td className="px-4 py-2.5 font-medium text-ink">{row.attendanceStatus}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold", statusBadge(row.status))}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-ink-muted">{row.attempts}</td>
                        <td className="max-w-xs truncate px-4 py-2.5 text-ink-muted" title={row.lastError || row.sentAt || ""}>
                          {row.status === "SENT" ? formatStamp(row.sentAt) : row.lastError || "Queued"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {row.status !== "SENT" && (
                            <Button
                              variant="secondary"
                              onClick={() => handleRetry(row)}
                              loading={retryingId === row.id}
                            >
                              {retryingId !== row.id && <RotateCcw aria-hidden="true" />}
                              Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
