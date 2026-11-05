"use client";

import React, { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import type { InventoryDocument } from "@/features/inventory/schemas/document.schema";
import { dmy, inventoryApi, monthAgo, today } from "@/features/inventory/services/inventory.api";
import {
  Search,
  Plus,
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
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [page, setPage] = useState(1);

  // Modal State for "+ Create Get In Out"
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const tabs: { id: GateTab; label: string }[] = [
    { id: "GATE_IN", label: "GATE IN" },
    { id: "GATE_OUT", label: "GATE OUT" },
    { id: "VISITOR", label: "VISITOR" },
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
    <div className="space-y-3 p-1">
      {/* ─────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER                                      */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Gate In Out
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

          {/* + Create Get In Out Button */}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Get In Out</span>
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
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
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

      {/* ─────────────────────────────────────────────────── */}
      {/* 3. FILTER BAR (Matches Screenshots)                */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="bg-slate-50/70 p-3 rounded border border-slate-200 flex flex-wrap items-end gap-4 text-xs">
        {/* Reference Type (Shown for GATE IN & GATE OUT) */}
        {(activeTab === "GATE_IN" || activeTab === "GATE_OUT") && (
          <div className="min-w-[200px]">
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">Reference Type</label>
            <select
              value={refType}
              onChange={(e) => setRefType(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-700"
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
          <label className="block text-[11px] text-slate-600 mb-1 font-medium">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* To Date */}
        <div>
          <label className="block text-[11px] text-slate-600 mb-1 font-medium">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
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
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isDetails" className="text-slate-700 font-medium cursor-pointer">
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
        <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
          <table className="erp-table w-full text-left text-xs border-collapse">
            <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
              <tr>
                <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                <th className="p-2 border border-slate-300 w-36">Gate Pass No</th>
                <th className="p-2 border border-slate-300 w-28">Ref Type</th>
                <th className="p-2 border border-slate-300 w-32">Ref No</th>
                <th className="p-2 border border-slate-300 w-24">Date</th>
                <th className="p-2 border border-slate-300 w-20">Time</th>
                <th className="p-2 border border-slate-300 w-32">Vehicle No</th>
                <th className="p-2 border border-slate-300">Driver & Phone</th>
                <th className="p-2 border border-slate-300">Party / Supplier</th>
                <th className="p-2 border border-slate-300">Purpose</th>
                <th className="p-2 border border-slate-300 w-20 text-center">Status</th>
                <th className="p-2 border border-slate-300 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
              {filteredGateIn.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                      <span className="text-sm font-medium">No Gate In records found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGateIn.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.gatePassNo}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.refType}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                      {row.refNo}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.date}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.time}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800">
                      {row.vehicleNo}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      <div>{row.driverName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{row.driverPhone}</div>
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.partyName}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.purpose}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        <button type="button" className="p-1 hover:text-blue-600" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-1 hover:text-blue-600" title="Print">
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
        <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
          <table className="erp-table w-full text-left text-xs border-collapse">
            <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
              <tr>
                <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                <th className="p-2 border border-slate-300 w-36">Gate Pass No</th>
                <th className="p-2 border border-slate-300 w-28">Ref Type</th>
                <th className="p-2 border border-slate-300 w-32">Ref No</th>
                <th className="p-2 border border-slate-300 w-24">Date</th>
                <th className="p-2 border border-slate-300 w-20">Time</th>
                <th className="p-2 border border-slate-300 w-32">Vehicle No</th>
                <th className="p-2 border border-slate-300">Driver & Phone</th>
                <th className="p-2 border border-slate-300">Destination / Party</th>
                <th className="p-2 border border-slate-300">Purpose</th>
                <th className="p-2 border border-slate-300 w-20 text-center">Status</th>
                <th className="p-2 border border-slate-300 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
              {filteredGateOut.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                      <span className="text-sm font-medium">No Gate Out records found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGateOut.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.gatePassNo}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.refType}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                      {row.refNo}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.date}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.time}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800">
                      {row.vehicleNo}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      <div>{row.driverName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{row.driverPhone}</div>
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.partyName}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.purpose}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        <button type="button" className="p-1 hover:text-blue-600" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-1 hover:text-blue-600" title="Print">
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
        <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
          <table className="erp-table w-full text-left text-xs border-collapse">
            <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
              <tr>
                <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                <th className="p-2 border border-slate-300 w-32">Pass No</th>
                <th className="p-2 border border-slate-300 w-24">Date</th>
                <th className="p-2 border border-slate-300 w-20">In Time</th>
                <th className="p-2 border border-slate-300 w-20">Out Time</th>
                <th className="p-2 border border-slate-300">Visitor Name</th>
                <th className="p-2 border border-slate-300">Company</th>
                <th className="p-2 border border-slate-300 w-28">Contact</th>
                <th className="p-2 border border-slate-300">Person to Meet</th>
                <th className="p-2 border border-slate-300">Department</th>
                <th className="p-2 border border-slate-300">Purpose</th>
                <th className="p-2 border border-slate-300 w-16 text-center">Badge</th>
                <th className="p-2 border border-slate-300 w-20 text-center">Status</th>
                <th className="p-2 border border-slate-300 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
              {filteredVisitors.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                      <span className="text-sm font-medium">No visitor records found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVisitors.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.visitorPassNo}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.date}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.inTime}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.outTime || "—"}
                    </td>
                    <td className="p-2 border border-slate-300 font-medium text-slate-900">
                      {row.visitorName}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.companyName}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-700">
                      {row.contactNo}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.personToMeet}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.department}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.purpose}
                    </td>
                    <td className="p-2 border border-slate-300 text-center font-mono font-bold text-slate-800">
                      {row.badgeNo}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          row.status === "Inside"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        {row.status === "Inside" && (
                          <button
                            type="button"
                            disabled={exitingId === row.id}
                            onClick={() => markExit(row)}
                            className="px-1.5 py-0.5 rounded bg-slate-700 text-white text-[10px] font-semibold disabled:opacity-50"
                          >
                            Mark Exit
                          </button>
                        )}
                        <button type="button" className="p-1 hover:text-blue-600" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-1 hover:text-blue-600" title="Print">
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
          title: "Create Gate In / Out Entry",
          warehouses: "none",
          linesOptional: true,
          subtype: { label: "Movement type", options: ["Gate In", "Gate Out", "Visitor"] },
          partyLabel: "Party / visitor name",
          referenceLabel: "Reference no",
          meta: [
            { key: "refType", label: "Reference type", when: GOODS },
            { key: "vehicleNo", label: "Vehicle no", when: GOODS },
            { key: "driverName", label: "Driver name", when: GOODS },
            { key: "driverPhone", label: "Driver phone", when: GOODS },
            { key: "companyName", label: "Visitor company", when: ["Visitor"] },
            { key: "contactNo", label: "Contact no", when: ["Visitor"] },
            { key: "personToMeet", label: "Person to meet", when: ["Visitor"] },
            { key: "department", label: "Department", when: ["Visitor"] },
            { key: "badgeNo", label: "Badge no", when: ["Visitor"] },
            { key: "purpose", label: "Purpose" },
          ],
        }}
      />
    </div>
  );
}
