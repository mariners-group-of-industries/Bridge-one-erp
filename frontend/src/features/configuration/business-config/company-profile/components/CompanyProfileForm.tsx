"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useValidatedForm } from "../hooks/use-validated-form";
import { companyInputSchema } from "../schemas/company.schema";
import { companyApi } from "../services/company-profile.api";
import type { CompanyDto } from "../types";

interface CompanyProfileFormProps {
  company: CompanyDto | null;
  onSaved: (company: CompanyDto) => void;
}

export function CompanyProfileForm({ company, onSaved }: CompanyProfileFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const form = useValidatedForm(companyInputSchema, {
    name: company?.name ?? "",
    address: company?.address ?? "",
    email: company?.email ?? "",
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const input = form.validate();
    if (!input) return;

    inFlight.current = true;
    setSaving(true);
    try {
      const saved = await companyApi.save(input);
      onSaved(saved);
      toast.success(company ? "Company profile updated." : "Company profile created.");
    } catch (error) {
      if (!form.applyServerError(error)) toast.error(errorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <TextField
        label="Company name"
        required
        maxLength={150}
        autoComplete="organization"
        value={form.values.name}
        error={form.errors.name}
        onChange={(event) => form.setField("name", event.target.value)}
      />
      <TextField
        label="Contact email"
        required
        type="email"
        maxLength={254}
        autoComplete="email"
        value={form.values.email}
        error={form.errors.email}
        onChange={(event) => form.setField("email", event.target.value)}
      />
      <TextAreaField
        label="Company address"
        required
        maxLength={500}
        rows={3}
        className="md:col-span-2"
        value={form.values.address}
        error={form.errors.address}
        onChange={(event) => form.setField("address", event.target.value)}
      />
      <div className="flex items-center justify-end gap-3 md:col-span-2">
        {company && (
          <p className="mr-auto text-xs text-zinc-500">
            Last updated {new Date(company.updatedAt).toLocaleString()}
          </p>
        )}
        <Button type="submit" loading={saving}>
          {company ? "Save changes" : "Create company profile"}
        </Button>
      </div>
    </form>
  );
}
