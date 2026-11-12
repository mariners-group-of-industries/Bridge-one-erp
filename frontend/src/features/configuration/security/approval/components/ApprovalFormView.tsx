"use client";

import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { Checkbox, DecimalInput, Field, Input, Notice, Panel, SaveState, Select, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { securityPaths } from "../../paths";
import {
  APPROVAL_ORDERS,
  AUTHORIZATION_TYPES,
  approverInputSchema,
  featuresOf,
  labelOf,
  MAX_APPROVERS,
  MODULE_NAMES,
  pipelineInputSchema,
  USER_TYPES,
  type ApprovalFormOptions,
  type PipelineDto,
  type PipelineInput,
  type UserType,
} from "../schemas/approval.schema";
import { approvalApi } from "../services/approval.api";

const MAX_STAGES = 20;

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
  allowThreshold: boolean;
  thresholdMin: string;
  thresholdMax: string;
  /** User type and business unit the approver picker is filtered by. */
  userType: UserType | "";
  businessUnitId: string;
  approvers: ApproverRow[];
  draft: { approverId: string; authorizationType: string };
}

interface HeaderState {
  name: string;
  module: string;
  feature: string;
  userType: UserType | "";
  superApproverId: string;
  remarks: string;
  isOfficeWise: boolean;
  isTerritoryWise: boolean;
  isItemCategoryWise: boolean;
}

let counter = 0;
const nextKey = () => `k${++counter}`;
const blankDraft = (): StageState["draft"] => ({ approverId: "", authorizationType: "" });
const blankStage = (businessUnitId: string): StageState => ({
  key: nextKey(),
  id: "",
  name: "",
  approvalOrder: "",
  requiredCount: "1",
  allowThreshold: false,
  thresholdMin: "",
  thresholdMax: "",
  userType: "",
  businessUnitId,
  approvers: [],
  draft: blankDraft(),
});

function stagesFrom(pipeline: PipelineDto, defaultUnit: string): StageState[] {
  return pipeline.stages.map((stage) => {
    const last = stage.approvers.at(-1);
    return {
      key: nextKey(),
      id: stage.id,
      name: stage.name,
      approvalOrder: stage.approvalOrder,
      requiredCount: String(stage.requiredCount),
      allowThreshold: stage.allowThreshold,
      thresholdMin: stage.thresholdMin,
      thresholdMax: stage.thresholdMax,
      userType: last?.userType ?? "",
      businessUnitId: last ? last.businessUnitId : defaultUnit,
      approvers: stage.approvers.map((a) => ({
        key: nextKey(),
        userType: a.userType,
        businessUnitId: a.businessUnitId,
        approverId: a.approverId,
        approverName: a.approverName,
        authorizationType: a.authorizationType,
      })),
      draft: blankDraft(),
    };
  });
}

export function ApprovalFormView({ pipelineId }: { pipelineId?: string }) {
  const options = useResource("approval-form-options", approvalApi.formOptions);
  const pipeline = useResource(pipelineId ? `approval-pipeline:${pipelineId}` : null, () => approvalApi.get(pipelineId!));
  const title = pipelineId ? "Edit Approval Setup" : "Create Approval Setup";
  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(securityPaths.approvalSetup),
    { label: pipelineId ? (pipeline.data?.name ?? "Pipeline") : "Create Approval Setup", href: pipelineId ? securityPaths.approvalEdit(pipelineId) : securityPaths.approvalNew },
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
  const formId = useId();
  const defaultUnit = options.businessUnits[0]?.id ?? "";
  const [header, setHeader] = useState<HeaderState>(() =>
    saved
      ? {
          name: saved.name,
          module: saved.module,
          feature: saved.feature,
          // The super approver is always an employee; older pipelines saved a user, shown as that user's employee.
          userType: "EMPLOYEE",
          superApproverId:
            saved.userType === "USER" ? (options.employees.find((e) => e.userId === saved.superApproverId)?.id ?? "") : saved.superApproverId,
          remarks: saved.remarks,
          isOfficeWise: saved.isOfficeWise,
          isTerritoryWise: saved.isTerritoryWise,
          isItemCategoryWise: saved.isItemCategoryWise,
        }
      : { name: "", module: "", feature: "", userType: "EMPLOYEE", superApproverId: "", remarks: "", isOfficeWise: false, isTerritoryWise: false, isItemCategoryWise: false },
  );
  const [stages, setStages] = useState<StageState[]>(() => (saved && saved.stages.length ? stagesFrom(saved, defaultUnit) : [blankStage(defaultUnit)]));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<{ index: number; stage: StageState } | null>(null);
  const [busy, setBusy] = useState(false);

  /** People of a user type, narrowed to a business unit when one is chosen. */
  const peopleOf = (type: UserType | "", businessUnitId = "") =>
    type === "USER"
      ? options.users.filter((u) => !businessUnitId || u.businessUnitIds.includes(businessUnitId)).map((u) => ({ value: u.id, label: u.name }))
      : type === "EMPLOYEE"
        ? options.employees
            .filter((e) => !businessUnitId || e.businessUnitId === businessUnitId)
            .map((e) => ({ value: e.id, label: `${e.name} (${e.code}${e.designation ? ` · ${e.designation}` : ""})` }))
        : [];

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
    const parsed = approverInputSchema.safeParse({ userType: stage.userType, businessUnitId: stage.businessUnitId, ...stage.draft });
    if (!parsed.success) {
      setErrors((current) => ({ ...current, [`stages.${index}.draft`]: parsed.error.issues[0].message }));
      return;
    }
    const { userType } = parsed.data;
    if (stage.approvers.some((a) => a.userType === userType && a.approverId === stage.draft.approverId)) {
      setErrors((current) => ({ ...current, [`stages.${index}.draft`]: "This approver is already in the stage." }));
      return;
    }
    if (stage.approvers.length >= MAX_APPROVERS) return;
    const name = peopleOf(userType).find((p) => p.value === stage.draft.approverId)?.label ?? "";
    patchStage(index, {
      approvers: [...stage.approvers, { key: nextKey(), userType, businessUnitId: stage.businessUnitId, approverName: name, ...stage.draft }],
      draft: { approverId: "", authorizationType: stage.draft.authorizationType },
    });
  };

  const payload = (): PipelineInput => ({
    ...header,
    module: header.module as PipelineInput["module"],
    feature: header.feature as PipelineInput["feature"],
    userType: header.userType as UserType,
    stages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      approvalOrder: stage.approvalOrder as "ANY" | "SEQUENTIAL",
      // In sequence every approver signs, one after another.
      requiredCount: stage.approvalOrder === "SEQUENTIAL" ? Math.max(1, stage.approvers.length) : Number(stage.requiredCount),
      allowThreshold: stage.allowThreshold,
      thresholdMin: stage.allowThreshold ? stage.thresholdMin : "",
      thresholdMax: stage.allowThreshold ? stage.thresholdMax : "",
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
  const invalid = (key: string) => !!err(key) || undefined;
  const unitOptions = options.businessUnits.map((u) => ({ value: u.id, label: u.name }));
  const superApproverWithoutLogin = !!header.superApproverId && !options.employees.find((e) => e.id === header.superApproverId)?.userId;

  return (
    <>
      <PageHead
        title={title}
        subtitle={saved ? `${saved.name} · ${saved.feature}` : "Pipeline, super approver and the approval stages."}
        breadcrumbs={breadcrumbs}
        actions={
          <>
            <Link href={securityPaths.approvalSetup} className={buttonClasses("secondary", "md")}>
              <ArrowLeft /> Back
            </Link>
            <Button type="submit" form={formId} variant="accent" loading={saving}>
              {!saving && <Save />} Save
            </Button>
          </>
        }
      />

      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {formError && <Notice tone="error">{formError}</Notice>}

        <section className="rounded border border-line bg-surface shadow-xs">
          <Tabs label="Approval setup" tabs={[{ id: "details", label: "Details" }]} value="details" onChange={() => undefined}>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Pipeline Name" required error={err("name")}>
                {(id) => <Input id={id} value={header.name} maxLength={150} placeholder="Pipeline Name" aria-invalid={invalid("name")} onChange={(e) => patchHeader({ name: e.target.value })} />}
              </Field>
              <Field label="Module" required error={err("module")}>
                {(id) => (
                  <Select
                    id={id}
                    value={header.module}
                    placeholder="Select Module"
                    options={MODULE_NAMES}
                    aria-invalid={invalid("module")}
                    onChange={(e) => patchHeader({ module: e.target.value, feature: featuresOf(e.target.value).includes(header.feature) ? header.feature : "" })}
                  />
                )}
              </Field>
              <Field label="Approval Feature" required error={err("feature")}>
                {(id) => (
                  <Select
                    id={id}
                    value={header.feature}
                    placeholder={header.module ? "Select Approval Feature" : "Select a module first"}
                    disabled={!header.module}
                    options={featuresOf(header.module)}
                    aria-invalid={invalid("feature")}
                    onChange={(e) => patchHeader({ feature: e.target.value })}
                  />
                )}
              </Field>
              <Field
                label="Super Approver"
                required
                error={err("superApproverId")}
                hint={superApproverWithoutLogin ? "This employee has no ERP login yet, so they cannot approve until one is created." : undefined}
              >
                {(id) => (
                  <Select
                    id={id}
                    value={header.superApproverId}
                    placeholder="Select Employee"
                    options={peopleOf("EMPLOYEE")}
                    aria-invalid={invalid("superApproverId")}
                    onChange={(e) => patchHeader({ superApproverId: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Remarks" error={err("remarks")}>
                {(id) => <Input id={id} value={header.remarks} maxLength={500} placeholder="Remarks" onChange={(e) => patchHeader({ remarks: e.target.value })} />}
              </Field>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 sm:col-span-2 lg:pt-5">
                <Checkbox label="Is Office Wise" checked={header.isOfficeWise} onChange={(e) => patchHeader({ isOfficeWise: e.target.checked })} />
                <Checkbox label="Is Territory Wise" checked={header.isTerritoryWise} onChange={(e) => patchHeader({ isTerritoryWise: e.target.checked })} />
                <Checkbox label="Is Item Category Wise" checked={header.isItemCategoryWise} onChange={(e) => patchHeader({ isItemCategoryWise: e.target.checked })} />
              </div>
            </div>
          </Tabs>
        </section>

        <div className="flex items-center justify-between gap-3">
          <p className={cn("text-sm", err("stages") ? "text-danger" : "text-ink-faint")}>{err("stages") ?? `${stages.length} stage${stages.length === 1 ? "" : "s"}`}</p>
          <Button
            variant="accent"
            disabled={stages.length >= MAX_STAGES}
            onClick={() => {
              setStages((current) => [...current, blankStage(defaultUnit)]);
              setDirty(true);
              clearErrors("stages");
            }}
          >
            <Plus /> Add Stage
          </Button>
        </div>

        {stages.map((stage, index) => {
          const se = (key: string) => err(`stages.${index}.${key}`);
          const countOptions = Array.from({ length: Math.max(1, stage.approvers.length) }, (_, i) => String(i + 1));
          const pickable = peopleOf(stage.userType, stage.businessUnitId).filter((p) => !stage.approvers.some((a) => a.userType === stage.userType && a.approverId === p.value));
          return (
            <Panel
              key={stage.key}
              title={`Stage - ${index + 1}`}
              actions={
                <>
                  <Checkbox
                    label="Allow Threshold"
                    checked={stage.allowThreshold}
                    onChange={(e) => patchStage(index, { allowThreshold: e.target.checked })}
                    className="mr-3"
                  />
                  <Button
                    size="sm"
                    className="border-danger/40 text-danger hover:bg-danger/10"
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
                </>
              }
            >
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Stage Name" required error={se("name")}>
                    {(id) => <Input id={id} value={stage.name} maxLength={150} placeholder="Stage Name" aria-invalid={!!se("name") || undefined} onChange={(e) => patchStage(index, { name: e.target.value })} />}
                  </Field>
                  <Field label="Approval Order" required error={se("approvalOrder")}>
                    {(id) => (
                      <Select
                        id={id}
                        value={stage.approvalOrder}
                        placeholder="Approval Order"
                        options={APPROVAL_ORDERS.map((o) => ({ value: o.value, label: o.label }))}
                        aria-invalid={!!se("approvalOrder") || undefined}
                        onChange={(e) => patchStage(index, { approvalOrder: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="User Type" required>
                    {(id) => (
                      <Select
                        id={id}
                        value={stage.userType}
                        placeholder="User Type"
                        options={USER_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                        onChange={(e) => patchStage(index, { userType: e.target.value as UserType | "", draft: { ...stage.draft, approverId: "" } })}
                      />
                    )}
                  </Field>
                  <Field label="Business Unit" required>
                    {(id) => (
                      <Select
                        id={id}
                        value={stage.businessUnitId}
                        placeholder="All Business Units"
                        options={unitOptions}
                        onChange={(e) => patchStage(index, { businessUnitId: e.target.value, draft: { ...stage.draft, approverId: "" } })}
                      />
                    )}
                  </Field>

                  {stage.allowThreshold && (
                    <>
                      <Field label="Minimum Amount" required error={se("thresholdMin")}>
                        {(id) => <DecimalInput id={id} value={stage.thresholdMin} aria-invalid={!!se("thresholdMin") || undefined} onValueChange={(v) => patchStage(index, { thresholdMin: v })} />}
                      </Field>
                      <Field label="Maximum Amount" error={se("thresholdMax")} hint="Leave empty for no upper limit.">
                        {(id) => <DecimalInput id={id} value={stage.thresholdMax} aria-invalid={!!se("thresholdMax") || undefined} onValueChange={(v) => patchStage(index, { thresholdMax: v })} />}
                      </Field>
                      <div className="hidden lg:col-span-2 lg:block" />
                    </>
                  )}

                  <Field label="Approver Name" required>
                    {(id) => (
                      <Select
                        id={id}
                        value={stage.draft.approverId}
                        placeholder={stage.userType ? "Approver Name" : "Select a user type first"}
                        disabled={!stage.userType}
                        options={pickable}
                        onChange={(e) => patchStage(index, { draft: { ...stage.draft, approverId: e.target.value } })}
                      />
                    )}
                  </Field>
                  <Field label="Authorization Type" required>
                    {(id) => (
                      <Select
                        id={id}
                        value={stage.draft.authorizationType}
                        placeholder="Authorization Type"
                        options={AUTHORIZATION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                        onChange={(e) => patchStage(index, { draft: { ...stage.draft, authorizationType: e.target.value } })}
                      />
                    )}
                  </Field>
                  <div className="flex items-end gap-3">
                    <Button variant="accent" onClick={() => addApprover(index)}>
                      <Plus /> Add
                    </Button>
                  </div>
                  {stage.approvalOrder === "ANY" && stage.approvers.length > 0 && (
                    <Field label="Number of Person" required error={se("requiredCount")} hint="Approvals needed to pass this stage.">
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
                  )}
                </div>
                {(se("draft") || se("approvers")) && <p className="-mt-2 text-xs text-danger">{se("draft") ?? se("approvers")}</p>}

                {stage.approvers.length > 0 && (
                  <div className={TABLE.wrap}>
                    <table className={TABLE.table}>
                      <thead className={TABLE.head}>
                        <tr>
                          {["SL", "User Type", "Business Unit", "Approver Name", "Authorization Type", "Action"].map((h) => (
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
                            <td className={TABLE.td}>{options.businessUnits.find((u) => u.id === a.businessUnitId)?.name ?? "All"}</td>
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
