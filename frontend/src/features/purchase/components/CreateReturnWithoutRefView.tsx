"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
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

  const selectedOfficeId = pickedOfficeId || offices[0]?.id || "";
  const availableWarehouses = useMemo(
    () => (selectedOfficeId ? allWarehouses.filter((w) => w.officeId === selectedOfficeId) : allWarehouses),
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
    "h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Top Action Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/purchase/returns")}
            className="rounded-full p-1 text-slate-600 transition hover:bg-slate-100"
            title="Back to Purchase Returns"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base font-semibold text-slate-900">Create Purchase Return WithOut Ref.</h1>
        </div>
        <button
          type="button"
          disabled={saveMutation.isPending || !perms.returns.create}
          title={!perms.returns.create ? "Requires Create permission in Configuration" : undefined}
          onClick={() => saveMutation.mutate()}
          className="flex h-8 items-center gap-1.5 rounded bg-blue-600 px-5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saveMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
          SAVE
        </button>
      </div>

      <div className="space-y-3 p-3.5">
        {/* Form Card Matching Screenshot #3 */}
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-2xs">
          {/* Row 1: Create Date, Office, Warehouse, Select Supplier */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Create Date<span className="text-red-500">*</span>
              </label>
              <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Office<span className="text-red-500">*</span>
              </label>
              <select value={selectedOfficeId} onChange={(e) => setPickedOfficeId(e.target.value)} className={inputCls}>
                <option value="">office</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Warehouse<span className="text-red-500">*</span>
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setPickedWarehouseId(e.target.value)}
                className={inputCls}
              >
                <option value="">Select a warehouse</option>
                {availableWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Select Supplier<span className="text-red-500">*</span>
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
          <div className="mt-3 max-w-sm">
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Remarks"
              className={inputCls}
            />
          </div>

          {/* Row 3: Select Item (Search With Barcode) + Quantity + Return Price + Add */}
          <div className="mt-3.5 grid grid-cols-1 items-end gap-3.5 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700">
                  Select Item<span className="text-red-500">*</span>
                </label>
                {selectedItemStock !== null && (
                  <span className="text-[10px] font-medium text-blue-600">Warehouse Stock: {selectedItemStock}</span>
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
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Quantity<span className="text-red-500">*</span>
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
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Return Price (BDT)<span className="text-red-500">*</span>
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
                className="h-8 rounded border border-slate-300 bg-slate-100 px-5 text-xs font-semibold text-slate-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Return Items Table */}
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
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
              <tbody className="divide-y divide-slate-100">
                {addedLines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                      No return items added yet. Search item by barcode, name, or code above and click Add.
                    </td>
                  </tr>
                ) : (
                  addedLines.map((row, idx) => (
                    <tr key={row.key} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-sky-700">{row.itemCode}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{row.itemName}</td>
                      <td className="px-3 py-2 text-slate-600">{row.uom}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">{row.availableStock}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                        {formatCurrency(row.lineTotal)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setAddedLines((prev) => prev.filter((l) => l.key !== row.key))}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
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
            <div className="flex items-center justify-end gap-6 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
              <span className="text-slate-600">
                Total Return Qty: <strong className="font-mono text-slate-900">{totals.qty}</strong>
              </span>
              <span className="text-slate-700">
                Total Credit Amount: <strong className="font-mono text-sm text-blue-700">{formatCurrency(totals.amount)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

