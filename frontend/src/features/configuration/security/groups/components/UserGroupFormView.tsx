"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { Field, FormGrid, Input, Notice, Panel, SaveState, Select, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { insertAfter, removeAt, RowButtons } from "@/features/configuration/sales-config/offer/components/offer-form-kit";
import { securityPaths } from "../../paths";
import { userGroupInputSchema, type UserGroupDto, type UserOption } from "../schemas/groups.schema";
import { userGroupApi } from "../services/groups.api";

const TABS = [{ id: "required", label: "Required" }] as const;

export function UserGroupFormView({ groupId }: { groupId?: string }) {
  const users = useResource("user-group-user-options", userGroupApi.userOptions);
  const group = useResource(groupId ? `user-group:${groupId}` : null, () => userGroupApi.get(groupId!));
  const title = groupId ? "Edit User Group" : "Add User Group";
  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(securityPaths.userGroup),
    { label: groupId ? (group.data?.name ?? "User Group") : "Add User Group", href: groupId ? securityPaths.userGroupEdit(groupId) : securityPaths.userGroupNew },
  ];
  const error = users.error ?? group.error;
  const ready = users.data && (!groupId || group.data);

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
                  users.reload();
                  group.reload();
                }}
              />
            ) : (
              <LoadingState label="Loading user group…" />
            )}
          </section>
        </>
      ) : (
        <Editor key={group.data?.id ?? "new"} groupId={groupId} title={title} breadcrumbs={breadcrumbs} saved={group.data ?? null} users={users.data!} />
      )}
    </PageContainer>
  );
}

function Editor({ groupId, title, breadcrumbs, saved, users }: { groupId?: string; title: string; breadcrumbs: { label: string; href: string }[]; saved: UserGroupDto | null; users: UserOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(saved?.name ?? "");
  const [rows, setRows] = useState<string[]>(saved && saved.members.length ? saved.members.map((m) => m.id) : [""]);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Members no longer active still show by name.
  const byId = new Map([...(saved?.members ?? []), ...users].map((u) => [u.id, u]));

  const changeRows = (next: string[]) => {
    setRows(next);
    setDirty(true);
    setErrors(({ userIds: _removed, ...rest }) => rest);
  };

  const save = async () => {
    setFormError(null);
    const input = { name, userIds: rows.filter(Boolean) };
    const parsed = userGroupInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const result = groupId ? await userGroupApi.update(groupId, input) : await userGroupApi.create(input);
      toast.success(`User group "${result.name}" saved.`);
      router.push(securityPaths.userGroup);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead
        title={title}
        subtitle={saved ? saved.name : "Group name and its users."}
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={securityPaths.userGroup} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All User Groups
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
        <Panel flush>
          <Tabs tabs={TABS} value="required" onChange={() => undefined} label="User group sections">
            <div className="flex flex-col gap-4 px-5 py-4">
              <FormGrid cols={3}>
                <Field label="User Group Name" required error={errors.name}>
                  {(id) => (
                    <Input
                      id={id}
                      value={name}
                      maxLength={150}
                      aria-invalid={!!errors.name || undefined}
                      onChange={(e) => {
                        setName(e.target.value);
                        setDirty(true);
                        setErrors(({ name: _removed, ...rest }) => rest);
                      }}
                    />
                  )}
                </Field>
              </FormGrid>

              {errors.userIds && <p className="text-xs text-danger">{errors.userIds}</p>}
              <div className={TABLE.wrap}>
                <table className={TABLE.table}>
                  <thead className={TABLE.head}>
                    <tr>
                      {["SL", "User", "Employee Code", "Action"].map((h) => (
                        <th key={h} scope="col" className={TABLE.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((userId, index) => {
                      const taken = new Set(rows.filter((_, i) => i !== index));
                      const options = [...byId.values()].filter((u) => !taken.has(u.id)).map((u) => ({ value: u.id, label: u.name }));
                      return (
                        <tr key={index} className={TABLE.row}>
                          <td className={`${TABLE.td} w-12 text-right tabular-nums`}>{index + 1}</td>
                          <td className="px-2 py-1.5">
                            <Select
                              aria-label={`User of row ${index + 1}`}
                              value={userId}
                              placeholder="Select user…"
                              options={options}
                              onChange={(e) => changeRows(rows.map((v, i) => (i === index ? e.target.value : v)))}
                            />
                          </td>
                          <td className={`${TABLE.td} tabular-nums`}>{byId.get(userId)?.employeeCode ?? <span className="text-ink-faint">—</span>}</td>
                          <td className={`${TABLE.td} w-24`}>
                            <RowButtons index={index} onAdd={() => changeRows(insertAfter(rows, index, ""))} onRemove={() => changeRows(removeAt(rows, index, ""))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Tabs>
        </Panel>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <SaveState dirty={dirty} />
          <Link href={securityPaths.userGroup} className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
          <Button type="submit" variant="accent" loading={saving}>
            {!saving && <Save />} Save
          </Button>
        </div>
      </form>
    </>
  );
}
