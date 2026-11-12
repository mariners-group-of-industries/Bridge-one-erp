"use client";

import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { configuration, distributionChannel, offerAndDiscount, outletSetup, salesTarget } from "../navigation";
import { money, qty, rtmApi, thisMonth } from "../services/rtm.api";
import { FilterBar, FormDialog, RtmPage, options, useAction, useLookups, type FieldDef } from "../components/kit";

const active = (on: boolean) => <Badge variant={on ? "success" : "neutral"}>{on ? "Active" : "Inactive"}</Badge>;

// ── Outlet setup ─────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  code: string;
  name: string;
  ownerName: string | null;
  phone: string | null;
  address: string | null;
  channelId: string | null;
  channel: string | null;
  distributorId: string;
  distributor: string;
  routeId: string | null;
  route: string | null;
  latitude: number | null;
  longitude: number | null;
  creditLimit: number | null;
  isActive: boolean;
  updatedAt: string;
}

export function OutletSetupView() {
  const list = useResource("rtm-outlets", () => rtmApi.get<Outlet[]>("outlet-setup"));
  const lookups = useLookups();
  const [editing, setEditing] = useState<Outlet | "new" | null>(null);
  const l = lookups.data;
  const fields: FieldDef[] = [
    { name: "name", label: "Outlet name", required: true },
    { name: "ownerName", label: "Owner" },
    { name: "phone", label: "Mobile" },
    { name: "distributorId", label: "Distributor", type: "select", required: true, options: options(l?.distributors, (d) => `${d.code} · ${d.name}`, (d) => d.id, "Select distributor") },
    { name: "channelId", label: "Distribution channel", type: "select", options: options(l?.channels, (c) => c.name, (c) => c.id, "None") },
    { name: "routeId", label: "Route", type: "select", options: options(l?.routes, (r) => r.name, (r) => r.id, "None") },
    { name: "creditLimit", label: "Credit limit", type: "number", hint: "Empty = no limit." },
    { name: "latitude", label: "Latitude", type: "number" },
    { name: "longitude", label: "Longitude", type: "number" },
    { name: "address", label: "Address", type: "textarea", wide: true },
    { name: "isActive", label: "Active", type: "checkbox" },
  ];
  const columns: Column<Outlet>[] = [
    { id: "code", header: "Code", cell: (o) => <span className="font-mono">{o.code}</span>, sortValue: (o) => o.code },
    { id: "name", header: "Outlet", cell: (o) => o.name, sortValue: (o) => o.name },
    { id: "owner", header: "Owner / Mobile", cell: (o) => [o.ownerName, o.phone].filter(Boolean).join(" · ") || "—", hideBelow: "md" },
    { id: "distributor", header: "Distributor", cell: (o) => o.distributor, sortValue: (o) => o.distributor },
    { id: "channel", header: "Channel", cell: (o) => o.channel ?? "—", hideBelow: "lg" },
    { id: "route", header: "Route", cell: (o) => o.route ?? "—", hideBelow: "lg" },
    { id: "credit", header: "Credit limit", cell: (o) => (o.creditLimit === null ? "—" : money(o.creditLimit)), className: "text-right" },
    { id: "status", header: "Status", cell: (o) => active(o.isActive) },
    { id: "edit", header: "", cell: (o) => <Button size="sm" variant="ghost" onClick={() => setEditing(o)}><Pencil /> Edit</Button> },
  ];
  const initial = editing && editing !== "new"
    ? { name: editing.name, ownerName: editing.ownerName ?? "", phone: editing.phone ?? "", distributorId: editing.distributorId, channelId: editing.channelId ?? "", routeId: editing.routeId ?? "", creditLimit: editing.creditLimit === null ? "" : String(editing.creditLimit), latitude: editing.latitude === null ? "" : String(editing.latitude), longitude: editing.longitude === null ? "" : String(editing.longitude), address: editing.address ?? "", isActive: editing.isActive }
    : undefined;
  return (
    <RtmPage page={outletSetup} actions={<Button variant="primary" onClick={() => setEditing("new")}><Plus /> New Outlet</Button>}>
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <Card>
          <DataTable
            rows={list.data}
            columns={columns}
            getRowId={(o) => o.id}
            getRowLabel={(o) => o.name}
            modifiedAt={(o) => o.updatedAt}
            search={{ placeholder: "Search outlet, code, owner, distributor…", match: (o, q) => `${o.code} ${o.name} ${o.ownerName ?? ""} ${o.phone ?? ""} ${o.distributor}`.toLowerCase().includes(q) }}
          />
        </Card>
      )}
      <FormDialog
        key={editing === "new" ? "new" : editing?.id}
        open={!!editing}
        title={editing === "new" ? "New Outlet" : `Edit ${editing?.name ?? ""}`}
        fields={fields}
        initial={initial}
        onClose={() => setEditing(null)}
        onSubmit={async (p) => {
          if (editing === "new") await rtmApi.post("outlet-setup", p);
          else if (editing) await rtmApi.patch(`outlet-setup/${editing.id}`, p);
          list.reload();
          lookups.reload();
        }}
      />
    </RtmPage>
  );
}

// ── Distribution channels ────────────────────────────────────────────────────

interface Channel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  outlets: number;
  updatedAt: string;
}

export function DistributionChannelView() {
  const list = useResource("rtm-channels", () => rtmApi.get<Channel[]>("distribution-channel"));
  const [editing, setEditing] = useState<Channel | "new" | null>(null);
  const fields: FieldDef[] = [
    { name: "code", label: "Code", required: true, hint: "e.g. GT, MT, WS" },
    { name: "name", label: "Name", required: true, hint: "e.g. General Trade" },
    { name: "description", label: "Description", type: "textarea", wide: true },
    { name: "isActive", label: "Active", type: "checkbox" },
  ];
  const columns: Column<Channel>[] = [
    { id: "code", header: "Code", cell: (c) => <span className="font-mono">{c.code}</span>, sortValue: (c) => c.code },
    { id: "name", header: "Channel", cell: (c) => c.name, sortValue: (c) => c.name },
    { id: "description", header: "Description", cell: (c) => c.description ?? "—", hideBelow: "md" },
    { id: "outlets", header: "Outlets", cell: (c) => c.outlets, className: "text-right" },
    { id: "status", header: "Status", cell: (c) => active(c.isActive) },
    { id: "edit", header: "", cell: (c) => <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil /> Edit</Button> },
  ];
  return (
    <RtmPage page={distributionChannel} actions={<Button variant="primary" onClick={() => setEditing("new")}><Plus /> New Channel</Button>}>
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <Card>
          <DataTable rows={list.data} columns={columns} getRowId={(c) => c.id} getRowLabel={(c) => c.name} modifiedAt={(c) => c.updatedAt} search={{ placeholder: "Search channels", match: (c, q) => `${c.code} ${c.name}`.toLowerCase().includes(q) }} />
        </Card>
      )}
      <FormDialog
        key={editing === "new" ? "new" : editing?.id}
        open={!!editing}
        title={editing === "new" ? "New Distribution Channel" : "Edit Distribution Channel"}
        fields={fields}
        initial={editing && editing !== "new" ? { code: editing.code, name: editing.name, description: editing.description ?? "", isActive: editing.isActive } : undefined}
        onClose={() => setEditing(null)}
        onSubmit={async (p) => {
          if (editing === "new") await rtmApi.post("distribution-channel", p);
          else if (editing) await rtmApi.patch(`distribution-channel/${editing.id}`, p);
          list.reload();
        }}
      />
    </RtmPage>
  );
}

// ── Offers and discounts ─────────────────────────────────────────────────────

interface Offer {
  id: string;
  name: string;
  channelId: string | null;
  channel: string;
  itemId: string | null;
  item: string;
  minQty: number | null;
  minAmount: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  updatedAt: string;
}

export function OfferAndDiscountView() {
  const list = useResource("rtm-offers", () => rtmApi.get<Offer[]>("offer-and-discount"));
  const lookups = useLookups();
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  const l = lookups.data;
  const fields: FieldDef[] = [
    { name: "name", label: "Offer name", required: true, wide: true },
    { name: "channelId", label: "Channel", type: "select", options: options(l?.channels, (c) => c.name, (c) => c.id, "All channels") },
    { name: "itemId", label: "Item", type: "select", options: options(l?.items, (i) => `${i.code} · ${i.name}`, (i) => i.id, "Whole order") },
    { name: "minQty", label: "Minimum quantity", type: "number" },
    { name: "minAmount", label: "Minimum amount", type: "number" },
    { name: "discountPercent", label: "Discount %", type: "number" },
    { name: "discountAmount", label: "Discount amount", type: "number" },
    { name: "validFrom", label: "Valid from", type: "date", required: true },
    { name: "validTo", label: "Valid to", type: "date", required: true },
    { name: "isActive", label: "Active", type: "checkbox" },
  ];
  const discount = (o: Offer) => [o.discountPercent ? `${o.discountPercent}%` : null, o.discountAmount ? money(o.discountAmount) : null].filter(Boolean).join(" + ");
  const columns: Column<Offer>[] = [
    { id: "name", header: "Offer", cell: (o) => o.name, sortValue: (o) => o.name },
    { id: "applies", header: "Applies to", cell: (o) => `${o.channel} · ${o.item}` },
    { id: "min", header: "Minimum", cell: (o) => [o.minQty ? `${qty(o.minQty)} qty` : null, o.minAmount ? money(o.minAmount) : null].filter(Boolean).join(" / ") || "—", hideBelow: "md" },
    { id: "discount", header: "Discount", cell: discount },
    { id: "valid", header: "Valid", cell: (o) => `${o.validFrom} → ${o.validTo}`, sortValue: (o) => o.validFrom },
    { id: "status", header: "Status", cell: (o) => active(o.isActive) },
    { id: "edit", header: "", cell: (o) => <Button size="sm" variant="ghost" onClick={() => setEditing(o)}><Pencil /> Edit</Button> },
  ];
  return (
    <RtmPage page={offerAndDiscount} actions={<Button variant="primary" onClick={() => setEditing("new")}><Plus /> New Offer</Button>}>
      <p className="text-xs text-ink-faint">A retail order gets the active offer that gives it the largest discount.</p>
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <Card>
          <DataTable rows={list.data} columns={columns} getRowId={(o) => o.id} getRowLabel={(o) => o.name} modifiedAt={(o) => o.updatedAt} search={{ placeholder: "Search offers", match: (o, q) => o.name.toLowerCase().includes(q) }} />
        </Card>
      )}
      <FormDialog
        key={editing === "new" ? "new" : editing?.id}
        open={!!editing}
        title={editing === "new" ? "New Offer" : "Edit Offer"}
        fields={fields}
        initial={
          editing && editing !== "new"
            ? {
                name: editing.name,
                channelId: editing.channelId ?? "",
                itemId: editing.itemId ?? "",
                minQty: editing.minQty === null ? "" : String(editing.minQty),
                minAmount: editing.minAmount === null ? "" : String(editing.minAmount),
                discountPercent: editing.discountPercent === null ? "" : String(editing.discountPercent),
                discountAmount: editing.discountAmount === null ? "" : String(editing.discountAmount),
                validFrom: editing.validFrom,
                validTo: editing.validTo,
                isActive: editing.isActive,
              }
            : undefined
        }
        onClose={() => setEditing(null)}
        onSubmit={async (p) => {
          if (editing === "new") await rtmApi.post("offer-and-discount", p);
          else if (editing) await rtmApi.patch(`offer-and-discount/${editing.id}`, p);
          list.reload();
        }}
      />
    </RtmPage>
  );
}

// ── Sales targets ────────────────────────────────────────────────────────────

interface Target {
  id: string;
  month: string;
  employee: string | null;
  distributor: string | null;
  item: string | null;
  targetQty: number | null;
  targetValue: number | null;
  updatedAt: string;
}

export function SalesTargetView() {
  const [month, setMonth] = useState(thisMonth());
  const list = useResource(`rtm-targets-${month}`, () => rtmApi.get<Target[]>("sales-target", { month }));
  const lookups = useLookups();
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction(list.reload);
  const l = lookups.data;
  const fields: FieldDef[] = [
    { name: "month", label: "Month", type: "month", required: true },
    { name: "employeeId", label: "Sales representative", type: "select", options: options(l?.srs, (s) => `${s.code} · ${s.name}`, (s) => s.id, "None") },
    { name: "distributorId", label: "Distributor", type: "select", options: options(l?.distributors, (d) => d.name, (d) => d.id, "None") },
    { name: "itemId", label: "Item", type: "select", options: options(l?.items, (i) => `${i.code} · ${i.name}`, (i) => i.id, "All items"), hint: "Needed for a quantity target." },
    { name: "targetValue", label: "Target value", type: "number" },
    { name: "targetQty", label: "Target quantity", type: "number" },
  ];
  const columns: Column<Target>[] = [
    { id: "month", header: "Month", cell: (t) => t.month, sortValue: (t) => t.month },
    { id: "sr", header: "Sales representative", cell: (t) => t.employee ?? "—", sortValue: (t) => t.employee ?? "" },
    { id: "distributor", header: "Distributor", cell: (t) => t.distributor ?? "—" },
    { id: "item", header: "Item", cell: (t) => t.item ?? "All items", hideBelow: "md" },
    { id: "value", header: "Target value", cell: (t) => (t.targetValue === null ? "—" : money(t.targetValue)), className: "text-right" },
    { id: "qty", header: "Target qty", cell: (t) => (t.targetQty === null ? "—" : qty(t.targetQty)), className: "text-right" },
    {
      id: "delete",
      header: "",
      cell: (t) => (
        <Button size="sm" variant="ghost" disabled={busy === t.id} onClick={() => run(t.id, () => rtmApi.del(`sales-target/${t.id}`), "Target removed.")}>
          <Trash2 /> Remove
        </Button>
      ),
    },
  ];
  return (
    <RtmPage page={salesTarget} actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus /> New Target</Button>}>
      <FilterBar>
        <TextField label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
        <p className="pb-1.5 text-xs text-ink-faint">Achievement is on the Sales Executive Dashboard.</p>
      </FilterBar>
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <Card>
          <DataTable rows={list.data} columns={columns} getRowId={(t) => t.id} getRowLabel={(t) => t.employee ?? t.distributor ?? t.month} modifiedAt={(t) => t.updatedAt} />
        </Card>
      )}
      <FormDialog open={open} title="New Sales Target" fields={fields} initial={{ month }} onClose={() => setOpen(false)} onSubmit={async (p) => { await rtmApi.post("sales-target", p); list.reload(); }} />
    </RtmPage>
  );
}

// ── Configuration ────────────────────────────────────────────────────────────

interface Settings {
  businessUnitId: string;
  businessUnits: { id: string; name: string }[];
  settings: Record<string, string>;
  definitions: { key: string; label: string; hint: string; default: string }[];
}

export function RtmConfigurationView() {
  const [unit, setUnit] = useState<string | undefined>();
  const data = useResource(`rtm-settings-${unit ?? ""}`, () => rtmApi.get<Settings>("configuration", { businessUnitId: unit }));
  return (
    <RtmPage page={configuration}>
      {data.error ? <ErrorState message={data.error.message} onRetry={data.reload} /> : !data.data ? <LoadingState /> : (
        <SettingsForm key={`${data.data.businessUnitId}-${JSON.stringify(data.data.settings)}`} data={data.data} onUnit={setUnit} onSaved={data.reload} />
      )}
    </RtmPage>
  );
}

function SettingsForm({ data, onUnit, onSaved }: { data: Settings; onUnit: (id: string) => void; onSaved: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState(data.settings);
  const [saving, setSaving] = useState(false);
  const changed = data.definitions.some((d) => values[d.key] !== data.settings[d.key]);
  const save = async () => {
    setSaving(true);
    try {
      await rtmApi.put("configuration", { businessUnitId: data.businessUnitId, settings: values });
      toast.success("RTM settings saved.");
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <div className="flex flex-col gap-4 p-4">
        {data.businessUnits.length > 1 && (
          <SelectField label="Business unit" className="max-w-sm" value={data.businessUnitId} onChange={(e) => onUnit(e.target.value)} options={data.businessUnits.map((u) => ({ value: u.id, label: u.name }))} />
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.definitions.map((d) =>
            d.default === "true" || d.default === "false" ? (
              <SelectField key={d.key} label={d.label} hint={d.hint} value={values[d.key]} onChange={(e) => setValues({ ...values, [d.key]: e.target.value })} options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
            ) : d.key === "weeklyHoliday" ? (
              <SelectField key={d.key} label={d.label} hint={d.hint} value={values[d.key]} onChange={(e) => setValues({ ...values, [d.key]: e.target.value })} options={["SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }))} />
            ) : (
              <TextField key={d.key} label={d.label} hint={d.hint} type={d.key === "workStartTime" ? "time" : "text"} value={values[d.key]} onChange={(e) => setValues({ ...values, [d.key]: e.target.value })} />
            ),
          )}
        </div>
        <div>
          <Button variant="primary" loading={saving} disabled={!changed} onClick={save}>
            <Save /> Save settings
          </Button>
        </div>
      </div>
    </Card>
  );
}
