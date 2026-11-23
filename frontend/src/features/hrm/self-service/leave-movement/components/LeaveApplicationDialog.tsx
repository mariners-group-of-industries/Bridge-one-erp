"use client";

import { Check, Paperclip, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { Notice } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { LeaveDetail } from "../schemas/leave-movement.schema";
import { leaveMovementApi } from "../services/leave-movement.api";
import { ApplicationStatusBadge, formatDate } from "./shared";

const STAGE_LABEL: Record<string, string> = { PENDING: "Waiting", APPROVED: "Approved", REJECTED: "Rejected", SKIPPED: "Skipped" };

/**
 * The leave application named by `?leave=<id>` (the link in an approver's
 * notification): its details, attachments and approval stages, with Approve /
 * Reject for whoever may decide it. Closing removes `?leave` from the address.
 */
export function LeaveApplicationDialog({ onDecided }: { onDecided: () => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const id = params.get("leave");
  const detail = useResource(id ? `leave-detail:${id}` : null, () => leaveMovementApi.leave(id as string));
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [failure, setFailure] = useState("");

  const close = () => {
    setConfirmReject(false);
    setFailure("");
    router.replace(pathname, { scroll: false });
  };

  async function decide(action: "approve" | "reject") {
    if (!id) return;
    setBusy(action);
    setFailure("");
    try {
      await leaveMovementApi.decide("leaves", id, action);
      toast.success(action === "approve" ? "Leave approved." : "Leave rejected.");
      onDecided();
      close();
    } catch (error) {
      setFailure(errorMessage(error));
      detail.reload();
    } finally {
      setBusy(null);
    }
  }

  const leave = detail.data;
  const canDecide = !!leave?.canDecide;

  return (
    <Dialog
      open={id !== null}
      size="lg"
      title="Leave Application"
      description={leave ? `${leave.employeeCode} — ${leave.employeeName}` : undefined}
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
      ) : !leave ? (
        <LoadingState label="Loading application…" />
      ) : (
        <LeaveDetails leave={leave} failure={failure} />
      )}
    </Dialog>
  );
}

function LeaveDetails({ leave, failure }: { leave: LeaveDetail; failure: string }) {
  const facts: [string, React.ReactNode][] = [
    ["Leave Type", leave.leaveType],
    ["Days", leave.days],
    ["From Date", formatDate(leave.fromDate)],
    ["To Date", formatDate(leave.toDate)],
    ["Location", leave.location || "—"],
    ["Applied On", formatDateTime(leave.appliedAt)],
    ["Status", <ApplicationStatusBadge key="status" status={leave.status} />],
  ];
  if (leave.decidedByName) facts.push([leave.status === "Rejected" ? "Rejected By" : "Decided By", `${leave.decidedByName}${leave.decidedAt ? `, ${formatDateTime(leave.decidedAt)}` : ""}`]);

  return (
    <div className="flex flex-col gap-4">
      {failure && <Notice tone="error">{failure}</Notice>}
      {leave.status === "Pending" && !leave.canDecide && <p className="text-xs text-ink-muted">You can view this application but not approve or reject it.</p>}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-ink-faint">{label}</dt>
            <dd className="text-ink tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="flex min-w-0 flex-col gap-0.5 sm:col-span-2">
          <dt className="text-xs text-ink-faint">Reason</dt>
          <dd className="whitespace-pre-wrap break-words text-ink">{leave.reason}</dd>
        </div>
        {leave.attachments.length > 0 && (
          <div className="flex min-w-0 flex-col gap-0.5 sm:col-span-2">
            <dt className="text-xs text-ink-faint">Attachments</dt>
            <dd>
              <ul className="flex flex-col gap-1">
                {leave.attachments.map((file) => (
                  <li key={file.id}>
                    <a
                      href={leaveMovementApi.attachmentUrl(leave.id, file.id)}
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

      {leave.stages.length > 0 && (
        <section aria-label="Approval stages">
          <h3 className="mb-1.5 text-xs font-semibold text-ink-muted">Approval stages</h3>
          <ol className="flex flex-col divide-y divide-line rounded border border-line text-sm">
            {leave.stages.map((s) => (
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
      )}
    </div>
  );
}
