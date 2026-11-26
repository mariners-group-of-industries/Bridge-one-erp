"use client";

import { Check, Paperclip, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { Notice } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { ApprovalStage, LeaveDetail, MovementDetail } from "../schemas/leave-movement.schema";
import { leaveMovementApi, type ApplicationKind } from "../services/leave-movement.api";
import { ApplicationStatusBadge, formatDate } from "./shared";

const STAGE_LABEL: Record<string, string> = { PENDING: "Waiting", APPROVED: "Approved", REJECTED: "Rejected", SKIPPED: "Skipped" };

type Detail = ({ kind: "leaves" } & LeaveDetail) | ({ kind: "movements" } & MovementDetail);

/** Which application the address names: `?leave=<id>` or `?movement=<id>` (an approver's notification). */
export function useLinkedApplication(): { kind: ApplicationKind; id: string } | null {
  const params = useSearchParams();
  const leave = params.get("leave");
  if (leave) return { kind: "leaves", id: leave };
  const movement = params.get("movement");
  return movement ? { kind: "movements", id: movement } : null;
}

async function loadDetail(kind: ApplicationKind, id: string): Promise<Detail> {
  return kind === "leaves" ? { kind, ...(await leaveMovementApi.leave(id)) } : { kind, ...(await leaveMovementApi.movement(id)) };
}

/**
 * The leave or movement application named in the address: its details,
 * attachments and approval stages, with Approve / Reject for whoever may decide
 * it. Closing removes the parameter from the address.
 */
export function ApplicationDialog({ onDecided }: { onDecided: (kind: ApplicationKind) => void }) {
  const linked = useLinkedApplication();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const kind = linked?.kind ?? "leaves";
  const id = linked?.id ?? "";
  const detail = useResource<Detail>(linked ? `application-detail:${kind}:${id}` : null, () => loadDetail(kind, id));
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [failure, setFailure] = useState("");
  const noun = kind === "movements" ? "Movement" : "Leave";

  const close = () => {
    setConfirmReject(false);
    setFailure("");
    router.replace(pathname, { scroll: false });
  };

  async function decide(action: "approve" | "reject") {
    if (!linked) return;
    setBusy(action);
    setFailure("");
    try {
      await leaveMovementApi.decide(kind, id, action);
      toast.success(`${noun} ${action === "approve" ? "approved" : "rejected"}.`);
      onDecided(kind);
      close();
    } catch (error) {
      setFailure(errorMessage(error));
      detail.reload();
    } finally {
      setBusy(null);
    }
  }

  const application = detail.data && detail.data.kind === kind && detail.data.id === id ? detail.data : undefined;
  const canDecide = !!application?.canDecide;

  return (
    <Dialog
      open={linked !== null}
      size="lg"
      title={`${noun} Application`}
      description={application ? `${application.employeeCode} — ${application.employeeName}` : undefined}
      onClose={close}
      footer={
        <>
          <Button onClick={close} disabled={busy !== null}>
            Close
          </Button>
          {canDecide &&
            (confirmReject ? (
              <>
                <Button onClick={() => setConfirmReject(false)} disabled={busy !== null}>
                  Keep
                </Button>
                <Button variant="danger" loading={busy === "reject"} onClick={() => void decide("reject")}>
                  <X aria-hidden="true" className="size-3.5" /> Confirm reject
                </Button>
              </>
            ) : (
              <>
                <Button variant="danger" disabled={busy !== null} onClick={() => setConfirmReject(true)}>
                  <X aria-hidden="true" className="size-3.5" /> Reject
                </Button>
                <Button variant="accent" loading={busy === "approve"} disabled={busy !== null} onClick={() => void decide("approve")}>
                  <Check aria-hidden="true" className="size-3.5" /> Approve
                </Button>
              </>
            ))}
        </>
      }
    >
      {detail.error ? (
        <ErrorState message={detail.error.message} onRetry={detail.reload} />
      ) : !application ? (
        <LoadingState label="Loading application…" />
      ) : (
        <Details application={application} failure={failure} />
      )}
    </Dialog>
  );
}

function Details({ application: a, failure }: { application: Detail; failure: string }) {
  const facts: [string, ReactNode][] =
    a.kind === "leaves"
      ? [
          ["Leave Type", a.leaveType],
          ["Days", a.days],
          ["From Date", formatDate(a.fromDate)],
          ["To Date", formatDate(a.toDate)],
          ["Location", a.location || "—"],
        ]
      : [
          ["Movement Type", a.movementType],
          ["Location", a.location || "—"],
          ["From Date", formatDate(a.fromDate)],
          ["To Date", formatDate(a.toDate)],
          ["Start Time", a.startTime],
          ["End Time", a.endTime],
        ];
  facts.push(["Applied On", formatDateTime(a.appliedAt)], ["Status", <ApplicationStatusBadge key="status" status={a.status} />]);
  if (a.decidedByName) facts.push([a.status === "Rejected" ? "Rejected By" : "Decided By", `${a.decidedByName}${a.decidedAt ? `, ${formatDateTime(a.decidedAt)}` : ""}`]);

  return (
    <div className="flex flex-col gap-4">
      {failure && <Notice tone="error">{failure}</Notice>}
      {a.status === "Pending" && !a.canDecide && <p className="text-xs text-ink-muted">You can view this application but not approve or reject it.</p>}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-ink-faint">{label}</dt>
            <dd className="text-ink tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="flex min-w-0 flex-col gap-0.5 sm:col-span-2">
          <dt className="text-xs text-ink-faint">Reason</dt>
          <dd className="whitespace-pre-wrap break-words text-ink">{a.reason}</dd>
        </div>
        {a.kind === "leaves" && a.attachments.length > 0 && (
          <div className="flex min-w-0 flex-col gap-0.5 sm:col-span-2">
            <dt className="text-xs text-ink-faint">Attachments</dt>
            <dd>
              <ul className="flex flex-col gap-1">
                {a.attachments.map((file) => (
                  <li key={file.id}>
                    <a
                      href={leaveMovementApi.attachmentUrl(a.id, file.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-6 items-center gap-1 text-accent-strong hover:underline dark:text-accent"
                    >
                      <Paperclip aria-hidden="true" className="size-3.5" />
                      <span className="max-w-72 truncate">{file.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      <Stages stages={a.stages} />
    </div>
  );
}

function Stages({ stages }: { stages: ApprovalStage[] }) {
  if (stages.length === 0) return null;
  return (
    <section aria-label="Approval stages">
      <h3 className="mb-1.5 text-xs font-semibold text-ink-muted">Approval stages</h3>
      <ol className="flex flex-col divide-y divide-line rounded border border-line text-sm">
        {stages.map((s) => (
          <li key={s.stageNo} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2">
            <span className="text-ink">
              {s.stageNo}. {s.name}
              {s.approverNames.length > 0 && <span className="block text-xs text-ink-faint">{s.approverNames.join(", ")}</span>}
            </span>
            <span className="text-xs text-ink-muted">
              {STAGE_LABEL[s.status] ?? s.status}
              {s.actedBy && ` · ${s.actedBy}`}
              {s.actedAt && `, ${formatDateTime(s.actedAt)}`}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
