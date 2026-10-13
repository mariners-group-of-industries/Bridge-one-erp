"use client";

import { BookOpen } from "lucide-react";
import { useMemo } from "react";
import { useResource } from "@/hooks/use-resource";
import type { AcademicDto, AcademicEntryInput } from "../schemas/academic.schema";
import { academicApi } from "../services/academic.api";
import { EntryListEditor } from "./EntryListEditor";
import { Checkbox, Field, FormGrid, Input } from "./kit";

const blank = (): AcademicEntryInput => ({
  isForeigner: false,
  institute: "",
  degree: "",
  fieldOfStudy: "",
  result: "",
  scale: "",
  startDate: "",
  finishDate: "",
});

const toEntry = (d: AcademicDto): AcademicEntryInput => ({
  isForeigner: d.isForeigner,
  institute: d.institute,
  degree: d.degree,
  fieldOfStudy: d.fieldOfStudy,
  result: d.result,
  scale: d.scale,
  startDate: d.startDate,
  finishDate: d.finishDate,
});

function validate(rows: AcademicEntryInput[]): string | null {
  for (const [i, r] of rows.entries()) {
    if (!r.institute || !r.degree || !r.fieldOfStudy || !r.result || !r.scale || !r.startDate || !r.finishDate)
      return `Education ${i + 1}: all fields are required.`;
    if (r.finishDate < r.startDate) return `Education ${i + 1}: finish date must be after start date.`;
  }
  return null;
}

export function AcademicInfoTab({ employeeId }: { employeeId: string }) {
  const { data, error, reload } = useResource(`academics:${employeeId}`, () => academicApi.get(employeeId));
  const saved = useMemo(() => data?.map(toEntry), [data]);

  return (
    <EntryListEditor<AcademicEntryInput>
      title="Academic Information"
      description="Degrees and certificates, most recent first."
      itemLabel="Education"
      emptyIcon={<BookOpen />}
      emptyTitle="No academic records yet"
      saved={saved}
      loadError={error}
      onRetry={reload}
      blank={blank}
      validate={validate}
      save={(entries) => academicApi.upsert(employeeId, { entries })}
      onSaved={reload}
      renderHeaderExtra={(row, set) => (
        <Checkbox label="Foreign institute" checked={row.isForeigner} onChange={(e) => set({ isForeigner: e.target.checked })} />
      )}
      renderFields={(row, set) => (
        <FormGrid cols={4}>
          <Field label="Institute Name" required span={2}>
            {(id) => <Input id={id} value={row.institute} placeholder="University / college" onChange={(e) => set({ institute: e.target.value })} />}
          </Field>
          <Field label="Degree" required>
            {(id) => <Input id={id} value={row.degree} placeholder="e.g. B.Sc, MBA" onChange={(e) => set({ degree: e.target.value })} />}
          </Field>
          <Field label="Field of Study" required>
            {(id) => <Input id={id} value={row.fieldOfStudy} placeholder="e.g. Computer Science" onChange={(e) => set({ fieldOfStudy: e.target.value })} />}
          </Field>
          <Field label="Result / CGPA / Division" required>
            {(id) => <Input id={id} value={row.result} placeholder="e.g. 3.75" onChange={(e) => set({ result: e.target.value })} />}
          </Field>
          <Field label="Scale (Out of)" required>
            {(id) => <Input id={id} value={row.scale} placeholder="e.g. 4.00" onChange={(e) => set({ scale: e.target.value })} />}
          </Field>
          <Field label="Start Date" required>
            {(id) => <Input id={id} type="date" value={row.startDate} onChange={(e) => set({ startDate: e.target.value })} />}
          </Field>
          <Field label="Finish Date" required>
            {(id) => <Input id={id} type="date" value={row.finishDate} onChange={(e) => set({ finishDate: e.target.value })} />}
          </Field>
        </FormGrid>
      )}
    />
  );
}
