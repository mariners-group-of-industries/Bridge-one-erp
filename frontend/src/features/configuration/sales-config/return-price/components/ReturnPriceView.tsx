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
import { useScrollList, type ScrollList } from "../../components/use-scroll-list";
import { MONEY, toOptions } from "../../offer/components/offer-form-kit";
import { salesConfigPaths } from "../../paths";
import { ITEM_TYPES, RATE_FIELDS, returnPriceRowSchema, type RateField, type ReturnPriceFilter, type ReturnPriceOptions, type ReturnPriceRow } from "../schemas/return-price.schema";
import { returnPriceApi } from "../services/return-price.api";

const BREADCRUMBS = entityMasterDataBreadcrumbs(salesConfigPaths.salesReturn);
const EMPTY_FILTER = { itemType: "", categoryId: "", subCategoryId: "" };
type Filters = typeof EMPTY_FILTER;

const confirmDiscard = (dirty: number) => dirty === 0 || window.confirm(`Discard ${dirty} unsaved change(s)?`);
const today = () => new Date().toISOString().slice(0, 10);

export function ReturnPriceView() {
  const options = useResource("return-price-options", returnPriceApi.options);
  return (
    <PageContainer full>
      <PageHead title="Sales Return Price Setup" subtitle="Dated return rates per item: damage, expire, damage & expire, and sound & stock." breadcrumbs={BREADCRUMBS} />
      {options.error ? (
        <ErrorState message={options.error.message} onRetry={options.reload} />
      ) : !options.data ? (
        <LoadingState label="Loading…" />
      ) : options.data.businessUnits.length === 0 ? (
        <EmptyBlock icon={<Tags />} title="No business unit">
          Create a business unit in Company Profile first.
        </EmptyBlock>
      ) : (
        <ReturnPriceSetup options={options.data} />
      )}
    </PageContainer>
  );
}

function ReturnPriceSetup({ options }: { options: ReturnPriceOptions }) {
  const toast = useToast();
  const [unitId, setUnitId] = useState(options.businessUnits[0].id);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTER);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTER);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [edits, setEdits] = useState<Record<string, ReturnPriceRow>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const dirty = Object.keys(edits).length;

  const query: ReturnPriceFilter = { businessUnitId: unitId, ...applied, search };
  const { list, sentinel } = useScrollList(query, reloadKey, returnPriceApi.list);

  useEffect(() => {
    if (dirty === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const categories = options.categories.filter((c) => c.businessUnitId === unitId);
  const resetEdits = () => {
    setEdits({});
    setErrors({});
  };
  const reload = () => {
    resetEdits();
    setReloadKey((k) => k + 1);
  };

  const edit = (row: ReturnPriceRow, changes: Partial<ReturnPriceRow>) => {
    const next = { ...(edits[row.itemId] ?? row), ...changes };
    // A never-priced row gets today's date as soon as a rate is typed.
    if (!next.effectiveFrom && !("effectiveFrom" in changes)) next.effectiveFrom = today();
    setEdits((all) => ({ ...all, [row.itemId]: next }));
    if (errors[row.itemId]) setErrors(({ [row.itemId]: _removed, ...rest }) => rest);
  };

  const save = async () => {
    const rows = Object.values(edits);
    const found: Record<string, string> = {};
    for (const row of rows) {
      const result = returnPriceRowSchema.safeParse(row);
      if (!result.success) found[row.itemId] = result.error.issues[0].message;
    }
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error(`${Object.keys(found).length} row(s) need fixing before saving.`);
      return;
    }
    setSaving(true);
    try {
      const result = await returnPriceApi.save({
        businessUnitId: unitId,
        rows: rows.map(({ itemId, effectiveFrom, damageRate, expireRate, damageExpireRate, soundStockRate }) => ({ itemId, effectiveFrom, damageRate, expireRate, damageExpireRate, soundStockRate })),
      });
      toast.success(`Return rates saved (${result.created} new, ${result.updated} updated).`);
      reload();
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
                    setFilters(EMPTY_FILTER);
                    setApplied(EMPTY_FILTER);
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
          <div className="flex items-end">
            <Button
              variant="accent"
              onClick={() => {
                if (!confirmDiscard(dirty)) return;
                setApplied(filters);
                reload();
              }}
            >
              <Eye /> View
            </Button>
          </div>
        </FormGrid>
      </section>

      <section aria-label="Sales return prices" className="rounded border border-line bg-surface shadow-xs">
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
            <a href={returnPriceApi.pdfUrl(query)} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "md")} title="Open the list as a PDF">
              <FileText /> PDF
            </a>
            <a href={returnPriceApi.excelUrl(query)} download className={buttonClasses("secondary", "md")} title="Download the list as Excel (also the upload template)">
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

        <RateTable list={list} sentinel={sentinel} edits={edits} errors={errors} onEdit={edit} />

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <p className="mr-auto text-xs text-ink-faint">Saving a new Effective From keeps the earlier rates as history; the latest date is shown.</p>
          <Button variant="accent" loading={saving} disabled={dirty === 0} onClick={save}>
            {!saving && <Save />} Save{dirty > 0 ? ` (${dirty})` : ""}
          </Button>
        </div>
      </section>

      <BulkUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={reload}
        noun="return rates"
        templateUrl={returnPriceApi.excelUrl(query)}
        maxRows={5000}
        matchHint="Download the Excel, edit the rates and upload it back. Item Code must match an item; rows without Effective From are skipped."
        upload={async (file) => {
          const result = await returnPriceApi.importFile(unitId, file);
          return { created: result.created + result.updated, errors: result.errors };
        }}
      />
    </>
  );
}

const HEADERS = ["SL", "Item Code", "Item Name", "UoM", "Effective From", ...RATE_FIELDS.map((f) => f.label)];

function RateTable({
  list,
  sentinel,
  edits,
  errors,
  onEdit,
}: {
  list: ScrollList<ReturnPriceRow>;
  sentinel: React.RefObject<HTMLDivElement | null>;
  edits: Record<string, ReturnPriceRow>;
  errors: Record<string, string>;
  onEdit: (row: ReturnPriceRow, changes: Partial<ReturnPriceRow>) => void;
}) {
  if (list.error && list.rows.length === 0) return <ErrorState message={list.error} onRetry={list.retry} />;
  if (list.total === null) return <LoadingState label="Loading items…" />;
  if (list.total === 0) return <p className="px-4 py-10 text-center text-sm text-ink-faint">No items match these filters.</p>;

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
              const error = errors[saved.itemId];
              return (
                <tr key={saved.itemId} className={cn(edits[saved.itemId] && "bg-accent-soft/40", error && "bg-danger/5")}>
                  <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{index + 1}</td>
                  <td className="px-2.5 py-2 font-medium whitespace-nowrap">{row.code}</td>
                  <td className="max-w-80 px-2.5 py-2" title={error}>
                    <span className="block truncate">{row.name}</span>
                    {error && <span className="block text-xs text-danger">{error}</span>}
                  </td>
                  <td className="px-2.5 py-2 whitespace-nowrap">{row.uom}</td>
                  <td className="px-1.5 py-1" title={saved.historyCount > 1 ? `${saved.historyCount} dated rates saved` : undefined}>
                    <Input type="date" aria-label={`Effective From of ${row.code}`} className="w-36" value={row.effectiveFrom} onChange={(e) => onEdit(row, { effectiveFrom: e.target.value })} />
                  </td>
                  {RATE_FIELDS.map((field) => (
                    <td key={field.key} className="px-1.5 py-1">
                      <Input
                        aria-label={`${field.label} of ${row.code}`}
                        inputMode="decimal"
                        className="w-28 text-right tabular-nums"
                        value={row[field.key as RateField]}
                        onChange={(e) => MONEY.test(e.target.value) && onEdit(row, { [field.key]: e.target.value })}
                      />
                    </td>
                  ))}
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
