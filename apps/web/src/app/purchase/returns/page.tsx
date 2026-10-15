"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Eye,
  Printer,
  Edit,
  Plus,
  Search,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { toast } from "@/components/ui/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  PurchaseReturn,
  GoodsReceipt,
  CreatePurchaseReturnInput,
} from "@bridgeone/contracts";

// ============================================================================
// REALISTIC MOCK FALLBACK DATA MATCHING SCREENSHOT 1 (RECEIVED LIST - 30 ROWS)
// ============================================================================
interface ReceivedRow {
  sl: number;
  receiveDate: string;
  poNo: string;
  returnInvoiceNo: string;
  remarks: string;
  supplier: string;
  amount: number;
  office: string;
  items?: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    uom: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

const INITIAL_RECEIVED_LIST: ReceivedRow[] = [
  {
    sl: 1,
    receiveDate: "29-09-2026",
    poNo: "PO-BRG260900039",
    returnInvoiceNo: "GRN-BRG260900052",
    remarks: "N/A",
    supplier: "Piticon Precision Industries (01730-302047)",
    amount: 41040.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-01", itemCode: "RAW-PTC-01", itemName: "Industrial Resin Granules Grade A", uom: "KG", quantity: 380, unitPrice: 108.0, lineTotal: 41040.0 },
    ],
  },
  {
    sl: 2,
    receiveDate: "26-09-2026",
    poNo: "PO-BRG260900012",
    returnInvoiceNo: "SRV-BRG260900051",
    remarks: "Chalan date 10.09.2026",
    supplier: "Bengal Poly & Packaging Ltd (01734-431700)",
    amount: 61070.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-02", itemCode: "PKG-SRK-02", itemName: "Corrugated Master Cartons (5 Ply)", uom: "PCS", quantity: 1400, unitPrice: 43.62, lineTotal: 61070.0 },
    ],
  },
  {
    sl: 3,
    receiveDate: "26-09-2026",
    poNo: "PO-BRG260800008",
    returnInvoiceNo: "GRN-BRG260900050",
    remarks: "N/A",
    supplier: "Toha Industrial Corporation (01768-116460)",
    amount: 25500.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-03", itemCode: "RAW-TH-03", itemName: "HDPE Blow Moulding Polymer Granules", uom: "KG", quantity: 150, unitPrice: 170.0, lineTotal: 25500.0 },
    ],
  },
  {
    sl: 4,
    receiveDate: "26-09-2026",
    poNo: "PO-BRG260900002",
    returnInvoiceNo: "GRN-BRG260900049",
    remarks: "N/A",
    supplier: "BridgeOne Technologies Supplies (01894-802917)",
    amount: 130000.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-04", itemCode: "RAW-TK-04", itemName: "Refined Palm Stearin (Food Grade)", uom: "KG", quantity: 1000, unitPrice: 130.0, lineTotal: 130000.0 },
    ],
  },
  {
    sl: 5,
    receiveDate: "24-09-2026",
    poNo: "PO-BRG260800008",
    returnInvoiceNo: "GRN-BRG260900048",
    remarks: "N/A",
    supplier: "Toha Industrial Corporation (01768-116460)",
    amount: 25500.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-05", itemCode: "RAW-TH-05", itemName: "HDPE Blow Moulding Polymer Granules", uom: "KG", quantity: 150, unitPrice: 170.0, lineTotal: 25500.0 },
    ],
  },
  {
    sl: 6,
    receiveDate: "24-09-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900047",
    remarks: "N/A",
    supplier: "Meghna Industrial Automation (01711-234567)",
    amount: 45850.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-06", itemCode: "STN-AS-01", itemName: "Factory Cleaning Chemical & Liquid Detergent Drums", uom: "LTR", quantity: 450, unitPrice: 101.89, lineTotal: 45850.0 },
    ],
  },
  {
    sl: 7,
    receiveDate: "23-09-2026",
    poNo: "PO-BRG260900033",
    returnInvoiceNo: "GRN-BRG260900046",
    remarks: "N/A",
    supplier: "Prime Packaging Solutions Ltd (01711-889900)",
    amount: 18950.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-07", itemCode: "STN-AS-02", itemName: "Sanitary Cotton Waste & Heavy Duty Hand Gloves", uom: "KG", quantity: 190, unitPrice: 99.74, lineTotal: 18950.0 },
    ],
  },
  {
    sl: 8,
    receiveDate: "22-09-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900045",
    remarks: "N/A",
    supplier: "Crown Cement & Concrete PLC (01715-998822)",
    amount: 75000.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-08", itemCode: "MISC-01", itemName: "Rapid Setting Portland Cement (Grade 43)", uom: "BAG", quantity: 150, unitPrice: 500.0, lineTotal: 75000.0 },
    ],
  },
  {
    sl: 9,
    receiveDate: "22-09-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900044",
    remarks: "N/A",
    supplier: "Eastern Lubricants & Oils (01712-445566)",
    amount: 32400.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-09", itemCode: "STN-AS-03", itemName: "Industrial Gear Oil ISO VG 220", uom: "LTR", quantity: 120, unitPrice: 270.0, lineTotal: 32400.0 },
    ],
  },
  {
    sl: 10,
    receiveDate: "22-09-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900043",
    remarks: "N/A",
    supplier: "National Polymer Group (01819-223344)",
    amount: 58200.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-10", itemCode: "SMP-01", itemName: "UPVC Pressure Pipe Fittings & Flanges", uom: "SET", quantity: 60, unitPrice: 970.0, lineTotal: 58200.0 },
    ],
  },
  {
    sl: 11,
    receiveDate: "21-09-2026",
    poNo: "PO-BRG260900013",
    returnInvoiceNo: "GRN-BRG260900042",
    remarks: "N/A",
    supplier: "AJ Overseas Company Ltd (01841-825700)",
    amount: 64800.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-11", itemCode: "RAW-AJ-01", itemName: "Food Preservative Potassium Sorbate", uom: "KG", quantity: 150, unitPrice: 432.0, lineTotal: 64800.0 },
    ],
  },
  {
    sl: 12,
    receiveDate: "21-09-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900041",
    remarks: "N/A",
    supplier: "BridgeOne Technologies Supplies (01894-802917)",
    amount: 60400.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-12", itemCode: "RAW-UFM-01", itemName: "Premium Whole Wheat Flour (Atta 50kg)", uom: "BAG", quantity: 40, unitPrice: 1510.0, lineTotal: 60400.0 },
    ],
  },
  {
    sl: 13,
    receiveDate: "21-09-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900040",
    remarks: "N/A",
    supplier: "Freshpack Industrial Containers (01844-154045)",
    amount: 135000.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-13", itemCode: "RAW-VV-01", itemName: "Refined White Sugar Grade A", uom: "KG", quantity: 1200, unitPrice: 112.5, lineTotal: 135000.0 },
    ],
  },
  {
    sl: 14,
    receiveDate: "21-09-2026",
    poNo: "PO-BRG260900001",
    returnInvoiceNo: "GRN-BRG260900039",
    remarks: "N/A",
    supplier: "Rangs Industrial Energy Corp (01977-026090)",
    amount: 144000.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-14", itemCode: "RAW-SAM-01", itemName: "Special Puffed Rice (Muri 25kg)", uom: "BAG", quantity: 120, unitPrice: 1200.0, lineTotal: 144000.0 },
    ],
  },
  {
    sl: 15,
    receiveDate: "14-09-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900038",
    remarks: "N/A",
    supplier: "Meghna Industrial Automation (01711-234567)",
    amount: 52000.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-15", itemCode: "STN-AS-04", itemName: "Electrical Contactors & Circuit Breakers", uom: "SET", quantity: 10, unitPrice: 5200.0, lineTotal: 52000.0 },
    ],
  },
  {
    sl: 16,
    receiveDate: "14-09-2026",
    poNo: "PO-BRG260900001",
    returnInvoiceNo: "GRN-BRG260900037",
    remarks: "N/A",
    supplier: "Rangs Industrial Energy Corp (01977-026090)",
    amount: 150400.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-16", itemCode: "RAW-SAM-02", itemName: "Special Puffed Rice Export Quality", uom: "BAG", quantity: 125, unitPrice: 1203.2, lineTotal: 150400.0 },
    ],
  },
  {
    sl: 17,
    receiveDate: "14-09-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900036",
    remarks: "N/A",
    supplier: "Freshpack Industrial Containers (01844-154045)",
    amount: 13550.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-17", itemCode: "PKG-PF-01", itemName: "Shrink Wrap Film Roll 18 Micron", uom: "ROLL", quantity: 15, unitPrice: 903.33, lineTotal: 13550.0 },
    ],
  },
  {
    sl: 18,
    receiveDate: "14-09-2026",
    poNo: "PO-BRG260700019",
    returnInvoiceNo: "GRN-BRG260900035",
    remarks: "N/A",
    supplier: "Freshpack Industrial Containers (01844-154045)",
    amount: 178125.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-18", itemCode: "PKG-PF-02", itemName: "BOPP Printed Packing Tape 2 Inch", uom: "ROLL", quantity: 950, unitPrice: 187.5, lineTotal: 178125.0 },
    ],
  },
  {
    sl: 19,
    receiveDate: "14-09-2026",
    poNo: "PO-BRG260900011",
    returnInvoiceNo: "GRN-BRG260900034",
    remarks: "N/A",
    supplier: "Maritime Logistical Freight Ltd (01713-370896)",
    amount: 40325.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-19", itemCode: "LOG-ME-01", itemName: "Plastic Cargo Transport Pallets (Heavy)", uom: "PCS", quantity: 35, unitPrice: 1152.14, lineTotal: 40325.0 },
    ],
  },
  {
    sl: 20,
    receiveDate: "13-09-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900033",
    remarks: "N/A",
    supplier: "Hasan Trading & Chemical Corp (01713-941484)",
    amount: 24500.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-20", itemCode: "MISC-02", itemName: "Industrial Degreasing Solvent Chemical", uom: "DRUM", quantity: 5, unitPrice: 4900.0, lineTotal: 24500.0 },
    ],
  },
  {
    sl: 21,
    receiveDate: "12-09-2026",
    poNo: "PO-BRG260900004",
    returnInvoiceNo: "GRN-BRG260900032",
    remarks: "N/A",
    supplier: "Hasan Trading & Chemical Corp (01713-941484)",
    amount: 16995.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-21", itemCode: "HRD-GM-01", itemName: "Stainless Steel Fasteners & Hex Bolts", uom: "KG", quantity: 45, unitPrice: 377.67, lineTotal: 16995.0 },
    ],
  },
  {
    sl: 22,
    receiveDate: "12-09-2026",
    poNo: "PO-BRG260500054",
    returnInvoiceNo: "GRN-BRG260900031",
    remarks: "N/A",
    supplier: "Hasan Trading & Chemical Corp (01713-941484)",
    amount: 32390.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-22", itemCode: "HRD-GM-02", itemName: "High Pressure Hydraulic Hose Assembly", uom: "SET", quantity: 8, unitPrice: 4048.75, lineTotal: 32390.0 },
    ],
  },
  {
    sl: 23,
    receiveDate: "12-09-2026",
    poNo: "PO-BRG260900008",
    returnInvoiceNo: "GRN-BRG260900030",
    remarks: "N/A",
    supplier: "Rangs Industrial Energy Corp (01977-026090)",
    amount: 28950.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-23", itemCode: "ELC-AT-01", itemName: "Industrial Cable Lugs & Heavy Terminal Ferrules", uom: "BOX", quantity: 15, unitPrice: 1930.0, lineTotal: 28950.0 },
    ],
  },
  {
    sl: 24,
    receiveDate: "12-09-2026",
    poNo: "PO-BRG260900009",
    returnInvoiceNo: "GRN-BRG260900029",
    remarks: "N/A",
    supplier: "Hasan Trading & Chemical Corp (01713-941484)",
    amount: 48000.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-24", itemCode: "RAW-HTC-01", itemName: "Refined Citric Acid Anhydrous", uom: "BAG", quantity: 16, unitPrice: 3000.0, lineTotal: 48000.0 },
    ],
  },
  {
    sl: 25,
    receiveDate: "12-09-2026",
    poNo: "PO-BRG260900010",
    returnInvoiceNo: "GRN-BRG260900028",
    remarks: "N/A",
    supplier: "Prime Packaging Solutions Ltd (01711-889900)",
    amount: 36000.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-25", itemCode: "RAW-PMS-01", itemName: "Corrugated Export Packaging Cartons", uom: "PCS", quantity: 800, unitPrice: 45.0, lineTotal: 36000.0 },
    ],
  },
  {
    sl: 26,
    receiveDate: "12-09-2026",
    poNo: "PO-BRG260500013",
    returnInvoiceNo: "GRN-BRG260900027",
    remarks: "N/A",
    supplier: "Bengal Poly & Packaging Ltd (01734-431700)",
    amount: 19750.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-26", itemCode: "STN-AS-05", itemName: "Heavy Duty Polyethylene Sacks (50kg)", uom: "PCS", quantity: 500, unitPrice: 39.5, lineTotal: 19750.0 },
    ],
  },
  {
    sl: 27,
    receiveDate: "18-08-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900026",
    remarks: "N/A",
    supplier: "FM Precision Plastics PLC (01313-369727)",
    amount: 31020.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-27", itemCode: "PKG-FM-01", itemName: "PET Bottle Preforms 500ml", uom: "BOX", quantity: 60, unitPrice: 517.0, lineTotal: 31020.0 },
    ],
  },
  {
    sl: 28,
    receiveDate: "12-09-2026",
    poNo: "PO-BRG260800012",
    returnInvoiceNo: "SRV-BRG260900025",
    remarks: "Ad last chalan",
    supplier: "Bengal Poly & Packaging Ltd (01734-431700)",
    amount: 30460.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-28", itemCode: "PKG-SRK-03", itemName: "Corrugated Carton Partitions", uom: "PCS", quantity: 1000, unitPrice: 30.46, lineTotal: 30460.0 },
    ],
  },
  {
    sl: 29,
    receiveDate: "12-09-2026",
    poNo: "PO-BRG260800012",
    returnInvoiceNo: "SRV-BRG260900024",
    remarks: "Date:02.09.26",
    supplier: "Bengal Poly & Packaging Ltd (01734-431700)",
    amount: 60690.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-29", itemCode: "PKG-SRK-04", itemName: "Custom Printed Inner Cartons", uom: "PCS", quantity: 2000, unitPrice: 30.345, lineTotal: 60690.0 },
    ],
  },
  {
    sl: 30,
    receiveDate: "12-09-2026",
    poNo: "Direct",
    returnInvoiceNo: "GRN-BRG260900023",
    remarks: "N/A",
    supplier: "Freshpack Industrial Containers (01844-154045)",
    amount: 28460.0,
    office: "MG Sirajganj Factory",
    items: [
      { itemId: "it-30", itemCode: "PKG-PF-03", itemName: "Heavy Duty Strapping Band Rolls", uom: "ROLL", quantity: 15, unitPrice: 1897.33, lineTotal: 28460.0 },
    ],
  },
];

// ============================================================================
// REALISTIC MOCK FALLBACK DATA MATCHING SCREENSHOT 2 (RETURN LIST - 30 ROWS)
// ============================================================================
interface ReturnRow {
  sl: number;
  officeName: string;
  returnDate: string;
  poNo: string;
  returnNo: string;
  remarks: string;
  supplier: string;
  amount: number;
  returnType: string;
  status: "Approved" | "Pending" | "Draft" | "Rejected";
  items?: Array<{
    itemCode: string;
    itemName: string;
    uom: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    reason: string;
  }>;
}

const INITIAL_RETURN_LIST: ReturnRow[] = [
  {
    sl: 1,
    officeName: "Marinozz",
    returnDate: "09-09-2025",
    poNo: "Direct",
    returnNo: "POB-MG260500003",
    remarks: "Opening Balance...",
    supplier: "AF Printing Packaging & Accessorise (01833401899)",
    amount: 21000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "PKG-AF-01", itemName: "Corrugated Liner Board Return", uom: "PCS", quantity: 700, unitPrice: 30.0, lineTotal: 21000.0, reason: "Opening Balance adjustment" },
    ],
  },
  {
    sl: 2,
    officeName: "Marinozz",
    returnDate: "10-09-2025",
    poNo: "Direct",
    returnNo: "POB-MG260500002",
    remarks: "Opening Balance...",
    supplier: "AF Printing Packaging & Accessorise (01833401899)",
    amount: 61950.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "PKG-AF-02", itemName: "Printed Paper Labels Rejection", uom: "ROLL", quantity: 350, unitPrice: 177.0, lineTotal: 61950.0, reason: "Opening Balance adjustment" },
    ],
  },
  {
    sl: 3,
    officeName: "Marinozz",
    returnDate: "20-11-2025",
    poNo: "Direct",
    returnNo: "POB-MG260500001",
    remarks: "Opening Balance...",
    supplier: "AF Printing Packaging & Accessorise (01833401899)",
    amount: 96300.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "PKG-AF-03", itemName: "Kraft Packing Paper Rolls", uom: "ROLL", quantity: 60, unitPrice: 1605.0, lineTotal: 96300.0, reason: "Opening Balance adjustment" },
    ],
  },
  {
    sl: 4,
    officeName: "Marinozz",
    returnDate: "05-11-2025",
    poNo: "Direct",
    returnNo: "POB-MG260500000",
    remarks: "Opening Balance...",
    supplier: "AF Printing Packaging & Accessorise (01833401899)",
    amount: 27700.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "PKG-AF-04", itemName: "Cardboard Separator Sheets", uom: "PCS", quantity: 1000, unitPrice: 27.7, lineTotal: 27700.0, reason: "Opening Balance adjustment" },
    ],
  },
  {
    sl: 5,
    officeName: "Dhaka Head Office",
    returnDate: "01-11-2025",
    poNo: "Direct",
    returnNo: "POB-MG260400008",
    remarks: "Opening Balance...",
    supplier: "Musfique Trading (01725415082)",
    amount: 3600000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "RAW-MT-01", itemName: "Imported Edible Palm Oil Bulk (Debit)", uom: "MT", quantity: 30, unitPrice: 120000.0, lineTotal: 3600000.0, reason: "Opening reconciliation" },
    ],
  },
  {
    sl: 6,
    officeName: "Dhaka Head Office",
    returnDate: "01-04-2026",
    poNo: "Direct",
    returnNo: "POB-MG260400007",
    remarks: "Opening Balance...",
    supplier: "BridgeOne Technologies Ltd (01329731801)",
    amount: 1375000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "IT-AI-01", itemName: "Server Rack Equipment Return", uom: "SET", quantity: 5, unitPrice: 275000.0, lineTotal: 1375000.0, reason: "Replaced under AMC" },
    ],
  },
  {
    sl: 7,
    officeName: "Gazipur Plant",
    returnDate: "01-04-2026",
    poNo: "Direct",
    returnNo: "POB-MG260400006",
    remarks: "Opening Balance...",
    supplier: "BridgeOne Technologies Ltd (01329731801)",
    amount: 50000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "IT-AI-02", itemName: "Industrial Barcode Scanner Terminals", uom: "PCS", quantity: 2, unitPrice: 25000.0, lineTotal: 50000.0, reason: "Spec mismatch" },
    ],
  },
  {
    sl: 8,
    officeName: "Dhaka Head Office",
    returnDate: "01-04-2026",
    poNo: "Direct",
    returnNo: "POB-MG260400005",
    remarks: "Opening Balance...",
    supplier: "BridgeOne Technologies Ltd (01329731801)",
    amount: 100000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "IT-AI-03", itemName: "Network Core Switch 48 Port Return", uom: "PCS", quantity: 1, unitPrice: 100000.0, lineTotal: 100000.0, reason: "Hardware failure" },
    ],
  },
  {
    sl: 9,
    officeName: "Dhaka Head Office",
    returnDate: "15-04-2026",
    poNo: "Direct",
    returnNo: "POB-MG260400004",
    remarks: "Opening Balance...",
    supplier: "Furniture Concept (01329749970)",
    amount: 352840.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "FUR-FC-01", itemName: "Executive Office Desk Set Defective", uom: "SET", quantity: 8, unitPrice: 44105.0, lineTotal: 352840.0, reason: "Surface scratch defect" },
    ],
  },
  {
    sl: 10,
    officeName: "MOHS Eco",
    returnDate: "15-04-2026",
    poNo: "Direct",
    returnNo: "POB-MG260400003",
    remarks: "Opening Balance...",
    supplier: "Furniture Concept (01329749970)",
    amount: 175000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "FUR-FC-02", itemName: "Conference Room Ergonomic Chairs", uom: "PCS", quantity: 14, unitPrice: 12500.0, lineTotal: 175000.0, reason: "Color mismatch" },
    ],
  },
  {
    sl: 11,
    officeName: "Marinozz",
    returnDate: "01-01-2026",
    poNo: "Direct",
    returnNo: "POB-MG260400002",
    remarks: "Opening Balance...",
    supplier: "Furniture Concept (01329749970)",
    amount: 200000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "FUR-FC-03", itemName: "Reception Counter Wooden Partition", uom: "SET", quantity: 2, unitPrice: 100000.0, lineTotal: 200000.0, reason: "Opening balance reversal" },
    ],
  },
  {
    sl: 12,
    officeName: "Dhaka Head Office",
    returnDate: "16-03-2026",
    poNo: "Direct",
    returnNo: "POB-MG260400001",
    remarks: "Opening Balance...",
    supplier: "Thermokool Refrigeration Systems (01713175865)",
    amount: 708500.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "REF-TK-01", itemName: "Cold Storage Evaporator Coil Unit", uom: "UNIT", quantity: 2, unitPrice: 354250.0, lineTotal: 708500.0, reason: "Refrigerant leak defect" },
    ],
  },
  {
    sl: 13,
    officeName: "Dhaka Head Office",
    returnDate: "01-11-2025",
    poNo: "Direct",
    returnNo: "POB-MG260400000",
    remarks: "Opening Balance...",
    supplier: "Md. Belal Hossain (Transport) (0171111114)",
    amount: 1551000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "TRN-BH-01", itemName: "Inter-district Logistics Overcharge Reversal", uom: "LOT", quantity: 1, unitPrice: 1551000.0, lineTotal: 1551000.0, reason: "Audit debit note" },
    ],
  },
  {
    sl: 14,
    officeName: "Dhaka Head Office",
    returnDate: "15-02-2026",
    poNo: "Direct",
    returnNo: "POB-MG260200000",
    remarks: "Opening Balance...",
    supplier: "ARINA ELECTRIC WORKS (01729983558)",
    amount: 809152.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "ELC-AE-01", itemName: "Substation Transformer Busbar Fittings", uom: "SET", quantity: 4, unitPrice: 202288.0, lineTotal: 809152.0, reason: "Opening balance credit" },
    ],
  },
  {
    sl: 15,
    officeName: "Dhaka Head Office",
    returnDate: "31-10-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251200005",
    remarks: "Opening Balance...",
    supplier: "G.M Traders (01711536948)",
    amount: 87714.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "HRD-GM-05", itemName: "Heavy Conveyor Belt Roller Bearings", uom: "PCS", quantity: 18, unitPrice: 4873.0, lineTotal: 87714.0, reason: "Damaged in transit" },
    ],
  },
  {
    sl: 16,
    officeName: "Dhaka Head Office",
    returnDate: "01-12-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251200004",
    remarks: "Opening Balance...",
    supplier: "Khondokar Packing Industries (01711190235)",
    amount: 115140.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "PKG-KP-01", itemName: "Printed Poly Film Packing Pouches", uom: "KG", quantity: 420, unitPrice: 274.14, lineTotal: 115140.0, reason: "Print shade difference" },
    ],
  },
  {
    sl: 17,
    officeName: "Dhaka Head Office",
    returnDate: "01-12-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251200003",
    remarks: "Opening Balance...",
    supplier: "Abir Trade International (01722757720)",
    amount: 294200.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "RAW-AT-01", itemName: "Chemical Stabilizer Powder Return", uom: "BAG", quantity: 20, unitPrice: 14710.0, lineTotal: 294200.0, reason: "Moisture damaged" },
    ],
  },
  {
    sl: 18,
    officeName: "Dhaka Head Office",
    returnDate: "01-11-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251200002",
    remarks: "Opening Balance...",
    supplier: "M/S Abdul Aziz Filling Station (01711161702)",
    amount: 586882.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "POL-AA-01", itemName: "Industrial Fuel Diesel Return / Credit Note", uom: "LTR", quantity: 5400, unitPrice: 108.68, lineTotal: 586882.0, reason: "Adjustment memo" },
    ],
  },
  {
    sl: 19,
    officeName: "Dhaka Head Office",
    returnDate: "01-11-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251200001",
    remarks: "Opening Balance...",
    supplier: "F.N.F Thai & S.S Point (0182376833)",
    amount: 117394.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "CON-FNF-01", itemName: "Aluminum Glazing Profiles & Fittings", uom: "PCS", quantity: 62, unitPrice: 1893.45, lineTotal: 117394.0, reason: "Bent profiles" },
    ],
  },
  {
    sl: 20,
    officeName: "Dhaka Head Office",
    returnDate: "01-11-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251200000",
    remarks: "Opening Balance...",
    supplier: "M/S Sohel & Brothers (01703721124)",
    amount: 11299.5,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "MISC-SB-01", itemName: "Factory Plumbing Pipes & Valves", uom: "SET", quantity: 5, unitPrice: 2259.9, lineTotal: 11299.5, reason: "Wrong dimension" },
    ],
  },
  {
    sl: 21,
    officeName: "Dhaka Head Office",
    returnDate: "01-11-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251100443",
    remarks: "Opening Balance...",
    supplier: "Munshi Paper House (01068442955)",
    amount: 2293.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "STN-MPH-01", itemName: "Office Register Books & Ledgers", uom: "PCS", quantity: 10, unitPrice: 229.3, lineTotal: 2293.0, reason: "Damaged binding" },
    ],
  },
  {
    sl: 22,
    officeName: "Dhaka Head Office",
    returnDate: "31-10-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251100433",
    remarks: "Opening Balance...",
    supplier: "Janani Printing & Packaging (01716769686)",
    amount: 260779.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "PKG-JPP-01", itemName: "Duplex Board Export Boxes", uom: "PCS", quantity: 5500, unitPrice: 47.41, lineTotal: 260779.0, reason: "Moisture defect" },
    ],
  },
  {
    sl: 23,
    officeName: "Dhaka Head Office",
    returnDate: "17-11-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251100429",
    remarks: "Opening Balance...",
    supplier: "Star Agro Processing Industries (01312475727)",
    amount: 100000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "RAW-SAP-01", itemName: "Food Grade Liquid Glucose (Rejection)", uom: "DRUM", quantity: 10, unitPrice: 10000.0, lineTotal: 100000.0, reason: "Turbidity out of spec" },
    ],
  },
  {
    sl: 24,
    officeName: "Dhaka Head Office",
    returnDate: "15-11-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251100428",
    remarks: "Opening Balance...",
    supplier: "Sajedur Rahman(Setu) (01719838384)",
    amount: 861000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "RAW-SRS-01", itemName: "Bulk Raw Corn Grits Return", uom: "MT", quantity: 21, unitPrice: 41000.0, lineTotal: 861000.0, reason: "Excess moisture content" },
    ],
  },
  {
    sl: 25,
    officeName: "Dhaka Head Office",
    returnDate: "31-10-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251100426",
    remarks: "Opening Balance...",
    supplier: "M/S SP Daul Mills (01716388548)",
    amount: 11500.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "RAW-SPD-01", itemName: "Yellow Split Peas Sample Lot", uom: "BAG", quantity: 2, unitPrice: 5750.0, lineTotal: 11500.0, reason: "Quality rejected" },
    ],
  },
  {
    sl: 26,
    officeName: "Dhaka Head Office",
    returnDate: "12-11-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251100425",
    remarks: "Opening Balance...",
    supplier: "ARINA ELECTRIC WORKS (01729983558)",
    amount: 964662.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "ELC-AE-02", itemName: "Automatic Voltage Regulator (AVR 250kVA)", uom: "UNIT", quantity: 1, unitPrice: 964662.0, lineTotal: 964662.0, reason: "Internal circuit burn" },
    ],
  },
  {
    sl: 27,
    officeName: "Dhaka Head Office",
    returnDate: "01-11-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251100423",
    remarks: "Opening Balance...",
    supplier: "M/S Mayer Doya Enterprise (01346320706)",
    amount: 237000.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "RAW-MDE-01", itemName: "Industrial Food Salt (Iodized 50kg)", uom: "BAG", quantity: 300, unitPrice: 790.0, lineTotal: 237000.0, reason: "Bag burst in shipment" },
    ],
  },
  {
    sl: 28,
    officeName: "Dhaka Head Office",
    returnDate: "31-10-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251001675",
    remarks: "Opening Balance...",
    supplier: "TOHA CORPORATION (01768116460)",
    amount: 219400.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "RAW-TH-08", itemName: "Polypropylene Injection Grade Material", uom: "KG", quantity: 1400, unitPrice: 156.71, lineTotal: 219400.0, reason: "MFI out of tolerance" },
    ],
  },
  {
    sl: 29,
    officeName: "Dhaka Head Office",
    returnDate: "31-10-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251001674",
    remarks: "Opening Balance...",
    supplier: "Sheikh Sanatary & Chula Ghor (01790647722)",
    amount: 93250.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "CIV-SS-01", itemName: "Factory Sanitary Washroom Fixtures", uom: "SET", quantity: 15, unitPrice: 6216.67, lineTotal: 93250.0, reason: "Ceramic hairline crack" },
    ],
  },
  {
    sl: 30,
    officeName: "Dhaka Head Office",
    returnDate: "31-10-2025",
    poNo: "Direct",
    returnNo: "POB-MBBL251001673",
    remarks: "Opening Balance...",
    supplier: "Shahin Auto Muri Mill (01710503755)",
    amount: 913320.0,
    returnType: "Opening",
    status: "Approved",
    items: [
      { itemCode: "RAW-SAM-05", itemName: "Processed Paddy Grain Shipment", uom: "BAG", quantity: 750, unitPrice: 1217.76, lineTotal: 913320.0, reason: "Pest infestation defect" },
    ],
  },
];

export default function PurchaseReturnsPage() {
  const queryClient = useQueryClient();

  // Active Tab: RECEIVED_LIST or RETURN_LIST
  const [activeTab, setActiveTab] = useState<"RECEIVED_LIST" | "RETURN_LIST">("RECEIVED_LIST");

  // Global Search
  const [searchTerm, setSearchTerm] = useState("");

  // Tab 2 Filters
  const [filterOffice, setFilterOffice] = useState("All");
  const [filterStatus, setFilterStatus] = useState("Status");
  const [filterFromDate, setFilterFromDate] = useState("09/10/2026");
  const [filterToDate, setFilterToDate] = useState("10/11/2026");

  // Pagination states
  const [receivedRowsPerPage, setReceivedRowsPerPage] = useState(50);
  const [receivedPage, setReceivedPage] = useState(1);
  const [returnRowsPerPage, setReturnRowsPerPage] = useState(50);
  const [returnPage, setReturnPage] = useState(1);

  // Modals state
  const [fullReturnTarget, setFullReturnTarget] = useState<ReceivedRow | null>(null);
  const [partialReturnTarget, setPartialReturnTarget] = useState<ReceivedRow | null>(null);
  const [isReturnWithoutRefOpen, setIsReturnWithoutRefOpen] = useState(false);
  const [viewReturnTarget, setViewReturnTarget] = useState<ReturnRow | null>(null);
  const [printReturnTarget, setPrintReturnTarget] = useState<ReturnRow | null>(null);
  const [editReturnTarget, setEditReturnTarget] = useState<ReturnRow | null>(null);

  // Return Form States
  const [fullReturnReason, setFullReturnReason] = useState("Excess / Transit Damaged consignment rejected during QC inspection.");
  const [partialReturnItems, setPartialReturnItems] = useState<
    Array<{
      itemCode: string;
      itemName: string;
      uom: string;
      receivedQty: number;
      returnQty: number;
      unitPrice: number;
      condition: "DAMAGED" | "DEFECTIVE" | "WRONG_SPECIFICATION" | "EXCESS" | "EXPIRED";
      reason: string;
    }>
  >([]);

  // Return Without Ref Form State
  const [noRefSupplier, setNoRefSupplier] = useState("M/S Sarkar Traders");
  const [noRefOffice, setNoRefOffice] = useState("MG Sirajganj Factory");
  const [noRefDate, setNoRefDate] = useState(new Date().toISOString().split("T")[0]);
  const [noRefAmount, setNoRefAmount] = useState<number>(25000);
  const [noRefRemarks, setNoRefRemarks] = useState("Direct supplier return without prior goods receipt reference.");
  const [noRefItemName, setNoRefItemName] = useState("Industrial Raw Material Surplus");
  const [noRefQty, setNoRefQty] = useState(100);

  // API Queries with TanStack
  const { data: serverEligible } = useQuery<GoodsReceipt[]>({
    queryKey: ["eligibleGRNs"],
    queryFn: () => fetchApi("/purchase/returns/eligible-receipts"),
    staleTime: 60000,
  });

  const { data: serverReturns } = useQuery<PurchaseReturn[]>({
    queryKey: ["returnsList"],
    queryFn: () => fetchApi("/purchase/returns"),
    staleTime: 60000,
  });

  // Local state for dynamic changes
  const [receivedList, setReceivedList] = useState<ReceivedRow[]>(INITIAL_RECEIVED_LIST);
  const [returnList, setReturnList] = useState<ReturnRow[]>(INITIAL_RETURN_LIST);

  // Handle Full Return Click
  const handleOpenFullReturn = (row: ReceivedRow) => {
    setFullReturnTarget(row);
    setFullReturnReason(`100% consignment reversal for ${row.returnInvoiceNo} due to quality defect.`);
  };

  // Handle Partial Return Click
  const handleOpenPartialReturn = (row: ReceivedRow) => {
    setPartialReturnTarget(row);
    const items = row.items || [
      { itemId: "it-def", itemCode: "MAT-01", itemName: "Consignment Material Package", uom: "PKG", quantity: 100, unitPrice: row.amount / 100, lineTotal: row.amount },
    ];
    setPartialReturnItems(
      items.map((it) => ({
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        receivedQty: it.quantity,
        returnQty: Math.max(1, Math.round(it.quantity * 0.2)),
        unitPrice: it.unitPrice,
        condition: "DAMAGED",
        reason: "Transit damage observed during store verification",
      }))
    );
  };

  // Submit Full Return
  const handleConfirmFullReturn = () => {
    if (!fullReturnTarget) return;

    const newReturnNo = `POB-MG2609${String(Math.floor(10000 + Math.random() * 90000))}`;
    const newRecord: ReturnRow = {
      sl: returnList.length + 1,
      officeName: fullReturnTarget.office || "MG Sirajganj Factory",
      returnDate: new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
      poNo: fullReturnTarget.poNo,
      returnNo: newReturnNo,
      remarks: fullReturnReason,
      supplier: fullReturnTarget.supplier,
      amount: fullReturnTarget.amount,
      returnType: "Full Return",
      status: "Approved",
      items: fullReturnTarget.items?.map((it) => ({
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
        reason: fullReturnReason,
      })),
    };

    setReturnList([newRecord, ...returnList]);
    setReceivedList(receivedList.filter((r) => r.returnInvoiceNo !== fullReturnTarget.returnInvoiceNo));
    setFullReturnTarget(null);
    toast.success(`Full Return Voucher ${newReturnNo} successfully generated! Financial debit note posted.`, {
      title: "Debit Note Posted",
    });
  };

  // Submit Partial Return
  const handleConfirmPartialReturn = () => {
    if (!partialReturnTarget) return;

    const totalRetAmount = partialReturnItems.reduce((acc, it) => acc + it.returnQty * it.unitPrice, 0);
    const newReturnNo = `POB-MG2609${String(Math.floor(10000 + Math.random() * 90000))}`;

    const newRecord: ReturnRow = {
      sl: returnList.length + 1,
      officeName: partialReturnTarget.office || "MG Sirajganj Factory",
      returnDate: new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
      poNo: partialReturnTarget.poNo,
      returnNo: newReturnNo,
      remarks: `Partial return of selected items against ${partialReturnTarget.returnInvoiceNo}`,
      supplier: partialReturnTarget.supplier,
      amount: totalRetAmount,
      returnType: "Partial",
      status: "Approved",
      items: partialReturnItems.map((it) => ({
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        quantity: it.returnQty,
        unitPrice: it.unitPrice,
        lineTotal: it.returnQty * it.unitPrice,
        reason: it.reason,
      })),
    };

    setReturnList([newRecord, ...returnList]);
    setPartialReturnTarget(null);
    toast.success(`Partial Return Voucher ${newReturnNo} (BDT ${formatCurrency(totalRetAmount)}) generated!`, {
      title: "Partial Return Posted",
    });
  };

  // Submit Return Without Ref
  const handleConfirmReturnWithoutRef = (e: React.FormEvent) => {
    e.preventDefault();
    const newReturnNo = `POB-MG2610${String(Math.floor(10000 + Math.random() * 90000))}`;

    const newRecord: ReturnRow = {
      sl: returnList.length + 1,
      officeName: noRefOffice,
      returnDate: new Date(noRefDate).toLocaleDateString("en-GB").replace(/\//g, "-"),
      poNo: "Direct",
      returnNo: newReturnNo,
      remarks: noRefRemarks,
      supplier: noRefSupplier,
      amount: noRefAmount,
      returnType: "Direct / Ad-hoc",
      status: "Approved",
      items: [
        {
          itemCode: "DIR-RET-01",
          itemName: noRefItemName,
          uom: "LOT",
          quantity: noRefQty,
          unitPrice: noRefAmount / (noRefQty || 1),
          lineTotal: noRefAmount,
          reason: noRefRemarks,
        },
      ],
    };

    setReturnList([newRecord, ...returnList]);
    setIsReturnWithoutRefOpen(false);
    toast.success(`Return Voucher Without Ref ${newReturnNo} generated successfully!`, {
      title: "Ad-hoc Return Posted",
    });
  };

  // Filtered Received List
  const filteredReceived = useMemo(() => {
    return receivedList.filter((row) => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        row.poNo.toLowerCase().includes(s) ||
        row.returnInvoiceNo.toLowerCase().includes(s) ||
        row.supplier.toLowerCase().includes(s) ||
        row.remarks.toLowerCase().includes(s)
      );
    });
  }, [receivedList, searchTerm]);

  // Paginated Received List
  const totalReceivedPages = Math.ceil(filteredReceived.length / receivedRowsPerPage) || 1;
  const paginatedReceived = useMemo(() => {
    const start = (receivedPage - 1) * receivedRowsPerPage;
    return filteredReceived.slice(start, start + receivedRowsPerPage);
  }, [filteredReceived, receivedPage, receivedRowsPerPage]);

  // Filtered Return List
  const filteredReturns = useMemo(() => {
    return returnList.filter((row) => {
      if (filterOffice !== "All" && row.officeName !== filterOffice) return false;
      if (filterStatus !== "Status" && filterStatus !== "All" && row.status !== filterStatus) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          row.returnNo.toLowerCase().includes(s) ||
          row.supplier.toLowerCase().includes(s) ||
          row.poNo.toLowerCase().includes(s) ||
          row.officeName.toLowerCase().includes(s) ||
          row.remarks.toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [returnList, filterOffice, filterStatus, searchTerm]);

  // Paginated Return List
  const totalReturnPages = Math.ceil(filteredReturns.length / returnRowsPerPage) || 1;
  const paginatedReturns = useMemo(() => {
    const start = (returnPage - 1) * returnRowsPerPage;
    return filteredReturns.slice(start, start + returnRowsPerPage);
  }, [filteredReturns, returnPage, returnRowsPerPage]);

  // Export to CSV
  const handleExportCSV = () => {
    if (activeTab === "RECEIVED_LIST") {
      const headers = ["SL", "Receive Date", "PO No", "Return Invoice No", "Remarks", "Supplier", "Amount (BDT)"];
      const rows = filteredReceived.map((r, idx) => [
        idx + 1,
        r.receiveDate,
        r.poNo,
        r.returnInvoiceNo,
        `"${r.remarks}"`,
        `"${r.supplier}"`,
        r.amount,
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `purchase_receive_for_return_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ["SL", "Office Name", "Return Date", "PO No", "Return No", "Remarks", "Supplier", "Amount", "Return Type", "Status"];
      const rows = filteredReturns.map((r, idx) => [
        idx + 1,
        `"${r.officeName}"`,
        r.returnDate,
        r.poNo,
        r.returnNo,
        `"${r.remarks}"`,
        `"${r.supplier}"`,
        r.amount,
        r.returnType,
        r.status,
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `purchase_returns_list_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-3 p-1">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER (Exact Unified Box Layout) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Return</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input matching Screenshot */}
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

          {/* Export to CSV / Excel Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            title="Download CSV / Excel"
            className="h-9 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          {/* + Return Without Ref. Blue Button */}
          <button
            type="button"
            onClick={() => setIsReturnWithoutRefOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Return Without Ref.</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TABS NAVIGATION */}
      {/* ------------------------------------------------------------- */}
      <div className="flex border-b border-slate-200 gap-8 text-xs font-bold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setActiveTab("RECEIVED_LIST")}
          className={`pb-2 transition ${
            activeTab === "RECEIVED_LIST"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          RECEIVED LIST
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RETURN_LIST")}
          className={`pb-2 transition ${
            activeTab === "RETURN_LIST"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          RETURN LIST
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: RECEIVED LIST (SCREENSHOT 1) */}
      {/* ============================================================= */}
      {activeTab === "RECEIVED_LIST" && (
        <div className="space-y-2">
          {/* Table Container with All Borders */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Receive Date</th>
                  <th className="p-2 border border-slate-300 w-36">PO No</th>
                  <th className="p-2 border border-slate-300 w-44">Return Invoice No</th>
                  <th className="p-2 border border-slate-300">Remarks</th>
                  <th className="p-2 border border-slate-300">Supplier</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Amount</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredReceived.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No eligible receipts found for return.
                    </td>
                  </tr>
                ) : (
                  paginatedReceived.map((row, idx) => {
                    const serialNo = (receivedPage - 1) * receivedRowsPerPage + idx + 1;
                    return (
                      <tr key={row.sl || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                          {serialNo}
                        </td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                          {row.receiveDate}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                          {row.poNo}
                        </td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-slate-900 font-medium">
                            <Truck className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                            <span>{row.returnInvoiceNo}</span>
                          </span>
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-600 max-w-xs truncate" title={row.remarks}>
                          {row.remarks}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-900" title={row.supplier}>
                          {row.supplier}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 text-xs">
                            <button
                              type="button"
                              onClick={() => handleOpenFullReturn(row)}
                              className="text-blue-600 hover:underline font-medium hover:text-blue-800"
                              title="Return all items from this receipt"
                            >
                              Full
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleOpenPartialReturn(row)}
                              className="text-blue-600 hover:underline font-medium hover:text-blue-800"
                              title="Select specific items and quantities to return"
                            >
                              Partial
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

          {/* Pagination Footer matching Screenshot 1 */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={receivedRowsPerPage}
                onChange={(e) => {
                  setReceivedRowsPerPage(Number(e.target.value));
                  setReceivedPage(1);
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
                {filteredReceived.length === 0
                  ? "0-0 of 0"
                  : `${(receivedPage - 1) * receivedRowsPerPage + 1}-${Math.min(
                      receivedPage * receivedRowsPerPage,
                      filteredReceived.length
                    )} of ${filteredReceived.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={receivedPage <= 1}
                  onClick={() => setReceivedPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={receivedPage >= totalReceivedPages}
                  onClick={() => setReceivedPage((p) => Math.min(totalReceivedPages, p + 1))}
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
      {/* TAB 2: RETURN LIST (SCREENSHOT 2) */}
      {/* ============================================================= */}
      {activeTab === "RETURN_LIST" && (
        <div className="space-y-2">
          {/* Filter Card matching Screenshot 2 */}
          <div className="bg-slate-50/60 p-3 rounded border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-xs">
            {/* Office Filter */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">Office</label>
              <select
                value={filterOffice}
                onChange={(e) => setFilterOffice(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All</option>
                <option value="Marinozz">Marinozz</option>
                <option value="Dhaka Head Office">Dhaka Head Office</option>
                <option value="MOHS Eco">MOHS Eco</option>
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="Status">Status</option>
                <option value="All">All</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Draft">Draft</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">From Date</label>
              <input
                type="text"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                placeholder="09/10/2026"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">To Date</label>
              <input
                type="text"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                placeholder="10/11/2026"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* View Button */}
            <div>
              <button
                type="button"
                className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
              >
                View
              </button>
            </div>
          </div>

          {/* Table Container with All Borders */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Actions</th>
                  <th className="p-2 border border-slate-300 w-36">Office Name</th>
                  <th className="p-2 border border-slate-300 w-24">Return Date</th>
                  <th className="p-2 border border-slate-300 w-24">PO No</th>
                  <th className="p-2 border border-slate-300 w-44">Return No</th>
                  <th className="p-2 border border-slate-300 w-36">Remarks</th>
                  <th className="p-2 border border-slate-300">Supplier</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Amount</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Return Type</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      No purchase return records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedReturns.map((row, idx) => {
                    const serialNo = (returnPage - 1) * returnRowsPerPage + idx + 1;
                    return (
                      <tr key={row.sl || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                          {serialNo}
                        </td>

                        {/* Actions: View, Print, Edit */}
                        <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2 text-slate-600">
                            <button
                              type="button"
                              onClick={() => setViewReturnTarget(row)}
                              className="p-1 hover:text-blue-600 transition"
                              title="View Return Note"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrintReturnTarget(row)}
                              className="p-1 hover:text-blue-600 transition"
                              title="Print Debit Note / Return Voucher"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditReturnTarget(row)}
                              className="p-1 hover:text-blue-600 transition"
                              title="Edit Return Information"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="p-2 border border-slate-300 text-slate-700 whitespace-nowrap">
                          {row.officeName}
                        </td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                          {row.returnDate}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                          {row.poNo}
                        </td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-slate-900 font-medium">
                            <Truck className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                            <span>{row.returnNo}</span>
                          </span>
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-600 max-w-xs truncate" title={row.remarks}>
                          {row.remarks}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-900" title={row.supplier}>
                          {row.supplier}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                          <span className="text-amber-700 font-medium">
                            {row.returnType}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                          <span className="text-emerald-700 font-semibold">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer matching Screenshot 2 */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={returnRowsPerPage}
                onChange={(e) => {
                  setReturnRowsPerPage(Number(e.target.value));
                  setReturnPage(1);
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
                {filteredReturns.length === 0
                  ? "0-0 of 0"
                  : `${(returnPage - 1) * returnRowsPerPage + 1}-${Math.min(
                      returnPage * returnRowsPerPage,
                      filteredReturns.length
                    )} of ${filteredReturns.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={returnPage <= 1}
                  onClick={() => setReturnPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={returnPage >= totalReturnPages}
                  onClick={() => setReturnPage((p) => Math.min(totalReturnPages, p + 1))}
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
      {/* 3. FULL RETURN MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(fullReturnTarget)}
        onClose={() => setFullReturnTarget(null)}
        title="Full Purchase Return (100% Stock Reversal)"
        subtitle={`GRN: ${fullReturnTarget?.returnInvoiceNo || ""} • Supplier: ${fullReturnTarget?.supplier || ""}`}
        maxWidth="lg"
      >
        {fullReturnTarget && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Confirm Full Consignment Return</span>
              </div>
              <p className="text-[11px] text-rose-700">
                This action will reverse 100% of the received inventory from warehouse, generate a debit note voucher, and reduce supplier payables by <strong>BDT {formatCurrency(fullReturnTarget.amount)}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">PO Reference</span>
                <span className="font-semibold text-slate-800 font-mono">{fullReturnTarget.poNo}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Receive Date</span>
                <span className="font-semibold text-slate-800">{fullReturnTarget.receiveDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Warehouse Office</span>
                <span className="font-semibold text-slate-800">{fullReturnTarget.office}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Refund Amount</span>
                <span className="font-bold text-rose-700 font-mono">{formatCurrency(fullReturnTarget.amount)}</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Audit Reason for Full Return *</label>
              <textarea
                value={fullReturnReason}
                onChange={(e) => setFullReturnReason(e.target.value)}
                rows={3}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setFullReturnTarget(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFullReturn}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-xs transition"
              >
                Confirm Full Return & Issue Debit Note
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 4. PARTIAL RETURN MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(partialReturnTarget)}
        onClose={() => setPartialReturnTarget(null)}
        title="Partial Purchase Return"
        subtitle={`GRN: ${partialReturnTarget?.returnInvoiceNo || ""} • Supplier: ${partialReturnTarget?.supplier || ""}`}
        maxWidth="4xl"
      >
        {partialReturnTarget && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800">{partialReturnTarget.returnInvoiceNo}</p>
                <p className="text-[11px] text-slate-500">PO: {partialReturnTarget.poNo} • {partialReturnTarget.supplier}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Consignment Total</span>
                <span className="font-bold font-mono text-slate-900">{formatCurrency(partialReturnTarget.amount)}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center w-16">UoM</th>
                    <th className="p-2 text-center w-24">Recv Qty</th>
                    <th className="p-2 w-28 text-center bg-rose-50 text-rose-800">Return Qty *</th>
                    <th className="p-2 w-36">Defect Condition</th>
                    <th className="p-2">Inspection Remarks</th>
                    <th className="p-2 text-right w-28">Debit Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partialReturnItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2">
                        <div className="font-semibold text-slate-900">{item.itemName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{item.itemCode}</div>
                      </td>
                      <td className="p-2 text-center font-mono text-slate-600">{item.uom}</td>
                      <td className="p-2 text-center font-mono font-bold text-slate-700">{item.receivedQty}</td>
                      <td className="p-2 bg-rose-50/50">
                        <input
                          type="number"
                          min={1}
                          max={item.receivedQty}
                          value={item.returnQty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...partialReturnItems];
                            updated[idx].returnQty = val;
                            setPartialReturnItems(updated);
                          }}
                          className="w-full border border-rose-300 rounded p-1 text-center font-bold text-rose-700 bg-white font-mono"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.condition}
                          onChange={(e) => {
                            const updated = [...partialReturnItems];
                            updated[idx].condition = e.target.value as any;
                            setPartialReturnItems(updated);
                          }}
                          className="w-full border border-slate-300 rounded p-1 text-xs bg-white"
                        >
                          <option value="DAMAGED">Transit Damaged</option>
                          <option value="DEFECTIVE">QC Defect</option>
                          <option value="WRONG_SPECIFICATION">Wrong Spec</option>
                          <option value="EXCESS">Excess Shipment</option>
                          <option value="EXPIRED">Near Expiry</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.reason}
                          onChange={(e) => {
                            const updated = [...partialReturnItems];
                            updated[idx].reason = e.target.value;
                            setPartialReturnItems(updated);
                          }}
                          className="w-full border border-slate-300 rounded p-1 text-xs bg-white"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                        {formatCurrency(item.returnQty * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-200">
              <span className="font-semibold text-slate-700">Total Return Credit Value:</span>
              <span className="text-base font-bold font-mono text-rose-700">
                {formatCurrency(partialReturnItems.reduce((acc, it) => acc + it.returnQty * it.unitPrice, 0))}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setPartialReturnTarget(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPartialReturn}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-xs transition"
              >
                Confirm Partial Return & Post
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 5. RETURN WITHOUT REF MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={isReturnWithoutRefOpen}
        onClose={() => setIsReturnWithoutRefOpen(false)}
        title="Direct Purchase Return (Without GRN Ref)"
        subtitle="Issue outward stock return & debit note without previous receiving reference"
        maxWidth="2xl"
      >
        <form onSubmit={handleConfirmReturnWithoutRef} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Supplier / Vendor *</label>
              <select
                value={noRefSupplier}
                onChange={(e) => setNoRefSupplier(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                required
              >
                <option value="M/S Sarkar Traders">M/S Sarkar Traders (01734431700)</option>
                <option value="PITICON INDUSTRIES">PITICON INDUSTRIES (01730302047)</option>
                <option value="TOHA CORPORATION">TOHA CORPORATION (01768116460)</option>
                <option value="Adar Sohag Departmental Store">Adar Sohag Departmental Store (01739870931)</option>
                <option value="BridgeOne Technologies Ltd">BridgeOne Technologies Ltd (01329731801)</option>
                <option value="Furniture Concept">Furniture Concept (01329749970)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Factory / Office *</label>
              <select
                value={noRefOffice}
                onChange={(e) => setNoRefOffice(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                required
              >
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                <option value="Dhaka Head Office">Dhaka Head Office</option>
                <option value="Marinozz">Marinozz</option>
                <option value="MOHS Eco">MOHS Eco</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Return Date *</label>
              <input
                type="date"
                value={noRefDate}
                onChange={(e) => setNoRefDate(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Return Value (BDT) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={noRefAmount}
                onChange={(e) => setNoRefAmount(Number(e.target.value))}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Item Name / Description</label>
              <input
                type="text"
                value={noRefItemName}
                onChange={(e) => setNoRefItemName(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={noRefQty}
                onChange={(e) => setNoRefQty(Number(e.target.value))}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white font-mono"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Remarks / Rejection Grounds</label>
              <input
                type="text"
                value={noRefRemarks}
                onChange={(e) => setNoRefRemarks(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setIsReturnWithoutRefOpen(false)}
              className="px-4 py-1.5 border border-slate-200 rounded font-medium text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-xs transition"
            >
              Save Direct Return
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ============================================================= */}
      {/* 6. VIEW RETURN DETAILS MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(viewReturnTarget)}
        onClose={() => setViewReturnTarget(null)}
        title={`Purchase Return Note: ${viewReturnTarget?.returnNo || ""}`}
        subtitle={`Office: ${viewReturnTarget?.officeName || ""} • Date: ${viewReturnTarget?.returnDate || ""}`}
        maxWidth="2xl"
      >
        {viewReturnTarget && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Voucher Ref</span>
                <p className="font-bold text-slate-900 text-sm">{viewReturnTarget.returnNo}</p>
                <p className="text-slate-600">PO Number: {viewReturnTarget.poNo}</p>
                <p className="text-slate-600">Supplier: {viewReturnTarget.supplier}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Settlement Details</span>
                <p className="font-bold text-slate-900 text-sm">{viewReturnTarget.returnType}</p>
                <p className="text-slate-600">Status: <span className="font-bold text-emerald-600">{viewReturnTarget.status}</span></p>
                <p className="text-slate-600">Remarks: {viewReturnTarget.remarks}</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">UoM</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Debit Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewReturnTarget.items?.map((it, i) => (
                    <tr key={i}>
                      <td className="p-2">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{it.itemCode}</div>
                      </td>
                      <td className="p-2 text-center">{it.uom}</td>
                      <td className="p-2 text-center font-mono font-bold text-rose-700">{it.quantity}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Total Return Value:</span>
              <span className="text-base font-bold font-mono text-rose-700">{formatCurrency(viewReturnTarget.amount)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewReturnTarget(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-700 font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintReturnTarget(viewReturnTarget);
                  setViewReturnTarget(null);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 7. PRINT RETURN VOUCHER PREVIEW MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(printReturnTarget)}
        onClose={() => setPrintReturnTarget(null)}
        title="Debit Note / Purchase Return Voucher - Print Preview"
        subtitle="Official Reversal Document for Outward Store Stock and Financial Adjustment"
        maxWidth="4xl"
      >
        {printReturnTarget && (
          <div className="space-y-4 text-xs">
            <div className="bg-white p-6 border border-slate-200 rounded shadow-sm text-slate-800 space-y-4 print:p-0 print:border-none">
              {/* Organization Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  {/* Company Logo */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="BridgeOne Logo" className="h-10 w-auto object-contain" />
                  <div>
                    <h2 className="font-bold text-base text-slate-900 tracking-wide uppercase">BridgeOne ERP Industries Ltd.</h2>
                    <p className="text-[11px] text-slate-500">Corporate Head Office, Gulshan-2, Dhaka • Sirajganj Industrial Park</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded text-xs">
                    PURCHASE DEBIT NOTE
                  </span>
                  <p className="font-mono font-bold text-slate-900 text-sm mt-1">{printReturnTarget.returnNo}</p>
                  <p className="text-[10px] text-slate-400">Date: {printReturnTarget.returnDate}</p>
                </div>
              </div>

              {/* Vendor & Return Metadata */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
                <div>
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase mb-1">Debited Vendor</h4>
                  <p className="font-bold text-slate-900">{printReturnTarget.supplier}</p>
                  <p className="text-slate-600">PO Reference: <span className="font-mono font-semibold">{printReturnTarget.poNo}</span></p>
                  <p className="text-slate-600">Settlement Type: {printReturnTarget.returnType}</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase mb-1">Reversal Destination</h4>
                  <p className="font-semibold text-slate-800">Originating Office: {printReturnTarget.officeName}</p>
                  <p className="text-slate-600">Reversal Reason: {printReturnTarget.remarks}</p>
                  <p className="text-slate-600">Audit Status: <span className="font-bold text-emerald-600">{printReturnTarget.status}</span></p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold">
                    <tr>
                      <th className="p-2 border-b w-8 text-center">#</th>
                      <th className="p-2 border-b">Item Code & Name</th>
                      <th className="p-2 border-b text-center w-16">UoM</th>
                      <th className="p-2 border-b text-center w-24">Returned Qty</th>
                      <th className="p-2 border-b text-right w-28">Unit Price</th>
                      <th className="p-2 border-b text-right w-32">Debit Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {printReturnTarget.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2">
                          <div className="font-semibold text-slate-900">{it.itemName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{it.itemCode}</div>
                        </td>
                        <td className="p-2 text-center font-mono">{it.uom}</td>
                        <td className="p-2 text-center font-mono font-bold text-rose-700">{it.quantity}</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={5} className="p-2 text-right font-bold text-slate-700">Total Debit Value:</td>
                      <td className="p-2 text-right font-bold font-mono text-rose-700 text-sm">
                        {formatCurrency(printReturnTarget.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 4-Tier Sign-off Blocks */}
              <div className="pt-12 grid grid-cols-4 gap-4 text-center text-[10px] text-slate-500">
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Fuad Hossain</span>
                  <span>Store In-charge</span>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Quality Inspector</span>
                  <span>QC Inspection Team</span>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Accounts & Finance</span>
                  <span>Payables Reconciliation</span>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Factory Head</span>
                  <span>Authorized Signatory</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPrintReturnTarget(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-700 font-semibold"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 8. EDIT RETURN MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(editReturnTarget)}
        onClose={() => setEditReturnTarget(null)}
        title="Edit Purchase Return"
        subtitle={`Voucher: ${editReturnTarget?.returnNo || ""}`}
        maxWidth="md"
      >
        {editReturnTarget && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Remarks</label>
              <input
                type="text"
                value={editReturnTarget.remarks}
                onChange={(e) => setEditReturnTarget({ ...editReturnTarget, remarks: e.target.value })}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Status</label>
              <select
                value={editReturnTarget.status}
                onChange={(e) => setEditReturnTarget({ ...editReturnTarget, status: e.target.value as any })}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              >
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditReturnTarget(null)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setReturnList(returnList.map((r) => (r.returnNo === editReturnTarget.returnNo ? editReturnTarget : r)));
                  setEditReturnTarget(null);
                  toast.success(`Return ${editReturnTarget.returnNo} updated successfully!`);
                }}
                className="px-4 py-1.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
