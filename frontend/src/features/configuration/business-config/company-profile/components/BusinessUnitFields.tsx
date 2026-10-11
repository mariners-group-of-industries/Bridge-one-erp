"use client";

import { SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import type { ValidatedForm } from "@/hooks/use-validated-form";
import {
  DATE_FORMAT_LABELS,
  DATE_FORMATS,
  type BusinessUnitInput,
  type DateFormat,
} from "../schemas/business-unit.schema";
import type { BusinessUnitDto } from "../types";

const DATE_FORMAT_OPTIONS = DATE_FORMATS.map((value) => ({ value, label: DATE_FORMAT_LABELS[value] }));

export type BusinessUnitForm = ValidatedForm<BusinessUnitInput, BusinessUnitInput>;

export function businessUnitValues(unit?: BusinessUnitDto): BusinessUnitInput {
  return {
    name: unit?.name ?? "",
    address: unit?.address ?? "",
    contactNumber: unit?.contactNumber ?? "",
    email: unit?.email ?? "",
    dateFormat: unit?.dateFormat ?? "DD_MM_YYYY_SLASH",
  };
}

/** Business unit fields, shared by the quick entry dialog and the form view. */
export function BusinessUnitFields({ form, autoFocus }: { form: BusinessUnitForm; autoFocus?: boolean }) {
  return (
    <>
      <TextField
        label="Business Unit Name"
        required
        maxLength={150}
        autoFocus={autoFocus}
        value={form.values.name}
        error={form.errors.name}
        onChange={(event) => form.setField("name", event.target.value)}
      />
      <TextField
        label="Email"
        required
        type="email"
        maxLength={254}
        value={form.values.email}
        error={form.errors.email}
        onChange={(event) => form.setField("email", event.target.value)}
      />
      <TextField
        label="Contact Number"
        required
        type="tel"
        maxLength={30}
        value={form.values.contactNumber}
        error={form.errors.contactNumber}
        onChange={(event) => form.setField("contactNumber", event.target.value)}
      />
      <SelectField
        label="Date Format"
        required
        options={DATE_FORMAT_OPTIONS}
        hint="Used when printing dates on this unit's documents."
        value={form.values.dateFormat}
        error={form.errors.dateFormat}
        onChange={(event) => form.setField("dateFormat", event.target.value as DateFormat)}
      />
      <TextAreaField
        label="Address"
        required
        maxLength={500}
        rows={3}
        className="md:col-span-2"
        value={form.values.address}
        error={form.errors.address}
        onChange={(event) => form.setField("address", event.target.value)}
      />
    </>
  );
}
