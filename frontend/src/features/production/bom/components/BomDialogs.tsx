"use client";

import { Plus, Printer, Trash2 } from "lucide-react";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/form-field";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { Combobox } from "../../components/Combobox";
import { BOM_TYPE_LABELS, OUTPUT_TYPE_LABELS, WASTAGE_TYPE_LABELS, bomChildrenSchema, type BomDetail, type BomOption, type BomRow } from "../schemas/bom.schema";
import { downloadBomPdf, fetchBom, searchBomOptions, setBomChildren } from "../services/bom.api";

export const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const qty = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 4 });
const dash = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? "—" : value);

/** Table classes that draw a border around every cell. */
const GRID_TABLE = "border-collapse [&_td]:border [&_td]:border-line-strong [&_th]:border [&_th]:border-line-strong";

export interface SimpleColumn {
  header: string;
  align?: "right" | "center";
  className?: string;
}

/**
 * Bordered line table of the BOM pages (blue header, optional bold footer rows). With
 * `footerLabelSpan`, each footer row starts with a right-aligned label spanning that many
 * columns ("Total Of Raw Material:"), followed by one cell per remaining column.
 */
export function LineTable({
  columns,
  rows,
  footer = [],
  footerLabelSpan,
  empty,
  grid = false,
}: {
  columns: SimpleColumn[];
  rows: ReactNode[][];
  footer?: ReactNode[][];
  footerLabelSpan?: number;
  empty?: string;
  /** Border on every cell (report look of the details dialog). */
  grid?: boolean;
}) {
  const align = (column: SimpleColumn) => (column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left");
  return (
    <div className={grid ? "overflow-x-auto shadow-sm" : "overflow-x-auto rounded-md border border-line"}>
      <table className={cn("w-full text-sm", grid && GRID_TABLE)}>
        <thead className="bg-accent-soft text-xs text-ink">
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col" className={cn("px-3 py-2 font-semibold whitespace-nowrap", align(column), column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-center text-ink-faint">
                {empty ?? "Nothing added yet."}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-t border-line">
                {row.map((cell, column) => (
                  <td key={column} className={cn("px-3 py-2 text-ink-muted tabular-nums", align(columns[column]))}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer.length > 0 && (
          <tfoot className="bg-canvas font-semibold text-ink">
            {footer.map((row, index) => (
              <tr key={index} className="border-t border-line-strong">
                {footerLabelSpan ? (
                  <>
                    <td colSpan={footerLabelSpan} className="px-3 py-2 text-right">
                      {row[0]}
                    </td>
                    {row.slice(1).map((cell, column) => (
                      <td key={column} className={cn("px-3 py-2 tabular-nums", align(columns[column + footerLabelSpan]))}>
                        {cell}
                      </td>
                    ))}
                  </>
                ) : (
                  row.map((cell, column) => (
                    <td key={column} className={cn("px-3 py-2 tabular-nums", align(columns[column]))}>
                      {cell}
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** "Label : Value" in the details header line (as in Managerium). */
function Pair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1 text-sm">
      <dt className="text-ink-muted">{label} :</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

const qty6 = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 });

interface MaterialSums {
  altQty: number;
  qty: number;
  totalQty: number;
  amount: number;
}

const sumMaterials = (lines: BomDetail["materials"]): MaterialSums =>
  lines.reduce(
    (sum, line) => ({
      altQty: sum.altQty + (line.altQty ?? 0),
      qty: sum.qty + line.qty,
      totalQty: sum.totalQty + line.totalQty,
      amount: sum.amount + line.amount,
    }),
    { altQty: 0, qty: 0, totalQty: 0, amount: 0 },
  );

const MATERIAL_COLUMNS: SimpleColumn[] = [
  { header: "SL", className: "w-12" },
  { header: "Materials" },
  { header: "Type" },
  { header: "Exclude From Scrap" },
  { header: "Alt. Quantity", align: "right" },
  { header: "Quantity", align: "right" },
  { header: "Wastage (%)", align: "right" },
  { header: "Total Quantity", align: "right" },
  { header: "Avg. Rate", align: "right" },
  { header: "Total", align: "right" },
];

/** Bold "label + totals" row of the materials table (group subtotal, overhead, grand total). */
function SumRow({ label, sums, amount }: { label: string; sums?: MaterialSums; amount: number }) {
  return (
    <tr className="border-t border-line-strong bg-canvas font-semibold text-ink tabular-nums">
      <td colSpan={4} className="px-3 py-2 text-right">
        {label}
      </td>
      <td className="px-3 py-2 text-right">{sums ? money(sums.altQty) : ""}</td>
      <td className="px-3 py-2 text-right">{sums ? qty6(sums.qty) : ""}</td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2 text-right">{sums ? money(sums.totalQty) : ""}</td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2 text-right">{money(amount)}</td>
    </tr>
  );
}

/** Input materials grouped by type (Raw Material, Packaging Material …), each with its subtotal, then the grand total. */
function MaterialsTable({ bom }: { bom: BomDetail }) {
  const groups = new Map<string, BomDetail["materials"]>();
  for (const line of bom.materials) {
    const type = line.materialType || "Other Material";
    groups.set(type, [...(groups.get(type) ?? []), line]);
  }
  const all = sumMaterials(bom.materials);
  const cell = (column: number) =>
    cn("px-3 py-2 text-ink-muted tabular-nums", MATERIAL_COLUMNS[column].align === "right" ? "text-right" : "text-left");
  return (
    <div className="overflow-x-auto shadow-sm">
      <table className={cn("w-full text-sm", GRID_TABLE)}>
        <thead className="bg-accent-soft text-xs text-ink">
          <tr>
            {MATERIAL_COLUMNS.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn("px-3 py-2 font-semibold whitespace-nowrap", column.align === "right" ? "text-right" : "text-left", column.className)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...groups].map(([type, lines]) => (
            <Fragment key={type}>
              {lines.map((line, index) => (
                <tr key={line.itemId} className="border-t border-line">
                  <td className={cell(0)}>{index + 1}</td>
                  <td className={cn(cell(1), "text-ink")}>{`${line.code} - ${line.name} (${line.uom})`}</td>
                  <td className={cell(2)}>{dash(line.materialType)}</td>
                  <td className={cell(3)}>{line.excludeFromScrap ? "Yes" : "No"}</td>
                  <td className={cell(4)}>{line.altQty === null ? "" : `${qty(line.altQty)} ${line.altUom ?? ""}`}</td>
                  <td className={cn(cell(5), "whitespace-nowrap")}>{`${qty6(line.qty)} ${line.uom}`}</td>
                  <td className={cell(6)}>{money(line.wastagePercent)}</td>
                  <td className={cell(7)}>{money(line.totalQty)}</td>
                  <td className={cell(8)}>{money(line.rate)}</td>
                  <td className={cell(9)}>{money(line.amount)}</td>
                </tr>
              ))}
              <SumRow label={`Total Of ${type}:`} sums={sumMaterials(lines)} amount={sumMaterials(lines).amount} />
            </Fragment>
          ))}
          {bom.overheadCost > 0 && <SumRow label="Overhead:" amount={bom.overheadCost} />}
          <SumRow label="Grand Total:" sums={all} amount={bom.totalCost} />
        </tbody>
      </table>
    </div>
  );
}

/** "Bill Of Material Details" of the list's view (eye) action. */
export function BomDetailsDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const toast = useToast();
  const detail = useResource(id ? `bom:${id}` : null, () => fetchBom(id!));
  const [downloading, setDownloading] = useState(false);
  const bom = detail.data;

  async function pdf() {
    if (!id) return;
    setDownloading(true);
    try {
      await downloadBomPdf(id);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  // Tolerance and Primary only matter when a line has a tolerance / there are several outputs.
  const showOutputTolerance = bom?.outputLines.some((line) => line.tolerancePercent !== null) ?? false;
  const showPrimary = (bom?.outputLines.length ?? 0) > 1;
  const outputColumns: SimpleColumn[] = [
    { header: "SL", className: "w-12" },
    { header: "Item" },
    { header: "Item Type" },
    { header: "Net Weight" },
    { header: "Lot Size/Quantity", align: "right" },
    { header: "Total Weight", align: "right" },
    ...(showOutputTolerance ? [{ header: "Tolerance (%)", align: "right" as const }] : []),
    { header: "Cost Percentage", align: "right" },
    ...(showPrimary ? [{ header: "Primary", align: "center" as const }] : []),
  ];

  return (
    <Dialog
      open={id !== null}
      title="Bill Of Material Details"
      titleClassName="text-xl! font-medium! tracking-normal!"
      size="2xl"
      className="max-w-[96rem]!"
      onClose={onClose}
      footer={
        <Button variant="ghost" className="text-base! font-medium text-danger! hover:text-danger!" onClick={onClose}>
          CLOSE
        </Button>
      }
    >
      {detail.error ? (
        <ErrorState message={errorMessage(detail.error)} onRetry={detail.reload} />
      ) : !bom ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <dl className="contents">
              <Pair label="BOM Type" value={BOM_TYPE_LABELS[bom.bomType]} />
              <Pair label="BOM Name" value={bom.name} />
              <Pair label="Department" value={bom.departmentName ?? "N/A"} />
              <Pair label="Section" value={bom.sectionName ?? "N/A"} />
              <Pair label="Tolerance" value={bom.tolerancePercent === null ? "N/A" : `${qty(bom.tolerancePercent)}%`} />
            </dl>
            <Button variant="primary" size="sm" onClick={pdf} loading={downloading}>
              <Printer aria-hidden="true" />
              PDF
            </Button>
          </div>

          <section aria-labelledby="bom-outputs" className="flex flex-col gap-2">
            <h3 id="bom-outputs" className="text-lg font-medium text-ink">
              Production Items
            </h3>
            <LineTable
              grid
              columns={outputColumns}
              rows={bom.outputLines.map((line, index) => [
                index + 1,
                <span key="item" className="text-ink">{`${line.code} - ${line.name} (${line.uom})`}</span>,
                OUTPUT_TYPE_LABELS[line.outputType],
                qty(line.netWeight),
                money(line.lotSizeQty),
                money(line.totalWeight),
                ...(showOutputTolerance ? [line.tolerancePercent === null ? "—" : qty(line.tolerancePercent)] : []),
                qty(line.costPercent),
                ...(showPrimary ? [line.isPrimary ? "Yes" : "No"] : []),
              ])}
            />
          </section>

          <section aria-labelledby="bom-materials" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="bom-materials" className="text-lg font-medium text-ink">
                Input Materials
              </h3>
              <p className="text-lg text-ink">
                Material Total : <span className="font-semibold">{money(bom.materialCost)}</span>
              </p>
            </div>
            <MaterialsTable bom={bom} />
          </section>

          {bom.wastages.length > 0 && (
            <section aria-labelledby="bom-wastages" className="flex flex-col gap-2">
              <h3 id="bom-wastages" className="text-sm font-semibold text-ink">
                Other / Wastage Output
              </h3>
              <LineTable
                columns={[
                  { header: "SL", className: "w-12" },
                  { header: "Item" },
                  { header: "Item Type" },
                  { header: "Output Type" },
                  { header: "Ratio Qty (%)", align: "right" },
                  { header: "Expected Qty", align: "right" },
                  { header: "Mandatory", align: "center" },
                  { header: "With Net Weight", align: "center" },
                  { header: "With Process Runner", align: "center" },
                ]}
                rows={bom.wastages.map((line, index) => [
                  index + 1,
                  <span key="item" className="text-ink">{`${line.code} - ${line.name} (${line.uom})`}</span>,
                  dash(line.itemType),
                  WASTAGE_TYPE_LABELS[line.outputType],
                  qty(line.ratioPercent),
                  `${qty(line.expectedQty)} ${line.uom}`,
                  line.isMandatory ? "Yes" : "No",
                  line.calcWithNetWeight ? "Yes" : "No",
                  line.calcWithProcessRunner ? "Yes" : "No",
                ])}
              />
            </section>
          )}

          {bom.overheads.length > 0 && (
            <section aria-labelledby="bom-overheads" className="flex flex-col gap-2">
              <h3 id="bom-overheads" className="text-sm font-semibold text-ink">
                Overheads
              </h3>
              <LineTable
                columns={[{ header: "SL", className: "w-12" }, { header: "Account Code" }, { header: "Account Name" }, { header: "Percentage", align: "right" }, { header: "Amount", align: "right" }]}
                rows={bom.overheads.map((line, index) => [index + 1, line.accountCode, line.accountName, line.percentage === null ? "—" : `${qty(line.percentage)}%`, money(line.amount)])}
                footer={[["", "", "Total Overhead", "", money(bom.overheadCost)]]}
              />
            </section>
          )}

          {(bom.children.length > 0 || bom.parents.length > 0) && (
            <section aria-labelledby="bom-children" className="flex flex-col gap-2">
              <h3 id="bom-children" className="text-sm font-semibold text-ink">
                Child BOM
              </h3>
              <LineTable
                columns={[{ header: "SL", className: "w-12" }, { header: "Child BOM" }, { header: "Stage/Level" }, { header: "BOM Value", align: "right" }]}
                rows={bom.children.map((link, index) => [index + 1, link.name, link.stage, money(link.totalCost)])}
                empty="No child BOM tagged."
              />
              {bom.parents.length > 0 && (
                <p className="text-xs text-ink-faint">Used as a child of: {bom.parents.map((parent) => `${parent.name} (${parent.stage})`).join(", ")}</p>
              )}
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** Active BOMs whose name contains `term` (3+ letters), or the first ones when it is empty; debounced. */
function useBomSearch(term: string, exclude?: string) {
  const [found, setFound] = useState<{ term: string; rows: BomOption[]; error?: string } | null>(null);
  const wanted = term.trim();
  const searchable = wanted.length === 0 || wanted.length >= 3;
  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        searchBomOptions(wanted, exclude).then(
          (rows) => !cancelled && setFound({ term: wanted, rows }),
          (error: unknown) => !cancelled && setFound({ term: wanted, rows: [], error: errorMessage(error) }),
        );
      },
      wanted ? 300 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wanted, searchable, exclude]);
  return { rows: found?.rows ?? [], error: found?.error, searchable, ready: searchable && found?.term === wanted };
}

interface DraftLink {
  childBomId: string;
  name: string;
  stage: string;
}

/** "Tag Child BOM": multi-level BOM links of one parent. */
export function TagChildDialog({ bom, onClose, onSaved }: { bom: BomRow | null; onClose: () => void; onSaved: () => void }) {
  return bom ? <TagChild key={bom.id} bom={bom} onClose={onClose} onSaved={onSaved} /> : null;
}

function TagChild({ bom, onClose, onSaved }: { bom: BomRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const detail = useResource(`bom:${bom.id}`, () => fetchBom(bom.id));
  const [links, setLinks] = useState<DraftLink[] | null>(null);
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<BomOption | null>(null);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const search = useBomSearch(term, bom.id);

  const current: DraftLink[] = links ?? detail.data?.children.map((link) => ({ childBomId: link.childBomId, name: link.name, stage: link.stage })) ?? [];
  const childOptions = search.rows.filter((option) => !current.some((link) => link.childBomId === option.id)).map((option) => ({ value: option.id, label: option.name }));

  function add() {
    if (!picked) return setError("Child BOM Name is required.");
    if (!stage.trim()) return setError("Stage/Level is required.");
    if (current.some((link) => link.childBomId === picked.id)) return setError(`${picked.name} is already tagged.`);
    setLinks([...current, { childBomId: picked.id, name: picked.name, stage: stage.trim() }]);
    setPicked(null);
    setTerm("");
    setStage("");
    setError(undefined);
  }

  async function save(closeAfter: boolean) {
    const input = { links: current.map(({ childBomId, stage: level }) => ({ childBomId, stage: level })) };
    const parsed = bomChildrenSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setBusy(true);
    try {
      const saved = await setBomChildren(bom.id, input);
      toast.success(`${saved.children.length} child BOM tagged to ${bom.name}.`);
      onSaved();
      if (closeAfter) onClose();
      else {
        setLinks(saved.children.map((link) => ({ childBomId: link.childBomId, name: link.name, stage: link.stage })));
        setPicked(null);
        setTerm("");
        setStage("");
        setError(undefined);
      }
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title="Tag Child BOM"
      description={`Parent BOM: ${bom.name}`}
      size="lg"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" className="text-danger" onClick={onClose} disabled={busy}>
            CLOSE
          </Button>
          <Button onClick={() => save(false)} disabled={busy || !detail.data}>
            SAVE AND NEW
          </Button>
          <Button variant="primary" onClick={() => save(true)} loading={busy} disabled={!detail.data}>
            SAVE
          </Button>
        </>
      }
    >
      {detail.error ? (
        <ErrorState message={errorMessage(detail.error)} onRetry={detail.reload} />
      ) : !detail.data ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid items-start gap-3 sm:grid-cols-[1fr_12rem_auto]">
            <Combobox
              label="Child BOM Name"
              required
              placeholder="Select/Search BOM (min 3 letters)"
              value={picked?.id ?? ""}
              selectedLabels={picked ? { [picked.id]: picked.name } : undefined}
              filter={false}
              options={childOptions}
              loading={search.searchable && !search.ready}
              emptyText={!search.searchable ? "Type at least 3 letters." : (search.error ?? "No active BOM matches.")}
              onQueryChange={setTerm}
              onChange={(id) => {
                setPicked(search.rows.find((option) => option.id === id) ?? null);
                setError(undefined);
              }}
            />
            <TextField label="Stage/Level" required maxLength={50} placeholder="Stage/Level" value={stage} onChange={(event) => setStage(event.target.value)} />
            <Button variant="primary" className="sm:mt-5" onClick={add}>
              <Plus aria-hidden="true" />
              Add
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <LineTable
            columns={[{ header: "SL", className: "w-12" }, { header: "Child BOM" }, { header: "Stage/Level" }, { header: "Remove", align: "center", className: "w-20" }]}
            rows={current.map((link, index) => [
              index + 1,
              <span key="name" className="text-ink">{link.name}</span>,
              link.stage,
              <Button
                key="remove"
                size="icon"
                variant="ghost"
                className="text-danger"
                aria-label={`Remove ${link.name}`}
                onClick={() => setLinks(current.filter((item) => item.childBomId !== link.childBomId))}
              >
                <Trash2 aria-hidden="true" />
              </Button>,
            ])}
            empty="No child BOM tagged yet."
          />
        </div>
      )}
    </Dialog>
  );
}

/** "Copy Bill Of Material": choose a BOM, then open the create page filled with it. */
export function CopyBomDialog({ open, rows, onClose, onCopy }: { open: boolean; rows: readonly BomRow[]; onClose: () => void; onCopy: (id: string) => void }) {
  const [id, setId] = useState("");
  const [error, setError] = useState<string>();
  return (
    <Dialog
      open={open}
      title="Copy Bill Of Material"
      description="The new BOM starts with every line of the chosen one; give it a new name and save."
      onClose={onClose}
      onSubmit={() => (id ? onCopy(id) : setError("Choose the BOM to copy."))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Copy
          </Button>
        </>
      }
    >
      <Combobox
        label="Bill Of Material"
        required
        placeholder="Select/Search BOM"
        value={id}
        error={error}
        options={rows.map((row) => ({ value: row.id, label: row.name }))}
        emptyText="No BOM matches."
        onChange={(value) => {
          setId(value);
          setError(undefined);
        }}
      />
    </Dialog>
  );
}
