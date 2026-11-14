"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp, Info, Paperclip, Plus, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/purchase/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { round2 } from "@/lib/purchase-store/rules";
import { usePurchasePermissions } from "@/features/purchase/lib/usePurchasePermissions";
import {
  categoryNamesAt,
  computeVatLine,
  INVENTORY_TYPE_OPTIONS,
  QuickAddItemModal,
  QuickAddSupplierModal,
  SearchableCombobox,
  type PurchaseFormOptions,
} from "@/features/purchase/components/PurchaseFormShared";
import type { GoodsReceipt, Item, Office, PurchaseRequisition, Supplier, Warehouse } from "@bridgeone/contracts";

interface DirectDraftLine {
  key: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  taxPercentage: number;
  vatAmount: number;
  lineTotal: number;
  brand: string;
  specification: string;
}

export function DirectReceiveView() {
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
  const { data: requisitions = [] } = useQuery<PurchaseRequisition[]>({
    queryKey: ["requisitions-approved"],
    queryFn: () => fetchApi("/purchase/requisitions?status=APPROVED"),
  });
  const { data: formOptions } = useQuery<PurchaseFormOptions>({
    queryKey: ["purchase-form-options"],
    queryFn: () => fetchApi("/master/purchase-form-options"),
  });

  // Top Checkboxes (Screenshot: Price Including VAT checked by default)
  const [createFromRequisition, setCreateFromRequisition] = useState(false);
  const [createFromSalesOrder, setCreateFromSalesOrder] = useState(false);
  const [priceIncludingVat, setPriceIncludingVat] = useState(true);
  const [amountDriven, setAmountDriven] = useState(false);

  const [selectedRequisitionId, setSelectedRequisitionId] = useState("");
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");

  // Header Fields
  const [receiveDate, setReceiveDate] = useState(todayStr);
  const [pickedOfficeId, setPickedOfficeId] = useState("");
  const [pickedWarehouseId, setPickedWarehouseId] = useState("");
  const [itemType, setItemType] = useState("Inventory Item");
  const [supplierId, setSupplierId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [paymentDaysAfterReceive, setPaymentDaysAfterReceive] = useState("0");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shipmentDocumentNumber, setShipmentDocumentNumber] = useState("");
  const [salesInvoiceNumber, setSalesInvoiceNumber] = useState("");
  const [vatChallanNumber, setVatChallanNumber] = useState("");
  const [challanDate, setChallanDate] = useState("");
  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [viewDetails, setViewDetails] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Add Modals
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  // Line Entry State
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subCategoryFilter, setSubCategoryFilter] = useState("");
  const [minorCategoryFilter, setMinorCategoryFilter] = useState("");
  const [filterBySupplier, setFilterBySupplier] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [lineQty, setLineQty] = useState<string>("1");
  const [lineRate, setLineRate] = useState<string>("");
  const [lineTotalInput, setLineTotalInput] = useState<string>("");
  const [lineVatPct, setLineVatPct] = useState<string>("");
  const [lineVatEnabled, setLineVatEnabled] = useState(true);
  const [lineBrand, setLineBrand] = useState("");
  const [lineSpecification, setLineSpecification] = useState("");
  const [addAllFlag, setAddAllFlag] = useState(false);

  const [addedLines, setAddedLines] = useState<DirectDraftLine[]>([]);

  const selectedOfficeId = pickedOfficeId || offices[0]?.id || "";
  const availableWarehouses = useMemo(
    () => (selectedOfficeId ? allWarehouses.filter((w) => w.officeId === selectedOfficeId) : allWarehouses),
    [allWarehouses, selectedOfficeId]
  );
  const selectedWarehouseId = availableWarehouses.some((w) => w.id === pickedWarehouseId)
    ? pickedWarehouseId
    : (availableWarehouses[0]?.id ?? "");

  const categories = useMemo(() => {
    const lvl1 = categoryNamesAt(formOptions?.categories ?? [], 1);
    if (lvl1.length > 0) return lvl1;
    return Array.from(new Set(itemsCatalog.map((i) => i.category).filter(Boolean))).sort();
  }, [formOptions, itemsCatalog]);

  const subCategories = useMemo(() => {
    const list = categoryNamesAt(formOptions?.categories ?? [], 2, categoryFilter);
    if (list.length > 0) return list;
    return Array.from(
      new Set(itemsCatalog.filter((i) => !categoryFilter || i.category === categoryFilter).map((i) => i.subCategory || ""))
    )
      .filter(Boolean)
      .sort();
  }, [formOptions, itemsCatalog, categoryFilter]);

  const minorCategories = useMemo(() => {
    const list = categoryNamesAt(formOptions?.categories ?? [], 3, subCategoryFilter);
    if (list.length > 0) return list;
    return Array.from(
      new Set(
        itemsCatalog
          .filter((i) => (!categoryFilter || i.category === categoryFilter) && (!subCategoryFilter || i.subCategory === subCategoryFilter))
          .map((i) => i.minorCategory || "")
      )
    )
      .filter(Boolean)
      .sort();
  }, [formOptions, itemsCatalog, categoryFilter, subCategoryFilter]);

  const filteredItems = useMemo(() => {
    return itemsCatalog.filter((it) => {
      if (categoryFilter && it.category !== categoryFilter) return false;
      if (subCategoryFilter && it.subCategory !== subCategoryFilter) return false;
      if (minorCategoryFilter && it.minorCategory !== minorCategoryFilter) return false;
      return true;
    });
  }, [itemsCatalog, categoryFilter, subCategoryFilter, minorCategoryFilter]);

  const livePricing = useMemo(
    () =>
      computeVatLine({
        quantity: Number(lineQty) || 0,
        enteredRate: Number(lineRate) || 0,
        enteredTotal: Number(lineTotalInput) || 0,
        vatPercent: Number(lineVatPct) || 0,
        vatEnabled: lineVatEnabled,
        priceIncludesVat: priceIncludingVat,
        amountDriven,
      }),
    [lineQty, lineRate, lineTotalInput, lineVatPct, lineVatEnabled, priceIncludingVat, amountDriven]
  );

  const handleSelectSupplier = (id: string) => {
    setSupplierId(id);
    const sup = suppliers.find((s) => s.id === id);
    if (sup) {
      setContactName(sup.contactPerson || sup.name);
      setContactPhone(sup.phone && sup.phone !== "N/A" ? sup.phone : "");
    } else {
      setContactName("");
      setContactPhone("");
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    const it = itemsCatalog.find((i) => i.id === itemId);
    if (it) {
      setLineRate(String(it.standardPrice ?? 0));
      setLineVatPct(String(it.vatPercent ?? 0));
      setLineBrand(it.brand || "");
      setLineSpecification(it.description || "");
      const q = Number(lineQty) || 1;
      const vatP = lineVatEnabled ? Number(it.vatPercent ?? 0) : 0;
      const tot = priceIncludingVat
        ? round2(q * Number(it.standardPrice ?? 0))
        : round2(q * Number(it.standardPrice ?? 0) * (1 + vatP / 100));
      setLineTotalInput(String(tot));
    }
  };

  const handleLoadRequisition = (reqId: string) => {
    setSelectedRequisitionId(reqId);
    const req = requisitions.find((r) => r.id === reqId);
    if (!req) return;
    setPickedOfficeId(req.officeId);
    setPickedWarehouseId(req.warehouseId);
    setAddedLines(
      req.items.map((it, idx) => ({
        key: `req_${req.id}_${idx}`,
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        quantity: it.quantity,
        unitPrice: it.estimatedUnitPrice,
        taxPercentage: 0,
        vatAmount: 0,
        lineTotal: it.lineTotal,
        brand: "",
        specification: it.remarks || "",
      }))
    );
    toast.success(`Loaded ${req.items.length} item(s) from ${req.requisitionNumber}.`);
  };

  const handleLoadSalesOrder = (soId: string) => {
    setSelectedSalesOrderId(soId);
    const so = formOptions?.salesOrders.find((s) => s.id === soId);
    if (!so) return;
    if (so.officeId) setPickedOfficeId(so.officeId);
    if (so.shippingAddress) setShippingAddress(so.shippingAddress);
    setAddedLines(
      so.lines.map((l, idx) => {
        const calc = computeVatLine({
          quantity: l.qty,
          enteredRate: l.unitPrice,
          enteredTotal: 0,
          vatPercent: l.vatPercent,
          vatEnabled: true,
          priceIncludesVat: priceIncludingVat,
          amountDriven: false,
        });
        return {
          key: `so_${so.id}_${idx}`,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          quantity: l.qty,
          unitPrice: calc.baseUnitPrice,
          taxPercentage: calc.effectiveVatPercent,
          vatAmount: calc.vatAmount,
          lineTotal: calc.lineTotal,
          brand: "",
          specification: `SO ${so.number}`,
        };
      })
    );
    toast.success(`Loaded ${so.lines.length} item(s) from Sales Order ${so.number}.`);
  };

  const handleAddLine = () => {
    if (addAllFlag) {
      if (filteredItems.length === 0) return toast.error("No items match the current category filter.");
      const next: DirectDraftLine[] = filteredItems.map((it) => {
        const calc = computeVatLine({
          quantity: 1,
          enteredRate: Number(it.standardPrice ?? 0),
          enteredTotal: Number(it.standardPrice ?? 0),
          vatPercent: Number(it.vatPercent ?? 0),
          vatEnabled: lineVatEnabled,
          priceIncludesVat: priceIncludingVat,
          amountDriven: false,
        });
        return {
          key: `all_${it.id}_${Date.now()}`,
          itemId: it.id,
          itemCode: it.code,
          itemName: it.name,
          uom: it.uom,
          quantity: 1,
          unitPrice: calc.baseUnitPrice,
          taxPercentage: calc.effectiveVatPercent,
          vatAmount: calc.vatAmount,
          lineTotal: calc.lineTotal,
          brand: it.brand || "",
          specification: lineSpecification || it.description || "",
        };
      });
      setAddedLines((prev) => [...prev, ...next]);
      setAddAllFlag(false);
      return toast.success(`Added ${next.length} item(s).`);
    }

    const item = itemsCatalog.find((i) => i.id === selectedItemId);
    if (!item) return toast.error("Select an item first.");
    const qty = Number(lineQty);
    if (!(qty > 0)) return toast.error("Enter a quantity greater than 0.");

    const specNote = [lineBrand ? `Brand: ${lineBrand}` : "", lineSpecification].filter(Boolean).join(" | ");
    setAddedLines((prev) => [
      ...prev,
      {
        key: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        uom: item.uom || "Pcs",
        quantity: qty,
        unitPrice: livePricing.baseUnitPrice,
        taxPercentage: livePricing.effectiveVatPercent,
        vatAmount: livePricing.vatAmount,
        lineTotal: livePricing.lineTotal,
        brand: lineBrand,
        specification: specNote,
      },
    ]);
    setSelectedItemId("");
    setLineQty("1");
    setLineRate("");
    setLineTotalInput("");
    setLineVatPct("");
    setLineBrand("");
    setLineSpecification("");
  };

  const saveMutation = useMutation({
    mutationFn: async (saveAndNew: boolean) => {
      if (!selectedOfficeId) throw new Error("Office is required.");
      if (!selectedWarehouseId) throw new Error("Warehouse is required.");
      if (!supplierId) throw new Error("Select a supplier.");
      if (addedLines.length === 0) throw new Error("Add at least one item to receive.");

      const payDays = Number(paymentDaysAfterReceive);
      const paymentTermsLabel =
        Number.isFinite(payDays) && payDays > 0 ? `Net ${Math.floor(payDays)} Days` : "Cash / Immediate";
      const combinedRemarks = [
        remarks.trim(),
        contactName ? `Contact: ${contactName}${contactPhone ? ` (${contactPhone})` : ""}` : "",
        attachedFiles.length ? `Attachments: ${attachedFiles.map((f) => f.name).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const created = await fetchApi<GoodsReceipt>("/purchase/receive", {
        method: "POST",
        body: JSON.stringify({
          purchaseOrderId: "DIRECT",
          requisitionId: createFromRequisition && selectedRequisitionId ? selectedRequisitionId : undefined,
          officeId: selectedOfficeId,
          warehouseId: selectedWarehouseId,
          supplierId,
          receiptDate: receiveDate,
          challanNumber: challanNo.trim() || undefined,
          challanDate: challanDate || undefined,
          shipmentDocumentNumber: shipmentDocumentNumber.trim() || undefined,
          supplierInvoiceNumber: salesInvoiceNumber.trim() || undefined,
          vatChallanNumber: vatChallanNumber.trim() || undefined,
          gatePassNumber: deliveryNumber.trim() || undefined,
          deliveryNoteNumber: deliveryNumber.trim() || undefined,
          paymentTerms: paymentTermsLabel,
          deliveryTerms: shippingAddress.trim() || "FOB Destination",
          remarks: combinedRemarks || undefined,
          items: addedLines.map((l, idx) => ({
            poItemId: `direct_${idx + 1}`,
            itemId: l.itemId,
            itemCode: l.itemCode,
            itemName: l.itemName,
            uom: l.uom,
            orderedQuantity: l.quantity,
            previouslyReceivedQuantity: 0,
            currentReceivedQuantity: l.quantity,
            rejectedDamagedQuantity: 0,
            unitPrice: l.unitPrice,
            taxPercentage: l.taxPercentage,
            discountPercentage: 0,
            lineTotal: l.lineTotal,
            remarks: l.specification || undefined,
          })),
        }),
      });
      return { created, saveAndNew };
    },
    onSuccess: ({ created, saveAndNew }) => {
      queryClient.invalidateQueries({ queryKey: ["receivedGRNs"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-form-options"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success(`Direct Receive ${created.grnNumber} posted to Inventory Stock & GL.`);
      if (saveAndNew) {
        setAddedLines([]);
        setChallanNo("");
        setSalesInvoiceNumber("");
        setVatChallanNumber("");
        setRemarks("");
      } else {
        router.push("/purchase/receive");
      }
    },
    onError: (err: Error) => toast.error(err.message, { title: "Direct Receive Error" }),
  });

  const totals = useMemo(() => {
    const qty = addedLines.reduce((s, l) => s + l.quantity, 0);
    const vat = round2(addedLines.reduce((s, l) => s + l.vatAmount, 0));
    const net = round2(addedLines.reduce((s, l) => s + l.lineTotal, 0));
    return { qty, vat, net, sub: round2(net - vat) };
  }, [addedLines]);

  const inputCls =
    "h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Sticky Top Action Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/purchase/receive")}
            className="rounded-full p-1 text-slate-600 transition hover:bg-slate-100"
            title="Back to Purchase Receive"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base font-semibold text-slate-900">Direct Receive</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saveMutation.isPending || !perms.receive.create}
            onClick={() => saveMutation.mutate(true)}
            className="h-8 rounded border border-blue-500 bg-white px-3.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
          >
            Save & New
          </button>
          <button
            type="button"
            disabled={saveMutation.isPending || !perms.receive.create}
            onClick={() => saveMutation.mutate(false)}
            className="flex h-8 items-center gap-1.5 rounded bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
            SAVE
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3.5">
        {/* Card 1: Top Header */}
        <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="mb-3 grid grid-cols-2 gap-3 border-b border-slate-100 pb-2.5 text-xs text-slate-700 sm:grid-cols-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={createFromRequisition}
                onChange={(e) => setCreateFromRequisition(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Create From Requisition</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={createFromSalesOrder}
                onChange={(e) => setCreateFromSalesOrder(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Create From Sales Order</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={priceIncludingVat}
                onChange={(e) => setPriceIncludingVat(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Price Including VAT</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={amountDriven}
                onChange={(e) => setAmountDriven(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Amount Driven</span>
            </label>
          </div>

          {(createFromRequisition || createFromSalesOrder) && (
            <div className="mb-3 grid grid-cols-1 gap-3 rounded border border-blue-100 bg-blue-50/40 p-2.5 sm:grid-cols-2">
              {createFromRequisition && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-blue-800">Approved Requisition</label>
                  <SearchableCombobox
                    value={selectedRequisitionId}
                    onChange={handleLoadRequisition}
                    placeholder="Select Approved Requisition..."
                    options={requisitions.map((r) => ({
                      value: r.id,
                      label: `${r.requisitionNumber} — ${r.requesterName}`,
                      sublabel: `${r.requestDate} • ${formatCurrency(r.totalEstimatedAmount)}`,
                    }))}
                  />
                </div>
              )}
              {createFromSalesOrder && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-blue-800">Sales Order</label>
                  <SearchableCombobox
                    value={selectedSalesOrderId}
                    onChange={handleLoadSalesOrder}
                    placeholder="Select Sales Order..."
                    options={(formOptions?.salesOrders ?? []).map((so) => ({
                      value: so.id,
                      label: `${so.number} — ${so.customerName}`,
                      sublabel: `${so.orderDate} • ${so.lines.length} line(s)`,
                    }))}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Create Date</label>
              <input type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Office<span className="text-red-500">*</span>
              </label>
              <select value={selectedOfficeId} onChange={(e) => setPickedOfficeId(e.target.value)} className={inputCls}>
                <option value="">Select Office</option>
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
              <select value={selectedWarehouseId} onChange={(e) => setPickedWarehouseId(e.target.value)} className={inputCls}>
                <option value="">Select Warehouse</option>
                {availableWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Item Type<span className="text-red-500">*</span>
              </label>
              <select value={itemType} onChange={(e) => setItemType(e.target.value)} className={inputCls}>
                {INVENTORY_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700">
                  Select Supplier<span className="text-red-500">*</span>
                </label>
                {perms.quickSupplierCreate && (
                  <button
                    type="button"
                    onClick={() => setIsAddSupplierOpen(true)}
                    className="inline-flex items-center gap-0.5 min-h-6 -my-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3 w-3" /> ADD NEW
                  </button>
                )}
              </div>
              <SearchableCombobox
                value={supplierId}
                onChange={handleSelectSupplier}
                placeholder="Select/Search Supplier..."
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: s.name,
                  sublabel: `${s.code}${s.phone ? ` • ${s.phone}` : ""}`,
                }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Name</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Name"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Phone"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Challan No</label>
              <input
                type="text"
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                placeholder="Challan No"
                className={inputCls}
              />
            </div>

            {viewDetails && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter remarks"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">Payment Days after Receive</label>
                  <input
                    type="number"
                    min="0"
                    value={paymentDaysAfterReceive}
                    onChange={(e) => setPaymentDaysAfterReceive(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">Shipping Address</label>
                  <input
                    type="text"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Shipping Address"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">Shipment Document Number</label>
                  <input
                    type="text"
                    value={shipmentDocumentNumber}
                    onChange={(e) => setShipmentDocumentNumber(e.target.value)}
                    placeholder="Shipment Document Number"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">Sales Invoice Number</label>
                  <input
                    type="text"
                    value={salesInvoiceNumber}
                    onChange={(e) => setSalesInvoiceNumber(e.target.value)}
                    placeholder="Sales Invoice Number"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">VAT Challan Number</label>
                  <input
                    type="text"
                    value={vatChallanNumber}
                    onChange={(e) => setVatChallanNumber(e.target.value)}
                    placeholder="VAT Challan Number"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">Challan Date</label>
                  <input type="date" value={challanDate} onChange={(e) => setChallanDate(e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">Delivery Number</label>
                  <input
                    type="text"
                    value={deliveryNumber}
                    onChange={(e) => setDeliveryNumber(e.target.value)}
                    placeholder="Delivery Number"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">Attachment</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files?.length) setAttachedFiles(Array.from(e.target.files));
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {attachedFiles.length > 0 ? `${attachedFiles.length} file(s)` : "Attach"}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setViewDetails((v) => !v)}
              className="inline-flex items-center gap-1 min-h-6 text-[11px] font-semibold text-slate-700 hover:text-blue-600"
            >
              <span>View Details</span>
              {viewDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Card 2: Item Entry */}
        <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setSubCategoryFilter("");
                  setMinorCategoryFilter("");
                }}
                className={inputCls}
              >
                <option value="">Select</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Sub Category</label>
              <select
                value={subCategoryFilter}
                onChange={(e) => {
                  setSubCategoryFilter(e.target.value);
                  setMinorCategoryFilter("");
                }}
                className={inputCls}
              >
                <option value="">Select</option>
                {subCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Minor Category</label>
              <select
                value={minorCategoryFilter}
                onChange={(e) => setMinorCategoryFilter(e.target.value)}
                className={inputCls}
              >
                <option value="">Select</option>
                {minorCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={filterBySupplier}
                  onChange={(e) => setFilterBySupplier(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>Item Filter By Supplier</span>
              </label>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700">
                  Item<span className="text-red-500">*</span>
                </label>
                {perms.quickItemCreate && (
                  <button
                    type="button"
                    onClick={() => setIsAddItemOpen(true)}
                    className="inline-flex items-center gap-0.5 min-h-6 -my-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3 w-3" /> ADD NEW
                  </button>
                )}
              </div>
              <SearchableCombobox
                value={selectedItemId}
                onChange={handleSelectItem}
                placeholder="Select/Search Item (min 3 letters)"
                minCharsHint={3}
                options={filteredItems.map((it) => ({
                  value: it.id,
                  label: `${it.code} - ${it.name}`,
                  sublabel: `${it.category} • ${it.uom} • Base: ${it.standardPrice}`,
                  searchText: `${it.barcode ?? ""} ${it.brand ?? ""}`,
                }))}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>Quantity</span>
                <Info className="h-3.5 w-3.5 text-slate-400" />
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

            <div className="lg:col-span-2">
              <label className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>
                  Rate (BDT)<span className="text-red-500">*</span>
                </span>
                <Info className="h-3.5 w-3.5 text-slate-400" />
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                readOnly={amountDriven}
                value={amountDriven ? String(livePricing.displayRate || "") : lineRate}
                onChange={(e) => setLineRate(e.target.value)}
                placeholder="Rate"
                className={amountDriven ? "h-8 w-full rounded border border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-600" : inputCls}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Total Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                readOnly={!amountDriven}
                value={amountDriven ? lineTotalInput : livePricing.lineTotal ? String(livePricing.lineTotal) : ""}
                onChange={(e) => setLineTotalInput(e.target.value)}
                placeholder="Total Amount"
                className={!amountDriven ? "h-8 w-full rounded border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700" : inputCls}
              />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700">VAT(%)</label>
                <input
                  type="checkbox"
                  checked={lineVatEnabled}
                  onChange={(e) => setLineVatEnabled(e.target.checked)}
                  title="Apply VAT on line"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                disabled={!lineVatEnabled}
                value={lineVatPct}
                onChange={(e) => setLineVatPct(e.target.value)}
                placeholder="VAT"
                className={inputCls}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Brand</label>
              <input
                type="text"
                value={lineBrand}
                onChange={(e) => setLineBrand(e.target.value)}
                placeholder="Enter brand"
                className={inputCls}
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Specification</label>
              <input
                type="text"
                value={lineSpecification}
                onChange={(e) => setLineSpecification(e.target.value)}
                placeholder="Enter specification"
                className={inputCls}
              />
            </div>
            <label className="flex h-8 cursor-pointer items-center gap-2 px-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={addAllFlag}
                onChange={(e) => setAddAllFlag(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>All</span>
            </label>
            <button
              type="button"
              onClick={handleAddLine}
              className="h-8 rounded border border-slate-300 bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white"
            >
              Add
            </button>
          </div>
        </div>

        {/* Received Items Table */}
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="px-3 py-2">SL</th>
                  <th className="px-3 py-2">Item Code</th>
                  <th className="px-3 py-2">Item Name</th>
                  <th className="px-3 py-2">UoM</th>
                  <th className="px-3 py-2">Brand / Spec</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Base Rate (BDT)</th>
                  <th className="px-3 py-2 text-right">VAT %</th>
                  <th className="px-3 py-2 text-right">VAT Amt</th>
                  <th className="px-3 py-2 text-right">Total Amount</th>
                  <th className="px-3 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {addedLines.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-xs text-slate-400">
                      No items added yet. Select an item above and click Add to receive directly into warehouse stock.
                    </td>
                  </tr>
                ) : (
                  addedLines.map((row, idx) => (
                    <tr key={row.key} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-sky-700">{row.itemCode}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{row.itemName}</td>
                      <td className="px-3 py-2 text-slate-600">{row.uom}</td>
                      <td className="px-3 py-2 text-slate-500">{row.specification || row.brand || "-"}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.taxPercentage}%</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.vatAmount)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                        {formatCurrency(row.lineTotal)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setAddedLines((prev) => prev.filter((l) => l.key !== row.key))}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          title="Remove item"
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
            <div className="flex flex-wrap items-center justify-end gap-6 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
              <span className="text-slate-600">
                Total Qty: <strong className="font-mono text-slate-900">{totals.qty}</strong>
              </span>
              <span className="text-slate-600">
                Subtotal: <strong className="font-mono text-slate-900">{formatCurrency(totals.sub)}</strong>
              </span>
              <span className="text-slate-600">
                Total VAT: <strong className="font-mono text-slate-900">{formatCurrency(totals.vat)}</strong>
              </span>
              <span className="text-slate-700">
                Net Receive Value: <strong className="font-mono text-sm text-blue-700">{formatCurrency(totals.net)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      <QuickAddSupplierModal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        onCreated={(s) => handleSelectSupplier(s.id)}
      />

      <QuickAddItemModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        categories={formOptions?.categories ?? []}
        onCreated={(it) => handleSelectItem(it.id)}
      />
    </div>
  );
}

