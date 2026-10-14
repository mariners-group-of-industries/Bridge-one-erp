"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Edit,
  Printer,
  FileSpreadsheet,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================
type TabId = "REQUEST_LIST" | "REQUEST_SUMMARY" | "REQUEST_DETAILS";

interface TransferRequestRow {
  sl: number;
  reqDate: string;
  exptDate: string;
  reqCode: string;
  salesOrderNo: string;
  reqOffice: string;
  reqWarehouse: string;
  reqQty: number;
  outQty: number;
  inQty: number;
  remainingQty: number;
  status: "Pending" | "Approved" | "Partial" | "Completed" | "Rejected";
  actionBy: string;
  requestTo: string;
}

interface SummaryRow {
  sl: number;
  itemCode: string;
  itemType: string;
  itemCategory: string;
  itemName: string;
  uom: string;
  requestQty: number;
  productionQty: number;
}

interface DetailRow {
  itemCode: string;
  itemCategory: string;
  itemName: string;
  uom: string;
  totalQty: number;
}

// ============================================================================
// MOCK DATA — REQUEST LIST
// ============================================================================
const MOCK_REQUEST_LIST: TransferRequestRow[] = [
  {
    sl: 1,
    reqDate: "12-10-2026",
    exptDate: "14-10-2026",
    reqCode: "TR-MG261000045",
    salesOrderNo: "SO-2026-0891",
    reqOffice: "MG Sirajganj Factory",
    reqWarehouse: "Finished Goods (FG) WH",
    reqQty: 1040,
    outQty: 1040,
    inQty: 1040,
    remainingQty: 0,
    status: "Completed",
    actionBy: "Md. Jakaria (01351149009)",
    requestTo: "Tanvir Ahmed",
  },
  {
    sl: 2,
    reqDate: "11-10-2026",
    exptDate: "13-10-2026",
    reqCode: "TR-MG261000044",
    salesOrderNo: "SO-2026-0888",
    reqOffice: "MG Sirajganj Factory",
    reqWarehouse: "PD Biscuit Store",
    reqQty: 678,
    outQty: 678,
    inQty: 678,
    remainingQty: 0,
    status: "Approved",
    actionBy: "Md. Jakaria (01351149009)",
    requestTo: "Md. Rafiqul Islam",
  },
  {
    sl: 3,
    reqDate: "10-10-2026",
    exptDate: "12-10-2026",
    reqCode: "TR-MG261000043",
    salesOrderNo: "SO-2026-0882",
    reqOffice: "MG Sirajganj Factory",
    reqWarehouse: "PD Snacks Store",
    reqQty: 430,
    outQty: 200,
    inQty: 200,
    remainingQty: 230,
    status: "Partial",
    actionBy: "Md. Jakaria (01351149009)",
    requestTo: "Sumon Hossain",
  },
  {
    sl: 4,
    reqDate: "09-10-2026",
    exptDate: "11-10-2026",
    reqCode: "TR-MG261000042",
    salesOrderNo: "SO-2026-0875",
    reqOffice: "MG Sirajganj Factory",
    reqWarehouse: "Material WH",
    reqQty: 134,
    outQty: 0,
    inQty: 0,
    remainingQty: 134,
    status: "Pending",
    actionBy: "Md. Jakaria (01351149009)",
    requestTo: "Md. Rafiqul Islam",
  },
  {
    sl: 5,
    reqDate: "08-10-2026",
    exptDate: "10-10-2026",
    reqCode: "TR-MG261000041",
    salesOrderNo: "SO-2026-0869",
    reqOffice: "MG Sirajganj Factory",
    reqWarehouse: "PD Biscuit Store",
    reqQty: 274,
    outQty: 274,
    inQty: 274,
    remainingQty: 0,
    status: "Approved",
    actionBy: "Md. Jakaria (01351149009)",
    requestTo: "Tanvir Ahmed",
  },
  {
    sl: 6,
    reqDate: "07-10-2026",
    exptDate: "09-10-2026",
    reqCode: "TR-MG261000040",
    salesOrderNo: "SO-2026-0860",
    reqOffice: "MG Sirajganj Factory",
    reqWarehouse: "Material WH",
    reqQty: 555,
    outQty: 0,
    inQty: 0,
    remainingQty: 555,
    status: "Pending",
    actionBy: "Md. Jakaria (01351149009)",
    requestTo: "Md. Rafiqul Islam",
  },
];

// ============================================================================
// MOCK DATA — REQUEST SUMMARY
// ============================================================================
const MOCK_SUMMARY: SummaryRow[] = [
  {
    sl: 1,
    itemCode: "ITM-FLR-001",
    itemType: "Raw Material",
    itemCategory: "Flour & Grains",
    itemName: "Premium Wheat Flour Grade A",
    uom: "KG",
    requestQty: 12500,
    productionQty: 12000,
  },
  {
    sl: 2,
    itemCode: "ITM-SGR-002",
    itemType: "Raw Material",
    itemCategory: "Sweeteners",
    itemName: "Refined White Cane Sugar",
    uom: "KG",
    requestQty: 4800,
    productionQty: 4800,
  },
  {
    sl: 3,
    itemCode: "ITM-OIL-005",
    itemType: "Raw Material",
    itemCategory: "Oils & Fats",
    itemName: "Edible Palm Olein Oil",
    uom: "LTR",
    requestQty: 3200,
    productionQty: 3150,
  },
  {
    sl: 4,
    itemCode: "ITM-PKG-101",
    itemType: "Packaging",
    itemCategory: "Corrugated Box",
    itemName: "Printed Master Carton 24x100g",
    uom: "PCS",
    requestQty: 1500,
    productionQty: 1500,
  },
  {
    sl: 5,
    itemCode: "ITM-FLV-008",
    itemType: "Ingredients",
    itemCategory: "Flavourings",
    itemName: "Butter Vanilla Flavour Concentrate",
    uom: "LTR",
    requestQty: 120,
    productionQty: 120,
  },
];

const MOCK_DETAILS: DetailRow[] = [
  {
    itemCode: "ITM-FLR-001",
    itemCategory: "Flour & Grains",
    itemName: "Premium Wheat Flour Grade A",
    uom: "KG",
    totalQty: 12500,
  },
  {
    itemCode: "ITM-SGR-002",
    itemCategory: "Sweeteners",
    itemName: "Refined White Cane Sugar",
    uom: "KG",
    totalQty: 4800,
  },
  {
    itemCode: "ITM-OIL-005",
    itemCategory: "Oils & Fats",
    itemName: "Edible Palm Olein Oil",
    uom: "LTR",
    totalQty: 3200,
  },
  {
    itemCode: "ITM-PKG-101",
    itemCategory: "Corrugated Box",
    itemName: "Printed Master Carton 24x100g",
    uom: "PCS",
    totalQty: 1500,
  },
];

// ============================================================================
// STATUS OPTIONS
// ============================================================================
const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Partial", label: "Partial" },
  { value: "Completed", label: "Completed" },
  { value: "Rejected", label: "Rejected" },
];

const PERSON_OPTIONS = [
  { value: "", label: "All Persons" },
  { value: "Md. Jakaria (01351149009)", label: "Md. Jakaria (01351149009)" },
  { value: "Md. Rafiqul Islam", label: "Md. Rafiqul Islam" },
  { value: "Tanvir Ahmed", label: "Tanvir Ahmed" },
  { value: "Sumon Hossain", label: "Sumon Hossain" },
];

const OFFICE_OPTIONS = [
  { value: "", label: "Office" },
  { value: "MG Sirajganj Factory", label: "MG Sirajganj Factory" },
  { value: "Dhaka Head Office", label: "Dhaka Head Office" },
  { value: "Marinozz", label: "Marinozz" },
  { value: "MOHS Eco", label: "MOHS Eco" },
];

const WAREHOUSE_OPTIONS = [
  { value: "", label: "Warehouse" },
  { value: "Central RM Warehouse", label: "Central RM Warehouse" },
  { value: "Spinning Unit 1 Store", label: "Spinning Unit 1 Store" },
  { value: "Central Dyes Store", label: "Central Dyes Store" },
  { value: "Dyeing Plant Store", label: "Dyeing Plant Store" },
  { value: "Finished Goods Warehouse", label: "Finished Goods Warehouse" },
];

// ============================================================================
// HELPERS
// ============================================================================
function getDefaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

function getDefaultTo() {
  return new Date().toISOString().split("T")[0];
}

function formatDateForDisplay(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusBadge(status: TransferRequestRow["status"]) {
  const map: Record<string, string> = {
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Partial: "bg-blue-50 text-blue-700 border-blue-200",
    Completed: "bg-green-50 text-green-700 border-green-200",
    Rejected: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border ${map[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}
    >
      {status}
    </span>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
export default function TransferRequestPage() {
  const [activeTab, setActiveTab] = useState<TabId>("REQUEST_LIST");
  const [searchTerm, setSearchTerm] = useState("");

  // ── REQUEST LIST filters ──
  const [listFromDate, setListFromDate] = useState(getDefaultFrom());
  const [listToDate, setListToDate] = useState(getDefaultTo());
  const [listStatus, setListStatus] = useState("Pending");
  const [listPerson, setListPerson] = useState("Md. Jakaria (01351149009)");
  const [listRowsPerPage, setListRowsPerPage] = useState(50);
  const [listPage, setListPage] = useState(1);
  const [requestList] = useState<TransferRequestRow[]>(MOCK_REQUEST_LIST);

  // ── REQUEST SUMMARY filters ──
  const [summaryFromDate, setSummaryFromDate] = useState(getDefaultFrom());
  const [summaryToDate, setSummaryToDate] = useState(getDefaultTo());
  const [summaryRowsPerPage, setSummaryRowsPerPage] = useState(50);
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryList] = useState<SummaryRow[]>(MOCK_SUMMARY);

  // ── REQUEST DETAILS filters ──
  const [detailOffice, setDetailOffice] = useState("");
  const [detailWarehouse, setDetailWarehouse] = useState("");
  const [detailFromReqDate, setDetailFromReqDate] = useState(getDefaultFrom());
  const [detailToReqDate, setDetailToReqDate] = useState(getDefaultTo());
  const [detailFromExpDate, setDetailFromExpDate] = useState(getDefaultFrom());
  const [detailToExpDate, setDetailToExpDate] = useState(getDefaultTo());
  const [detailList] = useState<DetailRow[]>(MOCK_DETAILS);

  // ── + Request modal ──
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);

  // ── Filtered REQUEST LIST ──
  const filteredList = useMemo(() => {
    return requestList.filter((row) => {
      if (listStatus && row.status !== listStatus) return false;
      if (listPerson && !row.actionBy.includes(listPerson.split(" (")[0]) && !row.requestTo.includes(listPerson.split(" (")[0])) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          row.reqCode.toLowerCase().includes(s) ||
          row.reqOffice.toLowerCase().includes(s) ||
          row.reqWarehouse.toLowerCase().includes(s) ||
          row.salesOrderNo.toLowerCase().includes(s) ||
          row.actionBy.toLowerCase().includes(s) ||
          row.requestTo.toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [requestList, listStatus, listPerson, searchTerm]);

  const totalListPages = Math.ceil(filteredList.length / listRowsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (listPage - 1) * listRowsPerPage;
    return filteredList.slice(start, start + listRowsPerPage);
  }, [filteredList, listPage, listRowsPerPage]);

  // ── Filtered SUMMARY ──
  const filteredSummary = useMemo(() => {
    if (!searchTerm) return summaryList;
    const s = searchTerm.toLowerCase();
    return summaryList.filter(
      (row) =>
        row.itemCode.toLowerCase().includes(s) ||
        row.itemName.toLowerCase().includes(s) ||
        row.itemCategory.toLowerCase().includes(s)
    );
  }, [summaryList, searchTerm]);

  const totalSummaryPages = Math.ceil(filteredSummary.length / summaryRowsPerPage) || 1;
  const paginatedSummary = useMemo(() => {
    const start = (summaryPage - 1) * summaryRowsPerPage;
    return filteredSummary.slice(start, start + summaryRowsPerPage);
  }, [filteredSummary, summaryPage, summaryRowsPerPage]);

  // ── Export CSV ──
  const handleExportCSV = () => {
    let csvContent = "";
    if (activeTab === "REQUEST_LIST") {
      const headers = ["SL", "Req. Date", "Expt. Date", "Req. Code", "Sales Order No", "Req. Office", "Req. Warehouse", "Req. Qty", "Out Qty", "In Qty", "Remaining Qty", "Status", "Action By", "Request To"];
      const rows = filteredList.map((r, i) => [
        i + 1, r.reqDate, r.exptDate, r.reqCode, r.salesOrderNo, `"${r.reqOffice}"`, `"${r.reqWarehouse}"`,
        r.reqQty, r.outQty, r.inQty, r.remainingQty, r.status, `"${r.actionBy}"`, `"${r.requestTo}"`,
      ]);
      csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    } else if (activeTab === "REQUEST_SUMMARY") {
      const headers = ["SL", "Item Code", "Item Type", "Item Category", "Item Name", "UOM", "Request Qty", "Production Qty"];
      const rows = filteredSummary.map((r, i) => [
        i + 1, r.itemCode, r.itemType, `"${r.itemCategory}"`, `"${r.itemName}"`, r.uom, r.requestQty, r.productionQty,
      ]);
      csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    } else {
      const headers = ["Item Code", "Item Category", "Item Name", "UOM", "Total Qty"];
      const rows = detailList.map((r) => [r.itemCode, `"${r.itemCategory}"`, `"${r.itemName}"`, r.uom, r.totalQty]);
      csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    }
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `transfer_request_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "REQUEST_LIST", label: "REQUEST LIST" },
    { id: "REQUEST_SUMMARY", label: "REQUEST SUMMARY" },
    { id: "REQUEST_DETAILS", label: "REQUEST DETAILS" },
  ];

  return (
    <div className="space-y-3 p-1">
      {/* ─────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER                                      */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Transfer Request
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search...."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Excel Export (shown on SUMMARY & DETAILS tabs) */}
          {(activeTab === "REQUEST_SUMMARY" || activeTab === "REQUEST_DETAILS") && (
            <button
              type="button"
              onClick={handleExportCSV}
              title="Download CSV / Excel"
              className="h-9 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          )}

          {/* + Request Button */}
          <button
            type="button"
            onClick={() => setIsNewRequestOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Request</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 2. TABS NAVIGATION                                 */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-8 text-xs font-bold uppercase tracking-wider">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 transition ${
              activeTab === tab.id
                ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================= */}
      {/* TAB 1: REQUEST LIST                                            */}
      {/* ============================================================= */}
      {activeTab === "REQUEST_LIST" && (
        <div className="space-y-2">
          {/* Filter Row */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end text-xs">
            {/* From Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                From Date
              </label>
              <input
                type="date"
                value={listFromDate}
                onChange={(e) => setListFromDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                To Date
              </label>
              <input
                type="date"
                value={listToDate}
                onChange={(e) => setListToDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium sr-only">
                Status
              </label>
              <div className="relative">
                <select
                  value={listStatus}
                  onChange={(e) => setListStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {listStatus && (
                  <button
                    type="button"
                    onClick={() => setListStatus("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Person */}
            <div className="col-span-2">
              <label className="block text-[11px] text-slate-600 mb-1 font-medium sr-only">
                Person
              </label>
              <div className="relative">
                <select
                  value={listPerson}
                  onChange={(e) => setListPerson(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
                >
                  {PERSON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {listPerson && (
                  <button
                    type="button"
                    onClick={() => setListPerson("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* View */}
            <div>
              <button
                type="button"
                className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
              >
                View
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Req. Date</th>
                  <th className="p-2 border border-slate-300 w-24">Expt. Date</th>
                  <th className="p-2 border border-slate-300 w-32">Req. Code</th>
                  <th className="p-2 border border-slate-300 w-32">Sales Order No</th>
                  <th className="p-2 border border-slate-300">Req. Office</th>
                  <th className="p-2 border border-slate-300">Req. Warehouse</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">Req. Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">Out Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">In Qty</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Remaining Qty</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Status</th>
                  <th className="p-2 border border-slate-300">Action By</th>
                  <th className="p-2 border border-slate-300">Request To</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No transfer requests found for the selected criteria.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((row, idx) => {
                    const serialNo = (listPage - 1) * listRowsPerPage + idx + 1;
                    return (
                      <tr key={row.sl || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                          {serialNo}
                        </td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                          {row.reqDate}
                        </td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                          {row.exptDate}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap font-medium">
                          {row.reqCode}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                          {row.salesOrderNo}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-700">
                          {row.reqOffice}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-700">
                          {row.reqWarehouse}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono">
                          {row.reqQty}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono">
                          {row.outQty}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono">
                          {row.inQty}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono">
                          {row.remainingQty}
                        </td>
                        <td className="p-2 border border-slate-300 text-center">
                          {statusBadge(row.status)}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-700">
                          {row.actionBy}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-700">
                          {row.requestTo}
                        </td>
                        <td className="p-2 border border-slate-300 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-slate-600">
                            <button type="button" className="p-0.5 hover:text-blue-600" title="View">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" className="p-0.5 hover:text-blue-600" title="Edit">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" className="p-0.5 hover:text-blue-600" title="Print">
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={listRowsPerPage}
                onChange={(e) => {
                  setListRowsPerPage(Number(e.target.value));
                  setListPage(1);
                }}
                className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>
                {filteredList.length === 0
                  ? "0-0 of 0"
                  : `${(listPage - 1) * listRowsPerPage + 1}-${Math.min(listPage * listRowsPerPage, filteredList.length)} of ${filteredList.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={listPage <= 1}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={listPage >= totalListPages}
                  onClick={() => setListPage((p) => Math.min(totalListPages, p + 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: REQUEST SUMMARY                                         */}
      {/* ============================================================= */}
      {activeTab === "REQUEST_SUMMARY" && (
        <div className="space-y-2">
          {/* Filter Row */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end text-xs">
            {/* From Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                From Date
              </label>
              <input
                type="date"
                value={summaryFromDate}
                onChange={(e) => setSummaryFromDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                To Date
              </label>
              <input
                type="date"
                value={summaryToDate}
                onChange={(e) => setSummaryToDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* View */}
            <div>
              <button
                type="button"
                className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
              >
                View
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-28">Item Code</th>
                  <th className="p-2 border border-slate-300 w-28">Item Type</th>
                  <th className="p-2 border border-slate-300">Item Category</th>
                  <th className="p-2 border border-slate-300">Item Name</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">UOM</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Request Qty</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Production Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {paginatedSummary.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No summary data found for the selected date range.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSummary.map((row, idx) => {
                    const serialNo = (summaryPage - 1) * summaryRowsPerPage + idx + 1;
                    return (
                      <tr key={row.sl || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                          {serialNo}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono text-slate-800 font-medium">
                          {row.itemCode}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-700">
                          {row.itemType}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-700">
                          {row.itemCategory}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-900 font-medium">
                          {row.itemName}
                        </td>
                        <td className="p-2 border border-slate-300 text-center text-slate-700">
                          {row.uom}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono">
                          {row.requestQty}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono">
                          {row.productionQty}
                        </td>
                        <td className="p-2 border border-slate-300 text-center">
                          <button type="button" className="p-0.5 hover:text-blue-600 text-slate-600" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={summaryRowsPerPage}
                onChange={(e) => {
                  setSummaryRowsPerPage(Number(e.target.value));
                  setSummaryPage(1);
                }}
                className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>
                {filteredSummary.length === 0
                  ? "0-0 of 0"
                  : `${(summaryPage - 1) * summaryRowsPerPage + 1}-${Math.min(summaryPage * summaryRowsPerPage, filteredSummary.length)} of ${filteredSummary.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={summaryPage <= 1}
                  onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={summaryPage >= totalSummaryPages}
                  onClick={() => setSummaryPage((p) => Math.min(totalSummaryPages, p + 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 3: REQUEST DETAILS                                         */}
      {/* ============================================================= */}
      {activeTab === "REQUEST_DETAILS" && (
        <div className="space-y-2">
          {/* Filter Row */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 grid grid-cols-2 sm:grid-cols-7 gap-3 items-end text-xs">
            {/* Office */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                Office
              </label>
              <select
                value={detailOffice}
                onChange={(e) => setDetailOffice(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              >
                {OFFICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                Warehouse
              </label>
              <select
                value={detailWarehouse}
                onChange={(e) => setDetailWarehouse(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              >
                {WAREHOUSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* From Request Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                From Request Date
              </label>
              <input
                type="date"
                value={detailFromReqDate}
                onChange={(e) => setDetailFromReqDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Request Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                To Request Date
              </label>
              <input
                type="date"
                value={detailToReqDate}
                onChange={(e) => setDetailToReqDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* From Exp. Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                From Exp. Date
              </label>
              <input
                type="date"
                value={detailFromExpDate}
                onChange={(e) => setDetailFromExpDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Exp. Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                To Exp. Date
              </label>
              <input
                type="date"
                value={detailToExpDate}
                onChange={(e) => setDetailToExpDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* View Button below filters */}
          <div>
            <button
              type="button"
              className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
            >
              View
            </button>
          </div>

          {/* Item Request Details Section */}
          <div className="pt-2">
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              Item Request Details
            </h3>
            <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
              <table className="erp-table w-full text-left text-xs border-collapse">
                <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                  <tr>
                    <th className="p-2 border border-slate-300 w-28">Item Code</th>
                    <th className="p-2 border border-slate-300">Item Category</th>
                    <th className="p-2 border border-slate-300">Item Name</th>
                    <th className="p-2 border border-slate-300 w-20 text-center">UOM</th>
                    <th className="p-2 border border-slate-300 w-28 text-center">
                      Total
                      <br />
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                  {detailList.length === 0 ? (
                    <>
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                            <span className="text-sm font-medium">
                              Select filters and click View to load item details.
                            </span>
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-2 border border-slate-300 font-bold text-slate-700">
                          Total
                        </td>
                        <td className="p-2 border border-slate-300" />
                        <td className="p-2 border border-slate-300" />
                        <td className="p-2 border border-slate-300" />
                        <td className="p-2 border border-slate-300" />
                      </tr>
                    </>
                  ) : (
                    <>
                      {detailList.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2 border border-slate-300 font-mono text-slate-800 font-medium">
                            {row.itemCode}
                          </td>
                          <td className="p-2 border border-slate-300 text-slate-700">
                            {row.itemCategory}
                          </td>
                          <td className="p-2 border border-slate-300 text-slate-900 font-medium">
                            {row.itemName}
                          </td>
                          <td className="p-2 border border-slate-300 text-center text-slate-700">
                            {row.uom}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono">
                            {row.totalQty}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold">
                        <td className="p-2 border border-slate-300 text-slate-700">
                          Total
                        </td>
                        <td className="p-2 border border-slate-300" />
                        <td className="p-2 border border-slate-300" />
                        <td className="p-2 border border-slate-300" />
                        <td className="p-2 border border-slate-300 text-center font-mono">
                          {detailList.reduce((sum, r) => sum + r.totalQty, 0)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* NEW REQUEST MODAL                                              */}
      {/* ============================================================= */}
      {isNewRequestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">New Transfer Request</h2>
              <button
                type="button"
                onClick={() => setIsNewRequestOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsNewRequestOpen(false);
              }}
              className="p-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                    Request Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    defaultValue={getDefaultTo()}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                    Expected Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                    Request Office <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Office</option>
                    {OFFICE_OPTIONS.filter((o) => o.value).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                    Request Warehouse <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Warehouse</option>
                    {WAREHOUSE_OPTIONS.filter((o) => o.value).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                    Sales Order No
                  </label>
                  <input
                    type="text"
                    placeholder="Optional Sales Order reference"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                    Request To
                  </label>
                  <select className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500">
                    <option value="">Select Person</option>
                    {PERSON_OPTIONS.filter((o) => o.value).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Section */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-700 mb-2">Request Items</h4>
                <div className="border border-slate-300 rounded overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-[#e6f2fb] text-[11px] text-slate-700 font-semibold">
                      <tr>
                        <th className="p-2 border border-slate-300">Item Code</th>
                        <th className="p-2 border border-slate-300">Item Name</th>
                        <th className="p-2 border border-slate-300 w-20">UOM</th>
                        <th className="p-2 border border-slate-300 w-24">Qty</th>
                        <th className="p-2 border border-slate-300 w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border border-slate-300">
                          <input type="text" placeholder="Item code" className="w-full border border-slate-300 rounded px-2 py-1 text-xs" />
                        </td>
                        <td className="p-2 border border-slate-300">
                          <input type="text" placeholder="Item name" className="w-full border border-slate-300 rounded px-2 py-1 text-xs" />
                        </td>
                        <td className="p-2 border border-slate-300">
                          <input type="text" placeholder="UOM" className="w-full border border-slate-300 rounded px-2 py-1 text-xs" />
                        </td>
                        <td className="p-2 border border-slate-300">
                          <input type="number" placeholder="0" className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-right" />
                        </td>
                        <td className="p-2 border border-slate-300 text-center">
                          <button type="button" className="text-red-400 hover:text-red-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </button>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewRequestOpen(false)}
                  className="h-8 px-4 text-xs font-medium text-slate-600 border border-slate-300 rounded hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-5 text-xs font-semibold text-white bg-[#2563eb] hover:bg-blue-700 rounded shadow-xs transition"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
