"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useValidatedForm } from "../hooks/use-validated-form";
import { officeInputSchema } from "../schemas/office.schema";
import { officeApi } from "../services/company-profile.api";
import type { OfficeDto } from "../types";

interface OfficeFormProps {
  businessUnitId: string;
  office?: OfficeDto;
  onClose: () => void;
  onSaved: (office: OfficeDto) => void;
}

/** Create/edit dialog for an office. Mount only while open. */
export function OfficeForm({ businessUnitId, office, onClose, onSaved }: OfficeFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const form = useValidatedForm(officeInputSchema, {
    name: office?.name ?? "",
    address: office?.address ?? "",
    email: office?.email ?? "",
    phone: office?.phone ?? "",
    binNumber: office?.binNumber ?? "",
  });

  async function submit() {
    if (inFlight.current) return;
    const input = form.validate();
    if (!input) return;

    inFlight.current = true;
    setSaving(true);
    try {
      const saved = office
        ? await officeApi.update(office.id, input)
        : await officeApi.create(businessUnitId, input);
      toast.success(office ? "Office updated." : "Office added.");
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
      title={office ? `Edit ${office.name}` : "Add office"}
      description={office ? undefined : "Branding files can be uploaded after the office is created."}
      onClose={saving ? () => undefined : onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {office ? "Save changes" : "Add office"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Office name"
          required
          maxLength={150}
          autoFocus
          placeholder="e.g. Head Office"
          className="sm:col-span-2"
          value={form.values.name}
          error={form.errors.name}
          onChange={(event) => form.setField("name", event.target.value)}
        />
        <TextAreaField
          label="Office address"
          required
          maxLength={500}
          rows={2}
          className="sm:col-span-2"
          value={form.values.address}
          error={form.errors.address}
          onChange={(event) => form.setField("address", event.target.value)}
        />
        <TextField
          label="Office email"
          type="email"
          maxLength={254}
          value={form.values.email ?? ""}
          error={form.errors.email}
          onChange={(event) => form.setField("email", event.target.value)}
        />
        <TextField
          label="Office phone"
          type="tel"
          maxLength={30}
          value={form.values.phone ?? ""}
          error={form.errors.phone}
          onChange={(event) => form.setField("phone", event.target.value)}
        />
        <TextField
          label="BIN number"
          maxLength={30}
          hint="Business Identification Number printed on documents."
          value={form.values.binNumber ?? ""}
          error={form.errors.binNumber}
          onChange={(event) => form.setField("binNumber", event.target.value)}
        />
      </div>
    </Dialog>
  );
}
