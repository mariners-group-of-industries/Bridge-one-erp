"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useValidatedForm } from "../hooks/use-validated-form";
import {
  businessUnitInputSchema,
  DATE_FORMAT_LABELS,
  DATE_FORMATS,
  type DateFormat,
} from "../schemas/business-unit.schema";
import { businessUnitApi } from "../services/company-profile.api";
import type { BusinessUnitDto } from "../types";

const DATE_FORMAT_OPTIONS = DATE_FORMATS.map((value) => ({ value, label: DATE_FORMAT_LABELS[value] }));

interface BusinessUnitFormProps {
  /** Unit to edit; omit to create a new one. */
  businessUnit?: BusinessUnitDto;
  onClose: () => void;
  onSaved: (unit: BusinessUnitDto) => void;
}

/** Create/edit dialog. Mount it only while open so each opening starts fresh. */
export function BusinessUnitForm({ businessUnit, onClose, onSaved }: BusinessUnitFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const form = useValidatedForm(businessUnitInputSchema, {
    name: businessUnit?.name ?? "",
    address: businessUnit?.address ?? "",
    contactNumber: businessUnit?.contactNumber ?? "",
    email: businessUnit?.email ?? "",
    dateFormat: businessUnit?.dateFormat ?? "DD_MM_YYYY_SLASH",
  });

  async function submit() {
    if (inFlight.current) return;
    const input = form.validate();
    if (!input) return;

    inFlight.current = true;
    setSaving(true);
    try {
      const saved = businessUnit
        ? await businessUnitApi.update(businessUnit.id, input)
        : await businessUnitApi.create(input);
      toast.success(businessUnit ? "Business unit updated." : "Business unit added.");
      onSaved(saved);
    } catch (error) {
      if (!form.applyServerError(error)) toast.error(errorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      size="lg"
      title={businessUnit ? `Edit ${businessUnit.name}` : "Add business unit"}
      onClose={saving ? () => undefined : onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {businessUnit ? "Save changes" : "Add business unit"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Business unit name"
          required
          maxLength={150}
          autoFocus
          className="sm:col-span-2"
          value={form.values.name}
          error={form.errors.name}
          onChange={(event) => form.setField("name", event.target.value)}
        />
        <TextAreaField
          label="Business unit address"
          required
          maxLength={500}
          rows={2}
          className="sm:col-span-2"
          value={form.values.address}
          error={form.errors.address}
          onChange={(event) => form.setField("address", event.target.value)}
        />
        <TextField
          label="Contact number"
          required
          type="tel"
          maxLength={30}
          value={form.values.contactNumber}
          error={form.errors.contactNumber}
          onChange={(event) => form.setField("contactNumber", event.target.value)}
        />
        <TextField
          label="Business unit email"
          required
          type="email"
          maxLength={254}
          value={form.values.email}
          error={form.errors.email}
          onChange={(event) => form.setField("email", event.target.value)}
        />
        <SelectField
          label="Date format"
          required
          options={DATE_FORMAT_OPTIONS}
          hint="Used when printing dates on this unit's documents."
          value={form.values.dateFormat}
          error={form.errors.dateFormat}
          onChange={(event) => form.setField("dateFormat", event.target.value as DateFormat)}
        />
      </div>
    </Dialog>
  );
}
