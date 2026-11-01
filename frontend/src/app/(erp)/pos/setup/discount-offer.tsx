"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Search,
  CheckCircle,
  Calendar,
  Clock,
  Trash2,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  X,
} from "lucide-react";

export type DiscountOfferTab =
  | "SPECIAL_DISCOUNT"
  | "PRODUCT_DISCOUNT"
  | "OFFER"
  | "VAT_DISCOUNT"
  | "VOUCHER_GENERATE"
  | "POINT_OFFER"
  | "POINT_REDEMPTION";

const TABS: Array<{ id: DiscountOfferTab; label: string }> = [
  { id: "SPECIAL_DISCOUNT", label: "SPECIAL DISCOUNT" },
  { id: "PRODUCT_DISCOUNT", label: "PRODUCT DISCOUNT" },
  { id: "OFFER", label: "OFFER" },
  { id: "VAT_DISCOUNT", label: "VAT DISCOUNT" },
  { id: "VOUCHER_GENERATE", label: "VOUCHER GENERATE" },
  { id: "POINT_OFFER", label: "POINT OFFER" },
  { id: "POINT_REDEMPTION", label: "POINT REDEMPTION" },
];

// Special Discount Interface
interface SpecialDiscountRecord {
  id: string;
  offerName: string;
  officeName: string;
  amountOrPercentage: string;
  minAmount: number;
  maxAmount: number;
  fromDate: string;
  toDate: string;
  startTime: string;
  endTime: string;
  isOnlyDiscountApplied: boolean;
  isAutoApplied: boolean;
  isRequiredApproval: boolean;
  status: "Active" | "Inactive";
}

// Product Discount Interface
interface ProductDiscountRecord {
  id: string;
  offerCode: string;
  offerName: string;
  remarks: string;
  office: string;
  timePeriod: string;
  isVatDiscount: boolean;
  createdBy: string;
  createdDate: string;
  modifiedDate: string;
  status: "Active" | "Inactive";
}

// Offer Interface
interface GeneralOfferRecord {
  id: string;
  createDate: string;
  officeName: string;
  offerCode: string;
  offerName: string;
  offerType: string;
  fromDateTime: string;
  toDateTime: string;
  customerGroup: string;
  status: "Active" | "Inactive";
}

interface DiscountOfferSectionProps {
  onBack: () => void;
}

const INITIAL_SPECIAL_DISCOUNTS: SpecialDiscountRecord[] = [
  {
    id: "spd-1",
    offerName: "Weekend Evening Special",
    officeName: "Marinozz",
    amountOrPercentage: "15%",
    minAmount: 1000,
    maxAmount: 10000,
    fromDate: "2026-11-01",
    toDate: "2026-11-30",
    startTime: "06:00 PM",
    endTime: "11:00 PM",
    isOnlyDiscountApplied: true,
    isAutoApplied: true,
    isRequiredApproval: false,
    status: "Active",
  },
  {
    id: "spd-2",
    offerName: "Corporate Lunch Deal",
    officeName: "Marinozz",
    amountOrPercentage: "200 ৳",
    minAmount: 1500,
    maxAmount: 8000,
    fromDate: "2026-11-01",
    toDate: "2026-11-30",
    startTime: "12:00 PM",
    endTime: "04:00 PM",
    isOnlyDiscountApplied: false,
    isAutoApplied: false,
    isRequiredApproval: true,
    status: "Active",
  },
];

const INITIAL_PRODUCT_DISCOUNTS: ProductDiscountRecord[] = [
  {
    id: "pdd-1",
    offerCode: "DISC-PRD-101",
    offerName: "Beverage Happy Hour",
    remarks: "Valid on all mocktails and hot beverages",
    office: "Marinozz",
    timePeriod: "01/11/2026 - 30/11/2026",
    isVatDiscount: false,
    createdBy: "Admin User",
    createdDate: "2026-11-01",
    modifiedDate: "2026-11-01",
    status: "Active",
  },
];

const INITIAL_GENERAL_OFFERS: GeneralOfferRecord[] = [
  {
    id: "off-1",
    createDate: "2026-11-01",
    officeName: "Marinozz",
    offerCode: "OFF-BOGO-01",
    offerName: "Buy 1 Get 1 Burger",
    offerType: "BOGO Offer",
    fromDateTime: "01/11/2026 12:00 PM",
    toDateTime: "15/11/2026 11:59 PM",
    customerGroup: "All Customers",
    status: "Active",
  },
];

export function DiscountOfferSection({ onBack }: DiscountOfferSectionProps) {
  const [activeTab, setActiveTab] = useState<DiscountOfferTab>("SPECIAL_DISCOUNT");

  // Create modes
  const [isCreatingSpecial, setIsCreatingSpecial] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);

  // Data lists
  const [specialDiscounts, setSpecialDiscounts] = useState<SpecialDiscountRecord[]>(INITIAL_SPECIAL_DISCOUNTS);
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscountRecord[]>(INITIAL_PRODUCT_DISCOUNTS);
  const [generalOffers, setGeneralOffers] = useState<GeneralOfferRecord[]>(INITIAL_GENERAL_OFFERS);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3500);
  };

  // LocalStorage Persistence
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedSpecial = localStorage.getItem("erp_pos_special_discounts_v1");
      if (storedSpecial) setSpecialDiscounts(JSON.parse(storedSpecial));

      const storedProduct = localStorage.getItem("erp_pos_product_discounts_v1");
      if (storedProduct) setProductDiscounts(JSON.parse(storedProduct));

      const storedOffers = localStorage.getItem("erp_pos_general_offers_v1");
      if (storedOffers) setGeneralOffers(JSON.parse(storedOffers));
    } catch (e) {
      console.warn("Could not load discounts from storage:", e);
    }
  }, []);

  const saveSpecial = (items: SpecialDiscountRecord[]) => {
    setSpecialDiscounts(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_special_discounts_v1", JSON.stringify(items));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const saveProduct = (items: ProductDiscountRecord[]) => {
    setProductDiscounts(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_product_discounts_v1", JSON.stringify(items));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const saveOffers = (items: GeneralOfferRecord[]) => {
    setGeneralOffers(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_general_offers_v1", JSON.stringify(items));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // -------------------------------------------------------------
  // Special Discount Form State (Screenshot 2)
  // -------------------------------------------------------------
  const [spdIsActive, setSpdIsActive] = useState(true);
  const [spdIsOpen, setSpdIsOpen] = useState(false);
  const [spdIsItemWiseOpen, setSpdIsItemWiseOpen] = useState(false);
  const [spdIsOnlyDiscount, setSpdIsOnlyDiscount] = useState(false);
  const [spdIsAutoApplied, setSpdIsAutoApplied] = useState(false);

  const [spdOfferName, setSpdOfferName] = useState("");
  const [spdOffice, setSpdOffice] = useState("Marinozz");
  const [spdCounter, setSpdCounter] = useState("Counter 01");
  const [spdStartDate, setSpdStartDate] = useState("01/11/2026 01:00 PM");
  const [spdEndDate, setSpdEndDate] = useState("01/11/2026 01:00 PM");
  const [spdRemarks, setSpdRemarks] = useState("");

  const [spdDiscountBy, setSpdDiscountBy] = useState("Percentage");
  const [spdDiscountValue, setSpdDiscountValue] = useState("");
  const [spdFromAmount, setSpdFromAmount] = useState("");
  const [spdToAmount, setSpdToAmount] = useState("");

  const [spdReqComment, setSpdReqComment] = useState(false);
  const [spdReqApproval, setSpdReqApproval] = useState(false);
  const [spdIsCapped, setSpdIsCapped] = useState(false);
  const [spdDailyLimit, setSpdDailyLimit] = useState("");
  const [spdScheduleDays, setSpdScheduleDays] = useState<string[]>([]);

  // Customer sub-list for special discount
  const [spdCustomerGroup, setSpdCustomerGroup] = useState("All");
  const [spdSelectedCustomer, setSpdSelectedCustomer] = useState("");
  const [spdCustomerList, setSpdCustomerList] = useState<string[]>([]);

  // -------------------------------------------------------------
  // Product Discount Form State (Screenshot 4)
  // -------------------------------------------------------------
  const [pddOfferName, setPddOfferName] = useState("");
  const [pddOffice, setPddOffice] = useState("Marinozz");
  const [pddPaymentType, setPddPaymentType] = useState("All");
  const [pddStartTime, setPddStartTime] = useState("01/11/2026 01:00 PM");
  const [pddEndTime, setPddEndTime] = useState("30/11/2026 11:59 PM");
  const [pddRemarks, setPddRemarks] = useState("");

  const [pddCustomerGroup, setPddCustomerGroup] = useState("All");
  const [pddSelectedCustomer, setPddSelectedCustomer] = useState("");
  const [pddCustomers, setPddCustomers] = useState<string[]>([]);

  const [pddDiscountBy, setPddDiscountBy] = useState("Percentage");
  const [pddPercentage, setPddPercentage] = useState("10");
  const [pddSupplier, setPddSupplier] = useState("All");
  const [pddCategory, setPddCategory] = useState("All");
  const [pddSubCategory, setPddSubCategory] = useState("All");
  const [pddMinorCategory, setPddMinorCategory] = useState("All");
  const [pddBarcodeSearch, setPddBarcodeSearch] = useState("");
  const [pddItems, setPddItems] = useState<any[]>([]);

  // Handlers for Special Discount Save
  const handleSaveSpecialDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spdOfferName.trim()) {
      showToast("Offer Name is required!");
      return;
    }

    const newRecord: SpecialDiscountRecord = {
      id: `spd-${Date.now()}`,
      offerName: spdOfferName.trim(),
      officeName: spdOffice,
      amountOrPercentage: spdDiscountBy === "Percentage" ? `${spdDiscountValue || "0"}%` : `${spdDiscountValue || "0"} ৳`,
      minAmount: Number(spdFromAmount) || 0,
      maxAmount: Number(spdToAmount) || 0,
      fromDate: spdStartDate.slice(0, 10),
      toDate: spdEndDate.slice(0, 10),
      startTime: spdStartDate.slice(11),
      endTime: spdEndDate.slice(11),
      isOnlyDiscountApplied: spdIsOnlyDiscount,
      isAutoApplied: spdIsAutoApplied,
      isRequiredApproval: spdReqApproval,
      status: spdIsActive ? "Active" : "Inactive",
    };

    saveSpecial([newRecord, ...specialDiscounts]);
    showToast(`Special Discount "${newRecord.offerName}" saved successfully`);
    setIsCreatingSpecial(false);
  };

  // Handlers for Product Discount Save
  const handleSaveProductDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pddOfferName.trim()) {
      showToast("Offer Name is required!");
      return;
    }

    const newRecord: ProductDiscountRecord = {
      id: `pdd-${Date.now()}`,
      offerCode: `DISC-PRD-${Math.floor(100 + Math.random() * 900)}`,
      offerName: pddOfferName.trim(),
      remarks: pddRemarks || "N/A",
      office: pddOffice,
      timePeriod: `${pddStartTime.slice(0, 10)} - ${pddEndTime.slice(0, 10)}`,
      isVatDiscount: false,
      createdBy: "Admin User",
      createdDate: new Date().toISOString().slice(0, 10),
      modifiedDate: new Date().toISOString().slice(0, 10),
      status: "Active",
    };

    saveProduct([newRecord, ...productDiscounts]);
    showToast(`Product Discount "${newRecord.offerName}" saved successfully`);
    setIsCreatingProduct(false);
  };

  // Filters for Special Discount
  const [filterOffice, setFilterOffice] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Clean Branded Empty State (Replacing Legacy "AKIJ iBOS")
  const renderBridgeOneEmptyState = (label = "No Data Found") => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="flex items-center gap-1.5 font-black text-2xl tracking-wider text-slate-800 dark:text-slate-100 uppercase">
        <span>BRIDGE</span>
        <span className="text-blue-600">ONE</span>
      </div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
        {label}
      </p>
    </div>
  );

  // -------------------------------------------------------------
  // VIEW: Create Special Discount (Screenshot 2)
  // -------------------------------------------------------------
  if (isCreatingSpecial) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingSpecial(false)}
              className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Special Discount
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSaveSpecialDiscount}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        </div>

        {/* Form Container */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-6">
          <h2 className="text-center font-bold text-sm text-slate-800 dark:text-slate-200">
            Special Discount Offer Setup
          </h2>

          {/* Top Checkboxes Row */}
          <div className="flex items-center justify-start gap-8 flex-wrap pt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={spdIsActive}
                onChange={(e) => setSpdIsActive(e.target.checked)}
                className="size-4 text-blue-600 rounded"
              />
              <span>Is Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={spdIsOpen}
                onChange={(e) => setSpdIsOpen(e.target.checked)}
                className="size-4 text-blue-600 rounded"
              />
              <span>Is Open</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={spdIsItemWiseOpen}
                onChange={(e) => setSpdIsItemWiseOpen(e.target.checked)}
                className="size-4 text-blue-600 rounded"
              />
              <span>Is Item Wise Open Discount</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={spdIsOnlyDiscount}
                onChange={(e) => setSpdIsOnlyDiscount(e.target.checked)}
                className="size-4 text-blue-600 rounded"
              />
              <span>Is Only Discount Applied</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={spdIsAutoApplied}
                onChange={(e) => setSpdIsAutoApplied(e.target.checked)}
                className="size-4 text-blue-600 rounded"
              />
              <span>Is Auto Applied</span>
            </label>
          </div>

          {/* Section: Discount & Offer Setup */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Discount & Offer Setup
            </h3>

            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Offer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Offer Name"
                  value={spdOfferName}
                  onChange={(e) => setSpdOfferName(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Office <span className="text-red-500">*</span>
                </label>
                <select
                  value={spdOffice}
                  onChange={(e) => setSpdOffice(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Marinozz">Marinozz</option>
                  <option value="Head Office">Head Office</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Counter <span className="text-red-500">*</span>
                </label>
                <select
                  value={spdCounter}
                  onChange={(e) => setSpdCounter(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Counter 01">Counter 01</option>
                  <option value="Counter 02">Counter 02</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={spdStartDate}
                    onChange={(e) => setSpdStartDate(e.target.value)}
                    className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                  />
                  <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={spdEndDate}
                    onChange={(e) => setSpdEndDate(e.target.value)}
                    className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                  />
                  <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks
                </label>
                <input
                  type="text"
                  placeholder="Remarks"
                  value={spdRemarks}
                  onChange={(e) => setSpdRemarks(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 opacity-0">
                  Attachment
                </label>
                <button
                  type="button"
                  className="h-14 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs text-slate-600 dark:text-slate-300 font-medium cursor-pointer"
                >
                  <Paperclip className="size-4 mr-1.5" />
                  <span>Attachment</span>
                </button>
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Discount By <span className="text-red-500">*</span>
                </label>
                <select
                  value={spdDiscountBy}
                  onChange={(e) => setSpdDiscountBy(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                >
                  <option value="Percentage">Percentage</option>
                  <option value="Fixed Amount">Fixed Amount</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Discount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="Discount"
                  value={spdDiscountValue}
                  onChange={(e) => setSpdDiscountValue(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  From Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="From Amount"
                  value={spdFromAmount}
                  onChange={(e) => setSpdFromAmount(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  To Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="To Amount"
                  value={spdToAmount}
                  onChange={(e) => setSpdToAmount(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
                />
              </div>
            </div>

            {/* Row 4: Checkboxes */}
            <div className="flex items-center gap-6 pt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={spdReqComment}
                  onChange={(e) => setSpdReqComment(e.target.checked)}
                  className="size-4 text-blue-600 rounded"
                />
                <span>Required Comment</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={spdReqApproval}
                  onChange={(e) => setSpdReqApproval(e.target.checked)}
                  className="size-4 text-blue-600 rounded"
                />
                <span>Required Approval</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={spdIsCapped}
                  onChange={(e) => setSpdIsCapped(e.target.checked)}
                  className="size-4 text-blue-600 rounded"
                />
                <span>Is Capped</span>
              </label>
            </div>

            {/* Row 5: Daily Limit, Schedule Day, Include Time */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Daily Limit
                </label>
                <input
                  type="number"
                  placeholder="Daily Limit"
                  value={spdDailyLimit}
                  onChange={(e) => setSpdDailyLimit(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Schedule Day
                </label>
                <div className="flex items-center gap-4 flex-wrap text-xs text-slate-700 dark:text-slate-300">
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                    <label key={day} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={spdScheduleDays.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) setSpdScheduleDays([...spdScheduleDays, day]);
                          else setSpdScheduleDays(spdScheduleDays.filter((d) => d !== day));
                        }}
                        className="size-3.5 text-blue-600 rounded"
                      />
                      <span>{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Include Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-mono"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="time"
                    className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Customer Setup */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Customer Setup
            </h3>

            <div className="flex items-end gap-4 flex-wrap">
              <div className="w-64">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Group
                </label>
                <select
                  value={spdCustomerGroup}
                  onChange={(e) => setSpdCustomerGroup(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                >
                  <option value="All">All Groups</option>
                  <option value="VIP">VIP Customers</option>
                  <option value="Regular">Regular</option>
                  <option value="Corporate">Corporate</option>
                </select>
              </div>

              <div className="w-80">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Customer
                </label>
                <select
                  value={spdSelectedCustomer}
                  onChange={(e) => setSpdSelectedCustomer(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                >
                  <option value="">Select/Search Customer (min 3 letters)</option>
                  <option value="Tanvir Ahmed (01711000000)">Tanvir Ahmed (01711000000)</option>
                  <option value="Sadia Islam (01822000000)">Sadia Islam (01822000000)</option>
                  <option value="Kamal Hossain (01933000000)">Kamal Hossain (01933000000)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (spdSelectedCustomer && !spdCustomerList.includes(spdSelectedCustomer)) {
                    setSpdCustomerList([...spdCustomerList, spdSelectedCustomer]);
                    showToast(`Customer added`);
                  }
                }}
                className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                Add
              </button>
            </div>

            {/* Customer List or BridgeOne Branded Empty State */}
            {spdCustomerList.length === 0 ? (
              renderBridgeOneEmptyState("No Data Found")
            ) : (
              <div className="rounded border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Customer Name & Contact</th>
                      <th className="p-2.5 text-center w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {spdCustomerList.map((cust, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 text-slate-500">{idx + 1}</td>
                        <td className="p-2.5 font-medium">{cust}</td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => setSpdCustomerList(spdCustomerList.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="size-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700">
            <CheckCircle className="size-4 text-emerald-400" />
            <span>{toast}</span>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: Create Product Discount (Screenshot 4)
  // -------------------------------------------------------------
  if (isCreatingProduct) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingProduct(false)}
              className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Create Product Discount
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSaveProductDiscount}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        </div>

        {/* Card 1: Product Discount Offer Setup */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Product Discount Offer Setup
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Offer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Offer Name"
                value={pddOfferName}
                onChange={(e) => setPddOfferName(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office <span className="text-red-500">*</span>
              </label>
              <select
                value={pddOffice}
                onChange={(e) => setPddOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Type <span className="text-red-500">*</span>
              </label>
              <select
                value={pddPaymentType}
                onChange={(e) => setPddPaymentType(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">All Payment Types</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="MFS">MFS (Bkash/Nagad)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={pddStartTime}
                  onChange={(e) => setPddStartTime(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy hh:mm (a|p)m"
                  value={pddEndTime}
                  onChange={(e) => setPddEndTime(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Remarks
              </label>
              <input
                type="text"
                placeholder="Remarks"
                value={pddRemarks}
                onChange={(e) => setPddRemarks(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 opacity-0">
                Attachment
              </label>
              <button
                type="button"
                className="h-10 px-4 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs text-slate-600 dark:text-slate-300 font-medium cursor-pointer"
              >
                <Paperclip className="size-4 mr-1.5" />
                <span>Attachment</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Customer Setup */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Customer Setup
          </h3>

          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="w-56">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Group
                </label>
                <select
                  value={pddCustomerGroup}
                  onChange={(e) => setPddCustomerGroup(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                >
                  <option value="All">Customer Group</option>
                  <option value="VIP">VIP</option>
                  <option value="Regular">Regular</option>
                </select>
              </div>

              <div className="w-80">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Customer
                </label>
                <select
                  value={pddSelectedCustomer}
                  onChange={(e) => setPddSelectedCustomer(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                >
                  <option value="">Select/Search Customer (min 3 letters)</option>
                  <option value="Tanvir Ahmed">Tanvir Ahmed</option>
                  <option value="Sadia Islam">Sadia Islam</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (pddSelectedCustomer && !pddCustomers.includes(pddSelectedCustomer)) {
                    setPddCustomers([...pddCustomers, pddSelectedCustomer]);
                  }
                }}
                className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                Add
              </button>
            </div>

            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search...."
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs placeholder:text-slate-400"
              />
              <Search className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* BridgeOne Branded Empty State (Replacing Legacy "AKIJ iBOS") */}
          {pddCustomers.length === 0 && renderBridgeOneEmptyState("No Data Found")}
        </div>

        {/* Card 3: Item Setup */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Item Setup
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Discount By <span className="text-red-500">*</span>
              </label>
              <select
                value={pddDiscountBy}
                onChange={(e) => setPddDiscountBy(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Percentage">Percentage</option>
                <option value="Fixed">Fixed Amount</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Percentage <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                placeholder="Percentage"
                value={pddPercentage}
                onChange={(e) => setPddPercentage(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Supplier
              </label>
              <select
                value={pddSupplier}
                onChange={(e) => setPddSupplier(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">Select/Search Supplier (min 3 letters)</option>
                <option value="Fresh Agro">Fresh Agro Ltd</option>
                <option value="Dairy Farm">Dairy Farm Supplies</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={pddCategory}
                onChange={(e) => setPddCategory(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">Category</option>
                <option value="Appetizers">Appetizers</option>
                <option value="Main Course">Main Course</option>
                <option value="Beverages">Beverages</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sub Category
              </label>
              <select
                value={pddSubCategory}
                onChange={(e) => setPddSubCategory(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">Select Sub Category</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Minor Category
              </label>
              <select
                value={pddMinorCategory}
                onChange={(e) => setPddMinorCategory(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">Select Minor Category</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Item <span className="text-red-500">*</span>
                </label>
                <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                  <span>All</span>
                  <input type="checkbox" className="size-3.5" />
                </label>
              </div>
              <input
                type="text"
                placeholder="Search With Barcode"
                value={pddBarcodeSearch}
                onChange={(e) => setPddBarcodeSearch(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => showToast("Item added to discount setup")}
                className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Action Row & Table */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="size-3.5" />
                  <span>DOWNLOAD</span>
                </button>
                <button
                  type="button"
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs"
                >
                  <Upload className="size-3.5" />
                  <span>UPLOAD</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <select className="h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs">
                  <option value="">Select Supplier</option>
                </select>
                <div className="relative w-48">
                  <input
                    type="text"
                    placeholder="Search...."
                    className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 pr-7 text-xs"
                  />
                  <Search className="size-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Table Header with BridgeOne Branded Empty State */}
            <div className="rounded border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5 w-10 text-center"><input type="checkbox" className="size-3.5" /></th>
                    <th className="p-2.5">SL</th>
                    <th className="p-2.5">Barcode</th>
                    <th className="p-2.5">Item Name</th>
                    <th className="p-2.5">Supplier Name</th>
                    <th className="p-2.5">Cost Price</th>
                    <th className="p-2.5">Sales Price</th>
                    <th className="p-2.5">Current Stock</th>
                    <th className="p-2.5">Offer Name</th>
                    <th className="p-2.5">Discount By</th>
                    <th className="p-2.5">Discount Value</th>
                    <th className="p-2.5">Discounted Price</th>
                    <th className="p-2.5">Internal Contribution(%)</th>
                    <th className="p-2.5">Supplier Contribution(%)</th>
                    <th className="p-2.5">Max Quantity</th>
                    <th className="p-2.5">Start Time</th>
                    <th className="p-2.5">End Time</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pddItems.length === 0 && (
                    <tr>
                      <td colSpan={18} className="p-8">
                        {renderBridgeOneEmptyState("No Data Found")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700">
            <CheckCircle className="size-4 text-emerald-400" />
            <span>{toast}</span>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // MAIN VIEW: 7 Tabs List
  // -------------------------------------------------------------
  const headerTitle =
    activeTab === "SPECIAL_DISCOUNT"
      ? "Special Discount"
      : activeTab === "PRODUCT_DISCOUNT"
      ? "Product Discount"
      : activeTab === "OFFER"
      ? "Offer"
      : activeTab === "VAT_DISCOUNT"
      ? "VAT Discount"
      : activeTab === "VOUCHER_GENERATE"
      ? "Voucher Generate"
      : activeTab === "POINT_OFFER"
      ? "Point Offer"
      : "Point Redemption";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* 1. Header with Back button & Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
          title="Back to Setup Menu"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {headerTitle}
        </h1>
      </div>

      {/* 2. Top 7 Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex items-center gap-8 -mb-px overflow-x-auto text-xs font-bold tracking-wide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 transition border-b-2 whitespace-nowrap cursor-pointer uppercase ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* TAB 1: SPECIAL DISCOUNT (Screenshot 1) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "SPECIAL_DISCOUNT" && (
        <div className="space-y-4">
          {/* Top Right Create Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsCreatingSpecial(true)}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-64">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office Name
              </label>
              <select
                value={filterOffice}
                onChange={(e) => setFilterOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
              >
                <option value="All">All</option>
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
              </select>
            </div>

            <div className="w-56">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => showToast(`Filtered special discount offers`)}
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              View
            </button>
          </div>

          {/* Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">SL</th>
                  <th className="p-3 font-semibold">Offer Name</th>
                  <th className="p-3 font-semibold">Office Name</th>
                  <th className="p-3 font-semibold">Amount/Percentage</th>
                  <th className="p-3 font-semibold">Min Amount</th>
                  <th className="p-3 font-semibold">Max Amount</th>
                  <th className="p-3 font-semibold">From Date</th>
                  <th className="p-3 font-semibold">To Date</th>
                  <th className="p-3 font-semibold">Start Time</th>
                  <th className="p-3 font-semibold">End Time</th>
                  <th className="p-3 font-semibold">Is Only Discount Applied</th>
                  <th className="p-3 font-semibold">Is Auto Applied</th>
                  <th className="p-3 font-semibold">Is Required Approval</th>
                  <th className="p-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {specialDiscounts.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{row.offerName}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.officeName}</td>
                    <td className="p-3 font-mono font-bold text-blue-600">{row.amountOrPercentage}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.minAmount}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.maxAmount}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.fromDate}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.toDate}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.startTime}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.endTime}</td>
                    <td className="p-3 text-center">{row.isOnlyDiscountApplied ? "Yes" : "No"}</td>
                    <td className="p-3 text-center">{row.isAutoApplied ? "Yes" : "No"}</td>
                    <td className="p-3 text-center">{row.isRequiredApproval ? "Yes" : "No"}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSpdOfferName(row.offerName);
                            setSpdOffice(row.officeName);
                            setIsCreatingSpecial(true);
                          }}
                          className="p-1 text-slate-600 hover:text-blue-600 transition"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = specialDiscounts.filter((x) => x.id !== row.id);
                            saveSpecial(updated);
                            showToast("Discount offer removed");
                          }}
                          className="p-1 text-rose-500 hover:text-rose-700 transition"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {specialDiscounts.length === 0 && (
                  <tr>
                    <td colSpan={14} className="p-8">
                      {renderBridgeOneEmptyState("No Data Found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TAB 2: PRODUCT DISCOUNT (Screenshot 3) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "PRODUCT_DISCOUNT" && (
        <div className="space-y-4">
          {/* Top Controls: Search box + Create Button */}
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search...."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs placeholder:text-slate-400"
              />
              <Search className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingProduct(true)}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-56">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office :
              </label>
              <select className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs">
                <option value="All">All</option>
                <option value="Marinozz">Marinozz</option>
              </select>
            </div>

            <div className="w-48">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status :
              </label>
              <select className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs">
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="w-44">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                From Date
              </label>
              <div className="relative">
                <input
                  type="text"
                  defaultValue="11/01/2026"
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div className="w-44">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                To Date
              </label>
              <div className="relative">
                <input
                  type="text"
                  defaultValue="11/30/2026"
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => showToast("Filtered product discounts")}
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              View
            </button>
          </div>

          {/* Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">SL</th>
                  <th className="p-3 font-semibold">Offer Code</th>
                  <th className="p-3 font-semibold">Offer Name</th>
                  <th className="p-3 font-semibold">Remarks</th>
                  <th className="p-3 font-semibold">Office</th>
                  <th className="p-3 font-semibold">Time Period</th>
                  <th className="p-3 font-semibold">Is Vat Discount</th>
                  <th className="p-3 font-semibold">Created By</th>
                  <th className="p-3 font-semibold">Created Date</th>
                  <th className="p-3 font-semibold">Modified Date</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {productDiscounts.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-mono font-medium text-blue-600">{row.offerCode}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{row.offerName}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{row.remarks}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.office}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.timePeriod}</td>
                    <td className="p-3 text-center">{row.isVatDiscount ? "Yes" : "No"}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.createdBy}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.createdDate}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.modifiedDate}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = productDiscounts.filter((x) => x.id !== row.id);
                          saveProduct(updated);
                          showToast("Product discount removed");
                        }}
                        className="p-1 text-rose-500 hover:text-rose-700 transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {productDiscounts.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-8">
                      {renderBridgeOneEmptyState("No Data Found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TAB 3: OFFER (Screenshot 5) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "OFFER" && (
        <div className="space-y-4">
          {/* Top Controls: Search box + Create Button */}
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search...."
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs placeholder:text-slate-400"
              />
              <Search className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => {
                const newOff: GeneralOfferRecord = {
                  id: `off-${Date.now()}`,
                  createDate: new Date().toISOString().slice(0, 10),
                  officeName: "Marinozz",
                  offerCode: `OFF-CMP-${Math.floor(10 + Math.random() * 90)}`,
                  offerName: "Festive Combo Package",
                  offerType: "Combo Deal",
                  fromDateTime: "01/11/2026 10:00 AM",
                  toDateTime: "30/11/2026 11:59 PM",
                  customerGroup: "All Customers",
                  status: "Active",
                };
                saveOffers([newOff, ...generalOffers]);
                showToast("New Offer created successfully");
              }}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-64">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office
              </label>
              <select className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs">
                <option value="All">All</option>
                <option value="Marinozz">Marinozz</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => showToast("Filtered general offers")}
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              View
            </button>
          </div>

          {/* Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">SL</th>
                  <th className="p-3 font-semibold">Create Date</th>
                  <th className="p-3 font-semibold">Office Name</th>
                  <th className="p-3 font-semibold">Offer Code</th>
                  <th className="p-3 font-semibold">Offer Name</th>
                  <th className="p-3 font-semibold">Offer Type</th>
                  <th className="p-3 font-semibold">From Date Time</th>
                  <th className="p-3 font-semibold">To Date Time</th>
                  <th className="p-3 font-semibold">Customer Group</th>
                  <th className="p-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {generalOffers.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.createDate}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.officeName}</td>
                    <td className="p-3 font-mono font-bold text-blue-600">{row.offerCode}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{row.offerName}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.offerType}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.fromDateTime}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.toDateTime}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.customerGroup}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = generalOffers.filter((x) => x.id !== row.id);
                          saveOffers(updated);
                          showToast("Offer removed");
                        }}
                        className="p-1 text-rose-500 hover:text-rose-700 transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {generalOffers.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8">
                      {renderBridgeOneEmptyState("No Data Found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TABS 4 - 7: VAT DISCOUNT, VOUCHER, POINT OFFER, REDEMPTION */}
      {/* ----------------------------------------------------------- */}
      {activeTab !== "SPECIAL_DISCOUNT" && activeTab !== "PRODUCT_DISCOUNT" && activeTab !== "OFFER" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => showToast(`${headerTitle} record created`)}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xs">
            {renderBridgeOneEmptyState(`No ${headerTitle} Data Found`)}
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
