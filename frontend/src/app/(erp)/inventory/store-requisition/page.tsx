"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Edit,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================
type StoreRequisitionTab = "REQUISITION_LIST" | "REQUISITION_SUMMARY";

interface RequisitionRow {
  sl: number;
  reqCode: string;
  date: string;
  userType: string;
  user: string;
  remarks: string;
  status: "Approved" | "Completed" | "Pending" | "Closed" | "Rejected";
  reviewComment: string;
}

interface SummaryRow {
  sl: number;
  itemCode: string;
  itemName: string;
  itemCategory: string;
  uom: string;
  totalReqQty: number;
  issuedQty: number;
  pendingQty: number;
}

// ============================================================================
// SAMPLE DATA (Directly matched to user's ERP screenshot)
// ============================================================================
const MOCK_REQUISITION_LIST: RequisitionRow[] = [
  {
    sl: 1,
    reqCode: "SR-MG261000046",
    date: "11-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000040- Item Name: SFG-00656 - SFGSNCHIKONSEMAI (KG)",
    status: "Approved",
    reviewComment: "",
  },
  {
    sl: 2,
    reqCode: "SR-MG261000045",
    date: "11-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000039- Item Name: FGSN230207 - Peawal Bar-B-Q Biriyani Chanachur 12gm (24x36) (PCS)",
    status: "Approved",
    reviewComment: "",
  },
  {
    sl: 3,
    reqCode: "SR-MG261000044",
    date: "11-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000038- Item Name: SFG-00658 - SFGSNCHIPS (KG)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 4,
    reqCode: "SR-MG261000043",
    date: "11-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000037- Item Name: FGCHIPS240613 - Marine Potato Chips 12gm (20x4) (PCS)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 5,
    reqCode: "SR-MG261000042",
    date: "08-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000036- Item Name: FGBIS250543 - Marine Special Toast 200gx6 (PCS)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 6,
    reqCode: "SR-MG261000041",
    date: "07-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000035- Item Name: SFG-00669 - SFGSWTOASTTASTM (KG)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 7,
    reqCode: "SR-MG261000040",
    date: "07-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000034- Item Name: FGBIS250542 - Marine Sweet Toast 200gx6 (PCS)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 8,
    reqCode: "SR-MG261000039",
    date: "07-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000032- Item Name: SFG-00661 - SFGSNMOTOR (KG)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 9,
    reqCode: "SR-MG261000038",
    date: "07-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000033- Item Name: SFG-00659 - SFGSNPEANUT (KG)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 10,
    reqCode: "SR-MG261000037",
    date: "07-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000031- Item Name: FGSN220111 - Peawal Badam-Motor 12gm (24x36) (PCS)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 11,
    reqCode: "SR-MG261000036",
    date: "07-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000030- Item Name: SFG-00658 - SFGSNCHIPS (KG)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 12,
    reqCode: "SR-MG261000035",
    date: "07-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000029- Item Name: FGCHIPS240613 - Marine Potato Chips 12gm (20x4) (PCS)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 13,
    reqCode: "SR-MG261000034",
    date: "06-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000028- Item Name: FGBIS260944 - Marine Choco Bite Biscuit 200 gm (1x6) (PCS)",
    status: "Completed",
    reviewComment: "",
  },
  {
    sl: 14,
    reqCode: "SR-MG261000033",
    date: "06-10-2026",
    userType: "N/A",
    user: "",
    remarks: "PRO-MG261000027- Item Name: FGBIS260944 - Marine Choco Bite Biscuit 200 gm (1x6) (PCS)",
    status: "Closed",
    reviewComment: "",
  },
];

const MOCK_SUMMARY_LIST: SummaryRow[] = [
  {
    sl: 1,
    itemCode: "SFG-00656",
    itemName: "SFGSNCHIKONSEMAI",
    itemCategory: "Semi-Finished Goods",
    uom: "KG",
    totalReqQty: 850.0,
    issuedQty: 850.0,
    pendingQty: 0.0,
  },
  {
    sl: 2,
    itemCode: "SFG-00658",
    itemName: "SFGSNCHIPS",
    itemCategory: "Semi-Finished Goods",
    uom: "KG",
    totalReqQty: 1200.0,
    issuedQty: 1200.0,
    pendingQty: 0.0,
  },
  {
    sl: 3,
    itemCode: "SFG-00669",
    itemName: "SFGSWTOASTTASTM",
    itemCategory: "Semi-Finished Goods",
    uom: "KG",
    totalReqQty: 640.0,
    issuedQty: 640.0,
    pendingQty: 0.0,
  },
  {
    sl: 4,
    itemCode: "SFG-00661",
    itemName: "SFGSNMOTOR",
    itemCategory: "Semi-Finished Goods",
    uom: "KG",
    totalReqQty: 450.0,
    issuedQty: 450.0,
    pendingQty: 0.0,
  },
  {
    sl: 5,
    itemCode: "SFG-00659",
    itemName: "SFGSNPEANUT",
    itemCategory: "Semi-Finished Goods",
    uom: "KG",
    totalReqQty: 320.0,
    issuedQty: 320.0,
    pendingQty: 0.0,
  },
  {
    sl: 6,
    itemCode: "RAW-FLR-001",
    itemName: "Wheat Flour Special",
    itemCategory: "Raw Materials",
    uom: "KG",
    totalReqQty: 5000.0,
    issuedQty: 4800.0,
    pendingQty: 200.0,
  },
];

const OFFICE_OPTIONS = [
  { value: "All", label: "All" },
  { value: "MG Sirajganj Factory", label: "MG Sirajganj Factory" },
  { value: "Dhaka Head Office", label: "Dhaka Head Office" },
  { value: "Marinozz", label: "Marinozz" },
  { value: "MOHS Eco", label: "MOHS Eco" },
];

export default function StoreRequisitionPage() {
  const [activeTab, setActiveTab] = useState<StoreRequisitionTab>("REQUISITION_LIST");
  const [searchTerm, setSearchTerm] = useState("");

  // Summary tab filters
  const [summaryOffice, setSummaryOffice] = useState("All");
  const [summaryFromDate, setSummaryFromDate] = useState("2026-10-14");
  const [summaryToDate, setSummaryToDate] = useState("2026-10-14");

  // Modal for new requisition
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Requisition Form State
  const [newRequisition, setNewRequisition] = useState({
    date: new Date().toISOString().slice(0, 10),
    office: "MG Sirajganj Factory",
    remarks: "",
  });

  // Filtered requisition list
  const filteredRequisitions = useMemo(() => {
    if (!searchTerm) return MOCK_REQUISITION_LIST;
    const s = searchTerm.toLowerCase();
    return MOCK_REQUISITION_LIST.filter(
      (r) =>
        r.reqCode.toLowerCase().includes(s) ||
        r.remarks.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
    );
  }, [searchTerm]);

  // Filtered summary list
  const filteredSummary = useMemo(() => {
    if (!searchTerm) return MOCK_SUMMARY_LIST;
    const s = searchTerm.toLowerCase();
    return MOCK_SUMMARY_LIST.filter(
      (r) =>
        r.itemCode.toLowerCase().includes(s) ||
        r.itemName.toLowerCase().includes(s) ||
        r.itemCategory.toLowerCase().includes(s)
    );
  }, [searchTerm]);

  // Status badge styling
  const renderStatus = (status: RequisitionRow["status"]) => {
    switch (status) {
      case "Approved":
        return <span className="text-emerald-600 font-semibold text-[11px]">Approved</span>;
      case "Completed":
        return <span className="text-blue-600 font-semibold text-[11px]">Completed</span>;
      case "Closed":
        return <span className="text-slate-700 font-semibold text-[11px]">Closed</span>;
      case "Pending":
        return <span className="text-amber-600 font-semibold text-[11px]">Pending</span>;
      default:
        return <span className="text-slate-500 font-semibold text-[11px]">{status}</span>;
    }
  };

  // CSV / Excel Export
  const handleExportCSV = () => {
    let csvContent = "";
    if (activeTab === "REQUISITION_LIST") {
      const headers = [
        "SL",
        "Requisition Code",
        "Date",
        "User Type",
        "User",
        "Remarks",
        "Status",
        "Review Comment",
      ];
      const rows = filteredRequisitions.map((r) => [
        r.sl,
        r.reqCode,
        r.date,
        r.userType,
        `"${r.user}"`,
        `"${r.remarks.replace(/"/g, '""')}"`,
        r.status,
        `"${r.reviewComment}"`,
      ]);
      csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    } else {
      const headers = [
        "SL",
        "Item Code",
        "Item Name",
        "Item Category",
        "UOM",
        "Total Req Qty",
        "Issued Qty",
        "Pending Qty",
      ];
      const rows = filteredSummary.map((r) => [
        r.sl,
        r.itemCode,
        `"${r.itemName}"`,
        `"${r.itemCategory}"`,
        r.uom,
        r.totalReqQty,
        r.issuedQty,
        r.pendingQty,
      ]);
      csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    }

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `store_requisition_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 p-1">
      {/* ─────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER                                      */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Store Requisition
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

          {/* + Requisition Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Requisition</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 2. SUMMARY FILTER BAR (When on SUMMARY TAB)        */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "REQUISITION_SUMMARY" && (
        <div className="flex flex-wrap items-end gap-3 text-xs bg-slate-50/70 p-3 rounded border border-slate-200">
          {/* Office */}
          <div className="min-w-[180px]">
            <label className="block text-[11px] text-slate-700 mb-1 font-semibold">
              Office <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={summaryOffice}
                onChange={(e) => setSummaryOffice(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
              >
                {OFFICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {summaryOffice && (
                <button
                  type="button"
                  onClick={() => setSummaryOffice("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] text-slate-700 mb-1 font-semibold">
              From Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={summaryFromDate}
              onChange={(e) => setSummaryFromDate(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] text-slate-700 mb-1 font-semibold">
              To Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={summaryToDate}
              onChange={(e) => setSummaryToDate(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Buttons: View, Print, Excel */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
            >
              View
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
            >
              Print
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
            >
              Excel
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 3. TABS NAVIGATION                                 */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-8 text-xs font-bold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setActiveTab("REQUISITION_LIST")}
          className={`pb-2 transition ${
            activeTab === "REQUISITION_LIST"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          REQUISITION LIST
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("REQUISITION_SUMMARY")}
          className={`pb-2 transition ${
            activeTab === "REQUISITION_SUMMARY"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          STORE REQUISITION SUMMARY
        </button>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 4. TAB 1: REQUISITION LIST TABLE                   */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "REQUISITION_LIST" && (
        <div className="space-y-2">
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-36">Requisition Code</th>
                  <th className="p-2 border border-slate-300 w-24">Date</th>
                  <th className="p-2 border border-slate-300 w-24">User Type</th>
                  <th className="p-2 border border-slate-300 w-24">User</th>
                  <th className="p-2 border border-slate-300">Remarks</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Status</th>
                  <th className="p-2 border border-slate-300 w-32">Review Comment</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No store requisitions found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequisitions.map((row) => (
                    <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                        {row.sl}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {row.reqCode}
                      </td>
                      <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                        {row.date}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        {row.userType}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        {row.user}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-800">
                        {row.remarks}
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        {renderStatus(row.status)}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-600">
                        {row.reviewComment}
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-600">
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600"
                            title="Print"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 5. TAB 2: STORE REQUISITION SUMMARY TABLE          */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "REQUISITION_SUMMARY" && (
        <div className="space-y-2">
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-32">Item Code</th>
                  <th className="p-2 border border-slate-300">Item Name</th>
                  <th className="p-2 border border-slate-300">Item Category</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">UOM</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Total Req. Qty</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Issued Qty</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Pending Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No summary data found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((row) => (
                    <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                        {row.sl}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900">
                        {row.itemCode}
                      </td>
                      <td className="p-2 border border-slate-300 font-medium text-slate-900">
                        {row.itemName}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        {row.itemCategory}
                      </td>
                      <td className="p-2 border border-slate-300 text-center text-slate-700">
                        {row.uom}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-mono font-medium">
                        {row.totalReqQty.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-mono">
                        {row.issuedQty.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-mono text-amber-700 font-medium">
                        {row.pendingQty.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        <button
                          type="button"
                          className="p-1 hover:text-blue-600 text-slate-600"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 6. + REQUISITION MODAL                              */}
      {/* ─────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">
                New Store Requisition
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Requisition Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newRequisition.date}
                  onChange={(e) =>
                    setNewRequisition({ ...newRequisition, date: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Office / Branch <span className="text-red-500">*</span>
                </label>
                <select
                  value={newRequisition.office}
                  onChange={(e) =>
                    setNewRequisition({ ...newRequisition, office: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                >
                  {OFFICE_OPTIONS.filter((o) => o.value !== "All").map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Remarks / Production Reference
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. PRO-MG261000041 - Item Name: SFG-00656"
                  value={newRequisition.remarks}
                  onChange={(e) =>
                    setNewRequisition({ ...newRequisition, remarks: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert("Store Requisition created successfully!");
                  setIsModalOpen(false);
                }}
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
              >
                Save Requisition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
