"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Truck,
  ArrowRightLeft,
  PackageCheck,
  Building2,
  Calendar,
  X,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================
type TransferReportMode = "Transfer Out" | "Transfer Received" | "Transfer In Transit";

interface TransferOutRecord {
  sl: number;
  transferDate: string;
  transferCode: string;
  requestCode: string;
  fromOffice: string;
  fromWarehouse: string;
  receiveOffice: string;
  receiveWarehouse: string;
  itemCode: string;
  itemName: string;
  uom: string;
  totalQty: number;
  receivedQty: number;
  returnQty: number;
  inTransitQty: number;
  status: "Completed" | "Partial" | "In Transit" | "Pending";
}

interface TransferReceivedRecord {
  sl: number;
  receiveDate: string;
  transferDate: string;
  transferCode: string;
  fromOffice: string;
  fromWarehouse: string;
  receiveWarehouse: string;
  itemCode: string;
  itemName: string;
  uom: string;
  receivedQty: number;
  loadingTemp: string;
  chillingTemp: string;
  vehicleNo: string;
  receivedBy: string;
  status: "Accepted" | "Quality Checked" | "Discrepancy";
}

interface TransferInTransitRecord {
  sl: number;
  dispatchDate: string;
  transferCode: string;
  requestCode: string;
  fromWarehouse: string;
  destinationWarehouse: string;
  itemCode: string;
  itemName: string;
  uom: string;
  dispatchedQty: number;
  inTransitQty: number;
  vehicleNo: string;
  driverName: string;
  driverContact: string;
  estArrival: string;
  status: "On Highway" | "At Factory Gate" | "Customs Clearance";
}

// ============================================================================
// DEMO DATA (Matched to Mariners Group Factory & Inter-Store Transfers)
// ============================================================================
const DEMO_TRANSFER_OUT: TransferOutRecord[] = [
  {
    sl: 1,
    transferDate: "2026-10-12",
    transferCode: "ITO-MG261000039",
    requestCode: "TR-MG261000045",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Biscuit Store",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "Finished Goods (FG) WH",
    itemCode: "ZZ-0096",
    itemName: "Yogurt (Curd)(PCS)",
    uom: "PCS",
    totalQty: 1040.0,
    receivedQty: 1040.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
    status: "Completed",
  },
  {
    sl: 2,
    transferDate: "2026-10-11",
    transferCode: "ITO-MG261000038",
    requestCode: "TR-MG261000044",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    itemCode: "RM-0089",
    itemName: "Refined White Crystal Sugar Grade-A",
    uom: "KG",
    totalQty: 678.0,
    receivedQty: 678.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
    status: "Completed",
  },
  {
    sl: 3,
    transferDate: "2026-10-10",
    transferCode: "ITO-MG261000037",
    requestCode: "TR-MG261000043",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Finished Goods (FG) WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    itemCode: "PK-0102",
    itemName: "Biscuit Metallized Barrier Film 40 Micron",
    uom: "ROLL",
    totalQty: 15.0,
    receivedQty: 15.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
    status: "Completed",
  },
  {
    sl: 4,
    transferDate: "2026-10-08",
    transferCode: "ITO-MG261000036",
    requestCode: "TR-MG261000042",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    itemCode: "RM-0115",
    itemName: "Skimmed Milk Powder (SMP 25kg)",
    uom: "BAG",
    totalQty: 6.0,
    receivedQty: 6.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
    status: "Completed",
  },
  {
    sl: 5,
    transferDate: "2026-10-07",
    transferCode: "ITO-MG261000035",
    requestCode: "TR-MG261000041",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Biscuit Store",
    itemCode: "PK-0145",
    itemName: "Printed Corrugated Master Carton (24x)",
    uom: "PCS",
    totalQty: 134.0,
    receivedQty: 134.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
    status: "Completed",
  },
  {
    sl: 6,
    transferDate: "2026-10-07",
    transferCode: "ITO-MG261000034",
    requestCode: "TR-MG261000040",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    itemCode: "ZZ-0105",
    itemName: "Curd Snack Drink 200ml Bottle",
    uom: "BTL",
    totalQty: 430.0,
    receivedQty: 430.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
    status: "Completed",
  },
  {
    sl: 7,
    transferDate: "2026-10-07",
    transferCode: "ITO-MG261000033",
    requestCode: "TR-MG261000039",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Biscuit Store",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "Finished Goods (FG) WH",
    itemCode: "ZZ-0104",
    itemName: "Sweetened Curd 500g Tub",
    uom: "PCS",
    totalQty: 274.0,
    receivedQty: 274.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
    status: "Completed",
  },
  {
    sl: 8,
    transferDate: "2026-10-07",
    transferCode: "ITO-MG261000032",
    requestCode: "TR-MG261000038",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "PD Snacks Store",
    itemCode: "RM-0042",
    itemName: "Raw Chilled Milk Bulk (Fat 4.2%)",
    uom: "LTR",
    totalQty: 211.0,
    receivedQty: 211.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
    status: "Completed",
  },
  {
    sl: 9,
    transferDate: "2026-10-07",
    transferCode: "ITO-MG261000031",
    requestCode: "TR-MG261000037",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Biscuit Store",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "Finished Goods (FG) WH",
    itemCode: "ZZ-0096",
    itemName: "Yogurt (Curd)(PCS)",
    uom: "PCS",
    totalQty: 3666.0,
    receivedQty: 3666.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
    status: "Completed",
  },
  {
    sl: 10,
    transferDate: "2026-10-07",
    transferCode: "ITO-MG261000030",
    requestCode: "TR-MG261000036",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Snacks Store",
    receiveOffice: "MG Sirajganj Factory",
    receiveWarehouse: "Finished Goods (FG) WH",
    itemCode: "ZZ-0105",
    itemName: "Curd Snack Drink 200ml Bottle",
    uom: "BTL",
    totalQty: 12606.0,
    receivedQty: 12606.0,
    returnQty: 0.0,
    inTransitQty: 0.0,
    status: "Completed",
  },
  {
    sl: 11,
    transferDate: "2026-10-13",
    transferCode: "ITO-MG261000040",
    requestCode: "TR-MG261000046",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveOffice: "Dhaka Head Office",
    receiveWarehouse: "Central Finished WH",
    itemCode: "RM-0042",
    itemName: "Raw Chilled Milk Bulk (Fat 4.2%)",
    uom: "LTR",
    totalQty: 5000.0,
    receivedQty: 0.0,
    returnQty: 0.0,
    inTransitQty: 5000.0,
    status: "In Transit",
  },
];

const DEMO_TRANSFER_RECEIVED: TransferReceivedRecord[] = [
  {
    sl: 1,
    receiveDate: "2026-10-12",
    transferDate: "2026-10-12",
    transferCode: "ITO-MG261000039",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Biscuit Store",
    receiveWarehouse: "Finished Goods (FG) WH",
    itemCode: "ZZ-0096",
    itemName: "Yogurt (Curd)(PCS)",
    uom: "PCS",
    receivedQty: 1040.0,
    loadingTemp: "4.2 °C",
    chillingTemp: "3.8 °C",
    vehicleNo: "DHAKA-METRO-TA-14-8890",
    receivedBy: "Md. Jakaria",
    status: "Accepted",
  },
  {
    sl: 2,
    receiveDate: "2026-10-11",
    transferDate: "2026-10-11",
    transferCode: "ITO-MG261000038",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "Material WH",
    receiveWarehouse: "PD Snacks Store",
    itemCode: "RM-0089",
    itemName: "Refined White Crystal Sugar Grade-A",
    uom: "KG",
    receivedQty: 678.0,
    loadingTemp: "N/A",
    chillingTemp: "N/A",
    vehicleNo: "INTERNAL-FORKLIFT-02",
    receivedBy: "Tanvir Ahmed",
    status: "Accepted",
  },
  {
    sl: 3,
    receiveDate: "2026-10-07",
    transferDate: "2026-10-07",
    transferCode: "ITO-MG261000033",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Biscuit Store",
    receiveWarehouse: "Finished Goods (FG) WH",
    itemCode: "ZZ-0104",
    itemName: "Sweetened Curd 500g Tub",
    uom: "PCS",
    receivedQty: 274.0,
    loadingTemp: "4.5 °C",
    chillingTemp: "4.0 °C",
    vehicleNo: "DHAKA-METRO-TA-11-2033",
    receivedBy: "Md. Jakaria",
    status: "Quality Checked",
  },
  {
    sl: 4,
    receiveDate: "2026-10-07",
    transferDate: "2026-10-07",
    transferCode: "ITO-MG261000031",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Biscuit Store",
    receiveWarehouse: "Finished Goods (FG) WH",
    itemCode: "ZZ-0096",
    itemName: "Yogurt (Curd)(PCS)",
    uom: "PCS",
    receivedQty: 3666.0,
    loadingTemp: "4.1 °C",
    chillingTemp: "3.9 °C",
    vehicleNo: "DHAKA-METRO-TA-14-8890",
    receivedBy: "Md. Jakaria",
    status: "Accepted",
  },
  {
    sl: 5,
    receiveDate: "2026-10-07",
    transferDate: "2026-10-07",
    transferCode: "ITO-MG261000030",
    fromOffice: "MG Sirajganj Factory",
    fromWarehouse: "PD Snacks Store",
    receiveWarehouse: "Finished Goods (FG) WH",
    itemCode: "ZZ-0105",
    itemName: "Curd Snack Drink 200ml Bottle",
    uom: "BTL",
    receivedQty: 12606.0,
    loadingTemp: "5.0 °C",
    chillingTemp: "4.2 °C",
    vehicleNo: "DHAKA-METRO-TA-19-4501",
    receivedBy: "Md. Jakaria",
    status: "Accepted",
  },
];

const DEMO_TRANSFER_IN_TRANSIT: TransferInTransitRecord[] = [
  {
    sl: 1,
    dispatchDate: "2026-10-14",
    transferCode: "ITO-MG261000041",
    requestCode: "TR-MG261000047",
    fromWarehouse: "PD Biscuit Store",
    destinationWarehouse: "Dhaka Central Distribution Store",
    itemCode: "ZZ-0096",
    itemName: "Yogurt (Curd)(PCS)",
    uom: "PCS",
    dispatchedQty: 4500.0,
    inTransitQty: 4500.0,
    vehicleNo: "DHAKA-METRO-TA-16-9204 (Refrigerated)",
    driverName: "Md. Kamal Hossain",
    driverContact: "+880 1712-445588",
    estArrival: "14-10-2026 18:30",
    status: "On Highway",
  },
  {
    sl: 2,
    dispatchDate: "2026-10-13",
    transferCode: "ITO-MG261000040",
    requestCode: "TR-MG261000046",
    fromWarehouse: "Material WH",
    destinationWarehouse: "Chittagong Depot WH",
    itemCode: "RM-0042",
    itemName: "Raw Chilled Milk Bulk (Fat 4.2%)",
    uom: "LTR",
    dispatchedQty: 5000.0,
    inTransitQty: 5000.0,
    vehicleNo: "DHAKA-METRO-CHA-11-7821 (Tanker)",
    driverName: "Abdur Rahim",
    driverContact: "+880 1819-332211",
    estArrival: "15-10-2026 09:00",
    status: "On Highway",
  },
];

const OFFICE_OPTIONS = [
  "All Offices",
  "MG Sirajganj Factory",
  "Dhaka Head Office",
  "Marinozz",
  "MOHS Eco",
];

const WAREHOUSE_OPTIONS = [
  "All Warehouses",
  "Material WH",
  "PD Biscuit Store",
  "PD Snacks Store",
  "Finished Goods (FG) WH",
];

export default function TransferReportPage() {
  // Screenshot 2 Primary View Selector: "View By *"
  const [viewBy, setViewBy] = useState<TransferReportMode>("Transfer Out");

  // Filter criteria
  const [searchTerm, setSearchTerm] = useState("");
  const [fromOffice, setFromOffice] = useState("All Offices");
  const [toOffice, setToOffice] = useState("All Offices");
  const [fromWarehouse, setFromWarehouse] = useState("All Warehouses");
  const [toWarehouse, setToWarehouse] = useState("All Warehouses");
  const [fromDate, setFromDate] = useState("2026-09-13");
  const [toDate, setToDate] = useState("2026-10-14");

  // Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Filter Transfer Out Data
  const filteredTransferOut = useMemo(() => {
    return DEMO_TRANSFER_OUT.filter((r) => {
      if (fromOffice !== "All Offices" && r.fromOffice !== fromOffice) return false;
      if (toOffice !== "All Offices" && r.receiveOffice !== toOffice) return false;
      if (fromWarehouse !== "All Warehouses" && r.fromWarehouse !== fromWarehouse) return false;
      if (toWarehouse !== "All Warehouses" && r.receiveWarehouse !== toWarehouse) return false;
      if (fromDate && r.transferDate < fromDate) return false;
      if (toDate && r.transferDate > toDate) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          r.transferCode.toLowerCase().includes(q) ||
          r.requestCode.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q) ||
          r.fromWarehouse.toLowerCase().includes(q) ||
          r.receiveWarehouse.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [fromOffice, toOffice, fromWarehouse, toWarehouse, fromDate, toDate, searchTerm]);

  // Filter Transfer Received Data
  const filteredReceived = useMemo(() => {
    return DEMO_TRANSFER_RECEIVED.filter((r) => {
      if (fromOffice !== "All Offices" && r.fromOffice !== fromOffice) return false;
      if (fromWarehouse !== "All Warehouses" && r.fromWarehouse !== fromWarehouse) return false;
      if (toWarehouse !== "All Warehouses" && r.receiveWarehouse !== toWarehouse) return false;
      if (fromDate && r.receiveDate < fromDate) return false;
      if (toDate && r.receiveDate > toDate) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          r.transferCode.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q) ||
          r.vehicleNo.toLowerCase().includes(q) ||
          r.receivedBy.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [fromOffice, fromWarehouse, toWarehouse, fromDate, toDate, searchTerm]);

  // Filter Transfer In Transit Data
  const filteredInTransit = useMemo(() => {
    return DEMO_TRANSFER_IN_TRANSIT.filter((r) => {
      if (fromWarehouse !== "All Warehouses" && r.fromWarehouse !== fromWarehouse) return false;
      if (toWarehouse !== "All Warehouses" && r.destinationWarehouse !== toWarehouse) return false;
      if (fromDate && r.dispatchDate < fromDate) return false;
      if (toDate && r.dispatchDate > toDate) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          r.transferCode.toLowerCase().includes(q) ||
          r.requestCode.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q) ||
          r.vehicleNo.toLowerCase().includes(q) ||
          r.driverName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [fromWarehouse, toWarehouse, fromDate, toDate, searchTerm]);

  // Current active data list
  const currentCount =
    viewBy === "Transfer Out"
      ? filteredTransferOut.length
      : viewBy === "Transfer Received"
      ? filteredReceived.length
      : filteredInTransit.length;

  const totalPages = Math.ceil(currentCount / rowsPerPage) || 1;

  // Format Date for report display
  const formatDateDisplay = (d: string) => {
    if (!d) return "";
    const p = d.split("-");
    if (p.length === 3) {
      return `${p[2]}-${p[1]}-${p[0]}`;
    }
    return d;
  };

  // CSV Export for Transfer Report
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (viewBy === "Transfer Out") {
      headers = [
        "SL",
        "Transfer Date",
        "Transfer Code",
        "Request Code",
        "From Office",
        "From Warehouse",
        "Receive Office",
        "Receive Warehouse",
        "Item Name",
        "Total Qty",
        "Received Qty",
        "In Transit Qty",
        "Status",
      ];
      rows = filteredTransferOut.map((r, i) => [
        i + 1,
        r.transferDate,
        r.transferCode,
        r.requestCode,
        `"${r.fromOffice}"`,
        `"${r.fromWarehouse}"`,
        `"${r.receiveOffice}"`,
        `"${r.receiveWarehouse}"`,
        `"${r.itemName}"`,
        r.totalQty,
        r.receivedQty,
        r.inTransitQty,
        r.status,
      ]);
    } else if (viewBy === "Transfer Received") {
      headers = [
        "SL",
        "Receive Date",
        "Transfer Date",
        "Transfer Code",
        "From Warehouse",
        "Receive Warehouse",
        "Item Name",
        "Received Qty",
        "Loading Temp",
        "Chilling Temp",
        "Vehicle No",
        "Received By",
        "Status",
      ];
      rows = filteredReceived.map((r, i) => [
        i + 1,
        r.receiveDate,
        r.transferDate,
        r.transferCode,
        `"${r.fromWarehouse}"`,
        `"${r.receiveWarehouse}"`,
        `"${r.itemName}"`,
        r.receivedQty,
        r.loadingTemp,
        r.chillingTemp,
        `"${r.vehicleNo}"`,
        `"${r.receivedBy}"`,
        r.status,
      ]);
    } else {
      headers = [
        "SL",
        "Dispatch Date",
        "Transfer Code",
        "Request Code",
        "From Warehouse",
        "Destination Warehouse",
        "Item Name",
        "In Transit Qty",
        "Vehicle No",
        "Driver Name",
        "Driver Contact",
        "Est Arrival",
        "Status",
      ];
      rows = filteredInTransit.map((r, i) => [
        i + 1,
        r.dispatchDate,
        r.transferCode,
        r.requestCode,
        `"${r.fromWarehouse}"`,
        `"${r.destinationWarehouse}"`,
        `"${r.itemName}"`,
        r.inTransitQty,
        `"${r.vehicleNo}"`,
        `"${r.driverName}"`,
        `"${r.driverContact}"`,
        r.estArrival,
        r.status,
      ]);
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `transfer_report_${viewBy.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPI Calculations
  const totalOutSum = filteredTransferOut.reduce((sum, r) => sum + r.totalQty, 0);
  const totalReceivedSum = filteredTransferOut.reduce((sum, r) => sum + r.receivedQty, 0);
  const totalInTransitSum = filteredTransferOut.reduce((sum, r) => sum + r.inTransitQty, 0);

  return (
    <div className="space-y-3 p-1 font-sans text-slate-800">
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER (Exact to Screenshot 2)                            */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Transfer Report
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search...."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* EXCEL Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3.5 bg-white hover:bg-slate-50 text-[#1976d2] border border-[#1976d2] font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXCEL</span>
          </button>

          {/* PRINT/PDF Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3.5 bg-white hover:bg-slate-50 text-[#1976d2] border border-[#1976d2] font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PRINT/PDF</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 2. PRIMARY VIEW SELECTOR: View By * (Screenshot 2)               */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded border border-slate-200 space-y-4 text-xs">
        <div className="max-w-md">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            View By <span className="text-rose-500 font-bold">*</span>
          </label>
          <div className="relative">
            <select
              value={viewBy}
              onChange={(e) => {
                setViewBy(e.target.value as TransferReportMode);
                setPage(1);
              }}
              className="w-full border-2 border-blue-500 rounded px-3 py-2 bg-white text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="Transfer Out">Transfer Out</option>
              <option value="Transfer Received">Transfer Received</option>
              <option value="Transfer In Transit">Transfer In Transit</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">From Office</label>
            <select
              value={fromOffice}
              onChange={(e) => setFromOffice(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs text-slate-700"
            >
              {OFFICE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">From Warehouse</label>
            <select
              value={fromWarehouse}
              onChange={(e) => setFromWarehouse(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs text-slate-700"
            >
              {WAREHOUSE_OPTIONS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">To Warehouse</label>
            <select
              value={toWarehouse}
              onChange={(e) => setToWarehouse(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs text-slate-700"
            >
              {WAREHOUSE_OPTIONS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1 bg-white text-xs text-slate-700"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">To Date</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1 bg-white text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={() => setPage(1)}
                className="h-8 px-4 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold text-xs rounded transition"
              >
                View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 3. REPORT DOCUMENT AREA (Mariners Group Layout)                  */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-6">
        {/* Centered Organization Header */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Transfer Report - {viewBy}
          </h2>
          <h3 className="text-sm font-semibold text-slate-800">
            Mariners Group
          </h3>
          <p className="text-xs text-slate-600">
            10th Floor, MG SAM Center, 12 Bir Uttam A. K. Khandakar Road, Mohakhali C/A, Dhaka-1212, Bangladesh
          </p>
          <p className="text-xs font-medium text-slate-700 pt-1">
            From: {formatDateDisplay(fromDate)} &nbsp; To: {formatDateDisplay(toDate)}
          </p>
        </div>

        {/* Highlight KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Total Dispatched Qty
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {totalOutSum.toLocaleString()} Units
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Total Received Qty
            </div>
            <div className="text-base font-bold text-emerald-700 mt-0.5">
              {totalReceivedSum.toLocaleString()} Units
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Total In-Transit Qty
            </div>
            <div className="text-base font-bold text-blue-700 mt-0.5">
              {totalInTransitSum.toLocaleString()} Units
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Transfer Records Found
            </div>
            <div className="text-base font-bold text-slate-800 mt-0.5">
              {currentCount} Entries
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* VIEW BY 1: TRANSFER OUT TABLE                                 */}
        {/* ───────────────────────────────────────────────────────────── */}
        {viewBy === "Transfer Out" && (
          <div className="border border-slate-200 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">SL</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Transfer Code</th>
                    <th className="py-2.5 px-3">Request Code</th>
                    <th className="py-2.5 px-3">From Warehouse</th>
                    <th className="py-2.5 px-3">To Warehouse</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-right">Total Qty</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                    <th className="py-2.5 px-3 text-right">In Transit</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTransferOut.map((r, i) => (
                    <tr key={r.transferCode} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-500 font-medium">{i + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                        {formatDateDisplay(r.transferDate)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-blue-700 whitespace-nowrap">
                        {r.transferCode}
                      </td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                        {r.requestCode || "-"}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{r.fromWarehouse}</td>
                      <td className="py-2 px-3 text-slate-700">{r.receiveWarehouse}</td>
                      <td className="py-2 px-3 font-medium text-slate-900 max-w-xs">
                        {r.itemName}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {r.totalQty.toFixed(1)} {r.uom}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                        {r.receivedQty.toFixed(1)} {r.uom}
                      </td>
                      <td className="py-2 px-3 text-right text-blue-700 font-medium">
                        {r.inTransitQty > 0 ? `${r.inTransitQty.toFixed(1)} ${r.uom}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            r.status === "Completed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={7} className="py-2.5 px-3 text-right">
                      Grand Total:
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900">
                      {totalOutSum.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-800">
                      {totalReceivedSum.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-2.5 px-3 text-right text-blue-800">
                      {totalInTransitSum.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-2.5 px-3 text-center">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* VIEW BY 2: TRANSFER RECEIVED TABLE                            */}
        {/* ───────────────────────────────────────────────────────────── */}
        {viewBy === "Transfer Received" && (
          <div className="border border-slate-200 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">SL</th>
                    <th className="py-2.5 px-3">Receive Date</th>
                    <th className="py-2.5 px-3">Transfer Code</th>
                    <th className="py-2.5 px-3">From Warehouse</th>
                    <th className="py-2.5 px-3">Receive Warehouse</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-right">Received Qty</th>
                    <th className="py-2.5 px-3 text-center">Chilling Temp</th>
                    <th className="py-2.5 px-3">Transport Vehicle</th>
                    <th className="py-2.5 px-3">Received By</th>
                    <th className="py-2.5 px-3 text-center">Quality Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredReceived.map((r, i) => (
                    <tr key={r.transferCode + i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-500 font-medium">{i + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                        {formatDateDisplay(r.receiveDate)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-blue-700 whitespace-nowrap">
                        {r.transferCode}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{r.fromWarehouse}</td>
                      <td className="py-2 px-3 text-slate-700">{r.receiveWarehouse}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{r.itemName}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-800">
                        {r.receivedQty.toFixed(1)} {r.uom}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-[11px] text-blue-800">
                        {r.chillingTemp}
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                        {r.vehicleNo}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{r.receivedBy}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* VIEW BY 3: TRANSFER IN TRANSIT TABLE                          */}
        {/* ───────────────────────────────────────────────────────────── */}
        {viewBy === "Transfer In Transit" && (
          <div className="border border-slate-200 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">SL</th>
                    <th className="py-2.5 px-3">Dispatch Date</th>
                    <th className="py-2.5 px-3">Transfer Code</th>
                    <th className="py-2.5 px-3">Origin Warehouse</th>
                    <th className="py-2.5 px-3">Destination Warehouse</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-right">In Transit Qty</th>
                    <th className="py-2.5 px-3">Carrier / Vehicle</th>
                    <th className="py-2.5 px-3">Driver Contact</th>
                    <th className="py-2.5 px-3">Est. Delivery</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInTransit.map((r, i) => (
                    <tr key={r.transferCode + i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-500 font-medium">{i + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                        {formatDateDisplay(r.dispatchDate)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-blue-700 whitespace-nowrap">
                        {r.transferCode}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{r.fromWarehouse}</td>
                      <td className="py-2 px-3 text-slate-700">{r.destinationWarehouse}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{r.itemName}</td>
                      <td className="py-2 px-3 text-right font-bold text-blue-700">
                        {r.inTransitQty.toFixed(1)} {r.uom}
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium">{r.vehicleNo}</td>
                      <td className="py-2 px-3 text-slate-600">
                        <div>{r.driverName}</div>
                        <div className="font-mono text-[10px] text-slate-500">{r.driverContact}</div>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-700">{r.estArrival}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Print Signatures Block */}
        <div className="pt-12 grid grid-cols-4 gap-6 text-center text-xs text-slate-600 border-t border-slate-200">
          <div>
            <div className="border-t border-dashed border-slate-400 pt-1 font-medium">
              Dispatched By
            </div>
          </div>
          <div>
            <div className="border-t border-dashed border-slate-400 pt-1 font-medium">
              Vehicle Driver / Carrier
            </div>
          </div>
          <div>
            <div className="border-t border-dashed border-slate-400 pt-1 font-medium">
              Warehouse In-Charge (Receiver)
            </div>
          </div>
          <div>
            <div className="border-t border-dashed border-slate-400 pt-1 font-medium">
              Inventory Controller
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
