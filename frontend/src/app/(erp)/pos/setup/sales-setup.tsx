"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  CheckCircle,
  FileSpreadsheet,
  Info,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type SalesSetupTab =
  | "SELLING_PRICE_UPDATE"
  | "ITEM_SALES_SETUP"
  | "VAT_GENERATE"
  | "TARGET_SETUP"
  | "RETURN_EXCHANGE_POLICY";

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

interface SalesSetupSectionProps {
  onBack: () => void;
}

export function SalesSetupSection({ onBack }: SalesSetupSectionProps) {
  const [activeTab, setActiveTab] = useState<SalesSetupTab>("SELLING_PRICE_UPDATE");
  const [subView, setSubView] = useState<"LIST" | "CREATE_SELLING_PRICE" | "CREATE_ITEM_SALES" | "CREATE_VAT">("LIST");

  // Filters
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

  // Selling Price Update Create Form
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
  const [formStock, setFormStock] = useState("45");
  const [formAvgCost, setFormAvgCost] = useState("180");
  const [formLastCost, setFormLastCost] = useState("175");
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

  // Create Item Sales Setup Form
  const [cisType, setCisType] = useState("Select View By");
  const [cisSupplier, setCisSupplier] = useState("");
  const [cisCategory, setCisCategory] = useState("");
  const [cisSubCategory, setCisSubCategory] = useState("");
  const [cisItemChecked, setCisItemChecked] = useState(true);
  const [cisAllChecked, setCisAllChecked] = useState(false);
  const [cisBarcode, setCisBarcode] = useState("");
  const [cisSearch, setCisSearch] = useState("");

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

  // Computed Header Title
  const headerTitle = useMemo(() => {
    if (subView === "CREATE_SELLING_PRICE") return "Create Item Selling Price Update";
    if (subView === "CREATE_ITEM_SALES") return "Sales Setup";
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
      </div>

      {/* 2. Top Tabs Bar (Visible in LIST view) */}
      {subView === "LIST" && (
        <div className="flex items-center gap-6 sm:gap-8 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold tracking-wider uppercase">
          <button
            type="button"
            onClick={() => setActiveTab("SELLING_PRICE_UPDATE")}
            className={`pb-2.5 transition-colors whitespace-nowrap ${
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
            className={`pb-2.5 transition-colors whitespace-nowrap ${
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
            className={`pb-2.5 transition-colors whitespace-nowrap ${
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
            className={`pb-2.5 transition-colors whitespace-nowrap ${
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
            className={`pb-2.5 transition-colors whitespace-nowrap ${
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
              <div className="relative">
                <select
                  value={createOffice}
                  onChange={(e) => setCreateOffice(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Marinozz">Marinozz</option>
                </select>
              </div>
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
          TAB 3: VAT GENERATE (Screenshot 5)
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
              onClick={() => showToast("Create VAT rule")}
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
          TAB 4: TARGET SETUP
      ========================================================================= */}
      {activeTab === "TARGET_SETUP" && subView === "LIST" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Target Setup
            </h2>
            <button
              type="button"
              onClick={() => showToast("Create target setup")}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create Target</span>
            </button>
          </div>
          <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-800">
            Configure sales staff and outlet targets.
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: RETURN EXCHANGE POLICY
      ========================================================================= */}
      {activeTab === "RETURN_EXCHANGE_POLICY" && subView === "LIST" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Return & Exchange Policy
            </h2>
            <button
              type="button"
              onClick={() => showToast("Create policy rule")}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create Policy</span>
            </button>
          </div>
          <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-800">
            Define POS customer return, exchange, and refund window policies.
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
