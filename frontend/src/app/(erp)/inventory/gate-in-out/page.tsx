"use client";

import React, { useState, useMemo } from "react";
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

// ============================================================================
// SAMPLE DATA
// ============================================================================
const MOCK_GATE_IN: GatePassRow[] = [
  {
    sl: 1,
    gatePassNo: "GIN-MG261000108",
    refType: "Purchase Order",
    refNo: "PO-MG260900084",
    date: "14-10-2026",
    time: "08:45 AM",
    vehicleNo: "DM-UA-18-9941",
    driverName: "Mofiz Uddin",
    driverPhone: "01711-234567",
    partyName: "Meghna Flour Mills Ltd.",
    purpose: "Raw Material Delivery",
    totalItems: 250,
    status: "In",
  },
  {
    sl: 2,
    gatePassNo: "GIN-MG261000107",
    refType: "Transfer In",
    refNo: "ITO-MG261000039",
    date: "13-10-2026",
    time: "02:15 PM",
    vehicleNo: "DM-DA-14-3321",
    driverName: "Kalam Sheikh",
    driverPhone: "01819-876543",
    partyName: "MG Sirajganj Factory (Branch)",
    purpose: "Inter-store Transfer Receipt",
    totalItems: 1040,
    status: "Cleared",
  },
  {
    sl: 3,
    gatePassNo: "GIN-MG261000106",
    refType: "Others",
    refNo: "CH-2026-902",
    date: "13-10-2026",
    time: "11:30 AM",
    vehicleNo: "DHAKA METRO-TA-12-8812",
    driverName: "Rashid Mia",
    driverPhone: "01912-345678",
    partyName: "Crown Corrugation Industries",
    purpose: "Printed Master Cartons delivery",
    totalItems: 1500,
    status: "Cleared",
  },
  {
    sl: 4,
    gatePassNo: "GIN-MG261000105",
    refType: "Purchase Order",
    refNo: "PO-MG260900078",
    date: "12-10-2026",
    time: "09:10 AM",
    vehicleNo: "DM-NA-11-4091",
    driverName: "Anwar Hossain",
    driverPhone: "01722-998877",
    partyName: "City Edible Oils & Fats",
    purpose: "Palm Olein Supply",
    totalItems: 120,
    status: "Cleared",
  },
];

const MOCK_GATE_OUT: GatePassRow[] = [
  {
    sl: 1,
    gatePassNo: "GOUT-MG261000092",
    refType: "Stock Transfer",
    refNo: "ITO-MG261000038",
    date: "14-10-2026",
    time: "09:30 AM",
    vehicleNo: "DM-TA-15-7762",
    driverName: "Babul Mia",
    driverPhone: "01733-112233",
    partyName: "Dhaka Central Distribution Hub",
    purpose: "Stock Transfer Out (Snacks Store)",
    totalItems: 678,
    status: "Out",
  },
  {
    sl: 2,
    gatePassNo: "GOUT-MG261000091",
    refType: "Sales Delivery",
    refNo: "DO-2026-00452",
    date: "13-10-2026",
    time: "04:50 PM",
    vehicleNo: "DM-UA-18-9941",
    driverName: "Mofiz Uddin",
    driverPhone: "01711-234567",
    partyName: "Rahman Traders & Sons",
    purpose: "Finished Goods Delivery",
    totalItems: 500,
    status: "Cleared",
  },
  {
    sl: 3,
    gatePassNo: "GOUT-MG261000090",
    refType: "Return to Vendor",
    refNo: "RTV-2026-0012",
    date: "12-10-2026",
    time: "01:20 PM",
    vehicleNo: "DM-DA-14-3321",
    driverName: "Kalam Sheikh",
    driverPhone: "01819-876543",
    partyName: "Star Packaging Ltd.",
    purpose: "Damaged box return",
    totalItems: 45,
    status: "Cleared",
  },
];

const MOCK_VISITORS: VisitorRow[] = [
  {
    sl: 1,
    visitorPassNo: "VIS-2026-0089",
    date: "14-10-2026",
    inTime: "09:15 AM",
    outTime: "",
    visitorName: "Engr. Mahmudul Hassan",
    companyName: "Siemens Bangladesh Ltd.",
    contactNo: "01712-445566",
    personToMeet: "Md. Jakaria",
    department: "Maintenance & Plant Engineering",
    purpose: "Generator Inspection & Audit",
    badgeNo: "V-12",
    status: "Inside",
  },
  {
    sl: 2,
    visitorPassNo: "VIS-2026-0088",
    date: "13-10-2026",
    inTime: "11:00 AM",
    outTime: "01:30 PM",
    visitorName: "Tanvir Chowdhury",
    companyName: "BSTI Quality Inspection",
    contactNo: "01819-112233",
    personToMeet: "Tanvir Ahmed",
    department: "Quality Assurance (QA)",
    purpose: "Annual Food Safety Certification",
    badgeNo: "V-05",
    status: "Exited",
  },
  {
    sl: 3,
    visitorPassNo: "VIS-2026-0087",
    date: "12-10-2026",
    inTime: "02:30 PM",
    outTime: "04:15 PM",
    visitorName: "Kazi Sazzad Hossain",
    companyName: "Delta Logistics",
    contactNo: "01911-778899",
    personToMeet: "Sumon Hossain",
    department: "Supply Chain & Logistics",
    purpose: "Vehicle contract discussion",
    badgeNo: "V-08",
    status: "Exited",
  },
];

export default function GateInOutPage() {
  const [activeTab, setActiveTab] = useState<GateTab>("GATE_IN");
  const [searchTerm, setSearchTerm] = useState("");

  // Filters matching screenshot
  const [refType, setRefType] = useState("");
  const [fromDate, setFromDate] = useState("2026-09-13");
  const [toDate, setToDate] = useState("2026-10-14");
  const [isDetails, setIsDetails] = useState(false);

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [page, setPage] = useState(1);

  // Modal State for "+ Create Get In Out"
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: "Gate In",
    refType: "Purchase Order",
    refNo: "",
    vehicleNo: "",
    driverName: "",
    driverPhone: "",
    partyName: "",
    purpose: "",
  });

  const tabs: { id: GateTab; label: string }[] = [
    { id: "GATE_IN", label: "GATE IN" },
    { id: "GATE_OUT", label: "GATE OUT" },
    { id: "VISITOR", label: "VISITOR" },
  ];

  // Filtering Gate In
  const filteredGateIn = useMemo(() => {
    return MOCK_GATE_IN.filter((row) => {
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
  }, [refType, searchTerm]);

  // Filtering Gate Out
  const filteredGateOut = useMemo(() => {
    return MOCK_GATE_OUT.filter((row) => {
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
  }, [refType, searchTerm]);

  // Filtering Visitor
  const filteredVisitors = useMemo(() => {
    return MOCK_VISITORS.filter((row) => {
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
  }, [searchTerm]);

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
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">
                Create Gate In / Out Entry
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Movement Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, type: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Gate In">Gate In (Inward Entry)</option>
                    <option value="Gate Out">Gate Out (Outward Exit)</option>
                    <option value="Visitor">Visitor Entry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Reference Type
                  </label>
                  <select
                    value={createForm.refType}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, refType: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Purchase Order">Purchase Order</option>
                    <option value="Transfer In">Transfer In / Out</option>
                    <option value="Sales Delivery">Sales Delivery</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Reference / Challan No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PO-MG260900084"
                    value={createForm.refNo}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, refNo: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Vehicle Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DM-UA-18-9941"
                    value={createForm.vehicleNo}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, vehicleNo: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Driver / Contact Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={createForm.driverName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, driverName: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Driver Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 01711-234567"
                    value={createForm.driverPhone}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, driverPhone: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Party / Supplier / Destination
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meghna Flour Mills Ltd."
                  value={createForm.partyName}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, partyName: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Purpose / Item Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Material description or security gate notes..."
                  value={createForm.purpose}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, purpose: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert("Gate Pass created successfully!");
                  setIsCreateOpen(false);
                }}
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
              >
                Save Gate Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
