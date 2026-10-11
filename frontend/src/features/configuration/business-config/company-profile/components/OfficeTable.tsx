"use client";

import { Plus, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { paths } from "../paths";
import { officeApi } from "../services/company-profile.api";
import type { OfficeDto } from "../types";
import { OfficeQuickEntry } from "./OfficeQuickEntry";

const COLUMNS: Column<OfficeDto>[] = [
  {
    id: "name",
    header: "Office",
    sortValue: (office) => office.name,
    cell: (office) => (
      <Link href={paths.office(office.id)} className="font-medium text-ink hover:underline">
        {office.name}
      </Link>
    ),
  },
  { id: "phone", header: "Phone", cell: (office) => office.phone ?? "—", hideBelow: "md" },
  { id: "email", header: "Email", cell: (office) => office.email ?? "—", hideBelow: "lg" },
  { id: "bin", header: "BIN", cell: (office) => office.binNumber ?? "—", hideBelow: "lg" },
  {
    id: "warehouses",
    header: "Warehouses",
    sortValue: (office) => office.warehouseCount,
    cell: (office) => office.warehouseCount,
    className: "text-right tabular-nums",
  },
];

interface OfficeTableProps {
  businessUnitId: string;
  onOfficeCountChange: () => void;
}

/** Offices of a business unit (the "Offices" tab of the business unit form). */
export function OfficeTable({ businessUnitId, onOfficeCountChange }: OfficeTableProps) {
  const router = useRouter();
  const offices = useResource(`offices:${businessUnitId}`, () => officeApi.list(businessUnitId));
  const [adding, setAdding] = useState(false);

  let body: React.ReactNode;
  if (offices.error) body = <ErrorState message={offices.error.message} onRetry={offices.reload} />;
  else if (!offices.data) body = <LoadingState />;
  else {
    body = (
      <DataTable
        rows={offices.data}
        columns={COLUMNS}
        getRowId={(office) => office.id}
        getRowLabel={(office) => office.name}
        rowHref={(office) => paths.office(office.id)}
        modifiedAt={(office) => office.updatedAt}
        search={{
          placeholder: "Search offices",
          match: (office, query) => `${office.name} ${office.email ?? ""}`.toLowerCase().includes(query),
        }}
        emptyState={
          <EmptyState icon={<Store />} title="No offices yet">
            Add a head office, regional office or branch to this business unit.
          </EmptyState>
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <p className="text-sm text-ink-faint">Open an office to manage its branding and warehouses.</p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus /> Add Office
        </Button>
      </div>
      {body}

      {adding && (
        <OfficeQuickEntry
          businessUnitId={businessUnitId}
          onClose={() => setAdding(false)}
          onCreated={(office) => {
            setAdding(false);
            onOfficeCountChange();
            router.push(paths.office(office.id));
          }}
        />
      )}
    </div>
  );
}
