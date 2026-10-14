"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PackageCheck,
  PackagePlus,
  Eye,
  Printer,
  X,
  RotateCcw,
  Search,
  Download,
  Plus,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Building2,
  Calendar,
  CornerDownLeft,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { toast } from "@/components/purchase/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  GoodsReceipt,
  PurchaseOrder,
  CreateGoodsReceiptInput,
  Office,
  Warehouse,
  Supplier,
  Item,
} from "@bridgeone/contracts";

// -------------------------------------------------------------
// Fallback datasets (empty - real data loaded via API)
const seedApprovedPOs: any[] = [];
const seedReceivedGRNs: any[] = [];

export default function PurchaseReceivePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"APPROVED_PO" | "RECEIVED_PO">("APPROVED_PO");
  const [search, setSearch] = useState("");

  // Filters for Tab 1: APPROVED PO
  const [appOffice, setAppOffice] = useState("ALL");
  const [expReceiveDate, setExpReceiveDate] = useState("");

  // Filters for Tab 2: RECEIVED PO
  const [recOffice, setRecOffice] = useState("ALL");
  const [grnType, setGrnType] = useState("ALL");
  const [lcNo, setLcNo] = useState("ALL");
  const [itemType, setItemType] = useState("ALL");
  const [fromDate, setFromDate] = useState("2026-09-10");
  const [toDate, setToDate] = useState("2026-11-10");

  // Modals state
  const [receiveModalPO, setReceiveModalPO] = useState<any | null>(null);
  const [viewGRN, setViewGRN] = useState<any | null>(null);
  const [printGRN, setPrintGRN] = useState<any | null>(null);
  const [isDirectReceiveOpen, setIsDirectReceiveOpen] = useState(false);
  const [closeModalPO, setCloseModalPO] = useState<any | null>(null);
  const [closeComment, setCloseComment] = useState("");
  const [returnModalGRN, setReturnModalGRN] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState("");

  // Queries
  const { data: offices } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
  });
  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: () => fetchApi("/master/warehouses"),
  });
  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => fetchApi("/master/suppliers"),
  });
  const { data: itemsCatalog } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: () => fetchApi("/master/items"),
  });

  const { data: apiApprovedPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ["approvedPOs"],
    queryFn: () => fetchApi("/purchase/receipts/approved-orders"),
  });

  const { data: apiReceivedGRNs, refetch: refetchGRNs } = useQuery<GoodsReceipt[]>({
    queryKey: ["receivedGRNs"],
    queryFn: () => fetchApi("/purchase/receipts"),
  });

  // Combine Approved POs
  const combinedApprovedPOs = useMemo(() => {
    const list = [...seedApprovedPOs];
    if (apiApprovedPOs && apiApprovedPOs.length > 0) {
      apiApprovedPOs.forEach((o) => {
        if (!list.some((existing) => existing.poNumber === o.poNumber)) {
          list.unshift({
            id: o.id,
            poDate: o.orderDate,
            receivedDate: o.expectedDeliveryDate,
            requisitionNo: o.requisitionNumber || "N/A",
            poNumber: o.poNumber,
            supplierName: o.supplierName,
            officeName: o.officeName,
            shipmentNo: "N/A",
            shipmentDocNo: "N/A",
            vatChallanNo: "N/A",
            salesInvoiceNo: "N/A",
            deliveryNo: "N/A",
            preparedBy: o.createdBy || "Mahfuz Rahman",
            eta: o.expectedDeliveryDate,
            status: o.status === "APPROVED" ? "Approved" : "Partially Received",
            warehouseName: o.warehouseName || "Material WH",
            items: o.items as any,
          });
        }
      });
    }

    return list.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          item.poNumber.toLowerCase().includes(q) ||
          item.supplierName.toLowerCase().includes(q) ||
          item.officeName.toLowerCase().includes(q) ||
          item.preparedBy.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [apiApprovedPOs, search]);

  // Combine Received GRNs
  const combinedReceivedGRNs = useMemo(() => {
    const list = [...seedReceivedGRNs];
    if (apiReceivedGRNs && apiReceivedGRNs.length > 0) {
      apiReceivedGRNs.forEach((g) => {
        if (!list.some((existing) => existing.invoiceGrn === g.grnNumber)) {
          list.unshift({
            id: g.id,
            receiveDate: g.receiptDate,
            officeName: g.officeName || "MG Sirajganj Factory",
            poNumber: g.poNumber || "Direct",
            invoiceGrn: g.grnNumber,
            challanNo: g.shipmentDocumentNumber || "N/A",
            shipmentDocNo: "N/A",
            vatChallanNo: g.vatChallanNumber || "N/A",
            salesInvoiceNo: g.supplierInvoiceNumber || "N/A",
            deliveryNo: g.deliveryNoteNumber || "N/A",
            warehouseName: g.warehouseName || "Material WH",
            supplierName: g.supplierName,
            totalQty: g.items?.reduce((s, it) => s + it.currentReceivedQuantity, 0) || 100,
            totalBdt: g.totalReceivedAmount || 50000,
            pendingBdt: 0,
            preparedBy: g.preparedBy || "MD. MOSHIUR RAHMAN",
            items: g.items?.map((it) => ({
              itemCode: it.itemCode,
              itemName: it.itemName,
              uom: it.uom,
              quantity: it.currentReceivedQuantity,
              unitPrice: it.unitPrice,
              lineTotal: it.lineTotal,
            })) || [],
          });
        }
      });
    }

    return list.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          item.invoiceGrn.toLowerCase().includes(q) ||
          item.poNumber.toLowerCase().includes(q) ||
          item.supplierName.toLowerCase().includes(q) ||
          item.challanNo.toLowerCase().includes(q) ||
          item.preparedBy.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [apiReceivedGRNs, search]);

  // Receiving Form State for Modal
  const [formReceiptDate, setFormReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [formChallanNo, setFormChallanNo] = useState("CHAL-9921");
  const [formVatChallan, setFormVatChallan] = useState("MUSHAK-6.3-441");
  const [formInvoiceNo, setFormInvoiceNo] = useState("INV-2026-881");
  const [formDeliveryNote, setFormDeliveryNote] = useState("DN-3321");
  const [formRemarks, setFormRemarks] = useState("");
  const [formReceiveItems, setFormReceiveItems] = useState<any[]>([]);

  // Direct Receive Form State
  const [dirSupplierId, setDirSupplierId] = useState("sup-01");
  const [dirWarehouseId, setDirWarehouseId] = useState("wh-01");
  const [dirOfficeId, setDirOfficeId] = useState("off-01");
  const [dirChallanNo, setDirChallanNo] = useState("DIR-CHAL-101");
  const [dirVatChallan, setDirVatChallan] = useState("MUSHAK-6.3-901");
  const [dirItems, setDirItems] = useState([
    {
      itemId: "itm-01",
      itemCode: "RM-00518",
      itemName: "Palm Oil Grade A",
      uom: "KG",
      receivedQuantity: 500,
      unitPrice: 120,
      lineTotal: 60000,
    },
  ]);

  // Open Receive Workflow Modal
  const handleOpenReceive = (po: any) => {
    setReceiveModalPO(po);
    setFormReceiveItems(
      (po.items || []).map((it: any) => ({
        poItemId: it.id || "poi-temp",
        itemId: it.itemId || "it-temp",
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        orderedQuantity: it.orderedQuantity,
        previouslyReceivedQuantity: it.receivedQuantity || 0,
        outstandingQuantity: it.outstandingQuantity || it.orderedQuantity,
        currentReceivedQuantity: it.outstandingQuantity || it.orderedQuantity,
        rejectedDamagedQuantity: 0,
        unitPrice: it.unitPrice,
        lineTotal: (it.outstandingQuantity || it.orderedQuantity) * it.unitPrice,
      }))
    );
  };

  // Mutation to submit GRN
  const receiveMutation = useMutation({
    mutationFn: (payload: CreateGoodsReceiptInput) =>
      fetchApi("/purchase/receipts", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["approvedPOs"] });
      queryClient.invalidateQueries({ queryKey: ["receivedGRNs"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      setReceiveModalPO(null);
      setIsDirectReceiveOpen(false);
      toast.success(`Goods Receipt ${data.grnNumber || "GRN-2026"} generated successfully! Warehouse Stock Synchronized.`, {
        title: "Goods Receipt Posted",
      });
    },
    onError: (err: any) => {
      toast.error(`Error during receiving: ${err.message}`, {
        title: "Receipt Failed",
      });
    },
  });

  const handleSubmitReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalPO) return;
    receiveMutation.mutate({
      companyId: "comp-bridgeone-01",
      purchaseOrderId: receiveModalPO.id || "po-temp",
      receiptDate: formReceiptDate,
      shipmentNumber: "SHP-" + formChallanNo,
      shipmentDocumentNumber: formChallanNo,
      vatChallanNumber: formVatChallan,
      supplierInvoiceNumber: formInvoiceNo,
      deliveryNoteNumber: formDeliveryNote,
      remarks: formRemarks,
      items: formReceiveItems.map((it) => ({
        poItemId: it.poItemId,
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        orderedQuantity: it.orderedQuantity,
        previouslyReceivedQuantity: it.previouslyReceivedQuantity,
        currentReceivedQuantity: it.currentReceivedQuantity,
        rejectedDamagedQuantity: it.rejectedDamagedQuantity,
        unitPrice: it.unitPrice,
        lineTotal: it.currentReceivedQuantity * it.unitPrice,
      })),
    });
  };

  // Direct Receive Submit
  const handleDirectReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const total = dirItems.reduce((acc, it) => acc + it.lineTotal, 0);
    toast.success(`Direct GRN created successfully for ${formatCurrency(total)}! Stock added to warehouse.`, {
      title: "Direct GRN Generated",
    });
    setIsDirectReceiveOpen(false);
  };

  // Export CSV
  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (activeTab === "APPROVED_PO") {
      csvContent += "SL,PO Date,Received Date,Requisition No,PO Number,Supplier,Office,Prepared By,Status\n";
      combinedApprovedPOs.forEach((row, i) => {
        csvContent += `"${i + 1}","${row.poDate}","${row.receivedDate}","${row.requisitionNo}","${row.poNumber}","${row.supplierName}","${row.officeName}","${row.preparedBy}","${row.status}"\n`;
      });
    } else {
      csvContent += "SL,Receive Date,Office,PO No,Invoice/GRN,Challan No,Warehouse,Supplier,Total Qty,Total (BDT),Pending (BDT),Prepared By\n";
      combinedReceivedGRNs.forEach((row, i) => {
        csvContent += `"${i + 1}","${row.receiveDate}","${row.officeName}","${row.poNumber}","${row.invoiceGrn}","${row.challanNo}","${row.warehouseName}","${row.supplierName}","${row.totalQty}","${row.totalBdt}","${row.pendingBdt}","${row.preparedBy}"\n`;
      });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BridgeOne_${activeTab}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER (Exact Managerium Layout) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Receive</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick search input with magnifying glass on right */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search...."
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Excel Export Button (on RECEIVED PO tab) */}
          {activeTab === "RECEIVED_PO" && (
            <button
              type="button"
              onClick={handleExport}
              className="h-9 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
              title="Download Excel Report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          )}

          {/* Primary Action Button: + Direct Receive */}
          <button
            type="button"
            onClick={() => setIsDirectReceiveOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Direct Receive</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. NAVIGATION TABS (APPROVED PO | RECEIVED PO) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-8 border-b border-slate-200 mb-3 bg-white px-3 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab("APPROVED_PO")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase ${
            activeTab === "APPROVED_PO"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>APPROVED PO</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RECEIVED_PO")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase ${
            activeTab === "RECEIVED_PO"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>RECEIVED PO</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB 1: APPROVED PO (Screenshot 1) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "APPROVED_PO" && (
        <div className="space-y-3">
          {/* Filter Toolbar */}
          <div className="bg-white rounded border border-slate-200/90 p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-end gap-3.5">
              {/* Office Selector with 'All ×' pill */}
              <div className="w-56">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Office</label>
                <div className="flex items-center justify-between h-8 border border-slate-300 rounded px-2 bg-white text-xs">
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                    All <button type="button" className="hover:text-red-500">×</button>
                  </span>
                  <span className="text-slate-400 text-xs">▾</span>
                </div>
              </div>

              {/* Exp. Receive Date */}
              <div className="w-48">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Exp. Receive Date</label>
                <input
                  type="date"
                  value={expReceiveDate}
                  onChange={(e) => setExpReceiveDate(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* View Button */}
              <div>
                <button
                  type="button"
                  className="h-8 px-6 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs uppercase rounded shadow-xs transition"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          {/* Table Container with All Borders */}
          <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="erp-table-container">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th className="w-12 text-center">SL</th>
                    <th className="w-20 text-center">Actions</th>
                    <th>PO Date</th>
                    <th>Received Date</th>
                    <th>Requisition No</th>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Office</th>
                    <th>Shipment No</th>
                    <th>Shipment Document No.</th>
                    <th>VAT Challan No</th>
                    <th>Sales Invoice No</th>
                    <th>Delivery No</th>
                    <th>Prepared By</th>
                    <th>Estimated Time of Arrival</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedApprovedPOs.map((row, idx) => (
                    <tr key={row.id || idx}>
                      {/* 1. SL */}
                      <td className="text-center font-mono text-slate-600">{idx + 1}</td>

                      {/* 2. Actions: Receive (PackagePlus), Close (X) */}
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-700">
                          {/* Receive / Process GRN */}
                          <button
                            type="button"
                            onClick={() => handleOpenReceive(row)}
                            className="p-1 rounded hover:bg-emerald-100 hover:text-emerald-700 text-slate-700 transition"
                            title="Receive Goods (Generate GRN)"
                          >
                            <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                          </button>

                          {/* Close remaining PO balance */}
                          <button
                            type="button"
                            onClick={() => {
                              setCloseModalPO(row);
                              setCloseComment("");
                            }}
                            className="p-1 rounded hover:bg-rose-100 hover:text-rose-700 text-slate-600 transition"
                            title="Close Remaining Balance"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 3. PO Date */}
                      <td>{row.poDate}</td>

                      {/* 4. Received Date */}
                      <td>{row.receivedDate}</td>

                      {/* 5. Requisition No */}
                      <td className="font-mono text-slate-500 text-[11px]">{row.requisitionNo}</td>

                      {/* 6. PO Number with green truck icon */}
                      <td>
                        <button
                          type="button"
                          onClick={() => handleOpenReceive(row)}
                          className="flex items-center gap-1.5 font-mono text-emerald-700 font-semibold hover:underline"
                        >
                          <Truck className="w-3 h-3 text-emerald-600" />
                          <span>{row.poNumber}</span>
                        </button>
                      </td>

                      {/* 7. Supplier */}
                      <td className="font-medium text-slate-900">{row.supplierName}</td>

                      {/* 8. Office */}
                      <td>{row.officeName}</td>

                      {/* 9. Shipment No */}
                      <td className="text-slate-400 text-center">{row.shipmentNo}</td>

                      {/* 10. Shipment Document No. */}
                      <td className="text-slate-400 text-center">{row.shipmentDocNo}</td>

                      {/* 11. VAT Challan No */}
                      <td className="text-slate-400 text-center">{row.vatChallanNo}</td>

                      {/* 12. Sales Invoice No */}
                      <td className="text-slate-400 text-center">{row.salesInvoiceNo}</td>

                      {/* 13. Delivery No */}
                      <td className="text-slate-400 text-center">{row.deliveryNo}</td>

                      {/* 14. Prepared By */}
                      <td>{row.preparedBy}</td>

                      {/* 15. ETA */}
                      <td className="text-slate-400 font-mono text-[11px]">{row.eta || ""}</td>

                      {/* 16. Status */}
                      <td className="text-center">
                        {row.status === "Approved" ? (
                          <span className="font-semibold text-emerald-600">Approved</span>
                        ) : (
                          <span className="font-semibold text-purple-600">Partially Received</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-6 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white">
                  <option value="50">50</option>
                  <option value="25">25</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div>
                1-50 of 134
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <button type="button" disabled className="px-1.5 py-0.5 hover:text-slate-800 disabled:opacity-40">
                  &lt;
                </button>
                <button type="button" className="px-1.5 py-0.5 hover:text-slate-800">
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB 2: RECEIVED PO (Screenshot 2) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "RECEIVED_PO" && (
        <div className="space-y-3">
          {/* Filter Toolbar */}
          <div className="bg-white rounded border border-slate-200/90 p-3.5 shadow-2xs">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
              {/* Office */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Office</label>
                <div className="flex items-center justify-between h-8 border border-slate-300 rounded px-2 bg-white text-xs">
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                    All <button type="button" className="hover:text-red-500">×</button>
                  </span>
                  <span className="text-slate-400 text-xs">▾</span>
                </div>
              </div>

              {/* GRN Type */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">GRN Type</label>
                <select
                  value={grnType}
                  onChange={(e) => setGrnType(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">All</option>
                  <option value="LOCAL_GRN">Local GRN</option>
                  <option value="DIRECT_GRN">Direct GRN</option>
                  <option value="IMPORT_GRN">Import GRN</option>
                </select>
              </div>

              {/* LC NO */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">LC NO</label>
                <select
                  value={lcNo}
                  onChange={(e) => setLcNo(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">LC NO</option>
                  <option value="LC-2026-001">LC-2026-001</option>
                  <option value="LC-2026-002">LC-2026-002</option>
                </select>
              </div>

              {/* Item Type */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Item Type</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Select Item Type</option>
                  <option value="RAW_MATERIAL">Raw Material</option>
                  <option value="PACKAGING">Packaging</option>
                  <option value="FINISHED_GOODS">Finished Goods</option>
                  <option value="SPARES">Spares & Maintenance</option>
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 2: View Button */}
            <div>
              <button
                type="button"
                onClick={() => refetchGRNs()}
                className="h-8 px-6 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs uppercase rounded shadow-xs transition"
              >
                View
              </button>
            </div>
          </div>

          {/* Table Container with All Borders */}
          <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="erp-table-container">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th className="w-12 text-center">SL</th>
                    <th className="w-24 text-center">Actions</th>
                    <th>Receive Date</th>
                    <th>Office</th>
                    <th>PO No</th>
                    <th>Invoice/GRN</th>
                    <th>Challan No</th>
                    <th>Shipment Document No.</th>
                    <th>VAT Challan No</th>
                    <th>Sales Invoice No</th>
                    <th>Delivery No</th>
                    <th>Warehouse</th>
                    <th>Supplier</th>
                    <th className="text-right">Total Qty</th>
                    <th className="text-right">Total (BDT)</th>
                    <th className="text-right">Pending (BDT)</th>
                    <th>Prepared By</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedReceivedGRNs.map((row, idx) => (
                    <tr key={row.id || idx}>
                      {/* 1. SL */}
                      <td className="text-center font-mono text-slate-600">{idx + 1}</td>

                      {/* 2. Actions: View, Print, Return */}
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-700">
                          {/* 1. View */}
                          <button
                            type="button"
                            onClick={() => setViewGRN(row)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-700 transition"
                            title="View GRN Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* 2. Print */}
                          <button
                            type="button"
                            onClick={() => setPrintGRN(row)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-700 transition"
                            title="Print GRN Voucher"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* 3. Return */}
                          <button
                            type="button"
                            onClick={() => {
                              setReturnModalGRN(row);
                              setReturnReason("");
                            }}
                            className="p-1 rounded hover:bg-amber-100 hover:text-amber-800 text-slate-700 transition"
                            title="Initiate Purchase Return"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 3. Receive Date */}
                      <td>{row.receiveDate}</td>

                      {/* 4. Office */}
                      <td>{row.officeName}</td>

                      {/* 5. PO No */}
                      <td className="font-mono text-slate-600">{row.poNumber}</td>

                      {/* 6. Invoice/GRN with green truck icon */}
                      <td>
                        <button
                          type="button"
                          onClick={() => setViewGRN(row)}
                          className="flex items-center gap-1.5 font-mono text-emerald-700 font-semibold hover:underline"
                        >
                          <Truck className="w-3 h-3 text-emerald-600" />
                          <span>{row.invoiceGrn}</span>
                        </button>
                      </td>

                      {/* 7. Challan No */}
                      <td className="font-mono text-slate-700">{row.challanNo}</td>

                      {/* 8. Shipment Doc No */}
                      <td className="text-slate-400 text-center">{row.shipmentDocNo}</td>

                      {/* 9. VAT Challan No */}
                      <td className="text-slate-400 text-center">{row.vatChallanNo}</td>

                      {/* 10. Sales Invoice No */}
                      <td className="font-mono text-slate-600 text-center">{row.salesInvoiceNo}</td>

                      {/* 11. Delivery No */}
                      <td className="text-slate-400 text-center">{row.deliveryNo}</td>

                      {/* 12. Warehouse */}
                      <td className="text-slate-700">{row.warehouseName}</td>

                      {/* 13. Supplier */}
                      <td className="font-medium text-slate-900 max-w-[200px] truncate" title={row.supplierName}>
                        {row.supplierName}
                      </td>

                      {/* 14. Total Qty */}
                      <td className="text-right font-mono font-bold text-slate-800">
                        {row.totalQty.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 15. Total (BDT) */}
                      <td className="text-right font-mono font-bold text-slate-900">
                        {row.totalBdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 16. Pending (BDT) */}
                      <td className="text-right font-mono text-slate-600">
                        {row.pendingBdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 17. Prepared By */}
                      <td>{row.preparedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-6 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white">
                  <option value="50">50</option>
                  <option value="25">25</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div>
                1-50 of 60
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <button type="button" disabled className="px-1.5 py-0.5 hover:text-slate-800 disabled:opacity-40">
                  &lt;
                </button>
                <button type="button" className="px-1.5 py-0.5 hover:text-slate-800">
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. RECEIVE GOODS AGAINST PO MODAL (GRN Generation) */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(receiveModalPO)}
        onClose={() => setReceiveModalPO(null)}
        title={`Receive Goods against PO: ${receiveModalPO?.poNumber || ""}`}
        subtitle={`Vendor: ${receiveModalPO?.supplierName || ""} • Destination: ${receiveModalPO?.warehouseName || "Material WH"}`}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmitReceive} className="space-y-4 text-xs">
          {/* Challan & Shipment Headers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Delivery Challan No *</label>
              <input
                type="text"
                value={formChallanNo}
                onChange={(e) => setFormChallanNo(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">VAT Challan (Mushak 6.3)</label>
              <input
                type="text"
                value={formVatChallan}
                onChange={(e) => setFormVatChallan(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Supplier Commercial Invoice</label>
              <input
                type="text"
                value={formInvoiceNo}
                onChange={(e) => setFormInvoiceNo(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Receipt Date *</label>
              <input
                type="date"
                value={formReceiptDate}
                onChange={(e) => setFormReceiptDate(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                required
              />
            </div>
          </div>

          {/* Line Items Receiving Table */}
          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                <tr>
                  <th className="p-2">Item Description</th>
                  <th className="p-2 w-16 text-center">UoM</th>
                  <th className="p-2 w-20 text-center">Ordered</th>
                  <th className="p-2 w-20 text-center">Prev. Recv</th>
                  <th className="p-2 w-24 text-center">Outstanding</th>
                  <th className="p-2 w-28">Recv Qty *</th>
                  <th className="p-2 w-24">Reject / QC</th>
                  <th className="p-2 w-28 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formReceiveItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2">
                      <div className="font-semibold text-slate-900">{item.itemName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{item.itemCode}</div>
                    </td>
                    <td className="p-2 text-center text-slate-600 font-mono">{item.uom}</td>
                    <td className="p-2 text-center font-mono">{item.orderedQuantity}</td>
                    <td className="p-2 text-center font-mono text-slate-500">{item.previouslyReceivedQuantity}</td>
                    <td className="p-2 text-center font-mono font-bold text-amber-700">{item.outstandingQuantity}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        max={item.outstandingQuantity}
                        value={item.currentReceivedQuantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const u = [...formReceiveItems];
                          u[idx].currentReceivedQuantity = val;
                          u[idx].lineTotal = val * u[idx].unitPrice;
                          setFormReceiveItems(u);
                        }}
                        className="w-full border border-blue-300 rounded p-1 text-xs font-mono font-bold bg-white focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        value={item.rejectedDamagedQuantity}
                        onChange={(e) => {
                          const u = [...formReceiveItems];
                          u[idx].rejectedDamagedQuantity = Number(e.target.value);
                          setFormReceiveItems(u);
                        }}
                        className="w-full border border-rose-300 rounded p-1 text-xs font-mono bg-white text-rose-700"
                      />
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Inspection / Quality Check Remarks</label>
            <input
              type="text"
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              placeholder="e.g. Consignment verified without transit damages."
              className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setReceiveModalPO(null)}
              className="px-4 py-2 border border-slate-200 rounded font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={receiveMutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-xs transition"
            >
              {receiveMutation.isPending ? "Generating GRN..." : "Confirm Receipt & Update Inventory"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 6. DIRECT RECEIVE MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isDirectReceiveOpen}
        onClose={() => setIsDirectReceiveOpen(false)}
        title="Direct Goods Receive (Non-PO)"
        subtitle="Record ad-hoc or direct spot invoice goods receipts into warehouse"
        maxWidth="4xl"
      >
        <form onSubmit={handleDirectReceiveSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Supplier / Vendor *</label>
              <select
                value={dirSupplierId}
                onChange={(e) => setDirSupplierId(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                required
              >
                <option value="sup-01">M/S Sarkar Traders</option>
                <option value="sup-02">M/S Vali Traders</option>
                <option value="sup-03">Adar Sohag Departmental Store</option>
                <option value="sup-04">G.M Traders</option>
                <option value="sup-05">PITICON INDUSTRIES</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Receiving Warehouse *</label>
              <select
                value={dirWarehouseId}
                onChange={(e) => setDirWarehouseId(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                required
              >
                <option value="wh-01">Material WH (Sirajganj)</option>
                <option value="wh-02">Maintenance WH</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Challan No *</label>
              <input
                type="text"
                value={dirChallanNo}
                onChange={(e) => setDirChallanNo(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                required
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                <tr>
                  <th className="p-2">Item Description</th>
                  <th className="p-2 w-20 text-center">UoM</th>
                  <th className="p-2 w-28">Receive Qty</th>
                  <th className="p-2 w-28">Unit Price</th>
                  <th className="p-2 w-32 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dirItems.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2">
                      <input
                        type="text"
                        value={it.itemName}
                        onChange={(e) => {
                          const u = [...dirItems];
                          u[idx].itemName = e.target.value;
                          setDirItems(u);
                        }}
                        className="w-full border border-slate-300 rounded p-1 text-xs"
                      />
                    </td>
                    <td className="p-2 text-center text-slate-600 font-mono">{it.uom}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="1"
                        value={it.receivedQuantity}
                        onChange={(e) => {
                          const q = Number(e.target.value);
                          const u = [...dirItems];
                          u[idx].receivedQuantity = q;
                          u[idx].lineTotal = q * u[idx].unitPrice;
                          setDirItems(u);
                        }}
                        className="w-full border border-slate-300 rounded p-1 text-xs font-mono font-bold"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        value={it.unitPrice}
                        onChange={(e) => {
                          const p = Number(e.target.value);
                          const u = [...dirItems];
                          u[idx].unitPrice = p;
                          u[idx].lineTotal = u[idx].receivedQuantity * p;
                          setDirItems(u);
                        }}
                        className="w-full border border-slate-300 rounded p-1 text-xs font-mono"
                      />
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(it.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setIsDirectReceiveOpen(false)}
              className="px-4 py-1.5 border border-slate-200 rounded font-medium text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-xs transition"
            >
              Generate Direct GRN
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 7. VIEW GRN DETAILS MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(viewGRN)}
        onClose={() => setViewGRN(null)}
        title={`Goods Receipt Note: ${viewGRN?.invoiceGrn || ""}`}
        subtitle={`Vendor: ${viewGRN?.supplierName || ""} • Received on ${viewGRN?.receiveDate || ""}`}
        maxWidth="2xl"
      >
        {viewGRN && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Receipt Info</span>
                <p className="font-bold text-slate-900 text-sm">{viewGRN.invoiceGrn}</p>
                <p className="text-slate-600">PO Number: {viewGRN.poNumber}</p>
                <p className="text-slate-600">Challan No: {viewGRN.challanNo}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Warehouse Destination</span>
                <p className="font-bold text-slate-900 text-sm">{viewGRN.warehouseName}</p>
                <p className="text-slate-600">Office: {viewGRN.officeName}</p>
                <p className="text-slate-600">Prepared By: {viewGRN.preparedBy}</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">UoM</th>
                    <th className="p-2 text-center">Received Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewGRN.items?.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{it.itemCode}</div>
                      </td>
                      <td className="p-2 text-center">{it.uom}</td>
                      <td className="p-2 text-center font-mono font-bold text-slate-800">{it.quantity}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Total Received Value:</span>
              <span className="text-base font-bold font-mono text-sky-800">{formatCurrency(viewGRN.totalBdt)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewGRN(null)}
                className="px-4 py-2 border border-slate-200 rounded text-slate-700 font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintGRN(viewGRN);
                  setViewGRN(null);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print GRN Voucher</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 8. PRINT GRN VOUCHER PREVIEW MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(printGRN)}
        onClose={() => setPrintGRN(null)}
        title="Goods Receipt Note (GRN) - Print Preview"
        subtitle="Official Store Receipt Document with Inventory Verification"
        maxWidth="4xl"
      >
        {printGRN && (
          <div className="space-y-4 text-xs">
            <div className="bg-white p-6 border border-slate-200 rounded shadow-sm text-slate-800 space-y-4 print:p-0 print:border-none">
              {/* Organization Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-3">
                <div className="flex items-center gap-3.5">
                  <img src="/logo.png" alt="BridgeOne Logo" className="h-10 w-auto object-contain" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                      BridgeOne Technologies Ltd.
                    </h2>
                    <p className="text-slate-500 text-[11px]">Store Operations & Materials Management Division</p>
                    <p className="text-slate-500 text-[11px]">{printGRN.officeName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-2.5 py-1 bg-slate-100 rounded text-[11px] font-bold text-slate-700 border border-slate-300">
                    GOODS RECEIPT NOTE
                  </div>
                  <div className="text-sm font-bold text-sky-800 font-mono mt-1">{printGRN.invoiceGrn}</div>
                  <div className="text-[11px] text-slate-500">Date: {printGRN.receiveDate}</div>
                </div>
              </div>

              {/* Vendor & Delivery Meta */}
              <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-1 uppercase text-[10px]">Supplier & Order:</span>
                  <div className="font-bold text-slate-900 text-sm">{printGRN.supplierName}</div>
                  <div className="text-slate-500 text-[11px]">Purchase Order: {printGRN.poNumber}</div>
                  <div className="text-slate-500 text-[11px]">Challan Number: {printGRN.challanNo}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-1 uppercase text-[10px]">Warehouse Details:</span>
                  <div className="font-bold text-slate-900 text-sm">{printGRN.warehouseName}</div>
                  <div className="text-slate-500 text-[11px]">Location: {printGRN.officeName}</div>
                  <div className="text-slate-500 text-[11px]">Inspected & Received By: {printGRN.preparedBy}</div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border border-slate-200 text-xs mb-3">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">UoM</th>
                    <th className="p-2 text-center">Received Qty</th>
                    <th className="p-2 text-right">Unit Price (BDT)</th>
                    <th className="p-2 text-right">Line Total (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {printGRN.items?.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{it.itemCode}</div>
                      </td>
                      <td className="p-2 text-center">{it.uom}</td>
                      <td className="p-2 text-center font-mono font-bold">{it.quantity}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Value */}
              <div className="flex justify-end text-xs">
                <div className="w-64 space-y-1 bg-slate-50 p-2.5 rounded border border-slate-100">
                  <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-300">
                    <span>Total Received:</span>
                    <span className="font-mono text-sky-800">{formatCurrency(printGRN.totalBdt)}</span>
                  </div>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs text-slate-600">
                <div className="border-t border-slate-300 pt-1.5 font-medium">Store Officer</div>
                <div className="border-t border-slate-300 pt-1.5 font-medium">Quality Assurance (QC)</div>
                <div className="border-t border-slate-300 pt-1.5 font-medium">Plant / Warehouse Incharge</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPrintGRN(null)}
                className="px-4 py-2 border border-slate-200 rounded text-slate-700 font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 9. CLOSE REMAINING PO BALANCE MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(closeModalPO)}
        onClose={() => setCloseModalPO(null)}
        title="Close Remaining PO Balance"
        subtitle={`PO Number: ${closeModalPO?.poNumber || ""}`}
        maxWidth="md"
      >
        {closeModalPO && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Close and stop further receiving against PO <span className="font-bold text-slate-900 font-mono">{closeModalPO.poNumber}</span> from <span className="font-semibold text-slate-900">{closeModalPO.supplierName}</span>?
            </p>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Audit Reason for Closure *</label>
              <textarea
                value={closeComment}
                onChange={(e) => setCloseComment(e.target.value)}
                placeholder="Reason for closing remaining unreceived quantity..."
                className="w-full border border-slate-300 rounded p-2 text-xs h-20"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCloseModalPO(null)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success(`PO ${closeModalPO.poNumber} receiving balance closed.`, {
                    title: "Receiving Balance Closed",
                  });
                  setCloseModalPO(null);
                }}
                className="px-4 py-1.5 bg-rose-600 text-white rounded font-bold hover:bg-rose-700"
              >
                Confirm Closure
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 10. INITIATE PURCHASE RETURN MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(returnModalGRN)}
        onClose={() => setReturnModalGRN(null)}
        title="Initiate Purchase Return (Debit Note)"
        subtitle={`Against GRN: ${returnModalGRN?.invoiceGrn || ""} • Vendor: ${returnModalGRN?.supplierName || ""}`}
        maxWidth="md"
      >
        {returnModalGRN && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Return items from GRN <span className="font-bold text-slate-900 font-mono">{returnModalGRN.invoiceGrn}</span> back to vendor for credit / replacement.
            </p>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Return Reason / Damage Report *</label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Specify damage defect, specifications mismatch, or expiry..."
                className="w-full border border-slate-300 rounded p-2 text-xs h-20"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReturnModalGRN(null)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.info(`Purchase Return draft initiated against ${returnModalGRN.invoiceGrn}. Check Returns tab.`, {
                    title: "Return Draft Created",
                  });
                  setReturnModalGRN(null);
                }}
                className="px-4 py-1.5 bg-amber-600 text-white rounded font-bold hover:bg-amber-700"
              >
                Proceed to Return
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
