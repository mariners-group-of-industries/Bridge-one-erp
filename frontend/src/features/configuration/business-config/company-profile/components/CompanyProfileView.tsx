"use client";

import { Building, Building2, FileText, Network, Warehouse } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { PageHead } from "@/components/layout/page";
import { RecordMeta } from "@/components/layout/record-meta";
import { Button } from "@/components/ui/button";
import { Indicator } from "@/components/ui/indicator";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { companyInputSchema, type CompanyInput } from "../schemas/company.schema";
import type { TermsDomain } from "../schemas/terms.schema";
import { businessUnitApi, companyApi } from "../services/company-profile.api";
import type { BusinessUnitDto, CompanyDto } from "../types";
import { BusinessUnitListSection } from "./BusinessUnitListSection";
import { OfficesWarehousesSection } from "./OfficesWarehousesSection";
import { PanelPlaceholder, ProfilePanel } from "./ProfilePanel";
import { TermsConditionsTable } from "./TermsConditionsTable";

const companyValues = (company: CompanyDto | null): CompanyInput => ({
  name: company?.name ?? "",
  address: company?.address ?? "",
  email: company?.email ?? "",
});

const SECTIONS = [
  { id: "company-info", label: "Company Information" },
  { id: "business-units", label: "Business Units" },
  { id: "offices", label: "Offices & Warehouses" },
  { id: "terms", label: "Terms & Conditions" },
] as const;

/** White full-height page surface; this page uses white instead of the grey canvas. */
function ProfileSurface({ children }: { children: ReactNode }) {
  return <div className="min-h-[calc(100dvh-3.5rem)] bg-surface">{children}</div>;
}

const HEAD_CLASS = "border-b border-line bg-surface";

export function CompanyProfileView() {
  const company = useResource("company", companyApi.get);

  if (company.error || company.data === undefined) {
    return (
      <ProfileSurface>
        <div className="w-full px-4 pb-10 sm:px-6">
          <PageHead title="Company Profile" className={HEAD_CLASS} />
          <div className="rounded border border-line">
            {company.error ? <ErrorState message={company.error.message} onRetry={company.reload} /> : <LoadingState />}
          </div>
        </div>
      </ProfileSurface>
    );
  }
  return <CompanyProfileForm company={company.data} onSaved={(saved) => company.mutate(() => saved)} />;
}

function CompanyProfileForm({
  company,
  onSaved,
}: {
  company: CompanyDto | null;
  onSaved: (company: CompanyDto) => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const form = useValidatedForm(companyInputSchema, companyValues(company));
  const isNew = company === null;

  const units = useResource(company ? `business-units:${company.id}` : null, businessUnitApi.list);

  async function save() {
    if (inFlight.current) return;
    const input = form.validate();
    if (!input) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const saved = await companyApi.save(input);
      form.reset(companyValues(saved));
      onSaved(saved);
      toast.success(isNew ? "Company profile created." : "Saved.");
    } catch (error) {
      if (!form.applyServerError(error)) toast.error(errorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  useSaveShortcut(() => void save(), isNew || form.dirty);

  const name = company?.name || "Company Profile";
  const unitCount = units.data?.length;

  return (
    <ProfileSurface>
      <div className="w-full px-4 pb-10 sm:px-6">
        <PageHead
          className={HEAD_CLASS}
          title={
            <span className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded bg-accent-strong text-base font-semibold text-white"
              >
                {name.trim().charAt(0).toUpperCase() || "C"}
              </span>
              <span className="truncate">{name}</span>
            </span>
          }
          subtitle="Company setup, business units, offices, warehouses and document terms."
          indicator={(isNew || form.dirty) && <Indicator color="orange">Not Saved</Indicator>}
          actions={
            <Button variant="accent" loading={saving} disabled={!isNew && !form.dirty} onClick={save}>
              Save
            </Button>
          }
        />

        <nav aria-label="Company profile sections" className="mb-5 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 text-xs font-medium text-accent-strong transition-colors hover:border-accent hover:bg-surface focus-visible:outline-2 dark:text-accent"
            >
              {section.label}
              {section.id === "business-units" && unitCount !== undefined && (
                <span className="rounded-full bg-accent-strong px-1.5 text-[10px] leading-4 text-white">{unitCount}</span>
              )}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ProfilePanel
              id="company-info"
              icon={<Building />}
              title="Company Information"
              description="Legal identity used across all business units and documents."
            >
              {company ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InfoRow label="Company Name" value={company.name} />
                  <InfoRow label="Company Mail" value={company.email} />
                  <div className="sm:col-span-2">
                    <InfoRow label="Company Address" value={company.address} />
                  </div>
                </div>
              ) : (
                <PanelPlaceholder>No company profile saved yet.</PanelPlaceholder>
              )}
            </ProfilePanel>

            <ProfilePanel
              id="business-units"
              icon={<Network />}
              title="Business Units"
              description="Business units that belong to this company."
            >
              {company ? (
                <BusinessUnitListSection
                  company={company}
                  units={units.data ?? null}
                  loading={units.data === undefined && !units.error}
                  error={units.error?.message}
                  onReload={units.reload}
                  onUnitsChange={(next) => units.mutate(() => next)}
                />
              ) : (
                <PanelPlaceholder>Save the company profile first to manage business units.</PanelPlaceholder>
              )}
            </ProfilePanel>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ProfilePanel
              id="offices"
              icon={<Warehouse />}
              title="Offices & Warehouses"
              description="Offices and warehouses grouped by business unit."
            >
              {company ? (
                <OfficesWarehousesSection units={units.data ?? []} />
              ) : (
                <PanelPlaceholder>Save the company profile first to manage offices and warehouses.</PanelPlaceholder>
              )}
            </ProfilePanel>

            <ProfilePanel
              id="terms"
              icon={<FileText />}
              title="Terms & Conditions"
              description="Terms printed on sales and purchase documents. Tick the documents each term applies to."
              flush
            >
              {company && units.data?.length ? (
                <TermsPanel units={units.data} />
              ) : (
                <div className="px-5 py-5">
                  <PanelPlaceholder>
                    {company
                      ? "Add a business unit first to manage document terms."
                      : "Save the company profile first to manage document terms."}
                  </PanelPlaceholder>
                </div>
              )}
            </ProfilePanel>
          </div>
        </div>

        {company && <RecordMeta updatedAt={company.updatedAt} />}
      </div>
    </ProfileSurface>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ink-faint">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

const TERM_TABS = [
  { id: "SALES", label: "Sales Terms" },
  { id: "PURCHASE", label: "Purchase Terms" },
] as const satisfies readonly { id: TermsDomain; label: string }[];

function TermsPanel({ units }: { units: BusinessUnitDto[] }) {
  const [domain, setDomain] = useState<TermsDomain>("SALES");
  const [unitId, setUnitId] = useState(units[0].id);
  const unit = units.find((item) => item.id === unitId) ?? units[0];

  return (
    <Tabs tabs={TERM_TABS} value={domain} onChange={setDomain} label="Terms domain" tone="accent" className="overflow-y-hidden pt-1">
      <div className="flex flex-col gap-4 px-5 py-5">
        {units.length > 1 && (
          <div role="group" aria-label="Business unit" className="flex flex-wrap items-center gap-2">
            <Building2 aria-hidden="true" className="size-4 text-ink-faint" />
            {units.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === unit.id}
                onClick={() => setUnitId(item.id)}
                className={cn(
                  "h-7 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2",
                  item.id === unit.id
                    ? "border-accent-strong bg-accent-strong text-white"
                    : "border-line bg-surface text-ink-muted hover:border-accent-line hover:text-ink",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
        <TermsConditionsTable key={`${unit.id}:${domain}`} businessUnitId={unit.id} domain={domain} />
      </div>
    </Tabs>
  );
}
