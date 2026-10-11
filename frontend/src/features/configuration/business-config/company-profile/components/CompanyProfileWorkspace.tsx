"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form-field";
import { EmptyState, ErrorState, LoadingState, Section } from "@/components/ui/section";
import { ToastProvider } from "@/components/ui/toast";
import { useResource } from "../hooks/use-resource";
import { businessUnitApi, companyApi } from "../services/company-profile.api";
import { BusinessUnitList } from "./BusinessUnitList";
import { CompanyProfileForm } from "./CompanyProfileForm";
import { OfficeAccordion } from "./OfficeAccordion";
import { TermsConditionsTable } from "./TermsConditionsTable";

const NAV = [
  { id: "company", label: "Company" },
  { id: "business-units", label: "Business Units" },
  { id: "offices", label: "Offices & Warehouses" },
  { id: "sales-terms", label: "Sales Terms" },
  { id: "purchase-terms", label: "Purchase Terms" },
];

export function CompanyProfileWorkspace() {
  return (
    <ToastProvider>
      <Workspace />
    </ToastProvider>
  );
}

function Workspace() {
  const company = useResource("company", companyApi.get);
  const companyId = company.data?.id ?? null;
  const units = useResource(companyId && `business-units:${companyId}`, businessUnitApi.list);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const [addingOffice, setAddingOffice] = useState(false);

  const unitList = units.data ?? [];
  const activeUnit = unitList.find((unit) => unit.id === selectedId) ?? unitList[0] ?? null;

  if (company.error) {
    return <ErrorState message={company.error.message} onRetry={company.reload} />;
  }
  if (company.data === undefined) return <LoadingState label="Loading company profile…" />;

  const unitScoped = (render: (businessUnitId: string) => React.ReactNode) => {
    if (!companyId) return <EmptyState title="Save the company profile first." />;
    if (units.error) return <ErrorState message={units.error.message} onRetry={units.reload} />;
    if (!units.data) return <LoadingState />;
    if (!activeUnit) return <EmptyState title="Add a business unit first." />;
    return render(activeUnit.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Company profile sections" className="-mx-1 overflow-x-auto">
        <ul className="flex gap-1 px-1 text-sm">
          {NAV.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="block whitespace-nowrap rounded-full px-3 py-1.5 text-zinc-700 hover:bg-white hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section
        id="company"
        title="Company Profile"
        description="Legal identity used across all business units and documents."
      >
        <CompanyProfileForm
          key={company.data?.id ?? "new"}
          company={company.data}
          onSaved={(saved) => company.mutate(() => saved)}
        />
      </Section>

      <Section
        id="business-units"
        title="Business Unit Information"
        description="Each business unit has its own offices, warehouses and document terms."
        actions={
          companyId && (
            <Button onClick={() => setAddingUnit(true)} disabled={!units.data}>
              + Add business unit
            </Button>
          )
        }
      >
        {!companyId ? (
          <EmptyState title="Save the company profile first">
            Business units are created under your company.
          </EmptyState>
        ) : units.error ? (
          <ErrorState message={units.error.message} onRetry={units.reload} />
        ) : !units.data ? (
          <LoadingState label="Loading business units…" />
        ) : (
          <BusinessUnitList
            units={unitList}
            selectedId={activeUnit?.id ?? null}
            onSelect={setSelectedId}
            onChanged={units.reload}
            adding={addingUnit}
            onAddingChange={setAddingUnit}
          />
        )}
      </Section>

      {activeUnit && unitList.length > 1 && (
        <div className="sticky top-0 z-10 -mx-4 border-y border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <SelectField
            label="Configuring business unit"
            className="max-w-sm"
            options={unitList.map((unit) => ({ value: unit.id, label: unit.name }))}
            value={activeUnit.id}
            onChange={(event) => setSelectedId(event.target.value)}
          />
        </div>
      )}

      <Section
        id="offices"
        title="Office & Warehouse Management"
        description={
          activeUnit
            ? `Offices of ${activeUnit.name}. Expand an office to manage its branding and warehouses.`
            : "Offices and their warehouses, per business unit."
        }
        actions={activeUnit && <Button onClick={() => setAddingOffice(true)}>+ Add office</Button>}
      >
        {unitScoped((businessUnitId) => (
          <OfficeAccordion
            key={businessUnitId}
            businessUnitId={businessUnitId}
            adding={addingOffice}
            onAddingChange={setAddingOffice}
            onOfficeCountChange={units.reload}
          />
        ))}
      </Section>

      <Section
        id="sales-terms"
        title="Sales Terms & Conditions / Payment Instructions"
        description="Choose which sales documents each term is printed on. Default terms are pre-selected on new documents."
      >
        {unitScoped((businessUnitId) => (
          <TermsConditionsTable key={businessUnitId} businessUnitId={businessUnitId} domain="SALES" />
        ))}
      </Section>

      <Section
        id="purchase-terms"
        title="Purchase Terms & Conditions"
        description="Choose which purchase documents each term is printed on."
      >
        {unitScoped((businessUnitId) => (
          <TermsConditionsTable key={businessUnitId} businessUnitId={businessUnitId} domain="PURCHASE" />
        ))}
      </Section>
    </div>
  );
}
