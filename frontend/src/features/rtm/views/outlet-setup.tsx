"use client";

import { Check, Eye, FileSpreadsheet, FileText, ImageIcon, Pencil, Plus, Power, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import type { MenuItem } from "@/components/ui/dropdown-menu";
import { CONTROL, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { downloadFile } from "@/lib/download";
import { useFeaturePermissions } from "@/lib/permissions/useFeaturePermissions";
import { outletSetup } from "../navigation";
import { rtmPaths } from "../paths";
import { money, rtmApi, type TerritoryFilters } from "../services/rtm.api";
import { FilterBar, RtmPage, StatusBadge, options, useAction } from "../components/kit";
import { EMPTY_TERRITORY, ListCard, TerritoryFields, ViewButton, nodeOf, useListExport, useTerritory, useViewFilters, type ExportFile } from "../components/sales-filters";

// ── Types ────────────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  code: string;
  name: string;
  nameBn: string | null;
  partnerCode: string | null;
  category: string | null;
  businessType: string | null;
  outletGroup: string | null;
  division: string | null;
  districtId: number | null;
  district: string | null;
  thanaId: string | null;
  thana: string | null;
  phone: string | null;
  ownerPhone: string | null;
  contactPerson: string | null;
  ownerName: string | null;
  address: string | null;
  tradeLicense: string | null;
  nid: string | null;
  email: string | null;
  dateOfBirth: string | null;
  serial: number | null;
  maritalStatus: string | null;
  competitors: string | null;
  competitorItems: string | null;
  regularSales: number | null;
  salesPeriod: "DAILY" | "MONTHLY" | null;
  channelId: string | null;
  channel: string | null;
  distributorId: string;
  distributor: string;
  latitude: number | null;
  longitude: number | null;
  creditLimit: number | null;
  isActive: boolean;
  approvalStatus: string;
  approvedBy: string | null;
  areaNodeIds: string[];
  territory?: string;
  section?: string;
  basePoint?: string;
  route?: string;
  market?: string;
  moreAreas: number;
  assignedSrs: string[];
  attachments: number;
  updatedAt: string;
}

interface FormOptions {
  divisions: string[];
  districts: { id: number; name: string; division: string }[];
  thanas: { id: string; districtId: number; name: string }[];
  distributors: { id: string; code: string; name: string }[];
  channels: { id: string; name: string }[];
  categories: string[];
  businessTypes: string[];
  outletGroups: string[];
}

interface Attachment {
  id: string;
  kind: "IMAGE" | "DOCUMENT";
  originalName: string;
  mimeType: string;
  size: number;
}

const APPROVAL_LABELS = { PENDING: "Pending approval", APPROVED: "Approved", REJECTED: "Rejected" };
const STATUSES = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "PENDING", label: "Pending approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];
const outletType = (o: Outlet) => [o.businessType, o.category].filter(Boolean).join(" · ");
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Node id → path (ancestors and itself) and label, from the Sales Territory tree. */
function useNodeIndex(territory: TerritoryFilters | undefined) {
  const index = new Map<string, { path: string[]; name: string; layer: string }>();
  for (const l of territory?.layers ?? []) for (const n of l.nodes) index.set(n.id, { path: n.path, name: n.name, layer: l.name });
  return index;
}

// ── List ─────────────────────────────────────────────────────────────────────

export function OutletSetupView() {
  const territory = useTerritory();
  const nodes = useNodeIndex(territory.data);
  const can = useFeaturePermissions(rtmPaths.outletSetup);
  const list = useResource("rtm-outlets", () => rtmApi.get<Outlet[]>("outlet-setup"));
  const f = useViewFilters({ ...EMPTY_TERRITORY, status: "" });
  const a = f.applied;
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Outlet | "new" | null>(null);
  const [viewing, setViewing] = useState<Outlet | null>(null);
  const [bulk, setBulk] = useState(false);
  const { busy, run } = useAction(list.reload);

  const node = nodeOf(a);
  const q = query.trim().toLowerCase();
  const rows = (list.data ?? []).filter((o) => {
    if (node && !o.areaNodeIds.some((id) => nodes.get(id)?.path.includes(node))) return false;
    if (a.status === "active" && !o.isActive) return false;
    if (a.status === "inactive" && o.isActive) return false;
    if (["PENDING", "APPROVED", "REJECTED"].includes(a.status) && o.approvalStatus !== a.status) return false;
    return !q || `${o.name} ${o.nameBn ?? ""} ${o.code} ${o.partnerCode ?? ""} ${o.phone ?? ""} ${o.ownerPhone ?? ""} ${o.contactPerson ?? ""}`.toLowerCase().includes(q);
  });

  const file: ExportFile<Outlet> = {
    title: "Outlets",
    headers: ["SL", "Code", "Territory", "Section", "Assigned SR", "Route", "Market", "Outlet Name", "Outlet Name (Bangla)", "Partner Code", "Type", "Contact", "Distributor", "Status", "Approval Status"],
    row: (o, i) => [i + 1, o.code, o.territory ?? null, o.section ?? null, o.assignedSrs.join(", ") || null, o.route ?? null, o.market ?? null, o.name, o.nameBn, o.partnerCode, outletType(o) || null, o.phone, o.distributor, o.isActive ? "Active" : "Inactive", APPROVAL_LABELS[o.approvalStatus as keyof typeof APPROVAL_LABELS] ?? o.approvalStatus],
  };
  const selected = useListExport("outlet-setup", file);
  const bulkActions = (picked: Outlet[], clear: () => void): MenuItem[] => [
    ...(can.export ? [{ label: `Excel (${picked.length} selected)`, icon: <FileSpreadsheet className="size-4" />, onSelect: () => void selected.download(picked).then(clear) }] : []),
    ...(can.approve && picked.some((o) => o.approvalStatus === "PENDING")
      ? [
          {
            label: `Approve ${picked.filter((o) => o.approvalStatus === "PENDING").length} pending`,
            icon: <Check className="size-4" />,
            onSelect: () =>
              void run("bulk-approve", async () => {
                for (const o of picked.filter((x) => x.approvalStatus === "PENDING")) await rtmApi.post(`outlet-setup/${o.id}/approve`);
                clear();
              }, "Outlets approved."),
          },
        ]
      : []),
  ];

  const columns: Column<Outlet>[] = [
    { id: "sl", header: "SL", cell: (_o, i) => i + 1, className: "w-12 text-right tabular-nums" },
    { id: "territory", header: "Territory", cell: (o) => o.territory ?? "—", hideBelow: "lg" },
    { id: "section", header: "Section", cell: (o) => o.section ?? o.basePoint ?? "—", hideBelow: "lg" },
    { id: "sr", header: "Assigned SR", cell: (o) => (o.assignedSrs.length ? <span className="line-clamp-2 text-xs">{o.assignedSrs.join(", ")}</span> : <span className="text-ink-faint">—</span>), hideBelow: "md" },
    { id: "route", header: "Route", cell: (o) => o.route ?? "—", hideBelow: "md" },
    { id: "market", header: "Market", cell: (o) => (o.market ? <>{o.market}{o.moreAreas > 0 && <span className="ml-1 text-[11px] text-ink-faint">+{o.moreAreas}</span>}</> : "—"), hideBelow: "md" },
    {
      id: "name",
      header: "Outlet Name",
      cell: (o) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{o.name}</span>
          {o.nameBn && <span className="text-[11px] text-ink-muted" lang="bn">{o.nameBn}</span>}
          <span className="font-mono text-[11px] text-ink-faint">{o.code}</span>
        </span>
      ),
    },
    { id: "partner", header: "Partner Code", cell: (o) => (o.partnerCode ? <span className="font-mono text-xs">{o.partnerCode}</span> : "—") },
    { id: "type", header: "Type", cell: (o) => outletType(o) || "—", hideBelow: "lg" },
    { id: "contact", header: "Contact", cell: (o) => (o.phone ? <a href={`tel:${o.phone}`} className="tabular-nums hover:underline">{o.phone}</a> : "—") },
    { id: "status", header: "Status", cell: (o) => <Badge variant={o.isActive ? "success" : "neutral"}>{o.isActive ? "Active" : "Inactive"}</Badge> },
    { id: "approval", header: "Approval Status", cell: (o) => <StatusBadge status={o.approvalStatus} labels={APPROVAL_LABELS} /> },
    {
      id: "actions",
      header: "Actions",
      cell: (o) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" aria-label={`View ${o.name}`} title="View" onClick={() => setViewing(o)}>
            <Eye />
          </Button>
          {can.edit && (
            <Button variant="ghost" size="icon" aria-label={`Edit ${o.name}`} title="Edit" onClick={() => setEditing(o)}>
              <Pencil />
            </Button>
          )}
          {can.approve && o.approvalStatus === "PENDING" && (
            <>
              <Button variant="ghost" size="icon" aria-label={`Approve ${o.name}`} title="Approve" className="hover:text-success" loading={busy === `a-${o.id}`} onClick={() => run(`a-${o.id}`, () => rtmApi.post(`outlet-setup/${o.id}/approve`), `${o.name} approved.`)}>
                {busy !== `a-${o.id}` && <Check />}
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Reject ${o.name}`} title="Reject" className="hover:text-danger" loading={busy === `r-${o.id}`} onClick={() => run(`r-${o.id}`, () => rtmApi.post(`outlet-setup/${o.id}/reject`), `${o.name} rejected.`)}>
                {busy !== `r-${o.id}` && <X />}
              </Button>
            </>
          )}
          {can.edit && o.approvalStatus === "REJECTED" && (
            <Button variant="ghost" size="icon" aria-label={`Send ${o.name} for approval again`} title="Send for approval again" loading={busy === `s-${o.id}`} onClick={() => run(`s-${o.id}`, () => rtmApi.post(`outlet-setup/${o.id}/resubmit`), `${o.name} sent for approval.`)}>
              {busy !== `s-${o.id}` && <RotateCcw />}
            </Button>
          )}
          {can.edit && (
            <Button variant="ghost" size="icon" aria-label={o.isActive ? `Deactivate ${o.name}` : `Activate ${o.name}`} title={o.isActive ? "Deactivate" : "Activate"} loading={busy === `p-${o.id}`} onClick={() => run(`p-${o.id}`, () => rtmApi.post(`outlet-setup/${o.id}/status`, { isActive: !o.isActive }), `${o.name} ${o.isActive ? "deactivated" : "activated"}.`)}>
              {busy !== `p-${o.id}` && <Power />}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <RtmPage
      page={outletSetup}
      actions={
        <>
          {can.import && (
            <Button onClick={() => setBulk(true)}>
              <Upload /> Bulk Upload
            </Button>
          )}
          {can.create && (
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus /> Outlet Create
            </Button>
          )}
        </>
      }
    >
      <FilterBar>
        <TerritoryFields withSr={false} value={f.draft} onChange={f.set} territory={territory.data} />
        <SelectField label="Status" className="w-44" value={f.draft.status} onChange={(e) => f.set({ status: e.target.value })} options={STATUSES} />
        <ViewButton loading={list.loading} onClick={() => f.view(list.reload)} />
      </FilterBar>
      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState />
      ) : (
        <ListCard title="Outlets" rows={rows} query={query} onQuery={setQuery} placeholder="Search outlet, code, partner code, contact…" exportPage="outlet-setup" canExport={can.export} exportFile={file}>
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(o) => o.id}
            getRowLabel={(o) => o.name}
            bulkActions={can.export || can.approve ? bulkActions : undefined}
            emptyState={<EmptyState title="No outlets">No outlet matches these filters.</EmptyState>}
          />
        </ListCard>
      )}
      {editing && (
        <OutletForm
          key={editing === "new" ? "new" : editing.id}
          outlet={editing === "new" ? null : editing}
          territory={territory.data}
          onClose={() => setEditing(null)}
          onSaved={list.reload}
        />
      )}
      {viewing && <OutletDetail outlet={viewing} nodes={nodes} onClose={() => setViewing(null)} />}
      {bulk && <BulkUploadDialog onClose={() => setBulk(false)} onDone={list.reload} />}
    </RtmPage>
  );
}

// ── Detail ───────────────────────────────────────────────────────────────────

function OutletDetail({ outlet: o, nodes, onClose }: { outlet: Outlet; nodes: ReturnType<typeof useNodeIndex>; onClose: () => void }) {
  const files = useResource(`rtm-outlet-files-${o.id}`, () => rtmApi.get<Attachment[]>(`outlet-setup/${o.id}/attachments`));
  const fields: [string, ReactNode][] = [
    ["Outlet name (Bangla)", o.nameBn],
    ["Partner code", o.partnerCode],
    ["Distributor", o.distributor],
    ["Channel", o.channel],
    ["Credit limit", o.creditLimit === null ? "No limit" : money(o.creditLimit)],
    ["Outlet category", o.category],
    ["Business type", o.businessType],
    ["Outlet group", o.outletGroup],
    ["Division / District", [o.division, o.district].filter(Boolean).join(" › ")],
    ["Thana / Upazila", o.thana],
    ["Address", o.address],
    ["Contact number", o.phone],
    ["Owner number", o.ownerPhone],
    ["Contact person", o.contactPerson],
    ["Owner", o.ownerName],
    ["Email", o.email],
    ["Trade license", o.tradeLicense],
    ["NID", o.nid],
    ["Date of birth", o.dateOfBirth],
    ["Serial", o.serial],
    ["Marital status", o.maritalStatus],
    ["Competitors", o.competitors],
    ["Item name", o.competitorItems],
    ["Regular sales", o.regularSales === null ? null : `${money(o.regularSales)}${o.salesPeriod ? ` / ${o.salesPeriod === "DAILY" ? "day" : "month"}` : ""}`],
    ["Assigned SR", o.assignedSrs.join(", ")],
    ["Approval", <StatusBadge key="a" status={o.approvalStatus} labels={APPROVAL_LABELS} />],
    ["Approved by", o.approvedBy],
  ];
  return (
    <Dialog open size="xl" title={o.name} description={`${o.code}${o.isActive ? "" : " · Inactive"}`} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px] sm:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label} className="flex min-w-0 flex-col">
              <dt className="text-xs font-medium text-ink-muted">{label}</dt>
              <dd className="break-words text-ink">{value === null || value === undefined || value === "" ? "—" : value}</dd>
            </div>
          ))}
        </dl>
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">Areas</h3>
          {o.areaNodeIds.length === 0 ? (
            <p className="text-[13px] text-ink-faint">No base point, route or market assigned.</p>
          ) : (
            <ol className="flex flex-col gap-1 text-[13px]">
              {o.areaNodeIds.map((id, i) => (
                <li key={id}>
                  {i === 0 && <Badge variant="primary" className="mr-1.5">Main</Badge>}
                  {(nodes.get(id)?.path ?? [id]).map((p) => nodes.get(p)?.name ?? "…").join(" › ")}
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">Image and documents</h3>
          {!files.data ? (
            <LoadingState />
          ) : files.data.length === 0 ? (
            <p className="text-[13px] text-ink-faint">No files.</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {files.data.map((f) => (
                <li key={f.id}>
                  <a href={`/api/rtm/outlet-setup/${o.id}/attachments/${f.id}`} target="_blank" rel="noreferrer" className="flex w-40 flex-col gap-1 rounded border border-line p-2 hover:bg-hover focus-visible:outline-2">
                    {f.kind === "IMAGE" && f.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element -- an authenticated API file, not a static asset
                      <img src={`/api/rtm/outlet-setup/${o.id}/attachments/${f.id}`} alt={`Outlet image ${f.originalName}`} className="h-24 w-full rounded object-cover" />
                    ) : (
                      <span className="flex h-24 items-center justify-center rounded bg-canvas text-ink-faint">
                        <FileText className="size-8" />
                      </span>
                    )}
                    <span className="truncate text-xs text-ink">{f.originalName}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}

// ── Create / edit ────────────────────────────────────────────────────────────

type FormValues = Record<string, string>;

const blank = (): FormValues => ({
  name: "",
  nameBn: "",
  partnerCode: "",
  creditLimit: "",
  category: "",
  businessType: "",
  outletGroup: "",
  distributorId: "",
  channelId: "",
  division: "",
  districtId: "",
  thanaId: "",
  phone: "",
  ownerPhone: "",
  contactPerson: "",
  ownerName: "",
  address: "",
  tradeLicense: "",
  nid: "",
  email: "",
  dateOfBirth: "",
  serial: "",
  maritalStatus: "",
  competitors: "",
  competitorItems: "",
  regularSales: "",
  salesPeriod: "MONTHLY",
  latitude: "",
  longitude: "",
});

const fromOutlet = (o: Outlet): FormValues => {
  const v = blank();
  for (const k of Object.keys(v)) {
    const value = (o as unknown as Record<string, unknown>)[k];
    if (value !== null && value !== undefined) v[k] = String(value);
  }
  v.division = o.division ?? "";
  v.salesPeriod = o.salesPeriod ?? "MONTHLY";
  return v;
};

interface PendingFile {
  key: string;
  kind: "IMAGE" | "DOCUMENT";
  file: File;
}

function OutletForm({ outlet, territory, onClose, onSaved }: { outlet: Outlet | null; territory: TerritoryFilters | undefined; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const opts = useResource("rtm-outlet-options", () => rtmApi.get<FormOptions>("outlet-setup/options"));
  const existing = useResource(outlet ? `rtm-outlet-files-${outlet.id}` : null, () => rtmApi.get<Attachment[]>(`outlet-setup/${outlet!.id}/attachments`));
  const nodes = useNodeIndex(territory);
  const [v, setV] = useState<FormValues>(() => (outlet ? fromOutlet(outlet) : blank()));
  const [areas, setAreas] = useState<string[]>(outlet?.areaNodeIds ?? []);
  const [areaPick, setAreaPick] = useState(EMPTY_TERRITORY);
  const [fileKind, setFileKind] = useState<"IMAGE" | "DOCUMENT">("IMAGE");
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [saving, setSaving] = useState<"save" | "new" | null>(null);
  const set = (k: string) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const o = opts.data;
  const districts = (o?.districts ?? []).filter((d) => !v.division || d.division === v.division);
  const thanas = (o?.thanas ?? []).filter((t) => v.districtId && t.districtId === Number(v.districtId));
  const datalist = (id: string, values: string[] | undefined) => (
    <datalist id={id}>
      {(values ?? []).map((x) => (
        <option key={x} value={x} />
      ))}
    </datalist>
  );

  const addArea = () => {
    const id = nodeOf(areaPick);
    if (!id) {
      toast.error("Pick a base point, route or market to add.");
      return;
    }
    if (areas.includes(id)) {
      toast.error("That area is already added.");
      return;
    }
    setAreas([...areas, id]);
    setAreaPick(EMPTY_TERRITORY);
  };
  const addFile = () => {
    if (!fileInput) {
      toast.error("Choose a file to add.");
      return;
    }
    if (fileInput.size > 5 * 1024 * 1024) {
      toast.error("Files must be 5 MB or smaller.");
      return;
    }
    const allowed = fileKind === "IMAGE" ? ["image/png", "image/jpeg", "image/webp"] : ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(fileInput.type)) {
      toast.error(fileKind === "IMAGE" ? "The outlet image must be PNG, JPEG or WebP." : "Documents must be PDF, PNG, JPEG or WebP.");
      return;
    }
    setPending([...pending, { key: `${Date.now()}-${fileInput.name}`, kind: fileKind, file: fileInput }]);
    setFileInput(null);
    setFileInputKey((k) => k + 1);
  };

  const save = async (andNew: boolean) => {
    if (!v.name.trim()) {
      toast.error("Enter the outlet name.");
      return;
    }
    if (!v.distributorId) {
      toast.error("Select the distributor.");
      return;
    }
    setSaving(andNew ? "new" : "save");
    try {
      const { division: _division, ...body } = v;
      const payload = { ...body, areaNodeIds: areas, isActive: outlet?.isActive ?? true };
      const saved = outlet ? await rtmApi.patch<{ id: string; code: string }>(`outlet-setup/${outlet.id}`, payload) : await rtmApi.post<{ id: string; code: string }>("outlet-setup", payload);
      const failed: string[] = [];
      for (const p of pending) {
        const form = new FormData();
        form.set("file", p.file);
        form.set("kind", p.kind);
        try {
          await apiRequest(`/api/rtm/outlet-setup/${saved.id}/attachments`, { method: "POST", body: form });
        } catch (error) {
          failed.push(`${p.file.name}: ${errorMessage(error)}`);
        }
      }
      for (const id of removed) await rtmApi.del(`outlet-setup/${saved.id}/attachments/${id}`).catch((error) => failed.push(errorMessage(error)));
      if (failed.length) toast.error(`Outlet saved, but some files were not: ${failed.join("; ")}`);
      else toast.success(outlet ? `${v.name} saved.` : `Outlet ${saved.code} created. It can take orders once approved.`);
      onSaved();
      if (andNew && !outlet) {
        setV((x) => ({ ...blank(), distributorId: x.distributorId, channelId: x.channelId, division: x.division, districtId: x.districtId, thanaId: x.thanaId }));
        setPending([]);
        setFileInputKey((k) => k + 1);
      } else onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(null);
    }
  };

  const section = (title: string, children: ReactNode, hint?: string) => (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
  const grid = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4";
  const shownExisting = (existing.data ?? []).filter((a) => !removed.includes(a.id));

  return (
    <Dialog
      open
      size="2xl"
      title={outlet ? `Edit ${outlet.name}` : "Outlet Create"}
      description={outlet ? outlet.code : "A new outlet can take orders once it is approved."}
      onClose={onClose}
      onSubmit={() => save(false)}
      footer={
        <>
          <Button onClick={onClose} disabled={!!saving}>
            Cancel
          </Button>
          {!outlet && (
            <Button onClick={() => save(true)} loading={saving === "new"} disabled={!!saving}>
              Save & New
            </Button>
          )}
          <Button type="submit" variant="primary" loading={saving === "save"} disabled={!!saving}>
            Save
          </Button>
        </>
      }
    >
      {opts.error ? (
        <ErrorState message={opts.error.message} onRetry={opts.reload} />
      ) : !o ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-6">
          {datalist("outlet-categories", o.categories)}
          {datalist("outlet-business-types", o.businessTypes)}
          {datalist("outlet-groups", o.outletGroups)}
          {section(
            "Outlet",
            <div className={grid}>
              <TextField label="Outlet name (English)" required value={v.name} maxLength={150} onChange={set("name")} />
              <TextField label="Outlet name (Bangla)" lang="bn" value={v.nameBn} maxLength={150} onChange={set("nameBn")} />
              <TextField label="Partner code" value={v.partnerCode} maxLength={30} onChange={set("partnerCode")} />
              <TextField label="Credit limit" type="number" min={0} step="any" value={v.creditLimit} onChange={set("creditLimit")} hint="Empty = no limit." />
              <TextField label="Outlet category" list="outlet-categories" value={v.category} maxLength={60} onChange={set("category")} />
              <TextField label="Business type" list="outlet-business-types" value={v.businessType} maxLength={60} onChange={set("businessType")} />
              <TextField label="Outlet group" list="outlet-groups" value={v.outletGroup} maxLength={60} onChange={set("outletGroup")} />
              <SelectField label="Distributor" required value={v.distributorId} onChange={set("distributorId")} options={options(o.distributors, (d) => `${d.code} · ${d.name}`, (d) => d.id, "Select distributor")} />
              <SelectField label="Distribution channel" value={v.channelId} onChange={set("channelId")} options={options(o.channels, (c) => c.name, (c) => c.id, "None")} />
            </div>,
          )}
          {section(
            "Location",
            <div className={grid}>
              <SelectField label="Division" value={v.division} onChange={(e) => setV((x) => ({ ...x, division: e.target.value, districtId: "", thanaId: "" }))} options={[{ value: "", label: "Select division" }, ...o.divisions.map((d) => ({ value: d, label: d }))]} />
              <SelectField label="District" value={v.districtId} onChange={(e) => setV((x) => ({ ...x, districtId: e.target.value, thanaId: "", division: x.division || (o.districts.find((d) => String(d.id) === e.target.value)?.division ?? "") }))} options={[{ value: "", label: "Select district" }, ...districts.map((d) => ({ value: String(d.id), label: d.name }))]} />
              <SelectField label="Thana / Upazila" value={v.thanaId} disabled={!v.districtId} onChange={set("thanaId")} options={[{ value: "", label: v.districtId && !thanas.length ? "No thana added for this district" : "Select thana / upazila" }, ...thanas.map((t) => ({ value: t.id, label: t.name }))]} />
              <TextField label="Latitude" type="number" step="any" min={-90} max={90} value={v.latitude} onChange={set("latitude")} />
              <TextAreaField label="Address" className="sm:col-span-2 lg:col-span-3" value={v.address} maxLength={300} onChange={set("address")} />
              <TextField label="Longitude" type="number" step="any" min={-180} max={180} value={v.longitude} onChange={set("longitude")} />
            </div>,
          )}
          {section(
            "Contact",
            <div className={grid}>
              <TextField label="Contact number" type="tel" inputMode="tel" value={v.phone} maxLength={30} onChange={set("phone")} />
              <TextField label="Owner number" type="tel" inputMode="tel" value={v.ownerPhone} maxLength={30} onChange={set("ownerPhone")} />
              <TextField label="Contact person" value={v.contactPerson} maxLength={150} onChange={set("contactPerson")} />
              <TextField label="Owner name" value={v.ownerName} maxLength={150} onChange={set("ownerName")} />
              <TextField label="Email address" type="email" value={v.email} maxLength={150} onChange={set("email")} />
              <TextField label="Trade license" value={v.tradeLicense} maxLength={60} onChange={set("tradeLicense")} />
              <TextField label="NID" inputMode="numeric" value={v.nid} maxLength={17} onChange={set("nid")} hint="10, 13 or 17 digits." />
              <TextField label="Date of birth" type="date" value={v.dateOfBirth} onChange={set("dateOfBirth")} />
              <TextField label="Serial" type="number" min={0} step={1} value={v.serial} onChange={set("serial")} />
              <SelectField label="Marital status" value={v.maritalStatus} onChange={set("maritalStatus")} options={[{ value: "", label: "—" }, ...["Single", "Married", "Divorced", "Widowed"].map((m) => ({ value: m, label: m }))]} />
            </div>,
          )}
          {section(
            "Market",
            <div className={grid}>
              <TextField label="Competitors name" value={v.competitors} maxLength={300} onChange={set("competitors")} />
              <TextField label="Item name" value={v.competitorItems} maxLength={300} onChange={set("competitorItems")} />
              <TextField label="Regular sales amount" type="number" min={0} step="any" value={v.regularSales} onChange={set("regularSales")} />
              <fieldset className="flex flex-col gap-1">
                <legend className="text-xs font-medium text-ink-muted">Sales period</legend>
                <div className="flex h-8 items-center gap-4">
                  {(["DAILY", "MONTHLY"] as const).map((p) => (
                    <label key={p} className="flex min-h-6 cursor-pointer items-center gap-1.5 text-[13px] text-ink">
                      <input type="radio" name="salesPeriod" value={p} checked={v.salesPeriod === p} onChange={set("salesPeriod")} className="size-4 accent-blue-600" />
                      {p === "DAILY" ? "Daily" : "Monthly"}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>,
          )}
          {section(
            "Outlet image and documents",
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <SelectField label="File type" className="w-44" value={fileKind} onChange={(e) => setFileKind(e.target.value as "IMAGE" | "DOCUMENT")} options={[{ value: "IMAGE", label: "Outlet image" }, { value: "DOCUMENT", label: "Other document" }]} />
                <label className="flex min-w-60 flex-1 flex-col gap-1">
                  <span className="text-xs font-medium text-ink-muted">{fileKind === "IMAGE" ? "Image (PNG, JPEG, WebP)" : "Document (PDF, PNG, JPEG, WebP)"}, 5 MB at most</span>
                  <input
                    key={fileInputKey}
                    type="file"
                    accept={fileKind === "IMAGE" ? "image/png,image/jpeg,image/webp" : "application/pdf,image/png,image/jpeg,image/webp"}
                    onChange={(e) => setFileInput(e.target.files?.[0] ?? null)}
                    className="text-[13px] file:mr-3 file:h-8 file:cursor-pointer file:rounded file:border file:border-line-strong file:bg-surface file:px-3 file:text-xs file:font-semibold file:text-ink-muted hover:file:bg-control"
                  />
                </label>
                <Button variant="accent-soft" onClick={addFile} className="mb-px">
                  <Plus /> Add
                </Button>
              </div>
              {shownExisting.length + pending.length > 0 && (
                <ul className="flex flex-col divide-y divide-line rounded border border-line">
                  {shownExisting.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
                      {a.kind === "IMAGE" ? <ImageIcon className="size-4 text-ink-faint" /> : <FileText className="size-4 text-ink-faint" />}
                      <a href={`/api/rtm/outlet-setup/${outlet!.id}/attachments/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                        {a.originalName}
                      </a>
                      <span className="text-xs text-ink-faint">{a.kind === "IMAGE" ? "Outlet image" : "Document"} · {kb(a.size)}</span>
                      <Button variant="ghost" size="icon" aria-label={`Remove ${a.originalName}`} title="Remove (on Save)" className="hover:text-danger" onClick={() => setRemoved([...removed, a.id])}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                  {pending.map((p) => (
                    <li key={p.key} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
                      {p.kind === "IMAGE" ? <ImageIcon className="size-4 text-ink-faint" /> : <FileText className="size-4 text-ink-faint" />}
                      <span className="min-w-0 flex-1 truncate">{p.file.name}</span>
                      <span className="text-xs text-ink-faint">{p.kind === "IMAGE" ? "Outlet image" : "Document"} · {kb(p.file.size)} · uploads on Save</span>
                      <Button variant="ghost" size="icon" aria-label={`Remove ${p.file.name}`} title="Remove" className="hover:text-danger" onClick={() => setPending(pending.filter((x) => x.key !== p.key))}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
          )}
          {section(
            "Area",
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <TerritoryFields withSr={false} value={areaPick} onChange={setAreaPick} territory={territory} />
                <Button variant="accent-soft" onClick={addArea} className="mb-px">
                  <Plus /> Add
                </Button>
              </div>
              {areas.length > 0 ? (
                <ol className="flex flex-col divide-y divide-line rounded border border-line">
                  {areas.map((id, i) => (
                    <li key={id} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
                      <span className="w-6 text-right text-xs text-ink-faint tabular-nums">{i + 1}</span>
                      {i === 0 && <Badge variant="primary">Main</Badge>}
                      <span className="min-w-0 flex-1 truncate">{(nodes.get(id)?.path ?? [id]).map((p) => nodes.get(p)?.name ?? "…").join(" › ")}</span>
                      <span className="text-xs text-ink-faint">{nodes.get(id)?.layer}</span>
                      <Button variant="ghost" size="icon" aria-label="Remove area" title="Remove" className="hover:text-danger" onClick={() => setAreas(areas.filter((x) => x !== id))}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-ink-muted">No area yet. The first area added is the outlet&apos;s main one (its Territory, Route, Market and Assigned SR in the list).</p>
              )}
            </div>,
            "Where the outlet is served. Pick down to the market, or stop at the route or base point.",
          )}
        </div>
      )}
    </Dialog>
  );
}

// ── Bulk upload ──────────────────────────────────────────────────────────────

function BulkUploadDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [templating, setTemplating] = useState(false);
  const template = async () => {
    setTemplating(true);
    try {
      await downloadFile("/api/rtm/outlet-setup/bulk/template", "outlet-upload-template.xlsx");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTemplating(false);
    }
  };
  const submit = async () => {
    if (!file) {
      toast.error("Choose the Excel file to upload.");
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const result = await apiRequest<{ created: number }>("/api/rtm/outlet-setup/bulk", { method: "POST", body });
      toast.success(`${result.created} outlet(s) created. They can take orders once approved.`);
      onDone();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      size="lg"
      title="Bulk Upload"
      description="Create many outlets from an Excel sheet. Each outlet waits for approval."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {!saving && <Upload />} Upload
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-ink-muted">
          Columns: Outlet Name and Distributor Code are required; Outlet Name (Bangla), Partner Code, Market Code (any area code from the Sales Territory tree), Contact Number, Owner Number, Contact Person, Address, Outlet Category, Business Type, Outlet Group and Credit Limit are optional. Every row is checked first; nothing is saved if a row is wrong.
        </p>
        <label className={cn("flex flex-col gap-1")}>
          <span className="text-xs font-medium text-ink-muted">Excel file (.xlsx)</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={cn(CONTROL, "h-auto py-1 text-[13px] file:mr-3 file:h-7 file:cursor-pointer file:rounded file:border file:border-line-strong file:bg-surface file:px-3 file:text-xs file:font-semibold file:text-ink-muted")} />
        </label>
        <div>
          <Button size="sm" variant="ghost" onClick={template} loading={templating}>
            {!templating && <FileSpreadsheet />} Download template
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
