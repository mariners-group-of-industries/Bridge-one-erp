"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { RecordMeta } from "@/components/layout/record-meta";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, ErrorState, FieldGrid, LoadingState, Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { errorMessage } from "@/lib/api/client";
import { paths } from "../paths";
import { companyInputSchema, type CompanyInput } from "../schemas/company.schema";
import { businessUnitApi, companyApi } from "../services/company-profile.api";
import type { CompanyDto } from "../types";

const TABS = [
  { id: "details", label: "Details" },
  { id: "connections", label: "Connections" },
] as const;

const companyValues = (company: CompanyDto | null): CompanyInput => ({
  name: company?.name ?? "",
  address: company?.address ?? "",
  email: company?.email ?? "",
});

/** Single-record form (ERPNext "Single" doctype) for the company profile. */
export function CompanyProfileView() {
  const company = useResource("company", companyApi.get);

  if (company.error) {
    return (
      <PageContainer>
        <PageHead title="Company Profile" />
        <Card>
          <ErrorState message={company.error.message} onRetry={company.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (company.data === undefined) {
    return (
      <PageContainer>
        <PageHead title="Company Profile" />
        <Card>
          <LoadingState />
        </Card>
      </PageContainer>
    );
  }
  return <CompanyForm company={company.data} onSaved={(saved) => company.mutate(() => saved)} />;
}

function CompanyForm({ company, onSaved }: { company: CompanyDto | null; onSaved: (company: CompanyDto) => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("details");
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const form = useValidatedForm(companyInputSchema, companyValues(company));
  const isNew = company === null;

  async function save() {
    if (inFlight.current) return;
    const input = form.validate();
    if (!input) {
      setTab("details");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    try {
      const saved = await companyApi.save(input);
      form.reset(companyValues(saved));
      onSaved(saved);
      toast.success(isNew ? "Company profile created." : "Saved.");
    } catch (error) {
      if (form.applyServerError(error)) setTab("details");
      else toast.error(errorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  useSaveShortcut(() => void save(), isNew || form.dirty);

  return (
    <PageContainer>
      <PageHead
        title={company?.name || "Company Profile"}
        subtitle={company ? "Company Profile" : "Set up your company to start configuring BridgeOne."}
        indicator={(isNew || form.dirty) && <Indicator color="orange">Not Saved</Indicator>}
        actions={
          <Button variant="primary" loading={saving} disabled={!isNew && !form.dirty} onClick={save}>
            Save
          </Button>
        }
      />
      <Card>
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Company profile sections">
          {tab === "details" ? (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <Section title="Company Details" description="Legal identity used across all business units and documents.">
                <FieldGrid>
                  <TextField
                    label="Company Name"
                    required
                    maxLength={150}
                    autoComplete="organization"
                    value={form.values.name}
                    error={form.errors.name}
                    onChange={(event) => form.setField("name", event.target.value)}
                  />
                  <TextField
                    label="Contact Email"
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={form.values.email}
                    error={form.errors.email}
                    onChange={(event) => form.setField("email", event.target.value)}
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
                </FieldGrid>
              </Section>
              {/* Lets Enter in a text field submit the form. */}
              <button type="submit" hidden />
            </form>
          ) : (
            <Connections companyId={company?.id ?? null} />
          )}
        </Tabs>
      </Card>
      {company && <RecordMeta updatedAt={company.updatedAt} />}
    </PageContainer>
  );
}

/** ERPNext "Connections" tab: records linked to this company. */
function Connections({ companyId }: { companyId: string | null }) {
  const units = useResource(companyId && `business-units:${companyId}`, businessUnitApi.list);

  if (!companyId) {
    return <p className="px-5 py-8 text-center text-sm text-ink-faint">Save the company profile to add business units.</p>;
  }

  return (
    <Section title="Organisation">
      <Link
        href={paths.businessUnits}
        className="flex max-w-md items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-canvas focus-visible:outline-2"
      >
        <span className="flex-1">Business Units</span>
        <span className="rounded-full bg-control px-1.5 text-xs text-ink-muted tabular-nums">
          {units.data ? units.data.length : "…"}
        </span>
        <ChevronRight aria-hidden="true" className="size-4 text-ink-faint" />
      </Link>
      {units.error && <p className="text-sm text-danger">{units.error.message}</p>}
    </Section>
  );
}
