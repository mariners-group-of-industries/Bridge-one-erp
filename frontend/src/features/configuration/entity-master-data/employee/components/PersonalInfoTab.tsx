"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { errorMessage } from "@/lib/api/client";
import { BLOOD_GROUP_OPTIONS, GENDER_OPTIONS, RELIGION_OPTIONS } from "../schemas/employee.schema";
import {
  updatePersonalInfoSchema,
  type PersonalInfoDto,
  type UpdatePersonalInfoInput,
} from "../schemas/personal-info.schema";
import { employeeApi } from "../services/employee.api";
import { personalInfoApi } from "../services/personal-info.api";
import { AccountSettingsSection } from "./AccountSettingsSection";
import { ErpAccessSection } from "./ErpAccessSection";
import { Field, FormGrid, Input, Panel, PanelSection, ReadValue, SaveState, Select, TextArea } from "./kit";

function toForm(d: PersonalInfoDto): UpdatePersonalInfoInput {
  return {
    // Blank keeps the current Employee ID; typing a value changes it.
    employeeCode: "",
    name: d.name,
    attendanceId: d.attendanceId ?? "",
    designation: d.designation ?? "",
    hrPosition: d.hrPosition ?? "",
    department: d.department ?? "",
    departmentSection: d.departmentSection ?? "",
    employeeType: d.employeeType ?? "",
    serviceCategory: d.serviceCategory ?? "",
    employeePolicy: d.employeePolicy ?? "",
    location: d.location ?? "",
    joiningDate: d.joiningDate,
    confirmationDate: d.confirmationDate ?? "",
    terminationDate: d.terminationDate ?? "",
    mobile: d.mobile ?? "",
    email: d.email ?? "",
    officialContact: d.officialContact ?? "",
    religion: d.religion ?? "",
    gender: d.gender ?? "",
    bloodGroup: d.bloodGroup ?? "",
    dateOfBirth: d.dateOfBirth ?? "",
    fathersName: d.fathersName ?? "",
    mothersName: d.mothersName ?? "",
    nidNumber: d.nidNumber ?? "",
    presentAddress: d.presentAddress ?? "",
    permanentAddress: d.permanentAddress ?? "",
    supervisor: d.supervisor ?? "",
    lineManager: d.lineManager ?? "",
  };
}

/** Keeps the saved value selectable even when it is no longer in the option list. */
const withCurrent = (list: string[] | undefined, current: string) => {
  const base = list ?? [];
  return current && !base.includes(current) ? [current, ...base] : base;
};

interface PersonalInfoTabProps {
  employeeId: string;
  /** Loaded by the profile page (also shown in its header). */
  data: PersonalInfoDto;
  onSaved: (saved: PersonalInfoDto) => void;
}

export function PersonalInfoTab({ employeeId, data, onSaved }: PersonalInfoTabProps) {
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const { data: opts } = useResource("employee-form-options", employeeApi.formOptions);
  const form = useValidatedForm(updatePersonalInfoSchema, toForm(data));

  const v = form.values;
  const e = form.errors;
  const set = form.setField;

  const handleSave = async () => {
    const parsed = form.validate();
    if (!parsed) return;
    setIsSaving(true);
    try {
      const updated = await personalInfoApi.updatePersonalInfo(employeeId, parsed);
      form.reset(toForm(updated));
      onSaved(updated);
      toast.success("Personal information saved.");
    } catch (err) {
      if (!form.applyServerError(err)) toast.error(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const select = (
    key: "designation" | "hrPosition" | "department" | "departmentSection" | "employeeType" | "serviceCategory" | "employeePolicy" | "supervisor" | "lineManager",
    label: string,
    list: string[] | undefined,
  ) => (
    <Field label={label} error={e[key]}>
      {(id) => (
        <Select id={id} value={v[key] ?? ""} onChange={(ev) => set(key, ev.target.value)} options={withCurrent(list, v[key] ?? "")} />
      )}
    </Field>
  );

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Panel
        title="Employee Details"
        description="Work assignment, employment dates, contact and personal information."
        stickyFooter
        footer={
          <>
            <SaveState dirty={form.dirty} />
            <Button onClick={() => form.reset(toForm(data))} disabled={!form.dirty || isSaving}>
              Discard
            </Button>
            <Button variant="accent" loading={isSaving} onClick={handleSave} disabled={!form.dirty}>
              Save Changes
            </Button>
          </>
        }
      >
        <form
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            void handleSave();
          }}
        >
          <PanelSection title="Work">
            <FormGrid>
              <Field label="Full Name" required error={e.name}>
                {(id) => <Input id={id} value={v.name} aria-invalid={!!e.name} onChange={(ev) => set("name", ev.target.value)} />}
              </Field>
              <Field label="Employee ID" error={e.employeeCode} hint="Leave blank to keep the current ID.">
                {(id) => (
                  <Input id={id} value={v.employeeCode} placeholder={data.employeeCode} onChange={(ev) => set("employeeCode", ev.target.value)} />
                )}
              </Field>
              <ReadValue label="Attendance ID" value={data.attendanceId} />
              <ReadValue label="Office" value={data.officeName} />
              {select("designation", "Designation", opts?.designations)}
              {select("hrPosition", "HR Position", opts?.hrPositions)}
              {select("department", "Department", opts?.departments)}
              {select("departmentSection", "Department Section", opts?.departmentSections)}
              {select("employeeType", "Employee Type", opts?.employeeTypes)}
              {select("serviceCategory", "Service Category", opts?.serviceCategories)}
              {select("employeePolicy", "Employee Policy", opts?.employeePolicies)}
              <Field label="Location" error={e.location}>
                {(id) => <Input id={id} value={v.location ?? ""} placeholder="City / Area" onChange={(ev) => set("location", ev.target.value)} />}
              </Field>
            </FormGrid>
          </PanelSection>

          <PanelSection title="Employment Dates">
            <FormGrid>
              <Field label="Joining Date" required error={e.joiningDate}>
                {(id) => <Input id={id} type="date" value={v.joiningDate} onChange={(ev) => set("joiningDate", ev.target.value)} />}
              </Field>
              <Field label="Confirmation Date" error={e.confirmationDate}>
                {(id) => <Input id={id} type="date" value={v.confirmationDate ?? ""} onChange={(ev) => set("confirmationDate", ev.target.value)} />}
              </Field>
              <Field label="Termination Date" error={e.terminationDate}>
                {(id) => <Input id={id} type="date" value={v.terminationDate ?? ""} onChange={(ev) => set("terminationDate", ev.target.value)} />}
              </Field>
              <Field label="Date of Birth" error={e.dateOfBirth}>
                {(id) => <Input id={id} type="date" value={v.dateOfBirth ?? ""} onChange={(ev) => set("dateOfBirth", ev.target.value)} />}
              </Field>
            </FormGrid>
          </PanelSection>

          <PanelSection title="Contact">
            <FormGrid>
              <Field label="Mobile" error={e.mobile}>
                {(id) => <Input id={id} type="tel" value={v.mobile ?? ""} placeholder="01XXXXXXXXX" onChange={(ev) => set("mobile", ev.target.value)} />}
              </Field>
              <Field label="Email" error={e.email}>
                {(id) => <Input id={id} type="email" value={v.email ?? ""} placeholder="name@example.com" onChange={(ev) => set("email", ev.target.value)} />}
              </Field>
              <Field label="Official Contact" error={e.officialContact}>
                {(id) => <Input id={id} type="tel" value={v.officialContact ?? ""} onChange={(ev) => set("officialContact", ev.target.value)} />}
              </Field>
            </FormGrid>
          </PanelSection>

          <PanelSection title="Personal">
            <FormGrid>
              <Field label="Gender" error={e.gender}>
                {(id) => <Select id={id} value={v.gender ?? ""} onChange={(ev) => set("gender", ev.target.value)} options={GENDER_OPTIONS} />}
              </Field>
              <Field label="Religion" error={e.religion}>
                {(id) => <Select id={id} value={v.religion ?? ""} onChange={(ev) => set("religion", ev.target.value)} options={RELIGION_OPTIONS} />}
              </Field>
              <Field label="Blood Group" error={e.bloodGroup}>
                {(id) => <Select id={id} value={v.bloodGroup ?? ""} onChange={(ev) => set("bloodGroup", ev.target.value)} options={BLOOD_GROUP_OPTIONS} />}
              </Field>
              <Field label="NID Number" error={e.nidNumber}>
                {(id) => <Input id={id} value={v.nidNumber ?? ""} onChange={(ev) => set("nidNumber", ev.target.value)} />}
              </Field>
              <Field label="Father's Name" error={e.fathersName} span={2}>
                {(id) => <Input id={id} value={v.fathersName ?? ""} onChange={(ev) => set("fathersName", ev.target.value)} />}
              </Field>
              <Field label="Mother's Name" error={e.mothersName} span={2}>
                {(id) => <Input id={id} value={v.mothersName ?? ""} onChange={(ev) => set("mothersName", ev.target.value)} />}
              </Field>
              <Field label="Present Address" error={e.presentAddress} span={2}>
                {(id) => <TextArea id={id} value={v.presentAddress ?? ""} onChange={(ev) => set("presentAddress", ev.target.value)} />}
              </Field>
              <Field label="Permanent Address" error={e.permanentAddress} span={2}>
                {(id) => <TextArea id={id} value={v.permanentAddress ?? ""} onChange={(ev) => set("permanentAddress", ev.target.value)} />}
              </Field>
            </FormGrid>
          </PanelSection>

          <PanelSection title="Reporting Line">
            <FormGrid>
              {select("supervisor", "Supervisor", opts?.supervisors)}
              {select("lineManager", "Line Manager", opts?.lineManagers)}
            </FormGrid>
          </PanelSection>
          <button type="submit" hidden />
        </form>
      </Panel>

      <AccountSettingsSection employeeId={employeeId} />
      <ErpAccessSection employeeId={employeeId} />
    </div>
  );
}
