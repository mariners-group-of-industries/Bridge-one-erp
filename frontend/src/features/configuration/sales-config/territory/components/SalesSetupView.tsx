"use client";

import { Check, Download, MapPinned, Pencil, Plus, Search, SquareMinus, SquarePlus, Trash2, Upload, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { CONTROL_CLASS, EmptyBlock, Input, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import { salesConfigPaths } from "../../paths";
import type { LayerDto, NodeDto, TerritoryTree } from "../schemas/territory.schema";
import { territoryApi } from "../services/territory.api";
import { TerritoryCustomersTab } from "./TerritoryCustomersTab";
import { AssignEmployeesDialog, NodeDialog, ScrollMore, useScrollLoad, type NodeDialogState } from "./territory-kit";

const BREADCRUMBS = entityMasterDataBreadcrumbs(salesConfigPaths.salesSetup);
const TABS = [
  { id: "territory", label: "Sales Territory" },
  { id: "customers", label: "Territory Wise Customer List" },
] as const;
type View = "tree" | "table" | "layers";

export function SalesSetupView() {
  const [unitId, setUnitId] = useState<string | undefined>();
  const tree = useResource(`territory-tree:${unitId ?? ""}`, () => territoryApi.tree(unitId));
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("territory");
  const [view, setView] = useState<View>("tree");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const data = tree.data;
  const businessUnitId = data?.businessUnitId ?? "";

  return (
    <PageContainer full>
      <PageHead
        title="Sales Setup"
        subtitle="Sales territory tree (National → Market), employee assignments and territory-wise customers."
        breadcrumbs={BREADCRUMBS}
        actions={
          <>
            {data && data.businessUnits.length > 1 && (
              <Select
                aria-label="Business unit"
                className="w-48"
                value={businessUnitId}
                placeholder={false}
                options={data.businessUnits.map((u) => ({
                  value: u.id,
                  label: u.name,
                }))}
                onChange={(e) => setUnitId(e.target.value)}
              />
            )}
            <form
              role="search"
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchText.trim());
              }}
            >
              <label className="relative w-full sm:w-56">
                <span className="sr-only">Search</span>
                <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
                <input
                  type="search"
                  value={searchText}
                  maxLength={100}
                  placeholder={tab === "territory" ? "Code or name…" : "Customer code or name…"}
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    if (event.target.value === "") setSearch("");
                  }}
                  className={cn(CONTROL_CLASS, "pl-8")}
                />
              </label>
              <Button type="submit">
                <Search /> Search
              </Button>
            </form>
            <a
              href={businessUnitId ? territoryApi.excelUrl(businessUnitId, tab === "territory" ? "tree" : "customers") : undefined}
              download
              aria-disabled={!businessUnitId}
              className={buttonClasses("secondary", "md")}
            >
              <Download /> Download Excel
            </a>
            <Button disabled={!businessUnitId} onClick={() => setUploadOpen(true)}>
              <Upload /> Upload Excel
            </Button>
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-xs">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Sales setup">
          {tree.error ? (
            <ErrorState message={tree.error.message} onRetry={tree.reload} />
          ) : !data ? (
            <LoadingState label="Loading territories…" />
          ) : !businessUnitId ? (
            <div className="p-5">
              <EmptyBlock icon={<MapPinned />} title="No business unit">
                Create a business unit in Company Profile first.
              </EmptyBlock>
            </div>
          ) : tab === "territory" ? (
            <TerritoryTab tree={data} view={view} onView={setView} search={search} onChanged={tree.reload} />
          ) : (
            <TerritoryCustomersTab tree={data} search={search} />
          )}
        </Tabs>
      </section>

      {businessUnitId && (
        <BulkUploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onImported={tree.reload}
          noun={tab === "territory" ? "territory entries" : "customer assignments"}
          templateUrl={tab === "territory" ? territoryApi.templateUrl(businessUnitId) : territoryApi.excelUrl(businessUnitId, "customers")}
          maxRows={5000}
          matchHint={
            tab === "territory"
              ? "One row per path: a code and name column for each layer. Existing codes are renamed, new codes are created."
              : "Columns Customer Code and Territory Code: each customer is moved into that territory."
          }
          upload={async (file) => {
            const result = await territoryApi.upload(businessUnitId, tab === "territory" ? "tree" : "customers", file);
            return {
              created: result.created + result.updated,
              errors: result.errors,
            };
          }}
        />
      )}
    </PageContainer>
  );
}

// ─── Sales Territory tab ──────────────────────────────────────────────────────

function TerritoryTab({ tree, view, onView, search, onChanged }: { tree: TerritoryTree; view: View; onView: (view: View) => void; search: string; onChanged: () => void }) {
  const toast = useToast();
  const [dialog, setDialog] = useState<NodeDialogState | null>(null);
  const [assignFor, setAssignFor] = useState<NodeDto | null>(null);
  const [deleting, setDeleting] = useState<NodeDto | null>(null);
  const [busy, setBusy] = useState(false);
  const layerOf = (level: number) => tree.layers.find((layer) => layer.level === level);

  const actions = {
    add: (parent: NodeDto | null) => {
      const layer = layerOf(parent ? parent.level + 1 : 1);
      if (!layer) {
        toast.error("There is no layer below this one. Add one in Layer Setup.");
        return;
      }
      setDialog({
        mode: "add",
        layerName: layer.name,
        businessUnitId: tree.businessUnitId,
        parentId: parent?.id ?? "",
        code: "",
        name: "",
      });
    },
    edit: (node: NodeDto) =>
      setDialog({
        mode: "edit",
        layerName: layerOf(node.level)?.name ?? "Entry",
        businessUnitId: tree.businessUnitId,
        parentId: node.parentId ?? "",
        nodeId: node.id,
        code: node.code,
        name: node.name,
      }),
    assign: setAssignFor,
    remove: setDeleting,
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-3">
        <div role="radiogroup" aria-label="View" className="flex flex-wrap items-center gap-4">
          {(
            [
              ["tree", "Tree View"],
              ["table", "Table View"],
              ["layers", "Layer Setup"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink">
              <input type="radio" name="territory-view" value={value} checked={view === value} onChange={() => onView(value)} className="size-4 accent-(--accent-strong)" />
              {label}
            </label>
          ))}
        </div>
        {view === "tree" && tree.layers[0] && (
          <Button variant="accent-soft" className="ml-auto" onClick={() => actions.add(null)}>
            <Plus /> Add {tree.layers[0].name}
          </Button>
        )}
      </div>

      {view === "tree" && <TreeView tree={tree} search={search} actions={actions} />}
      {view === "table" && <TableView tree={tree} search={search} />}
      {view === "layers" && <LayerSetup tree={tree} onChanged={onChanged} />}

      <NodeDialog state={dialog} onClose={() => setDialog(null)} onSaved={onChanged} />
      <AssignEmployeesDialog node={assignFor} onClose={() => setAssignFor(null)} onChanged={onChanged} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete entry?"
        message={deleting ? `Delete "${deleting.name}"? Entries with sub-entries or customers cannot be deleted.` : ""}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await territoryApi.deleteNode(deleting.id);
            toast.success(`"${deleting.name}" deleted.`);
            setDeleting(null);
            onChanged();
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

type Actions = {
  add: (parent: NodeDto | null) => void;
  edit: (node: NodeDto) => void;
  assign: (node: NodeDto) => void;
  remove: (node: NodeDto) => void;
};

function NodeButtons({ node, tree, actions, compact = false }: { node: NodeDto; tree: TerritoryTree; actions: Actions; compact?: boolean }) {
  const child = tree.layers.find((layer) => layer.level === node.level + 1);
  return (
    <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
      {child &&
        (compact ? (
          <Button
            variant="ghost"
            size="icon"
            className="hover:text-accent-strong"
            aria-label={`Add ${child.name} under ${node.name}`}
            title={`Add ${child.name}`}
            onClick={() => actions.add(node)}
          >
            <Plus />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="hover:text-accent-strong" onClick={() => actions.add(node)} title={`Add ${child.name} under ${node.name}`}>
            <Plus /> {child.name}
          </Button>
        ))}
      <Button size="sm" variant="ghost" className="hover:text-accent-strong" onClick={() => actions.assign(node)} title="Assign employees">
        <Users /> {node.employeeCount}
      </Button>
      <Button variant="ghost" size="icon" className="hover:text-accent-strong" aria-label={`Update ${node.name}`} title="Update" onClick={() => actions.edit(node)}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Delete ${node.name}`} title="Delete" onClick={() => actions.remove(node)}>
        <Trash2 />
      </Button>
    </div>
  );
}

/** Nodes matching the search plus all their ancestors (so matches stay in context). */
function useVisibleIds(tree: TerritoryTree, search: string) {
  return useMemo(() => {
    if (!search) return null;
    const needle = search.toLowerCase();
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    const ids = new Set<string>();
    for (const node of tree.nodes) {
      if (node.code.toLowerCase().includes(needle) || node.name.toLowerCase().includes(needle)) {
        for (let current: NodeDto | undefined = node; current; current = current.parentId ? byId.get(current.parentId) : undefined) ids.add(current.id);
      }
    }
    return ids;
  }, [tree.nodes, search]);
}

function TreeView({ tree, search, actions }: { tree: TerritoryTree; search: string; actions: Actions }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const visible = useVisibleIds(tree, search);
  const childrenOf = useMemo(() => {
    const map = new Map<string, NodeDto[]>();
    for (const node of tree.nodes) map.set(node.parentId ?? "", [...(map.get(node.parentId ?? "") ?? []), node]);
    return map;
  }, [tree.nodes]);

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // A classic outline (as in Managerium): ⊟ / ⊞ boxes and guide lines, names only;
  // the entry's buttons show on hover / focus. Searching opens every match.
  const branch = (parentId: string, root: boolean) => {
    const nodes = (childrenOf.get(parentId) ?? []).filter((node) => !visible || visible.has(node.id));
    if (nodes.length === 0) return null;
    return (
      <ul role={root ? "tree" : "group"} aria-label={root ? "Sales territories" : undefined} className={cn(!root && "ml-2 border-l border-line-strong pl-4")}>
        {nodes.map((node) => {
          const hasChildren = (childrenOf.get(node.id) ?? []).length > 0;
          const open = !!visible || !collapsed.has(node.id);
          const layer = tree.layers.find((l) => l.level === node.level);
          const Box = open ? SquareMinus : SquarePlus;
          return (
            <li key={node.id} role="treeitem" aria-level={node.level} aria-expanded={hasChildren ? open : undefined} aria-selected={false}>
              <div
                className={cn(
                  "group relative flex min-h-8 items-center gap-2 rounded pr-1 hover:bg-grid-hover",
                  !root && "before:absolute before:top-1/2 before:-left-4 before:w-3.5 before:border-t before:border-line-strong",
                )}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
                    onClick={() => toggle(node.id)}
                    className="flex size-4 shrink-0 items-center justify-center text-ink-muted hover:text-accent-strong"
                  >
                    <Box className="size-3.5" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="size-4 shrink-0" />
                )}
                <span className="text-sm text-ink" title={`${layer?.name ?? ""} · ${node.code}`}>
                  {node.name}
                </span>
                {node.customerCount !== null && <span className="text-xs text-ink-faint">({node.customerCount} customers)</span>}
                <div className="ml-auto opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <NodeButtons node={node} tree={tree} actions={actions} compact />
                </div>
              </div>
              {hasChildren && open && branch(node.id, false)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 overflow-x-auto rounded-md border border-line px-3 py-2">
        {tree.nodes.length === 0 ? (
          <div className="p-3">
            <EmptyBlock icon={<MapPinned />} title="No territories yet">
              Start with “Add {tree.layers[0]?.name ?? "National"}”, then add the levels below it.
            </EmptyBlock>
          </div>
        ) : (
          (branch("", true) ?? <p className="px-4 py-8 text-center text-sm text-ink-faint">Nothing matches “{search}”.</p>)
        )}
      </div>
      <LayersPanel layers={tree.layers} />
    </div>
  );
}

/**
 * One row per entry in tree order, the name under its own layer's column (a stepped
 * table, as in Managerium), with the layers listed beside it. Read only: entries are
 * added and changed in the Tree View.
 */
function TableView({ tree, search }: { tree: TerritoryTree; search: string }) {
  const visible = useVisibleIds(tree, search);
  const rows = useMemo(() => {
    const childrenOf = new Map<string, NodeDto[]>();
    for (const node of tree.nodes) childrenOf.set(node.parentId ?? "", [...(childrenOf.get(node.parentId ?? "") ?? []), node]);
    const ordered: NodeDto[] = [];
    const walk = (parentId: string) => {
      for (const node of childrenOf.get(parentId) ?? []) {
        if (visible && !visible.has(node.id)) continue;
        ordered.push(node);
        walk(node.id);
      }
    };
    walk("");
    return ordered;
  }, [tree.nodes, visible]);
  const scroll = useScrollLoad(rows.length, `${search}|${tree.nodes.length}`);

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 overflow-hidden rounded-md border border-line">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-faint">{search ? `Nothing matches “${search}”.` : "No territories yet. Add them in the Tree View."}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-grid w-full min-w-max">
                <thead>
                  <tr>
                    {tree.layers.map((layer) => (
                      <th key={layer.id} scope="col" className="px-2.5 py-2 text-left">
                        {layer.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, scroll.count).map((node) => (
                    <tr key={node.id}>
                      {tree.layers.map((layer) => (
                        <td key={layer.id} className="px-2.5 py-1.5 whitespace-nowrap">
                          {layer.level === node.level && (
                            <>
                              <span className="font-medium text-ink">{node.name}</span> <span className="text-xs text-ink-faint">{node.code}</span>
                            </>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ScrollMore sentinel={scroll.sentinel} hasMore={scroll.hasMore} shown={scroll.count} total={rows.length} noun="entries" />
          </>
        )}
      </div>

      <LayersPanel layers={tree.layers} />
    </div>
  );
}

/** The layers beside the tree and table views (SL, code, name). */
function LayersPanel({ layers }: { layers: LayerDto[] }) {
  return (
    <section aria-label="Layers" className="self-start overflow-hidden rounded-md border border-line">
      <h3 className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">Layers</h3>
      <table className="data-grid w-full">
        <thead>
          <tr>
            {["SL", "Code", "Layer Name"].map((h) => (
              <th key={h} scope="col" className="px-2.5 py-2 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {layers.map((layer) => (
            <tr key={layer.id}>
              <td className="w-10 px-2.5 py-1.5 text-right text-ink-faint tabular-nums">{layer.level}</td>
              <td className="px-2.5 py-1.5 font-medium">{layer.code}</td>
              <td className="px-2.5 py-1.5">{layer.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ─── Layer setup ──────────────────────────────────────────────────────────────

function LayerSetup({ tree, onChanged }: { tree: TerritoryTree; onChanged: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: "", name: "" });
  const [busy, setBusy] = useState(false);
  const deepest = tree.layers[tree.layers.length - 1];

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      setEditing(null);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const editorCells = (onSave: () => void) => (
    <>
      <td className="px-2 py-1.5">
        <Input aria-label="Layer code" autoFocus value={draft.code} maxLength={20} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
      </td>
      <td className="px-2 py-1.5">
        <Input aria-label="Layer name" value={draft.name} maxLength={50} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </td>
      <td className="px-2.5 py-2" />
      <td className="px-1.5 py-1 text-center whitespace-nowrap">
        <Button variant="accent" size="icon" loading={busy} aria-label="Save layer" onClick={onSave}>
          {!busy && <Check />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Cancel" onClick={() => setEditing(null)}>
          <X />
        </Button>
      </td>
    </>
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <p className="text-xs text-ink-faint">Layers run from the top (1) down. The Territory layer is linked to the Sales territories customers use.</p>
        <Button
          variant="accent-soft"
          className="ml-auto"
          onClick={() => {
            setEditing("new");
            setDraft({ code: "", name: "" });
          }}
        >
          <Plus /> Add Layer
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="data-grid w-full min-w-[640px]">
          <thead>
            <tr>
              {["SL", "Code", "Layer Name", "Entries", "Action"].map((h) => (
                <th key={h} scope="col" className="px-2.5 py-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tree.layers.map((layer: LayerDto) => (
              <tr key={layer.id}>
                <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{layer.level}</td>
                {editing === layer.id ? (
                  editorCells(() => run(() => territoryApi.updateLayer(layer.id, draft), "Layer saved."))
                ) : (
                  <>
                    <td className="px-2.5 py-2 font-medium">{layer.code}</td>
                    <td className="px-2.5 py-2">
                      {layer.name}
                      {layer.isTerritory && (
                        <span className="ml-2 rounded border border-accent-line bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-strong uppercase dark:text-accent">Linked to Sales</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums">{layer.nodeCount}</td>
                    <td className="w-28 px-1.5 py-1 text-center whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-accent-strong"
                        aria-label={`Edit ${layer.name}`}
                        onClick={() => {
                          setEditing(layer.id);
                          setDraft({ code: layer.code, name: layer.name });
                        }}
                      >
                        <Pencil />
                      </Button>
                      {layer.id === deepest?.id && !layer.isTerritory && layer.nodeCount === 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-danger"
                          aria-label={`Delete ${layer.name}`}
                          disabled={busy}
                          onClick={() => run(() => territoryApi.deleteLayer(layer.id), "Layer removed.")}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {editing === "new" && (
              <tr>
                <td className="px-2.5 py-2 text-right text-ink-faint tabular-nums">{(deepest?.level ?? 0) + 1}</td>
                {editorCells(() => run(() => territoryApi.addLayer(tree.businessUnitId, draft), "Layer added."))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
