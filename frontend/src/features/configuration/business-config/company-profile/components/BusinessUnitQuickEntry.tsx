"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldGrid } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { errorMessage } from "@/lib/api/client";
import { businessUnitInputSchema } from "../schemas/business-unit.schema";
import { businessUnitApi } from "../services/company-profile.api";
import type { BusinessUnitDto } from "../types";
import { BusinessUnitFields, businessUnitValues } from "./BusinessUnitFields";

interface BusinessUnitQuickEntryProps {
  onClose: () => void;
  onCreated: (unit: BusinessUnitDto) => void;
}

/** ERPNext "quick entry" dialog for a new business unit. Mount only while open. */
export function BusinessUnitQuickEntry({ onClose, onCreated }: BusinessUnitQuickEntryProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const form = useValidatedForm(businessUnitInputSchema, businessUnitValues());

  async function submit() {
    if (inFlight.current) return;
    const input = form.validate();
    if (!input) return;

    inFlight.current = true;
    setSaving(true);
    try {
      const created = await businessUnitApi.create(input);
      toast.success(`Business unit "${created.name}" created.`);
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
      title="New Business Unit"
      description="Offices, warehouses and terms can be added after saving."
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
        <BusinessUnitFields form={form} autoFocus />
      </FieldGrid>
    </Dialog>
  );
}
