"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldGrid } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { errorMessage } from "@/lib/api/client";
import { officeInputSchema } from "../schemas/office.schema";
import { officeApi } from "../services/company-profile.api";
import type { OfficeDto } from "../types";
import { OfficeFields, officeValues } from "./OfficeFields";

interface OfficeQuickEntryProps {
  businessUnitId: string;
  onClose: () => void;
  onCreated: (office: OfficeDto) => void;
}

/** Quick entry dialog for a new office. Mount only while open. */
export function OfficeQuickEntry({ businessUnitId, onClose, onCreated }: OfficeQuickEntryProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const form = useValidatedForm(officeInputSchema, officeValues());

  async function submit() {
    if (inFlight.current) return;
    const input = form.validate();
    if (!input) return;

    inFlight.current = true;
    setSaving(true);
    try {
      const created = await officeApi.create(businessUnitId, input);
      toast.success(`Office "${created.name}" created.`);
      onCreated(created);
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
      title="New Office"
      description="Branding files and warehouses can be added after saving."
      onClose={saving ? () => undefined : onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <FieldGrid>
        <OfficeFields form={form} autoFocus />
      </FieldGrid>
    </Dialog>
  );
}
