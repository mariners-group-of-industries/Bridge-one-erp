"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Search,
  CheckCircle,
  Calendar,
  Trash2,
  Download,
  Upload,
  Printer,
  FileSpreadsheet,
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

// 6. Point Offer Interface (New Images 1 & 2)
interface PointOfferRecord {
  id: string;
  offerName: string;
  outletName: string;
  paymentMethod: string;
  timePeriod: string;
  createdBy: string;
  createdDate: string;
  status: "Active" | "Inactive";
}

// 7. Point Redemption Interface (New Images 3 & 4)
interface PointRedemptionRecord {
  id: string;
  createdDate: string;
  code: string;
  redemptionType: string;
  voucherName: string;
  totalCustomer: number;
  totalGainedPoint: number;
  totalIssuedPoint: number;
  totalAmount: number;
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

const INITIAL_POINT_OFFERS: PointOfferRecord[] = [
  {
    id: "po-1",
    offerName: "Loyalty Tier Reward",
    outletName: "Marinozz",
    paymentMethod: "All Payment Methods",
    timePeriod: "01/11/2026 - 30/11/2026",
    createdBy: "Admin User",
    createdDate: "2026-11-01",
    status: "Active",
  },
];

const INITIAL_POINT_REDEMPTIONS: PointRedemptionRecord[] = [
  {
    id: "pr-1",
    createdDate: "2026-11-01",
    code: "RED-PT-101",
    redemptionType: "Cash Voucher",
    voucherName: "Standard 100 Pt Voucher",
    totalCustomer: 25,
    totalGainedPoint: 2500,
    totalIssuedPoint: 2500,
    totalAmount: 2500,
    status: "Active",
  },
];

export function DiscountOfferSection({ onBack }: DiscountOfferSectionProps) {
  const [activeTab, setActiveTab] = useState<DiscountOfferTab>("SPECIAL_DISCOUNT");

  // Create modes
  const [isCreatingSpecial, setIsCreatingSpecial] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [isCreatingVatDiscount, setIsCreatingVatDiscount] = useState(false);
  const [isCreatingVoucher, setIsCreatingVoucher] = useState(false);
  const [isCreatingPointOffer, setIsCreatingPointOffer] = useState(false);
  const [isCreatingPointRedemption, setIsCreatingPointRedemption] = useState(false);

  // Data lists
  const [specialDiscounts, setSpecialDiscounts] = useState<SpecialDiscountRecord[]>(INITIAL_SPECIAL_DISCOUNTS);
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscountRecord[]>(INITIAL_PRODUCT_DISCOUNTS);
  const [generalOffers, setGeneralOffers] = useState<GeneralOfferRecord[]>(INITIAL_GENERAL_OFFERS);
  const [vatDiscounts, setVatDiscounts] = useState<VatDiscountRecord[]>(INITIAL_VAT_DISCOUNTS);
  const [vouchers, setVouchers] = useState<VoucherRecord[]>(INITIAL_VOUCHERS);
  const [pointOffers, setPointOffers] = useState<PointOfferRecord[]>(INITIAL_POINT_OFFERS);
  const [pointRedemptions, setPointRedemptions] = useState<PointRedemptionRecord[]>(INITIAL_POINT_REDEMPTIONS);

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
      const s1 = localStorage.getItem("erp_pos_special_discounts_v1");
      const s2 = localStorage.getItem("erp_pos_product_discounts_v1");
      const s3 = localStorage.getItem("erp_pos_general_offers_v1");
      const s4 = localStorage.getItem("erp_pos_vat_discounts_v1");
      const s5 = localStorage.getItem("erp_pos_vouchers_v1");
      const s6 = localStorage.getItem("erp_pos_point_offers_v1");
      const s7 = localStorage.getItem("erp_pos_point_redemptions_v1");
      queueMicrotask(() => {
        if (s1) setSpecialDiscounts(JSON.parse(s1));
        if (s2) setProductDiscounts(JSON.parse(s2));
        if (s3) setGeneralOffers(JSON.parse(s3));
        if (s4) setVatDiscounts(JSON.parse(s4));
        if (s5) setVouchers(JSON.parse(s5));
        if (s6) setPointOffers(JSON.parse(s6));
        if (s7) setPointRedemptions(JSON.parse(s7));
      });
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
    }
  }, []);

  const saveSpecial = (items: SpecialDiscountRecord[]) => {
    setSpecialDiscounts(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_special_discounts_v1", JSON.stringify(items));
      } catch (e) {}
    }
  };

  const saveProduct = (items: ProductDiscountRecord[]) => {
    setProductDiscounts(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_product_discounts_v1", JSON.stringify(items));
      } catch (e) {}
    }
  };

  const saveOffers = (items: GeneralOfferRecord[]) => {
    setGeneralOffers(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_general_offers_v1", JSON.stringify(items));
      } catch (e) {}
    }
  };

  const saveVatDiscounts = (items: VatDiscountRecord[]) => {
    setVatDiscounts(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_vat_discounts_v1", JSON.stringify(items));
      } catch (e) {}
    }
  };

  const saveVouchers = (items: VoucherRecord[]) => {
    setVouchers(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_vouchers_v1", JSON.stringify(items));
      } catch (e) {}
    }
  };

  const savePointOffers = (items: PointOfferRecord[]) => {
    setPointOffers(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_point_offers_v1", JSON.stringify(items));
      } catch (e) {}
    }
  };

  const savePointRedemptions = (items: PointRedemptionRecord[]) => {
    setPointRedemptions(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_point_redemptions_v1", JSON.stringify(items));
      } catch (e) {}
    }
  };

  // Special Discount Form
  const [spdIsActive, setSpdIsActive] = useState(true);
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

  // Product Discount Form
  const [pddOfferName, setPddOfferName] = useState("");
  const [pddOffice, setPddOffice] = useState("Marinozz");
  const [pddPaymentType, setPddPaymentType] = useState("All");
  const [pddStartTime, setPddStartTime] = useState("01/11/2026 01:00 PM");
  const [pddEndTime, setPddEndTime] = useState("30/11/2026 11:59 PM");
  const [pddRemarks, setPddRemarks] = useState("");

  // Offer Form
  const [offOfferType, setOffOfferType] = useState("BOGO Offer");
  const [offOfferName, setOffOfferName] = useState("");
  const [offOutlet, setOffOutlet] = useState("Marinozz");
  const [offCustomerGroup, setOffCustomerGroup] = useState("All");
  const [offFromDateTime, setOffFromDateTime] = useState("2026-11-01 12:00");
  const [offToDateTime, setOffToDateTime] = useState("2026-11-30 23:59");

  // Vat Discount Form
  const [vatType, setVatType] = useState("Item");
  const [vatOffice, setVatOffice] = useState("Marinozz");
  const [vatStartTime, setVatStartTime] = useState("01/11/2026 01:54 PM");
  const [vatEndTime, setVatEndTime] = useState("30/11/2026 11:59 PM");
  const [vatCategory, setVatCategory] = useState("Food Items");

  // Voucher Form
  const [vchType, setVchType] = useState("Gift Voucher");
  const [vchOutlet, setVchOutlet] = useState("Marinozz");
  const [vchActivationDate, setVchActivationDate] = useState("11/01/2026");
  const [vchExpiryDate, setVchExpiryDate] = useState("11/30/2026");
  const [vchCustomerGroup, setVchCustomerGroup] = useState("All");
  const [vchCustomer, setVchCustomer] = useState("All");
  const [vchCount, setVchCount] = useState("1");
  const [vchMinSaleAmt, setVchMinSaleAmt] = useState("1000");
  const [vchCode, setVchCode] = useState("20Vpot2e");
  const [vchAmount, setVchAmount] = useState("500");

  // Point Offer Form (Image 2)
  const [poOfferName, setPoOfferName] = useState("");
  const [poOffice, setPoOffice] = useState("Marinozz");
  const [poStartDate, setPoStartDate] = useState("11/01/2026");
  const [poEndDate, setPoEndDate] = useState("11/30/2026");
  const [poPerOrderValue, setPoPerOrderValue] = useState("100");
  const [poOfferPoint, setPoOfferPoint] = useState("10");
  const [poPerPointValue, setPoPerPointValue] = useState("1");
  const [poCalculation, setPoCalculation] = useState("Standard");
  const [poRemarks, setPoRemarks] = useState("");
  const [poCap, setPoCap] = useState("500");
  const [poExcludedItem, setPoExcludedItem] = useState("");
  const [poExcludedItems, setPoExcludedItems] = useState<Array<{ id: number; barcode: string; name: string }>>([]);

  // Point Redemption Form (Image 4)
  const [prRedemptionType, setPrRedemptionType] = useState("Cash Voucher");
  const [prOffice, setPrOffice] = useState("Marinozz");
  const [prWarehouse, setPrWarehouse] = useState("Central Warehouse");
  const [prFromDate, setPrFromDate] = useState("11/01/2026");
  const [prToDate, setPrToDate] = useState("11/30/2026");
  const [prMinPoint, setPrMinPoint] = useState("50");
  const [prMaxPoint, setPrMaxPoint] = useState("500");
  const [prRedeemPercentage, setPrRedeemPercentage] = useState("100");
  const [prCustomerGroup, setPrCustomerGroup] = useState("All");
  const [prCustomer, setPrCustomer] = useState("All");

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
  // VIEW: Create Point Offer (Image 2)
  // -------------------------------------------------------------
  if (isCreatingPointOffer) {
    const handleSavePointOffer = (e: React.FormEvent) => {
      e.preventDefault();
      if (!poOfferName.trim()) {
        showToast("Offer Name is required!");
        return;
      }
      const newPO: PointOfferRecord = {
        id: `po-${Date.now()}`,
        offerName: poOfferName.trim(),
        outletName: poOffice,
        paymentMethod: "All Payment Methods",
        timePeriod: `${poStartDate} - ${poEndDate}`,
        createdBy: "Admin User",
        createdDate: new Date().toISOString().slice(0, 10),
        status: "Active",
      };
      savePointOffers([newPO, ...pointOffers]);
      showToast(`Point Offer "${newPO.offerName}" created successfully`);
      setIsCreatingPointOffer(false);
    };

    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingPointOffer(false)}
              className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Create Point Offer
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSavePointOffer}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        </div>

        {/* Card 1: Point Offer Setup */}
        <form onSubmit={handleSavePointOffer} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-5">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Point Offer Setup
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
                value={poOfferName}
                onChange={(e) => setPoOfferName(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office <span className="text-red-500">*</span>
              </label>
              <select
                value={poOffice}
                onChange={(e) => setPoOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="mm/dd/yyyy"
                  value={poStartDate}
                  onChange={(e) => setPoStartDate(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="mm/dd/yyyy"
                  value={poEndDate}
                  onChange={(e) => setPoEndDate(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Per Order Value <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                placeholder="Per Order Value"
                value={poPerOrderValue}
                onChange={(e) => setPoPerOrderValue(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Offer Point <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                placeholder="Offer Point"
                value={poOfferPoint}
                onChange={(e) => setPoOfferPoint(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Per Point Value <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                placeholder="Per Point Value"
                value={poPerPointValue}
                onChange={(e) => setPoPerPointValue(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Calculation <span className="text-red-500">*</span>
              </label>
              <select
                value={poCalculation}
                onChange={(e) => setPoCalculation(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Standard">Standard Calculation</option>
                <option value="Pro-Rata">Pro-Rata</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Remarks
              </label>
              <input
                type="text"
                placeholder="Remarks"
                value={poRemarks}
                onChange={(e) => setPoRemarks(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Point Redemption Cap
              </label>
              <input
                type="number"
                placeholder="Point Redemption Cap"
                value={poCap}
                onChange={(e) => setPoCap(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>
          </div>
        </form>

        {/* Card 2: Point Excluded Item */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Point Excluded Item
          </h3>

          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-80">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Item <span className="text-red-500">*</span>
              </label>
              <select
                value={poExcludedItem}
                onChange={(e) => setPoExcludedItem(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="">Select/Search Item (min 3 letters)</option>
                <option value="Mineral Water 500ml">Mineral Water 500ml</option>
                <option value="Catering Service Fee">Catering Service Fee</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                if (poExcludedItem) {
                  setPoExcludedItems([...poExcludedItems, { id: Date.now(), barcode: "BR-EXC-01", name: poExcludedItem }]);
                  showToast("Excluded item added");
                }
              }}
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              Add
            </button>
          </div>

          <div className="rounded border border-slate-200 dark:border-slate-800 overflow-x-auto mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5 w-16">SL</th>
                  <th className="p-2.5">Barcode</th>
                  <th className="p-2.5">Item Name</th>
                  <th className="p-2.5 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {poExcludedItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="p-2.5 text-slate-500">{idx + 1}</td>
                    <td className="p-2.5 font-mono">{item.barcode}</td>
                    <td className="p-2.5 font-medium">{item.name}</td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setPoExcludedItems(poExcludedItems.filter((x) => x.id !== item.id))}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="size-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
                {poExcludedItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6">
                      {renderBridgeOneEmptyState("No Excluded Items Added")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
  // VIEW: Create Point Redemption (Image 4)
  // -------------------------------------------------------------
  if (isCreatingPointRedemption) {
    const handleSavePointRedemption = (e: React.FormEvent) => {
      e.preventDefault();
      const newPR: PointRedemptionRecord = {
        id: `pr-${Date.now()}`,
        createdDate: new Date().toISOString().slice(0, 10),
        code: `RED-PT-${Math.floor(100 + Math.random() * 900)}`,
        redemptionType: prRedemptionType,
        voucherName: `${prRedemptionType} Voucher`,
        totalCustomer: 10,
        totalGainedPoint: Number(prMaxPoint) || 100,
        totalIssuedPoint: Number(prMinPoint) || 50,
        totalAmount: Number(prMaxPoint) || 100,
        status: "Active",
      };
      savePointRedemptions([newPR, ...pointRedemptions]);
      showToast("Point Redemption rule created successfully");
      setIsCreatingPointRedemption(false);
    };

    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingPointRedemption(false)}
              className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Create Point Redemption
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSavePointRedemption}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        </div>

        {/* Card Form (Image 4) */}
        <form onSubmit={handleSavePointRedemption} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Redemption Type <span className="text-red-500">*</span>
              </label>
              <select
                value={prRedemptionType}
                onChange={(e) => setPrRedemptionType(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Cash Voucher">Cash Voucher</option>
                <option value="Direct Discount">Direct Discount</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office <span className="text-red-500">*</span>
              </label>
              <select
                value={prOffice}
                onChange={(e) => setPrOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                value={prWarehouse}
                onChange={(e) => setPrWarehouse(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="Central Warehouse">Central Warehouse</option>
                <option value="Marinozz Kitchen">Marinozz Kitchen</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                From Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={prFromDate}
                  onChange={(e) => setPrFromDate(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                To Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={prToDate}
                  onChange={(e) => setPrToDate(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Min Point <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={prMinPoint}
                onChange={(e) => setPrMinPoint(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Max Point <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={prMaxPoint}
                onChange={(e) => setPrMaxPoint(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Redeem Percentage (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={prRedeemPercentage}
                onChange={(e) => setPrRedeemPercentage(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer Group <span className="text-red-500">*</span>
              </label>
              <select
                value={prCustomerGroup}
                onChange={(e) => setPrCustomerGroup(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="All">Select Customer Group</option>
                <option value="VIP">VIP</option>
                <option value="Regular">Regular</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Customer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={prCustomer}
                    onChange={(e) => setPrCustomer(e.target.value)}
                    className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                  >
                    <option value="All">Select/Search Customer (min 3 lett...</option>
                    <option value="Tanvir Ahmed">Tanvir Ahmed</option>
                    <option value="Sadia Islam">Sadia Islam</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => showToast("Customer target added")}
                  className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
                >
                  Add
                </button>
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
      {/* TAB 1: SPECIAL DISCOUNT */}
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
                  <th className="p-3 font-semibold text-center">Status</th>
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
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {row.status}
                      </span>
                    </td>
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TAB 2: PRODUCT DISCOUNT */}
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
      {/* TAB 3: OFFER */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "OFFER" && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCreatingOffer(true)}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
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
      {/* TAB 4: VAT DISCOUNT */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "VAT_DISCOUNT" && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCreatingVatDiscount(true)}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

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
      {/* TAB 5: VOUCHER GENERATE */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "VOUCHER_GENERATE" && (
        <div className="space-y-4">
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
              onClick={() => setIsCreatingVoucher(true)}
              className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Create</span>
            </button>
          </div>

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
                  <th className="p-3 font-semibold">Amount</th>
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
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{row.amount} ৳</td>
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
      {/* TAB 6: POINT OFFER (Image 1 & 2) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "POINT_OFFER" && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCreatingPointOffer(true)}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          {/* Filter Bar (Image 1) */}
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

            <button
              type="button"
              onClick={() => showToast("Filtered point offers")}
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              View
            </button>
          </div>

          {/* Table (Image 1) */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">SL</th>
                  <th className="p-3 font-semibold">Offer Name</th>
                  <th className="p-3 font-semibold">Outlet Name</th>
                  <th className="p-3 font-semibold">Payment Method</th>
                  <th className="p-3 font-semibold">Time Period</th>
                  <th className="p-3 font-semibold">Created By</th>
                  <th className="p-3 font-semibold">Created Date</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pointOffers.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{row.offerName}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.outletName}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.paymentMethod}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.timePeriod}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.createdBy}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.createdDate}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = pointOffers.filter((x) => x.id !== row.id);
                          savePointOffers(updated);
                          showToast("Point offer removed");
                        }}
                        className="p-1 text-rose-500 hover:text-rose-700 transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {pointOffers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8">
                      {renderBridgeOneEmptyState("No Point Offers Found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TAB 7: POINT REDEMPTION (Image 3 & 4) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "POINT_REDEMPTION" && (
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
              onClick={() => setIsCreatingPointRedemption(true)}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          {/* Filter Bar (Image 3) */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-56">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office
              </label>
              <select className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs">
                <option value="Marinozz">Marinozz</option>
                <option value="All">All Offices</option>
              </select>
            </div>

            <div className="w-48">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Type
              </label>
              <select className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs">
                <option value="All">All</option>
                <option value="Cash Voucher">Cash Voucher</option>
                <option value="Direct Discount">Direct Discount</option>
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
              onClick={() => showToast("Filtered point redemptions")}
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              View
            </button>
          </div>

          {/* Table (Image 3) */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">SL</th>
                  <th className="p-3 font-semibold">Created Date</th>
                  <th className="p-3 font-semibold">Code</th>
                  <th className="p-3 font-semibold">Redemption Type</th>
                  <th className="p-3 font-semibold">Voucher Name</th>
                  <th className="p-3 font-semibold">Total Customer</th>
                  <th className="p-3 font-semibold">Total Gained Point</th>
                  <th className="p-3 font-semibold">Total Issued Point</th>
                  <th className="p-3 font-semibold">Total Amount</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pointRedemptions.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.createdDate}</td>
                    <td className="p-3 font-mono font-bold text-blue-600">{row.code}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{row.redemptionType}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{row.voucherName}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.totalCustomer}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.totalGainedPoint}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{row.totalIssuedPoint}</td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{row.totalAmount} ৳</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = pointRedemptions.filter((x) => x.id !== row.id);
                          savePointRedemptions(updated);
                          showToast("Point redemption removed");
                        }}
                        className="p-1 text-rose-500 hover:text-rose-700 transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {pointRedemptions.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8">
                      {renderBridgeOneEmptyState("No Point Redemptions Found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
