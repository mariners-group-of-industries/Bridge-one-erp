"use client";

import { Boxes, Plus } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, EmptyState, ErrorState, FieldGrid, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatAmount } from "../../dashboard/lib/format";
import { apiFieldErrors, issuesToErrors } from "../../lib/form";
import {
  CUSTOMER_TYPE_LABELS,
  salesPersonInputSchema,
  salesPersonUpdateSchema,
  type CustomerOption,
  type ItemOption,
  type SalesPersonOption,
  type SetupKind,
  type SetupLookups,
} from "../../masters/schemas/masters.schema";
import {
  createSalesPerson,
  fetchCustomers,
  fetchItems,
  fetchSalesLookups,
  fetchSalesPersons,
  fetchSetupLookups,
  updateSalesPerson,
} from "../../masters/services/masters.api";
import { CustomerDialog } from "./CustomerDialog";
import { ItemDialog } from "./ItemDialog";
import { SimpleMastersPanel } from "./SimpleMastersPanel";
import { StockDialog } from "./StockDialog";
import { useToday } from "../../lib/use-today";

type Tab = "customers" | "items" | "sales-force" | SetupKind;

const TABS: { id: Tab; label: string }[] = [
  { id: "customers", label: "Customers" },
  { id: "items", label: "Items" },
  { id: "sales-force", label: "Sales Force" },
  { id: "customer-groups", label: "Customer Groups" },
  { id: "areas", label: "Areas" },
  { id: "categories", label: "Item Categories" },
  { id: "price-lists", label: "Price Types" },
  { id: "delivery-reasons", label: "Pending Reasons" },
  { id: "return-reasons", label: "Return Reasons" },
];

export function SalesSetupView() {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const units = [...new Map((lookups.data?.offices ?? []).map((office) => [office.businessUnitId, office.businessUnitName])).entries()];
  const [chosenUnit, setChosenUnit] = useState<string>("");
  const businessUnitId = chosenUnit || units[0]?.[0] || "";

  return (
    <PageContainer>
      <PageHead
        title="Sales Setup"
        subtitle="Customers, items, sales force and the lists used on sales documents."
        actions={
          units.length > 1 && (
            <SelectField
              label="Business Unit"
              value={businessUnitId}
              options={units.map(([id, name]) => ({ value: id, label: name }))}
              onChange={(event) => setChosenUnit(event.target.value)}
            />
          )
        }
      />
      {lookups.error ? (
        <Card>
          <ErrorState message={errorMessage(lookups.error)} onRetry={lookups.reload} />
        </Card>
      ) : !lookups.data ? (
        <LoadingState />
      ) : !businessUnitId ? (
        <Card>
          <EmptyState title="No business unit">Create a business unit and office in Configuration first.</EmptyState>
        </Card>
      ) : (
        <SetupTabs key={businessUnitId} businessUnitId={businessUnitId} />
      )}
    </PageContainer>
  );
}

function SetupTabs({ businessUnitId }: { businessUnitId: string }) {
  const [tab, setTab] = useState<Tab>("customers");
  const setup = useResource(`setup:${businessUnitId}`, () => fetchSetupLookups(businessUnitId));

  return (
    <Card>
      <Tabs<Tab> label="Setup lists" tabs={TABS} value={tab} onChange={setTab}>
        {setup.error ? (
          <ErrorState message={errorMessage(setup.error)} onRetry={setup.reload} />
        ) : !setup.data ? (
          <LoadingState />
        ) : tab === "customers" ? (
          <CustomersPanel businessUnitId={businessUnitId} lookups={setup.data} />
        ) : tab === "items" ? (
          <ItemsPanel businessUnitId={businessUnitId} lookups={setup.data} />
        ) : tab === "sales-force" ? (
          <SalesForcePanel businessUnitId={businessUnitId} onChanged={setup.reload} />
        ) : (
          <SimpleMastersPanel kind={tab} businessUnitId={businessUnitId} lookups={setup.data} onChanged={setup.reload} />
        )}
      </Tabs>
    </Card>
  );
}

const nameOf = (list: { id: string; name: string }[], id: string | null) => list.find((row) => row.id === id)?.name ?? "—";
const activeIndicator = (active: boolean) => (active ? <Indicator color="green">Active</Indicator> : <Indicator>Inactive</Indicator>);

function CustomersPanel({ businessUnitId, lookups }: { businessUnitId: string; lookups: SetupLookups }) {
  const customers = useResource(`customers:${businessUnitId}`, () => fetchCustomers(businessUnitId, true));
  const [editing, setEditing] = useState<CustomerOption | "new" | null>(null);

  const columns: Column<CustomerOption>[] = [
    {
      id: "name",
      header: "Customer",
      cell: (row) => (
        <button type="button" className="text-left font-medium text-ink hover:underline" onClick={() => setEditing(row)}>
          {row.name}
        </button>
      ),
      sortValue: (row) => row.name,
    },
    { id: "code", header: "Code", cell: (row) => row.code, sortValue: (row) => row.code },
    { id: "type", header: "Type", cell: (row) => CUSTOMER_TYPE_LABELS[row.customerType], hideBelow: "lg" },
    { id: "group", header: "Group", cell: (row) => nameOf(lookups.customerGroups, row.customerGroupId), hideBelow: "md" },
    { id: "territory", header: "Territory", cell: (row) => nameOf(lookups.areas, row.territoryId), hideBelow: "md" },
    { id: "phone", header: "Mobile", cell: (row) => row.phone ?? "—", hideBelow: "lg" },
    {
      id: "limit",
      header: "Credit Limit",
      cell: (row) => (row.creditLimit === null ? "No limit" : formatAmount(row.creditLimit)),
      className: "text-right tabular-nums",
    },
    { id: "status", header: "Status", cell: (row) => activeIndicator(row.isActive) },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex justify-end px-4 pt-3">
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          Add Customer
        </Button>
      </div>
      {customers.error ? (
        <ErrorState message={errorMessage(customers.error)} onRetry={customers.reload} />
      ) : !customers.data ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={customers.data}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          search={{
            placeholder: "Search name, code or mobile",
            match: (row, needle) => `${row.name} ${row.code} ${row.phone ?? ""}`.toLowerCase().includes(needle),
          }}
          emptyState={<EmptyState title="No customers yet" />}
        />
      )}
      {editing && (
        <CustomerDialog
          key={editing === "new" ? "new" : editing.id}
          open
          businessUnitId={businessUnitId}
          lookups={lookups}
          customer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            customers.reload();
          }}
        />
      )}
    </div>
  );
}

function ItemsPanel({ businessUnitId, lookups }: { businessUnitId: string; lookups: SetupLookups }) {
  const items = useResource(`items:${businessUnitId}`, () => fetchItems(businessUnitId, true));
  const [editing, setEditing] = useState<ItemOption | "new" | null>(null);
  const [stockItem, setStockItem] = useState<ItemOption | null>(null);
  const today = useToday();

  const columns: Column<ItemOption>[] = [
    {
      id: "name",
      header: "Item",
      cell: (row) => (
        <button type="button" className="text-left font-medium text-ink hover:underline" onClick={() => setEditing(row)}>
          {row.name}
        </button>
      ),
      sortValue: (row) => row.name,
    },
    { id: "code", header: "Code", cell: (row) => row.code, sortValue: (row) => row.code },
    { id: "category", header: "Category", cell: (row) => nameOf(lookups.categories, row.categoryId), hideBelow: "md" },
    {
      id: "uom",
      header: "Unit",
      cell: (row) => (row.altUom ? `${row.uom} (${row.altUomFactor}/${row.altUom})` : row.uom),
      hideBelow: "sm",
    },
    { id: "rate", header: "Rate", cell: (row) => formatAmount(row.salesRate), className: "text-right tabular-nums", sortValue: (row) => row.salesRate },
    { id: "vat", header: "VAT %", cell: (row) => row.vatPercent, className: "text-right tabular-nums", hideBelow: "lg" },
    { id: "status", header: "Status", cell: (row) => activeIndicator(row.isActive) },
    {
      id: "stock",
      header: "Stock",
      cell: (row) => (
        <Button size="sm" onClick={() => setStockItem(row)}>
          <Boxes aria-hidden="true" />
          Stock
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex justify-end px-4 pt-3">
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          Add Item
        </Button>
      </div>
      {items.error ? (
        <ErrorState message={errorMessage(items.error)} onRetry={items.reload} />
      ) : !items.data ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={items.data}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          search={{ placeholder: "Search name or code", match: (row, needle) => `${row.name} ${row.code}`.toLowerCase().includes(needle) }}
          emptyState={<EmptyState title="No items yet" />}
        />
      )}
      {editing && (
        <ItemDialog
          key={editing === "new" ? "new" : editing.id}
          open
          businessUnitId={businessUnitId}
          lookups={lookups}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            items.reload();
          }}
        />
      )}
      {stockItem && today && <StockDialog key={stockItem.id} item={stockItem} today={today} onClose={() => setStockItem(null)} />}
    </div>
  );
}

function SalesForcePanel({ businessUnitId, onChanged }: { businessUnitId: string; onChanged: () => void }) {
  const persons = useResource(`persons:${businessUnitId}`, () => fetchSalesPersons(businessUnitId, true));
  const [editing, setEditing] = useState<SalesPersonOption | "new" | null>(null);

  const columns: Column<SalesPersonOption>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <button type="button" className="text-left font-medium text-ink hover:underline" onClick={() => setEditing(row)}>
          {row.name}
        </button>
      ),
      sortValue: (row) => row.name,
    },
    { id: "code", header: "Code", cell: (row) => row.code, sortValue: (row) => row.code },
    { id: "designation", header: "Designation", cell: (row) => row.designation ?? "—" },
    { id: "phone", header: "Mobile", cell: (row) => row.phone ?? "—", hideBelow: "sm" },
    { id: "status", header: "Status", cell: (row) => activeIndicator(row.isActive) },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex justify-end px-4 pt-3">
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          Add Sales Force
        </Button>
      </div>
      {persons.error ? (
        <ErrorState message={errorMessage(persons.error)} onRetry={persons.reload} />
      ) : !persons.data ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={persons.data}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          search={{ placeholder: "Search name or code", match: (row, needle) => `${row.name} ${row.code}`.toLowerCase().includes(needle) }}
          emptyState={<EmptyState title="No sales force yet" />}
        />
      )}
      {editing && (
        <SalesPersonDialog
          key={editing === "new" ? "new" : editing.id}
          businessUnitId={businessUnitId}
          person={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            persons.reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function SalesPersonDialog({
  businessUnitId,
  person,
  onClose,
  onSaved,
}: {
  businessUnitId: string;
  person: SalesPersonOption | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState({
    code: person?.code ?? "",
    name: person?.name ?? "",
    designation: person?.designation ?? "",
    phone: person?.phone ?? "",
    isActive: person?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = person ? salesPersonUpdateSchema.safeParse(values) : salesPersonInputSchema.safeParse({ ...values, businessUnitId });
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      if (person) await updateSalesPerson(person.id, values);
      else await createSalesPerson({ ...values, businessUnitId });
      toast.success(`${values.name} saved.`);
      onSaved();
    } catch (error) {
      setErrors(apiFieldErrors(error));
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title={person ? `Edit ${person.name}` : "New Sales Force"}
      onClose={busy ? () => undefined : onClose}
      onSubmit={save}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FieldGrid>
          <TextField label="Name" required value={values.name} error={errors.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
          <TextField label="Code" hint="Blank = generate" value={values.code} error={errors.code} onChange={(event) => setValues({ ...values, code: event.target.value })} />
          <TextField
            label="Designation"
            hint="TSM, RSM, SR …"
            value={values.designation}
            error={errors.designation}
            onChange={(event) => setValues({ ...values, designation: event.target.value })}
          />
          <TextField label="Mobile No." type="tel" value={values.phone} error={errors.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} />
        </FieldGrid>
        <CheckboxField label="Active" checked={values.isActive} onChange={(event) => setValues({ ...values, isActive: event.target.checked })} />
      </div>
    </Dialog>
  );
}
