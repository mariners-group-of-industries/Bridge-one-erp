"use client";

import React, { useState, useMemo } from "react";
import { useResource } from "@/hooks/use-resource";
import { InventoryDocumentDialog, type DocumentFormConfig } from "@/features/inventory/components/InventoryDocumentDialog";
import { dmy, inventoryApi } from "@/features/inventory/services/inventory.api";
import {
  Search,
  Plus,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================
type StoreIssueTab = "APPROVED_REQUISITION" | "ISSUED_ITEM";

interface ApprovedRequisitionRow {
  sl: number;
  id: string;
  docDate: string;
  reqCode: string;
  date: string;
  userType: string;
  user: string;
  remarks: string;
  status: "Approved" | "Pending" | "Rejected";
}

interface IssuedItemRow {
  id: string;
  docDate: string;
  issueCode: string;
  issueDate: string;
  requisitionCode: string;
  productionEntryCode: string;
  userType: string;
  user: string;
  remarks: string;
}

const USER_TYPES = ["Department", "Production", "Employee", "Maintenance", "Other"] as const;
const USER_TYPE_OPTIONS = [{ value: "", label: "User Type" }, ...USER_TYPES.map((t) => ({ value: t, label: t }))];

/** Store issues post the issued quantity out of the store (stock ledger). */
const ISSUE_FORM: DocumentFormConfig = {
  slug: "store-issue",
  title: "Store Issue",
  warehouses: "one",
  warehouseLabel: "Issue from store",
  fulfils: { slug: "store-requisition", label: "Against requisition" },
  subtype: { label: "User type", options: USER_TYPES },
  partyLabel: "Issued to (user / department)",
  referenceLabel: "Production entry no",
};

export default function StoreIssuePage() {
  const [activeTab, setActiveTab] = useState<StoreIssueTab>("APPROVED_REQUISITION");
  const [searchTerm, setSearchTerm] = useState("");

  // Tab 1 Filters
  const [reqFromDate, setReqFromDate] = useState("");
  const [reqToDate, setReqToDate] = useState("");
  const [reqRowsPerPage, setReqRowsPerPage] = useState(50);
  const [reqPage, setReqPage] = useState(1);

  // Tab 2 Filters
  const [issueFromDate, setIssueFromDate] = useState("");
  const [issueToDate, setIssueToDate] = useState("");
  const [issueUserType, setIssueUserType] = useState("");
  const [issueRowsPerPage, setIssueRowsPerPage] = useState(50);
  const [issuePage, setIssuePage] = useState(1);

  // Direct Store Issue Modal
  const [isDirectIssueOpen, setIsDirectIssueOpen] = useState(false);

  // Issue Action Modal (for issuing against approved requisition)
  const [activeRequisitionForIssue, setActiveRequisitionForIssue] = useState<ApprovedRequisitionRow | null>(null);

  const approvedDocs = useResource("store-requisition-approved", () => inventoryApi.list("store-requisition", { status: "APPROVED" }));
  const issueDocs = useResource("store-issue-all", () => inventoryApi.list("store-issue"));
  const reload = () => {
    approvedDocs.reload();
    issueDocs.reload();
  };
  const approvedRows = useMemo<ApprovedRequisitionRow[]>(
    () =>
      (approvedDocs.data ?? []).map((d, i) => ({
        sl: i + 1,
        id: d.id,
        docDate: d.docDate,
        reqCode: d.number,
        date: dmy(d.docDate),
        userType: d.subtype ?? "",
        user: d.partyName ?? "",
        remarks: d.remarks ?? "",
        status: "Approved" as const,
      })),
    [approvedDocs.data],
  );
  const issuedRows = useMemo<IssuedItemRow[]>(
    () =>
      (issueDocs.data ?? []).map((d) => ({
        id: d.id,
        docDate: d.docDate,
        issueCode: d.number,
        issueDate: dmy(d.docDate),
        requisitionCode: d.request?.number ?? "Direct",
        productionEntryCode: d.reference ?? "",
        userType: d.subtype ?? "",
        user: d.partyName ?? "",
        remarks: d.remarks ?? "",
      })),
    [issueDocs.data],
  );

  // Filtered Approved Requisitions
  const filteredApproved = useMemo(() => {
    return approvedRows.filter((row) => {
      if ((reqFromDate && row.docDate < reqFromDate) || (reqToDate && row.docDate > reqToDate)) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          row.reqCode.toLowerCase().includes(s) ||
          row.remarks.toLowerCase().includes(s) ||
          row.status.toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [approvedRows, reqFromDate, reqToDate, searchTerm]);

  const totalReqPages = Math.ceil(filteredApproved.length / reqRowsPerPage) || 1;
  const paginatedApproved = useMemo(() => {
    const start = (reqPage - 1) * reqRowsPerPage;
    return filteredApproved.slice(start, start + reqRowsPerPage);
  }, [filteredApproved, reqPage, reqRowsPerPage]);

  // Filtered Issued Items
  const filteredIssued = useMemo(() => {
    return issuedRows.filter((row) => {
      if (issueUserType && row.userType !== issueUserType) return false;
      if ((issueFromDate && row.docDate < issueFromDate) || (issueToDate && row.docDate > issueToDate)) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          row.issueCode.toLowerCase().includes(s) ||
          row.requisitionCode.toLowerCase().includes(s) ||
          row.productionEntryCode.toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [issuedRows, issueUserType, issueFromDate, issueToDate, searchTerm]);

  const totalIssuePages = Math.ceil(filteredIssued.length / issueRowsPerPage) || 1;
  const paginatedIssued = useMemo(() => {
    const start = (issuePage - 1) * issueRowsPerPage;
    return filteredIssued.slice(start, start + issueRowsPerPage);
  }, [filteredIssued, issuePage, issueRowsPerPage]);

  return (
    <div className="space-y-3 p-1">
      {/* ─────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER                                      */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Store Issue
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

          {/* + Direct Store Issue Button */}
          <button
            type="button"
            onClick={() => setIsDirectIssueOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Direct Store Issue</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 2. TABS NAVIGATION                                 */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-8 text-xs font-bold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => {
            setActiveTab("APPROVED_REQUISITION");
            setReqPage(1);
          }}
          className={`pb-2 transition ${
            activeTab === "APPROVED_REQUISITION"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          APPROVED REQUISITION LIST
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("ISSUED_ITEM");
            setIssuePage(1);
          }}
          className={`pb-2 transition ${
            activeTab === "ISSUED_ITEM"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          ISSUED ITEM
        </button>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 3. TAB 1: APPROVED REQUISITION LIST                 */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "APPROVED_REQUISITION" && (
        <div className="space-y-2">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 text-xs bg-slate-50/70 p-3 rounded border border-slate-200">
            <div>
              <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
              <input
                type="date"
                placeholder="mm/dd/yyyy"
                value={reqFromDate}
                onChange={(e) => setReqFromDate(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
              <input
                type="date"
                placeholder="mm/dd/yyyy"
                value={reqToDate}
                onChange={(e) => setReqToDate(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <button
                type="button"
                className="px-6 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs transition"
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
                  <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-36">Requisition Code</th>
                  <th className="p-2 border border-slate-300 w-24">Date</th>
                  <th className="p-2 border border-slate-300 w-24">User Type</th>
                  <th className="p-2 border border-slate-300 w-24">User</th>
                  <th className="p-2 border border-slate-300">Remarks</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Status</th>
                  <th className="p-2 border border-slate-300 w-28 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {paginatedApproved.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No approved requisitions pending issue.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedApproved.map((row) => (
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
                        <span className="text-emerald-600 font-semibold text-[11px]">
                          {row.status}
                        </span>
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveRequisitionForIssue(row)}
                            className="h-6 px-2.5 bg-[#2563eb] hover:bg-blue-700 text-white text-[11px] font-semibold rounded flex items-center gap-1 shadow-2xs transition"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Issue</span>
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600 text-slate-600"
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

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={reqRowsPerPage}
                onChange={(e) => {
                  setReqRowsPerPage(Number(e.target.value));
                  setReqPage(1);
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
                {filteredApproved.length === 0
                  ? "0-0 of 0"
                  : `${(reqPage - 1) * reqRowsPerPage + 1}-${Math.min(reqPage * reqRowsPerPage, filteredApproved.length)} of ${filteredApproved.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={reqPage <= 1}
                  onClick={() => setReqPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={reqPage >= totalReqPages}
                  onClick={() => setReqPage((p) => Math.min(totalReqPages, p + 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 4. TAB 2: ISSUED ITEM                               */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "ISSUED_ITEM" && (
        <div className="space-y-2">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 text-xs bg-slate-50/70 p-3 rounded border border-slate-200">
            <div>
              <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
              <input
                type="date"
                placeholder="mm/dd/yyyy"
                value={issueFromDate}
                onChange={(e) => setIssueFromDate(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
              <input
                type="date"
                placeholder="mm/dd/yyyy"
                value={issueToDate}
                onChange={(e) => setIssueToDate(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="min-w-[160px]">
              <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">User Type</label>
              <select
                value={issueUserType}
                onChange={(e) => setIssueUserType(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              >
                {USER_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                type="button"
                className="px-6 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs transition"
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
                  <th className="p-2 border border-slate-300 w-36">Issue Code</th>
                  <th className="p-2 border border-slate-300 w-24">Issue Date</th>
                  <th className="p-2 border border-slate-300 w-36">Requisition Code</th>
                  <th className="p-2 border border-slate-300 w-36">Production Entry Code</th>
                  <th className="p-2 border border-slate-300 w-24">User Type</th>
                  <th className="p-2 border border-slate-300 w-24">User</th>
                  <th className="p-2 border border-slate-300">Remarks</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {paginatedIssued.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No issued records found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedIssued.map((row) => (
                    <tr key={row.issueCode} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {row.issueCode}
                      </td>
                      <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                        {row.issueDate}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                        {row.requisitionCode}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                        {row.productionEntryCode}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        {row.userType}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        {row.user}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        {row.remarks}
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-600">
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

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={issueRowsPerPage}
                onChange={(e) => {
                  setIssueRowsPerPage(Number(e.target.value));
                  setIssuePage(1);
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
                {filteredIssued.length === 0
                  ? "0-0 of 0"
                  : `${(issuePage - 1) * issueRowsPerPage + 1}-${Math.min(issuePage * issueRowsPerPage, filteredIssued.length)} of ${filteredIssued.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={issuePage <= 1}
                  onClick={() => setIssuePage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={issuePage >= totalIssuePages}
                  onClick={() => setIssuePage((p) => Math.min(totalIssuePages, p + 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 5. MODAL: ISSUE AGAINST REQUISITION                 */}
      {/* ─────────────────────────────────────────────────── */}
      <InventoryDocumentDialog
        open={!!activeRequisitionForIssue || isDirectIssueOpen}
        onClose={() => {
          setActiveRequisitionForIssue(null);
          setIsDirectIssueOpen(false);
        }}
        onSaved={reload}
        initialRequestId={activeRequisitionForIssue?.id}
        config={ISSUE_FORM}
      />
    </div>
  );
}
