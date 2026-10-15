"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { Field, FormGrid, Input, Notice, Select, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { AssignmentDto } from "../schemas/territory.schema";
import { territoryApi } from "../services/territory.api";

/**
 * Scroll-down loading: shows `step` more rows each time the sentinel (placed
 * after the last row) scrolls into view. Resets when `resetKey` changes.
 */
export function useScrollLoad(total: number, resetKey: string, step = 50) {
  const [state, setState] = useState({ key: resetKey, count: step });
  const count = state.key === resetKey ? state.count : step;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || count >= total) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setState({ key: resetKey, count: count + step });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [count, total, resetKey, step]);
  return { count: Math.min(count, total), sentinel, hasMore: count < total };
}

export function ScrollMore({ sentinel, hasMore, shown, total, noun }: { sentinel: React.RefObject<HTMLDivElement | null>; hasMore: boolean; shown: number; total: number; noun: string }) {
  return (
    <div ref={sentinel} className="px-4 py-2.5 text-center text-xs text-ink-faint" aria-live="polite">
      {hasMore ? `Showing ${shown} of ${total} ${noun} · scroll for more…` : `${total} ${noun}`}
    </div>
  );
}

// ─── Add / update node ────────────────────────────────────────────────────────

export interface NodeDialogState {
  mode: "add" | "edit";
  /** "Region", "Territory" … */
  layerName: string;
  businessUnitId: string;
  parentId: string;
  nodeId?: string;
  code: string;
  name: string;
}

export function NodeDialog({ state, onClose, onSaved }: { state: NodeDialogState | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState({ code: "", name: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seen, setSeen] = useState<NodeDialogState | null>(null);
  if (state !== seen) {
    setSeen(state);
    setValues({ code: state?.code ?? "", name: state?.name ?? "" });
    setError(null);
  }

  const save = async () => {
    if (!state) return;
    setSaving(true);
    setError(null);
    try {
      if (state.mode === "add")
        await territoryApi.addNode({
          businessUnitId: state.businessUnitId,
          parentId: state.parentId,
          ...values,
        });
      else await territoryApi.updateNode(state.nodeId!, values);
      toast.success(`${state.layerName} "${values.name.trim()}" saved.`);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const noun = state?.layerName ?? "";
  return (
    <Dialog
      open={state !== null}
      title={state?.mode === "edit" ? `Update ${noun}` : `Add ${noun}`}
      onClose={onClose}
      onSubmit={save}
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
        {error && <Notice tone="error">{error}</Notice>}
        <FormGrid cols={2}>
          <Field label={`${noun} Code`} required>
            {(id) => <Input id={id} autoFocus value={values.code} maxLength={30} onChange={(e) => setValues({ ...values, code: e.target.value })} />}
          </Field>
          <Field label={`${noun} Name`} required>
            {(id) => <Input id={id} value={values.name} maxLength={100} onChange={(e) => setValues({ ...values, name: e.target.value })} />}
          </Field>
        </FormGrid>
      </div>
    </Dialog>
  );
}

// ─── Assign employees ─────────────────────────────────────────────────────────

export function AssignEmployeesDialog({ node, onClose, onChanged }: { node: { id: string; name: string } | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const assigned = useResource(node ? `assignments:${node.id}` : null, () => territoryApi.assignments(node!.id));
  const employees = useResource(node ? `employee-options:${node.id}` : null, () => territoryApi.employeeOptions(node!.id));
  const [employeeId, setEmployeeId] = useState("");
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<AssignmentDto[]>, message: string) => {
    setBusy(true);
    try {
      const next = await action();
      assigned.mutate(() => next);
      toast.success(message);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
      assigned.reload();
    } finally {
      setBusy(false);
    }
  };

  const taken = new Set((assigned.data ?? []).map((row) => row.employeeId));
  return (
    <Dialog open={node !== null} size="xl" title={`Assign Employees · ${node?.name ?? ""}`} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Employee" className="min-w-64 flex-1">
            {(id) => (
              <Select
                id={id}
                value={employeeId}
                disabled={!employees.data}
                placeholder="Select employee…"
                options={(employees.data ?? [])
                  .filter((e) => !taken.has(e.id))
                  .map((e) => ({
                    value: e.id,
                    label: `${e.code} · ${e.name}${e.designation ? ` (${e.designation})` : ""}`,
                  }))}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            )}
          </Field>
          <Field label="Distribution Channel" className="w-56">
            {(id) => <Input id={id} value={channel} maxLength={100} placeholder="e.g. General Trade" onChange={(e) => setChannel(e.target.value)} />}
          </Field>
          <Button
            variant="accent"
            disabled={!employeeId || busy}
            onClick={() =>
              run(async () => {
                const result = await territoryApi.assign(node!.id, {
                  employeeId,
                  distributionChannel: channel,
                });
                setEmployeeId("");
                setChannel("");
                return result;
              }, "Employee assigned.")
            }
          >
            <UserPlus /> Add Employee
          </Button>
        </div>

        {assigned.error ? (
          <ErrorState message={assigned.error.message} onRetry={assigned.reload} />
        ) : !assigned.data ? (
          <LoadingState />
        ) : assigned.data.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-faint">No employees assigned yet.</p>
        ) : (
          <div className={TABLE.wrap}>
            <table className={TABLE.table}>
              <thead className={TABLE.head}>
                <tr>
                  {["Name", "Designation", "Phone No", "Email", "Distribution Channel", "Action"].map((h) => (
                    <th key={h} scope="col" className={TABLE.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assigned.data.map((row) => (
                  <tr key={row.id} className={TABLE.row}>
                    <td className={`${TABLE.td} font-medium`}>{row.name}</td>
                    <td className={TABLE.td}>{row.designation ?? "—"}</td>
                    <td className={`${TABLE.td} tabular-nums`}>{row.phone ?? "—"}</td>
                    <td className={TABLE.td}>{row.email ?? "—"}</td>
                    <td className={TABLE.td}>{row.distributionChannel ?? "—"}</td>
                    <td className={`${TABLE.td} text-center`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-danger"
                        aria-label={`Remove ${row.name}`}
                        disabled={busy}
                        onClick={() => run(() => territoryApi.unassign(node!.id, row.id), `${row.name} removed.`)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
}
