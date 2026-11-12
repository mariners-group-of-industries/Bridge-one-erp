"use client";

import React, { useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
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
import type { PurchaseFormOptions } from "@/features/purchase/components/PurchaseFormShared";
import type { Office, Warehouse, Item, Supplier, PurchaseRequisition } from "@bridgeone/contracts";

interface DirectoryEmployee {
  id: string;
  name: string;
  designation?: string;
  department?: string;
  employeeCode?: string;
  officeName?: string;
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

export function CreateRequisitionView() {
  const searchParams = useSearchParams();
  const fromId = searchParams.get("fromId") || "";

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
        <Spinner className="h-6 w-6 text-blue-600" />
      </div>
    );
  }

  return <CreateRequisitionForm key={templateReq?.id ?? "new"} templateReq={templateReq ?? null} />;
}

function CreateRequisitionForm({ templateReq }: { templateReq: PurchaseRequisition | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const perms = usePurchasePermissions();

  // 1. Target Selector State
  const [targetType, setTargetType] = useState<"Employee" | "Department" | "Project">("Employee");
  const [createFromSalesOrder, setCreateFromSalesOrder] = useState(false);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");

  // 2. Primary Form Fields (Row 1)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultDeliveryStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  }, []);

  const [createDate, setCreateDate] = useState(todayStr);
  const [expectedDate, setExpectedDate] = useState(templateReq?.requiredDeliveryDate || defaultDeliveryStr);
  const [pickedOfficeId, setSelectedOfficeId] = useState<string>(templateReq?.officeId || "");
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
  const [remarks, setRemarks] = useState(templateReq ? `Cloned from ${templateReq.requisitionNumber}` : "");
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

  const { data: directoryData } = useQuery<{ success: boolean; employees: DirectoryEmployee[] }>({
    queryKey: ["directory"],
    queryFn: () => fetchApi("/connect/directory"),
  });

  const { data: formOptions } = useQuery<PurchaseFormOptions>({
    queryKey: ["purchase-form-options"],
    queryFn: () => fetchApi("/master/purchase-form-options"),
  });

  const employees = useMemo(() => {
    const dir = directoryData?.employees ?? [];
    if (dir.length > 0) return dir;
    return (formOptions?.employees ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      employeeCode: e.employeeCode,
      department: e.department,
      designation: e.designation,
    }));
  }, [directoryData, formOptions]);

  // The first office is used until the user picks one.
  const selectedOfficeId = pickedOfficeId || offices[0]?.id || "";

  // Filter warehouses based on selected office
  const availableWarehouses = useMemo(() => {
    if (!selectedOfficeId) return allWarehouses;
    // Only the office own warehouses: the server rejects a warehouse of another office.
    return allWarehouses.filter((w) => w.officeId === selectedOfficeId);
  }, [allWarehouses, selectedOfficeId]);

  // The picked warehouse while it belongs to the office, otherwise the office first warehouse.
  const selectedWarehouseId = availableWarehouses.some((w) => w.id === pickedWarehouseId) ? pickedWarehouseId : (availableWarehouses[0]?.id ?? "");

  // 3-Level Category Cascade from DB ItemCategory + item fallbacks
  const level1Categories = useMemo(() => {
    const cats = (formOptions?.categories ?? []).filter((c) => c.level === 1);
    if (cats.length > 0) return cats.map((c) => c.name);
    const set = new Set<string>();
    itemsCatalog.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort();
  }, [formOptions, itemsCatalog]);

  const level2SubCategories = useMemo(() => {
    const allCats = formOptions?.categories ?? [];
    const parent = allCats.find((c) => c.level === 1 && c.name === categoryFilter);
    const list = allCats.filter((c) => c.level === 2 && (!parent || c.parentId === parent.id));
    if (list.length > 0) return list.map((c) => c.name);
    const set = new Set<string>();
    itemsCatalog.forEach((it) => {
      if ((categoryFilter === "All" || it.category === categoryFilter) && it.subCategory) set.add(it.subCategory);
    });
    return Array.from(set).sort();
  }, [formOptions, itemsCatalog, categoryFilter]);

  const level3MinorCategories = useMemo(() => {
    const allCats = formOptions?.categories ?? [];
    const sub = allCats.find((c) => c.level === 2 && c.name === subCategoryFilter);
    const list = allCats.filter((c) => c.level === 3 && (!sub || c.parentId === sub.id));
    if (list.length > 0) return list.map((c) => c.name);
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
      if (addedItems.length === 0) throw new Error("Please add at least one item to the requisition table.");

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
        items: addedItems.map((it) => ({
          itemId: it.itemId,
          itemCode: it.itemCode,
          itemName: it.itemName,
          uom: it.uom,
          quantity: Number(it.quantity),
          estimatedUnitPrice: Number(it.lastCost),
          lineTotal: Number(it.lineTotal),
          remarks: it.remarks || undefined,
        })),
      };

      const result = await fetchApi<{ requisitionNumber: string }>("/purchase/requisitions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return { result, isSaveAndNew };
    },
    onSuccess: ({ result, isSaveAndNew }) => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      if (isSaveAndNew) {
        toast.success(`Requisition ${result.requisitionNumber} created! Ready for new entry.`, {
          title: "Created Successfully",
        });
        setAddedItems([]);
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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 p-3 md:p-6 text-slate-800 dark:text-slate-100">
      {/* ── TOP HEADER BAR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-lg px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/purchase/requisitions")}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
            title="Back to Requisitions"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Create Requisition</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => createMutation.mutate(true)}
            disabled={createMutation.isPending || !perms.requisitions.create}
            title={!perms.requisitions.create ? "Requires Create permission in Configuration" : undefined}
            className="h-8 px-3.5 border border-[#2563eb] text-[#2563eb] hover:bg-blue-50 dark:hover:bg-blue-950 font-medium text-xs rounded transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {createMutation.isPending && <Spinner className="size-3.5" />}
            Save & New
          </button>
          <button
            type="button"
            onClick={() => createMutation.mutate(false)}
            disabled={createMutation.isPending || !perms.requisitions.create}
            title={!perms.requisitions.create ? "Requires Create permission in Configuration" : undefined}
            className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {createMutation.isPending && <Spinner className="size-3.5" />}
            Save
          </button>
        </div>
      </div>

      {/* ── MAIN FORM CONTAINER ── */}
      <div className="bg-white dark:bg-slate-900 border-x border-b border-slate-200 dark:border-slate-800 rounded-b-lg p-4 md:p-5 shadow-xs space-y-4">
        {/* ── TARGET SELECTION RADIO GROUP & CHECKBOX ── */}
        <div className="flex flex-wrap items-center gap-6 py-1 border-b border-slate-100 dark:border-slate-800 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
            <input
              type="radio"
              name="targetType"
              checked={targetType === "Employee"}
              onChange={() => setTargetType("Employee")}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <span>Employee</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
            <input
              type="radio"
              name="targetType"
              checked={targetType === "Department"}
              onChange={() => setTargetType("Department")}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <span>Department</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
            <input
              type="radio"
              name="targetType"
              checked={targetType === "Project"}
              onChange={() => setTargetType("Project")}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <span>Project</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 ml-2">
            <input
              type="checkbox"
              checked={createFromSalesOrder}
              onChange={(e) => {
                setCreateFromSalesOrder(e.target.checked);
                if (!e.target.checked) setSelectedSalesOrderId("");
              }}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span>Create From Sales Order</span>
          </label>

          {createFromSalesOrder && (
            <select
              value={selectedSalesOrderId}
              onChange={(e) => {
                const soId = e.target.value;
                setSelectedSalesOrderId(soId);
                const so = formOptions?.salesOrders.find((s) => s.id === soId);
                if (so) {
                  if (so.officeId) setSelectedOfficeId(so.officeId);
                  setRemarks(`Against Sales Order ${so.number} (${so.customerName})`);
                  setAddedItems(
                    so.lines.map((l, i) => ({
                      id: `so_${so.id}_${i}`,
                      itemId: l.itemId,
                      itemCode: l.itemCode,
                      itemName: l.itemName,
                      category: "Sales Order",
                      uom: l.uom || "PCS",
                      quantity: l.qty,
                      expectedDate: so.expectedDeliveryDate || expectedDate,
                      lastCost: l.unitPrice,
                      averageCost: l.unitPrice,
                      lineTotal: Number((l.qty * l.unitPrice).toFixed(2)),
                      remarks: `SO ${so.number}`,
                    }))
                  );
                  toast.success(`Loaded ${so.lines.length} item(s) from Sales Order ${so.number}.`);
                }
              }}
              className="h-7 rounded border border-blue-300 bg-blue-50/50 px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select Sales Order...</option>
              {(formOptions?.salesOrders ?? []).map((so) => (
                <option key={so.id} value={so.id}>
                  {so.number} — {so.customerName} ({so.orderDate})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── ROW 1: PRIMARY DETAILS (6 COLS GRID) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Create Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Create Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
                className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Employee / Department / Project Selector with Clear Button */}
          <div className="relative">
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              {targetType} <span className="text-red-500">*</span>
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
                  className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded pl-2.5 pr-14 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
                <div className="absolute right-1 top-1.5 flex items-center gap-1 text-slate-400">
                  {employeeQuery && (
                    <button
                      type="button"
                      onClick={() => setEmployeeQuery("")}
                      className="hover:text-slate-600 p-0.5"
                      title="Clear"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEmployeeDropdownOpen((p) => !p)}
                    className="hover:text-slate-600 p-0.5"
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
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-lg z-20 max-h-52 overflow-y-auto">
                      {filteredEmployees.length > 0 ? (
                        filteredEmployees.map((emp) => (
                          <div
                            key={emp.id}
                            onClick={() => {
                              setEmployeeQuery(emp.name);
                              setIsEmployeeDropdownOpen(false);
                            }}
                            className="px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-50 dark:border-slate-700/50"
                          >
                            <span className="font-medium text-slate-800 dark:text-slate-100">{emp.name}</span>
                            <span className="text-[10px] text-slate-400">{emp.department || emp.designation}</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-xs text-slate-400 text-center">No employee found</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : targetType === "Department" ? (
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
                className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Office <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedOfficeId}
              onChange={(e) => setSelectedOfficeId(e.target.value)}
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              {offices.map((off) => (
                <option key={off.id} value={off.id}>
                  {off.name}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse */}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Warehouse <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              {availableWarehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Inventory Type */}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Inventory Type <span className="text-red-500">*</span>
            </label>
            <select
              value={inventoryType}
              onChange={(e) => setInventoryType(e.target.value)}
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="Inventory Item">Inventory Item</option>
              <option value="Non-Inventory Item">Non-Inventory Item</option>
              <option value="Asset">Asset</option>
              <option value="Service">Service</option>
            </select>
          </div>

          {/* Expected Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Expected Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ── ROW 2: BUYER & REMARKS WITH ATTACHMENT ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          {/* Buyer Name */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Buyer Name
            </label>
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Select/Search Buyer Name (min 3 letters)"
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Buyer Office */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Buyer Office
            </label>
            <select
              value={buyerOfficeId}
              onChange={(e) => setBuyerOfficeId(e.target.value)}
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Remarks"
                className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded pl-2.5 pr-10 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
                className="absolute right-1 text-slate-400 hover:text-blue-600 p-1 rounded transition"
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
              <div className="mt-1 flex items-center gap-2 text-[10px] text-blue-600">
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

        {/* ── ROW 3: CATEGORY & SUPPLIER FILTER STRIP (5 COLS GRID) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Item Type */}
          <div>
            <select
              value={itemTypeFilter}
              onChange={(e) => setItemTypeFilter(e.target.value)}
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
              <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Item</label>
              <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemCheckbox}
                  onChange={(e) => setItemCheckbox(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
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
                className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded pl-2.5 pr-8 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setIsItemDropdownOpen((p) => !p)}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {isItemDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsItemDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-lg z-20 max-h-56 overflow-y-auto">
                    {filteredItems.length > 0 ? (
                      filteredItems.slice(0, 30).map((it) => (
                        <div
                          key={it.id}
                          onClick={() => handleSelectItem(it)}
                          className="px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{it.name}</div>
                            <div className="text-[10px] text-slate-400">
                              Code: {it.code} | UOM: {it.uom} | Cat: {it.category}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-blue-600 text-xs">
                              ৳{Number(it.standardPrice).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-slate-400 text-center">No matching items found</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Req. Qty */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Req. Qty</label>
              <span title="Quantity requested for this requisition line">
                <Info className="w-3 h-3 text-slate-400 inline" />
              </span>
            </div>
            <input
              type="number"
              min="1"
              step="any"
              value={reqQty}
              onChange={(e) => setReqQty(e.target.value)}
              placeholder="Request Quantity"
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Last Cost */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Last Cost
            </label>
            <input
              type="text"
              readOnly
              value={lastCost ? `৳${lastCost.toLocaleString()}` : ""}
              placeholder="Last Cost"
              className="w-full h-8 text-xs border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed placeholder:text-slate-400"
            />
          </div>

          {/* Average Cost */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Average Cost
            </label>
            <input
              type="text"
              readOnly
              value={averageCost ? `৳${averageCost.toLocaleString()}` : ""}
              placeholder="Average Cost"
              className="w-full h-8 text-xs border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed placeholder:text-slate-400"
            />
          </div>

          {/* Description */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={lineDescription}
              onChange={(e) => setLineDescription(e.target.value)}
              placeholder="Description"
              className="w-full h-8 text-xs border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
            className="h-8 w-8 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#2563eb] transition"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            title="Import Line Items from CSV"
            className="h-8 w-8 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#2563eb] transition"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>

        {/* ── ADDED ITEMS TABLE ── */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {addedItems.length > 0 ? (
                  addedItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="py-2 px-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.itemName}</div>
                        <div className="text-[10px] text-slate-400">{item.itemCode}</div>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{item.category}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-medium text-slate-600 dark:text-slate-300">
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
                          className="w-20 text-right h-7 px-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400 text-[11px]">
                        {item.expectedDate}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
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
                          className="w-full h-7 px-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded p-3 text-xs">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-slate-500">Total Items: </span>
                <span className="font-bold text-slate-900 dark:text-white">{totalItemsCount}</span>
              </div>
              <div>
                <span className="text-slate-500">Total Quantity: </span>
                <span className="font-bold text-slate-900 dark:text-white">{totalQuantitySum.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Total Estimated Cost:</span>
              <span className="text-base font-extrabold text-[#2563eb] dark:text-blue-400">
                ৳{totalEstimatedCostSum.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

