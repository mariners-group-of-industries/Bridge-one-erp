"use client";

import React, { useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Info,
  Trash2,
  Download,
  Upload,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { toast } from "@/components/purchase/Toast";
import { Spinner } from "@/components/ui/spinner";
import { usePurchasePermissions } from "@/features/purchase/lib/usePurchasePermissions";
import { categoryNamesAt, type PurchaseFormOptions } from "@/features/purchase/components/PurchaseFormShared";
import type { Office, Warehouse, Item, Supplier, PurchaseRequisition } from "@bridgeone/contracts";
import { NativeDateInput } from "@/components/ui/date-input";

interface DirectoryEmployee {
  id: string;
  name: string;
  designation?: string;
  department?: string;
  employeeCode?: string;
}

interface AddedItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  uom: string;
  quantity: number;
  expectedDate: string;
  lastCost: number;
  averageCost: number;
  lineTotal: number;
  remarks: string;
}

/**
 * Create Requisition page. With `editId` it is the Edit Requisition page: the
 * requisition is loaded into the same form and saved back with PUT.
 * `?fromId=` (New PR action) pre-fills a new requisition from an existing one.
 */
export function CreateRequisitionView({ editId }: { editId?: string } = {}) {
  const searchParams = useSearchParams();
  const fromId = editId || searchParams.get("fromId") || "";

  const { data: templateReq, isLoading: isTemplateLoading } = useQuery<PurchaseRequisition | null>({
    queryKey: ["requisition-template", fromId],
    enabled: Boolean(fromId),
    queryFn: async () => {
      const list = await fetchApi<PurchaseRequisition[]>("/purchase/requisitions");
      return list.find((r) => r.id === fromId || r.requisitionNumber === fromId) ?? null;
    },
  });

  if (fromId && isTemplateLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6 text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (editId && !templateReq) {
    return <div className="p-6 text-sm text-ink-muted">Requisition not found, or you do not have access to it.</div>;
  }

  return <CreateRequisitionForm key={templateReq?.id ?? "new"} templateReq={templateReq ?? null} editReq={editId ? templateReq ?? null : null} />;
}

function CreateRequisitionForm({ templateReq, editReq }: { templateReq: PurchaseRequisition | null; editReq: PurchaseRequisition | null }) {
  const isEdit = Boolean(editReq);
  const router = useRouter();
  const queryClient = useQueryClient();
  const perms = usePurchasePermissions();
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);

  // 1. Target Selector State
  // An edited requisition raised for a department has the department as its requester.
  const [targetType, setTargetType] = useState<"Employee" | "Department" | "Project">(
    editReq && editReq.department && editReq.requesterName === editReq.department ? "Department" : "Employee",
  );
  const [createFromSalesOrder, setCreateFromSalesOrder] = useState(false);
  const [selectedSalesOrderIds, setSelectedSalesOrderIds] = useState<string[]>([]);
  const [isSoDropdownOpen, setIsSoDropdownOpen] = useState(false);
  const [soSearchQuery, setSoSearchQuery] = useState("");

  const [soAllocatedLines, setSoAllocatedLines] = useState<{
    id: string;
    soId: string;
    soNumber: string;
    customerName: string;
    itemId: string;
    itemCode: string;
    itemName: string;
    uom: string;
    reqQty: number;
    estRate: number;
    total: number;
  }[]>([]);

  // 2. Primary Form Fields (Row 1)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultDeliveryStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  }, []);

  const [createDate, setCreateDate] = useState(editReq?.requestDate || todayStr);
  const [expectedDate, setExpectedDate] = useState(templateReq?.requiredDeliveryDate || defaultDeliveryStr);
  const [pickedOfficeId, setSelectedOfficeId] = useState<string | null>(templateReq?.officeId ?? null);
  const [pickedWarehouseId, setSelectedWarehouseId] = useState<string>(templateReq?.warehouseId || "");
  const [inventoryType, setInventoryType] = useState(templateReq?.requestType === "URGENT" ? "Asset" : "Inventory Item");

  // Dynamic target values
  const [employeeQuery, setEmployeeQuery] = useState(templateReq?.requesterName || "");
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(templateReq?.department || "Operations");
  const [selectedProject, setSelectedProject] = useState("");

  // 3. Secondary Fields (Row 2)
  const [buyerName, setBuyerName] = useState("");
  const [buyerOfficeId, setBuyerOfficeId] = useState("");
  const [remarks, setRemarks] = useState(editReq ? editReq.remarks || "" : templateReq ? `Cloned from ${templateReq.requisitionNumber}` : "");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 4. Item Filter Strip (Row 3)
  const [itemTypeFilter, setItemTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [subCategoryFilter, setSubCategoryFilter] = useState("All");
  const [minorCategoryFilter, setMinorCategoryFilter] = useState("All");
  const [supplierFilter, setSupplierFilter] = useState("");

  // 5. Line Item Input Strip (Row 4)
  const [selectedItemId, setSelectedItemId] = useState("");
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [reqQty, setReqQty] = useState<number | string>(1);
  const [lastCost, setLastCost] = useState<number>(0);
  const [averageCost, setAverageCost] = useState<number>(0);
  const [lineDescription, setLineDescription] = useState("");
  const [itemCheckbox, setItemCheckbox] = useState(false);

  // 6. Added Items List
  const [addedItems, setAddedItems] = useState<AddedItem[]>(() =>
    templateReq
      ? templateReq.items.map((it, idx) => ({
          id: `tpl_${idx}_${it.itemId}`,
          itemId: it.itemId,
          itemCode: it.itemCode,
          itemName: it.itemName,
          category: "General",
          uom: it.uom || "PCS",
          quantity: it.quantity,
          expectedDate: templateReq.requiredDeliveryDate || defaultDeliveryStr,
          lastCost: it.estimatedUnitPrice,
          averageCost: it.estimatedUnitPrice,
          lineTotal: it.lineTotal,
          remarks: it.remarks || "",
        }))
      : []
  );

  // CSV file import ref
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Master Data Queries
  const { data: offices = [] } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
  });

  const { data: allWarehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: () => fetchApi("/master/warehouses"),
  });

  const { data: itemsCatalog = [] } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: () => fetchApi("/master/items"),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => fetchApi("/master/suppliers"),
  });

  const { data: formOptions } = useQuery<PurchaseFormOptions>({
    queryKey: ["purchase-form-options"],
    queryFn: () => fetchApi("/master/purchase-form-options"),
  });

  // Requesters come from the purchase form options, already limited to the user's offices.
  const employees = useMemo<DirectoryEmployee[]>(
    () =>
      (formOptions?.employees ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        employeeCode: e.employeeCode,
        department: e.department,
        designation: e.designation,
      })),
    [formOptions],
  );

  // Default to the first office that has warehouses (e.g. MG Sirajganj Factory), or the first office
  const defaultOfficeId = useMemo(() => {
    if (templateReq?.officeId) return templateReq.officeId;
    if (!offices.length) return "";
    const withWh = offices.find((o) => allWarehouses.some((w) => w.officeId === o.id));
    return withWh?.id || offices[0]?.id || "";
  }, [templateReq, offices, allWarehouses]);

  const selectedOfficeId = pickedOfficeId !== null ? pickedOfficeId : defaultOfficeId;

  // Filter warehouses based on selected office
  const availableWarehouses = useMemo(() => {
    if (!selectedOfficeId) return [];
    // Only the office own warehouses: the server rejects a warehouse of another office.
    return allWarehouses.filter((w) => w.officeId === selectedOfficeId);
  }, [allWarehouses, selectedOfficeId]);

  // The picked warehouse while it belongs to the office, otherwise the office first warehouse.
  const selectedWarehouseId = selectedOfficeId && availableWarehouses.some((w) => w.id === pickedWarehouseId) ? pickedWarehouseId : (availableWarehouses[0]?.id ?? "");

  // 3-Level Category Cascade from DB ItemCategory + item fallbacks
  const level1Categories = useMemo(() => {
    const cats = categoryNamesAt(formOptions?.categories ?? [], 1);
    if (cats.length > 0) return cats;
    const set = new Set<string>();
    itemsCatalog.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort();
  }, [formOptions, itemsCatalog]);

  const level2SubCategories = useMemo(() => {
    const list = categoryNamesAt(formOptions?.categories ?? [], 2, categoryFilter);
    if (list.length > 0) return list;
    const set = new Set<string>();
    itemsCatalog.forEach((it) => {
      if ((categoryFilter === "All" || it.category === categoryFilter) && it.subCategory) set.add(it.subCategory);
    });
    return Array.from(set).sort();
  }, [formOptions, itemsCatalog, categoryFilter]);

  const level3MinorCategories = useMemo(() => {
    const list = categoryNamesAt(formOptions?.categories ?? [], 3, subCategoryFilter);
    if (list.length > 0) return list;
    const set = new Set<string>();
    itemsCatalog.forEach((it) => {
      if ((subCategoryFilter === "All" || it.subCategory === subCategoryFilter) && it.minorCategory) set.add(it.minorCategory);
    });
    return Array.from(set).sort();
  }, [formOptions, itemsCatalog, subCategoryFilter]);

  // Filtered items based on Item Type, Category cascade & Search
  const filteredItems = useMemo(() => {
    return itemsCatalog.filter((it) => {
      if (itemTypeFilter !== "All" && it.itemType && it.itemType !== itemTypeFilter) return false;
      if (categoryFilter !== "All" && it.category !== categoryFilter) return false;
      if (subCategoryFilter !== "All" && it.subCategory !== subCategoryFilter) return false;
      if (minorCategoryFilter !== "All" && it.minorCategory !== minorCategoryFilter) return false;
      if (itemSearchQuery.trim()) {
        const q = itemSearchQuery.toLowerCase();
        return (
          it.name.toLowerCase().includes(q) ||
          it.code.toLowerCase().includes(q) ||
          (it.barcode && it.barcode.toLowerCase().includes(q)) ||
          (it.category && it.category.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [itemsCatalog, itemTypeFilter, categoryFilter, subCategoryFilter, minorCategoryFilter, itemSearchQuery]);

  // Filtered employees for Combobox
  const filteredEmployees = useMemo(() => {
    if (!employeeQuery.trim()) return employees.slice(0, 15);
    const q = employeeQuery.toLowerCase();
    return employees
      .filter(
        (emp) =>
          emp.name.toLowerCase().includes(q) ||
          (emp.employeeCode && emp.employeeCode.toLowerCase().includes(q)) ||
          (emp.department && emp.department.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [employees, employeeQuery]);

  // When an item is selected from dropdown
  const handleSelectItem = (item: Item) => {
    setSelectedItemId(item.id);
    setItemSearchQuery(`${item.code} - ${item.name}`);
    const price = Number(item.standardPrice) || 0;
    setLastCost(price);
    setAverageCost(price);
    setLineDescription(item.description || item.name);
    setIsItemDropdownOpen(false);
  };

  // Add Item to table
  const handleAddItem = () => {
    const item = itemsCatalog.find((i) => i.id === selectedItemId);
    if (!item) {
      toast.error("Please search and select an item first.", { title: "Item Required" });
      return;
    }
    const qty = Number(reqQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid request quantity greater than 0.", { title: "Invalid Quantity" });
      return;
    }

    const newItem: AddedItem = {
      id: "line_" + Math.random().toString(36).substring(2, 9),
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      category: item.category || "General",
      uom: item.uom || "PCS",
      quantity: qty,
      expectedDate: expectedDate || todayStr,
      lastCost: lastCost,
      averageCost: averageCost,
      lineTotal: qty * lastCost,
      remarks: lineDescription !== item.name ? lineDescription : "",
    };

    setAddedItems((prev) => [...prev, newItem]);
    toast.success(`Added "${item.name}" to requisition items.`, { title: "Item Added" });

    // Reset line input strip
    setSelectedItemId("");
    setItemSearchQuery("");
    setReqQty(1);
    setLastCost(0);
    setAverageCost(0);
    setLineDescription("");
    setItemCheckbox(false);
  };

  // Delete line item
  const handleDeleteItem = (id: string) => {
    setAddedItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Update quantity inline in table
  const handleUpdateLineQty = (id: string, newQty: number) => {
    if (newQty <= 0) return;
    setAddedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantity: newQty, lineTotal: newQty * it.lastCost } : it))
    );
  };

  // Calculations
  const totalItemsCount = addedItems.length;
  const totalQuantitySum = addedItems.reduce((acc, it) => acc + Number(it.quantity), 0);
  const totalEstimatedCostSum = addedItems.reduce((acc, it) => acc + Number(it.lineTotal), 0);

  // Sales Order Allocation Handlers
  const handleToggleSalesOrder = (soId: string) => {
    setSelectedSalesOrderIds((prev) =>
      prev.includes(soId) ? prev.filter((id) => id !== soId) : [...prev, soId]
    );
  };

  const handleRemoveSalesOrder = (soId: string) => {
    setSelectedSalesOrderIds((prev) => prev.filter((id) => id !== soId));
    setSoAllocatedLines((prev) => prev.filter((l) => l.soId !== soId));
  };

  const handleClearAllSalesOrders = () => {
    setSelectedSalesOrderIds([]);
    setSoAllocatedLines([]);
  };

  const handleLoadSalesOrders = () => {
    if (selectedSalesOrderIds.length === 0) {
      toast.error("Please select at least one sales order.", { title: "No Sales Order Selected" });
      return;
    }

    const allSos = formOptions?.salesOrders ?? [];
    const selectedSos = allSos.filter((so) => selectedSalesOrderIds.includes(so.id));

    if (selectedSos.length === 0) return;

    if (selectedSos[0].officeId && !pickedOfficeId) {
      setSelectedOfficeId(selectedSos[0].officeId);
    }

    const soRemarks = selectedSos.map((s) => `${s.number} (${s.customerName})`).join(", ");
    if (!remarks) {
      setRemarks(`Against Sales Order: ${soRemarks}`);
    }

    const newLines: {
      id: string;
      soId: string;
      soNumber: string;
      customerName: string;
      itemId: string;
      itemCode: string;
      itemName: string;
      uom: string;
      reqQty: number;
      estRate: number;
      total: number;
    }[] = [];

    for (const so of selectedSos) {
      for (let i = 0; i < so.lines.length; i++) {
        const l = so.lines[i];
        newLines.push({
          id: `so_${so.id}_${l.id || i}_${Math.random().toString(36).slice(2, 7)}`,
          soId: so.id,
          soNumber: so.number,
          customerName: so.customerName,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom || "PCS",
          reqQty: Number(l.qty) || 0,
          estRate: 0,
          total: 0,
        });
      }
    }

    setSoAllocatedLines(newLines);
    toast.success(`Loaded ${newLines.length} item(s) from ${selectedSos.length} sales order(s).`, {
      title: "Items Loaded",
    });
  };

  const handleUpdateSoLine = (id: string, field: "reqQty" | "estRate", value: number) => {
    setSoAllocatedLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, [field]: value };
        const q = Number(updated.reqQty) || 0;
        const r = Number(updated.estRate) || 0;
        updated.total = Number((q * r).toFixed(2));
        return updated;
      })
    );
  };

  const handleDeleteSoLine = (id: string) => {
    setSoAllocatedLines((prev) => prev.filter((line) => line.id !== id));
  };

  const soGroupedLines = useMemo(() => {
    const groups: {
      soId: string;
      soNumber: string;
      customerName: string;
      lines: typeof soAllocatedLines;
      subtotalQty: number;
      subtotalTotal: number;
    }[] = [];

    const map = new Map<string, typeof soAllocatedLines>();
    for (const line of soAllocatedLines) {
      if (!map.has(line.soId)) {
        map.set(line.soId, []);
      }
      map.get(line.soId)!.push(line);
    }

    for (const [soId, lines] of map.entries()) {
      const first = lines[0];
      const subtotalQty = lines.reduce((acc, l) => acc + Number(l.reqQty || 0), 0);
      const subtotalTotal = lines.reduce((acc, l) => acc + Number(l.total || 0), 0);
      groups.push({
        soId,
        soNumber: first.soNumber,
        customerName: first.customerName,
        lines,
        subtotalQty,
        subtotalTotal,
      });
    }

    return groups;
  }, [soAllocatedLines]);

  const grandSoQtySum = useMemo(
    () => soAllocatedLines.reduce((acc, l) => acc + Number(l.reqQty || 0), 0),
    [soAllocatedLines]
  );

  const grandSoTotalSum = useMemo(
    () => soAllocatedLines.reduce((acc, l) => acc + Number(l.total || 0), 0),
    [soAllocatedLines]
  );

  // File Attachment Handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...files]);
      toast.info(`Attached ${files.length} document(s).`, { title: "Attachment" });
    }
  };

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const header = "ItemCode,ItemName,Quantity,UOM,Remarks\n";
    const sample = 'MT-000049,"1"" GI pipe ( 10 Feet )",10,PCS,"Urgent Maintenance"\n';
    const blob = new Blob([header + sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requisition_items_template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.info("Downloaded sample CSV template.", { title: "Template Download" });
  };

  // Import CSV Line Items
  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        toast.error("CSV file contains no data rows.", { title: "Import Failed" });
        return;
      }

      let importedCount = 0;
      const newItems: AddedItem[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
        const code = parts[0];
        const qty = Number(parts[2]) || 1;
        const matched = itemsCatalog.find((it) => it.code.toLowerCase() === code.toLowerCase());

        if (matched) {
          const cost = Number(matched.standardPrice) || 0;
          newItems.push({
            id: "line_csv_" + Math.random().toString(36).substring(2, 9),
            itemId: matched.id,
            itemCode: matched.code,
            itemName: matched.name,
            category: matched.category || "General",
            uom: matched.uom || "PCS",
            quantity: qty,
            expectedDate: expectedDate || todayStr,
            lastCost: cost,
            averageCost: cost,
            lineTotal: qty * cost,
            remarks: parts[4] || "",
          });
          importedCount++;
        }
      }

      if (newItems.length > 0) {
        setAddedItems((prev) => [...prev, ...newItems]);
        toast.success(`Successfully imported ${importedCount} item(s) from CSV.`, { title: "Import Successful" });
      } else {
        toast.error("No matching item codes found in CSV file.", { title: "Import Failed" });
      }
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  // Submit Requisition to Database
  const createMutation = useMutation({
    mutationFn: async (isSaveAndNew: boolean) => {
      if (!selectedOfficeId) throw new Error("Office is required");
      if (!selectedWarehouseId) throw new Error("Warehouse is required");

      const itemsToSubmit = createFromSalesOrder
        ? soAllocatedLines.map((it) => ({
            itemId: it.itemId,
            itemCode: it.itemCode,
            itemName: it.itemName,
            uom: it.uom,
            quantity: Number(it.reqQty),
            estimatedUnitPrice: Number(it.estRate),
            lineTotal: Number(it.total),
            remarks: `SO ${it.soNumber}`,
          }))
        : addedItems.map((it) => ({
            itemId: it.itemId,
            itemCode: it.itemCode,
            itemName: it.itemName,
            uom: it.uom,
            quantity: Number(it.quantity),
            estimatedUnitPrice: Number(it.lastCost),
            lineTotal: Number(it.lineTotal),
            remarks: it.remarks || undefined,
          }));

      if (itemsToSubmit.length === 0) {
        throw new Error(
          createFromSalesOrder
            ? "Please select and load at least one sales order item."
            : "Please add at least one item to the requisition table."
        );
      }

      const requesterName = (
        targetType === "Employee" ? employeeQuery : targetType === "Department" ? selectedDepartment : selectedProject
      ).trim();
      if (!requesterName) throw new Error(`Select the ${String(targetType).toLowerCase()} the requisition is for.`);

      const payload = {
        companyId: "comp-bridgeone-01",
        officeId: selectedOfficeId,
        warehouseId: selectedWarehouseId,
        requestType: inventoryType === "Asset" ? "URGENT" : "LOCAL",
        department: targetType === "Department" ? selectedDepartment : "Operations",
        requesterName: requesterName,
        purchaseMethod: "DIRECT",
        requestDate: createDate,
        requiredDeliveryDate: expectedDate,
        businessJustification:
          remarks.trim() || `Requisition requested by ${requesterName} for operational requirements`,
        remarks: remarks || undefined,
        items: itemsToSubmit,
      };

      const result = editReq
        ? await fetchApi<{ requisitionNumber: string }>(`/purchase/requisitions/${editReq.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await fetchApi<{ requisitionNumber: string }>("/purchase/requisitions", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      return { result, isSaveAndNew };
    },
    onSuccess: ({ result, isSaveAndNew }) => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["requisition-template"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      if (editReq) {
        toast.success(`Requisition ${result.requisitionNumber || editReq.requisitionNumber} updated.`, { title: "Changes Saved" });
        router.push("/purchase/requisitions");
      } else if (isSaveAndNew) {
        toast.success(`Requisition ${result.requisitionNumber} created! Ready for new entry.`, {
          title: "Created Successfully",
        });
        setAddedItems([]);
        setSoAllocatedLines([]);
        setSelectedSalesOrderIds([]);
        setSelectedItemId("");
        setItemSearchQuery("");
        setReqQty(1);
        setLastCost(0);
        setAverageCost(0);
        setLineDescription("");
        setRemarks("");
        setAttachedFiles([]);
      } else {
        toast.success(`Purchase Requisition ${result.requisitionNumber} created successfully!`, {
          title: "Requisition Saved",
        });
        router.push("/purchase/requisitions");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save requisition to database.", { title: "Save Error" });
    },
  });

  return (
    <div className="min-h-screen bg-canvas dark:bg-slate-950 p-3 md:p-6 text-ink dark:text-slate-100">
      {/* ── TOP HEADER BAR ── */}
      <div data-sticky-head className="sticky top-14 z-20 -mx-3 -mt-3 px-3 pt-3 pb-3 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 bg-canvas dark:bg-slate-950">
        <div className="bg-surface dark:bg-slate-900 border border-line/90 dark:border-slate-800 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/purchase/requisitions")}
              className="h-8 w-8 rounded border border-line-strong dark:border-slate-700 flex items-center justify-center text-ink-muted dark:text-slate-300 hover:bg-canvas dark:hover:bg-slate-800 transition"
              title="Back to Requisitions"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-ink dark:text-white tracking-tight">
              {isEdit ? "Edit Requisition" : "Create Requisition"}
              {isEdit && <span className="ml-2 font-mono text-sm font-semibold text-sky-700 dark:text-sky-300">{editReq?.requisitionNumber}</span>}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {!isEdit && (
              <button
                type="button"
                onClick={() => createMutation.mutate(true)}
                disabled={createMutation.isPending || !perms.requisitions.create}
                title={!perms.requisitions.create ? "Requires Create permission in Configuration" : undefined}
                className="h-8 px-4 border border-[#2563eb] text-primary hover:bg-blue-50 dark:hover:bg-blue-950 font-semibold text-xs rounded transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {createMutation.isPending && <Spinner className="size-3.5" />}
                Save & New
              </button>
            )}
            <button
              type="button"
              onClick={() => createMutation.mutate(false)}
              disabled={createMutation.isPending || !(isEdit ? perms.requisitions.edit : perms.requisitions.create)}
              title={!(isEdit ? perms.requisitions.edit : perms.requisitions.create) ? `Requires ${isEdit ? "Edit" : "Create"} permission in Configuration` : undefined}
              className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              {createMutation.isPending && <Spinner className="size-3.5" />}
              Save
            </button>
          </div>
        </div>
      </div>

      {/* ── BASIC INFORMATION CARD ── */}
      <div className="bg-surface dark:bg-slate-900 border border-line/90 dark:border-slate-800 rounded shadow-2xs overflow-hidden mb-3">
        {/* Card Header with Tabs & Collapse Button */}
        <div className="flex items-center justify-between border-b border-line dark:border-slate-800 bg-surface dark:bg-slate-900 px-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 text-xs font-semibold rounded-t bg-grid-head dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 transition"
            >
              Basic Information
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsFormCollapsed(!isFormCollapsed)}
            className="p-1.5 text-ink-faint hover:text-ink-muted dark:hover:text-slate-300 rounded transition"
            title={isFormCollapsed ? "Expand" : "Collapse"}
          >
            {isFormCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Collapsible Fields */}
        {!isFormCollapsed && (
          <div className="p-4 md:p-5 space-y-4">
            {/* ── TARGET SELECTION RADIO GROUP & CHECKBOX ── */}
            <div className="flex flex-wrap items-center gap-6 py-1 border-b border-line dark:border-slate-800 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-ink dark:text-slate-200">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === "Employee"}
                  onChange={() => setTargetType("Employee")}
                  disabled={isEdit}
                  className="w-4 h-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-line-strong"
                />
                <span>Employee</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-ink dark:text-slate-200">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === "Department"}
                  onChange={() => setTargetType("Department")}
                  disabled={isEdit}
                  className="w-4 h-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-line-strong"
                />
                <span>Department</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-ink dark:text-slate-200">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === "Project"}
                  onChange={() => setTargetType("Project")}
                  disabled={isEdit}
                  className="w-4 h-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-line-strong"
                />
                <span>Project</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-ink dark:text-slate-200 ml-2">
                <input
                  type="checkbox"
                  checked={createFromSalesOrder}
                  disabled={isEdit}
                  onChange={(e) => {
                    setCreateFromSalesOrder(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedSalesOrderIds([]);
                      setSoAllocatedLines([]);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded border-line-strong focus:ring-blue-500"
                />
                <span>Create From Sales Order</span>
              </label>
            </div>

            {/* ── ROW 1: PRIMARY DETAILS (6 COLS GRID) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Create Date */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-slate-300 mb-1">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Create Date
                </label>
                <div className="relative">
                  <NativeDateInput
                    type="date"
                    value={createDate}
                    disabled={isEdit}
                    onChange={(e) => setCreateDate(e.target.value)}
                    className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Employee / Department / Project Selector with Clear Button */}
              <div className="relative">
                <label className="block text-xs font-semibold text-ink-muted dark:text-slate-300 mb-1">
                  <span className="text-red-500 font-bold mr-0.5">*</span>{targetType}
                </label>

                {targetType === "Employee" ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={employeeQuery}
                      onChange={(e) => {
                        setEmployeeQuery(e.target.value);
                        setIsEmployeeDropdownOpen(true);
                      }}
                      onFocus={() => setIsEmployeeDropdownOpen(true)}
                      placeholder="Select/Search Employee"
                      className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded pl-2.5 pr-14 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="absolute right-1 top-1 flex items-center text-ink-faint">
                      {employeeQuery && (
                        <button
                          type="button"
                          onClick={() => setEmployeeQuery("")}
                          className="inline-flex size-6 items-center justify-center rounded hover:text-ink-muted"
                          title="Clear"
                          aria-label="Clear employee"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsEmployeeDropdownOpen((p) => !p)}
                        className="inline-flex size-6 items-center justify-center rounded hover:text-ink-muted"
                        aria-label="Show employees"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isEmployeeDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setIsEmployeeDropdownOpen(false)}
                        />
                        <div className="absolute left-0 right-0 top-full mt-1 bg-surface dark:bg-slate-800 border border-line dark:border-slate-700 rounded shadow-lg z-20 max-h-52 overflow-y-auto">
                          {filteredEmployees.length > 0 ? (
                            filteredEmployees.map((emp) => (
                              <div
                                key={emp.id}
                                onClick={() => {
                                  setEmployeeQuery(emp.name);
                                  setIsEmployeeDropdownOpen(false);
                                }}
                                className="px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-line dark:border-slate-700/50"
                              >
                                <span className="font-medium text-ink dark:text-slate-100">{emp.name}</span>
                                <span className="text-[10px] text-ink-faint">{emp.department || emp.designation}</span>
                              </div>
                            ))
                          ) : (
                            <div className="p-2 text-xs text-ink-faint text-center">No employee found</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : targetType === "Department" ? (
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Operations">Operations</option>
                    <option value="Production">Production</option>
                    <option value="IT & Multimedia">IT & Multimedia</option>
                    <option value="Corporate Relations">Corporate Relations</option>
                    <option value="Distribution">Distribution</option>
                    <option value="Accounts & Finance">Accounts & Finance</option>
                    <option value="HR & Admin">HR & Admin</option>
                    <option value="Supply Chain">Supply Chain</option>
                  </select>
                ) : (
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Project / Cost Center</option>
                    {(formOptions?.projects ?? []).map((proj) => (
                      <option key={proj.id} value={`${proj.code} - ${proj.name}`}>
                        {proj.code} — {proj.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Office */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-slate-300 mb-1">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Office
                </label>
                <select
                  value={selectedOfficeId}
                  onChange={(e) => {
                    const newOfficeId = e.target.value;
                    setSelectedOfficeId(newOfficeId);
                    const matchingWh = allWarehouses.find((w) => w.officeId === newOfficeId);
                    setSelectedWarehouseId(matchingWh?.id || "");
                  }}
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Office</option>
                  {offices.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-slate-300 mb-1">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Warehouse
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  disabled={!selectedOfficeId}
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                >
                  {!selectedOfficeId ? (
                    <option value="">Select Office first</option>
                  ) : availableWarehouses.length === 0 ? (
                    <option value="">No warehouse for this office</option>
                  ) : (
                    availableWarehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Inventory Type */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-slate-300 mb-1">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Inventory Type
                </label>
                <select
                  value={inventoryType}
                  onChange={(e) => setInventoryType(e.target.value)}
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Inventory Item">Inventory Item</option>
                  <option value="Non-Inventory Item">Non-Inventory Item</option>
                  <option value="Asset">Asset</option>
                  <option value="Service">Service</option>
                </select>
              </div>

              {/* Expected Date */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-slate-300 mb-1">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Expected Date
                </label>
                <NativeDateInput
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* ── ROW 2: BUYER & REMARKS WITH ATTACHMENT ── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
              {/* Buyer Name */}
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-ink-muted dark:text-slate-300 mb-1">
                  Buyer Name
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Select/Search Buyer Name (min 3 letters)"
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 placeholder:text-ink-faint focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Buyer Office */}
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-ink-muted dark:text-slate-300 mb-1">
                  Buyer Office
                </label>
                <select
                  value={buyerOfficeId}
                  onChange={(e) => setBuyerOfficeId(e.target.value)}
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Buyer Office</option>
                  {offices.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remarks with Attachment Icon */}
              <div className="md:col-span-6">
                <label className="block text-xs font-semibold text-ink-muted dark:text-slate-300 mb-1">
                  Remarks
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Remarks"
                    className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded pl-2.5 pr-10 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 placeholder:text-ink-faint focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute right-1 text-ink-faint hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded transition"
                    title={
                      attachedFiles.length > 0
                        ? `${attachedFiles.length} file(s) attached`
                        : "Attach document"
                    }
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>
                {attachedFiles.length > 0 && (
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-blue-600 dark:text-blue-400">
                    <span>📎 {attachedFiles.length} file(s) attached:</span>
                    <span className="truncate max-w-xs">{attachedFiles.map((f) => f.name).join(", ")}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFiles([])}
                      className="text-red-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── REQUISITION ITEMS CARD ── */}
      <div className="bg-surface dark:bg-slate-900 border border-line/90 dark:border-slate-800 rounded shadow-2xs overflow-hidden mb-3">
        <div className="flex items-center justify-between border-b border-line dark:border-slate-800 bg-surface dark:bg-slate-900 px-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 text-xs font-semibold rounded-t bg-grid-head dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 transition"
            >
              Requisition Items
            </button>
          </div>
        </div>
        <div className="p-4 md:p-5 space-y-4">

        {/* ── SALES ORDER MULTI-SELECT STRIP (ONLY WHEN CREATE FROM SALES ORDER IS CHECKED) ── */}
        {createFromSalesOrder && (
          <div className="pt-2">
            <label className="block text-[11px] font-medium text-ink-muted dark:text-slate-300 mb-1">
              Select Sales Orders (Multiple) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2 max-w-xl">
              <div className="relative flex-1">
                <div
                  onClick={() => setIsSoDropdownOpen((p) => !p)}
                  className="min-h-8 w-full border border-line-strong dark:border-slate-700 rounded px-2 py-1 bg-surface dark:bg-slate-800 text-xs flex flex-wrap items-center gap-1.5 cursor-pointer focus-within:ring-1 focus-within:ring-blue-500"
                >
                  {selectedSalesOrderIds.map((soId) => {
                    const so = (formOptions?.salesOrders ?? []).find((s) => s.id === soId);
                    return (
                      <span
                        key={soId}
                        className="inline-flex items-center gap-1 bg-control dark:bg-slate-700 text-ink dark:text-slate-200 px-2 py-0.5 rounded text-[11px] font-mono border border-line dark:border-slate-600"
                      >
                        <span>{so?.number || soId}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSalesOrder(soId);
                          }}
                          className="hover:text-red-500 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </span>
                      </span>
                    );
                  })}
                  {selectedSalesOrderIds.length === 0 && (
                    <span className="text-ink-faint text-xs">Select Sales Orders...</span>
                  )}
                  <div className="ml-auto flex items-center gap-1 text-ink-faint">
                    {selectedSalesOrderIds.length > 0 && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearAllSalesOrders();
                        }}
                        className="hover:text-ink-muted p-0.5 cursor-pointer"
                        title="Clear all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>

                {isSoDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsSoDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface dark:bg-slate-800 border border-line dark:border-slate-700 rounded shadow-lg z-20 max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-line dark:border-slate-700">
                        <input
                          type="text"
                          value={soSearchQuery}
                          onChange={(e) => setSoSearchQuery(e.target.value)}
                          placeholder="Search sales order / customer..."
                          className="w-full h-7 px-2 text-xs border border-line dark:border-slate-700 rounded bg-canvas dark:bg-slate-900 text-ink dark:text-slate-100"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="divide-y divide-line dark:divide-slate-700/50">
                        {(formOptions?.salesOrders ?? [])
                          .filter((so) => {
                            if (!soSearchQuery.trim()) return true;
                            const q = soSearchQuery.toLowerCase();
                            return (
                              so.number.toLowerCase().includes(q) ||
                              so.customerName.toLowerCase().includes(q)
                            );
                          })
                          .map((so) => {
                            const isSelected = selectedSalesOrderIds.includes(so.id);
                            return (
                              <div
                                key={so.id}
                                onClick={() => handleToggleSalesOrder(so.id)}
                                className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between hover:bg-blue-50 dark:hover:bg-slate-700 ${
                                  isSelected ? "bg-blue-50/60 dark:bg-slate-700/60 font-medium" : ""
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 rounded border-line-strong"
                                  />
                                  <div>
                                    <div className="font-semibold text-ink dark:text-slate-100">{so.number}</div>
                                    <div className="text-[10px] text-ink-faint">{so.customerName} ({so.orderDate})</div>
                                  </div>
                                </div>
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                                  {so.lines.length} lines
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleLoadSalesOrders}
                className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded transition flex items-center gap-1 shadow-2xs"
              >
                Load
              </button>
            </div>
          </div>
        )}

        {/* ── CONDITIONAL RENDERING: SALES ORDER ALLOCATION TABLE VS MANUAL ENTRY & TABLE ── */}
        {createFromSalesOrder ? (
          <div className="mt-4 pt-2">
            <div className="overflow-x-auto rounded border border-line dark:border-slate-800">
              <table className="w-full text-left text-xs text-ink-muted dark:text-slate-300 border-collapse">
                <thead className="bg-grid-head dark:bg-slate-800 text-[11px] font-semibold text-ink-muted dark:text-slate-200 border-b border-line dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 w-36 font-semibold">Code</th>
                    <th className="py-2.5 px-3 font-semibold">Item Name & Details</th>
                    <th className="py-2.5 px-3 w-20 text-center font-semibold">UoM</th>
                    <th className="py-2.5 px-3 w-28 text-right font-semibold">Req Qty</th>
                    <th className="py-2.5 px-3 w-28 text-right font-semibold">Est. Rate</th>
                    <th className="py-2.5 px-3 w-28 text-right font-semibold">Total</th>
                    <th className="py-2.5 px-3 w-16 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line dark:divide-slate-800 bg-surface dark:bg-slate-900">
                  {soGroupedLines.length > 0 ? (
                    soGroupedLines.map((group) => (
                      <React.Fragment key={group.soId}>
                        {/* Allocation Header Row */}
                        <tr className="bg-grid-head dark:bg-sky-950/40 border-y border-sky-200 dark:border-sky-900">
                          <td colSpan={7} className="py-2 px-3 font-bold text-ink dark:text-slate-100 text-xs">
                            Sales Order Allocation: {group.soNumber} ({group.customerName})
                          </td>
                        </tr>

                        {/* Line Items */}
                        {group.lines.map((line) => (
                          <tr key={line.id} className="hover:bg-canvas/60 dark:hover:bg-slate-800/40 transition">
                            <td className="py-2 px-3 text-ink-muted dark:text-slate-300 font-mono text-[11px]">
                              {line.itemCode}
                            </td>
                            <td className="py-2 px-3 text-ink dark:text-slate-200 font-medium">
                              {line.itemName}
                            </td>
                            <td className="py-2 px-3 text-center text-ink-muted dark:text-slate-400">
                              {line.uom}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={line.reqQty}
                                onChange={(e) => handleUpdateSoLine(line.id, "reqQty", Number(e.target.value))}
                                className="w-24 text-right h-7 px-2 border border-line-strong dark:border-slate-700 rounded text-xs bg-surface dark:bg-slate-800 font-medium text-ink dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={line.estRate}
                                onChange={(e) => handleUpdateSoLine(line.id, "estRate", Number(e.target.value))}
                                className="w-24 text-right h-7 px-2 border border-line-strong dark:border-slate-700 rounded text-xs bg-surface dark:bg-slate-800 font-medium text-ink dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-ink dark:text-slate-200">
                              {line.total.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteSoLine(line.id)}
                                className="p-1 rounded text-ink-faint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* Subtotal Allocation Row */}
                        <tr className="bg-canvas dark:bg-slate-800/60 font-bold border-b border-line dark:border-slate-700 text-xs">
                          <td colSpan={3} className="py-2 px-3 text-right text-ink dark:text-slate-100">
                            Subtotal Allocation for {group.soNumber}:
                          </td>
                          <td className="py-2 px-3 text-right text-ink dark:text-slate-100">
                            {group.subtotalQty} Units
                          </td>
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3 text-right text-ink dark:text-slate-100">
                            {group.subtotalTotal.toFixed(2)} BDT
                          </td>
                          <td className="py-2 px-3"></td>
                        </tr>
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-faint text-xs">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <FileSpreadsheet className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          <span>Select Sales Orders above and click &quot;Load&quot; to populate requisition items.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                {soGroupedLines.length > 0 && (
                  <tfoot>
                    <tr className="bg-control dark:bg-slate-800 font-bold border-t-2 border-line-strong dark:border-slate-600 text-xs">
                      <td colSpan={3} className="py-2.5 px-3 text-right text-ink dark:text-white">
                        Total Quantity Sum:
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink dark:text-white">
                        {grandSoQtySum} Units
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-muted dark:text-slate-300">
                        Budget Subtotal:
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink dark:text-white">
                        {grandSoTotalSum.toFixed(2)} BDT
                      </td>
                      <td className="py-2.5 px-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        ) : (
          <>
            {/* ── ROW 3: CATEGORY & SUPPLIER FILTER STRIP (5 COLS GRID) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-line dark:border-slate-800">
              {/* Item Type */}
              <div>
                <select
                  value={itemTypeFilter}
                  onChange={(e) => setItemTypeFilter(e.target.value)}
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink-muted dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">Item Type</option>
                  <option value="Raw Material">Raw Material</option>
                  <option value="Packaging Material">Packaging Material</option>
                  <option value="Finished Goods">Finished Goods</option>
                  <option value="Spares & Consumables">Spares & Consumables</option>
                  <option value="Stationary">Stationary</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Mechanical">Mechanical</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setSubCategoryFilter("All");
                    setMinorCategoryFilter("All");
                  }}
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink-muted dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">Category</option>
                  {level1Categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub Category */}
              <div>
                <select
                  value={subCategoryFilter}
                  onChange={(e) => {
                    setSubCategoryFilter(e.target.value);
                    setMinorCategoryFilter("All");
                  }}
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink-muted dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">Sub Category</option>
                  {level2SubCategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {/* Minor Category */}
              <div>
                <select
                  value={minorCategoryFilter}
                  onChange={(e) => setMinorCategoryFilter(e.target.value)}
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink-muted dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">Minor Category</option>
                  {level3MinorCategories.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Supplier */}
              <div>
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink-muted dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select/Search Supplier (min 3 letters)</option>
                  {suppliers.slice(0, 30).map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── ROW 4: LINE ITEM INPUT ROW ── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
              {/* Item Selector Combobox with Checkbox */}
              <div className="md:col-span-3 relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-ink-muted dark:text-slate-300">Item</label>
                  <label className="flex items-center gap-1 text-[10px] text-ink-faint cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemCheckbox}
                      onChange={(e) => setItemCheckbox(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 rounded border-line-strong"
                    />
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => {
                      setItemSearchQuery(e.target.value);
                      setIsItemDropdownOpen(true);
                    }}
                    onFocus={() => setIsItemDropdownOpen(true)}
                    placeholder="Select/Search Item"
                    className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded pl-2.5 pr-8 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 placeholder:text-ink-faint focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsItemDropdownOpen((p) => !p)}
                    className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded text-ink-faint hover:text-ink-muted"
                    aria-label="Show items"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {isItemDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsItemDropdownOpen(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1 bg-surface dark:bg-slate-800 border border-line dark:border-slate-700 rounded shadow-lg z-20 max-h-56 overflow-y-auto">
                        {filteredItems.length > 0 ? (
                          filteredItems.slice(0, 30).map((it) => (
                            <div
                              key={it.id}
                              onClick={() => handleSelectItem(it)}
                              className="px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-line dark:border-slate-700/50 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-semibold text-ink dark:text-slate-100">{it.name}</div>
                                <div className="text-[10px] text-ink-faint">
                                  Code: {it.code} | UOM: {it.uom} | Cat: {it.category}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-medium text-blue-600 dark:text-blue-400 text-xs">
                                  ৳{Number(it.standardPrice).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-xs text-ink-faint text-center">No matching items found</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Req. Qty */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-[11px] font-medium text-ink-muted dark:text-slate-300">Req. Qty</label>
                  <span title="Quantity requested for this requisition line">
                    <Info className="w-3 h-3 text-ink-faint inline" />
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={reqQty}
                  onChange={(e) => setReqQty(e.target.value)}
                  placeholder="Request Quantity"
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 placeholder:text-ink-faint focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Last Cost */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-ink-muted dark:text-slate-300 mb-1">
                  Last Cost
                </label>
                <input
                  type="text"
                  readOnly
                  value={lastCost ? `৳${lastCost.toLocaleString()}` : ""}
                  placeholder="Last Cost"
                  className="w-full h-8 text-xs border border-line dark:border-slate-700 rounded px-2.5 py-1 bg-control dark:bg-slate-800 text-ink-muted dark:text-slate-400 cursor-not-allowed placeholder:text-ink-faint"
                />
              </div>

              {/* Average Cost */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-ink-muted dark:text-slate-300 mb-1">
                  Average Cost
                </label>
                <input
                  type="text"
                  readOnly
                  value={averageCost ? `৳${averageCost.toLocaleString()}` : ""}
                  placeholder="Average Cost"
                  className="w-full h-8 text-xs border border-line dark:border-slate-700 rounded px-2.5 py-1 bg-control dark:bg-slate-800 text-ink-muted dark:text-slate-400 cursor-not-allowed placeholder:text-ink-faint"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-medium text-ink-muted dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={lineDescription}
                  onChange={(e) => setLineDescription(e.target.value)}
                  placeholder="Description"
                  className="w-full h-8 text-xs border border-line-strong dark:border-slate-700 rounded px-2.5 py-1 bg-surface dark:bg-slate-800 text-ink dark:text-slate-100 placeholder:text-ink-faint focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* ── ROW 5: ACTION BUTTONS (ADD, IMPORT, EXPORT) ── */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleAddItem}
                className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1 shadow-2xs"
              >
                Add
              </button>

              {/* Hidden CSV Input */}
              <input
                type="file"
                ref={csvInputRef}
                onChange={handleImportCsv}
                accept=".csv"
                className="hidden"
              />

              <button
                type="button"
                onClick={handleDownloadTemplate}
                title="Download Sample CSV Template"
                className="h-8 w-8 flex items-center justify-center border border-line dark:border-slate-700 rounded hover:bg-control dark:hover:bg-slate-800 text-primary transition"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                title="Import Line Items from CSV"
                className="h-8 w-8 flex items-center justify-center border border-line dark:border-slate-700 rounded hover:bg-control dark:hover:bg-slate-800 text-primary transition"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>

            {/* ── ADDED ITEMS TABLE ── */}
            <div className="mt-4 pt-3 border-t border-line dark:border-slate-800">
              <div className="overflow-x-auto rounded border border-line dark:border-slate-800">
                <table className="w-full text-left text-xs text-ink-muted dark:text-slate-300">
                  <thead className="bg-grid-head dark:bg-slate-800 border-b border-line dark:border-slate-700 text-[11px] font-semibold text-ink dark:text-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">SL</th>
                      <th className="py-2.5 px-3">Item Code & Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 w-20 text-center">UOM</th>
                      <th className="py-2.5 px-3 w-28 text-right">Req. Qty</th>
                      <th className="py-2.5 px-3 w-28 text-center">Expected Date</th>
                      <th className="py-2.5 px-3 w-28 text-right">Last Cost</th>
                      <th className="py-2.5 px-3 w-28 text-right">Line Total</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      <th className="py-2.5 px-3 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line dark:divide-slate-800 bg-surface dark:bg-slate-900">
                    {addedItems.length > 0 ? (
                      addedItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-canvas/80 dark:hover:bg-slate-800/50 transition">
                          <td className="py-2 px-3 text-center text-ink-faint font-medium">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-ink dark:text-white">{item.itemName}</div>
                            <div className="text-[10px] text-ink-faint">{item.itemCode}</div>
                          </td>
                          <td className="py-2 px-3 text-ink-muted dark:text-slate-300">{item.category}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-1.5 py-0.5 bg-control dark:bg-slate-800 rounded text-[10px] font-medium text-ink-muted dark:text-slate-300">
                              {item.uom}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleUpdateLineQty(item.id, Number(e.target.value))}
                              className="w-20 text-right h-7 px-2 border border-line dark:border-slate-700 rounded text-xs bg-surface dark:bg-slate-800 font-semibold text-ink dark:text-white"
                            />
                          </td>
                          <td className="py-2 px-3 text-center text-ink-muted dark:text-slate-400 text-[11px]">
                            {item.expectedDate}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-ink-muted dark:text-slate-300">
                            ৳{item.lastCost.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                            ৳{item.lineTotal.toLocaleString()}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.remarks}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAddedItems((prev) =>
                                  prev.map((it) => (it.id === item.id ? { ...it, remarks: val } : it))
                                );
                              }}
                              placeholder="Line note..."
                              className="w-full h-7 px-2 border border-line dark:border-slate-700 rounded text-xs bg-surface dark:bg-slate-800 text-ink-muted dark:text-slate-300"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 rounded text-red-500 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 transition"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-ink-faint text-xs">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <FileSpreadsheet className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            <span>No items added yet. Select an item above, enter quantity, and click &quot;Add&quot;.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── TABLE SUMMARY BAR ── */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-4 bg-canvas dark:bg-slate-800/60 border border-line dark:border-slate-700 rounded p-3 text-xs">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-ink-faint">Total Items: </span>
                    <span className="font-bold text-ink dark:text-white">{totalItemsCount}</span>
                  </div>
                  <div>
                    <span className="text-ink-faint">Total Quantity: </span>
                    <span className="font-bold text-ink dark:text-white">{totalQuantitySum.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-ink-faint font-medium">Total Estimated Cost:</span>
                  <span className="text-base font-extrabold text-primary dark:text-blue-400">
                    ৳{totalEstimatedCostSum.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

