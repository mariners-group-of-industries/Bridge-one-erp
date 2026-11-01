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
  Printer,
  FileSpreadsheet,
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

// 1. Special Discount Interface
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

// 2. Product Discount Interface
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

// 3. Offer Interface (Image 1)
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

// 4. Vat Discount Interface (Images 2 & 3)
interface VatDiscountRecord {
  id: string;
  type: string;
  office: string;
  startTime: string;
  endTime: string;
  category: string;
  subCategory?: string;
  minorCategory?: string;
  supplier?: string;
  itemBarcode?: string;
  status: "Active" | "Inactive";
}

// 5. Voucher Generate Interface (Images 4 & 5)
interface VoucherRecord {
  id: string;
  voucherType: string;
  outlet: string;
  customerGroup: string;
  customer: string;
  activationDate: string;
  expiryDate: string;
  voucherCode: string;
  count: number;
  usedCount: number;
  amount: number;
  usedAmount: number;
  pendingAmount: number;
  minSalesAmount: number;
  isOpenSales: boolean;
  isSale: boolean;
  status: "Active" | "Inactive" | "Expired";
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

const INITIAL_VAT_DISCOUNTS: VatDiscountRecord[] = [
  {
    id: "vat-1",
    type: "Item",
    office: "Marinozz",
    startTime: "01/11/2026 01:54 PM",
    endTime: "30/11/2026 11:59 PM",
    category: "Food Items",
    status: "Active",
  },
];

const INITIAL_VOUCHERS: VoucherRecord[] = [
  {
    id: "vch-1",
    voucherType: "Gift Voucher",
    outlet: "Marinozz",
    customerGroup: "All",
    customer: "All",
    activationDate: "11/01/2026",
    expiryDate: "11/30/2026",
    voucherCode: "20Vpot2e",
    count: 1,
    usedCount: 0,
    amount: 500,
    usedAmount: 0,
    pendingAmount: 500,
    minSalesAmount: 2000,
    isOpenSales: true,
    isSale: false,
    status: "Active",
  },
];

export function DiscountOfferSection({ onBack }: DiscountOfferSectionProps) {
  const [activeTab, setActiveTab] = useState<DiscountOfferTab>("SPECIAL_DISCOUNT");

  // Create modes
  const [isCreatingSpecial, setIsCreatingSpecial] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isCreatingOffer, setIsCreatingOffer] = useState(false); // Image 1
  const [isCreatingVatDiscount, setIsCreatingVatDiscount] = useState(false); // Image 3
  const [isCreatingVoucher, setIsCreatingVoucher] = useState(false); // Image 5

  // Data lists
  const [specialDiscounts, setSpecialDiscounts] = useState<SpecialDiscountRecord[]>(INITIAL_SPECIAL_DISCOUNTS);
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscountRecord[]>(INITIAL_PRODUCT_DISCOUNTS);
  const [generalOffers, setGeneralOffers] = useState<GeneralOfferRecord[]>(INITIAL_GENERAL_OFFERS);
  const [vatDiscounts, setVatDiscounts] = useState<VatDiscountRecord[]>(INITIAL_VAT_DISCOUNTS);
  const [vouchers, setVouchers] = useState<VoucherRecord[]>(INITIAL_VOUCHERS);

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

      const storedVat = localStorage.getItem("erp_pos_vat_discounts_v1");
      if (storedVat) setVatDiscounts(JSON.parse(storedVat));

      const storedVch = localStorage.getItem("erp_pos_vouchers_v1");
      if (storedVch) setVouchers(JSON.parse(storedVch));
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
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

  const saveVatDiscounts = (items: VatDiscountRecord[]) => {
    setVatDiscounts(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_vat_discounts_v1", JSON.stringify(items));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const saveVouchers = (items: VoucherRecord[]) => {
    setVouchers(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_vouchers_v1", JSON.stringify(items));
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
  const [pddCustomers, setPddCustomers] = useState<string[]>([]);
  const [pddItems, setPddItems] = useState<any[]>([]);

  // -------------------------------------------------------------
  // Create Offer Form State (Image 1)
  // -------------------------------------------------------------
  const [offOfferType, setOffOfferType] = useState("BOGO Offer");
  const [offOfferName, setOffOfferName] = useState("");
  const [offOutlet, setOffOutlet] = useState("Marinozz");
  const [offCustomerGroup, setOffCustomerGroup] = useState("All");
  const [offFromDateTime, setOffFromDateTime] = useState("2026-11-01 12:00");
  const [offToDateTime, setOffToDateTime] = useState("2026-11-30 23:59");

  // -------------------------------------------------------------
  // Vat Discount Form State (Image 3)
  // -------------------------------------------------------------
  const [vatType, setVatType] = useState("Item");
  const [vatOffice, setVatOffice] = useState("Marinozz");
  const [vatStartTime, setVatStartTime] = useState("01/11/2026 01:54 PM");
  const [vatEndTime, setVatEndTime] = useState("30/11/2026 11:59 PM");
  const [vatSupplier, setVatSupplier] = useState("All");
  const [vatCategory, setVatCategory] = useState("Food Items");
  const [vatSubCategory, setVatSubCategory] = useState("All");
  const [vatMinorCategory, setVatMinorCategory] = useState("All");
  const [vatBarcode, setVatBarcode] = useState("");
  const [vatItems, setVatItems] = useState<any[]>([]);
  const [vatExcludedCategory, setVatExcludedCategory] = useState("All");
  const [vatExcludedBarcode, setVatExcludedBarcode] = useState("");

  // -------------------------------------------------------------
  // Voucher Generate Form State (Image 5)
  // -------------------------------------------------------------
  const [vchType, setVchType] = useState("Gift Voucher");
  const [vchOutlet, setVchOutlet] = useState("Marinozz");
  const [vchActivationDate, setVchActivationDate] = useState("11/01/2026");
  const [vchExpiryDate, setVchExpiryDate] = useState("11/30/2026");
  const [vchCustomerGroup, setVchCustomerGroup] = useState("All");
  const [vchCustomer, setVchCustomer] = useState("All");
  const [vchCount, setVchCount] = useState("1");
  const [vchMinSaleAmt, setVchMinSaleAmt] = useState("1000");
  const [vchCode, setVchCode] = useState("20Vpot2e");
  const [vchPrefixRange, setVchPrefixRange] = useState(false);
  const [vchIsOpenSales, setVchIsOpenSales] = useState(false);
  const [vchAmount, setVchAmount] = useState("500");
  const [vchDraftItems, setVchDraftItems] = useState<any[]>([]);

  // Filters
  const [filterOffice, setFilterOffice] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Clean Branded Empty State: BridgeOne (Replacing Legacy "AKIJ iBOS")
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
  // VIEW: Create Offer And Discount (Image 1)
  // -------------------------------------------------------------
  if (isCreatingOffer) {
    const handleSaveOffer = (e: React.FormEvent) => {
      e.preventDefault();
      if (!offOfferName.trim()) {
        showToast("Offer Name is required!");
        return;
      }
      const newOffer: GeneralOfferRecord = {
        id: `off-${Date.now()}`,
        createDate: new Date().toISOString().slice(0, 10),
        officeName: offOutlet,
        offerCode: `OFF-${Math.floor(100 + Math.random() * 900)}`,
        offerName: offOfferName.trim(),
        offerType: offOfferType,
        fromDateTime: offFromDateTime,
        toDateTime: offToDateTime,
        customerGroup: offCustomerGroup,
        status: "Active",
      };
      saveOffers([newOffer, ...generalOffers]);
      showToast(`Offer "${newOffer.offerName}" created successfully`);
      setIsCreatingOffer(false);
    };

    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingOffer(false)}
              className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Create Offer And Discount
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSaveOffer}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        </div>

        {/* Card Form matching Image 1 */}
        <form onSubmit={handleSaveOffer} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Offer Type <span className="text-red-500">*</span>
              </label>
              <select
                value={offOfferType}
                onChange={(e) => setOffOfferType(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="BOGO Offer">BOGO Offer</option>
                <option value="Combo Package">Combo Package</option>
                <option value="Flat Discount">Flat Discount</option>
                <option value="Item Wise Discount">Item Wise Discount</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Offer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Offer Name"
                value={offOfferName}
                onChange={(e) => setOffOfferName(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Outlet <span className="text-red-500">*</span>
              </label>
              <select
                value={offOutlet}
                onChange={(e) => setOffOutlet(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
                <option value="Dhanmondi Branch">Dhanmondi Branch</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer Group <span className="text-red-500">*</span>
              </label>
              <select
                value={offCustomerGroup}
                onChange={(e) => setOffCustomerGroup(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">All Customer Groups</option>
                <option value="VIP">VIP</option>
                <option value="Regular">Regular</option>
                <option value="Corporate">Corporate</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                From Date Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="mm/dd/yyyy --:--"
                  value={offFromDateTime}
                  onChange={(e) => setOffFromDateTime(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                To Date Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="mm/dd/yyyy --:--"
                  value={offToDateTime}
                  onChange={(e) => setOffToDateTime(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>
        </form>

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
  // VIEW: Vat Discount Create (Image 3)
  // -------------------------------------------------------------
  if (isCreatingVatDiscount) {
    const handleSaveVatDiscount = (e: React.FormEvent) => {
      e.preventDefault();
      const newVat: VatDiscountRecord = {
        id: `vat-${Date.now()}`,
        type: vatType,
        office: vatOffice,
        startTime: vatStartTime,
        endTime: vatEndTime,
        category: vatCategory,
        subCategory: vatSubCategory,
        minorCategory: vatMinorCategory,
        supplier: vatSupplier,
        itemBarcode: vatBarcode,
        status: "Active",
      };
      saveVatDiscounts([newVat, ...vatDiscounts]);
      showToast("VAT Discount configuration saved successfully");
      setIsCreatingVatDiscount(false);
    };

    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingVatDiscount(false)}
              className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Vat Discount
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSaveVatDiscount}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        </div>

        {/* Card 1: Main Config & Item Setup */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={vatType}
                onChange={(e) => setVatType(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Item">Item</option>
                <option value="Category">Category</option>
                <option value="All Items">All Items</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office <span className="text-red-500">*</span>
              </label>
              <select
                value={vatOffice}
                onChange={(e) => setVatOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={vatStartTime}
                  onChange={(e) => setVatStartTime(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy hh:mm (a|p)m"
                  value={vatEndTime}
                  onChange={(e) => setVatEndTime(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Supplier
              </label>
              <select
                value={vatSupplier}
                onChange={(e) => setVatSupplier(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">Select/Search Supplier (min 3 letters)</option>
                <option value="Fresh Foods">Fresh Foods Supplies</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={vatCategory}
                onChange={(e) => setVatCategory(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Food Items">Select Category</option>
                <option value="Beverages">Beverages</option>
                <option value="Desserts">Desserts</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sub Category
              </label>
              <select
                value={vatSubCategory}
                onChange={(e) => setVatSubCategory(e.target.value)}
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
                value={vatMinorCategory}
                onChange={(e) => setVatMinorCategory(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">Select Minor Category</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
                value={vatBarcode}
                onChange={(e) => setVatBarcode(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setVatItems([...vatItems, { id: Date.now(), barcode: vatBarcode || "BR-01", category: vatCategory }]);
                  showToast("Item added to VAT discount");
                }}
                className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* BridgeOne Branded Empty State (Replacing Legacy "AKIJ iBOS") */}
          {vatItems.length === 0 && renderBridgeOneEmptyState("No Data Found")}
        </div>

        {/* Card 2: Excluded Items (Image 3) */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Excluded Items
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={vatExcludedCategory}
                onChange={(e) => setVatExcludedCategory(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">Select Category</option>
                <option value="Bakery">Bakery</option>
                <option value="Water">Mineral Water</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sub Category
              </label>
              <select className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs">
                <option value="All">Select Sub Category</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Minor Category
              </label>
              <select className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs">
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
                value={vatExcludedBarcode}
                onChange={(e) => setVatExcludedBarcode(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => showToast("Excluded item added")}
            className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
          >
            Add
          </button>
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
  // VIEW: Voucher Generate Create (Image 5)
  // -------------------------------------------------------------
  if (isCreatingVoucher) {
    const handleAddVoucherDraft = (e: React.FormEvent) => {
      e.preventDefault();
      const numAmt = Number(vchAmount) || 0;
      if (numAmt <= 0) {
        showToast("Please enter a valid amount");
        return;
      }

      const item = {
        id: `vd-${Date.now()}`,
        voucherType: vchType,
        outlet: vchOutlet,
        activationDate: vchActivationDate,
        expiryDate: vchExpiryDate,
        customerGroup: vchCustomerGroup,
        customer: vchCustomer,
        count: Number(vchCount) || 1,
        minSaleAmt: Number(vchMinSaleAmt) || 0,
        isOpenSales: vchIsOpenSales,
        voucherCode: vchCode || `VCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        amount: numAmt,
      };

      setVchDraftItems([...vchDraftItems, item]);
      showToast(`Voucher added: ${item.voucherCode}`);
    };

    const handleSaveAllVouchers = () => {
      if (vchDraftItems.length === 0) {
        // Save current form
        const newVch: VoucherRecord = {
          id: `vch-${Date.now()}`,
          voucherType: vchType,
          outlet: vchOutlet,
          customerGroup: vchCustomerGroup,
          customer: vchCustomer,
          activationDate: vchActivationDate,
          expiryDate: vchExpiryDate,
          voucherCode: vchCode || "20Vpot2e",
          count: Number(vchCount) || 1,
          usedCount: 0,
          amount: Number(vchAmount) || 500,
          usedAmount: 0,
          pendingAmount: Number(vchAmount) || 500,
          minSalesAmount: Number(vchMinSaleAmt) || 1000,
          isOpenSales: vchIsOpenSales,
          isSale: false,
          status: "Active",
        };
        saveVouchers([newVch, ...vouchers]);
      } else {
        const newRecords: VoucherRecord[] = vchDraftItems.map((d, idx) => ({
          id: `vch-${Date.now()}-${idx}`,
          voucherType: d.voucherType,
          outlet: d.outlet,
          customerGroup: d.customerGroup,
          customer: d.customer,
          activationDate: d.activationDate,
          expiryDate: d.expiryDate,
          voucherCode: d.voucherCode,
          count: d.count,
          usedCount: 0,
          amount: d.amount,
          usedAmount: 0,
          pendingAmount: d.amount,
          minSalesAmount: d.minSaleAmt,
          isOpenSales: d.isOpenSales,
          isSale: false,
          status: "Active",
        }));
        saveVouchers([...newRecords, ...vouchers]);
      }

      showToast("Voucher batch saved successfully");
      setIsCreatingVoucher(false);
    };

    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingVoucher(false)}
              className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Voucher Generate
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSaveAllVouchers}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        </div>

        {/* Form Card (Image 5) */}
        <form onSubmit={handleAddVoucherDraft} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-5">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Voucher Type <span className="text-red-500">*</span>
              </label>
              <select
                value={vchType}
                onChange={(e) => setVchType(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Gift Voucher">Gift Voucher</option>
                <option value="Promo Voucher">Promo Voucher</option>
                <option value="Privilege Pass">Privilege Pass</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Outlet <span className="text-red-500">*</span>
              </label>
              <select
                value={vchOutlet}
                onChange={(e) => setVchOutlet(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Activation Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="mm/dd/yyyy"
                  value={vchActivationDate}
                  onChange={(e) => setVchActivationDate(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expiry Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="mm/dd/yyyy"
                  value={vchExpiryDate}
                  onChange={(e) => setVchExpiryDate(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer Group <span className="text-red-500">*</span>
              </label>
              <select
                value={vchCustomerGroup}
                onChange={(e) => setVchCustomerGroup(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">All</option>
                <option value="VIP">VIP</option>
                <option value="Regular">Regular</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => showToast("Add new customer opened")}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  + ADD NEW
                </button>
              </div>
              <select
                value={vchCustomer}
                onChange={(e) => setVchCustomer(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">All</option>
                <option value="Tanvir Ahmed">Tanvir Ahmed</option>
                <option value="Sadia Islam">Sadia Islam</option>
              </select>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Count <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={vchCount}
                onChange={(e) => setVchCount(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Minimum Sale Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={vchMinSaleAmt}
                onChange={(e) => setVchMinSaleAmt(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Voucher Code
              </label>
              <input
                type="text"
                value={vchCode}
                onChange={(e) => setVchCode(e.target.value)}
                placeholder="20Vpot2e"
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono tracking-wider font-bold text-blue-600"
              />
            </div>

            <div className="flex items-center gap-4 pt-5 md:col-span-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vchPrefixRange}
                  onChange={(e) => setVchPrefixRange(e.target.checked)}
                  className="size-4 text-blue-600 rounded"
                />
                <span>Prefix & Range</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vchIsOpenSales}
                  onChange={(e) => setVchIsOpenSales(e.target.checked)}
                  className="size-4 text-blue-600 rounded"
                />
                <span>isOpenSales</span>
              </label>
            </div>
          </div>

          {/* Row 3 */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-48">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={vchAmount}
                onChange={(e) => setVchAmount(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <button
              type="submit"
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              Add
            </button>
          </div>

          {/* Bottom Table (Image 5) */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs mt-4">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5">SL</th>
                  <th className="p-2.5">Voucher Type</th>
                  <th className="p-2.5">Outlet</th>
                  <th className="p-2.5">Activation Date</th>
                  <th className="p-2.5">Expiry Date</th>
                  <th className="p-2.5">Customer Group</th>
                  <th className="p-2.5">Customer</th>
                  <th className="p-2.5">Count</th>
                  <th className="p-2.5">Min Sale Amt</th>
                  <th className="p-2.5">isOpenSales</th>
                  <th className="p-2.5">Voucher Code</th>
                  <th className="p-2.5">Amount</th>
                  <th className="p-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vchDraftItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 text-slate-500">{idx + 1}</td>
                    <td className="p-2.5 font-medium">{item.voucherType}</td>
                    <td className="p-2.5">{item.outlet}</td>
                    <td className="p-2.5 font-mono">{item.activationDate}</td>
                    <td className="p-2.5 font-mono">{item.expiryDate}</td>
                    <td className="p-2.5">{item.customerGroup}</td>
                    <td className="p-2.5">{item.customer}</td>
                    <td className="p-2.5 font-mono">{item.count}</td>
                    <td className="p-2.5 font-mono">{item.minSaleAmt}</td>
                    <td className="p-2.5">{item.isOpenSales ? "Yes" : "No"}</td>
                    <td className="p-2.5 font-mono font-bold text-blue-600">{item.voucherCode}</td>
                    <td className="p-2.5 font-mono font-bold">{item.amount} ৳</td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setVchDraftItems(vchDraftItems.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="size-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
                {vchDraftItems.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-6">
                      {renderBridgeOneEmptyState("No Draft Vouchers Added")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </form>

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
  // VIEW: Special Discount List (Screenshot 1)
  // -------------------------------------------------------------
  if (isCreatingSpecial) {
    // Already defined above
  }

  // -------------------------------------------------------------
  // MAIN VIEW: 7 Tabs Navigation & List
  // -------------------------------------------------------------
  const headerTitle =
    activeTab === "SPECIAL_DISCOUNT"
      ? "Special Discount"
      : activeTab === "PRODUCT_DISCOUNT"
      ? "Product Discount"
      : activeTab === "OFFER"
      ? "Offer"
      : activeTab === "VAT_DISCOUNT"
      ? "Vat Discount"
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TAB 3: OFFER (Screenshot 5 & Image 1) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "OFFER" && (
        <div className="space-y-4">
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
              onClick={() => setIsCreatingOffer(true)}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TAB 4: VAT DISCOUNT (Image 2 & 3) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "VAT_DISCOUNT" && (
        <div className="space-y-4">
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
              onClick={() => setIsCreatingVatDiscount(true)}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          {/* Filter Bar (Image 2) */}
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
              onClick={() => showToast("Filtered VAT discounts")}
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
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Office</th>
                  <th className="p-3 font-semibold">Start Time</th>
                  <th className="p-3 font-semibold">End Time</th>
                  <th className="p-3 font-semibold">Category</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vatDiscounts.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{row.type}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.office}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.startTime}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.endTime}</td>
                    <td className="p-3 font-medium text-blue-600">{row.category}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = vatDiscounts.filter((x) => x.id !== row.id);
                          saveVatDiscounts(updated);
                          showToast("Vat discount removed");
                        }}
                        className="p-1 text-rose-500 hover:text-rose-700 transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TAB 5: VOUCHER GENERATE (Images 4 & 5) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "VOUCHER_GENERATE" && (
        <div className="space-y-4">
          {/* Top Controls (Image 4): Print/PDF, Excel, + Bulk Upload, + Create */}
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => showToast("Exporting Print/PDF")}
              className="h-8 px-3 rounded border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>Print/PDF</span>
            </button>
            <button
              type="button"
              onClick={() => showToast("Exporting Excel")}
              className="h-8 px-3 rounded border border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => showToast("Bulk Upload Dialog Opened")}
              className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Bulk Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingVoucher(true)}
              className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Create</span>
            </button>
          </div>

          {/* Filter Bar (Image 4) */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-48">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Type
              </label>
              <select className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs">
                <option value="All">All</option>
                <option value="Gift Voucher">Gift Voucher</option>
                <option value="Promo Voucher">Promo Voucher</option>
              </select>
            </div>

            <div className="w-48">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Outlet
              </label>
              <select className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs">
                <option value="All">All</option>
                <option value="Marinozz">Marinozz</option>
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
              onClick={() => showToast("Filtered vouchers")}
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              View
            </button>
          </div>

          {/* 18-Column Table (Image 4) */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">SL</th>
                  <th className="p-3 font-semibold">Voucher Type</th>
                  <th className="p-3 font-semibold">Outlet</th>
                  <th className="p-3 font-semibold">Customer Group</th>
                  <th className="p-3 font-semibold">Customer</th>
                  <th className="p-3 font-semibold">Activation Date</th>
                  <th className="p-3 font-semibold">Expiry Date</th>
                  <th className="p-3 font-semibold">Voucher Code</th>
                  <th className="p-3 font-semibold">Count</th>
                  <th className="p-3 font-semibold">Used Count</th>
                  <th className="p-3 font-semibold">Amount</th>
                  <th className="p-3 font-semibold">Used Amount</th>
                  <th className="p-3 font-semibold">Pending Amount</th>
                  <th className="p-3 font-semibold">Min Sales Amount</th>
                  <th className="p-3 font-semibold">Is Open Sales</th>
                  <th className="p-3 font-semibold">Is Sale</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vouchers.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{row.voucherType}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.outlet}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.customerGroup}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.customer}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.activationDate}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.expiryDate}</td>
                    <td className="p-3 font-mono font-bold text-blue-600">{row.voucherCode}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.count}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.usedCount}</td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{row.amount}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.usedAmount}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.pendingAmount}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.minSalesAmount}</td>
                    <td className="p-3 text-center">{row.isOpenSales ? "Yes" : "No"}</td>
                    <td className="p-3 text-center">{row.isSale ? "Yes" : "No"}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = vouchers.filter((x) => x.id !== row.id);
                          saveVouchers(updated);
                          showToast("Voucher removed");
                        }}
                        className="p-1 text-rose-500 hover:text-rose-700 transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TABS 6 & 7: POINT OFFER & POINT REDEMPTION */}
      {/* ----------------------------------------------------------- */}
      {(activeTab === "POINT_OFFER" || activeTab === "POINT_REDEMPTION") && (
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
