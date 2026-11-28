"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp, CreditCard, Info, Paperclip, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
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
  QuickAddSupplierModal,
  SearchableCombobox,
  TermsConditionModal,
  type PurchaseFormOptions,
} from "@/features/purchase/components/PurchaseFormShared";
import type { Item, Office, PurchaseOrder, PurchaseRequisition, Supplier, Warehouse } from "@bridgeone/contracts";
import { NativeDateInput } from "@/components/ui/date-input";
import { formatDate } from "@/lib/format";

interface OrderDraftLine {
  key: string;
  selected?: boolean;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  quantity: number;
  restQty?: number;
  issueQty?: number;
  unitPrice: number;
  taxPercentage: number;
  vatAmount: number;
  lineTotal: number;
  brand: string;
  specification: string;
}

const fmtNum = (n: number) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CreatePurchaseOrderView() {
  const searchParams = useSearchParams();
  const requisitionIdParam = searchParams.get("requisitionId") || "";
  const itemsParam = searchParams.get("items") || "";
  const editIdParam = searchParams.get("editId") || "";

  const { data: initialReq, isLoading: loadingReq } = useQuery<PurchaseRequisition | null>({
    queryKey: ["po-prefill-req", requisitionIdParam],
    enabled: Boolean(requisitionIdParam),
    queryFn: async () => {
      const list = await fetchApi<PurchaseRequisition[]>("/purchase/requisitions");
      return list.find((r) => r.id === requisitionIdParam || r.requisitionNumber === requisitionIdParam) ?? null;
    },
  });

  const { data: editOrder, isLoading: loadingEdit } = useQuery<PurchaseOrder | null>({
    queryKey: ["po-prefill-edit", editIdParam],
    enabled: Boolean(editIdParam),
    queryFn: () => fetchApi<PurchaseOrder>(`/purchase/orders/${editIdParam}`),
  });

  if ((requisitionIdParam && loadingReq) || (editIdParam && loadingEdit)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6 text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <CreatePurchaseOrderForm
      key={`${editOrder?.id ?? ""}_${initialReq?.id ?? "new"}_${itemsParam}`}
      initialReq={initialReq ?? null}
      selectedItemIdsParam={itemsParam}
      editOrder={editOrder ?? null}
    />
  );
}

function CreatePurchaseOrderForm({
  initialReq,
  selectedItemIdsParam,
  editOrder,
}: {
  initialReq: PurchaseRequisition | null;
  selectedItemIdsParam?: string;
  editOrder: PurchaseOrder | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const perms = usePurchasePermissions();
  const canSaveOrder = editOrder ? perms.orders.edit : perms.orders.create;
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultExpectedStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  }, []);

  // Master Data Queries
  const { data: offices = [] } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
  });
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
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
  const { data: stockOnHandRows = [] } = useQuery<{ warehouseId: string; itemId: string; qty: number }[]>({
    queryKey: ["inventory-stock-on-hand"],
    queryFn: () => fetchApi("/inventory/stock"),
  });

  // Top Checkboxes
  const [createFromSalesOrder, setCreateFromSalesOrder] = useState(false);
  const [createFromProject, setCreateFromProject] = useState(Boolean(editOrder?.projectCostCenter));
  const [createFromRequisition, setCreateFromRequisition] = useState(Boolean(initialReq || editOrder?.requisitionId));
  const [priceIncludingVat, setPriceIncludingVat] = useState(false);
  const [amountDriven, setAmountDriven] = useState(false);

  // Conditional Source Selections
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");
  const [selectedProject, setSelectedProject] = useState(editOrder?.projectCostCenter || "");
  const [selectedRequisitionId, setSelectedRequisitionId] = useState(editOrder?.requisitionId || initialReq?.id || "");

  // Header Fields
  const [orderDate, setOrderDate] = useState(editOrder?.orderDate || todayStr);
  const [pickedOfficeId, setPickedOfficeId] = useState<string | null>(editOrder?.officeId || initialReq?.officeId || null);
  const [pickedWarehouseId, setPickedWarehouseId] = useState(editOrder?.warehouseId || initialReq?.warehouseId || "");
  const [inventoryType, setInventoryType] = useState("Inventory Item");
  const [supplierId, setSupplierId] = useState(editOrder?.supplierId || "");
  const [shippingAddress, setShippingAddress] = useState("");
  const [urgency, setUrgency] = useState("Medium");
  const [expectedReceiveDate, setExpectedReceiveDate] = useState(
    editOrder?.expectedDeliveryDate || initialReq?.requiredDeliveryDate || defaultExpectedStr
  );
  const [paymentDaysAfterReceive, setPaymentDaysAfterReceive] = useState("30");
  const [shipmentDocumentNumber, setShipmentDocumentNumber] = useState("");
  const [salesInvoiceNumber, setSalesInvoiceNumber] = useState("");
  const [vatChallanNumber, setVatChallanNumber] = useState("");
  const [challanDate, setChallanDate] = useState("");
  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [remarks, setRemarks] = useState(editOrder?.notes || "");
  const [termsText, setTermsText] = useState("");
  const [referenceNumber, setReferenceNumber] = useState(editOrder?.referenceNumber || "");
  const [referenceDate, setReferenceDate] = useState(todayStr);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [viewDetails, setViewDetails] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  // Category Cascade + Line Entry State
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

  // Table-level distribution VAT & bottom summary charges/discount
  const [distVatEnabled, setDistVatEnabled] = useState(false);
  const [distVatPct, setDistVatPct] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [discountTk, setDiscountTk] = useState("");
  const [labourCharge, setLabourCharge] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [infoPopover, setInfoPopover] = useState<{ key: string; top: number; left: number } | null>(null);
  const [editingDescKey, setEditingDescKey] = useState<string | null>(null);

  // Draft Order Lines
  const [addedLines, setAddedLines] = useState<OrderDraftLine[]>(() => {
    if (editOrder) {
      return editOrder.items.map((it, i) => ({
        key: `edit_${i}_${it.itemId}`,
        selected: true,
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        quantity: it.orderedQuantity,
        restQty: it.orderedQuantity,
        issueQty: 0,
        unitPrice: it.unitPrice,
        taxPercentage: it.taxPercentage ?? 0,
        vatAmount: it.taxAmount ?? round2((it.orderedQuantity * it.unitPrice * (it.taxPercentage ?? 0)) / 100),
        lineTotal: it.lineTotal,
        brand: "",
        specification: it.remarks || "",
      }));
    }
    if (initialReq) {
      const filterIds = selectedItemIdsParam
        ? new Set(selectedItemIdsParam.split(",").map((s) => s.trim()).filter(Boolean))
        : null;
      const sourceItems = filterIds && filterIds.size > 0
        ? initialReq.items.filter((it) => filterIds.has(it.itemId))
        : initialReq.items;
      return sourceItems.map((it, i) => ({
        key: `req_${i}_${it.itemId}`,
        selected: true,
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        quantity: it.quantity,
        restQty: it.quantity,
        issueQty: 0,
        unitPrice: it.estimatedUnitPrice,
        taxPercentage: 0,
        vatAmount: 0,
        lineTotal: it.lineTotal,
        brand: "",
        specification: it.remarks || "",
      }));
    }
    return [];
  });

  const defaultOfficeId = useMemo(() => {
    if (!offices.length) return "";
    const withWh = offices.find((o) => warehouses.some((w) => w.officeId === o.id));
    return withWh?.id || offices[0]?.id || "";
  }, [offices, warehouses]);

  const selectedOfficeId = pickedOfficeId !== null ? pickedOfficeId : defaultOfficeId;
  const availableWarehouses = useMemo(
    () => (selectedOfficeId ? warehouses.filter((w) => w.officeId === selectedOfficeId) : []),
    [warehouses, selectedOfficeId]
  );
  const selectedWarehouseId = selectedOfficeId && availableWarehouses.some((w) => w.id === pickedWarehouseId)
    ? pickedWarehouseId
    : (availableWarehouses[0]?.id ?? "");

  const selectedOfficeObj = offices.find((o) => o.id === selectedOfficeId);
  const etaPreview = useMemo(() => {
    const dt = new Date((expectedReceiveDate || orderDate) + "T00:00:00");
    if (Number.isNaN(dt.getTime())) return "00.00h";
    return `00.00h (${dt.toLocaleDateString("en-GB", { weekday: "short" })}, ${formatDate(dt)})`;
  }, [expectedReceiveDate, orderDate]);

  // 3-Level Category Options
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
      // Only items ticked "Can be Purchased" in the Item Profile can be ordered.
      if (it.canBePurchased === false) return false;
      if (categoryFilter && it.category !== categoryFilter) return false;
      if (subCategoryFilter && it.subCategory !== subCategoryFilter) return false;
      if (minorCategoryFilter && it.minorCategory !== minorCategoryFilter) return false;
      return true;
    });
  }, [itemsCatalog, categoryFilter, subCategoryFilter, minorCategoryFilter]);

  // Live Line Computation Preview
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

  const handleAddLine = () => {
    if (addAllFlag) {
      if (filteredItems.length === 0) return toast.error("No items match the current category filter.");
      const next: OrderDraftLine[] = filteredItems.map((it) => {
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
          selected: true,
          itemId: it.id,
          itemCode: it.code,
          itemName: it.name,
          uom: it.uom,
          quantity: 1,
          restQty: 1,
          issueQty: 0,
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
      return toast.success(`Added ${next.length} filtered item(s).`);
    }

    const item = itemsCatalog.find((i) => i.id === selectedItemId);
    if (!item) return toast.error("Select an item first.");
    const qty = Number(lineQty);
    if (!(qty > 0)) return toast.error("Enter Quantity greater than 0.");
    if (livePricing.baseUnitPrice < 0) return toast.error("Rate cannot be negative.");

    const specNote = [lineBrand ? `Brand: ${lineBrand}` : "", lineSpecification].filter(Boolean).join(" | ");
    setAddedLines((prev) => [
      ...prev,
      {
        key: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        selected: true,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        uom: item.uom || "Pcs",
        quantity: qty,
        restQty: qty,
        issueQty: 0,
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

  const handleLoadSalesOrder = (soId: string) => {
    setSelectedSalesOrderId(soId);
    const so = formOptions?.salesOrders.find((s) => s.id === soId);
    if (!so) return;
    if (so.officeId) setPickedOfficeId(so.officeId);
    if (so.shippingAddress) setShippingAddress(so.shippingAddress);
    if (so.projectRef) {
      setCreateFromProject(true);
      setSelectedProject(so.projectRef);
    }
    setReferenceNumber(so.number);
    setReferenceDate(so.orderDate);
    setAddedLines(
      so.lines.map((l, idx) => {
        const calc = computeVatLine({
          quantity: l.qty,
          enteredRate: l.unitPrice,
          enteredTotal: 0,
          vatPercent: l.vatPercent,
          vatEnabled: true,
          priceIncludesVat: false,
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

  const handleLoadRequisition = (reqId: string) => {
    setSelectedRequisitionId(reqId);
    const req = requisitions.find((r) => r.id === reqId);
    if (!req) return;
    setPickedOfficeId(req.officeId);
    setPickedWarehouseId(req.warehouseId);
    if (req.requiredDeliveryDate) setExpectedReceiveDate(req.requiredDeliveryDate);
    setReferenceNumber(req.requisitionNumber);
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
    toast.success(`Loaded items from Requisition ${req.requisitionNumber}.`);
  };

  const updateLine = (
    key: string,
    patch: Partial<Pick<OrderDraftLine, "selected" | "quantity" | "unitPrice" | "taxPercentage" | "brand" | "specification">>
  ) => {
    setAddedLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        const q = Math.max(0, Number(next.quantity) || 0);
        const r = Math.max(0, Number(next.unitPrice) || 0);
        const vatP = Math.max(0, Number(next.taxPercentage) || 0);
        const itemTotal = round2(q * r);
        const vatAmt = round2((itemTotal * vatP) / 100);
        return {
          ...next,
          quantity: q,
          unitPrice: r,
          taxPercentage: vatP,
          vatAmount: vatAmt,
          lineTotal: round2(itemTotal + vatAmt),
        };
      })
    );
  };

  const applyDistributionVat = (pctValue: number) => {
    const vatP = Math.max(0, pctValue);
    setAddedLines((prev) =>
      prev.map((line) => {
        const itemTotal = round2(line.quantity * line.unitPrice);
        const vatAmt = round2((itemTotal * vatP) / 100);
        return {
          ...line,
          taxPercentage: vatP,
          vatAmount: vatAmt,
          lineTotal: round2(itemTotal + vatAmt),
        };
      })
    );
  };

  const saveMutation = useMutation({
    mutationFn: async (saveAndNew: boolean) => {
      if (!selectedOfficeId) throw new Error("Office is required.");
      if (!selectedWarehouseId) throw new Error("Warehouse is required.");
      if (!supplierId) throw new Error("Select a supplier.");
      const activeLines = addedLines.filter((l) => l.selected !== false);
      if (activeLines.length === 0) throw new Error("Select or add at least one item to the Purchase Order.");

      const extraShipping = round2(
        (Number(labourCharge) || 0) + (Number(deliveryCharge) || 0) + (Number(otherCharges) || 0)
      );
      const discVal = round2(Number(discountTk) || 0);

      const noteSegments = [
        remarks.trim(),
        urgency && urgency !== "Medium" ? `Urgency: ${urgency}` : "",
        shippingAddress.trim() ? `Ship To: ${shippingAddress.trim()}` : "",
        shipmentDocumentNumber.trim() ? `Shipment Doc: ${shipmentDocumentNumber.trim()}` : "",
        salesInvoiceNumber.trim() ? `Sales Inv: ${salesInvoiceNumber.trim()}` : "",
        vatChallanNumber.trim() ? `VAT Challan: ${vatChallanNumber.trim()}${challanDate ? ` (${challanDate})` : ""}` : "",
        deliveryNumber.trim() ? `Delivery No: ${deliveryNumber.trim()}` : "",
        discVal > 0 ? `Discount: ${discVal} BDT` : "",
        termsText.trim() ? `Terms: ${termsText.trim()}` : "",
        attachedFiles.length ? `Attachments: ${attachedFiles.map((f) => f.name).join(", ")}` : "",
      ].filter(Boolean);

      const payDays = Number(paymentDaysAfterReceive);
      const paymentTermsLabel =
        Number.isFinite(payDays) && payDays > 0 ? `Net ${Math.floor(payDays)} Days` : "Cash / Immediate";

      const payload = {
        companyId: "comp-bridgeone-01",
        requisitionId: createFromRequisition && selectedRequisitionId ? selectedRequisitionId : undefined,
        supplierId,
        officeId: selectedOfficeId,
        warehouseId: selectedWarehouseId,
        projectCostCenter: createFromProject && selectedProject ? selectedProject : undefined,
        orderDate,
        expectedDeliveryDate: expectedReceiveDate || orderDate,
        referenceNumber: referenceNumber.trim() || deliveryNumber.trim() || undefined,
        paymentTerms: paymentTermsLabel,
        deliveryTerms: shippingAddress.trim() || selectedOfficeObj?.address || "FOB Warehouse",
        shippingFee: extraShipping,
        notes: noteSegments.join(" | ") || undefined,
        items: activeLines.map((l) => ({
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          orderedQuantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercentage: Number(discountPct) || 0,
          taxPercentage: l.taxPercentage,
          lineTotal: l.lineTotal,
          remarks: [l.brand ? `Brand: ${l.brand}` : "", l.specification].filter(Boolean).join(" | ") || undefined,
        })),
      };

      const res = editOrder
        ? await fetchApi<PurchaseOrder>(`/purchase/orders/${editOrder.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await fetchApi<PurchaseOrder>("/purchase/orders", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      return { res, saveAndNew };
    },
    onSuccess: ({ res, saveAndNew }) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-requisitions"] });
      toast.success(
        editOrder ? `Purchase Order ${res.poNumber} updated.` : `Purchase Order ${res.poNumber} saved to database.`
      );
      if (saveAndNew && !editOrder) {
        setAddedLines([]);
        setRemarks("");
        setReferenceNumber("");
        setSelectedItemId("");
      } else {
        router.push("/purchase/orders");
      }
    },
    onError: (err: Error) => toast.error(err.message, { title: "Purchase Order Error" }),
  });

  const totals = useMemo(() => {
    const active = addedLines.filter((l) => l.selected !== false);
    const qty = round2(active.reduce((s, l) => s + l.quantity, 0));
    const itemTotal = round2(active.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
    const vat = round2(active.reduce((s, l) => s + l.vatAmount, 0));
    const net = round2(active.reduce((s, l) => s + l.lineTotal, 0));
    const disc = round2(Number(discountTk) || 0);
    const charges = round2((Number(labourCharge) || 0) + (Number(deliveryCharge) || 0) + (Number(otherCharges) || 0));
    const grandTotal = Math.max(0, round2(net - disc + charges));
    return { qty, vat, net, sub: itemTotal, grandTotal };
  }, [addedLines, discountTk, labourCharge, deliveryCharge, otherCharges]);

  const inputCls =
    "h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-blue-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-canvas p-3 md:p-6 text-ink">
      {/* Top Sticky Action Bar */}
      <div data-sticky-head className="sticky top-14 z-20 -mx-3 -mt-3 px-3 pt-3 pb-3 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 bg-canvas">
        <div className="bg-surface border border-line/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/purchase/orders")}
              className="h-8 w-8 rounded border border-line-strong flex items-center justify-center text-ink-muted hover:bg-canvas transition"
              title="Back to Purchase Orders"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-ink tracking-tight">
              {editOrder ? `Edit Purchase Order — ${editOrder.poNumber}` : "Create Purchase Order"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!editOrder && (
              <button
                type="button"
                disabled={saveMutation.isPending || !canSaveOrder}
                title={!canSaveOrder ? "Requires Create permission in Configuration" : undefined}
                onClick={() => saveMutation.mutate(true)}
                className="h-8 px-4 border border-[#2563eb] text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10 font-semibold text-xs rounded transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {saveMutation.isPending && <Spinner className="size-3.5" />}
                Save & New
              </button>
            )}
            <button
              type="button"
              disabled={saveMutation.isPending || !canSaveOrder}
              title={!canSaveOrder ? "Requires Create/Edit permission in Configuration" : undefined}
              onClick={() => saveMutation.mutate(false)}
              className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              {saveMutation.isPending && <Spinner className="size-3.5" />}
              SAVE
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Card 1: Top Header & Flags */}
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
          {/* Top Checkboxes Row */}
          <div className="mb-3 flex flex-wrap items-center gap-5 border-b border-line pb-2.5 text-xs text-ink-muted">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={createFromSalesOrder}
                onChange={(e) => setCreateFromSalesOrder(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong text-blue-600 dark:text-blue-400"
              />
              <span>Create From Sales Order</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={createFromProject}
                onChange={(e) => setCreateFromProject(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong text-blue-600 dark:text-blue-400"
              />
              <span>Create From Project</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={createFromRequisition}
                onChange={(e) => setCreateFromRequisition(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong text-blue-600 dark:text-blue-400"
              />
              <span>Create From Requisition</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={priceIncludingVat}
                onChange={(e) => setPriceIncludingVat(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong text-blue-600 dark:text-blue-400"
              />
              <span>Price Including VAT</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={amountDriven}
                onChange={(e) => setAmountDriven(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong text-blue-600 dark:text-blue-400"
              />
              <span>Amount Driven</span>
            </label>
          </div>

          {/* Conditional Source Selectors */}
          {(createFromSalesOrder || createFromProject || createFromRequisition) && (
            <div className="mb-3 grid grid-cols-1 gap-3 rounded border border-blue-100 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-500/10 p-2.5 sm:grid-cols-3">
              {createFromSalesOrder && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-blue-800 dark:text-blue-300">Sales Order</label>
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
              {createFromProject && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-blue-800 dark:text-blue-300">Project / Cost Center</label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select Project / Cost Center</option>
                    {(formOptions?.projects ?? []).map((p) => (
                      <option key={p.id} value={`${p.code} - ${p.name}`}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {createFromRequisition && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-blue-800 dark:text-blue-300">Approved Requisition</label>
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
            </div>
          )}

          {/* Main 4-Col Header Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Create Date
                </label>
                <NativeDateInput type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={inputCls} />
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
                    const matchingWh = warehouses.find((w) => w.officeId === newOfficeId);
                    setPickedWarehouseId(matchingWh?.id || "");
                  }}
                  className={inputCls}
                >
                  <option value="">Office</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Inventory Type
                </label>
                <select value={inventoryType} onChange={(e) => setInventoryType(e.target.value)} className={inputCls}>
                  {INVENTORY_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink-muted">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Select Supplier
                  </label>
                  {perms.quickSupplierCreate && (
                    <button
                      type="button"
                      onClick={() => setIsAddSupplierOpen(true)}
                      className="inline-flex items-center gap-0.5 min-h-6 -my-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <Plus className="h-3 w-3" /> ADD NEW
                    </button>
                  )}
                </div>
              <SearchableCombobox
                value={supplierId}
                onChange={setSupplierId}
                placeholder="Select/Search Supplier (min 3 letters)"
                minCharsHint={3}
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: s.name,
                  sublabel: `${s.code}${s.phone ? ` • ${s.phone}` : ""}`,
                }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Shipping Address</label>
              <input
                type="text"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Shipping Address"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Urgency</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={inputCls}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Estimated Time of Arrival</label>
              <input
                type="text"
                readOnly
                value={etaPreview}
                className="h-8 w-full cursor-default rounded border border-line bg-control px-2.5 text-xs text-ink-muted focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Expected Receive Date</label>
              <NativeDateInput
                type="date"
                value={expectedReceiveDate}
                onChange={(e) => setExpectedReceiveDate(e.target.value)}
                className={inputCls}
              />
            </div>

            {viewDetails && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Payment Days After Receive</label>
                  <input
                    type="number"
                    min="0"
                    value={paymentDaysAfterReceive}
                    onChange={(e) => setPaymentDaysAfterReceive(e.target.value)}
                    placeholder="Payment Days After Receive"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Shipment Document Number</label>
                  <input
                    type="text"
                    value={shipmentDocumentNumber}
                    onChange={(e) => setShipmentDocumentNumber(e.target.value)}
                    placeholder="Shipment Document Number"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Sales Invoice Number</label>
                  <input
                    type="text"
                    value={salesInvoiceNumber}
                    onChange={(e) => setSalesInvoiceNumber(e.target.value)}
                    placeholder="Sales Invoice Number"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-muted">VAT Challan Number</label>
                  <input
                    type="text"
                    value={vatChallanNumber}
                    onChange={(e) => setVatChallanNumber(e.target.value)}
                    placeholder="VAT Challan Number"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Challan Date</label>
                  <NativeDateInput type="date" value={challanDate} onChange={(e) => setChallanDate(e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Delivery Number</label>
                  <input
                    type="text"
                    value={deliveryNumber}
                    onChange={(e) => setDeliveryNumber(e.target.value)}
                    placeholder="Delivery Number"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter remarks"
                    className={inputCls}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setIsTermsModalOpen(true)}
                    className="h-8 rounded bg-blue-600 px-3.5 text-xs font-medium text-white transition hover:bg-blue-700"
                  >
                    Terms And Conditions {termsText ? "✓" : ""}
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Reference Number</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Reference Number"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Reference Date</label>
                  <NativeDateInput
                    type="date"
                    value={referenceDate}
                    onChange={(e) => setReferenceDate(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-muted">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Receiving Warehouse
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
                  <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Attachment</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files?.length) setAttachedFiles(Array.from(e.target.files));
                    }}
                    className="hidden"
                  />
                  <div className="flex h-8 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong px-2.5 text-xs text-ink-muted hover:bg-canvas"
                      title="Attach document"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {attachedFiles.length > 0 ? `${attachedFiles.length} file(s)` : "Attach"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setViewDetails((v) => !v)}
              className="inline-flex items-center gap-1 min-h-6 text-[11px] font-semibold text-ink-muted hover:text-blue-600 dark:hover:text-blue-400"
            >
              <span>View Details</span>
              {viewDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
            </div>
          )}
        </div>

        {/* Card 2: Order Items */}
        <div className="bg-surface border border-line/90 rounded shadow-2xs overflow-hidden mb-3">
          <div className="flex items-center justify-between border-b border-line bg-surface px-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-t bg-grid-head text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 transition"
              >
                Order Items
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Category</label>
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
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Sub Category</label>
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
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Minor Category</label>
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
              <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={filterBySupplier}
                  onChange={(e) => setFilterBySupplier(e.target.checked)}
                  className="h-4 w-4 rounded border-line-strong text-blue-600 dark:text-blue-400"
                />
                <span>Item Filter By Supplier</span>
              </label>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <label className="mb-1 block text-xs font-semibold text-ink-muted">
                <span className="text-red-500 font-bold mr-0.5">*</span>Item
              </label>
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
              <label className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-muted">
                <span>
                  <span className="text-red-500 font-bold mr-0.5">*</span>Quantity
                </span>
                <Info className="h-3.5 w-3.5 text-ink-faint" />
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={lineQty}
                onChange={(e) => setLineQty(e.target.value)}
                placeholder="Qty"
                className={inputCls}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-muted">
                <span>
                  <span className="text-red-500 font-bold mr-0.5">*</span>Rate (BDT)
                </span>
                <Info className="h-3.5 w-3.5 text-ink-faint" />
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                readOnly={amountDriven}
                value={amountDriven ? String(livePricing.displayRate || "") : lineRate}
                onChange={(e) => setLineRate(e.target.value)}
                placeholder="Rate"
                className={amountDriven ? "h-8 w-full rounded border border-line bg-control px-2.5 text-xs text-ink-muted" : inputCls}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Total Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                readOnly={!amountDriven}
                value={amountDriven ? lineTotalInput : livePricing.lineTotal ? String(livePricing.lineTotal) : ""}
                onChange={(e) => setLineTotalInput(e.target.value)}
                placeholder="Total Amount"
                className={!amountDriven ? "h-8 w-full rounded border border-line bg-canvas px-2.5 text-xs text-ink-muted" : inputCls}
              />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[11px] font-semibold text-ink-muted">VAT(%)</label>
                <input
                  type="checkbox"
                  checked={lineVatEnabled}
                  onChange={(e) => setLineVatEnabled(e.target.checked)}
                  title="Apply VAT on line"
                  className="h-3.5 w-3.5 rounded border-line-strong text-blue-600 dark:text-blue-400"
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
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Brand</label>
              <input
                type="text"
                value={lineBrand}
                onChange={(e) => setLineBrand(e.target.value)}
                placeholder="Enter brand"
                className={inputCls}
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Specification</label>
              <input
                type="text"
                value={lineSpecification}
                onChange={(e) => setLineSpecification(e.target.value)}
                placeholder="Enter specification"
                className={inputCls}
              />
            </div>
            <label className="flex h-8 cursor-pointer items-center gap-2 px-1 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={addAllFlag}
                onChange={(e) => setAddAllFlag(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong text-blue-600 dark:text-blue-400"
              />
              <span>All</span>
            </label>
            <button
              type="button"
              onClick={handleAddLine}
              className="h-8 rounded border border-line-strong bg-control px-4 text-xs font-semibold text-ink-muted transition hover:bg-blue-600 hover:border-blue-600 hover:text-white"
            >
              Add
            </button>
          </div>

          {/* Added Lines Table (inline editable matching ERP layout) */}
          <div className="space-y-3 mt-3">
            <div className="overflow-hidden rounded border border-grid-line bg-surface">
              <div className="overflow-x-auto">
                <table className="erp-table erp-table-compact w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="w-8 text-center">
                        <input
                          type="checkbox"
                          className="size-3.5 cursor-pointer accent-primary"
                          aria-label="Select all items"
                          checked={addedLines.length > 0 && addedLines.every((l) => l.selected !== false)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAddedLines((prev) => prev.map((l) => ({ ...l, selected: checked })));
                          }}
                        />
                      </th>
                      <th className="w-8 text-center">SL</th>
                      <th className="whitespace-nowrap">Item Code</th>
                      <th className="min-w-[160px]">Item Name</th>
                      <th className="text-right whitespace-nowrap">Current Stock</th>
                      <th className="whitespace-nowrap">UoM</th>
                      <th className="text-right whitespace-nowrap min-w-[95px]">Quantity</th>
                      <th className="text-right whitespace-nowrap">Rest Qty</th>
                      <th className="text-right whitespace-nowrap">Issue Qty</th>
                      <th className="text-right whitespace-nowrap min-w-[95px]">Rate (BDT)</th>
                      <th className="min-w-[140px]">
                        <div className="flex flex-col gap-1 py-0.5">
                          <div className="flex items-center gap-1.5">
                            <span>VAT (%)</span>
                            <input
                              type="checkbox"
                              checked={distVatEnabled}
                              onChange={(e) => {
                                setDistVatEnabled(e.target.checked);
                                if (e.target.checked && distVatPct !== "") {
                                  applyDistributionVat(Number(distVatPct) || 0);
                                }
                              }}
                              className="size-3.5 cursor-pointer accent-primary"
                              title="Enable Distribution VAT"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={distVatPct}
                              onChange={(e) => setDistVatPct(e.target.value)}
                              placeholder="Distribution VAT"
                              className="h-6 w-24 rounded border border-line-strong bg-surface px-1.5 text-[11px] font-normal text-ink placeholder:text-ink-faint focus:border-blue-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => applyDistributionVat(Number(distVatPct) || 0)}
                              className="inline-flex size-6 items-center justify-center rounded border border-line-strong bg-surface text-ink-muted hover:bg-control hover:text-ink"
                              title="Apply VAT % to all items"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </th>
                      <th className="min-w-[90px]">Brand</th>
                      <th className="min-w-[110px]">Specification</th>
                      <th className="text-right whitespace-nowrap">Item Total</th>
                      <th className="text-right whitespace-nowrap">Purchase Total</th>
                      <th className="w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {addedLines.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="py-8 text-center text-xs text-ink-faint">
                          No items added yet. Select an item above and click Add.
                        </td>
                      </tr>
                    ) : (
                      addedLines.map((row, idx) => {
                        const stockQty = stockOnHandRows
                          .filter((s) => s.itemId === row.itemId)
                          .reduce((sum, s) => sum + Number(s.qty || 0), 0);
                        const itemTotal = round2(row.quantity * row.unitPrice);
                        return (
                          <tr key={row.key} className="hover:bg-grid-hover">
                            <td className="text-center">
                              <input
                                type="checkbox"
                                className="size-3.5 cursor-pointer accent-primary"
                                aria-label={`Select ${row.itemCode}`}
                                checked={row.selected !== false}
                                onChange={(e) => updateLine(row.key, { selected: e.target.checked })}
                              />
                            </td>
                            <td className="text-center font-mono text-ink-faint">{idx + 1}</td>
                            <td className="font-mono text-ink-muted whitespace-nowrap">{row.itemCode}</td>
                            <td className="font-medium text-ink">
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    if (infoPopover?.key === row.key) {
                                      setInfoPopover(null);
                                      setEditingDescKey(null);
                                      return;
                                    }
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setEditingDescKey(null);
                                    setInfoPopover({
                                      key: row.key,
                                      top: Math.min(window.innerHeight - 240, rect.bottom + 6),
                                      left: Math.min(window.innerWidth - 280, rect.left),
                                    });
                                  }}
                                  className="inline-flex items-center justify-center rounded text-ink-faint hover:text-primary transition-colors"
                                  title="View / Edit Item Details"
                                  aria-label={`Item details for ${row.itemCode}`}
                                >
                                  <Info className="h-3.5 w-3.5 shrink-0" />
                                </button>
                                {(itemsCatalog.find((i) => i.id === row.itemId) as { tracking?: string } | undefined)?.tracking === "BATCH" && (
                                  <span
                                    title="Batch Item"
                                    aria-label="Batch Item"
                                    className="inline-flex items-center justify-center rounded bg-amber-100 dark:bg-amber-500/20 px-0.5 text-amber-600 dark:text-amber-400"
                                  >
                                    <CreditCard className="h-3 w-3 shrink-0" />
                                  </span>
                                )}
                                <span>{row.itemName}</span>
                              </span>
                            </td>
                            <td className="text-right font-mono text-ink">{fmtNum(stockQty)}</td>
                            <td className="text-ink-muted whitespace-nowrap">{row.uom}</td>
                            <td className="text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={row.quantity}
                                onChange={(e) => updateLine(row.key, { quantity: Number(e.target.value) || 0 })}
                                className="h-7 w-24 rounded border border-line-strong bg-surface px-1.5 text-right font-mono text-[11px] text-ink focus:border-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="text-right font-mono text-ink-muted">{fmtNum(row.restQty ?? row.quantity)}</td>
                            <td className="text-right font-mono text-ink-muted">{fmtNum(row.issueQty ?? 0)}</td>
                            <td className="text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={row.unitPrice}
                                onChange={(e) => updateLine(row.key, { unitPrice: Number(e.target.value) || 0 })}
                                className="h-7 w-24 rounded border border-line-strong bg-surface px-1.5 text-right font-mono text-[11px] text-ink focus:border-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={row.taxPercentage}
                                  onChange={(e) => updateLine(row.key, { taxPercentage: Number(e.target.value) || 0 })}
                                  className="h-7 w-16 rounded border border-line-strong bg-surface px-1.5 text-right font-mono text-[11px] text-ink focus:border-blue-500 focus:outline-none"
                                />
                                <span className="text-[11px] text-ink-muted">(%)</span>
                              </div>
                            </td>
                            <td>
                              <input
                                type="text"
                                value={row.brand}
                                onChange={(e) => updateLine(row.key, { brand: e.target.value })}
                                placeholder="Brand"
                                className="h-7 w-24 rounded border border-line bg-surface px-1.5 text-[11px] text-ink focus:border-blue-500 focus:outline-none"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={row.specification}
                                onChange={(e) => updateLine(row.key, { specification: e.target.value })}
                                placeholder="Spec"
                                className="h-7 w-28 rounded border border-line bg-surface px-1.5 text-[11px] text-ink focus:border-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="text-right font-mono text-ink whitespace-nowrap">{fmtNum(itemTotal)}</td>
                            <td className="text-right font-mono font-semibold text-ink whitespace-nowrap">
                              {fmtNum(row.lineTotal)}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                onClick={() => setAddedLines((prev) => prev.filter((l) => l.key !== row.key))}
                                className="inline-flex size-6 items-center justify-center rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                title="Remove item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {addedLines.length > 0 && (
                    <tfoot>
                      <tr className="bg-canvas font-semibold">
                        <td colSpan={6} className="text-right text-ink">
                          Total
                        </td>
                        <td className="text-right font-mono text-ink">{fmtNum(totals.qty)}</td>
                        <td colSpan={9} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {addedLines.length > 0 && (
              <div className="flex justify-end">
                <div className="w-full max-w-sm rounded border border-line bg-surface p-3.5 text-xs space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-muted">Total Qty :</span>
                    <span className="font-mono font-bold text-ink">{fmtNum(totals.qty)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-muted">Item Total :</span>
                    <span className="font-mono font-bold text-ink">{fmtNum(totals.sub)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink-muted">Discount :</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={discountPct}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDiscountPct(val);
                          const pct = Number(val) || 0;
                          setDiscountTk(pct > 0 ? String(round2((totals.sub * pct) / 100)) : "");
                        }}
                        placeholder="%"
                        className="h-7 w-20 rounded border border-line-strong bg-surface px-2 text-right font-mono text-xs text-ink focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={discountTk}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDiscountTk(val);
                          const tk = Number(val) || 0;
                          setDiscountPct(totals.sub > 0 && tk > 0 ? String(round2((tk / totals.sub) * 100)) : "");
                        }}
                        placeholder="Tk"
                        className="h-7 w-24 rounded border border-line-strong bg-surface px-2 text-right font-mono text-xs text-ink focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink-muted">Labour Charge :</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={labourCharge}
                      onChange={(e) => setLabourCharge(e.target.value)}
                      placeholder="Labour Charge"
                      className="h-7 w-36 rounded border border-line-strong bg-surface px-2 text-right font-mono text-xs text-ink focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink-muted">Delivery Charge :</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={deliveryCharge}
                      onChange={(e) => setDeliveryCharge(e.target.value)}
                      placeholder="Delivery Charge"
                      className="h-7 w-36 rounded border border-line-strong bg-surface px-2 text-right font-mono text-xs text-ink focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink-muted">Other Charges :</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={otherCharges}
                      onChange={(e) => setOtherCharges(e.target.value)}
                      placeholder="Other Charges"
                      className="h-7 w-36 rounded border border-line-strong bg-surface px-2 text-right font-mono text-xs text-ink focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-2">
                    <span className="font-bold text-ink">Purchase Total :</span>
                    <span className="font-mono text-sm font-bold text-ink">{fmtNum(totals.grandTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  </div>

      {infoPopover && (() => {
        const popRow = addedLines.find((l) => l.key === infoPopover.key);
        if (!popRow) return null;
        return (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setInfoPopover(null);
                setEditingDescKey(null);
              }}
            />
            <div
              style={{ top: infoPopover.top, left: infoPopover.left }}
              className="fixed z-50 w-64 rounded-md border border-line bg-surface p-3.5 shadow-xl text-xs space-y-2.5"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-ink-muted font-medium">
                  <span>Description:</span>
                  <button
                    type="button"
                    onClick={() => setEditingDescKey(editingDescKey === popRow.key ? null : popRow.key)}
                    className="inline-flex size-5 items-center justify-center rounded hover:bg-control text-ink-muted hover:text-ink"
                    title="Edit description"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
                {editingDescKey === popRow.key ? (
                  <textarea
                    rows={2}
                    value={popRow.specification}
                    onChange={(e) => updateLine(popRow.key, { specification: e.target.value })}
                    placeholder="Enter description..."
                    className="w-full rounded border border-line-strong bg-surface px-2 py-1 text-xs text-ink focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <p className="text-ink min-h-[16px] break-words">{popRow.specification || ""}</p>
                )}
              </div>

              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-ink-muted font-medium">Quantity</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={popRow.quantity}
                  onChange={(e) => updateLine(popRow.key, { quantity: Number(e.target.value) || 0 })}
                  className="h-7 w-full rounded border border-line-strong bg-surface px-2 font-mono text-xs text-ink focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-ink-muted font-medium">Rate (BDT)</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={popRow.unitPrice}
                  onChange={(e) => updateLine(popRow.key, { unitPrice: Number(e.target.value) || 0 })}
                  className="h-7 w-full rounded border border-line-strong bg-surface px-2 font-mono text-xs text-ink focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-ink-muted font-medium">VAT (%)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={popRow.taxPercentage}
                  onChange={(e) => updateLine(popRow.key, { taxPercentage: Number(e.target.value) || 0 })}
                  className="h-7 w-full rounded border border-line-strong bg-surface px-2 font-mono text-xs text-ink focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </>
        );
      })()}

      <QuickAddSupplierModal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        onCreated={(s) => setSupplierId(s.id)}
      />

      <TermsConditionModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        termsTemplates={formOptions?.terms ?? []}
        value={termsText}
        onChange={setTermsText}
      />
    </div>
  );
}

