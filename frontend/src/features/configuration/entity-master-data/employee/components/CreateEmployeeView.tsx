"use client";

import { Check, ImagePlus, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { entityMasterDataPaths } from "../../paths";
import {
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  RELIGION_OPTIONS,
  type CreateEmployeeInput,
} from "../schemas/employee.schema";
import { employeeApi } from "../services/employee.api";
import { Checkbox, Field, FormGrid, Input, Notice, Panel, Select, TextArea } from "./kit";

const BREADCRUMBS = [
  ...entityMasterDataBreadcrumbs(entityMasterDataPaths.employee),
  { label: "New Employee", href: entityMasterDataPaths.employeeCreate },
];

type FieldErrors = Partial<Record<keyof CreateEmployeeInput, string>>;

const EMPTY: CreateEmployeeInput = {
  employeeCode: "", attendanceId: "", name: "", officeId: "",
  designation: "", hrPosition: "", department: "", departmentSection: "",
  employeeType: "", serviceCategory: "", employeePolicy: "", location: "",
  joiningDate: "", confirmationDate: "", terminationDate: "",
  mobile: "", email: "", officialContact: "",
  religion: "", gender: "", bloodGroup: "", dateOfBirth: "",
  fathersName: "", mothersName: "", nidNumber: "",
  presentAddress: "", permanentAddress: "",
  supervisor: "", lineManager: "",
  holdSalary: false, departmentApproval: false, isService: false,
  holdPayment: false, isReseller: false, isUser: false,
};

const FLAGS: [keyof CreateEmployeeInput, string][] = [
  ["holdSalary", "Hold Salary"],
  ["departmentApproval", "Department Approval"],
  ["isService", "Is Service"],
  ["holdPayment", "Hold Payment"],
  ["isReseller", "Reseller"],
  ["isUser", "User"],
];

// ─── Select with "add new value" ──────────────────────────────────────────────

function AddableSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const confirm = () => {
    const next = draft.trim();
    if (next) onChange(next);
    setAdding(false);
    setDraft("");
  };
  const cancel = () => {
    setAdding(false);
    setDraft("");
  };

  return (
    <Field label={label}>
      {(id) =>
        adding ? (
          <div className="flex gap-1.5">
            <Input
              id={id}
              autoFocus
              value={draft}
              placeholder={`New ${label.toLowerCase()}`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                }
                if (e.key === "Escape") cancel();
              }}
            />
            <Button variant="accent" size="icon" className="size-8" aria-label={`Add ${label}`} onClick={confirm}>
              <Check />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Cancel" onClick={cancel}>
              <X />
            </Button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <Select id={id} value={value} options={options} onChange={(e) => onChange(e.target.value)} />
            <Button
              variant="accent-soft"
              size="icon"
              className="size-8"
              aria-label={`Add new ${label}`}
              title={`Add new ${label.toLowerCase()}`}
              onClick={() => setAdding(true)}
            >
              <Plus />
            </Button>
          </div>
        )
      }
    </Field>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CreateEmployeeView() {
  const router = useRouter();
  const [form, setForm] = useState<CreateEmployeeInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const { data: opts } = useResource("employee-form-options", employeeApi.formOptions);

  // Values typed with "add new" for the free-text masters.
  const [extra, setExtra] = useState<Record<"designation" | "hrPosition" | "department" | "departmentSection", string[]>>({
    designation: [],
    hrPosition: [],
    department: [],
    departmentSection: [],
  });

  const set = <K extends keyof CreateEmployeeInput>(key: K, value: CreateEmployeeInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const addable = (key: keyof typeof extra, label: string, base: string[] | undefined) => {
    const options = [...(base ?? []), ...extra[key]];
    return (
      <AddableSelect
        label={label}
        value={(form[key] as string) ?? ""}
        options={options}
        onChange={(value) => {
          set(key, value);
          if (value && !options.includes(value)) setExtra((prev) => ({ ...prev, [key]: [...prev[key], value] }));
        }}
      />
    );
  };

  const required: { key: keyof CreateEmployeeInput; label: string; done: boolean }[] = [
    { key: "employeeCode", label: "Employee ID", done: !!form.employeeCode.trim() },
    { key: "name", label: "Full name", done: !!form.name.trim() },
    { key: "officeId", label: "Office", done: !!form.officeId },
    { key: "joiningDate", label: "Joining date", done: !!form.joiningDate },
  ];

  const validate = (): boolean => {
    const e: FieldErrors = {};
    for (const item of required) if (!item.done) e[item.key] = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setServerError("");
    try {
      await employeeApi.create(form);
      router.push(entityMasterDataPaths.employee);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Failed to create employee.");
    } finally {
      setSubmitting(false);
    }
  };

  const text = (key: keyof CreateEmployeeInput, label: string, props: { type?: string; placeholder?: string; required?: boolean; span?: 2 } = {}) => (
    <Field label={label} required={props.required} error={errors[key]} span={props.span}>
      {(id) => (
        <Input
          id={id}
          type={props.type}
          placeholder={props.placeholder}
          aria-invalid={!!errors[key]}
          value={(form[key] as string) ?? ""}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </Field>
  );

  const list = (key: keyof CreateEmployeeInput, label: string, options: readonly string[] | undefined) => (
    <Field label={label}>
      {(id) => <Select id={id} value={(form[key] as string) ?? ""} options={options ?? []} onChange={(e) => set(key, e.target.value)} />}
    </Field>
  );

  const actions = (
    <>
      <Link href={entityMasterDataPaths.employee} className={buttonClasses("secondary", "md")}>
        Cancel
      </Link>
      <Button variant="accent" loading={submitting} onClick={handleSubmit}>
        Save Employee
      </Button>
    </>
  );

  return (
    <PageContainer>
      <PageHead
        title="New Employee"
        subtitle="Fields marked * are required. Everything else can be completed later from the profile."
        breadcrumbs={BREADCRUMBS}
        actions={actions}
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="grid gap-4 pb-10 xl:grid-cols-[minmax(0,1fr)_18rem]"
      >
        <div className="flex min-w-0 flex-col gap-4">
          {serverError && <Notice tone="error">{serverError}</Notice>}

          <Panel title="Identity">
            <FormGrid cols={3}>
              {text("employeeCode", "Employee ID", { required: true, placeholder: "e.g. 30577" })}
              {text("name", "Full Name", { required: true, placeholder: "Employee full name" })}
              {text("attendanceId", "Attendance Device / Card No.", { placeholder: "e.g. 100120576" })}
            </FormGrid>
          </Panel>

          <Panel title="Position & Office">
            <FormGrid cols={3}>
              <Field label="Office" required error={errors.officeId}>
                {(id) => (
                  <Select
                    id={id}
                    value={form.officeId}
                    aria-invalid={!!errors.officeId}
                    options={(opts?.offices ?? []).map((o) => ({ value: o.id, label: o.name }))}
                    onChange={(e) => set("officeId", e.target.value)}
                  />
                )}
              </Field>
              {addable("designation", "Designation", opts?.designations)}
              {addable("hrPosition", "HR Position", opts?.hrPositions)}
              {addable("department", "Department", opts?.departments)}
              {addable("departmentSection", "Department Section", opts?.departmentSections)}
              {list("employeeType", "Employee Type", opts?.employeeTypes)}
              {list("serviceCategory", "Service Category", opts?.serviceCategories)}
              {list("employeePolicy", "Employee Policy", opts?.employeePolicies)}
              {text("location", "Location", { placeholder: "City / Area" })}
            </FormGrid>
          </Panel>

          <Panel title="Employment Dates">
            <FormGrid cols={3}>
              {text("joiningDate", "Joining Date", { type: "date", required: true })}
              {text("confirmationDate", "Confirmation Date", { type: "date" })}
              {text("terminationDate", "Termination Date", { type: "date" })}
            </FormGrid>
          </Panel>

          <Panel title="Contact">
            <FormGrid cols={3}>
              {text("mobile", "Mobile Number", { type: "tel", placeholder: "01XXXXXXXXX" })}
              {text("email", "Email", { type: "email", placeholder: "name@example.com" })}
              {text("officialContact", "Official Contact", { type: "tel" })}
            </FormGrid>
          </Panel>

          <Panel title="Personal Details">
            <FormGrid>
              {list("gender", "Gender", GENDER_OPTIONS)}
              {list("religion", "Religion", RELIGION_OPTIONS)}
              {list("bloodGroup", "Blood Group", BLOOD_GROUP_OPTIONS)}
              {text("dateOfBirth", "Date of Birth", { type: "date" })}
              {text("fathersName", "Father's Name", { span: 2 })}
              {text("mothersName", "Mother's Name", { span: 2 })}
              {text("nidNumber", "NID Number")}
              <div className="hidden lg:block lg:col-span-3" />
              <Field label="Present Address" span={2}>
                {(id) => <TextArea id={id} value={form.presentAddress ?? ""} onChange={(e) => set("presentAddress", e.target.value)} />}
              </Field>
              <Field label="Permanent Address" span={2}>
                {(id) => <TextArea id={id} value={form.permanentAddress ?? ""} onChange={(e) => set("permanentAddress", e.target.value)} />}
              </Field>
            </FormGrid>
          </Panel>

          <Panel title="Reporting Line">
            <FormGrid cols={3}>
              {list("supervisor", "Supervisor", opts?.supervisors)}
              {list("lineManager", "Line Manager", opts?.lineManagers)}
            </FormGrid>
          </Panel>

          <Panel title="Photo & Signature" description="JPEG or PNG.">
            <FormGrid cols={2}>
              {["Profile Image", "Signature"].map((label) => (
                <Field key={label} label={label}>
                  <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong bg-canvas text-ink-faint transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-strong focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-line">
                    <ImagePlus aria-hidden="true" className="size-5" />
                    <span className="text-xs">Click to choose a file</span>
                    <input type="file" accept="image/jpeg,image/png" className="sr-only" />
                  </label>
                </Field>
              ))}
            </FormGrid>
          </Panel>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-36 xl:self-start">
          <Panel title="Required">
            <ul className="flex flex-col gap-2 text-sm">
              {required.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border",
                      item.done ? "border-success bg-success text-white" : "border-line-strong",
                    )}
                  >
                    {item.done && <Check className="size-3" />}
                  </span>
                  <span className={item.done ? "text-ink" : "text-ink-muted"}>{item.label}</span>
                  <span className="sr-only">{item.done ? "(done)" : "(missing)"}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Options">
            <div className="flex flex-col gap-2.5">
              {FLAGS.map(([key, label]) => (
                <Checkbox key={key} label={label} checked={form[key] as boolean} onChange={(e) => set(key, e.target.checked)} />
              ))}
            </div>
          </Panel>

          <div className="flex justify-end gap-2">{actions}</div>
        </aside>
        <button type="submit" hidden />
      </form>
    </PageContainer>
  );
}
