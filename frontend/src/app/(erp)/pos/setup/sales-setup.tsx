"use client";

import React, { useState, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  CheckCircle,
  Info,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  Paperclip,
} from "lucide-react";

type SalesSetupTab =
  | "SELLING_PRICE_UPDATE"
  | "ITEM_SALES_SETUP"
  | "VAT_GENERATE"
  | "TARGET_SETUP"
  | "RETURN_EXCHANGE_POLICY";

type SubView =
  | "LIST"
  | "CREATE_SELLING_PRICE"
  | "CREATE_ITEM_SALES"
  | "CREATE_VAT"
  | "CREATE_TARGET"
  | "CREATE_RETURN_POLICY";

interface SellingPriceRecord {
  id: string;
  sl: number;
  createDate: string;
  code: string;
  userName: string;
  officeName: string;
  warehouseName: string;
  status: "Active" | "Pending" | "Draft" | "Approved";
}

interface PriceUpdateItem {
  id: string;
  office: string;
  barcode: string;
  itemName: string;
  avgCost: number;
  oldSalesPrice: number;
  newSalesPrice: number;
  quantity: number;
  upDownAmount: number;
  totalUpDownAmount: number;
}

interface ItemSalesRecord {
  id: string;
  sl: number;
  barcode: string;
  itemName: string;
  category: string;
  subCategory: string;
  supplier: string;
  salesPrice: number;
  status: "Active" | "Inactive";
}

interface VatRecord {
  id: string;
  sl: number;
  officeName: string;
  vatPercent: number;
  effectiveDate: string;
  status: "Active" | "Inactive";
}

interface TargetRecord {
  id: string;
  sl: number;
  officeName: string;
  targetType: string;
  targetAmount: number;
  fromDate: string;
  toDate: string;
  status: "Active" | "Pending";
}

interface ReturnPolicyRecord {
  id: string;
  sl: number;
  rulesId: string;
  createdDate: string;
  itemPolicy: string;
  rulesOn: string;
  rulesName: string;
  status: "Active" | "Inactive";
}

const SAMPLE_PRICE_RECORDS: SellingPriceRecord[] = [
  {
    id: "sp-1",
    sl: 1,
    createDate: "2026-10-28",
    code: "SPU-2026-0001",
    userName: "Admin",
    officeName: "Marinozz",
    warehouseName: "Main Warehouse",
    status: "Approved",
  },
  {
    id: "sp-2",
    sl: 2,
    createDate: "2026-10-31",
    code: "SPU-2026-0002",
    userName: "Manager",
    officeName: "Marinozz",
    warehouseName: "Kitchen Outlet",
    status: "Pending",
  },
];

const SAMPLE_ITEM_SALES: ItemSalesRecord[] = [
  {
    id: "is-1",
    sl: 1,
    barcode: "89411002341",
    itemName: "Beef Burger (Regular)",
    category: "Fast Food",
    subCategory: "Burgers",
    supplier: "Prime Agro Ltd.",
    salesPrice: 280,
    status: "Active",
  },
  {
    id: "is-2",
    sl: 2,
    barcode: "89411002342",
    itemName: "Chicken Pizza (10 inch)",
    category: "Italian",
    subCategory: "Pizza",
    supplier: "Bakers Choice",
    salesPrice: 550,
    status: "Active",
  },
  {
    id: "is-3",
    sl: 3,
    barcode: "89411002343",
    itemName: "Cold Coffee (250ml)",
    category: "Beverages",
    subCategory: "Coffee",
    supplier: "Beverage Corp",
    salesPrice: 160,
    status: "Active",
  },
];

const SAMPLE_VAT_RECORDS: VatRecord[] = [
  {
    id: "vat-1",
    sl: 1,
    officeName: "Marinozz",
    vatPercent: 7.5,
    effectiveDate: "2026-01-01",
    status: "Active",
  },
];

const SAMPLE_TARGET_RECORDS: TargetRecord[] = [
  {
    id: "trg-1",
    sl: 1,
    officeName: "Marinozz",
    targetType: "Monthly Sales Target",
    targetAmount: 500000,
    fromDate: "2026-11-01",
    toDate: "2026-11-30",
    status: "Active",
  },
];

const SAMPLE_POLICY_RECORDS: ReturnPolicyRecord[] = [
  {
    id: "pol-1",
    sl: 1,
    rulesId: "POL-2026-001",
    createdDate: "2026-10-25",
    itemPolicy: "Exchangeable",
    rulesOn: "All Items",
    rulesName: "Exchangeable Items",
    status: "Active",
  },
];

interface SalesSetupSectionProps {
  onBack: () => void;
}

export function SalesSetupSection({ onBack }: SalesSetupSectionProps) {
  const [activeTab, setActiveTab] = useState<SalesSetupTab>("SELLING_PRICE_UPDATE");
  const [subView, setSubView] = useState<SubView>("LIST");

  // Filter States
  const [selectedOffice, setSelectedOffice] = useState("All");
  const [filterType, setFilterType] = useState("Select View By");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBarcode, setFilterBarcode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Records state
  const [priceRecords, setPriceRecords] = useState<SellingPriceRecord[]>(SAMPLE_PRICE_RECORDS);
  const [itemSalesRecords, setItemSalesRecords] = useState<ItemSalesRecord[]>(SAMPLE_ITEM_SALES);
  const [vatRecords, setVatRecords] = useState<VatRecord[]>(SAMPLE_VAT_RECORDS);
  const [targetRecords] = useState<TargetRecord[]>(SAMPLE_TARGET_RECORDS);
  const [policyRecords, setPolicyRecords] = useState<ReturnPolicyRecord[]>(SAMPLE_POLICY_RECORDS);

  // 1. Selling Price Update Create Form
  const [createOffice, setCreateOffice] = useState("Marinozz");
  const [createWarehouse, setCreateWarehouse] = useState("ALL");
  const [createRemarks, setCreateRemarks] = useState("");

  const [formSupplier, setFormSupplier] = useState("");
  const [formType, setFormType] = useState("Item");
  const [formMarkUpDown, setFormMarkUpDown] = useState("Select");
  const [formValueIn, setFormValueIn] = useState("Select");
  const [formValue, setFormValue] = useState("");
  const [formItemChecked, setFormItemChecked] = useState(true);
  const [formBarcode, setFormBarcode] = useState("");
  const [formStock] = useState("45");
  const [formAvgCost] = useState("180");
  const [formLastCost] = useState("175");
  const [formOldPrice, setFormOldPrice] = useState("250");
  const [formNewPrice, setFormNewPrice] = useState("280");

  const [stagedPriceItems, setStagedPriceItems] = useState<PriceUpdateItem[]>([
    {
      id: "it-1",
      office: "Marinozz",
      barcode: "89411002341",
      itemName: "Beef Burger (Regular)",
      avgCost: 180,
      oldSalesPrice: 250,
      newSalesPrice: 280,
      quantity: 10,
      upDownAmount: 30,
      totalUpDownAmount: 300,
    },
  ]);

  // 2. Create Item Sales Setup Form
  const [cisType, setCisType] = useState("Select View By");
  const [cisSupplier, setCisSupplier] = useState("");
  const [cisCategory, setCisCategory] = useState("");
  const [cisSubCategory, setCisSubCategory] = useState("");
  const [cisItemChecked, setCisItemChecked] = useState(true);
  const [cisAllChecked, setCisAllChecked] = useState(false);
  const [cisBarcode, setCisBarcode] = useState("");
  const [cisSearch, setCisSearch] = useState("");

  // 3. Create VAT Generate Form (Screenshot 1)
  const [vatName, setVatName] = useState("");
  const [vatOffice, setVatOffice] = useState("Marinozz");
  const [vatStartTime, setVatStartTime] = useState("2026-11-01T13:54");
  const [vatEndTime, setVatEndTime] = useState("");
  const [vatRemarks, setVatRemarks] = useState("");

  const [vatPercentInput, setVatPercentInput] = useState("7.5");
  const [vatCategoryInput, setVatCategoryInput] = useState("");
  const [vatSubCategoryInput, setVatSubCategoryInput] = useState("");
  const [vatMinorCategoryInput, setVatMinorCategoryInput] = useState("");
  const [vatItemChecked, setVatItemChecked] = useState(false);
  const [vatAllChecked, setVatAllChecked] = useState(false);
  const [vatItemSearch, setVatItemSearch] = useState("");

  // 4. Target Setup Form (Screenshots 2 & 3)
  const [trgOffice, setTrgOffice] = useState("All");
  const [trgStatus, setTrgStatus] = useState("All");
  const [trgFromDate, setTrgFromDate] = useState("2026-11-01");
  const [trgToDate, setTrgToDate] = useState("2026-11-30");
  const [individualTargetOpen, setIndividualTargetOpen] = useState(false);
  const [bulkTargetOpen, setBulkTargetOpen] = useState(true);

  // 5. Return & Exchange Policy Form (Screenshots 4 & 5)
  const [repOffice, setRepOffice] = useState("Marinozz");
  const [repItemPolicy, setRepItemPolicy] = useState("All");
  const [repRulesOn, setRepRulesOn] = useState("All");
  const [repStatus, setRepStatus] = useState("All");

  const [crpItemPolicy, setCrpItemPolicy] = useState("");
  const [crpRulesOn, setCrpRulesOn] = useState("");
  const [crpOffice, setCrpOffice] = useState("Marinozz");
  const [crpRulesName, setCrpRulesName] = useState("Exchangeable Items");
  const [crpRestrictAfterService, setCrpRestrictAfterService] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3000);
  };

  // Add Item to Selling Price Update Table
  const handleAddPriceItem = () => {
    if (!formBarcode && !formNewPrice) {
      showToast("Please enter an item or barcode and new sales price");
      return;
    }
    const oldP = Number(formOldPrice) || 0;
    const newP = Number(formNewPrice) || 0;
    const upDown = newP - oldP;
    const qty = Number(formStock) || 1;

    const newItem: PriceUpdateItem = {
      id: `it-${Date.now()}`,
      office: createOffice,
      barcode: formBarcode || `89411${Math.floor(100000 + Math.random() * 900000)}`,
      itemName: formBarcode ? `Item (${formBarcode})` : "Special Combo Meal",
      avgCost: Number(formAvgCost) || 0,
      oldSalesPrice: oldP,
      newSalesPrice: newP,
      quantity: qty,
      upDownAmount: upDown,
      totalUpDownAmount: upDown * qty,
    };
    setStagedPriceItems((prev) => [...prev, newItem]);
    showToast("Item added to update list");
    setFormBarcode("");
  };

  // Remove Item from Selling Price Update Table
  const handleRemovePriceItem = (id: string) => {
    setStagedPriceItems((prev) => prev.filter((i) => i.id !== id));
    showToast("Item removed");
  };

  // Save Selling Price Update
  const handleSaveSellingPrice = () => {
    if (stagedPriceItems.length === 0) {
      showToast("Please add at least one item to update");
      return;
    }
    const newRecord: SellingPriceRecord = {
      id: `sp-${Date.now()}`,
      sl: priceRecords.length + 1,
      createDate: new Date().toISOString().split("T")[0],
      code: `SPU-2026-${String(priceRecords.length + 1).padStart(4, "0")}`,
      userName: "Admin",
      officeName: createOffice,
      warehouseName: createWarehouse === "ALL" ? "Main Warehouse" : createWarehouse,
      status: "Approved",
    };
    setPriceRecords((prev) => [newRecord, ...prev]);
    showToast(`Selling price update ${newRecord.code} saved successfully!`);
    setSubView("LIST");
  };

  // Save Item Sales Setup
  const handleSaveItemSales = () => {
    const newItem: ItemSalesRecord = {
      id: `is-${Date.now()}`,
      sl: itemSalesRecords.length + 1,
      barcode: cisBarcode || `89411${Math.floor(100000 + Math.random() * 900000)}`,
      itemName: cisBarcode ? `Custom Item (${cisBarcode})` : "Grilled Platter",
      category: cisCategory || "Continental",
      subCategory: cisSubCategory || "Platters",
      supplier: cisSupplier || "Fresh Farm Ltd.",
      salesPrice: 420,
      status: "Active",
    };
    setItemSalesRecords((prev) => [newItem, ...prev]);
    showToast("Item sales setup saved successfully!");
    setSubView("LIST");
  };

  // Save VAT Generate
  const handleSaveVat = () => {
    const newVat: VatRecord = {
      id: `vat-${Date.now()}`,
      sl: vatRecords.length + 1,
      officeName: vatOffice,
      vatPercent: Number(vatPercentInput) || 7.5,
      effectiveDate: vatStartTime.split("T")[0] || new Date().toISOString().split("T")[0],
      status: "Active",
    };
    setVatRecords((prev) => [...prev, newVat]);
    showToast("VAT configuration saved successfully!");
    setSubView("LIST");
  };

  // Save Return & Exchange Policy
  const handleSaveReturnPolicy = () => {
    const newPol: ReturnPolicyRecord = {
      id: `pol-${Date.now()}`,
      sl: policyRecords.length + 1,
      rulesId: `POL-2026-${String(policyRecords.length + 1).padStart(3, "0")}`,
      createdDate: new Date().toISOString().split("T")[0],
      itemPolicy: crpItemPolicy || "Exchangeable",
      rulesOn: crpRulesOn || "All Items",
      rulesName: crpRulesName || "Exchangeable Items",
      status: "Active",
    };
    setPolicyRecords((prev) => [...prev, newPol]);
    showToast(`Policy ${newPol.rulesName} saved successfully!`);
    setSubView("LIST");
  };

  // Computed Header Title
  const headerTitle = useMemo(() => {
    if (subView === "CREATE_SELLING_PRICE") return "Create Item Selling Price Update";
    if (subView === "CREATE_ITEM_SALES") return "Sales Setup";
    if (subView === "CREATE_VAT") return "Vat Generate";
    if (subView === "CREATE_TARGET") return "Target Setup";
    if (subView === "CREATE_RETURN_POLICY") return "Create Return & Exchange Rules Setup";
    if (activeTab === "SELLING_PRICE_UPDATE") return "Selling Price Update";
    if (activeTab === "ITEM_SALES_SETUP") return "Item Sales Setup";
    if (activeTab === "VAT_GENERATE") return "Vat Generate";
    if (activeTab === "TARGET_SETUP") return "Target Setup";
    if (activeTab === "RETURN_EXCHANGE_POLICY") return "Return Exchange Policy";
    return "Sales Setup";
  }, [activeTab, subView]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* 1. Header with Back Button and Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (subView !== "LIST") {
                setSubView("LIST");
              } else {
                onBack();
              }
            }}
            className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {headerTitle}
          </h1>
        </div>

        {/* Top Right Save button when in Create screens */}
        {subView === "CREATE_SELLING_PRICE" && (
          <button
            type="button"
            onClick={handleSaveSellingPrice}
            className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs tracking-wider uppercase rounded shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        )}
        {subView === "CREATE_ITEM_SALES" && (
          <button
            type="button"
            onClick={handleSaveItemSales}
            className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs tracking-wider uppercase rounded shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        )}
        {subView === "CREATE_VAT" && (
          <button
            type="button"
            onClick={handleSaveVat}
            className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs tracking-wider uppercase rounded shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        )}
        {subView === "CREATE_RETURN_POLICY" && (
          <button
            type="button"
            onClick={handleSaveReturnPolicy}
            className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs tracking-wider uppercase rounded shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        )}
      </div>

      {/* 2. Top Tabs Bar (Visible in LIST view) */}
      {subView === "LIST" && (
        <div className="flex items-center gap-6 sm:gap-8 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold tracking-wider uppercase">
          <button
            type="button"
            onClick={() => setActiveTab("SELLING_PRICE_UPDATE")}
            className={`pb-2.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "SELLING_PRICE_UPDATE"
                ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            SELLING PRICE UPDATE
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ITEM_SALES_SETUP")}
            className={`pb-2.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "ITEM_SALES_SETUP"
                ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            ITEM SALES SETUP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("VAT_GENERATE")}
            className={`pb-2.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "VAT_GENERATE"
                ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            VAT GENERATE
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("TARGET_SETUP")}
            className={`pb-2.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "TARGET_SETUP"
                ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            TARGET SETUP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("RETURN_EXCHANGE_POLICY")}
            className={`pb-2.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "RETURN_EXCHANGE_POLICY"
                ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            RETURN EXCHANGE POLICY
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 1: SELLING PRICE UPDATE (LIST VIEW)
      ========================================================================= */}
      {activeTab === "SELLING_PRICE_UPDATE" && subView === "LIST" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Office
                </label>
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="h-9 w-44 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="Marinozz">Marinozz</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => showToast(`Filtered by ${selectedOffice}`)}
                className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                View
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSubView("CREATE_SELLING_PRICE")}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold w-14">SL</th>
                  <th className="p-3 font-semibold">Create Date</th>
                  <th className="p-3 font-semibold">Code</th>
                  <th className="p-3 font-semibold">User Name</th>
                  <th className="p-3 font-semibold">Office Name</th>
                  <th className="p-3 font-semibold">Warehouse Name</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {priceRecords.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                      {row.createDate}
                    </td>
                    <td className="p-3 font-mono font-bold text-blue-600">
                      {row.code}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {row.userName}
                    </td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                      {row.officeName}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {row.warehouseName}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          row.status === "Approved"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSubView("CREATE_SELLING_PRICE")}
                        className="text-slate-500 hover:text-blue-600 transition p-1 cursor-pointer"
                        title="View details"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 1 CREATE SCREEN: Create Item Selling Price Update (Screenshot 2)
      ========================================================================= */}
      {subView === "CREATE_SELLING_PRICE" && (
        <div className="space-y-5 pt-1">
          {/* Top Form: Office, Warehouse, Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office <span className="text-red-500">*</span>
              </label>
              <select
                value={createOffice}
                onChange={(e) => setCreateOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Marinozz">Marinozz</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Warehouse
              </label>
              <select
                value={createWarehouse}
                onChange={(e) => setCreateWarehouse(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="ALL">ALL</option>
                <option value="Main Warehouse">Main Warehouse</option>
                <option value="Kitchen Outlet">Kitchen Outlet</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Remarks
              </label>
              <input
                type="text"
                placeholder="Remarks"
                value={createRemarks}
                onChange={(e) => setCreateRemarks(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Middle Form: Add Item Section */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            {/* Row 1: Supplier, Type, Mark Up/Down, Value In, Value */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier
                </label>
                <select
                  value={formSupplier}
                  onChange={(e) => setFormSupplier(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Supplier</option>
                  <option value="Prime Agro Ltd.">Prime Agro Ltd.</option>
                  <option value="Bakers Choice">Bakers Choice</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Item">Item</option>
                  <option value="Category">Category</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mark Up/Down
                </label>
                <select
                  value={formMarkUpDown}
                  onChange={(e) => setFormMarkUpDown(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Select">Select</option>
                  <option value="Mark Up">Mark Up</option>
                  <option value="Mark Down">Mark Down</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Value In
                </label>
                <select
                  value={formValueIn}
                  onChange={(e) => setFormValueIn(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Select">Select</option>
                  <option value="Percentage">Percentage (%)</option>
                  <option value="Fixed">Fixed (BDT)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Value
                </label>
                <input
                  type="text"
                  placeholder="Value"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 2: Item*, Stock, AVG Cost, Last Cost, Old Sales Price* */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    Item <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="checkbox"
                    checked={formItemChecked}
                    onChange={(e) => setFormItemChecked(e.target.checked)}
                    className="size-3.5 rounded text-blue-600 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Search With Barcode"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  className="w-full h-9 rounded border border-blue-500 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <span>Stock</span>
                  <Info className="size-3 text-slate-400" />
                </label>
                <input
                  type="text"
                  disabled
                  value={formStock}
                  className="w-full h-9 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 text-xs text-slate-600 dark:text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  AVG Cost
                </label>
                <input
                  type="text"
                  disabled
                  value={formAvgCost}
                  className="w-full h-9 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 text-xs text-slate-600 dark:text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Last Cost
                </label>
                <input
                  type="text"
                  disabled
                  value={formLastCost}
                  className="w-full h-9 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 text-xs text-slate-600 dark:text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Old Sales Price <span className="text-red-500">*</span>
                </label>
                <select
                  value={formOldPrice}
                  onChange={(e) => setFormOldPrice(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="250">250.00 BDT</option>
                  <option value="300">300.00 BDT</option>
                  <option value="500">500.00 BDT</option>
                </select>
              </div>
            </div>

            {/* Row 3: New Sales Price*, Add Button */}
            <div className="flex items-end gap-3 pt-1">
              <div className="w-64">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Sales Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="New Sales Price"
                  value={formNewPrice}
                  onChange={(e) => setFormNewPrice(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={handleAddPriceItem}
                className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Staged Items Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold w-12">SL</th>
                  <th className="p-3 font-semibold">Office</th>
                  <th className="p-3 font-semibold">Barcode</th>
                  <th className="p-3 font-semibold">Item Name</th>
                  <th className="p-3 font-semibold text-right">AVG Cost</th>
                  <th className="p-3 font-semibold text-right">Old Sales Price</th>
                  <th className="p-3 font-semibold text-right">New Sales Price</th>
                  <th className="p-3 font-semibold text-right">Quantity</th>
                  <th className="p-3 font-semibold text-right">Up/Down Amount</th>
                  <th className="p-3 font-semibold text-right">Total Up/Down Amount</th>
                  <th className="p-3 font-semibold text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stagedPriceItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-3">{item.office}</td>
                    <td className="p-3 font-mono">{item.barcode}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                      {item.itemName}
                    </td>
                    <td className="p-3 text-right font-mono">{item.avgCost.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono">{item.oldSalesPrice.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold text-blue-600">
                      {item.newSalesPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono">{item.quantity}</td>
                    <td className="p-3 text-right font-mono text-emerald-600">
                      +{item.upDownAmount.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      +{item.totalUpDownAmount.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemovePriceItem(item.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        title="Delete item"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ITEM SALES SETUP (LIST VIEW) (Screenshot 3)
      ========================================================================= */}
      {activeTab === "ITEM_SALES_SETUP" && subView === "LIST" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Filter Bar: Type*, Supplier, Category, Item [x] Barcode */}
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="h-9 w-36 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Select View By">Select View By</option>
                  <option value="Item Wise">Item Wise</option>
                  <option value="Category Wise">Category Wise</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier
                </label>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="h-9 w-36 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Search Supplier</option>
                  <option value="Prime Agro Ltd.">Prime Agro Ltd.</option>
                  <option value="Bakers Choice">Bakers Choice</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="h-9 w-40 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Item Category</option>
                  <option value="Fast Food">Fast Food</option>
                  <option value="Italian">Italian</option>
                  <option value="Beverages">Beverages</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Item
                  </label>
                  <input
                    type="checkbox"
                    checked
                    readOnly
                    className="size-3 rounded text-blue-600"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Search With Barcode"
                  value={filterBarcode}
                  onChange={(e) => setFilterBarcode(e.target.value)}
                  className="h-9 w-44 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={() => showToast("Viewing filtered item sales")}
                className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                View
              </button>
            </div>

            {/* Right Buttons: EXCEL, Create */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => showToast("Exporting Excel report...")}
                className="h-9 px-4 border border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                EXCEL
              </button>
              <button
                type="button"
                onClick={() => setSubView("CREATE_ITEM_SALES")}
                className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="flex justify-end pt-1">
            <input
              type="text"
              placeholder="Search Item"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-56 rounded border border-slate-300 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold w-12">SL</th>
                  <th className="p-3 font-semibold">Barcode</th>
                  <th className="p-3 font-semibold">Item Name</th>
                  <th className="p-3 font-semibold">Category</th>
                  <th className="p-3 font-semibold">Supplier</th>
                  <th className="p-3 font-semibold text-right">Sales Price</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {itemSalesRecords.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-mono">{item.barcode}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                      {item.itemName}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {item.category}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {item.supplier}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-blue-600">
                      ৳{item.salesPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => showToast(`Editing ${item.itemName}`)}
                        className="text-slate-500 hover:text-blue-600 transition p-1 cursor-pointer"
                        title="Edit setup"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2 CREATE SCREEN: Sales Setup (Screenshot 4)
      ========================================================================= */}
      {subView === "CREATE_ITEM_SALES" && (
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={cisType}
                onChange={(e) => setCisType(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Select View By">Select View By</option>
                <option value="Item Wise">Item Wise</option>
                <option value="Category Wise">Category Wise</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Supplier
              </label>
              <select
                value={cisSupplier}
                onChange={(e) => setCisSupplier(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Search Supplier</option>
                <option value="Prime Agro Ltd.">Prime Agro Ltd.</option>
                <option value="Bakers Choice">Bakers Choice</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={cisCategory}
                onChange={(e) => setCisCategory(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select Item Category</option>
                <option value="Fast Food">Fast Food</option>
                <option value="Italian">Italian</option>
                <option value="Beverages">Beverages</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sub Category
              </label>
              <select
                value={cisSubCategory}
                onChange={(e) => setCisSubCategory(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select Item Subcategory</option>
                <option value="Burgers">Burgers</option>
                <option value="Pizza">Pizza</option>
                <option value="Coffee">Coffee</option>
              </select>
            </div>
          </div>

          <div className="flex items-end justify-between flex-wrap gap-4 pt-2">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="w-64">
                <div className="flex items-center gap-3 mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <span>Item</span>
                    <input
                      type="checkbox"
                      checked={cisItemChecked}
                      onChange={(e) => setCisItemChecked(e.target.checked)}
                      className="size-3.5 rounded text-blue-600"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer ml-3">
                    <span>All</span>
                    <input
                      type="checkbox"
                      checked={cisAllChecked}
                      onChange={(e) => setCisAllChecked(e.target.checked)}
                      className="size-3.5 rounded text-blue-600"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Search With Barcode"
                  value={cisBarcode}
                  onChange={(e) => setCisBarcode(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveItemSales}
                className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                Add
              </button>
            </div>

            <div className="w-56">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search...."
                  value={cisSearch}
                  onChange={(e) => setCisSearch(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Search className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: VAT GENERATE (LIST VIEW) (Screenshot 5 from first batch)
      ========================================================================= */}
      {activeTab === "VAT_GENERATE" && subView === "LIST" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Office
                </label>
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="h-9 w-44 rounded border border-blue-500 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="Marinozz">Marinozz</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => showToast(`Filtered VAT for ${selectedOffice}`)}
                className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                View
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSubView("CREATE_VAT")}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold w-14">SL</th>
                  <th className="p-3 font-semibold">Office Name</th>
                  <th className="p-3 font-semibold">VAT (%)</th>
                  <th className="p-3 font-semibold">Effective Date</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vatRecords.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                      {row.officeName}
                    </td>
                    <td className="p-3 font-mono font-bold text-blue-600">
                      {row.vatPercent}%
                    </td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                      {row.effectiveDate}
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => showToast(`Edit VAT for ${row.officeName}`)}
                        className="text-slate-500 hover:text-blue-600 transition p-1 cursor-pointer"
                        title="Edit VAT"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3 CREATE SCREEN: Vat Generate (Batch 2, Screenshot 1)
      ========================================================================= */}
      {subView === "CREATE_VAT" && (
        <div className="space-y-6 pt-1">
          {/* Section 1: VAT Generate */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              VAT Generate
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vat Regenerate Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Vat Regenerate Name"
                  value={vatName}
                  onChange={(e) => setVatName(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Office <span className="text-red-500">*</span>
                </label>
                <select
                  value={vatOffice}
                  onChange={(e) => setVatOffice(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Marinozz">Office (Marinozz)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={vatStartTime}
                  onChange={(e) => setVatStartTime(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={vatEndTime}
                  onChange={(e) => setVatEndTime(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="w-full sm:w-1/2 pt-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Remarks <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Remarks"
                  value={vatRemarks}
                  onChange={(e) => setVatRemarks(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Paperclip className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Section 2: Item Setup */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Item Setup
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  VAT Percentage <span className="text-red-500">*</span>
                </label>
                <select
                  value={vatPercentInput}
                  onChange={(e) => setVatPercentInput(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="5">5%</option>
                  <option value="7.5">7.5%</option>
                  <option value="10">10%</option>
                  <option value="15">15%</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={vatCategoryInput}
                  onChange={(e) => setVatCategoryInput(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  <option value="Fast Food">Fast Food</option>
                  <option value="Italian">Italian</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sub Category
                </label>
                <select
                  value={vatSubCategoryInput}
                  onChange={(e) => setVatSubCategoryInput(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Sub Category</option>
                  <option value="Burgers">Burgers</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Minor Category
                </label>
                <select
                  value={vatMinorCategoryInput}
                  onChange={(e) => setVatMinorCategoryInput(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Minor Category</option>
                </select>
              </div>
            </div>

            <div className="flex items-end gap-3 pt-1">
              <div className="w-80">
                <div className="flex items-center gap-3 mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <span>Item</span> <span className="text-red-500">*</span>
                    <input
                      type="checkbox"
                      checked={vatItemChecked}
                      onChange={(e) => setVatItemChecked(e.target.checked)}
                      className="size-3.5 rounded text-blue-600 ml-1"
                    />
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer ml-4">
                    <span>All</span>
                    <input
                      type="checkbox"
                      checked={vatAllChecked}
                      onChange={(e) => setVatAllChecked(e.target.checked)}
                      className="size-3.5 rounded text-blue-600 ml-1"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Select/Search Item (min 3 letters)"
                  value={vatItemSearch}
                  onChange={(e) => setVatItemSearch(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={() => showToast("Item added to VAT configuration")}
                className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: TARGET SETUP (LIST VIEW) (Batch 2, Screenshot 2)
      ========================================================================= */}
      {activeTab === "TARGET_SETUP" && subView === "LIST" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Office <span className="text-red-500">*</span>
                </label>
                <select
                  value={trgOffice}
                  onChange={(e) => setTrgOffice(e.target.value)}
                  className="h-9 w-36 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="Marinozz">Marinozz</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={trgStatus}
                  onChange={(e) => setTrgStatus(e.target.value)}
                  className="h-9 w-36 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  From Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={trgFromDate}
                  onChange={(e) => setTrgFromDate(e.target.value)}
                  className="h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  To Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={trgToDate}
                  onChange={(e) => setTrgToDate(e.target.value)}
                  className="h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={() => showToast(`Filtered targets from ${trgFromDate} to ${trgToDate}`)}
                className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                View
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSubView("CREATE_TARGET")}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold w-14">SL</th>
                  <th className="p-3 font-semibold">Office Name</th>
                  <th className="p-3 font-semibold">Target Type</th>
                  <th className="p-3 font-semibold text-right">Target Amount</th>
                  <th className="p-3 font-semibold">Period</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {targetRecords.map((t, idx) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{t.officeName}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{t.targetType}</td>
                    <td className="p-3 text-right font-mono font-bold text-blue-600">৳{t.targetAmount.toLocaleString()}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{t.fromDate} to {t.toDate}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => showToast(`Edit target for ${t.officeName}`)}
                        className="text-slate-500 hover:text-blue-600 transition p-1 cursor-pointer"
                        title="Edit Target"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4 CREATE SCREEN: Target Setup (Batch 2, Screenshot 3)
      ========================================================================= */}
      {subView === "CREATE_TARGET" && (
        <div className="space-y-4 pt-1">
          {/* Accordion 1: Individual Target Setup */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setIndividualTargetOpen(!individualTargetOpen)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer transition"
            >
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Individual Target Setup
              </span>
              {individualTargetOpen ? (
                <ChevronUp className="size-4 text-slate-500" />
              ) : (
                <ChevronDown className="size-4 text-slate-500" />
              )}
            </button>
            {individualTargetOpen && (
              <div className="p-4 space-y-3 border-t border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Staff / Waiter
                    </label>
                    <select className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-800">
                      <option>Select Staff</option>
                      <option>Rahim Ahmed</option>
                      <option>Karim Hossain</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Amount (BDT)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Period
                    </label>
                    <input
                      type="month"
                      className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accordion 2: Bulk Target Setup */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setBulkTargetOpen(!bulkTargetOpen)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer transition"
            >
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Bulk Target Setup
              </span>
              {bulkTargetOpen ? (
                <ChevronUp className="size-4 text-slate-500" />
              ) : (
                <ChevronDown className="size-4 text-slate-500" />
              )}
            </button>
            {bulkTargetOpen && (
              <div className="p-4 flex items-center justify-between flex-wrap gap-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => showToast("Downloading Bulk Target template...")}
                    className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => showToast("Upload file dialog opened")}
                    className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Upload className="size-3.5" />
                    <span>Upload</span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => showToast("Reset form")}
                    className="h-9 px-5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      showToast("Bulk target setup saved successfully!");
                      setSubView("LIST");
                    }}
                    className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: RETURN EXCHANGE POLICY (LIST VIEW) (Batch 2, Screenshot 4)
      ========================================================================= */}
      {activeTab === "RETURN_EXCHANGE_POLICY" && subView === "LIST" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Filters: Office, Item Policy, Rules On, Status, View */}
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Office
                </label>
                <select
                  value={repOffice}
                  onChange={(e) => setRepOffice(e.target.value)}
                  className="h-9 w-36 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value="Marinozz">Marinozz</option>
                  <option value="All">All</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Item Policy
                </label>
                <select
                  value={repItemPolicy}
                  onChange={(e) => setRepItemPolicy(e.target.value)}
                  className="h-9 w-32 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="Exchangeable">Exchangeable</option>
                  <option value="Non-Exchangeable">Non-Exchangeable</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rules On
                </label>
                <select
                  value={repRulesOn}
                  onChange={(e) => setRepRulesOn(e.target.value)}
                  className="h-9 w-32 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="All Items">All Items</option>
                  <option value="Specific Items">Specific Items</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={repStatus}
                  onChange={(e) => setRepStatus(e.target.value)}
                  className="h-9 w-32 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => showToast("Viewing filtered policies")}
                className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                View
              </button>
            </div>

            {/* Right Buttons: EXCEL, + Create */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => showToast("Exporting Excel...")}
                className="h-9 px-4 border border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Download className="size-3.5" />
                <span>EXCEL</span>
              </button>
              <button
                type="button"
                onClick={() => setSubView("CREATE_RETURN_POLICY")}
                className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="size-4" />
                <span>Create</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold w-14">SL</th>
                  <th className="p-3 font-semibold">Rules Id</th>
                  <th className="p-3 font-semibold">Created Date</th>
                  <th className="p-3 font-semibold">Item Policy</th>
                  <th className="p-3 font-semibold">Rules On</th>
                  <th className="p-3 font-semibold">Rules Name</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {policyRecords.map((p, idx) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-blue-600">{p.rulesId}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{p.createdDate}</td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{p.itemPolicy}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{p.rulesOn}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{p.rulesName}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => showToast(`Edit policy ${p.rulesId}`)}
                        className="text-slate-500 hover:text-blue-600 transition p-1 cursor-pointer"
                        title="Edit policy"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5 CREATE SCREEN: Create Return & Exchange Rules Setup (Batch 2, Screenshot 5)
      ========================================================================= */}
      {subView === "CREATE_RETURN_POLICY" && (
        <div className="space-y-6 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Item Policy <span className="text-red-500">*</span>
              </label>
              <select
                value={crpItemPolicy}
                onChange={(e) => setCrpItemPolicy(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Item Policy</option>
                <option value="Exchangeable">Exchangeable</option>
                <option value="Non-Exchangeable">Non-Exchangeable</option>
                <option value="Refundable">Refundable</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Rules On <span className="text-red-500">*</span>
              </label>
              <select
                value={crpRulesOn}
                onChange={(e) => setCrpRulesOn(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Rules On</option>
                <option value="All Items">All Items</option>
                <option value="Specific Category">Specific Category</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office <span className="text-red-500">*</span>
              </label>
              <select
                value={crpOffice}
                onChange={(e) => setCrpOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Marinozz">Office (Marinozz)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Rules Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={crpRulesName}
                onChange={(e) => setCrpRulesName(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="restrictService"
              checked={crpRestrictAfterService}
              onChange={(e) => setCrpRestrictAfterService(e.target.checked)}
              className="size-4 rounded text-blue-600 cursor-pointer"
            />
            <label htmlFor="restrictService" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              Restrict After Service Start
            </label>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
              Item Setup
            </h3>
            <p className="text-xs text-slate-500">
              Rules will automatically be evaluated during POS counter sales and customer returns.
            </p>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle className="size-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
