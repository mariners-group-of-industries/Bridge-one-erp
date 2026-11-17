"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/purchase/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { round2 } from "@/lib/purchase-store/rules";
import { usePurchasePermissions } from "@/features/purchase/lib/usePurchasePermissions";
import { SearchableCombobox, type PurchaseFormOptions } from "@/features/purchase/components/PurchaseFormShared";
import type { Item, Office, PurchaseReturn, Supplier, Warehouse } from "@bridgeone/contracts";

interface ReturnDraftLine {
  key: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  availableStock: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export function CreateReturnWithoutRefView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const perms = usePurchasePermissions();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { data: offices = [] } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
  });
  const { data: allWarehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: () => fetchApi("/master/warehouses"),
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => fetchApi("/master/suppliers"),
  });
  const { data: itemsCatalog = [] } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: () => fetchApi("/master/items"),
  });
  const { data: formOptions } = useQuery<PurchaseFormOptions>({
    queryKey: ["purchase-form-options"],
    queryFn: () => fetchApi("/master/purchase-form-options"),
  });

  // Form State
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [returnDate, setReturnDate] = useState(todayStr);
  const [pickedOfficeId, setPickedOfficeId] = useState("");
  const [pickedWarehouseId, setPickedWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [remarks, setRemarks] = useState("");

  // Line Entry State
  const [selectedItemId, setSelectedItemId] = useState("");
  const [lineQty, setLineQty] = useState("");
  const [linePrice, setLinePrice] = useState("");
  const [addedLines, setAddedLines] = useState<ReturnDraftLine[]>([]);

  const defaultOfficeId = useMemo(() => {
    if (!offices.length) return "";
    const withWh = offices.find((o) => allWarehouses.some((w) => w.officeId === o.id));
    return withWh?.id || offices[0]?.id || "";
  }, [offices, allWarehouses]);

  const selectedOfficeId = pickedOfficeId || defaultOfficeId;
  const availableWarehouses = useMemo(
    () => (selectedOfficeId ? allWarehouses.filter((w) => w.officeId === selectedOfficeId) : []),
    [allWarehouses, selectedOfficeId]
  );
  const selectedWarehouseId = availableWarehouses.some((w) => w.id === pickedWarehouseId)
    ? pickedWarehouseId
    : (availableWarehouses[0]?.id ?? "");

  const warehouseStockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of formOptions?.stockByWarehouse ?? []) {
      if (row.warehouseId === selectedWarehouseId) {
        map.set(row.itemId, row.qty);
      }
    }
    return map;
  }, [formOptions, selectedWarehouseId]);

  const selectedItemStock = selectedItemId ? (warehouseStockMap.get(selectedItemId) ?? 0) : null;

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    const it = itemsCatalog.find((i) => i.id === itemId);
    if (it) {
      setLinePrice(String(it.standardPrice ?? 0));
      if (!lineQty) setLineQty("1");
    }
  };

  const handleAddLine = () => {
    if (!selectedWarehouseId) return toast.error("Select a warehouse first.");
    const item = itemsCatalog.find((i) => i.id === selectedItemId);
    if (!item) return toast.error("Select an item to return.");
    const qty = Number(lineQty);
    const price = Number(linePrice);
    if (!(qty > 0)) return toast.error("Enter a return quantity greater than 0.");
    if (!Number.isFinite(price) || price < 0) return toast.error("Enter a valid return price.");

    const availableStock = warehouseStockMap.get(item.id) ?? 0;
    const alreadyQueued = addedLines
      .filter((l) => l.itemId === item.id)
      .reduce((s, l) => s + l.quantity, 0);
    if (qty + alreadyQueued > availableStock + 1e-9) {
      return toast.error(
        `Insufficient warehouse stock for "${item.name}". Available in selected warehouse: ${availableStock} ${item.uom}.`,
        { title: "Stock Check" }
      );
    }

    setAddedLines((prev) => [
      ...prev,
      {
        key: `ret_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        uom: item.uom || "Pcs",
        availableStock,
        quantity: qty,
        unitPrice: round2(price),
        lineTotal: round2(qty * price),
      },
    ]);
    setSelectedItemId("");
    setLineQty("");
    setLinePrice("");
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedOfficeId) throw new Error("Office is required.");
      if (!selectedWarehouseId) throw new Error("Warehouse is required.");
      if (!supplierId) throw new Error("Select a supplier.");
      if (addedLines.length === 0) throw new Error("Add at least one item to return.");

      return fetchApi<PurchaseReturn>("/purchase/returns", {
        method: "POST",
        body: JSON.stringify({
          goodsReceiptId: "WITHOUT_REF",
          officeId: selectedOfficeId,
          warehouseId: selectedWarehouseId,
          supplierId,
          returnDate,
          returnType: "REFUND_CREDIT",
          remarks: remarks.trim() || undefined,
          items: addedLines.map((l) => ({
            grnItemId: l.itemId,
            itemId: l.itemId,
            itemCode: l.itemCode,
            itemName: l.itemName,
            uom: l.uom,
            receivedQuantity: l.availableStock,
            previouslyReturnedQuantity: 0,
            eligibleReturnQuantity: l.availableStock,
            returnQuantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
            reason: remarks.trim() || "Purchase Return Without Reference",
            condition: "DEFECTIVE",
          })),
        }),
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-returns"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-form-options"] });
      toast.success(`Purchase Return ${created.returnNumber} saved; warehouse stock and supplier balance updated.`);
      router.push("/purchase/returns");
    },
    onError: (err: Error) => toast.error(err.message, { title: "Purchase Return Error" }),
  });

  const totals = useMemo(() => {
    const qty = addedLines.reduce((s, l) => s + l.quantity, 0);
    const amount = round2(addedLines.reduce((s, l) => s + l.lineTotal, 0));
    return { qty, amount };
  }, [addedLines]);

  const inputCls =
    "h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-blue-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-canvas p-3 md:p-6 text-ink">
      {/* Top Action Bar */}
      <div data-sticky-head className="sticky top-14 z-20 -mx-3 -mt-3 px-3 pt-3 pb-3 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 bg-canvas">
        <div className="bg-surface border border-line/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/purchase/returns")}
              className="h-8 w-8 rounded border border-line-strong flex items-center justify-center text-ink-muted hover:bg-canvas transition"
              title="Back to Purchase Returns"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-ink tracking-tight">Create Purchase Return WithOut Ref.</h1>
          </div>
          <button
            type="button"
            disabled={saveMutation.isPending || !perms.returns.create}
            title={!perms.returns.create ? "Requires Create permission in Configuration" : undefined}
            onClick={() => saveMutation.mutate()}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {saveMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
            SAVE
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Card 1: Basic Information */}
        <div className="bg-surface border border-line/90 rounded shadow-2xs overflow-hidden mb-3">
          {/* Card Tab Header with Collapse Chevron */}
          <div className="flex items-center justify-between border-b border-line bg-surface px-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-t bg-grid-head text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 transition"
              >
                Basic Information
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
              className="p-1.5 text-ink-faint hover:text-ink-muted rounded transition"
              title={isHeaderCollapsed ? "Expand" : "Collapse"}
            >
              {isHeaderCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!isHeaderCollapsed && (
            <div className="p-4 space-y-3.5">
              {/* Row 1: Create Date, Office, Warehouse, Select Supplier */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-muted">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Create Date
                  </label>
                  <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-muted">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Office
                  </label>
                  <select
                    value={selectedOfficeId}
                    onChange={(e) => {
                      const newOfficeId = e.target.value;
                      setPickedOfficeId(newOfficeId);
                      const matchingWh = allWarehouses.find((w) => w.officeId === newOfficeId);
                      setPickedWarehouseId(matchingWh?.id || "");
                    }}
                    className={inputCls}
                  >
                    <option value="">office</option>
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-muted">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Warehouse
                  </label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setPickedWarehouseId(e.target.value)}
                    disabled={!selectedOfficeId}
                    className={`${inputCls} disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed`}
                  >
                    {!selectedOfficeId ? (
                      <option value="">Select office first</option>
                    ) : availableWarehouses.length === 0 ? (
                      <option value="">No warehouse for this office</option>
                    ) : (
                      availableWarehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-muted">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Select Supplier
                  </label>
                  <SearchableCombobox
                    value={supplierId}
                    onChange={setSupplierId}
                    placeholder="Select/Search Supplier (min 3 letters)"
                    minCharsHint={3}
                    options={suppliers.map((s) => ({
                      value: s.id,
                      label: s.name,
                      sublabel: `${s.code}${s.balance ? ` • Bal: ${formatCurrency(s.balance)}` : ""}`,
                    }))}
                  />
                </div>
              </div>

              {/* Row 2: Remarks */}
              <div className="max-w-sm">
                <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Remarks"
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Return Items */}
        <div className="bg-surface border border-line/90 rounded shadow-2xs overflow-hidden mb-3">
          <div className="flex items-center justify-between border-b border-line bg-surface px-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-t bg-grid-head text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 transition"
              >
                Return Items
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3.5">
            {/* Row 3: Select Item (Search With Barcode) + Quantity + Return Price + Add */}
            <div className="grid grid-cols-1 items-end gap-3.5 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink-muted">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Select Item
                  </label>
                  {selectedItemStock !== null && (
                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Warehouse Stock: {selectedItemStock}</span>
                  )}
                </div>
                <SearchableCombobox
                  value={selectedItemId}
                  onChange={handleSelectItem}
                  placeholder="Search With Barcode"
                  options={itemsCatalog.map((it) => {
                    const whQty = warehouseStockMap.get(it.id) ?? 0;
                    return {
                      value: it.id,
                      label: `${it.code} - ${it.name}`,
                      sublabel: `${it.barcode ? `Barcode: ${it.barcode} • ` : ""}WH Stock: ${whQty} ${it.uom}`,
                      searchText: `${it.barcode ?? ""} ${it.code} ${it.name}`,
                    };
                  })}
                />
              </div>

              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-ink-muted">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Quantity
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={lineQty}
                  onChange={(e) => setLineQty(e.target.value)}
                  placeholder="Quantity"
                  className={inputCls}
                />
              </div>

              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-ink-muted">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Return Price (BDT)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={linePrice}
                  onChange={(e) => setLinePrice(e.target.value)}
                  placeholder="Return Price (BDT)"
                  className={inputCls}
                />
              </div>

              <div className="lg:col-span-2">
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="h-8 rounded border border-line-strong bg-control px-5 text-xs font-semibold text-ink-muted transition hover:border-blue-600 hover:bg-blue-600 hover:text-white"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Return Items Table */}
            <div className="overflow-hidden rounded-md border border-line bg-surface shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-blue-200 dark:border-blue-500/30 bg-grid-head text-[11px] font-semibold text-ink">
                      <th className="px-3 py-2">SL</th>
                      <th className="px-3 py-2">Item Code</th>
                      <th className="px-3 py-2">Item Name</th>
                      <th className="px-3 py-2">UoM</th>
                      <th className="px-3 py-2 text-right">WH Stock</th>
                      <th className="px-3 py-2 text-right">Return Qty</th>
                      <th className="px-3 py-2 text-right">Return Price (BDT)</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {addedLines.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-xs text-ink-faint">
                          No return items added yet. Search item by barcode, name, or code above and click Add.
                        </td>
                      </tr>
                    ) : (
                      addedLines.map((row, idx) => (
                        <tr key={row.key} className="hover:bg-canvas">
                          <td className="px-3 py-2 text-ink-faint">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono text-sky-700 dark:text-sky-300">{row.itemCode}</td>
                          <td className="px-3 py-2 font-medium text-ink">{row.itemName}</td>
                          <td className="px-3 py-2 text-ink-muted">{row.uom}</td>
                          <td className="px-3 py-2 text-right font-mono text-ink-faint">{row.availableStock}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-ink">
                            {formatCurrency(row.lineTotal)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setAddedLines((prev) => prev.filter((l) => l.key !== row.key))}
                              className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                              title="Remove line"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {addedLines.length > 0 && (
                <div className="flex items-center justify-end gap-6 border-t border-line bg-canvas px-4 py-2.5 text-xs">
                  <span className="text-ink-muted">
                    Total Return Qty: <strong className="font-mono text-ink">{totals.qty}</strong>
                  </span>
                  <span className="text-ink-muted">
                    Total Credit Amount: <strong className="font-mono text-sm text-blue-700 dark:text-blue-300">{formatCurrency(totals.amount)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

