"use client";

import { TextAreaField, TextField } from "@/components/ui/form-field";
import type { ValidatedForm } from "@/hooks/use-validated-form";
import type { OfficeData, OfficeInput } from "../schemas/office.schema";
import type { OfficeDto } from "../types";

export type OfficeForm = ValidatedForm<OfficeInput, OfficeData>;

export function officeValues(office?: OfficeDto) {
  return {
    name: office?.name ?? "",
    address: office?.address ?? "",
    email: office?.email ?? "",
    phone: office?.phone ?? "",
    binNumber: office?.binNumber ?? "",
  };
}

/** Office fields, shared by the quick entry dialog and the office form view. */
export function OfficeFields({ form, autoFocus }: { form: OfficeForm; autoFocus?: boolean }) {
  return (
    <>
      <TextField
        label="Office Name"
        required
        maxLength={150}
        autoFocus={autoFocus}
        placeholder="e.g. Head Office"
        value={form.values.name}
        error={form.errors.name}
        onChange={(event) => form.setField("name", event.target.value)}
      />
      <TextField
        label="BIN Number"
        maxLength={30}
        hint="Business Identification Number printed on documents."
        value={form.values.binNumber ?? ""}
        error={form.errors.binNumber}
        onChange={(event) => form.setField("binNumber", event.target.value)}
      />
      <TextField
        label="Email"
        type="email"
        maxLength={254}
        value={form.values.email ?? ""}
        error={form.errors.email}
        onChange={(event) => form.setField("email", event.target.value)}
      />
      <TextField
        label="Phone"
        type="tel"
        maxLength={30}
        value={form.values.phone ?? ""}
        error={form.errors.phone}
        onChange={(event) => form.setField("phone", event.target.value)}
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
