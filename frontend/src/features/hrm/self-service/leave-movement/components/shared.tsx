"use client";

import { Check, Trash2, X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { Input, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { ApplicationStatus, EmployeeOption, LeaveMovementOptions } from "../schemas/leave-movement.schema";
import { leaveMovementApi, type ApplicationKind } from "../services/leave-movement.api";

export const formatDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
/** A timestamp's local calendar day, DD/MM/YYYY. */
export const formatDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB");
const label = (e: EmployeeOption) => `${e.code} — ${e.name}`;

/**
 * Employees apply for themselves (read-only); the master account searches for
 * anyone by code or name.
 */
export function EmployeeField({ id, options, value, onChange }: { id: string; options: LeaveMovementOptions; value: EmployeeOption | null; onChange: (employee: EmployeeOption | null) => void }) {
  const listId = useId();
  const [text, setText] = useState(value ? label(value) : "");
  const [matches, setMatches] = useState<EmployeeOption[]>([]);
  const latest = useRef("");

  if (!options.canManage) return <Input id={id} value={value ? label(value) : "No employee linked to your account"} readOnly disabled />;

  async function search(next: string) {
    setText(next);
    const picked = matches.find((e) => label(e) === next);
    onChange(picked ?? null);
    if (picked) return;
    latest.current = next;
    try {
      const found = await leaveMovementApi.searchEmployees(next.split(" — ")[0]);
      if (latest.current === next) setMatches(found);
    } catch {
      // Keep the previous suggestions; the Apply button reports problems.
    }
  }

  return (
    <>
      <Input
        id={id}
        list={listId}
        value={text}
        placeholder="Search code or name…"
        autoComplete="off"
        onChange={(event) => void search(event.target.value)}
        onFocus={() => matches.length === 0 && void search(text)}
      />
      <datalist id={listId}>
        {matches.map((e) => (
          <option key={e.id} value={label(e)} />
        ))}
      </datalist>
    </>
  );
}

const STATUS_VARIANT = { Pending: "warning", Approved: "success", Rejected: "danger" } as const;

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}

/** Approve / Reject (HR) and Delete (pending only) for one list row. */
export function ApplicationActions({ kind, row, onDone }: { kind: ApplicationKind; row: { id: string; employeeName: string; canDecide: boolean; canDelete: boolean }; onDone: () => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState<"reject" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const noun = kind === "leaves" ? "leave" : "movement";

  async function run(action: "approve" | "reject" | "delete") {
    setBusy(true);
    try {
      if (action === "delete") await leaveMovementApi.remove(kind, row.id);
      else await leaveMovementApi.decide(kind, row.id, action);
      toast.success(action === "delete" ? "Application deleted." : action === "approve" ? "Application approved." : "Application rejected.");
      setConfirm(null);
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!row.canDecide && !row.canDelete) return <span className="text-ink-faint">—</span>;
  return (
    <div className="flex items-center justify-center gap-0.5">
      {row.canDecide && (
        <>
          <Button variant="ghost" size="icon" className="hover:text-success" title="Approve" aria-label={`Approve ${noun} of ${row.employeeName}`} disabled={busy} onClick={() => void run("approve")}>
            <Check />
          </Button>
          <Button variant="ghost" size="icon" className="hover:text-danger" title="Reject" aria-label={`Reject ${noun} of ${row.employeeName}`} disabled={busy} onClick={() => setConfirm("reject")}>
            <X />
          </Button>
        </>
      )}
      {row.canDelete && (
        <Button variant="ghost" size="icon" className="hover:text-danger" title="Delete" aria-label={`Delete ${noun} of ${row.employeeName}`} disabled={busy} onClick={() => setConfirm("delete")}>
          <Trash2 />
        </Button>
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "reject" ? `Reject ${noun} application` : `Delete ${noun} application`}
        message={confirm === "reject" ? `Reject this ${noun} application of ${row.employeeName}?` : `Delete this pending ${noun} application of ${row.employeeName}? This cannot be undone.`}
        confirmLabel={confirm === "reject" ? "Reject" : "Delete"}
        busy={busy}
        onConfirm={() => confirm && void run(confirm)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

/** Bordered grid used by the balance and list tables. */
export function Grid({ headers, children, loading }: { headers: string[]; children: ReactNode; loading?: boolean }) {
  return (
    <div className={cn(TABLE.wrap, "transition-opacity", loading && "opacity-60")}>
      <table className={cn(TABLE.table, "min-w-max")}>
        <thead className={TABLE.head}>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col" className={TABLE.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
