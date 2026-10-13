"use client";

import { Briefcase } from "lucide-react";
import { useMemo } from "react";
import { useResource } from "@/hooks/use-resource";
import type { EmploymentEntryInput, EmploymentHistoryDto } from "../schemas/employment-history.schema";
import { employmentHistoryApi } from "../services/employment-history.api";
import { EntryListEditor } from "./EntryListEditor";
import { Field, FormGrid, Input, TextArea } from "./kit";

const blank = (): EmploymentEntryInput => ({
  companyName: "",
  jobTitle: "",
  location: "",
  description: "",
  fromDate: "",
  toDate: "",
});

const toEntry = (d: EmploymentHistoryDto): EmploymentEntryInput => ({
  companyName: d.companyName,
  jobTitle: d.jobTitle,
  location: d.location,
  description: d.description,
  fromDate: d.fromDate,
  toDate: d.toDate,
});

function validate(rows: EmploymentEntryInput[]): string | null {
  for (const [i, r] of rows.entries()) {
    if (!r.companyName || !r.jobTitle || !r.location || !r.fromDate || !r.toDate)
      return `Experience ${i + 1}: company, job title, location, from and to dates are required.`;
    if (r.toDate < r.fromDate) return `Experience ${i + 1}: to date must be after from date.`;
  }
  return null;
}

export function EmploymentHistoryTab({ employeeId }: { employeeId: string }) {
  const { data, error, reload } = useResource(`employment-history:${employeeId}`, () => employmentHistoryApi.get(employeeId));
  const saved = useMemo(() => data?.map(toEntry), [data]);

  return (
    <EntryListEditor<EmploymentEntryInput>
      title="Employment History"
      description="Previous employers and positions."
      itemLabel="Experience"
      emptyIcon={<Briefcase />}
      emptyTitle="No employment history yet"
      saved={saved}
      loadError={error}
      onRetry={reload}
      blank={blank}
      validate={validate}
      save={(entries) => employmentHistoryApi.upsert(employeeId, { entries })}
      onSaved={reload}
      renderFields={(row, set) => (
        <FormGrid cols={4}>
          <Field label="Company Name" required span={2}>
            {(id) => <Input id={id} value={row.companyName} placeholder="e.g. Acme Corp" onChange={(e) => set({ companyName: e.target.value })} />}
          </Field>
          <Field label="Job Title" required>
            {(id) => <Input id={id} value={row.jobTitle} placeholder="e.g. Senior Engineer" onChange={(e) => set({ jobTitle: e.target.value })} />}
          </Field>
          <Field label="Location" required>
            {(id) => <Input id={id} value={row.location} placeholder="e.g. Dhaka" onChange={(e) => set({ location: e.target.value })} />}
          </Field>
          <Field label="From Date" required>
            {(id) => <Input id={id} type="date" value={row.fromDate} onChange={(e) => set({ fromDate: e.target.value })} />}
          </Field>
          <Field label="To Date" required>
            {(id) => <Input id={id} type="date" value={row.toDate} onChange={(e) => set({ toDate: e.target.value })} />}
          </Field>
          <Field label="Job Description" span={2}>
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={row.description ?? ""}
                placeholder="Main responsibilities"
                onChange={(e) => set({ description: e.target.value })}
              />
            )}
          </Field>
        </FormGrid>
      )}
    />
  );
}
