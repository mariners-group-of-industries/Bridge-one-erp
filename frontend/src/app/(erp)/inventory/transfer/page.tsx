"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Upload,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  Printer,
  Eye,
  FileSpreadsheet,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================
type TransferTabId =
  | "APPROVED_REQ"
  | "TRANSFER_OUT"
  | "IN_TRANSIT"
  | "RETURN_LIST"
  | "RECEIVED_LIST";

interface TransferOutRow {
  sl: number;
  transferDate: string;
  requestCode: string;
  transferCode: string;
  fromOffice: string;
  fromWarehouse: string;
  receiveOffice: string;
  receiveWarehouse: string;
  requestBy: string;
  requestTo: string;
  totalQty: number;
  receivedQty: number;
  returnQty: number;
  inTransitQty: number;
}

interface ReturnRow {
  sl: number;
  returnDate: string;
  transferCode: string;
  returnCode: string;
  fromOffice: string;
  fromWarehouse: string;
  receiveOffice: string;
  receiveWarehouse: string;
  returnQty: number;
  status: "Approved" | "Pending" | "Rejected";
}

interface ReceivedRow {
  sl: number;
  transferDate: string;
  receiveDate: string;
  transferRequestNumber: string;
  transferCode: string;
  fromWarehouse: string;
  receiveWarehouse: string;
  requestTo: string;
  receivedQty: number;
  loadingTime: string;
  loadingTemp: string;
  chillingTemp: string;
}

// ============================================================================
// SAMPLE DATA
// ============================================================================
const MOCK_TRANSFER_OUT: TransferOutRow[] = [
  {
    sl: 1,
    transferDate: "12-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000039",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Biscuit Store",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "Finished Goods (FG) WH",
    requestBy: "",
    requestTo: "",
    totalQty: 1040.0,
    receivedQty: 1040.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 2,
    transferDate: "11-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000038",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    requestBy: "",
    requestTo: "",
    totalQty: 678.0,
    receivedQty: 678.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 3,
    transferDate: "01-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000037",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Finished Goods (FG) WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    requestBy: "",
    requestTo: "",
    totalQty: 15.0,
    receivedQty: 15.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 4,
    transferDate: "08-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000036",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    requestBy: "",
    requestTo: "",
    totalQty: 6.0,
    receivedQty: 6.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 5,
    transferDate: "07-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000035",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    requestBy: "",
    requestTo: "",
    totalQty: 134.0,
    receivedQty: 134.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 6,
    transferDate: "07-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000034",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    requestBy: "",
    requestTo: "",
    totalQty: 430.0,
    receivedQty: 430.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 7,
    transferDate: "07-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000033",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Biscuit Store",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "Finished Goods (FG) WH",
    requestBy: "",
    requestTo: "",
    totalQty: 274.0,
    receivedQty: 274.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 8,
    transferDate: "07-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000032",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    requestBy: "",
    requestTo: "",
    totalQty: 211.0,
    receivedQty: 211.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 9,
    transferDate: "07-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000031",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Biscuit Store",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "Finished Goods (FG) WH",
    requestBy: "",
    requestTo: "",
    totalQty: 3666.0,
    receivedQty: 3666.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 10,
    transferDate: "07-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000030",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Snacks Store",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "Finished Goods (FG) WH",
    requestBy: "",
    requestTo: "",
    totalQty: 12606.0,
    receivedQty: 12606.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 11,
    transferDate: "06-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000029",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    requestBy: "",
    requestTo: "",
    totalQty: 2.0,
    receivedQty: 2.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 12,
    transferDate: "06-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000028",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Snacks Store",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    requestBy: "",
    requestTo: "",
    totalQty: 98.0,
    receivedQty: 98.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 13,
    transferDate: "06-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000027",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    requestBy: "",
    requestTo: "",
    totalQty: 555.0,
    receivedQty: 555.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 14,
    transferDate: "05-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000026",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    requestBy: "",
    requestTo: "",
    totalQty: 65.0,
    receivedQty: 65.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
  {
    sl: 15,
    transferDate: "05-10-2026",
    requestCode: "",
    transferCode: "ITO-MG261000025",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    requestBy: "",
    requestTo: "",
    totalQty: 40.0,
    receivedQty: 40.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
  },
];

const MOCK_RETURN_LIST: ReturnRow[] = [
  {
    sl: 1,
    returnDate: "26-07-2026",
    transferCode: "ITO-MG260500047",
    returnCode: "TR-MG260700015",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    returnQty: 2.0,
    status: "Approved",
  },
  {
    sl: 2,
    returnDate: "26-07-2026",
    transferCode: "ITO-MBBL251100016",
    returnCode: "TR-MG260700014",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    returnQty: 1689.6,
    status: "Approved",
  },
  {
    sl: 3,
    returnDate: "26-07-2026",
    transferCode: "ITO-MBBL251100114",
    returnCode: "TR-MG260700013",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    returnQty: 250.0,
    status: "Approved",
  },
  {
    sl: 4,
    returnDate: "22-07-2026",
    transferCode: "ITO-MBBL251100133",
    returnCode: "TR-MG260700012",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    returnQty: 1.0,
    status: "Approved",
  },
  {
    sl: 5,
    returnDate: "22-07-2026",
    transferCode: "ITO-MBBL251100139",
    returnCode: "TR-MG260700011",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    returnQty: 1.0,
    status: "Approved",
  },
  {
    sl: 6,
    returnDate: "22-07-2026",
    transferCode: "ITO-MBBL251200022",
    returnCode: "TR-MG260700010",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    returnQty: 271.6,
    status: "Approved",
  },
  {
    sl: 7,
    returnDate: "22-07-2026",
    transferCode: "ITO-MBBL251200023",
    returnCode: "TR-MG260700009",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    returnQty: 267.0,
    status: "Approved",
  },
  {
    sl: 8,
    returnDate: "22-07-2026",
    transferCode: "ITO-MBBL251200102",
    returnCode: "TR-MG260700008",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    returnQty: 24.5,
    status: "Approved",
  },
];

const MOCK_RECEIVED_LIST: ReceivedRow[] = [
  {
    sl: 1,
    transferDate: "12-10-2026",
    receiveDate: "12-10-2026",
    transferRequestNumber: "",
    transferCode: "ITO-MG261000039",
    fromWarehouse: "PD Biscuit Store",
    receiveWarehouse: "Finished Goods (FG) WH",
    requestTo: "",
    receivedQty: 1040.0,
    loadingTime: "",
    loadingTemp: "",
    chillingTemp: "",
  },
  {
    sl: 2,
    transferDate: "11-10-2026",
    receiveDate: "11-10-2026",
    transferRequestNumber: "",
    transferCode: "ITO-MG261000038",
    fromWarehouse: "Material WH",
    receiveWarehouse: "PD Snacks Store",
    requestTo: "",
    receivedQty: 678.0,
    loadingTime: "",
    loadingTemp: "",
    chillingTemp: "",
  },
  {
    sl: 3,
    transferDate: "01-10-2026",
    receiveDate: "01-10-2026",
    transferRequestNumber: "",
    transferCode: "ITO-MG261000037",
    fromWarehouse: "Finished Goods (FG) WH",
    receiveWarehouse: "PD Biscuit Store",
    requestTo: "",
    receivedQty: 15.0,
    loadingTime: "",
    loadingTemp: "",
    chillingTemp: "",
  },
  {
    sl: 4,
    transferDate: "08-10-2026",
    receiveDate: "08-10-2026",
    transferRequestNumber: "",
    transferCode: "ITO-MG261000036",
    fromWarehouse: "Material WH",
    receiveWarehouse: "PD Biscuit Store",
    requestTo: "",
    receivedQty: 6.0,
    loadingTime: "",
    loadingTemp: "",
    chillingTemp: "",
  },
  {
    sl: 5,
    transferDate: "07-10-2026",
    receiveDate: "07-10-2026",
    transferRequestNumber: "",
    transferCode: "ITO-MG261000035",
    fromWarehouse: "Material WH",
    receiveWarehouse: "PD Biscuit Store",
    requestTo: "",
    receivedQty: 134.0,
    loadingTime: "",
    loadingTemp: "",
    chillingTemp: "",
  },
  {
    sl: 6,
    transferDate: "07-10-2026",
    receiveDate: "07-10-2026",
    transferRequestNumber: "",
    transferCode: "ITO-MG261000034",
    fromWarehouse: "Material WH",
    receiveWarehouse: "PD Snacks Store",
    requestTo: "",
    receivedQty: 430.0,
    loadingTime: "",
    loadingTemp: "",
    chillingTemp: "",
  },
  {
    sl: 7,
    transferDate: "07-10-2026",
    receiveDate: "07-10-2026",
    transferRequestNumber: "",
    transferCode: "ITO-MG261000033",
    fromWarehouse: "PD Biscuit Store",
    receiveWarehouse: "Finished Goods (FG) WH",
    requestTo: "",
    receivedQty: 274.0,
    loadingTime: "",
    loadingTemp: "",
    chillingTemp: "",
  },
  {
    sl: 8,
    transferDate: "07-10-2026",
    receiveDate: "07-10-2026",
    transferRequestNumber: "",
    transferCode: "ITO-MG261000032",
    fromWarehouse: "Material WH",
    receiveWarehouse: "PD Snacks Store",
    requestTo: "",
    receivedQty: 211.0,
    loadingTime: "",
    loadingTemp: "",
    chillingTemp: "",
  },
];

// In transit sample
const MOCK_IN_TRANSIT: TransferOutRow[] = [
  {
    sl: 1,
    transferDate: "13-10-2026",
    requestCode: "TR-MG261000045",
    transferCode: "ITO-MG261000040",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    requestBy: "Md. Jakaria",
    requestTo: "Tanvir Ahmed",
    totalQty: 500.0,
    receivedQty: 0.0,
    returnQty: 0.0,
    inTransitQty: 500.0,
  },
];

const OFFICE_OPTIONS = [
  { value: "", label: "From Office" },
  { value: "MG Sirajganj Factory", label: "MG Sirajganj Factory" },
  { value: "Dhaka Head Office", label: "Dhaka Head Office" },
  { value: "Marinozz", label: "Marinozz" },
  { value: "MOHS Eco", label: "MOHS Eco" },
];

const TO_OFFICE_OPTIONS = [
  { value: "", label: "To Office" },
  { value: "MG Sirajganj Factory", label: "MG Sirajganj Factory" },
  { value: "Dhaka Head Office", label: "Dhaka Head Office" },
  { value: "Marinozz", label: "Marinozz" },
  { value: "MOHS Eco", label: "MOHS Eco" },
];

const WAREHOUSE_OPTIONS = [
  { value: "", label: "From Warehouse" },
  { value: "Material WH", label: "Material WH" },
  { value: "PD Biscuit Store", label: "PD Biscuit Store" },
  { value: "PD Snacks Store", label: "PD Snacks Store" },
  { value: "Finished Goods (FG) WH", label: "Finished Goods (FG) WH" },
];

const TO_WAREHOUSE_OPTIONS = [
  { value: "", label: "To Warehouse / Requesting Warehouse" },
  { value: "Material WH", label: "Material WH" },
  { value: "PD Biscuit Store", label: "PD Biscuit Store" },
  { value: "PD Snacks Store", label: "PD Snacks Store" },
  { value: "Finished Goods (FG) WH", label: "Finished Goods (FG) WH" },
];

export default function TransferPage() {
  const [activeTab, setActiveTab] = useState<TransferTabId>("TRANSFER_OUT");
  const [searchTerm, setSearchTerm] = useState("");

  // Filters
  const [fromOffice, setFromOffice] = useState("");
  const [toOffice, setToOffice] = useState("");
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [requestTo, setRequestTo] = useState("");
  const [fromDate, setFromDate] = useState("2026-09-13");
  const [toDate, setToDate] = useState("2026-10-14");

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [page, setPage] = useState(1);

  // Tabs definition
  const tabs: { id: TransferTabId; label: string }[] = [
    { id: "APPROVED_REQ", label: "APPROVED TRANS. REQUEST" },
    { id: "TRANSFER_OUT", label: "TRANSFER OUT LIST" },
    { id: "IN_TRANSIT", label: "TRANSFER IN TRANSIT" },
    { id: "RETURN_LIST", label: "RETURN LIST" },
    { id: "RECEIVED_LIST", label: "TRANSFER IN/RECEIVED LIST" },
  ];

  // Filter Transfer Out rows
  const filteredTransferOut = useMemo(() => {
    return MOCK_TRANSFER_OUT.filter((row) => {
      if (fromOffice && row.fromOffice !== fromOffice) return false;
      if (fromWarehouse && row.fromWarehouse !== fromWarehouse) return false;
      if (toWarehouse && row.receiveWarehouse !== toWarehouse) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          row.transferCode.toLowerCase().includes(s) ||
          row.fromWarehouse.toLowerCase().includes(s) ||
          row.receiveWarehouse.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [fromOffice, fromWarehouse, toWarehouse, searchTerm]);

  // Filter Return rows
  const filteredReturn = useMemo(() => {
    return MOCK_RETURN_LIST.filter((row) => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          row.transferCode.toLowerCase().includes(s) ||
          row.returnCode.toLowerCase().includes(s) ||
          row.fromWarehouse.toLowerCase().includes(s) ||
          row.receiveWarehouse.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [searchTerm]);

  // Filter Received rows
  const filteredReceived = useMemo(() => {
    return MOCK_RECEIVED_LIST.filter((row) => {
      if (fromWarehouse && row.fromWarehouse !== fromWarehouse) return false;
      if (toWarehouse && row.receiveWarehouse !== toWarehouse) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          row.transferCode.toLowerCase().includes(s) ||
          row.fromWarehouse.toLowerCase().includes(s) ||
          row.receiveWarehouse.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [fromWarehouse, toWarehouse, searchTerm]);

  // CSV Export
  const handleExportCSV = () => {
    let csvContent = "";
    if (activeTab === "TRANSFER_OUT" || activeTab === "IN_TRANSIT") {
      const source = activeTab === "TRANSFER_OUT" ? filteredTransferOut : MOCK_IN_TRANSIT;
      const headers = [
        "SL",
        "Transfer Date",
        "Request Code",
        "Transfer Code",
        "From Office",
        "From Warehouse",
        "Receive Office",
        "Receive Warehouse",
        "Total Qty",
        "Received Qty",
        "Return Qty",
        "In Transit Qty",
      ];
      const rows = source.map((r, i) => [
        i + 1,
        r.transferDate,
        r.requestCode,
        r.transferCode,
        `"${r.fromOffice}"`,
        `"${r.fromWarehouse}"`,
        `"${r.receiveOffice}"`,
        `"${r.receiveWarehouse}"`,
        r.totalQty,
        r.receivedQty,
        r.returnQty,
        r.inTransitQty,
      ]);
      csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    } else if (activeTab === "RETURN_LIST") {
      const headers = [
        "SL",
        "Return Date",
        "Transfer Code",
        "Return Code",
        "From Office",
        "From Warehouse",
        "Receive Office",
        "Receive Warehouse",
        "Return Qty",
        "Status",
      ];
      const rows = filteredReturn.map((r, i) => [
        i + 1,
        r.returnDate,
        r.transferCode,
        r.returnCode,
        `"${r.fromOffice}"`,
        `"${r.fromWarehouse}"`,
        `"${r.receiveOffice}"`,
        `"${r.receiveWarehouse}"`,
        r.returnQty,
        r.status,
      ]);
      csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    } else if (activeTab === "RECEIVED_LIST") {
      const headers = [
        "SL",
        "Transfer Date",
        "Receive Date",
        "Transfer Request Number",
        "Transfer Code",
        "From Warehouse",
        "Receive Warehouse",
        "Received Qty",
      ];
      const rows = filteredReceived.map((r, i) => [
        i + 1,
        r.transferDate,
        r.receiveDate,
        r.transferRequestNumber,
        r.transferCode,
        `"${r.fromWarehouse}"`,
        `"${r.receiveWarehouse}"`,
        r.receivedQty,
      ]);
      csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    }
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `stock_transfer_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
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
            Transfer
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

          {/* Upload */}
          <button
            type="button"
            title="Upload"
            className="h-9 px-3.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={handleExportCSV}
            title="Download CSV"
            className="h-9 px-3.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          {/* Direct Transfer Out Button */}
          <button
            type="button"
            className="h-9 px-4 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition whitespace-nowrap"
          >
            <span>Direct Transfer Out</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 2. TABS NAVIGATION                                 */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-8 text-xs font-bold uppercase tracking-wider overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={`pb-2 whitespace-nowrap transition ${
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
      {/* 3. TAB 1: APPROVED TRANS. REQUEST                   */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "APPROVED_REQ" && (
        <div className="space-y-2">
          {/* Filter row 1 */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <select
                  value={fromOffice}
                  onChange={(e) => setFromOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toOffice}
                  onChange={(e) => setToOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <button
                  type="button"
                  className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          <div className="border border-slate-300 bg-white rounded shadow-2xs p-12 text-center text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
              <span className="text-sm font-medium">No approved transfer requests pending transfer out.</span>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 4. TAB 2: TRANSFER OUT LIST                         */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "TRANSFER_OUT" && (
        <div className="space-y-2">
          {/* Filter row 1 */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <select
                  value={fromOffice}
                  onChange={(e) => setFromOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toOffice}
                  onChange={(e) => setToOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <button
                  type="button"
                  className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Transfer Date</th>
                  <th className="p-2 border border-slate-300 w-28">Request Code</th>
                  <th className="p-2 border border-slate-300 w-32">Transfer Code</th>
                  <th className="p-2 border border-slate-300">From/Sending Office</th>
                  <th className="p-2 border border-slate-300">From/Sending Warehouse</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Office</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Warehouse</th>
                  <th className="p-2 border border-slate-300 w-24">Request By</th>
                  <th className="p-2 border border-slate-300 w-24">Request To</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Total Qty</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Received Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">Return Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">In Transit Qty</th>
                  <th className="p-2 border border-slate-300 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredTransferOut.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.transferDate}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800">
                      {row.requestCode}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.requestBy}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.requestTo}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-medium">
                      {row.totalQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {row.receivedQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {row.returnQty.toFixed(2)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {row.inTransitQty.toFixed(2)}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        <button type="button" className="p-0.5 hover:text-blue-600" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 5. TAB 3: TRANSFER IN TRANSIT                       */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "IN_TRANSIT" && (
        <div className="space-y-2">
          {/* Filter row 1 */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <select
                  value={fromOffice}
                  onChange={(e) => setFromOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toOffice}
                  onChange={(e) => setToOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_OFFICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <button
                  type="button"
                  className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Transfer Date</th>
                  <th className="p-2 border border-slate-300 w-28">Request Code</th>
                  <th className="p-2 border border-slate-300 w-32">Transfer Code</th>
                  <th className="p-2 border border-slate-300">From/Sending Office</th>
                  <th className="p-2 border border-slate-300">From/Sending Warehouse</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Office</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Warehouse</th>
                  <th className="p-2 border border-slate-300 w-24">Request By</th>
                  <th className="p-2 border border-slate-300 w-24">Request To</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Total Qty</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Received Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">Return Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-right">In Transit Qty</th>
                  <th className="p-2 border border-slate-300 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {MOCK_IN_TRANSIT.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.transferDate}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800">
                      {row.requestCode}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.requestBy}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.requestTo}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-medium">
                      {row.totalQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {row.receivedQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {row.returnQty.toFixed(2)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-blue-600 font-bold">
                      {row.inTransitQty.toFixed(2)}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        <button type="button" className="p-0.5 hover:text-blue-600" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 6. TAB 4: RETURN LIST                               */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "RETURN_LIST" && (
        <div className="space-y-2">
          {/* Date range filter */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
            <div>
              <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

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
                  <th className="p-2 border border-slate-300 w-24">Return Date</th>
                  <th className="p-2 border border-slate-300 w-36">Transfer Code</th>
                  <th className="p-2 border border-slate-300 w-36">Return Code</th>
                  <th className="p-2 border border-slate-300">From/Sending Office</th>
                  <th className="p-2 border border-slate-300">From/Sending Warehouse</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Office</th>
                  <th className="p-2 border border-slate-300">Requesting/Receive Warehouse</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Return Qty</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Status</th>
                  <th className="p-2 border border-slate-300 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredReturn.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.returnDate}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                      {row.returnCode}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveOffice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-medium">
                      {row.returnQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <span className="text-emerald-600 font-semibold text-[11px]">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <button type="button" className="p-0.5 hover:text-blue-600 text-slate-600" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 7. TAB 5: TRANSFER IN/RECEIVED LIST                 */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "RECEIVED_LIST" && (
        <div className="space-y-2">
          {/* Filters */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-600"
                >
                  {TO_WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Select/Search Request To (min 3 letters)"
                  value={requestTo}
                  onChange={(e) => setRequestTo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <button
                  type="button"
                  className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Transfer Date</th>
                  <th className="p-2 border border-slate-300 w-24">Receive Date</th>
                  <th className="p-2 border border-slate-300 w-32">Transfer Request Number</th>
                  <th className="p-2 border border-slate-300 w-32">Transfer Code</th>
                  <th className="p-2 border border-slate-300">From/Sending Warehouse</th>
                  <th className="p-2 border border-slate-300">Request/Receive Warehouse</th>
                  <th className="p-2 border border-slate-300 w-24">Request To</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Received Qty</th>
                  <th className="p-2 border border-slate-300 w-24">Loading Time</th>
                  <th className="p-2 border border-slate-300 w-28">Loading Temperature (°C)</th>
                  <th className="p-2 border border-slate-300 w-28">Chilling Temperature (°C)</th>
                  <th className="p-2 border border-slate-300 w-16 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredReceived.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.transferDate}
                    </td>
                    <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                      {row.receiveDate}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800">
                      {row.transferRequestNumber}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.transferCode}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.fromWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700">
                      {row.receiveWarehouse}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.requestTo}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-medium">
                      {row.receivedQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.loadingTime}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.loadingTemp}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.chillingTemp}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        <button type="button" className="p-0.5 hover:text-blue-600" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-0.5 hover:text-blue-600" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
