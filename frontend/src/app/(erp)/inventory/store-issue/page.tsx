"use client";

import React, { useState, useMemo } from "react";
import { useResource } from "@/hooks/use-resource";
import { InventoryTabBar, tabBarButton } from "@/features/inventory/components/InventoryTabBar";
import { InventoryDocumentDialog, type DocumentFormConfig } from "@/features/inventory/components/InventoryDocumentDialog";
import { dmy, inventoryApi } from "@/features/inventory/services/inventory.api";
import {
  Plus,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Paperclip,
  Upload,
} from "lucide-react";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { NativeDateInput } from "@/components/ui/date-input";

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
  /** Attached file (PDF or image), if any. */
  attachment: { id: string; name: string } | null;
}

const USER_TYPES = ["Employee", "Department", "Project"] as const;
const USER_TYPE_OPTIONS = [{ value: "", label: "User Type" }, ...USER_TYPES.map((t) => ({ value: t, label: t }))];

/** Store issues post the issued quantity out of the store (stock ledger). */
const ISSUE_FORM: DocumentFormConfig = {
  slug: "store-issue",
  title: "Create Store Issue",
  warehouses: "one",
  offices: true,
  dateLabel: "Issue Date",
  fulfils: { slug: "store-requisition", label: "Requisition Code" },
  // iBOS: Employee / Department / Project radio; Issue For is the expense account charged.
  subtype: { label: "User Type", options: USER_TYPES, radio: true },
  fields: [
    { key: "createDate", label: "Create Date", kind: "date", required: true },
    { key: "employee", label: "Employee", kind: "employee", required: true, saveAs: "partyName", when: ["Employee"] },
    { key: "department", label: "Department", kind: "department", required: true, saveAs: "partyName", when: ["Department"] },
    { key: "project", label: "Project", kind: "project", required: true, saveAs: "partyName", when: ["Project"] },
    { key: "issueType", label: "Issue Type", kind: "select", options: ["Others"], defaultValue: "Others" },
    { key: "issueFor", label: "Issue For", kind: "expenseHead", required: true, placeholder: "Chart Of Accounts" },
    { key: "receiveBy", label: "Receive By", kind: "employee" },
    { key: "attachment", label: "Attachment", kind: "file" },
  ],
  columns: ["code", "name", "cost", "amount", "uom", "qty"],
  columnLabels: { code: "Code", name: "Item", cost: "Avg. Cost", amount: "Issue Amount", qty: "Quantity" },
  qtyLabel: "Issue Quantity",
};

export default function StoreIssuePage() {
  const perms = useFeaturePermissions("/inventory/store-issue");
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
  const [bulkOpen, setBulkOpen] = useState(false);

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
        attachment: d.meta?.attachment ? { id: d.meta.attachment, name: d.meta.attachmentName ?? "Attachment" } : null,
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
    <div className="space-y-3 p-1 flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      <InventoryTabBar
        title="Store Issue"
        tabs={[
          { id: "APPROVED_REQUISITION", label: "APPROVED REQUISITION LIST" },
          { id: "ISSUED_ITEM", label: "ISSUED ITEM" },
        ]}
        active={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          if (id === "APPROVED_REQUISITION") setReqPage(1);
          else setIssuePage(1);
        }}
        search={searchTerm}
        onSearch={setSearchTerm}
        actions={
          <>
            {perms.import && (<button type="button" onClick={() => setBulkOpen(true)} className={tabBarButton} title="Bulk upload from Excel">
              <Upload /> Bulk Upload
            </button>)}
            {perms.create ? (<button type="button" onClick={() => setIsDirectIssueOpen(true)} className={tabBarButton}>
            <Plus /> Direct Store Issue
          </button>) : null}
          </>
        }
      />
      {/* 3. TAB 1: APPROVED REQUISITION LIST                 */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "APPROVED_REQUISITION" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 text-xs bg-canvas/70 p-3 rounded border border-line shrink-0">
            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">From Date</label>
              <NativeDateInput
                type="date"
                placeholder="mm/dd/yyyy"
                value={reqFromDate}
                onChange={(e) => setReqFromDate(e.target.value)}
                className="border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">To Date</label>
              <NativeDateInput
                type="date"
                placeholder="mm/dd/yyyy"
                value={reqToDate}
                onChange={(e) => setReqToDate(e.target.value)}
                className="border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
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
          <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                <tr>
                  <th className="px-2.5 py-2 border-b border-line w-12 text-center">SL</th>
                  <th className="px-2.5 py-2 border-b border-line w-36">Requisition Code</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Date</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">User Type</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">User</th>
                  <th className="px-2.5 py-2 border-b border-line">Remarks</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-center">Status</th>
                  <th className="px-2.5 py-2 border-b border-line w-28 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {paginatedApproved.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-ink-faint">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No approved requisitions pending issue.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedApproved.map((row) => (
                    <tr key={row.sl} className="hover:bg-canvas/80 transition-colors">
                      <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                        {row.sl}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                        {row.reqCode}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                        {row.date}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                        {row.userType}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                        {row.user}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-ink">
                        {row.remarks}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-center">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-center">
                        <div className="row-actions flex items-center justify-center gap-1.5">
                          <button title={!perms.create ? needsPermission("create") : undefined} disabled={!perms.create}
                            type="button"
                            onClick={() => setActiveRequisitionForIssue(row)}
                            className="h-6 px-2.5 bg-[#2563eb] hover:bg-blue-700 text-white text-[11px] font-semibold rounded flex items-center gap-1 shadow-2xs transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Issue</span>
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600 dark:hover:text-blue-400 text-ink-muted"
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
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-ink-muted pt-1 shrink-0">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={reqRowsPerPage}
                onChange={(e) => {
                  setReqRowsPerPage(Number(e.target.value));
                  setReqPage(1);
                }}
                className="border border-line-strong rounded px-1.5 py-0.5 bg-surface text-xs"
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
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={reqPage >= totalReqPages}
                  onClick={() => setReqPage((p) => Math.min(totalReqPages, p + 1))}
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
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
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 text-xs bg-canvas/70 p-3 rounded border border-line shrink-0">
            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">From Date</label>
              <NativeDateInput
                type="date"
                placeholder="mm/dd/yyyy"
                value={issueFromDate}
                onChange={(e) => setIssueFromDate(e.target.value)}
                className="border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">To Date</label>
              <NativeDateInput
                type="date"
                placeholder="mm/dd/yyyy"
                value={issueToDate}
                onChange={(e) => setIssueToDate(e.target.value)}
                className="border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="min-w-[160px]">
              <label className="block text-[11px] text-ink-muted mb-0.5 font-medium">User Type</label>
              <select
                value={issueUserType}
                onChange={(e) => setIssueUserType(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
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
          <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                <tr>
                  <th className="px-2.5 py-2 border-b border-line w-36">Issue Code</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Issue Date</th>
                  <th className="px-2.5 py-2 border-b border-line w-36">Requisition Code</th>
                  <th className="px-2.5 py-2 border-b border-line w-36">Production Entry Code</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">User Type</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">User</th>
                  <th className="px-2.5 py-2 border-b border-line">Remarks</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {paginatedIssued.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-ink-faint">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No issued records found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedIssued.map((row) => (
                    <tr key={row.issueCode} className="hover:bg-canvas/80 transition-colors">
                      <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                        {row.issueCode}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                        {row.issueDate}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line font-mono text-ink whitespace-nowrap">
                        {row.requisitionCode}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line font-mono text-ink whitespace-nowrap">
                        {row.productionEntryCode}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                        {row.userType}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                        {row.user}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                        {row.remarks}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-center">
                        <div className="row-actions flex items-center justify-center gap-1.5 text-ink-muted">
                          {row.attachment && (
                            <a
                              href={`/api/inventory/store-issue/attachments/${row.attachment.id}`}
                              className="inline-flex size-6 items-center justify-center rounded hover:text-blue-600 dark:hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
                              title={row.attachment.name}
                              aria-label={`Download ${row.attachment.name}`}
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Print"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600 dark:hover:text-blue-400"
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
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-ink-muted pt-1 shrink-0">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={issueRowsPerPage}
                onChange={(e) => {
                  setIssueRowsPerPage(Number(e.target.value));
                  setIssuePage(1);
                }}
                className="border border-line-strong rounded px-1.5 py-0.5 bg-surface text-xs"
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
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={issuePage >= totalIssuePages}
                  onClick={() => setIssuePage((p) => Math.min(totalIssuePages, p + 1))}
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={reload}
        noun="store issues"
        templateUrl={inventoryApi.importTemplateUrl("store-issue")}
        maxRows={2000}
        matchHint="Warehouse names must match existing warehouses; Item Code must match an active item. Rows with the same Ref are saved as one issue; use Request Number to fulfil an approved requisition."
        upload={(file) => inventoryApi.importFile("store-issue", file)}
      />
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
