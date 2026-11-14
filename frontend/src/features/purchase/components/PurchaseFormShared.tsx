"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/purchase/Toast";
import { fetchApi } from "@/lib/api";
import { round2 } from "@/lib/purchase-store/rules";
import type { Item, Supplier } from "@bridgeone/contracts";

export interface CategoryOption {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
}

/**
 * Names of the categories at `level` (1–3) for the item filters, which match items by
 * category name. Business units may have categories with the same name, so every
 * parent named `parentName` counts and each name appears once. Without a matching
 * parent, every category of the level is listed.
 */
export function categoryNamesAt(all: CategoryOption[], level: number, parentName?: string): string[] {
  const parentIds = new Set(all.filter((c) => c.level === level - 1 && c.name === parentName).map((c) => c.id));
  const names = all
    .filter((c) => c.level === level && (parentIds.size === 0 || (c.parentId !== null && parentIds.has(c.parentId))))
    .map((c) => c.name);
  return [...new Set(names)];
}

export interface SalesOrderLineOption {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  qty: number;
  unitPrice: number;
  vatPercent: number;
}

export interface SalesOrderOption {
  id: string;
  number: string;
  orderDate: string;
  expectedDeliveryDate: string;
  officeId: string;
  customerName: string;
  shippingAddress: string;
  projectRef: string;
  lines: SalesOrderLineOption[];
}

export interface ProjectOption {
  id: string;
  code: string;
  name: string;
  department: string;
}

export interface LedgerAccountOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountSubtype: string;
  currentBalance: number;
}

export interface BankAccountOption {
  id: string;
  bankName: string;
  accountNumber: string;
  branchName: string;
  accountHolder: string;
  glAccountId: string | null;
  glAccountName: string | null;
  currentBalance: number;
}

export interface TermsOption {
  id: string;
  title: string;
  body: string;
  isDefault: boolean;
}

export interface EmployeeOption {
  id: string;
  employeeCode: string;
  name: string;
  officeId: string;
  department: string;
  designation: string;
}

export interface WarehouseStockOption {
  warehouseId: string;
  itemId: string;
  qty: number;
}

export interface PurchaseFormOptions {
  categories: CategoryOption[];
  salesOrders: SalesOrderOption[];
  projects: ProjectOption[];
  accounts: LedgerAccountOption[];
  bankAccounts: BankAccountOption[];
  terms: TermsOption[];
  employees: EmployeeOption[];
  stockByWarehouse: WarehouseStockOption[];
}

export const INVENTORY_TYPE_OPTIONS = [
  "Inventory Item",
  "Fixed Asset",
  "Service / Expense",
  "Consumables",
  "Packaging Material",
];

/** Calculates exclusive base unit price, VAT amount, and inclusive line total cleanly for `priceLine`. */
export function computeVatLine(params: {
  quantity: number;
  enteredRate: number;
  enteredTotal: number;
  vatPercent: number;
  vatEnabled: boolean;
  priceIncludesVat: boolean;
  amountDriven: boolean;
}) {
  const qty = Number(params.quantity) > 0 ? Number(params.quantity) : 0;
  const effVat = params.vatEnabled && params.vatPercent > 0 ? Math.min(100, Math.max(0, Number(params.vatPercent))) : 0;

  let displayRate = Number(params.enteredRate) > 0 ? Number(params.enteredRate) : 0;
  let lineTotal = Number(params.enteredTotal) > 0 ? Number(params.enteredTotal) : 0;

  if (params.amountDriven && qty > 0) {
    if (params.priceIncludesVat || effVat === 0) {
      displayRate = round2(lineTotal / qty);
    } else {
      displayRate = round2(lineTotal / (qty * (1 + effVat / 100)));
    }
  } else if (qty > 0) {
    lineTotal = params.priceIncludesVat
      ? round2(qty * displayRate)
      : round2(qty * displayRate * (1 + effVat / 100));
  } else {
    lineTotal = 0;
  }

  const baseUnitPrice =
    params.priceIncludesVat && effVat > 0 ? round2(displayRate / (1 + effVat / 100)) : round2(displayRate);
  const netSubtotal = round2(qty * baseUnitPrice);
  const vatAmount = round2((netSubtotal * effVat) / 100);
  const computedTotal = round2(netSubtotal + vatAmount);

  return {
    displayRate,
    baseUnitPrice,
    effectiveVatPercent: effVat,
    netSubtotal,
    vatAmount,
    lineTotal: computedTotal,
  };
}

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  searchText?: string;
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  minCharsHint,
  allowClear = true,
  className = "",
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minCharsHint?: number;
  allowClear?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options
      .filter((o) => {
        const hay = `${o.label} ${o.sublabel ?? ""} ${o.searchText ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 60);
  }, [options, query]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex h-8 w-full items-center rounded border bg-white px-2 text-xs transition-colors ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            : open
              ? "border-blue-500 ring-1 ring-blue-500/20"
              : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <input
          type="text"
          disabled={disabled}
          value={open ? query : selectedOption?.label ?? ""}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) {
              setQuery("");
              setOpen(true);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          className="h-full w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
        />
        {allowClear && value && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setQuery("");
              setOpen(false);
            }}
            className="mr-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear selection"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed"
          aria-label="Toggle options"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-[220px] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {minCharsHint && query.trim().length > 0 && query.trim().length < minCharsHint && filtered.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-slate-400">
              Type at least {minCharsHint} characters to search...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-slate-400">No matching records found</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setQuery("");
                  setOpen(false);
                }}
                className={`flex w-full flex-col px-3 py-1.5 text-left text-xs transition-colors hover:bg-blue-50 ${
                  opt.value === value ? "bg-blue-50/70 font-medium text-blue-700" : "text-slate-700"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.sublabel && <span className="truncate text-[10px] text-slate-400">{opt.sublabel}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function QuickAddSupplierModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (supplier: Supplier) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [address, setAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [creditDays, setCreditDays] = useState("");
  const [type, setType] = useState<"LOCAL" | "FOREIGN">("LOCAL");

  const mutation = useMutation({
    mutationFn: () =>
      fetchApi<Supplier>("/master/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          contactPerson: contactPerson.trim() || undefined,
          address: address.trim() || undefined,
          taxNumber: taxNumber.trim() || undefined,
          creditDays: creditDays ? Number(creditDays) : undefined,
          type,
        }),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(`Supplier "${created.name}" created and selected.`);
      onCreated(created);
      setName("");
      setPhone("");
      setContactPerson("");
      setAddress("");
      setTaxNumber("");
      setCreditDays("");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title="Quick Add Supplier" subtitle="Creates a supplier directly in Entity Master Data" maxWidth="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return toast.error("Supplier name is required.");
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahim Steel & Hardware"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 017XXXXXXXX"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Contact Person</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Contact Name"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Supplier Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value === "FOREIGN" ? "FOREIGN" : "LOCAL")}
              className="h-8 w-full rounded border border-slate-300 px-2 text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="LOCAL">Local Supplier</option>
              <option value="FOREIGN">Foreign / Import</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">BIN / Tax Number</label>
            <input
              type="text"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder="VAT / BIN No"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Credit Days</label>
            <input
              type="number"
              min="0"
              value={creditDays}
              onChange={(e) => setCreditDays(e.target.value)}
              placeholder="e.g. 30"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-600">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Office or billing address"
            className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded border border-slate-300 px-4 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex h-8 items-center gap-1.5 rounded bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending && <Spinner className="h-3 w-3" />}
            Create Supplier
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

export function QuickAddItemModal({
  isOpen,
  onClose,
  categories,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryOption[];
  onCreated: (item: Item) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [uom, setUom] = useState("Pcs");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [vatPercent, setVatPercent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      fetchApi<Item>("/master/items", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          uom: uom.trim() || "Pcs",
          purchasePrice: purchasePrice ? Number(purchasePrice) : 0,
          vatPercent: vatPercent ? Number(vatPercent) : 0,
          categoryId: categoryId || undefined,
          brand: brand.trim() || undefined,
          barcode: barcode.trim() || undefined,
        }),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success(`Item "${created.name}" created and selected.`);
      onCreated(created);
      setName("");
      setCode("");
      setPurchasePrice("");
      setVatPercent("");
      setBrand("");
      setBarcode("");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title="Quick Add Item" subtitle="Creates an item directly in Configuration Master Data" maxWidth="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return toast.error("Item name is required.");
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MS Angle 2x2"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Item Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Auto-generated if blank"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-8 w-full rounded border border-slate-300 px-2 text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(Math.max(0, c.level - 1))}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">UoM</label>
            <input
              type="text"
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              placeholder="Pcs / Kg / Box"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Purchase Price (BDT)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0.00"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">VAT (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={vatPercent}
              onChange={(e) => setVatPercent(e.target.value)}
              placeholder="0"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Brand</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Barcode</label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Barcode"
              className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded border border-slate-300 px-4 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex h-8 items-center gap-1.5 rounded bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending && <Spinner className="h-3 w-3" />}
            Create Item
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

export function TermsConditionModal({
  isOpen,
  onClose,
  termsTemplates,
  value,
  onChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  termsTemplates: TermsOption[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title="Terms & Conditions" subtitle="Select a configured purchase template or edit custom terms" maxWidth="lg">
      {isOpen && (
        <TermsConditionModalBody
          key={value}
          termsTemplates={termsTemplates}
          initialValue={value}
          onClose={onClose}
          onChange={onChange}
        />
      )}
    </ModalDialog>
  );
}

function TermsConditionModalBody({
  termsTemplates,
  initialValue,
  onClose,
  onChange,
}: {
  termsTemplates: TermsOption[];
  initialValue: string;
  onClose: () => void;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(initialValue);

  return (
      <div className="space-y-3">
        {termsTemplates.length > 0 && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Apply Configured Template</label>
            <div className="flex flex-wrap gap-1.5">
              {termsTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDraft(t.body)}
                  className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                >
                  {t.title}
                  {t.isDefault ? " (Default)" : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-600">Purchase Order Terms & Conditions</label>
          <textarea
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Enter delivery, warranty, quality, or payment terms..."
            className="w-full rounded border border-slate-300 p-2.5 text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded border border-slate-300 px-4 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(draft);
              onClose();
            }}
            className="h-8 rounded bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Apply Terms
          </button>
        </div>
      </div>
  );
}

