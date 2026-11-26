"use client";

import React, { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { InventoryTabBar, tabBarButton } from "@/features/inventory/components/InventoryTabBar";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import type { InventoryDocument } from "@/features/inventory/schemas/document.schema";
import { dmy, inventoryApi, monthAgo, today } from "@/features/inventory/services/inventory.api";
import {
  Plus,
  Printer,
  Eye,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { NativeDateInput } from "@/components/ui/date-input";

// ============================================================================
// TYPES
// ============================================================================
type GateTab = "GATE_IN" | "GATE_OUT" | "VISITOR";

interface GatePassRow {
  sl: number;
  id: string;
  docDate: string;
  gatePassNo: string;
  refType: string;
  refNo: string;
  date: string;
  time: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  partyName: string;
  purpose: string;
  totalItems: number;
  status: "In" | "Out" | "Pending" | "Cleared";
}

interface VisitorRow {
  sl: number;
  id: string;
  docDate: string;
  visitorPassNo: string;
  date: string;
  inTime: string;
  outTime: string;
  visitorName: string;
  companyName: string;
  contactNo: string;
  personToMeet: string;
  department: string;
  purpose: string;
  badgeNo: string;
  status: "Inside" | "Exited";
}

const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");

function toGateRow(d: InventoryDocument, i: number): GatePassRow {
  return {
    sl: i + 1,
    id: d.id,
    docDate: d.docDate,
    gatePassNo: d.number,
    refType: d.meta?.refType ?? "",
    refNo: d.reference ?? "",
    date: dmy(d.docDate),
    time: timeOf(d.createdAt),
    vehicleNo: d.meta?.vehicleNo ?? "",
    driverName: d.meta?.driverName ?? "",
    driverPhone: d.meta?.driverPhone ?? "",
    partyName: d.partyName ?? "",
    purpose: d.meta?.purpose ?? "",
    totalItems: d.totalQty,
    status: d.subtype === "Gate Out" ? "Out" : "In",
  };
}

function toVisitorRow(d: InventoryDocument, i: number): VisitorRow {
  return {
    sl: i + 1,
    id: d.id,
    docDate: d.docDate,
    visitorPassNo: d.number,
    date: dmy(d.docDate),
    inTime: timeOf(d.createdAt),
    outTime: timeOf(d.completedAt),
    visitorName: d.partyName ?? "",
    companyName: d.meta?.companyName ?? "",
    contactNo: d.meta?.contactNo ?? "",
    personToMeet: d.meta?.personToMeet ?? "",
    department: d.meta?.department ?? "",
    purpose: d.meta?.purpose ?? "",
    badgeNo: d.meta?.badgeNo ?? "",
    status: d.status === "COMPLETED" ? "Exited" : "Inside",
  };
}

const GOODS = ["Gate In", "Gate Out"] as const;

export default function GateInOutPage() {
  const perms = useFeaturePermissions("/inventory/gate-in-out");
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<GateTab>("GATE_IN");
  const docs = useResource("gate-in-out-all", () => inventoryApi.list("gate-in-out"));
  const all = useMemo(() => docs.data ?? [], [docs.data]);
  const gateInRows = useMemo(() => all.filter((d) => d.subtype === "Gate In").map(toGateRow), [all]);
  const gateOutRows = useMemo(() => all.filter((d) => d.subtype === "Gate Out").map(toGateRow), [all]);
  const visitorRows = useMemo(() => all.filter((d) => d.subtype === "Visitor").map(toVisitorRow), [all]);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const markExit = async (row: VisitorRow) => {
    setExitingId(row.id);
    try {
      await inventoryApi.completeGatePass(row.id);
      toast.success(`${row.visitorName} has left.`);
      docs.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExitingId(null);
    }
  };
  const [searchTerm, setSearchTerm] = useState("");

  // Filters matching screenshot
  const [refType, setRefType] = useState("");
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate, setToDate] = useState(today());
  const [isDetails, setIsDetails] = useState(false);

  // Pagination
  const [, setPage] = useState(1);

  // Modal State for "+ Create Get In Out"
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const tabs: { id: GateTab; label: string }[] = [
    { id: "GATE_IN", label: "Gate In" },
    { id: "GATE_OUT", label: "Gate Out" },
    { id: "VISITOR", label: "Visitor" },
  ];

  // Filtering Gate In
  const filteredGateIn = useMemo(() => {
    return gateInRows.filter((row) => {
      if ((fromDate && row.docDate < fromDate) || (toDate && row.docDate > toDate)) return false;
      if (refType && row.refType !== refType) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          row.gatePassNo.toLowerCase().includes(s) ||
          row.refNo.toLowerCase().includes(s) ||
          row.vehicleNo.toLowerCase().includes(s) ||
          row.driverName.toLowerCase().includes(s) ||
          row.partyName.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [gateInRows, fromDate, toDate, refType, searchTerm]);

  // Filtering Gate Out
  const filteredGateOut = useMemo(() => {
    return gateOutRows.filter((row) => {
      if ((fromDate && row.docDate < fromDate) || (toDate && row.docDate > toDate)) return false;
      if (refType && row.refType !== refType) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          row.gatePassNo.toLowerCase().includes(s) ||
          row.refNo.toLowerCase().includes(s) ||
          row.vehicleNo.toLowerCase().includes(s) ||
          row.driverName.toLowerCase().includes(s) ||
          row.partyName.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [gateOutRows, fromDate, toDate, refType, searchTerm]);

  // Filtering Visitor
  const filteredVisitors = useMemo(() => {
    return visitorRows.filter((row) => {
      if ((fromDate && row.docDate < fromDate) || (toDate && row.docDate > toDate)) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          row.visitorPassNo.toLowerCase().includes(s) ||
          row.visitorName.toLowerCase().includes(s) ||
          row.companyName.toLowerCase().includes(s) ||
          row.personToMeet.toLowerCase().includes(s) ||
          row.department.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [visitorRows, fromDate, toDate, searchTerm]);

  return (
    <div className="bg-surface space-y-2 p-3 flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      <InventoryTabBar
        title="Gate In Out"
        tabs={tabs}
        active={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setPage(1);
        }}
        search={searchTerm}
        onSearch={setSearchTerm}
        actions={
          <>
            {perms.import && (<button type="button" onClick={() => setBulkOpen(true)} className={tabBarButton} title="Bulk upload from Excel">
              <Upload /> Bulk Upload
            </button>)}
            {perms.create ? (<button type="button" onClick={() => setIsCreateOpen(true)} className={tabBarButton}>
            <Plus /> Create Get In Out
          </button>) : null}
          </>
        }
      />
      {/* 3. FILTER BAR (Matches Screenshots)                */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="py-1.5 flex flex-wrap items-end gap-4 text-xs shrink-0">
        {/* Reference Type (Shown for GATE IN & GATE OUT) */}
        {(activeTab === "GATE_IN" || activeTab === "GATE_OUT") && (
          <div className="min-w-[200px]">
            <label className="block text-[11px] text-ink-muted mb-1 font-medium">Reference Type</label>
            <select
              value={refType}
              onChange={(e) => setRefType(e.target.value)}
              className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
            >
              <option value="">Reference Type</option>
              {activeTab === "GATE_IN" ? (
                <>
                  <option value="Purchase Order">Purchase Order</option>
                  <option value="Transfer In">Transfer In</option>
                  <option value="Others">Others</option>
                </>
              ) : (
                <>
                  <option value="Stock Transfer">Stock Transfer</option>
                  <option value="Sales Delivery">Sales Delivery</option>
                  <option value="Return to Vendor">Return to Vendor</option>
                  <option value="Others">Others</option>
                </>
              )}
            </select>
          </div>
        )}

        {/* From Date */}
        <div>
          <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Date</label>
          <NativeDateInput
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* To Date */}
        <div>
          <label className="block text-[11px] text-ink-muted mb-1 font-medium">To Date</label>
          <NativeDateInput
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Is Details Checkbox (on Gate In & Gate Out) */}
        {(activeTab === "GATE_IN" || activeTab === "GATE_OUT") && (
          <div className="flex items-center gap-1.5 pb-2">
            <input
              type="checkbox"
              id="isDetails"
              checked={isDetails}
              onChange={(e) => setIsDetails(e.target.checked)}
              className="rounded border-line-strong text-blue-600 dark:text-blue-400 focus:ring-blue-500"
            />
            <label htmlFor="isDetails" className="text-ink-muted font-medium cursor-pointer">
              Is Details
            </label>
          </div>
        )}

        {/* View Button */}
        <div>
          <button
            type="button"
            className="px-6 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs transition"
          >
            View
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 4. TAB CONTENT                                      */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "GATE_IN" && (
        <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
          <table className="erp-table w-full text-left text-xs border-collapse">
            <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
              <tr>
                <th className="px-2.5 py-2 border-b border-line w-12 text-center">SL</th>
                <th className="px-2.5 py-2 border-b border-line w-36">Gate Pass No</th>
                <th className="px-2.5 py-2 border-b border-line w-28">Ref Type</th>
                <th className="px-2.5 py-2 border-b border-line w-32">Ref No</th>
                <th className="px-2.5 py-2 border-b border-line w-24">Date</th>
                <th className="px-2.5 py-2 border-b border-line w-20">Time</th>
                <th className="px-2.5 py-2 border-b border-line w-32">Vehicle No</th>
                <th className="px-2.5 py-2 border-b border-line">Driver & Phone</th>
                <th className="px-2.5 py-2 border-b border-line">Party / Supplier</th>
                <th className="px-2.5 py-2 border-b border-line">Purpose</th>
                <th className="px-2.5 py-2 border-b border-line w-20 text-center">Status</th>
                <th className="px-2.5 py-2 border-b border-line w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[11px] text-ink">
              {filteredGateIn.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-ink-faint">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                      <span className="text-sm font-medium">No Gate In records found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGateIn.map((row) => (
                  <tr key={row.sl} className="hover:bg-canvas/80 transition-colors">
                    <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                      {row.sl}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                      {row.gatePassNo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.refType}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono text-ink whitespace-nowrap">
                      {row.refNo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.date}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.time}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono text-ink">
                      {row.vehicleNo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      <div>{row.driverName}</div>
                      <div className="text-[10px] text-ink-faint font-mono">{row.driverPhone}</div>
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.partyName}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.purpose}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <div className="row-actions flex items-center justify-center gap-1.5 text-ink-muted">
                        <button type="button" className="p-1 hover:text-blue-600 dark:hover:text-blue-400" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-1 hover:text-blue-600 dark:hover:text-blue-400" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "GATE_OUT" && (
        <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
          <table className="erp-table w-full text-left text-xs border-collapse">
            <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
              <tr>
                <th className="px-2.5 py-2 border-b border-line w-12 text-center">SL</th>
                <th className="px-2.5 py-2 border-b border-line w-36">Gate Pass No</th>
                <th className="px-2.5 py-2 border-b border-line w-28">Ref Type</th>
                <th className="px-2.5 py-2 border-b border-line w-32">Ref No</th>
                <th className="px-2.5 py-2 border-b border-line w-24">Date</th>
                <th className="px-2.5 py-2 border-b border-line w-20">Time</th>
                <th className="px-2.5 py-2 border-b border-line w-32">Vehicle No</th>
                <th className="px-2.5 py-2 border-b border-line">Driver & Phone</th>
                <th className="px-2.5 py-2 border-b border-line">Destination / Party</th>
                <th className="px-2.5 py-2 border-b border-line">Purpose</th>
                <th className="px-2.5 py-2 border-b border-line w-20 text-center">Status</th>
                <th className="px-2.5 py-2 border-b border-line w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[11px] text-ink">
              {filteredGateOut.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-ink-faint">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                      <span className="text-sm font-medium">No Gate Out records found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGateOut.map((row) => (
                  <tr key={row.sl} className="hover:bg-canvas/80 transition-colors">
                    <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                      {row.sl}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                      {row.gatePassNo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.refType}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono text-ink whitespace-nowrap">
                      {row.refNo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.date}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.time}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono text-ink">
                      {row.vehicleNo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      <div>{row.driverName}</div>
                      <div className="text-[10px] text-ink-faint font-mono">{row.driverPhone}</div>
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.partyName}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.purpose}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <div className="row-actions flex items-center justify-center gap-1.5 text-ink-muted">
                        <button type="button" className="p-1 hover:text-blue-600 dark:hover:text-blue-400" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-1 hover:text-blue-600 dark:hover:text-blue-400" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "VISITOR" && (
        <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
          <table className="erp-table w-full text-left text-xs border-collapse">
            <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
              <tr>
                <th className="px-2.5 py-2 border-b border-line w-12 text-center">SL</th>
                <th className="px-2.5 py-2 border-b border-line w-32">Pass No</th>
                <th className="px-2.5 py-2 border-b border-line w-24">Date</th>
                <th className="px-2.5 py-2 border-b border-line w-20">In Time</th>
                <th className="px-2.5 py-2 border-b border-line w-20">Out Time</th>
                <th className="px-2.5 py-2 border-b border-line">Visitor Name</th>
                <th className="px-2.5 py-2 border-b border-line">Company</th>
                <th className="px-2.5 py-2 border-b border-line w-28">Contact</th>
                <th className="px-2.5 py-2 border-b border-line">Person to Meet</th>
                <th className="px-2.5 py-2 border-b border-line">Department</th>
                <th className="px-2.5 py-2 border-b border-line">Purpose</th>
                <th className="px-2.5 py-2 border-b border-line w-16 text-center">Badge</th>
                <th className="px-2.5 py-2 border-b border-line w-20 text-center">Status</th>
                <th className="px-2.5 py-2 border-b border-line w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[11px] text-ink">
              {filteredVisitors.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-ink-faint">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                      <span className="text-sm font-medium">No visitor records found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVisitors.map((row) => (
                  <tr key={row.sl} className="hover:bg-canvas/80 transition-colors">
                    <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                      {row.sl}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                      {row.visitorPassNo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.date}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.inTime}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                      {row.outTime || "—"}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-medium text-ink">
                      {row.visitorName}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.companyName}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line font-mono text-ink-muted">
                      {row.contactNo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.personToMeet}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.department}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                      {row.purpose}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center font-mono font-bold text-ink">
                      {row.badgeNo}
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          row.status === "Inside"
                            ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                            : "bg-canvas text-ink-muted border-line"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 border-b border-line text-center">
                      <div className="row-actions flex items-center justify-center gap-1.5 text-ink-muted">
                        {row.status === "Inside" && (
                          <button title={!perms.edit ? needsPermission("edit") : undefined}
                            type="button"
                            disabled={(exitingId === row.id) || !perms.edit}
                            onClick={() => markExit(row)}
                            className="px-1.5 py-0.5 rounded bg-slate-700 text-white text-[10px] font-semibold disabled:opacity-50"
                          >
                            Mark Exit
                          </button>
                        )}
                        <button type="button" className="p-1 hover:text-blue-600 dark:hover:text-blue-400" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-1 hover:text-blue-600 dark:hover:text-blue-400" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 5. + CREATE MODAL                                   */}
      {/* ─────────────────────────────────────────────────── */}
      <InventoryDocumentDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => docs.reload()}
        config={{
          slug: "gate-in-out",
          title: "Create Gate In Out",
          warehouses: "none",
          linesOptional: true,
          subtype: { label: "Movement type", options: ["Gate In", "Gate Out", "Visitor"], radio: true },
          fields: [
            { key: "office", label: "Office", kind: "office", required: true },
            { key: "refType", label: "Reference Type", kind: "select", options: ["Purchase Order", "Transfer In", "Others"], required: true, when: GOODS },
            { key: "referenceNo", label: "Reference No", kind: "text", saveAs: "reference", when: GOODS },
            { key: "fromAddress", label: "From Address", kind: "text", when: GOODS },
            { key: "toAddress", label: "To Address", kind: "text", when: GOODS },
            { key: "vehicleNo", label: "Vehicle No", kind: "vehicle", when: GOODS },
            { key: "vehicleType", label: "Vehicle Type", kind: "text", when: GOODS },
            { key: "vehicleSize", label: "Vehicle Size", kind: "text", when: GOODS },
            { key: "driverName", label: "Driver Name", kind: "text", when: GOODS },
            { key: "driverPhone", label: "Driver Mobile No", kind: "text", when: GOODS },
            { key: "visitorName", label: "Visitor Name", kind: "text", required: true, saveAs: "partyName", when: ["Visitor"] },
            { key: "companyName", label: "Visitor Company", kind: "text", when: ["Visitor"] },
            { key: "contactNo", label: "Contact No", kind: "text", when: ["Visitor"] },
            { key: "personToMeet", label: "Person to Meet", kind: "employee", when: ["Visitor"] },
            { key: "purpose", label: "Purpose", kind: "text", when: ["Visitor"] },
            { key: "idCardNo", label: "Visiting/ID Card No", kind: "text" },
            { key: "uom", label: "UOM", kind: "uom", when: GOODS },
            { key: "weightBefore", label: "Weight Of Scale (Before)", kind: "number", when: GOODS },
            { key: "weightAfter", label: "Weight Of Scale (After)", kind: "number", when: GOODS },
          ],
          columns: ["name", "uom", "qty"],
        }}
      />
      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => docs.reload()}
        noun="gate passes"
        templateUrl={inventoryApi.importTemplateUrl("gate-in-out")}
        maxRows={2000}
        matchHint="Type must be Gate In, Gate Out or Visitor. Visitor passes need Party / For (visitor name) and cannot carry items. One Ref per gate pass."
        upload={(file) => inventoryApi.importFile("gate-in-out", file)}
      />
    </div>
  );
}
