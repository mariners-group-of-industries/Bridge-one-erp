"use client";

import { FileDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/form-field";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { paths } from "../../paths";
import { BOM_TYPE_LABELS, OUTPUT_TYPE_LABELS, WASTAGE_TYPE_LABELS, bomChildrenSchema, type BomOption, type BomRow } from "../schemas/bom.schema";
import { downloadBomPdf, fetchBom, searchBomOptions, setBomChildren } from "../services/bom.api";

export const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const qty = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 4 });
const dash = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? "—" : value);

export interface SimpleColumn {
  header: string;
  align?: "right" | "center";
  className?: string;
}

/** Bordered line table of the BOM pages (blue header, optional bold footer rows). */
export function LineTable({ columns, rows, footer = [], empty }: { columns: SimpleColumn[]; rows: ReactNode[][]; footer?: ReactNode[][]; empty?: string }) {
  const align = (column: SimpleColumn) => (column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left");
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full text-sm">
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
                {row.map((cell, column) => (
                  <td key={column} className={cn("px-3 py-2 tabular-nums", align(columns[column]))}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_auto_1fr] gap-x-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <span aria-hidden="true" className="text-ink-faint">
        :
      </span>
      <dd className="font-medium text-ink">{value}</dd>
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

  const materialQty = bom?.materials.reduce((sum, line) => sum + line.qty, 0) ?? 0;
  const materialTotalQty = bom?.materials.reduce((sum, line) => sum + line.totalQty, 0) ?? 0;

  return (
    <Dialog
      open={id !== null}
      title="Bill Of Material Details"
      size="xl"
      className="max-w-7xl"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" className="text-danger" onClick={onClose}>
            CLOSE
          </Button>
          {id && (
            <Link href={paths.editBom(id)} className={buttonClasses("primary")}>
              <Pencil aria-hidden="true" />
              EDIT
            </Link>
          )}
        </>
      }
    >
      {detail.error ? (
        <ErrorState message={errorMessage(detail.error)} onRetry={detail.reload} />
      ) : !bom ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start gap-4">
            <dl className="grid flex-1 gap-x-8 gap-y-1 md:grid-cols-2">
              <Pair label="BOM Name" value={bom.name} />
              <Pair label="BOM Type" value={BOM_TYPE_LABELS[bom.bomType]} />
              <Pair label="Department" value={dash(bom.departmentName)} />
              <Pair label="Section" value={dash(bom.sectionName)} />
              <Pair label="Lot Size" value={qty(bom.lotSize)} />
              <Pair label="Tolerance (%)" value={bom.tolerancePercent === null ? "—" : qty(bom.tolerancePercent)} />
              <Pair label="Status" value={bom.isActive ? "Active" : "Inactive"} />
              <Pair label="Created By" value={bom.createdByName} />
            </dl>
            <Button onClick={pdf} loading={downloading}>
              <FileDown aria-hidden="true" />
              PDF
            </Button>
          </div>

          <section aria-labelledby="bom-outputs" className="flex flex-col gap-2">
            <h3 id="bom-outputs" className="text-sm font-semibold text-ink">
              Production Items
            </h3>
            <LineTable
              columns={[
                { header: "SL", className: "w-12" },
                { header: "Item" },
                { header: "Item Type" },
                { header: "Net Weight", align: "right" },
                { header: "Lot Size/Quantity", align: "right" },
                { header: "Total Weight", align: "right" },
                { header: "Tolerance (%)", align: "right" },
                { header: "Cost Percentage", align: "right" },
                { header: "Primary", align: "center" },
              ]}
              rows={bom.outputLines.map((line, index) => [
                index + 1,
                <span key="item" className="text-ink">{`${line.code} - ${line.name} (${line.uom})`}</span>,
                OUTPUT_TYPE_LABELS[line.outputType],
                qty(line.netWeight),
                qty(line.lotSizeQty),
                qty(line.totalWeight),
                line.tolerancePercent === null ? "—" : qty(line.tolerancePercent),
                `${qty(line.costPercent)}%`,
                line.isPrimary ? "Yes" : "No",
              ])}
            />
          </section>

          <section aria-labelledby="bom-materials" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="bom-materials" className="text-sm font-semibold text-ink">
                Input Materials
              </h3>
              <p className="text-sm font-semibold text-ink">Material Total : {money(bom.materialCost)}</p>
            </div>
            <LineTable
              columns={[
                { header: "SL", className: "w-12" },
                { header: "Materials" },
                { header: "Type" },
                { header: "Exclude From Scrap", align: "center" },
                { header: "Alt. Quantity", align: "right" },
                { header: "Quantity", align: "right" },
                { header: "Wastage (%)", align: "right" },
                { header: "Total Quantity", align: "right" },
                { header: "Avg. Rate", align: "right" },
                { header: "Total", align: "right" },
              ]}
              rows={bom.materials.map((line, index) => [
                index + 1,
                <span key="item" className="text-ink">{`${line.code} - ${line.name} (${line.uom})`}</span>,
                dash(line.materialType),
                line.excludeFromScrap ? "Yes" : "No",
                line.altQty === null ? "—" : `${qty(line.altQty)} ${line.altUom ?? ""}`,
                qty(line.qty),
                qty(line.wastagePercent),
                qty(line.totalQty),
                money(line.rate),
                money(line.amount),
              ])}
              footer={[
                ["", "Total Of Raw Material", "", "", "", qty(materialQty), "", qty(materialTotalQty), "", money(bom.materialCost)],
                ...(bom.overheadCost ? [["", "Overhead", "", "", "", "", "", "", "", money(bom.overheadCost)]] : []),
                ["", "Grand Total", "", "", "", qty(materialQty), "", qty(materialTotalQty), "", money(bom.totalCost)],
              ]}
            />
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

/** Active BOMs whose name contains `term` (3+ letters), debounced. */
function useBomSearch(term: string, exclude?: string) {
  const [found, setFound] = useState<{ term: string; rows: BomOption[]; error?: string }>({ term: "", rows: [] });
  const wanted = term.trim();
  useEffect(() => {
    if (wanted.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchBomOptions(wanted, exclude).then(
        (rows) => !cancelled && setFound({ term: wanted, rows }),
        (error: unknown) => !cancelled && setFound({ term: wanted, rows: [], error: errorMessage(error) }),
      );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wanted, exclude]);
  return { ...found, ready: wanted.length >= 3 && found.term === wanted };
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
  const search = useBomSearch(picked ? "" : term, bom.id);

  const current: DraftLink[] = links ?? detail.data?.children.map((link) => ({ childBomId: link.childBomId, name: link.name, stage: link.stage })) ?? [];

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
            <div className="relative">
              <TextField
                label="Child BOM Name"
                required
                placeholder="Type at least 3 letters"
                value={picked ? picked.name : term}
                hint={picked ? undefined : "Search active BOMs by name."}
                onChange={(event) => {
                  setPicked(null);
                  setTerm(event.target.value);
                }}
              />
              {!picked && term.trim().length >= 3 && (
                <div role="listbox" aria-label="Matching BOMs" className="absolute top-12 z-10 max-h-56 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-dropdown">
                  {!search.ready ? (
                    <p className="flex items-center gap-2 px-3 py-2 text-xs text-ink-faint">
                      <Search aria-hidden="true" className="size-3.5" />
                      Searching…
                    </p>
                  ) : search.error ? (
                    <p className="px-3 py-2 text-xs text-danger">{search.error}</p>
                  ) : search.rows.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-ink-faint">No active BOM matches.</p>
                  ) : (
                    search.rows.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => setPicked(option)}
                        className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-hover"
                      >
                        {option.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <TextField label="Stage/Level" required maxLength={50} placeholder="e.g. Stage 1" value={stage} onChange={(event) => setStage(event.target.value)} />
            <Button variant="accent-soft" className="sm:mt-5" onClick={add}>
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
      <SelectField
        label="Bill Of Material"
        required
        value={id}
        error={error}
        options={[{ value: "", label: "Choose a BOM" }, ...rows.map((row) => ({ value: row.id, label: row.name }))]}
        onChange={(event) => {
          setId(event.target.value);
          setError(undefined);
        }}
      />
    </Dialog>
  );
}
