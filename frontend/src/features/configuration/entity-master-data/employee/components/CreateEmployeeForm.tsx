"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { cn } from "@/lib/cn";
import {
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  RELIGION_OPTIONS,
  type CreateEmployeeInput,
  type EmployeeFormOptions,
} from "../schemas/employee.schema";
import { employeeApi } from "../services/employee.api";

interface CreateEmployeeFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

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

// ─── Inline "add-new" combobox ────────────────────────────────────────────────

function AddableSelect({
  label, value, options, onChange, required, error,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const confirm = () => {
    const v = newVal.trim();
    if (v) { onChange(v); }
    setAdding(false);
    setNewVal("");
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-muted">
        {label}{required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
      </span>
      {adding ? (
        <div className="flex gap-1">
          <input
            ref={inputRef}
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm(); } if (e.key === "Escape") { setAdding(false); setNewVal(""); } }}
            placeholder={`New ${label}`}
            className="h-7 w-full rounded bg-control px-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-line-strong"
          />
          <Button size="sm" variant="accent" onClick={confirm}>Add</Button>
          <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewVal(""); }}>
            <X />
          </Button>
        </div>
      ) : (
        <div className="flex gap-1">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-full rounded bg-control px-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-line-strong"
          >
            <option value="">— Select —</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <button
            type="button"
            title={`Add new ${label}`}
            onClick={() => setAdding(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent-soft text-accent-strong hover:bg-accent-line"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t border-line px-5 py-4 first:border-t-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{title}</h3>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreateEmployeeForm({ open, onClose, onCreated }: CreateEmployeeFormProps) {
  const [form, setForm] = useState<CreateEmployeeInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [opts, setOpts] = useState<EmployeeFormOptions | null>(null);

  // Extra options added inline by user
  const [extraDesignations, setExtraDesignations] = useState<string[]>([]);
  const [extraHrPositions, setExtraHrPositions] = useState<string[]>([]);
  const [extraDepartments, setExtraDepartments] = useState<string[]>([]);
  const [extraDeptSections, setExtraDeptSections] = useState<string[]>([]);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    employeeApi.formOptions().then(setOpts).catch(() => null);
    panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const set = <K extends keyof CreateEmployeeInput>(key: K, value: CreateEmployeeInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: FieldErrors = {};
    if (!form.employeeCode.trim()) e.employeeCode = "Required";
    if (!form.name.trim()) e.name = "Required";
    if (!form.officeId) e.officeId = "Required";
    if (!form.joiningDate) e.joiningDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setServerError("");
    try {
      await employeeApi.create(form);
      setForm(EMPTY);
      setErrors({});
      onCreated();
      onClose();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Failed to create employee.");
    } finally {
      setSubmitting(false);
    }
  };

  const designations  = [...(opts?.designations  ?? []), ...extraDesignations];
  const hrPositions   = [...(opts?.hrPositions    ?? []), ...extraHrPositions];
  const departments   = [...(opts?.departments    ?? []), ...extraDepartments];
  const deptSections  = [...(opts?.departmentSections ?? []), ...extraDeptSections];

  const addNew = (list: string[], setList: (v: string[]) => void, val: string) => {
    if (val && !list.includes(val)) setList([...list, val]);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/30 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Drawer */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create Employee"
        tabIndex={-1}
        className={cn(
          "fixed top-0 right-0 z-40 flex h-full w-full max-w-2xl flex-col bg-surface shadow-2xl outline-none transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Create Employee</h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Identity ── */}
          <FormSection title="Identity">
            <Grid2>
              <TextField label="Employee ID" required value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} error={errors.employeeCode} placeholder="e.g. 30577" />
              <TextField label="Attendance Device / Card Number" value={form.attendanceId ?? ""} onChange={(e) => set("attendanceId", e.target.value)} placeholder="e.g. 100120576" />
            </Grid2>
            <TextField label="Full Name" required value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name} placeholder="Employee full name" />
          </FormSection>

          {/* ── Position ── */}
          <FormSection title="Position">
            <Grid2>
              <AddableSelect
                label="Designation"
                value={form.designation ?? ""}
                options={designations}
                onChange={(v) => { set("designation", v); addNew(designations, setExtraDesignations, v); }}
              />
              <AddableSelect
                label="HR Position"
                value={form.hrPosition ?? ""}
                options={hrPositions}
                onChange={(v) => { set("hrPosition", v); addNew(hrPositions, setExtraHrPositions, v); }}
              />
              <AddableSelect
                label="Department"
                value={form.department ?? ""}
                options={departments}
                onChange={(v) => { set("department", v); addNew(departments, setExtraDepartments, v); }}
              />
              <AddableSelect
                label="Department Section"
                value={form.departmentSection ?? ""}
                options={deptSections}
                onChange={(v) => { set("departmentSection", v); addNew(deptSections, setExtraDeptSections, v); }}
              />
              <SelectField
                label="Employee Type"
                value={form.employeeType ?? ""}
                options={[{ value: "", label: "— Select —" }, ...(opts?.employeeTypes ?? []).map((t) => ({ value: t, label: t }))]}
                onChange={(e) => set("employeeType", e.target.value)}
              />
              <SelectField
                label="Office"
                required
                value={form.officeId}
                options={[{ value: "", label: "— Select —" }, ...(opts?.offices ?? []).map((o) => ({ value: o.id, label: o.name }))]}
                onChange={(e) => set("officeId", e.target.value)}
                error={errors.officeId}
              />
              <TextField label="Location" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="City / Area" />
              <SelectField
                label="Service Category"
                value={form.serviceCategory ?? ""}
                options={[{ value: "", label: "— Select —" }, ...(opts?.serviceCategories ?? []).map((s) => ({ value: s, label: s }))]}
                onChange={(e) => set("serviceCategory", e.target.value)}
              />
              <SelectField
                label="Employee Policy"
                value={form.employeePolicy ?? ""}
                options={[{ value: "", label: "— Select —" }, ...(opts?.employeePolicies ?? []).map((p) => ({ value: p, label: p }))]}
                onChange={(e) => set("employeePolicy", e.target.value)}
              />
            </Grid2>
          </FormSection>

          {/* ── Dates ── */}
          <FormSection title="Dates">
            <Grid2>
              <TextField label="Joining Date" required type="date" value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} error={errors.joiningDate} />
              <TextField label="Confirmation Date" type="date" value={form.confirmationDate ?? ""} onChange={(e) => set("confirmationDate", e.target.value)} />
              <TextField label="Termination Date" type="date" value={form.terminationDate ?? ""} onChange={(e) => set("terminationDate", e.target.value)} />
            </Grid2>
          </FormSection>

          {/* ── Contact ── */}
          <FormSection title="Contact">
            <Grid2>
              <TextField label="Mobile Number" type="tel" value={form.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} placeholder="01XXXXXXXXX" />
              <TextField label="Email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" />
              <TextField label="Official Contact" type="tel" value={form.officialContact ?? ""} onChange={(e) => set("officialContact", e.target.value)} />
            </Grid2>
          </FormSection>

          {/* ── Personal ── */}
          <FormSection title="Personal">
            <Grid2>
              <SelectField
                label="Religion"
                value={form.religion ?? ""}
                options={[{ value: "", label: "— Select —" }, ...RELIGION_OPTIONS.map((r) => ({ value: r, label: r }))]}
                onChange={(e) => set("religion", e.target.value)}
              />
              <SelectField
                label="Gender"
                value={form.gender ?? ""}
                options={[{ value: "", label: "— Select —" }, ...GENDER_OPTIONS.map((g) => ({ value: g, label: g }))]}
                onChange={(e) => set("gender", e.target.value)}
              />
              <SelectField
                label="Blood Group"
                value={form.bloodGroup ?? ""}
                options={[{ value: "", label: "— Select —" }, ...BLOOD_GROUP_OPTIONS.map((b) => ({ value: b, label: b }))]}
                onChange={(e) => set("bloodGroup", e.target.value)}
              />
              <TextField label="Date of Birth" type="date" value={form.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth", e.target.value)} />
              <TextField label="Father's Name" value={form.fathersName ?? ""} onChange={(e) => set("fathersName", e.target.value)} />
              <TextField label="Mother's Name" value={form.mothersName ?? ""} onChange={(e) => set("mothersName", e.target.value)} />
              <TextField label="NID Number" value={form.nidNumber ?? ""} onChange={(e) => set("nidNumber", e.target.value)} />
            </Grid2>
            <TextAreaField label="Present Address" value={form.presentAddress ?? ""} onChange={(e) => set("presentAddress", e.target.value)} />
            <TextAreaField label="Permanent Address" value={form.permanentAddress ?? ""} onChange={(e) => set("permanentAddress", e.target.value)} />
          </FormSection>

          {/* ── Reporting ── */}
          <FormSection title="Reporting">
            <Grid2>
              <SelectField
                label="Supervisor"
                value={form.supervisor ?? ""}
                options={[{ value: "", label: "— Select —" }, ...(opts?.supervisors ?? []).map((s) => ({ value: s, label: s }))]}
                onChange={(e) => set("supervisor", e.target.value)}
              />
              <SelectField
                label="Line Manager"
                value={form.lineManager ?? ""}
                options={[{ value: "", label: "— Select —" }, ...(opts?.lineManagers ?? []).map((m) => ({ value: m, label: m }))]}
                onChange={(e) => set("lineManager", e.target.value)}
              />
            </Grid2>
          </FormSection>

          {/* ── Uploads ── */}
          <FormSection title="Uploads">
            <Grid2>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-ink-muted">Profile Image</span>
                <input type="file" accept="image/jpeg,image/png" className="text-sm text-ink-muted file:mr-2 file:rounded file:border-0 file:bg-accent-soft file:px-2 file:py-1 file:text-xs file:font-medium file:text-accent-strong" />
                <p className="text-xs text-ink-faint">JPEG or PNG only</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-ink-muted">Upload Signature</span>
                <input type="file" accept="image/jpeg,image/png" className="text-sm text-ink-muted file:mr-2 file:rounded file:border-0 file:bg-accent-soft file:px-2 file:py-1 file:text-xs file:font-medium file:text-accent-strong" />
                <p className="text-xs text-ink-faint">JPEG or PNG only</p>
              </div>
            </Grid2>
          </FormSection>

          {/* ── Flags ── */}
          <FormSection title="Options">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <CheckboxField label="Hold Salary"          checked={form.holdSalary}          onChange={(e) => set("holdSalary",          e.target.checked)} />
              <CheckboxField label="Department Approval"  checked={form.departmentApproval}  onChange={(e) => set("departmentApproval",  e.target.checked)} />
              <CheckboxField label="Is Service"           checked={form.isService}           onChange={(e) => set("isService",           e.target.checked)} />
              <CheckboxField label="Hold Payment"         checked={form.holdPayment}         onChange={(e) => set("holdPayment",         e.target.checked)} />
              <CheckboxField label="Reseller"             checked={form.isReseller}          onChange={(e) => set("isReseller",          e.target.checked)} />
              <CheckboxField label="User"                 checked={form.isUser}              onChange={(e) => set("isUser",              e.target.checked)} />
            </div>
          </FormSection>

        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-5 py-3">
          {serverError && <p className="text-sm text-danger">{serverError}</p>}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button variant="accent" loading={submitting} onClick={handleSubmit}>Save Employee</Button>
          </div>
        </div>
      </div>
    </>
  );
}
