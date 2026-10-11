"use client";

import { Building2, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { paths } from "../paths";
import { DATE_FORMAT_LABELS } from "../schemas/business-unit.schema";
import { businessUnitApi, companyApi } from "../services/company-profile.api";
import type { BusinessUnitDto } from "../types";
import { BusinessUnitQuickEntry } from "./BusinessUnitQuickEntry";

const COLUMNS: Column<BusinessUnitDto>[] = [
  {
    id: "name",
    header: "Business Unit",
    sortValue: (unit) => unit.name,
    cell: (unit) => (
      <Link href={paths.businessUnit(unit.id)} className="font-medium text-ink hover:underline">
        {unit.name}
      </Link>
    ),
  },
  { id: "email", header: "Email", sortValue: (unit) => unit.email, cell: (unit) => unit.email, hideBelow: "md" },
  { id: "contact", header: "Contact Number", cell: (unit) => unit.contactNumber, hideBelow: "lg" },
  { id: "dateFormat", header: "Date Format", cell: (unit) => DATE_FORMAT_LABELS[unit.dateFormat], hideBelow: "lg" },
  {
    id: "offices",
    header: "Offices",
    sortValue: (unit) => unit.officeCount,
    cell: (unit) => unit.officeCount,
    className: "text-right tabular-nums",
  },
];

/** ERPNext list view for business units. */
export function BusinessUnitListView() {
  const router = useRouter();
  const toast = useToast();
  const company = useResource("company", companyApi.get);
  const units = useResource(company.data ? `business-units:${company.data.id}` : null, businessUnitApi.list);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<{ rows: BusinessUnitDto[]; done: () => void } | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    let deleted = 0;
    for (const unit of deleting.rows) {
      try {
        await businessUnitApi.remove(unit.id);
        deleted++;
      } catch (error) {
        toast.error(`${unit.name}: ${errorMessage(error)}`);
      }
    }
    if (deleted > 0) toast.success(`Deleted ${deleted} business unit${deleted === 1 ? "" : "s"}.`);
    deleting.done();
    setDeleting(null);
    setBusy(false);
    units.reload();
  }

  let body: React.ReactNode;
  if (company.error) body = <ErrorState message={company.error.message} onRetry={company.reload} />;
  else if (company.data === undefined) body = <LoadingState />;
  else if (company.data === null) {
    body = (
      <EmptyState icon={<Building2 />} title="Set up your company first">
        <p className="mb-3">Business units are created under the company profile.</p>
        <Link href={paths.companyProfile} className={buttonClasses("primary")}>
          Set up company profile
        </Link>
      </EmptyState>
    );
  } else if (units.error) body = <ErrorState message={units.error.message} onRetry={units.reload} />;
  else if (!units.data) body = <LoadingState />;
  else {
    body = (
      <DataTable
        rows={units.data}
        columns={COLUMNS}
        getRowId={(unit) => unit.id}
        getRowLabel={(unit) => unit.name}
        rowHref={(unit) => paths.businessUnit(unit.id)}
        modifiedAt={(unit) => unit.updatedAt}
        search={{
          placeholder: "Search name or email",
          match: (unit, query) => `${unit.name} ${unit.email}`.toLowerCase().includes(query),
        }}
        bulkActions={(rows, done) => [
          { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setDeleting({ rows, done }) },
        ]}
        emptyState={
          <EmptyState icon={<Building2 />} title="No business units yet">
            <p className="mb-3">Each business unit has its own offices, warehouses and document terms.</p>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus /> Add Business Unit
            </Button>
          </EmptyState>
        }
      />
    );
  }

  return (
    <PageContainer>
      <PageHead
        title="Business Units"
        actions={
          company.data && (
            <>
              <Button size="icon" aria-label="Reload" onClick={units.reload}>
                <RefreshCw />
              </Button>
              <Button variant="primary" onClick={() => setAdding(true)}>
                <Plus /> Add Business Unit
              </Button>
            </>
          )
        }
      />
      <Card>{body}</Card>

      {adding && (
        <BusinessUnitQuickEntry
          onClose={() => setAdding(false)}
          onCreated={(unit) => {
            setAdding(false);
            router.push(paths.businessUnit(unit.id));
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={deleting?.rows.length === 1 ? "Delete business unit?" : `Delete ${deleting?.rows.length} business units?`}
        busy={busy}
        message={
          <>
            <p>The selected business units and their sales and purchase terms will be permanently deleted.</p>
            <p className="mt-2">Business units that still have offices cannot be deleted.</p>
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </PageContainer>
  );
}
