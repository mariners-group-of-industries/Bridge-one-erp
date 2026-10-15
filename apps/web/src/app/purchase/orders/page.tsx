"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Eye,
  Printer,
  Pencil,
  X,
  RotateCcw,
  Search,
  Download,
  Check,
  ShoppingCart,
  Calendar,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { toast } from "@/components/ui/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  PurchaseOrder,
  Office,
  Warehouse,
  Supplier,
  Item,
  PurchaseRequisition,
  CreatePurchaseOrderInput,
} from "@bridgeone/contracts";
import { calculateDocumentTotals } from "@bridgeone/purchase-calculations";

// -------------------------------------------------------------
// Seed fallback datasets matching exact Managerium screenshots
// -------------------------------------------------------------

const seedLocalPOs = [
  {
    id: "po-mg-01",
    poNumber: "PO-MG261000002",
    orderDate: "08-10-2026",
    expectedDeliveryDate: "10-10-2026",
    referenceNumber: "N/A",
    officeId: "off-04",
    officeName: "MG Sirajganj Factory",
    projectCostCenter: "-",
    supplierId: "sup-m01",
    supplierName: "M/S SP Paul Mills",
    createdBy: "MD. Mizanur Rahman Ratan",
    totalAmount: 56250.0,
    subtotal: 56250.0,
    totalDiscount: 0,
    totalTax: 0,
    shippingFee: 0,
    eta: "10-10-2026",
    status: "PENDING",
    reviewComment: "",
    paymentTerms: "Net 30 Days",
    deliveryTerms: "FOB Factory Depot",
    items: [
      {
        itemId: "it-sp-01",
        itemCode: "RM-00520",
        itemName: "Anchor Root Dal (Grade A)",
        uom: "KG",
        orderedQuantity: 750,
        receivedQuantity: 0,
        unitPrice: 75,
        discountPercentage: 0,
        taxPercentage: 0,
        lineTotal: 56250.0,
      },
    ],
  },
  {
    id: "po-mg-02",
    poNumber: "PO-MG261000001",
    orderDate: "07-10-2026",
    expectedDeliveryDate: "12-10-2026",
    referenceNumber: "N/A",
    officeId: "off-04",
    officeName: "MG Sirajganj Factory",
    projectCostCenter: "-",
    supplierId: "sup-m02",
    supplierName: "ROYAL PRINT PACK",
    createdBy: "MD. Mizanur Rahman Ratan",
    totalAmount: 259000.0,
    subtotal: 259000.0,
    totalDiscount: 0,
    totalTax: 0,
    shippingFee: 0,
    eta: "12-10-2026",
    status: "PENDING",
    reviewComment: "",
    paymentTerms: "Net 15 Days",
    deliveryTerms: "Delivered at Factory",
    items: [
      {
        itemId: "it-rpp-01",
        itemCode: "PM-00067",
        itemName: "Peanut Bar-B-Q Chanachur 140gm (Foil)",
        uom: "KG",
        orderedQuantity: 1000,
        receivedQuantity: 0,
        unitPrice: 259,
        discountPercentage: 0,
        taxPercentage: 0,
        lineTotal: 259000.0,
      },
    ],
  },
  {
    id: "po-mg-03",
    poNumber: "PO-MG261000000",
    orderDate: "01-10-2026",
    expectedDeliveryDate: "04-10-2026",
    referenceNumber: "N/A",
    officeId: "off-04",
    officeName: "MG Sirajganj Factory",
    projectCostCenter: "-",
    supplierId: "sup-m03",
    supplierName: "Perfect Masala Store",
    createdBy: "MD. Mizanur Rahman Ratan",
    totalAmount: 4060.0,
    subtotal: 4060.0,
    totalDiscount: 0,
    totalTax: 0,
    shippingFee: 0,
    eta: "04-10-2026",
    status: "IN_PROGRESS",
    reviewComment: "",
    paymentTerms: "Immediate Cash",
    deliveryTerms: "Local Delivery",
    items: [
      {
        itemId: "it-pms-01",
        itemCode: "RM-00569",
        itemName: "Bit Salt Powder Special",
        uom: "KG",
        orderedQuantity: 50,
        receivedQuantity: 20,
        unitPrice: 81.2,
        discountPercentage: 0,
        taxPercentage: 0,
        lineTotal: 4060.0,
      },
    ],
  },
  {
    id: "po-mg-04",
    poNumber: "PO-MG260900017",
    orderDate: "29-09-2026",
    expectedDeliveryDate: "04-10-2026",
    referenceNumber: "N/A",
    officeId: "off-04",
    officeName: "MG Sirajganj Factory",
    projectCostCenter: "-",
    supplierId: "sup-m04",
    supplierName: "ACES Inc",
    createdBy: "MD. Mizanur Rahman Ratan",
    totalAmount: 215000.0,
    subtotal: 215000.0,
    totalDiscount: 0,
    totalTax: 0,
    shippingFee: 0,
    eta: "04-10-2026",
    status: "IN_PROGRESS",
    reviewComment: "",
    paymentTerms: "Net 30 Days",
    deliveryTerms: "FOB Factory",
    items: [
      {
        itemId: "it-ace-01",
        itemCode: "PM-00165",
        itemName: "700gm Cookies Jar (Food Grade)",
        uom: "PCS",
        orderedQuantity: 2000,
        receivedQuantity: 1000,
        unitPrice: 107.5,
        discountPercentage: 0,
        taxPercentage: 0,
        lineTotal: 215000.0,
      },
    ],
  },
  {
    id: "po-mg-05",
    poNumber: "PO-MG260900016",
    orderDate: "26-09-2026",
    expectedDeliveryDate: "26-09-2026",
    referenceNumber: "N/A",
    officeId: "off-04",
    officeName: "MG Sirajganj Factory",
    projectCostCenter: "-",
    supplierId: "sup-m05",
    supplierName: "M/S Vali Traders",
    createdBy: "MD. Mizanur Rahman Ratan",
    totalAmount: 271979.6,
    subtotal: 271979.6,
    totalDiscount: 0,
    totalTax: 0,
    shippingFee: 0,
    eta: "26-09-2026",
    status: "IN_PROGRESS",
    reviewComment: "",
    paymentTerms: "Net 15 Days",
    deliveryTerms: "Delivered at Site",
    items: [
      {
        itemId: "it-val-01",
        itemCode: "RM-00518",
        itemName: "Refined Palm Oil Grade A",
        uom: "KG",
        orderedQuantity: 2775,
        receivedQuantity: 1500,
        unitPrice: 98.01,
        discountPercentage: 0,
        taxPercentage: 0,
        lineTotal: 271979.6,
      },
    ],
  },
  {
    id: "po-mg-06",
    poNumber: "PO-MG260900015",
    orderDate: "26-09-2026",
    expectedDeliveryDate: "26-09-2026",
    referenceNumber: "N/A",
    officeId: "off-04",
    officeName: "MG Sirajganj Factory",
    projectCostCenter: "-",
    supplierId: "sup-m06",
    supplierName: "Burhan Perfumery House",
    createdBy: "MD. Mizanur Rahman Ratan",
    totalAmount: 21000.0,
    subtotal: 21000.0,
    totalDiscount: 0,
    totalTax: 0,
    shippingFee: 0,
    eta: "26-09-2026",
    status: "IN_PROGRESS",
    reviewComment: "",
    paymentTerms: "Cash on Delivery",
    deliveryTerms: "Factory Depot",
    items: [
      {
        itemId: "it-bur-01",
        itemCode: "RM-00587",
        itemName: "Bar B Q Seasoning Flavor Concentrated",
        uom: "KG",
        orderedQuantity: 200,
        receivedQuantity: 100,
        unitPrice: 105,
        discountPercentage: 0,
        taxPercentage: 0,
        lineTotal: 21000.0,
      },
    ],
  },
  {
    id: "po-mg-07",
    poNumber: "PO-MG260900014",
    orderDate: "23-09-2026",
    expectedDeliveryDate: "27-09-2026",
    referenceNumber: "N/A",
    officeId: "off-04",
    officeName: "MG Sirajganj Factory",
    projectCostCenter: "-",
    supplierId: "sup-m07",
    supplierName: "PACKFIRM LIMITED",
    createdBy: "MD. Mizanur Rahman Ratan",
    totalAmount: 265000.0,
    subtotal: 265000.0,
    totalDiscount: 0,
    totalTax: 0,
    shippingFee: 0,
    eta: "27-09-2026",
    status: "IN_PROGRESS",
    reviewComment: "",
    paymentTerms: "Net 30 Days",
    deliveryTerms: "FOB Factory",
    items: [
      {
        itemId: "it-pkf-01",
        itemCode: "PM-00102",
        itemName: "Outer Woven bag (62\"X34\") Heavy Ply",
        uom: "KG",
        orderedQuantity: 1000,
        receivedQuantity: 600,
        unitPrice: 265,
        discountPercentage: 0,
        taxPercentage: 0,
        lineTotal: 265000.0,
      },
    ],
  },
  {
    id: "po-mg-08",
    poNumber: "PO-MG260900013",
    orderDate: "16-09-2026",
    expectedDeliveryDate: "16-09-2026",
    referenceNumber: "N/A",
    officeId: "off-04",
    officeName: "MG Sirajganj Factory",
    projectCostCenter: "-",
    supplierId: "sup-m08",
    supplierName: "AJ Overseas Company Ltd",
    createdBy: "MD. Mizanur Rahman Ratan",
    totalAmount: 10875.0,
    subtotal: 10875.0,
    totalDiscount: 0,
    totalTax: 0,
    shippingFee: 0,
    eta: "16-09-2026",
    status: "COMPLETED",
    reviewComment: "Inspected and accepted",
    paymentTerms: "Immediate",
    deliveryTerms: "Ex-Works",
    items: [
      {
        itemId: "it-ajo-01",
        itemCode: "PM-00160",
        itemName: "Date coding Ink (Fast Dry)",
        uom: "PCS",
        orderedQuantity: 5,
        receivedQuantity: 5,
        unitPrice: 2175,
        discountPercentage: 0,
        taxPercentage: 0,
        lineTotal: 10875.0,
      },
    ],
  },
  {
    id: "po-mg-09",
    poNumber: "PO-MG260900012",
    orderDate: "14-09-2026",
    expectedDeliveryDate: "17-09-2026",
    referenceNumber: "N/A",
    officeId: "off-04",
    officeName: "MG Sirajganj Factory",
    projectCostCenter: "-",
    supplierId: "sup-m09",
    supplierName: "M/S Sarkar Traders",
    createdBy: "MD. Mizanur Rahman Ratan",
    totalAmount: 254840.0,
    subtotal: 254840.0,
    totalDiscount: 0,
    totalTax: 0,
    shippingFee: 0,
    eta: "17-09-2026",
    status: "PARTIALLY_RECEIVED",
    reviewComment: "Partial lot delivered",
    paymentTerms: "Net 30 Days",
    deliveryTerms: "Delivered at Factory",
    items: [
      {
        itemId: "it-sar-01",
        itemCode: "RM-00538",
        itemName: "Wheat Flour / Maida A Grade",
        uom: "KG",
        orderedQuantity: 4000,
        receivedQuantity: 2500,
        unitPrice: 63.71,
        discountPercentage: 0,
        taxPercentage: 0,
        lineTotal: 254840.0,
      },
    ],
  },
  {
    id: "po-mg-10",
    poNumber: "PO-MG260900008",
    orderDate: "10-09-2026",
    expectedDeliveryDate: "10-09-2026",
    referenceNumber: "N/A",
    officeId: "off-04",
    officeName: "MG Sirajganj Factory",
    projectCostCenter: "-",
    supplierId: "sup-m10",
    supplierName: "Anhar Traders",
    createdBy: "MD. Mizanur Rahman Ratan",
    totalAmount: 8950.0,
    subtotal: 8950.0,
    totalDiscount: 0,
    totalTax: 0,
    shippingFee: 0,
    eta: "10-09-2026",
    status: "COMPLETED",
    reviewComment: "Finished receiving",
    paymentTerms: "Net 7 Days",
    deliveryTerms: "Factory Floor",
    items: [
      {
        itemId: "it-anh-01",
        itemCode: "RM-00546",
        itemName: "Black Cumin Premium Seed",
        uom: "KG",
        orderedQuantity: 25,
        receivedQuantity: 25,
        unitPrice: 358,
        discountPercentage: 0,
        taxPercentage: 0,
        lineTotal: 8950.0,
      },
    ],
  },
];

// Screenshot 2: Requisition Summary items dataset
const seedRequisitionSummaryItems = [
  { itemCode: "PM-00067", itemName: "Peanut Bar-B-Q Chanachur 140gm (Foil)", category: "Foil", subCategory: "", uom: "KG", quantity: 1000.0, currentStock: 216.5 },
  { itemCode: "PM-00070", itemName: "Marine Biryani Chanachur 12gm (Foil)", category: "Foil", subCategory: "", uom: "KG", quantity: 1000.0, currentStock: 278.06 },
  { itemCode: "PM-00071", itemName: "Peanut Badam Jhal Muri 25gm (Foil)", category: "Foil", subCategory: "", uom: "KG", quantity: 1000.0, currentStock: 121.92 },
  { itemCode: "PM-00061", itemName: "Peanut Dal Vaja 12 gm (Foil)", category: "Foil", subCategory: "", uom: "KG", quantity: 1000.0, currentStock: 104.31 },
  { itemCode: "PM-00067", itemName: "Marine Chicken Noodles 120/150gm (Foil)", category: "Foil", subCategory: "", uom: "KG", quantity: 1500.0, currentStock: 102.61 },
  { itemCode: "PM-00093", itemName: "Potato Chips Inner Pouch (29\"X19\")", category: "Pouch", subCategory: "", uom: "KG", quantity: 200.0, currentStock: 167.26 },
  { itemCode: "PM-00094", itemName: "Jhal Muri Inner Pouch (27\"X18\")", category: "Pouch", subCategory: "", uom: "KG", quantity: 150.0, currentStock: 111.48 },
  { itemCode: "PM-00095", itemName: "Inner Pouch (15\"X16\")", category: "Pouch", subCategory: "", uom: "KG", quantity: 300.0, currentStock: 188.13 },
  { itemCode: "PM-00102", itemName: "Outer Woven bag (62\"X34\")", category: "Bag", subCategory: "", uom: "KG", quantity: 200.0, currentStock: 156.07 },
  { itemCode: "PM-00160", itemName: "Date coding Ink", category: "Ink", subCategory: "", uom: "PCS", quantity: 5.0, currentStock: 2.0 },
  { itemCode: "PM-00163", itemName: "Solution", category: "Solution", subCategory: "", uom: "PCS", quantity: 20.0, currentStock: 9.0 },
  { itemCode: "PM-00164", itemName: "Makeup", category: "Makeup", subCategory: "", uom: "PCS", quantity: 15.0, currentStock: 19.0 },
  { itemCode: "PM-00165", itemName: "700gm Cookies Jar", category: "Jar", subCategory: "", uom: "PCS", quantity: 2000.0, currentStock: 784.4 },
  { itemCode: "PM-00166", itemName: "700gm Cookies Jar Cup", category: "Cup", subCategory: "", uom: "PCS", quantity: 8000.0, currentStock: 1506.0 },
  { itemCode: "PM-00167", itemName: "550gm Cookies Jar", category: "Jar", subCategory: "", uom: "PCS", quantity: 10000.0, currentStock: 1442.02 },
  { itemCode: "PM-00168", itemName: "550gm Cookies Jar Cap", category: "Cap", subCategory: "", uom: "PCS", quantity: 16000.0, currentStock: 551.62 },
  { itemCode: "RM-00518", itemName: "Palm Oil", category: "Oil", subCategory: "", uom: "KG", quantity: 2775.0, currentStock: 327.84 },
  { itemCode: "RM-00520", itemName: "Anchor Root Dal", category: "Dal", subCategory: "", uom: "KG", quantity: 4000.0, currentStock: 894.54 },
  { itemCode: "RM-00523", itemName: "Salt", category: "Salt", subCategory: "", uom: "KG", quantity: 300.0, currentStock: 14.52 },
  { itemCode: "RM-00524", itemName: "Flattened Rice", category: "Rice", subCategory: "", uom: "KG", quantity: 2000.0, currentStock: 164.44 },
  { itemCode: "RM-00525", itemName: "Peanut With Skin", category: "Peanut", subCategory: "", uom: "KG", quantity: 2500.0, currentStock: 24.39 },
  { itemCode: "RM-00529", itemName: "Potato Pellet", category: "Potato", subCategory: "", uom: "KG", quantity: 4000.0, currentStock: 1025.37 },
  { itemCode: "RM-00530", itemName: "Sodium Bi Carbonate (SBC)", category: "SBC", subCategory: "", uom: "KG", quantity: 25.0, currentStock: 56.68 },
  { itemCode: "RM-00535", itemName: "Yeast", category: "Yeast", subCategory: "", uom: "KG", quantity: 25.0, currentStock: 7.1 },
  { itemCode: "RM-00538", itemName: "Wheat Flour/Maida A Grade", category: "Wheat Flour/Maida", subCategory: "", uom: "KG", quantity: 4000.0, currentStock: 1308.8 },
  { itemCode: "RM-00540", itemName: "Mug Dal", category: "Dal", subCategory: "", uom: "KG", quantity: 4000.0, currentStock: 8.02 },
  { itemCode: "RM-00544", itemName: "Cumin Powder", category: "Powder", subCategory: "", uom: "KG", quantity: 50.0, currentStock: 21.94 },
  { itemCode: "RM-00546", itemName: "Black Cumin", category: "Cumin", subCategory: "", uom: "KG", quantity: 25.0, currentStock: 6.65 },
  { itemCode: "RM-00549", itemName: "Monosodium Glutamate (MSG)", category: "MSG", subCategory: "", uom: "KG", quantity: 100.0, currentStock: 106.04 },
  { itemCode: "RM-00562", itemName: "Cinnamon Powder", category: "Powder", subCategory: "", uom: "KG", quantity: 150.0, currentStock: 0.2 },
  { itemCode: "RM-00569", itemName: "Bit Salt Powder", category: "Powder", subCategory: "", uom: "KG", quantity: 50.0, currentStock: 64.65 },
  { itemCode: "RM-00587", itemName: "Bar B Q Seasoning", category: "Seasoning", subCategory: "", uom: "KG", quantity: 200.0, currentStock: 56.16 },
];

// Screenshot 3: Purchase Method requisitions dataset
const seedPurchaseMethodReqs = [
  {
    id: "pmr-01",
    requisitionCode: "PR-MG261000010",
    date: "04-10-2026",
    userType: "department",
    user: "Maintenance",
    buyerName: "N/A",
    buyerOffice: "N/A",
    method: "Purchase Order Method",
    budget: 0.0,
    createdBy: "MD. Helal Uddin",
    remarks: "-",
    status: "Approved",
  },
  {
    id: "pmr-02",
    requisitionCode: "PR-MG261000007",
    date: "03-10-2026",
    userType: "department",
    user: "Store (Materials)",
    buyerName: "N/A",
    buyerOffice: "N/A",
    method: "Purchase Order Method",
    budget: 230000.0,
    createdBy: "MD. MOSHIUR RAHMAN",
    remarks: "M/S RP Dal Mills",
    status: "Approved",
  },
  {
    id: "pmr-03",
    requisitionCode: "PR-MG261000006",
    date: "03-10-2026",
    userType: "department",
    user: "Store (Materials)",
    buyerName: "N/A",
    buyerOffice: "N/A",
    method: "Purchase Order Method",
    budget: 118000.0,
    createdBy: "MD. MOSHIUR RAHMAN",
    remarks: "M/S Junum Auto Chira & Rice Mill",
    status: "Approved",
  },
  {
    id: "pmr-04",
    requisitionCode: "PR-MG261000005",
    date: "03-10-2026",
    userType: "department",
    user: "Store (Materials)",
    buyerName: "N/A",
    buyerOffice: "N/A",
    method: "Purchase Order Method",
    budget: 467500.0,
    createdBy: "MD. MOSHIUR RAHMAN",
    remarks: "M/S Takowa Store",
    status: "Approved",
  },
  {
    id: "pmr-05",
    requisitionCode: "PR-MG261000004",
    date: "03-10-2026",
    userType: "Employee",
    user: "MD. MOSHIUR RAHMAN",
    buyerName: "N/A",
    buyerOffice: "N/A",
    method: "Purchase Order Method",
    budget: 343500.0,
    createdBy: "MD. MOSHIUR RAHMAN",
    remarks: "Fitcon Industries Ltd",
    status: "Approved",
  },
  {
    id: "pmr-06",
    requisitionCode: "PR-MG261000003",
    date: "03-10-2026",
    userType: "Employee",
    user: "MD. MOSHIUR RAHMAN",
    buyerName: "N/A",
    buyerOffice: "MG Sirajganj Factory",
    method: "Purchase Order Method",
    budget: 10000.0,
    createdBy: "MD. MOSHIUR RAHMAN",
    remarks: "Abir Trade International",
    status: "Approved",
  },
  {
    id: "pmr-07",
    requisitionCode: "PR-MG260900019",
    date: "27-09-2026",
    userType: "department",
    user: "Maintenance",
    buyerName: "N/A",
    buyerOffice: "N/A",
    method: "Purchase Order Method",
    budget: 0.0,
    createdBy: "MD. Helal Uddin",
    remarks: "-",
    status: "Approved",
  },
  {
    id: "pmr-08",
    requisitionCode: "PR-MG260900004",
    date: "22-09-2026",
    userType: "Employee",
    user: "MD. MOSHIUR RAHMAN",
    buyerName: "N/A",
    buyerOffice: "N/A",
    method: "Purchase Order Method",
    budget: 0.0,
    createdBy: "MD. MOSHIUR RAHMAN",
    remarks: "-",
    status: "Approved",
  },
  {
    id: "pmr-09",
    requisitionCode: "PR-MG260900003",
    date: "22-09-2026",
    userType: "Employee",
    user: "MD. MOSHIUR RAHMAN",
    buyerName: "N/A",
    buyerOffice: "N/A",
    method: "Purchase Order Method",
    budget: 0.0,
    createdBy: "MD. MOSHIUR RAHMAN",
    remarks: "-",
    status: "Approved",
  },
  {
    id: "pmr-10",
    requisitionCode: "PR-MG260900002",
    date: "10-09-2026",
    userType: "department",
    user: "Store (Materials)",
    buyerName: "N/A",
    buyerOffice: "N/A",
    method: "Purchase Order Method",
    budget: 0.0,
    createdBy: "MD. MOSHIUR RAHMAN",
    remarks: "-",
    status: "Approved",
  },
  {
    id: "pmr-11",
    requisitionCode: "PR-MG260900001",
    date: "10-09-2026",
    userType: "department",
    user: "Store (Materials)",
    buyerName: "N/A",
    buyerOffice: "N/A",
    method: "Purchase Order Method",
    budget: 0.0,
    createdBy: "MD. MOSHIUR RAHMAN",
    remarks: "-",
    status: "Approved",
  },
];

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();

  // Active Tab: LOCAL_PO | REQUISITION_SUMMARY | PURCHASE_METHOD
  const [activeTab, setActiveTab] = useState<"LOCAL_PO" | "REQUISITION_SUMMARY" | "PURCHASE_METHOD">("LOCAL_PO");

  // Top header search
  const [search, setSearch] = useState("");

  // Filters for Tab 1: LOCAL PO
  const [selectedOffice, setSelectedOffice] = useState("ALL");
  const [selectedFilterBy, setSelectedFilterBy] = useState("ALL");
  const [selectedCreatedBy, setSelectedCreatedBy] = useState("ALL");
  const [selectedSupplier, setSelectedSupplier] = useState("ALL");
  const [fromDate, setFromDate] = useState("2026-09-10");
  const [toDate, setToDate] = useState("2026-11-10");

  // Filters for Tab 2: REQUISITION SUMMARY
  const [sumOffice, setSumOffice] = useState("ALL");
  const [sumFromDate, setSumFromDate] = useState("2026-09-10");
  const [sumToDate, setSumToDate] = useState("2026-11-10");

  // Filters for Tab 3: PURCHASE METHOD
  const [pmOffice, setPmOffice] = useState("ALL");
  const [pmWarehouse, setPmWarehouse] = useState("ALL");
  const [pmBuyerName, setPmBuyerName] = useState("");
  const [pmBuyerOffice, setPmBuyerOffice] = useState("ALL");
  const [pmReqType, setPmReqType] = useState("ALL");
  const [pmFromDate, setPmFromDate] = useState("2026-09-10");
  const [pmToDate, setPmToDate] = useState("2026-11-10");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
  const [printPO, setPrintPO] = useState<PurchaseOrder | null>(null);
  const [editPO, setEditPO] = useState<PurchaseOrder | null>(null);
  const [closePO, setClosePO] = useState<PurchaseOrder | null>(null);
  const [closeComment, setCloseComment] = useState("");
  const [reversePO, setReversePO] = useState<PurchaseOrder | null>(null);
  const [reverseComment, setReverseComment] = useState("");

  // Tab 3 Modals
  const [viewReqModal, setViewReqModal] = useState<any | null>(null);
  const [convertReqModal, setConvertReqModal] = useState<any | null>(null);

  // Method select map for Tab 3 interactive rows
  const [rowMethods, setRowMethods] = useState<Record<string, string>>({
    "PR-MG261000010": "Purchase Order Method",
    "PR-MG261000007": "Purchase Order Method",
    "PR-MG261000006": "Purchase Order Method",
    "PR-MG261000005": "Purchase Order Method",
    "PR-MG261000004": "Purchase Order Method",
    "PR-MG261000003": "Purchase Order Method",
    "PR-MG260900019": "Purchase Order Method",
    "PR-MG260900004": "Purchase Order Method",
    "PR-MG260900003": "Purchase Order Method",
    "PR-MG260900002": "Purchase Order Method",
    "PR-MG260900001": "Purchase Order Method",
  });

  // Queries
  const { data: offices } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
  });
  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ["warehouses", selectedOffice],
    queryFn: () => {
      const p = selectedOffice !== "ALL" ? `?officeId=${selectedOffice}` : "";
      return fetchApi(`/master/warehouses${p}`);
    },
  });
  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => fetchApi("/master/suppliers"),
  });
  const { data: itemsCatalog } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: () => fetchApi("/master/items"),
  });
  const { data: approvedReqs } = useQuery<PurchaseRequisition[]>({
    queryKey: ["approvedReqs"],
    queryFn: () => fetchApi("/purchase/requisitions?status=APPROVED"),
  });

  const { data: apiOrders, isLoading, refetch } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchaseOrders", selectedOffice, selectedSupplier, search, fromDate, toDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedOffice !== "ALL") params.append("officeId", selectedOffice);
      if (selectedSupplier !== "ALL") params.append("supplierId", selectedSupplier);
      if (search) params.append("search", search);
      return fetchApi(`/purchase/orders?${params.toString()}`);
    },
  });

  // Combine API orders with seed records from screenshots
  const combinedOrders = useMemo(() => {
    const list = [...(seedLocalPOs as any[])];
    if (apiOrders && apiOrders.length > 0) {
      apiOrders.forEach((o) => {
        if (!list.some((existing) => existing.poNumber === o.poNumber)) {
          list.unshift(o);
        }
      });
    }

    return list.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          item.poNumber?.toLowerCase().includes(q) ||
          item.supplierName?.toLowerCase().includes(q) ||
          item.officeName?.toLowerCase().includes(q) ||
          item.createdBy?.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (selectedOffice !== "ALL") {
        if (item.officeId !== selectedOffice && !item.officeName?.includes(selectedOffice)) return false;
      }
      if (selectedSupplier !== "ALL") {
        if (item.supplierId !== selectedSupplier && !item.supplierName?.toLowerCase().includes(selectedSupplier.toLowerCase())) return false;
      }
      return true;
    });
  }, [apiOrders, search, selectedOffice, selectedSupplier]);

  // Filtered Requisition Summary Items
  const filteredSummaryItems = useMemo(() => {
    return seedRequisitionSummaryItems.filter((it) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        it.itemCode.toLowerCase().includes(q) ||
        it.itemName.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
      );
    });
  }, [search]);

  // Filtered Purchase Method Requisitions
  const filteredPurchaseMethodReqs = useMemo(() => {
    return seedPurchaseMethodReqs.filter((req) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          req.requisitionCode.toLowerCase().includes(q) ||
          req.user.toLowerCase().includes(q) ||
          req.createdBy.toLowerCase().includes(q) ||
          req.remarks.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (pmBuyerOffice !== "ALL" && !req.buyerOffice.toLowerCase().includes(pmBuyerOffice.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [search, pmBuyerOffice]);

  // Create Form State
  const [formSupplierId, setFormSupplierId] = useState("sup-01");
  const [formOfficeId, setFormOfficeId] = useState("off-01");
  const [formWarehouseId, setFormWarehouseId] = useState("wh-01");
  const [formReqId, setFormReqId] = useState("");
  const [formExpectedDate, setFormExpectedDate] = useState("2026-10-25");
  const [formPaymentTerms, setFormPaymentTerms] = useState("Net 30 Days");
  const [formDeliveryTerms, setFormDeliveryTerms] = useState("FOB Warehouse");
  const [formShippingFee, setFormShippingFee] = useState(0);
  const [formProject, setFormProject] = useState("OPS-FACTORY-2026");
  const [formLineItems, setFormLineItems] = useState([
    {
      itemId: "itm-01",
      itemCode: "PM-00067",
      itemName: "Peanut Bar-B-Q Chanachur 140gm (Foil)",
      uom: "KG",
      orderedQuantity: 1000,
      unitPrice: 259,
      discountPercentage: 0,
      taxPercentage: 0,
      lineTotal: 259000,
    },
  ]);

  const handleSelectRequisition = (reqId: string) => {
    setFormReqId(reqId);
    if (!reqId) return;
    const req = approvedReqs?.find((r) => r.id === reqId);
    if (req) {
      setFormOfficeId(req.officeId);
      setFormWarehouseId(req.warehouseId);
      setFormLineItems(
        req.items.map((i) => ({
          itemId: i.itemId,
          itemCode: i.itemCode,
          itemName: i.itemName,
          uom: i.uom,
          orderedQuantity: i.quantity,
          unitPrice: i.estimatedUnitPrice,
          discountPercentage: 0,
          taxPercentage: 0,
          lineTotal: i.quantity * i.estimatedUnitPrice,
        }))
      );
    }
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreatePurchaseOrderInput) =>
      fetchApi("/purchase/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setIsCreateOpen(false);
      toast.success("Local Purchase Order created successfully!", {
        title: "Purchase Order Created",
      });
    },
    onError: (err: any) => {
      toast.error(`Error creating PO: ${err.message}`, {
        title: "Creation Failed",
      });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      companyId: "comp-bridgeone-01",
      supplierId: formSupplierId,
      officeId: formOfficeId,
      warehouseId: formWarehouseId,
      requisitionId: formReqId || undefined,
      orderDate: new Date().toISOString().split("T")[0],
      expectedDeliveryDate: formExpectedDate,
      paymentTerms: formPaymentTerms,
      deliveryTerms: formDeliveryTerms,
      shippingFee: formShippingFee,
      projectCostCenter: formProject,
      items: formLineItems as any,
    });
  };

  // CSV/Excel Export Handler
  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (activeTab === "LOCAL_PO") {
      csvContent += "SL,PO Date,Rece. Date,Reference No,PO No,Office,Project/Outlet/Ref,Supplier,Created By,Amount (BDT),ETA,Status,Review Comment\n";
      combinedOrders.forEach((row, i) => {
        csvContent += `"${i + 1}","${row.orderDate}","${row.expectedDeliveryDate}","${row.referenceNumber || "N/A"}","${row.poNumber}","${row.officeName}","${row.projectCostCenter || "-"}","${row.supplierName}","${row.createdBy}","${row.totalAmount}","${row.eta || "-"}","${row.status}","${row.reviewComment || ""}"\n`;
      });
    } else if (activeTab === "REQUISITION_SUMMARY") {
      csvContent += "SL,Item Code,Item Name,Category,Sub Category,UoM,Quantity,Current Stock\n";
      filteredSummaryItems.forEach((row, i) => {
        csvContent += `"${i + 1}","${row.itemCode}","${row.itemName}","${row.category}","${row.subCategory}","${row.uom}","${row.quantity}","${row.currentStock}"\n`;
      });
    } else {
      csvContent += "SL,Requisition Code,Date,User Type,User,Buyer Name,Buyer Office,Method,Budget,Created By,Remarks,Status\n";
      filteredPurchaseMethodReqs.forEach((row, i) => {
        csvContent += `"${i + 1}","${row.requisitionCode}","${row.date}","${row.userType}","${row.user}","${row.buyerName}","${row.buyerOffice}","${rowMethods[row.requisitionCode] || row.method}","${row.budget}","${row.createdBy}","${row.remarks}","${row.status}"\n`;
      });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BridgeOne_${activeTab}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Convert Requisition from Tab 3 to PO
  const handleConvertToPO = (req: any) => {
    setFormProject(req.remarks || "FACTORY-PROD");
    setFormExpectedDate(new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER (Exact Managerium Layout) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Order</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick search input with search icon on right */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search...."
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Excel Export Button */}
          {(activeTab === "LOCAL_PO" || activeTab === "REQUISITION_SUMMARY") && (
            <button
              type="button"
              onClick={handleExport}
              className="h-9 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
              title="Download Excel Report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          )}

          {/* Create Local Order Button (on LOCAL PO tab) */}
          {activeTab === "LOCAL_PO" && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Local Order</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. NAVIGATION TABS (LOCAL PO | REQUISITION SUMMARY | PURCHASE METHOD) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-8 border-b border-slate-200 mb-3 bg-white px-3 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab("LOCAL_PO")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase ${
            activeTab === "LOCAL_PO"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>LOCAL PO</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("REQUISITION_SUMMARY")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase ${
            activeTab === "REQUISITION_SUMMARY"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>REQUISITION SUMMARY</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PURCHASE_METHOD")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase ${
            activeTab === "PURCHASE_METHOD"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>PURCHASE METHOD</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB 1: LOCAL PO (Screenshot 1) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "LOCAL_PO" && (
        <div className="space-y-3">
          {/* Filter Card */}
          <div className="bg-white rounded border border-slate-200/90 p-3.5 shadow-2xs">
            {/* Row 1: 6 Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
              {/* Office */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Office</label>
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Select Office</option>
                  <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                  {offices?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter By */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Filter By</label>
                <select
                  value={selectedFilterBy}
                  onChange={(e) => setSelectedFilterBy(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Filter By</option>
                  <option value="PO_DATE">PO Date</option>
                  <option value="RECEIVE_DATE">Rece. Date</option>
                  <option value="SUPPLIER">Supplier</option>
                  <option value="STATUS">Status</option>
                </select>
              </div>

              {/* Created By */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Created By</label>
                <select
                  value={selectedCreatedBy}
                  onChange={(e) => setSelectedCreatedBy(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Created By</option>
                  <option value="MD. Mizanur Rahman Ratan">MD. Mizanur Rahman Ratan</option>
                  <option value="Mahfuz Rahman">Mahfuz Rahman</option>
                </select>
              </div>

              {/* Select Supplier */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Supplier</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Select/Search Supplier (min 3 letters)</option>
                  <option value="M/S SP Paul Mills">M/S SP Paul Mills</option>
                  <option value="ROYAL PRINT PACK">ROYAL PRINT PACK</option>
                  <option value="Perfect Masala Store">Perfect Masala Store</option>
                  <option value="ACES Inc">ACES Inc</option>
                  <option value="M/S Vali Traders">M/S Vali Traders</option>
                  <option value="Burhan Perfumery House">Burhan Perfumery House</option>
                  <option value="PACKFIRM LIMITED">PACKFIRM LIMITED</option>
                  <option value="AJ Overseas Company Ltd">AJ Overseas Company Ltd</option>
                  <option value="M/S Sarkar Traders">M/S Sarkar Traders</option>
                  <option value="Anhar Traders">Anhar Traders</option>
                  {suppliers?.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 2: View Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => refetch()}
                className="h-8 px-6 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs uppercase rounded shadow-xs transition"
              >
                View
              </button>
              {(selectedOffice !== "ALL" || selectedSupplier !== "ALL" || search !== "") && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOffice("ALL");
                    setSelectedFilterBy("ALL");
                    setSelectedCreatedBy("ALL");
                    setSelectedSupplier("ALL");
                    setSearch("");
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline ml-2"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Table Container with All Borders */}
          <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="erp-table-container">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th className="w-12 text-center">SL</th>
                    <th className="w-[150px] text-center">Actions</th>
                    <th>PO Date</th>
                    <th>Rece. Date</th>
                    <th>Reference No</th>
                    <th>PO No</th>
                    <th>Office</th>
                    <th>Project/Outlet/Ref.</th>
                    <th>Supplier</th>
                    <th>Created By</th>
                    <th className="text-right">Amount (BDT)</th>
                    <th>ETA Estimated Time of Arrival</th>
                    <th className="text-center">Status</th>
                    <th>Review Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="text-center py-10 text-slate-400">
                        No purchase orders matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    combinedOrders.map((row, idx) => (
                      <tr key={row.id || idx}>
                        {/* 1. SL */}
                        <td className="text-center font-mono text-slate-600">{idx + 1}</td>

                        {/* 2. Actions: Edit, Print, View, Close, Reverse */}
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1.5 text-slate-700">
                            {/* 1. Edit */}
                            <button
                              type="button"
                              onClick={() => setEditPO(row)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-700 transition"
                              title="Edit Purchase Order"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* 2. Print */}
                            <button
                              type="button"
                              onClick={() => setPrintPO(row)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-700 transition"
                              title="Print Purchase Order"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* 3. View */}
                            <button
                              type="button"
                              onClick={() => setViewPO(row)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-700 transition"
                              title="View PO Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* 4. Close */}
                            <button
                              type="button"
                              onClick={() => {
                                setClosePO(row);
                                setCloseComment("");
                              }}
                              className="p-1 rounded hover:bg-rose-100 hover:text-rose-700 text-slate-700 transition"
                              title="Close / Cancel Order"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>

                            {/* 5. Reverse */}
                            <button
                              type="button"
                              onClick={() => {
                                setReversePO(row);
                                setReverseComment("");
                              }}
                              className="p-1 rounded hover:bg-amber-100 hover:text-amber-800 text-slate-700 transition"
                              title="Reverse Order Status"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* 3. PO Date */}
                        <td>{row.orderDate}</td>

                        {/* 4. Rece. Date */}
                        <td>{row.expectedDeliveryDate}</td>

                        {/* 5. Reference No */}
                        <td className="text-slate-500 font-mono text-[11px]">{row.referenceNumber || "N/A"}</td>

                        {/* 6. PO No */}
                        <td>
                          <button
                            type="button"
                            onClick={() => setViewPO(row)}
                            className="font-mono text-sky-700 font-semibold hover:underline"
                          >
                            {row.poNumber}
                          </button>
                        </td>

                        {/* 7. Office */}
                        <td>{row.officeName}</td>

                        {/* 8. Project/Outlet/Ref. */}
                        <td className="text-slate-500">{row.projectCostCenter || "-"}</td>

                        {/* 9. Supplier */}
                        <td className="font-medium text-slate-900">{row.supplierName}</td>

                        {/* 10. Created By */}
                        <td>{row.createdBy}</td>

                        {/* 11. Amount (BDT) */}
                        <td className="text-right font-mono font-bold text-slate-900">
                          {Number(row.totalAmount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        {/* 12. ETA */}
                        <td className="font-mono text-[11px] text-slate-600">{row.eta || "-"}</td>

                        {/* 13. Status */}
                        <td className="text-center">
                          {row.status === "PENDING" ? (
                            <span className="inline-block text-[11px] font-semibold text-amber-600">Pending</span>
                          ) : row.status === "IN_PROGRESS" ? (
                            <span className="inline-block text-[11px] font-semibold text-sky-700">In Progress</span>
                          ) : row.status === "COMPLETED" ? (
                            <span className="inline-block text-[11px] font-semibold text-emerald-700">Completed</span>
                          ) : row.status === "PARTIALLY_RECEIVED" ? (
                            <span className="inline-block text-[11px] font-semibold text-purple-700">Partially Received</span>
                          ) : (
                            <span className="inline-block text-[11px] font-semibold text-slate-600">{row.status}</span>
                          )}
                        </td>

                        {/* 14. Review Comment */}
                        <td className="text-xs text-slate-500 max-w-[150px] truncate">{row.reviewComment || ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-6 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white">
                  <option value="50">50</option>
                  <option value="25">25</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div>
                1-{combinedOrders.length} of {combinedOrders.length}
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <button type="button" disabled className="px-1.5 py-0.5 hover:text-slate-800 disabled:opacity-40">
                  &lt;
                </button>
                <button type="button" disabled className="px-1.5 py-0.5 hover:text-slate-800 disabled:opacity-40">
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB 2: REQUISITION SUMMARY (Screenshot 2) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "REQUISITION_SUMMARY" && (
        <div className="space-y-3">
          {/* Filter Toolbar */}
          <div className="bg-white rounded border border-slate-200/90 p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-end gap-3.5">
              {/* Office */}
              <div className="w-48">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Office</label>
                <select
                  value={sumOffice}
                  onChange={(e) => setSumOffice(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Select Office</option>
                  <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                  {offices?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div className="w-44">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={sumFromDate}
                  onChange={(e) => setSumFromDate(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* To Date */}
              <div className="w-44">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={sumToDate}
                  onChange={(e) => setSumToDate(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* View Button */}
              <div>
                <button
                  type="button"
                  className="h-8 px-6 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs uppercase rounded shadow-xs transition"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          {/* Table Container with All Borders */}
          <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="erp-table-container">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th className="w-12 text-center">SL</th>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Sub Category</th>
                    <th className="text-center">UoM</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Current Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaryItems.map((row, idx) => (
                    <tr key={idx}>
                      <td className="text-center font-mono text-slate-600">{idx + 1}</td>
                      <td className="font-mono text-blue-700 font-semibold">{row.itemCode}</td>
                      <td className="font-semibold text-slate-800">{row.itemName}</td>
                      <td>{row.category}</td>
                      <td className="text-slate-400">{row.subCategory || ""}</td>
                      <td className="text-center font-medium text-slate-700">{row.uom}</td>
                      <td className="text-right font-mono font-bold text-slate-900">
                        {row.quantity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right font-mono font-semibold text-slate-700">
                        {row.currentStock.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-6 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white">
                  <option value="50">50</option>
                  <option value="25">25</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div>
                1-{filteredSummaryItems.length} of {filteredSummaryItems.length}
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <button type="button" disabled className="px-1.5 py-0.5 hover:text-slate-800 disabled:opacity-40">
                  &lt;
                </button>
                <button type="button" disabled className="px-1.5 py-0.5 hover:text-slate-800 disabled:opacity-40">
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB 3: PURCHASE METHOD (Screenshot 3) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "PURCHASE_METHOD" && (
        <div className="space-y-3">
          {/* Filter Toolbar */}
          <div className="bg-white rounded border border-slate-200/90 p-3.5 shadow-2xs">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Office</label>
                <select
                  value={pmOffice}
                  onChange={(e) => setPmOffice(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Select Office</option>
                  <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                  {offices?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Warehouse</label>
                <select
                  value={pmWarehouse}
                  onChange={(e) => setPmWarehouse(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Warehouse</option>
                  <option value="Sirajganj Depot">Sirajganj Depot</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Buyer Name</label>
                <input
                  type="text"
                  value={pmBuyerName}
                  onChange={(e) => setPmBuyerName(e.target.value)}
                  placeholder="Select/Search Buyer Name (min 3 letters)"
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Buyer Office</label>
                <select
                  value={pmBuyerOffice}
                  onChange={(e) => setPmBuyerOffice(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Select Buyer Office</option>
                  <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                  <option value="Corporate Head Office">Corporate Head Office</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Req Type</label>
                <select
                  value={pmReqType}
                  onChange={(e) => setPmReqType(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Req Type</option>
                  <option value="LOCAL">LOCAL</option>
                  <option value="IMPORT">IMPORT</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={pmFromDate}
                  onChange={(e) => setPmFromDate(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 2 */}
            <div className="flex items-center gap-3">
              <div className="w-48">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={pmToDate}
                  onChange={(e) => setPmToDate(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="pt-5">
                <button
                  type="button"
                  className="h-8 px-6 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs uppercase rounded shadow-xs transition"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          {/* Table Container with All Borders */}
          <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="erp-table-container">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th className="w-12 text-center">SL</th>
                    <th className="w-20 text-center">Actions</th>
                    <th>Requisition Code</th>
                    <th>Date</th>
                    <th>User Type</th>
                    <th>User</th>
                    <th>Buyer Name</th>
                    <th>Buyer Office</th>
                    <th>Method</th>
                    <th className="text-right">Budget</th>
                    <th>Created By</th>
                    <th>Remarks</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchaseMethodReqs.map((row, idx) => (
                    <tr key={row.id || idx}>
                      <td className="text-center font-mono text-slate-600">{idx + 1}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-700">
                          {/* 1. View Requisition */}
                          <button
                            type="button"
                            onClick={() => setViewReqModal(row)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-700 transition"
                            title="View Requisition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* 2. Convert to PO */}
                          <button
                            type="button"
                            onClick={() => handleConvertToPO(row)}
                            className="p-1 rounded hover:bg-emerald-100 hover:text-emerald-700 text-slate-700 transition"
                            title="Convert to Purchase Order"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="font-mono text-sky-700 font-semibold">{row.requisitionCode}</td>
                      <td>{row.date}</td>
                      <td className="capitalize text-slate-600">{row.userType}</td>
                      <td className="font-medium text-slate-800">{row.user}</td>
                      <td className="text-slate-500">{row.buyerName}</td>
                      <td className="text-slate-500">{row.buyerOffice}</td>
                      <td>
                        <select
                          value={rowMethods[row.requisitionCode] || row.method}
                          onChange={(e) =>
                            setRowMethods({
                              ...rowMethods,
                              [row.requisitionCode]: e.target.value,
                            })
                          }
                          className="h-7 border border-slate-300 rounded px-2 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="Purchase Order Method">Purchase Order Method</option>
                          <option value="Quotation Method">Quotation Method</option>
                          <option value="Spot Purchase">Spot Purchase</option>
                          <option value="Direct Cash">Direct Cash</option>
                        </select>
                      </td>
                      <td className="text-right font-mono font-bold text-slate-900">
                        {row.budget.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td>{row.createdBy}</td>
                      <td className="text-slate-600 max-w-[160px] truncate">{row.remarks}</td>
                      <td className="text-center font-semibold text-emerald-700">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-6 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white">
                  <option value="50">50</option>
                  <option value="25">25</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div>
                1-{filteredPurchaseMethodReqs.length} of {filteredPurchaseMethodReqs.length}
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <button type="button" disabled className="px-1.5 py-0.5 hover:text-slate-800 disabled:opacity-40">
                  &lt;
                </button>
                <button type="button" disabled className="px-1.5 py-0.5 hover:text-slate-800 disabled:opacity-40">
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. CREATE LOCAL PURCHASE ORDER MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Local Purchase Order"
        subtitle="Issue a legal commercial purchase order to an approved local vendor"
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {/* Link Requisition Header (Optional) */}
          <div className="p-2.5 bg-sky-50/70 border border-sky-200 rounded flex items-center justify-between">
            <span className="font-semibold text-sky-900 text-xs">Link from Approved Requisition:</span>
            <select
              value={formReqId}
              onChange={(e) => handleSelectRequisition(e.target.value)}
              className="border border-sky-300 rounded px-2 py-1 bg-white text-xs max-w-xs"
            >
              <option value="">-- Direct Local PO (No Requisition) --</option>
              {approvedReqs?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.requisitionNumber} - {r.department} ({formatCurrency(r.totalEstimatedAmount)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Supplier / Vendor *</label>
              <select
                value={formSupplierId}
                onChange={(e) => setFormSupplierId(e.target.value)}
                className="w-full border border-slate-200 rounded p-1.5 text-xs bg-white"
                required
              >
                <option value="sup-m01">M/S SP Paul Mills</option>
                <option value="sup-m02">ROYAL PRINT PACK</option>
                <option value="sup-m03">Perfect Masala Store</option>
                <option value="sup-m04">ACES Inc</option>
                <option value="sup-m05">M/S Vali Traders</option>
                <option value="sup-m06">Burhan Perfumery House</option>
                <option value="sup-m07">PACKFIRM LIMITED</option>
                <option value="sup-m08">AJ Overseas Company Ltd</option>
                <option value="sup-m09">M/S Sarkar Traders</option>
                <option value="sup-m10">Anhar Traders</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Issuing Office *</label>
              <select
                value={formOfficeId}
                onChange={(e) => setFormOfficeId(e.target.value)}
                className="w-full border border-slate-200 rounded p-1.5 text-xs bg-white"
                required
              >
                <option value="off-04">MG Sirajganj Factory</option>
                {offices?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Receiving Warehouse *</label>
              <select
                value={formWarehouseId}
                onChange={(e) => setFormWarehouseId(e.target.value)}
                className="w-full border border-slate-200 rounded p-1.5 text-xs bg-white"
                required
              >
                <option value="wh-04">Sirajganj Factory Depot</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Expected Delivery Date *</label>
              <input
                type="date"
                value={formExpectedDate}
                onChange={(e) => setFormExpectedDate(e.target.value)}
                className="w-full border border-slate-200 rounded p-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Payment Terms</label>
              <input
                type="text"
                value={formPaymentTerms}
                onChange={(e) => setFormPaymentTerms(e.target.value)}
                className="w-full border border-slate-200 rounded p-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Delivery Terms</label>
              <input
                type="text"
                value={formDeliveryTerms}
                onChange={(e) => setFormDeliveryTerms(e.target.value)}
                className="w-full border border-slate-200 rounded p-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Project / Cost Center</label>
              <input
                type="text"
                value={formProject}
                onChange={(e) => setFormProject(e.target.value)}
                className="w-full border border-slate-200 rounded p-1.5 text-xs"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Purchase Order Line Items</h4>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 w-16">UOM</th>
                    <th className="p-2 w-20">Qty</th>
                    <th className="p-2 w-24">Unit Price</th>
                    <th className="p-2 w-16">Disc %</th>
                    <th className="p-2 w-16">Tax %</th>
                    <th className="p-2 w-28 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formLineItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) => {
                            const u = [...formLineItems];
                            u[idx].itemName = e.target.value;
                            setFormLineItems(u);
                          }}
                          className="w-full border border-slate-200 rounded p-1 text-xs"
                        />
                      </td>
                      <td className="p-2 text-slate-600 font-mono">{item.uom}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          value={item.orderedQuantity}
                          onChange={(e) => {
                            const qty = Number(e.target.value);
                            const u = [...formLineItems];
                            u[idx].orderedQuantity = qty;
                            u[idx].lineTotal = qty * u[idx].unitPrice;
                            setFormLineItems(u);
                          }}
                          className="w-full border border-slate-200 rounded p-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const price = Number(e.target.value);
                            const u = [...formLineItems];
                            u[idx].unitPrice = price;
                            u[idx].lineTotal = u[idx].orderedQuantity * price;
                            setFormLineItems(u);
                          }}
                          className="w-full border border-slate-200 rounded p-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPercentage}
                          onChange={(e) => {
                            const u = [...formLineItems];
                            u[idx].discountPercentage = Number(e.target.value);
                            setFormLineItems(u);
                          }}
                          className="w-full border border-slate-200 rounded p-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.taxPercentage}
                          onChange={(e) => {
                            const u = [...formLineItems];
                            u[idx].taxPercentage = Number(e.target.value);
                            setFormLineItems(u);
                          }}
                          className="w-full border border-slate-200 rounded p-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded hover:bg-slate-50 font-medium text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-xs transition"
            >
              {createMutation.isPending ? "Issuing PO..." : "Issue & Authorize Local PO"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 7. VIEW PURCHASE ORDER DETAILS MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(viewPO)}
        onClose={() => setViewPO(null)}
        title={`Purchase Order: ${viewPO?.poNumber || ""}`}
        subtitle={`Issued to ${viewPO?.supplierName || ""} on ${viewPO?.orderDate || ""}`}
        maxWidth="2xl"
      >
        {viewPO && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Supplier Information</span>
                <p className="font-bold text-slate-900 text-sm">{viewPO.supplierName}</p>
                <p className="text-slate-600">Payment Terms: {viewPO.paymentTerms || "Net 30 Days"}</p>
                <p className="text-slate-600">Delivery Terms: {viewPO.deliveryTerms || "FOB Factory"}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Order Context</span>
                <p className="font-bold text-slate-900 text-sm">{viewPO.officeName}</p>
                <p className="text-slate-600">Receiving: {viewPO.expectedDeliveryDate}</p>
                <p className="text-slate-600">Status: <span className="font-semibold text-blue-700">{viewPO.status}</span></p>
              </div>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-center">UoM</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewPO.items?.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{it.itemCode}</div>
                      </td>
                      <td className="p-2 text-center font-mono">{it.orderedQuantity}</td>
                      <td className="p-2 text-center">{it.uom}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Total Purchase Amount:</span>
              <span className="text-base font-bold font-mono text-sky-800">
                {formatCurrency(viewPO.totalAmount)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewPO(null)}
                className="px-4 py-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-700 font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintPO(viewPO);
                  setViewPO(null);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print PO Document</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 8. PRINT PURCHASE ORDER VOUCHER MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(printPO)}
        onClose={() => setPrintPO(null)}
        title="Purchase Order Voucher - Print Preview"
        subtitle="Official ERP Document for Supplier Issuance & Receiving Verification"
        maxWidth="4xl"
      >
        {printPO && (
          <div className="space-y-4 text-xs">
            <div className="bg-white p-6 border border-slate-200 rounded shadow-sm text-slate-800 space-y-4 print:p-0 print:border-none">
              {/* Organization Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-3">
                <div className="flex items-center gap-3.5">
                  <img src="/logo.png" alt="BridgeOne Logo" className="h-10 w-auto object-contain" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                      BridgeOne Technologies Ltd.
                    </h2>
                    <p className="text-slate-500 text-[11px]">Corporate Procurement & Supply Chain Division</p>
                    <p className="text-slate-500 text-[11px]">{printPO.officeName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-2.5 py-1 bg-slate-100 rounded text-[11px] font-bold text-slate-700 border border-slate-300">
                    PURCHASE ORDER
                  </div>
                  <div className="text-sm font-bold text-sky-800 font-mono mt-1">{printPO.poNumber}</div>
                  <div className="text-[11px] text-slate-500">Date: {printPO.orderDate}</div>
                </div>
              </div>

              {/* Vendor & Ship To Meta */}
              <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-1 uppercase text-[10px]">Vendor Details:</span>
                  <div className="font-bold text-slate-900 text-sm">{printPO.supplierName}</div>
                  <div className="text-slate-500 text-[11px]">Payment Terms: {printPO.paymentTerms || "Net 30 Days"}</div>
                  <div className="text-slate-500 text-[11px]">Delivery Terms: {printPO.deliveryTerms || "FOB Factory Depot"}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-1 uppercase text-[10px]">Destination & Delivery:</span>
                  <div className="font-bold text-slate-900 text-sm">{printPO.officeName}</div>
                  <div className="text-slate-500 text-[11px]">Expected Delivery: {printPO.expectedDeliveryDate}</div>
                  <div className="text-slate-500 text-[11px]">Reference / Project: {printPO.projectCostCenter || "N/A"}</div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border border-slate-200 text-xs mb-3">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">Ordered Qty</th>
                    <th className="p-2 text-center">UoM</th>
                    <th className="p-2 text-right">Unit Price (BDT)</th>
                    <th className="p-2 text-right">Total Amount (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {printPO.items?.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{it.itemCode}</div>
                      </td>
                      <td className="p-2 text-center font-mono">{it.orderedQuantity}</td>
                      <td className="p-2 text-center">{it.uom}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Summary */}
              <div className="flex justify-end text-xs">
                <div className="w-64 space-y-1 bg-slate-50 p-2.5 rounded border border-slate-100">
                  <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-300">
                    <span>Total Order Value:</span>
                    <span className="font-mono text-sky-800">{formatCurrency(printPO.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs text-slate-600">
                <div className="border-t border-slate-300 pt-1.5 font-medium">Prepared By</div>
                <div className="border-t border-slate-300 pt-1.5 font-medium">Verified By</div>
                <div className="border-t border-slate-300 pt-1.5 font-medium">Authorized Signature</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPrintPO(null)}
                className="px-4 py-2 border border-slate-200 rounded text-slate-700 font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 9. CLOSE / CANCEL ORDER MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(closePO)}
        onClose={() => setClosePO(null)}
        title="Close / Cancel Purchase Order"
        subtitle={`PO Number: ${closePO?.poNumber || ""}`}
        maxWidth="md"
      >
        {closePO && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Are you sure you want to close/cancel order <span className="font-bold text-slate-900 font-mono">{closePO.poNumber}</span> from vendor <span className="font-semibold text-slate-900">{closePO.supplierName}</span>?
            </p>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Cancellation / Closure Reason *</label>
              <textarea
                value={closeComment}
                onChange={(e) => setCloseComment(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full border border-slate-300 rounded p-2 text-xs h-20"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClosePO(null)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success(`PO ${closePO.poNumber} has been closed.`, {
                    title: "Order Closed",
                  });
                  setClosePO(null);
                }}
                className="px-4 py-1.5 bg-rose-600 text-white rounded font-bold hover:bg-rose-700"
              >
                Confirm Closure
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 10. REVERSE STATUS MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(reversePO)}
        onClose={() => setReversePO(null)}
        title="Reverse Purchase Order Status"
        subtitle={`PO Number: ${reversePO?.poNumber || ""}`}
        maxWidth="md"
      >
        {reversePO && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Reversing order <span className="font-bold text-slate-900 font-mono">{reversePO.poNumber}</span> back to previous processing state.
            </p>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Audit Justification *</label>
              <textarea
                value={reverseComment}
                onChange={(e) => setReverseComment(e.target.value)}
                placeholder="Enter audit note for reversing this order..."
                className="w-full border border-slate-300 rounded p-2 text-xs h-20"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReversePO(null)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success(`PO ${reversePO.poNumber} reversed successfully.`, {
                    title: "Status Reversed",
                  });
                  setReversePO(null);
                }}
                className="px-4 py-1.5 bg-amber-600 text-white rounded font-bold hover:bg-amber-700"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 11. VIEW REQUISITION MODAL (from Tab 3) */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(viewReqModal)}
        onClose={() => setViewReqModal(null)}
        title={`Requisition Details: ${viewReqModal?.requisitionCode || ""}`}
        subtitle="Department Procurement Requirement"
        maxWidth="lg"
      >
        {viewReqModal && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Department / User</span>
                <p className="font-bold text-slate-900 text-sm">{viewReqModal.user}</p>
                <p className="text-slate-600">User Type: {viewReqModal.userType}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Date & Budget</span>
                <p className="font-bold text-slate-900 text-sm">{viewReqModal.date}</p>
                <p className="font-bold font-mono text-emerald-700">Budget: {formatCurrency(viewReqModal.budget)}</p>
              </div>
            </div>
            <div className="bg-white p-3 border rounded">
              <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Designated Method & Remarks</span>
              <p className="font-semibold text-blue-700">{rowMethods[viewReqModal.requisitionCode] || viewReqModal.method}</p>
              <p className="text-slate-600 mt-1">Remarks: {viewReqModal.remarks}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewReqModal(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const req = viewReqModal;
                  setViewReqModal(null);
                  handleConvertToPO(req);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
              >
                Convert to Purchase Order
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
