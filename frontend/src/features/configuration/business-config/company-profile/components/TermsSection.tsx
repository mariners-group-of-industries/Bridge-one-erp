"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { EmptyState, Section } from "@/components/ui/section";
import type { TermsDomain } from "../schemas/terms.schema";
import type { BusinessUnitDto } from "../types";
import { TermsConditionsTable } from "./TermsConditionsTable";

interface Props {
  units: BusinessUnitDto[];
  domain: TermsDomain;
}

export function TermsSection({ units, domain }: Props) {
  const [selectedId, setSelectedId] = useState<string>(units[0]?.id ?? "");
  const selected = units.find((u) => u.id === selectedId) ?? units[0] ?? null;

  const label = domain === "SALES" ? "Sales" : "Purchase";

  if (units.length === 0) {
    return (
      <Section>
        <EmptyState icon={<Building2 />} title="No business units yet">
          Add a business unit first to manage its {label.toLowerCase()} terms.
        </EmptyState>
      </Section>
    );
  }

  return (
    <Section
      title={`${label} Terms & Conditions`}
      description={`${label} terms printed on documents for each business unit.`}
    >
      {units.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {units.map((unit) => (
            <button
              key={unit.id}
              type="button"
              onClick={() => setSelectedId(unit.id)}
              className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                unit.id === (selected?.id ?? "")
                  ? "border-ink bg-ink text-surface"
                  : "border-line bg-surface text-ink hover:bg-control"
              }`}
            >
              {unit.name}
            </button>
          ))}
        </div>
      )}
      {selected && <TermsConditionsTable businessUnitId={selected.id} domain={domain} />}
    </Section>
  );
}
