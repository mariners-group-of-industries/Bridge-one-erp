"use client";

import { ArrowLeft, Plus, Save, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { Field, FormGrid, Input, Notice, Panel, SaveState, Select, TABLE, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import { securityPaths } from "../../paths";
import {
  APPROVAL_FEATURES,
  APPROVAL_ORDERS,
  AUTHORIZATION_TYPES,
  approverInputSchema,
  labelOf,
  MAX_APPROVERS,
  pipelineInputSchema,
  USER_TYPES,
  type ApprovalFormOptions,
  type PipelineDto,
  type PipelineInput,
  type UserType,
} from "../schemas/approval.schema";
import { approvalApi } from "../services/approval.api";

interface ApproverRow {
  key: string;
  userType: UserType;
  businessUnitId: string;
  approverId: string;
  approverName: string;
  authorizationType: string;
}

interface StageState {
  key: string;
  /** Saved stage id ("" until saved). */
  id: string;
  name: string;
  approvalOrder: string;
  requiredCount: string;
  approvers: ApproverRow[];
  draft: { userType: UserType; businessUnitId: string; approverId: string; authorizationType: string };
}

interface HeaderState {
  name: string;
  feature: string;
  userType: UserType;
  superApproverId: string;
  remarks: string;
}

let counter = 0;
const nextKey = () => `k${++counter}`;
const blankDraft = (): StageState["draft"] => ({ userType: "USER", businessUnitId: "", approverId: "", authorizationType: "APPROVAL" });
const blankStage = (): StageState => ({ key: nextKey(), id: "", name: "", approvalOrder: "ANY", requiredCount: "1", approvers: [], draft: blankDraft() });

function stagesFrom(pipeline: PipelineDto): StageState[] {
  return pipeline.stages.map((stage) => ({
    key: nextKey(),
    id: stage.id,
    name: stage.name,
    approvalOrder: stage.approvalOrder,
    requiredCount: String(stage.requiredCount),
    approvers: stage.approvers.map((a) => ({
      key: nextKey(),
      userType: a.userType,
      businessUnitId: a.businessUnitId,
      approverId: a.approverId,
      approverName: a.approverName,
      authorizationType: a.authorizationType,
    })),
    draft: blankDraft(),
  }));
}

export function ApprovalFormView({ pipelineId }: { pipelineId?: string }) {
  const options = useResource("approval-form-options", approvalApi.formOptions);
  const pipeline = useResource(pipelineId ? `approval-pipeline:${pipelineId}` : null, () => approvalApi.get(pipelineId!));
  const title = pipelineId ? "Edit Approval Setup" : "Add Approval Setup";
  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(securityPaths.approvalSetup),
    { label: pipelineId ? (pipeline.data?.name ?? "Pipeline") : "Add Approval Setup", href: pipelineId ? securityPaths.approvalEdit(pipelineId) : securityPaths.approvalNew },
  ];
  const error = options.error ?? pipeline.error;
  const ready = options.data && (!pipelineId || pipeline.data);

  return (
    <PageContainer full>
      {error || !ready ? (
        <>
          <PageHead title={title} breadcrumbs={breadcrumbs} />
          <section className="rounded border border-line bg-surface">
            {error ? (
              <ErrorState
                message={error.message}
                onRetry={() => {
                  options.reload();
                  pipeline.reload();
                }}
              />
            ) : (
              <LoadingState label="Loading approval setup…" />
            )}
          </section>
        </>
      ) : (
        <PipelineEditor key={pipeline.data?.id ?? "new"} pipelineId={pipelineId} title={title} breadcrumbs={breadcrumbs} saved={pipeline.data ?? null} options={options.data!} />
      )}
    </PageContainer>
  );
}

function PipelineEditor({
  pipelineId,
  title,
  breadcrumbs,
  saved,
  options,
}: {
  pipelineId?: string;
  title: string;
  breadcrumbs: { label: string; href: string }[];
  saved: PipelineDto | null;
  options: ApprovalFormOptions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [header, setHeader] = useState<HeaderState>(() =>
    saved
      ? { name: saved.name, feature: saved.feature, userType: saved.userType, superApproverId: saved.superApproverId, remarks: saved.remarks }
      : { name: "", feature: "", userType: "USER", superApproverId: "", remarks: "" },
  );
  const [stages, setStages] = useState<StageState[]>(() => (saved && saved.stages.length ? stagesFrom(saved) : [blankStage()]));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<{ index: number; stage: StageState } | null>(null);
  const [busy, setBusy] = useState(false);

  /** People of a user type, narrowed to a business unit when one is chosen. */
  const peopleOf = (type: UserType, businessUnitId = "") =>
    type === "USER"
      ? options.users.filter((u) => !businessUnitId || u.businessUnitIds.includes(businessUnitId)).map((u) => ({ value: u.id, label: u.name }))
      : options.employees
          .filter((e) => !businessUnitId || e.businessUnitId === businessUnitId)
          .map((e) => ({ value: e.id, label: `${e.code} · ${e.name}${e.designation ? ` (${e.designation})` : ""}` }));

  const clearErrors = (prefix: string) => setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(prefix))));
  const patchHeader = (changes: Partial<HeaderState>) => {
    setHeader((current) => ({ ...current, ...changes }));
    setDirty(true);
    for (const key of Object.keys(changes)) clearErrors(key);
  };
  const patchStage = (index: number, changes: Partial<StageState>) => {
    setStages((current) => current.map((stage, i) => (i === index ? { ...stage, ...changes } : stage)));
    setDirty(true);
    clearErrors(`stages.${index}.`);
  };

  const addApprover = (index: number) => {
    const stage = stages[index];
    const parsed = approverInputSchema.safeParse({ ...stage.draft, approverId: stage.draft.approverId });
    if (!parsed.success) {
      setErrors((current) => ({ ...current, [`stages.${index}.draft`]: parsed.error.issues[0].message }));
      return;
    }
    if (stage.approvers.some((a) => a.userType === stage.draft.userType && a.approverId === stage.draft.approverId)) {
      setErrors((current) => ({ ...current, [`stages.${index}.draft`]: "This approver is already in the stage." }));
      return;
    }
    if (stage.approvers.length >= MAX_APPROVERS) return;
    const name = peopleOf(stage.draft.userType).find((p) => p.value === stage.draft.approverId)?.label ?? "";
    patchStage(index, {
      approvers: [...stage.approvers, { key: nextKey(), ...stage.draft, approverName: name }],
      draft: { ...blankDraft(), userType: stage.draft.userType, businessUnitId: stage.draft.businessUnitId },
    });
  };

  const payload = (): PipelineInput => ({
    ...header,
    feature: header.feature as PipelineInput["feature"],
    stages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      approvalOrder: stage.approvalOrder as "ANY" | "SEQUENTIAL",
      requiredCount: Number(stage.requiredCount),
      approvers: stage.approvers.map((a) => ({ userType: a.userType, businessUnitId: a.businessUnitId, approverId: a.approverId, authorizationType: a.authorizationType as "APPROVAL" })),
    })),
  });

  const save = async () => {
    setFormError(null);
    const parsed = pipelineInputSchema.safeParse(payload());
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const result = pipelineId ? await approvalApi.update(pipelineId, payload()) : await approvalApi.create(payload());
      toast.success(`Approval setup "${result.name}" saved.`);
      router.push(securityPaths.approvalSetup);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const err = (key: string) => errors[key];

  return (
    <>
      <PageHead
        title={title}
        subtitle={saved ? `${saved.name} · ${saved.feature}` : "Pipeline, super approver and the approval stages."}
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={securityPaths.approvalSetup} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All Approval Setups
          </Link>
        }
      />

      <form
        noValidate
        className="flex flex-col gap-4 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {formError && <Notice tone="error">{formError}</Notice>}

        <Panel title="Approval Pipeline">
          <FormGrid cols={4}>
            <Field label="Pipeline Name" required error={err("name")}>
              {(id) => <Input id={id} value={header.name} maxLength={150} aria-invalid={!!err("name") || undefined} onChange={(e) => patchHeader({ name: e.target.value })} />}
            </Field>
            <Field label="Approval Feature" required error={err("feature")}>
              {(id) => (
                <Select
                  id={id}
                  value={header.feature}
                  placeholder="Select feature…"
                  options={APPROVAL_FEATURES.map((f) => ({ value: f, label: f }))}
                  aria-invalid={!!err("feature") || undefined}
                  onChange={(e) => patchHeader({ feature: e.target.value })}
                />
              )}
            </Field>
            <Field label="User Type" required error={err("userType")}>
              {(id) => (
                <Select
                  id={id}
                  value={header.userType}
                  placeholder={false}
                  options={USER_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                  onChange={(e) => patchHeader({ userType: e.target.value === "EMPLOYEE" ? "EMPLOYEE" : "USER", superApproverId: "" })}
                />
              )}
            </Field>
            <Field label="Super Approver" required error={err("superApproverId")}>
              {(id) => (
                <Select
                  id={id}
                  value={header.superApproverId}
                  placeholder="Select super approver…"
                  options={peopleOf(header.userType)}
                  aria-invalid={!!err("superApproverId") || undefined}
                  onChange={(e) => patchHeader({ superApproverId: e.target.value })}
                />
              )}
            </Field>
            <Field label="Remarks" error={err("remarks")} span="full">
              {(id) => <TextArea id={id} rows={2} value={header.remarks} maxLength={500} onChange={(e) => patchHeader({ remarks: e.target.value })} />}
            </Field>
          </FormGrid>
        </Panel>

        {err("stages") && <Notice tone="error">{err("stages")}</Notice>}

        {stages.map((stage, index) => {
          const se = (key: string) => err(`stages.${index}.${key}`);
          const countOptions = Array.from({ length: Math.max(1, stage.approvers.length) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
          return (
            <Panel
              key={stage.key}
              title={`Stage ${index + 1}`}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:text-danger"
                  disabled={stages.length === 1}
                  title={stages.length === 1 ? "A pipeline needs at least one stage" : "Delete stage"}
                  onClick={() => {
                    if (stage.id && pipelineId) setRemoving({ index, stage });
                    else {
                      setStages((current) => current.filter((_, i) => i !== index));
                      setErrors({});
                      setDirty(true);
                    }
                  }}
                >
                  <Trash2 /> Delete Stage
                </Button>
              }
            >
              <div className="flex flex-col gap-4">
                <FormGrid cols={3}>
                  <Field label="Stage Name" required error={se("name")}>
                    {(id) => <Input id={id} value={stage.name} maxLength={150} aria-invalid={!!se("name") || undefined} onChange={(e) => patchStage(index, { name: e.target.value })} />}
                  </Field>
                  <Field label="Approval Order" required error={se("approvalOrder")}>
                    {(id) => (
                      <Select
                        id={id}
                        value={stage.approvalOrder}
                        placeholder={false}
                        options={APPROVAL_ORDERS.map((o) => ({ value: o.value, label: o.label }))}
                        onChange={(e) => patchStage(index, { approvalOrder: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Number of Person" required error={se("requiredCount")} hint="How many approvers must approve this stage.">
                    {(id) => (
                      <Select
                        id={id}
                        value={stage.requiredCount}
                        placeholder={false}
                        options={countOptions}
                        aria-invalid={!!se("requiredCount") || undefined}
                        onChange={(e) => patchStage(index, { requiredCount: e.target.value })}
                      />
                    )}
                  </Field>
                </FormGrid>

                <div className="rounded border border-line bg-canvas p-3">
                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                    <Field label="User Type">
                      {(id) => (
                        <Select
                          id={id}
                          value={stage.draft.userType}
                          placeholder={false}
                          options={USER_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                          onChange={(e) => patchStage(index, { draft: { ...stage.draft, userType: e.target.value === "EMPLOYEE" ? "EMPLOYEE" : "USER", approverId: "" } })}
                        />
                      )}
                    </Field>
                    <Field label="Business Unit">
                      {(id) => (
                        <Select
                          id={id}
                          value={stage.draft.businessUnitId}
                          placeholder="All business units"
                          options={options.businessUnits.map((u) => ({ value: u.id, label: u.name }))}
                          onChange={(e) => patchStage(index, { draft: { ...stage.draft, businessUnitId: e.target.value, approverId: "" } })}
                        />
                      )}
                    </Field>
                    <Field label="Approver Name">
                      {(id) => (
                        <Select
                          id={id}
                          value={stage.draft.approverId}
                          placeholder="Select approver…"
                          options={peopleOf(stage.draft.userType, stage.draft.businessUnitId).filter(
                            (p) => !stage.approvers.some((a) => a.userType === stage.draft.userType && a.approverId === p.value),
                          )}
                          onChange={(e) => patchStage(index, { draft: { ...stage.draft, approverId: e.target.value } })}
                        />
                      )}
                    </Field>
                    <Field label="Authorization Type">
                      {(id) => (
                        <Select
                          id={id}
                          value={stage.draft.authorizationType}
                          placeholder={false}
                          options={AUTHORIZATION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                          onChange={(e) => patchStage(index, { draft: { ...stage.draft, authorizationType: e.target.value } })}
                        />
                      )}
                    </Field>
                    <Button variant="accent-soft" disabled={!stage.draft.approverId} onClick={() => addApprover(index)}>
                      <UserPlus /> Add
                    </Button>
                  </div>
                  {(se("draft") || se("approvers")) && <p className="mt-2 text-xs text-danger">{se("draft") ?? se("approvers")}</p>}
                </div>

                {stage.approvers.length === 0 ? (
                  <p className={cn("py-2 text-center text-sm", se("approvers") ? "text-danger" : "text-ink-faint")}>No approvers added yet.</p>
                ) : (
                  <div className={TABLE.wrap}>
                    <table className={TABLE.table}>
                      <thead className={TABLE.head}>
                        <tr>
                          {["SL", "User Type", "Approver Name", "Authorization Type", "Action"].map((h) => (
                            <th key={h} scope="col" className={TABLE.th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stage.approvers.map((a, ai) => (
                          <tr key={a.key} className={TABLE.row}>
                            <td className={`${TABLE.td} w-12 text-right tabular-nums`}>{ai + 1}</td>
                            <td className={TABLE.td}>{labelOf(USER_TYPES, a.userType)}</td>
                            <td className={`${TABLE.td} font-medium`}>{a.approverName}</td>
                            <td className={TABLE.td}>{labelOf(AUTHORIZATION_TYPES, a.authorizationType)}</td>
                            <td className={`${TABLE.td} w-20 text-center`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:text-danger"
                                aria-label={`Remove ${a.approverName}`}
                                onClick={() => {
                                  const approvers = stage.approvers.filter((_, i) => i !== ai);
                                  patchStage(index, { approvers, requiredCount: String(Math.min(Number(stage.requiredCount), Math.max(1, approvers.length))) });
                                }}
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
            </Panel>
          );
        })}

        <div>
          <Button
            variant="accent-soft"
            disabled={stages.length >= 20}
            onClick={() => {
              setStages((current) => [...current, blankStage()]);
              setDirty(true);
            }}
          >
            <Plus /> Add Stage
          </Button>
        </div>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <SaveState dirty={dirty} />
          <Link href={securityPaths.approvalSetup} className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
          <Button type="submit" variant="accent" loading={saving}>
            {!saving && <Save />} Save
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={removing !== null}
        title="Delete stage?"
        message={removing ? `Delete Stage ${removing.index + 1}${removing.stage.name ? ` "${removing.stage.name}"` : ""} now? The remaining stages are renumbered.` : ""}
        busy={busy}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing || !pipelineId) return;
          setBusy(true);
          try {
            await approvalApi.removeStage(pipelineId, removing.stage.id);
            // Keep the other stages' unsaved edits; only drop the deleted one.
            setStages((current) => current.filter((s) => s.key !== removing.stage.key));
            setErrors({});
            toast.success("Stage deleted.");
            setRemoving(null);
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
