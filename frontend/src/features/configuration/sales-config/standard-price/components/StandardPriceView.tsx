"use client";

import { Eye, FileSpreadsheet, FileText, Plus, Save, Search, Tags, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { CONTROL_CLASS, EmptyBlock, Field, FormGrid, Input, Notice, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import { MONEY, toOptions } from "../../offer/components/offer-form-kit";
import { useScrollList, type ScrollList } from "../../components/use-scroll-list";
import { salesConfigPaths } from "../../paths";
import { etpOf, INCREASE_TYPES, ITEM_TYPES, standardPriceRowSchema, type StandardPriceFilter, type StandardPriceOptions, type StandardPriceRow } from "../schemas/standard-price.schema";
import { standardPriceApi } from "../services/standard-price.api";

const BREADCRUMBS = entityMasterDataBreadcrumbs(salesConfigPaths.standardPriceSetup);
const EMPTY_FILTER = { itemType: "", categoryId: "", subCategoryId: "", customerId: "", supplierId: "" };
type Filters = typeof EMPTY_FILTER;
/** The page opens on sellable items; choose "All item types" to see the rest. */
const DEFAULT_FILTER: Filters = { ...EMPTY_FILTER, itemType: "Finished Goods" };
type PriceField = "costPrice" | "increaseValue" | "etpPrice" | "dealerPrice" | "tradingPrice" | "mrp" | "minSalesPrice";

const confirmDiscard = (dirty: number) => dirty === 0 || window.confirm(`Discard ${dirty} unsaved change(s)?`);

export function StandardPriceView() {
  const options = useResource("standard-price-options", standardPriceApi.options);

  return (
    <PageContainer full>
      <PageHead title="Standard Price Setup" subtitle="Dated standard prices per item: cost, ETP, dealer, trading, retail (MRP) and minimum sales price." breadcrumbs={BREADCRUMBS} />
      {options.error ? (
        <ErrorState message={options.error.message} onRetry={options.reload} />
      ) : !options.data ? (
        <LoadingState label="Loading…" />
      ) : options.data.businessUnits.length === 0 ? (
        <EmptyBlock icon={<Tags />} title="No business unit">
          Create a business unit in Company Profile first.
        </EmptyBlock>
      ) : (
        <PriceSetup options={options.data} />
      )}
    </PageContainer>
  );
}

function PriceSetup({ options }: { options: StandardPriceOptions }) {
  const toast = useToast();
  const [unitId, setUnitId] = useState(options.businessUnits[0].id);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTER);
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTER);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [edits, setEdits] = useState<Record<string, StandardPriceRow>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const dirty = Object.keys(edits).length;

  const query: StandardPriceFilter = { businessUnitId: unitId, ...applied, search };
  const { list, sentinel } = useScrollList(query, reloadKey, standardPriceApi.list);

  // Leaving the page with unsaved edits asks first.
  useEffect(() => {
    if (dirty === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const of = <T extends { businessUnitId: string }>(rows: T[]) => rows.filter((row) => row.businessUnitId === unitId);
  const categories = of(options.categories);
  const resetEdits = () => {
    setEdits({});
    setErrors({});
  };

  const edit = (row: StandardPriceRow, changes: Partial<StandardPriceRow>) => {
    const current = edits[row.itemId] ?? row;
    const next = { ...current, ...changes };
    // ETP follows cost and increase; it can still be typed over afterwards.
    if ("costPrice" in changes || "increaseValue" in changes || "increaseType" in changes) next.etpPrice = etpOf(next.costPrice, next.increaseType, next.increaseValue);
    setEdits((all) => ({ ...all, [row.itemId]: next }));
    if (errors[row.itemId]) setErrors(({ [row.itemId]: _removed, ...rest }) => rest);
  };

  const save = async () => {
    const rows = Object.values(edits);
    const found: Record<string, string> = {};
    for (const row of rows) {
      const result = standardPriceRowSchema.safeParse(row);
      if (!result.success) found[row.itemId] = result.error.issues[0].message;
    }
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error(`${Object.keys(found).length} row(s) need fixing before saving.`);
      return;
    }
    setSaving(true);
    try {
      const result = await standardPriceApi.save({
        businessUnitId: unitId,
        rows: rows.map(({ itemId, effectiveFrom, costPrice, increaseType, increaseValue, etpPrice, dealerPrice, tradingPrice, mrp, minSalesPrice, remarks }) => ({
          itemId,
          effectiveFrom,
          costPrice,
          increaseType,
          increaseValue,
          etpPrice,
          dealerPrice,
          tradingPrice,
          mrp,
          minSalesPrice,
          remarks,
        })),
      });
      toast.success(`Standard prices saved (${result.created} new, ${result.updated} updated).`);
      resetEdits();
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section aria-label="Filters" className="rounded border border-line bg-surface p-4 shadow-xs">
        <FormGrid cols={4}>
          {options.businessUnits.length > 1 && (
            <Field label="Business Unit">
              {(id) => (
                <Select
                  id={id}
                  value={unitId}
                  placeholder={false}
                  options={toOptions(options.businessUnits)}
                  onChange={(e) => {
                    if (!confirmDiscard(dirty)) return;
                    resetEdits();
                    setUnitId(e.target.value);
                    setFilters(DEFAULT_FILTER);
                    setApplied(DEFAULT_FILTER);
                  }}
                />
              )}
            </Field>
          )}
          <Field label="Item Type">
            {(id) => (
              <Select
                id={id}
                value={filters.itemType}
                placeholder="All item types"
                options={ITEM_TYPES.map((t) => ({ value: t, label: t }))}
                onChange={(e) => setFilters({ ...filters, itemType: e.target.value })}
              />
            )}
          </Field>
          <Field label="Category">
            {(id) => (
              <Select
                id={id}
                value={filters.categoryId}
                placeholder="All categories"
                options={toOptions(categories.filter((c) => c.level === 1))}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value, subCategoryId: "" })}
              />
            )}
          </Field>
          <Field label="Sub Category">
            {(id) => (
              <Select
                id={id}
                value={filters.subCategoryId}
                disabled={!filters.categoryId}
                placeholder="All sub categories"
                options={toOptions(categories.filter((c) => filters.categoryId && c.parentId === filters.categoryId))}
                onChange={(e) => setFilters({ ...filters, subCategoryId: e.target.value })}
              />
            )}
          </Field>
          <Field label="Filter By Customer">
            {(id) => (
              <Select
                id={id}
                value={filters.customerId}
                placeholder="All customers"
                options={of(options.customers).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))}
                onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
              />
            )}
          </Field>
          <Field label="Filter By Supplier">
            {(id) => (
              <Select
                id={id}
                value={filters.supplierId}
                placeholder="All suppliers"
                options={of(options.suppliers).map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))}
                onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}
              />
            )}
          </Field>
          <div className="flex items-end">
            <Button
              variant="accent"
              onClick={() => {
                if (!confirmDiscard(dirty)) return;
                resetEdits();
                setApplied(filters);
                setReloadKey((k) => k + 1);
              }}
            >
              <Eye /> View
            </Button>
          </div>
        </FormGrid>
      </section>

      <section aria-label="Standard prices" className="rounded border border-line bg-surface shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <form
            role="search"
            className="relative w-full sm:w-64"
            onSubmit={(event) => {
              event.preventDefault();
              if (!confirmDiscard(dirty)) return;
              resetEdits();
              setSearch(searchText.trim());
            }}
          >
            <label>
              <span className="sr-only">Search items (press Enter)</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
              <input
                type="search"
                value={searchText}
                maxLength={100}
                placeholder="Item code or name… (Enter)"
                onChange={(event) => {
                  setSearchText(event.target.value);
                  if (event.target.value === "" && search !== "" && confirmDiscard(dirty)) {
                    resetEdits();
                    setSearch("");
                  }
                }}
                className={cn(CONTROL_CLASS, "pl-8")}
              />
            </label>
          </form>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <a href={standardPriceApi.pdfUrl(query)} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "md")} title="Open the list as a PDF">
              <FileText /> PDF
            </a>
            <a href={standardPriceApi.excelUrl(query)} download className={buttonClasses("secondary", "md")} title="Download the list as Excel (also the upload template)">
              <FileSpreadsheet /> Excel
            </a>
            <Button onClick={() => setUploadOpen(true)}>
              <Plus /> Bulk Upload
            </Button>
          </div>
        </div>

        {dirty > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft px-4 py-2 text-sm text-ink">
            <span>
              <strong className="tabular-nums">{dirty}</strong> unsaved change(s).
            </span>
            <Button size="sm" variant="ghost" className="ml-auto" disabled={saving} onClick={resetEdits}>
              <Undo2 /> Discard
            </Button>
            <Button size="sm" variant="accent" loading={saving} onClick={save}>
              {!saving && <Save />} Save
            </Button>
          </div>
        )}

        <PriceTable list={list} sentinel={sentinel} edits={edits} errors={errors} onEdit={edit} />

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <p className="mr-auto text-xs text-ink-faint">
            ETP is worked out from Cost Price and Price Increase; you can still type over it. Saving a date already in force also updates the Item Profile prices.
          </p>
          <Button variant="accent" loading={saving} disabled={dirty === 0} onClick={save}>
            {!saving && <Save />} Save{dirty > 0 ? ` (${dirty})` : ""}
          </Button>
        </div>
      </section>

      <BulkUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={() => {
          resetEdits();
          setReloadKey((k) => k + 1);
        }}
        noun="standard prices"
        templateUrl={standardPriceApi.excelUrl(query)}
        maxRows={5000}
        matchHint="Download the Excel, edit the prices and upload it back. Item Code must match an item; the same item and Effective From updates that price."
        upload={async (file) => {
          const result = await standardPriceApi.importFile(unitId, file);
          return { created: result.created + result.updated, errors: result.errors };
        }}
      />
    </>
  );
}

// ─── Editable table ───────────────────────────────────────────────────────────

const HEADERS = [
  "SL",
  "Item Code",
  "Item Name",
  "UoM",
  "Effective From",
  "Cost Price",
  "Price Increase",
  "(%)/Amount",
  "ETP Price",
  "Dealer Price",
  "Trading Price",
  "Retail Price (MRP)",
  "Minimum Sales Price",
  "Remarks",
];

function PriceTable({
  list,
  sentinel,
  edits,
  errors,
  onEdit,
}: {
  list: ScrollList<StandardPriceRow>;
  sentinel: React.RefObject<HTMLDivElement | null>;
  edits: Record<string, StandardPriceRow>;
  errors: Record<string, string>;
  onEdit: (row: StandardPriceRow, changes: Partial<StandardPriceRow>) => void;
}) {
  if (list.error && list.rows.length === 0) return <ErrorState message={list.error} onRetry={list.retry} />;
  if (list.total === null) return <LoadingState label="Loading items…" />;
  if (list.total === 0) return <p className="px-4 py-10 text-center text-sm text-ink-faint">No items match these filters.</p>;

  const money = (row: StandardPriceRow, field: PriceField, label: string) => (
    <td className="px-1.5 py-1">
      <Input
        aria-label={`${label} of ${row.code}`}
        inputMode="decimal"
        className="w-24 text-right tabular-nums"
        value={row[field]}
        onChange={(e) => MONEY.test(e.target.value) && onEdit(row, { [field]: e.target.value })}
      />
    </td>
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="data-grid w-full min-w-max">
          <thead>
            <tr>
              {HEADERS.map((h) => (
                <th key={h} scope="col" className="px-2.5 py-2 text-left whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.rows.map((saved, index) => {
              const row = edits[saved.itemId] ?? saved;
              const changed = !!edits[saved.itemId];
              const error = errors[saved.itemId];
              return (
                <tr key={saved.itemId} className={cn(changed && "bg-accent-soft/40", error && "bg-danger/5")}>
                  <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{index + 1}</td>
                  <td className="px-2.5 py-2 font-medium whitespace-nowrap">{row.code}</td>
                  <td className="max-w-64 px-2.5 py-2" title={error}>
                    <span className="block truncate">{row.name}</span>
                    {error && <span className="block text-xs text-danger">{error}</span>}
                  </td>
                  <td className="px-2.5 py-2 whitespace-nowrap">{row.uom}</td>
                  <td className="px-1.5 py-1" title={saved.historyCount > 1 ? `${saved.historyCount} dated prices saved` : saved.priceId ? undefined : "Not saved yet — showing Item Profile prices"}>
                    <Input type="date" aria-label={`Effective From of ${row.code}`} className="w-36" value={row.effectiveFrom} onChange={(e) => onEdit(row, { effectiveFrom: e.target.value })} />
                  </td>
                  {money(row, "costPrice", "Cost Price")}
                  {money(row, "increaseValue", "Price Increase")}
                  <td className="px-1.5 py-1">
                    <Select
                      aria-label={`Increase type of ${row.code}`}
                      className="w-24"
                      value={row.increaseType}
                      placeholder={false}
                      options={INCREASE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                      onChange={(e) => onEdit(row, { increaseType: e.target.value === "AMOUNT" ? "AMOUNT" : "PERCENT" })}
                    />
                  </td>
                  {money(row, "etpPrice", "ETP Price")}
                  {money(row, "dealerPrice", "Dealer Price")}
                  {money(row, "tradingPrice", "Trading Price")}
                  {money(row, "mrp", "Retail Price (MRP)")}
                  {money(row, "minSalesPrice", "Minimum Sales Price")}
                  <td className="px-1.5 py-1">
                    <Input aria-label={`Remarks of ${row.code}`} className="w-44" maxLength={300} value={row.remarks} onChange={(e) => onEdit(row, { remarks: e.target.value })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div ref={sentinel} className="px-4 py-2.5 text-center text-xs text-ink-faint" aria-live="polite">
        {list.error ? (
          <Notice tone="error">
            {list.error}{" "}
            <button type="button" className="underline" onClick={list.retry}>
              Retry
            </button>
          </Notice>
        ) : list.loading ? (
          "Loading…"
        ) : list.hasMore ? (
          `Showing ${list.rows.length} of ${list.total} items · scroll for more…`
        ) : (
          `${list.total} items`
        )}
      </div>
    </div>
  );
}
