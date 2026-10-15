"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Eye,
  Check,
  X,
  Trash2,
  FileText,
  Clock,
  History,
  Pencil,
  Printer,
  RotateCcw,
  PlusCircle,
  PrinterIcon,
  Search,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { toast } from "@/components/ui/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  PurchaseRequisition,
  Office,
  Warehouse,
  Item,
  CreateRequisitionInput,
} from "@bridgeone/contracts";

export default function PurchaseRequisitionsPage() {
  const queryClient = useQueryClient();

  // Tab state (supporting direct URL / tab param)
  const [activeTab, setActiveTab] = useState<"PURCHASE_REQUISITION" | "REQUISITION_SUMMARY">("PURCHASE_REQUISITION");
  const [summaryViewMode, setSummaryViewMode] = useState<"ITEM_WISE" | "DEPARTMENT_WISE">("ITEM_WISE");

  // Check URL query param for ?tab=summary
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("tab") === "summary") {
        setActiveTab("REQUISITION_SUMMARY");
      }
    }
  }, []);

  const handleTabChange = (tab: "PURCHASE_REQUISITION" | "REQUISITION_SUMMARY") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "REQUISITION_SUMMARY") {
        url.searchParams.set("tab", "summary");
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Filters state (matching Managerium ERP exact filter bar)
  const [search, setSearch] = useState("");
  const [selectedOffice, setSelectedOffice] = useState("ALL");
  const [selectedWarehouse, setSelectedWarehouse] = useState("ALL");
  const [selectedRequestType, setSelectedRequestType] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedBuyerOffice, setSelectedBuyerOffice] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewReq, setViewReq] = useState<PurchaseRequisition | null>(null);
  const [editReq, setEditReq] = useState<PurchaseRequisition | null>(null);
  const [printReq, setPrintReq] = useState<PurchaseRequisition | null>(null);
  const [closeModal, setCloseModal] = useState<PurchaseRequisition | null>(null);
  const [closeComment, setCloseComment] = useState("");
  const [reverseModal, setReverseModal] = useState<PurchaseRequisition | null>(null);
  const [reverseComment, setReverseComment] = useState("");
  const [templateNotification, setTemplateNotification] = useState<string | null>(null);

  // Approval modal state (for view details or quick review)
  const [approvalModal, setApprovalModal] = useState<{
    req: PurchaseRequisition;
    action: "APPROVE" | "REJECT" | "CANCEL";
  } | null>(null);
  const [approvalComment, setApprovalComment] = useState("");

  // Edit Requisition form state
  const [editOfficeId, setEditOfficeId] = useState("off-01");
  const [editWarehouseId, setEditWarehouseId] = useState("wh-01");
  const [editRequestType, setEditRequestType] = useState<"LOCAL" | "IMPORT" | "INTER_BRANCH" | "URGENT">("LOCAL");
  const [editDepartment, setEditDepartment] = useState("Operations");
  const [editRequester, setEditRequester] = useState("Mahfuz Rahman");
  const [editPurchaseMethod, setEditPurchaseMethod] = useState<"DIRECT" | "QUOTATION" | "TENDER" | "CONTRACT">("DIRECT");
  const [editDeliveryDate, setEditDeliveryDate] = useState("2026-10-25");
  const [editJustification, setEditJustification] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editLineItems, setEditLineItems] = useState<any[]>([]);

  // Master data queries
  const { data: offices } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
  });
  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ["warehouses", selectedOffice],
    queryFn: () => {
      const p = selectedOffice && selectedOffice !== "ALL" ? `?officeId=${selectedOffice}` : "";
      return fetchApi(`/master/warehouses${p}`);
    },
  });
  const { data: itemsCatalog } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: () => fetchApi("/master/items"),
  });

  // Requisitions query with full ERP filters
  const { data: requisitions, isLoading, refetch } = useQuery<PurchaseRequisition[]>({
    queryKey: [
      "requisitions",
      selectedOffice,
      selectedWarehouse,
      selectedStatus,
      selectedRequestType,
      selectedSection,
      selectedBuyerOffice,
      search,
      fromDate,
      toDate,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedOffice !== "ALL") params.append("officeId", selectedOffice);
      if (selectedWarehouse !== "ALL") params.append("warehouseId", selectedWarehouse);
      if (selectedStatus !== "ALL") params.append("status", selectedStatus);
      if (selectedRequestType !== "ALL") params.append("requestType", selectedRequestType);
      if (selectedSection !== "ALL") params.append("section", selectedSection);
      if (selectedBuyerOffice !== "ALL") params.append("buyerOfficeId", selectedBuyerOffice);
      if (search) params.append("search", search);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      return fetchApi(`/purchase/requisitions?${params.toString()}`);
    },
  });

  // Create Requisition form state
  const [formOfficeId, setFormOfficeId] = useState("off-01");
  const [formWarehouseId, setFormWarehouseId] = useState("wh-01");
  const [formRequestType, setFormRequestType] = useState<"LOCAL" | "IMPORT" | "INTER_BRANCH" | "URGENT">("LOCAL");
  const [formDepartment, setFormDepartment] = useState("Operations");
  const [formRequester, setFormRequester] = useState("Mahfuz Rahman");
  const [formPurchaseMethod, setFormPurchaseMethod] = useState<"DIRECT" | "QUOTATION" | "TENDER" | "CONTRACT">("DIRECT");
  const [formDeliveryDate, setFormDeliveryDate] = useState("2026-10-25");
  const [formJustification, setFormJustification] = useState("Quarterly buffer replenishment for production.");
  const [formRemarks, setFormRemarks] = useState("");
  const [formLineItems, setFormLineItems] = useState([
    {
      itemId: "itm-01",
      itemCode: "PPE-HLM-01",
      itemName: "Industrial Safety Helmet ANSI Z89.1",
      uom: "Pcs",
      quantity: 50,
      estimatedUnitPrice: 450,
      lineTotal: 22500,
      remarks: "",
    },
  ]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateRequisitionInput) =>
      fetchApi("/purchase/requisitions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setIsCreateOpen(false);
      toast.success("Purchase requisition created and submitted successfully!", {
        title: "Requisition Created",
      });
    },
    onError: (err: any) => {
      toast.error(`Error creating requisition: ${err.message}`, {
        title: "Creation Failed",
      });
    },
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, action, comments }: { id: string; action: string; comments: string }) =>
      fetchApi(`/purchase/requisitions/${id}/${action.toLowerCase()}`, {
        method: "POST",
        body: JSON.stringify({ comments }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setApprovalModal(null);
      setApprovalComment("");
      if (viewReq) setViewReq(null);
      toast.success(`Requisition ${variables.action.toLowerCase()}d successfully!`, {
        title: "Status Updated",
      });
    },
    onError: (err: any) => {
      toast.error(`Action failed: ${err.message}`, {
        title: "Action Failed",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRequisitionInput> }) =>
      fetchApi(`/purchase/requisitions/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditReq(null);
      toast.success("Requisition updated successfully!", {
        title: "Changes Saved",
      });
    },
    onError: (err: any) => {
      toast.error(`Update failed: ${err.message}`, {
        title: "Update Failed",
      });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      fetchApi(`/purchase/requisitions/${id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ comments }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setReverseModal(null);
      setReverseComment("");
      toast.success("Requisition status successfully reversed to Submitted for review!", {
        title: "Reversal Successful",
      });
    },
    onError: (err: any) => {
      toast.error(`Reversal failed: ${err.message}`, {
        title: "Reversal Failed",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      fetchApi(`/purchase/requisitions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ comments }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setCloseModal(null);
      setCloseComment("");
      toast.success("Requisition closed/cancelled successfully.", {
        title: "Requisition Closed",
      });
    },
    onError: (err: any) => {
      toast.error(`Close failed: ${err.message}`, {
        title: "Close Failed",
      });
    },
  });

  // Open Edit Modal with pre-filled row values
  const handleOpenEdit = (req: PurchaseRequisition) => {
    if (req.status === "CONVERTED_TO_PO") {
      toast.warning("Cannot edit requisition that has already been converted to a Purchase Order.", {
        title: "Action Not Allowed",
      });
      return;
    }
    setEditReq(req);
    setEditOfficeId(req.officeId);
    setEditWarehouseId(req.warehouseId);
    setEditRequestType((req.requestType as any) || "LOCAL");
    setEditDepartment(req.department);
    setEditRequester(req.requesterName);
    setEditPurchaseMethod((req.purchaseMethod as any) || "DIRECT");
    setEditDeliveryDate(req.requiredDeliveryDate || "2026-10-25");
    setEditJustification(req.businessJustification || "");
    setEditRemarks(req.remarks || "");
    setEditLineItems(
      req.items.map((it) => ({
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        quantity: it.quantity,
        estimatedUnitPrice: it.estimatedUnitPrice,
        lineTotal: it.lineTotal,
        remarks: it.remarks || "",
      }))
    );
  };

  const handleEditItemChange = (index: number, itemId: string) => {
    const selected = itemsCatalog?.find((i) => i.id === itemId);
    if (!selected) return;
    const updated = [...editLineItems];
    updated[index].itemId = selected.id;
    updated[index].itemCode = selected.code;
    updated[index].itemName = selected.name;
    updated[index].uom = selected.uom;
    updated[index].estimatedUnitPrice = Number(selected.standardPrice) || 100;
    updated[index].lineTotal = updated[index].quantity * (Number(selected.standardPrice) || 100);
    setEditLineItems(updated);
  };

  const handleEditQtyChange = (index: number, qty: number) => {
    const updated = [...editLineItems];
    updated[index].quantity = qty;
    updated[index].lineTotal = qty * updated[index].estimatedUnitPrice;
    setEditLineItems(updated);
  };

  const handleEditPriceChange = (index: number, price: number) => {
    const updated = [...editLineItems];
    updated[index].estimatedUnitPrice = price;
    updated[index].lineTotal = updated[index].quantity * price;
    setEditLineItems(updated);
  };

  const handleEditAddItem = () => {
    const first = itemsCatalog?.[0];
    if (!first) return;
    setEditLineItems([
      ...editLineItems,
      {
        itemId: first.id,
        itemCode: first.code,
        itemName: first.name,
        uom: first.uom,
        quantity: 1,
        estimatedUnitPrice: Number(first.standardPrice) || 100,
        lineTotal: Number(first.standardPrice) || 100,
        remarks: "",
      },
    ]);
  };

  const handleEditRemoveItem = (index: number) => {
    if (editLineItems.length === 1) return;
    setEditLineItems(editLineItems.filter((_, i) => i !== index));
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReq) return;
    editMutation.mutate({
      id: editReq.id,
      data: {
        officeId: editOfficeId,
        warehouseId: editWarehouseId,
        requestType: editRequestType,
        department: editDepartment,
        requesterName: editRequester,
        purchaseMethod: editPurchaseMethod,
        requiredDeliveryDate: editDeliveryDate,
        businessJustification: editJustification,
        remarks: editRemarks,
        items: editLineItems,
      },
    });
  };

  // Duplicate existing Requisition to create a New PR quickly
  const handleDuplicateAsNew = (req: PurchaseRequisition) => {
    setFormOfficeId(req.officeId);
    setFormWarehouseId(req.warehouseId);
    setFormRequestType((req.requestType as any) || "LOCAL");
    setFormDepartment(req.department);
    setFormRequester(req.requesterName);
    setFormPurchaseMethod((req.purchaseMethod as any) || "DIRECT");
    setFormDeliveryDate(req.requiredDeliveryDate || "2026-10-25");
    setFormJustification(`Re-order based on previous requisition ${req.requisitionNumber}`);
    setFormRemarks(`Cloned from ${req.requisitionNumber}`);
    setFormLineItems(
      req.items.map((it) => ({
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        uom: it.uom,
        quantity: it.quantity,
        estimatedUnitPrice: it.estimatedUnitPrice,
        lineTotal: it.lineTotal,
        remarks: it.remarks || "",
      }))
    );
    setTemplateNotification(`Template pre-filled from ${req.requisitionNumber}`);
    setIsCreateOpen(true);
  };

  const handleAddItem = () => {
    const first = itemsCatalog?.[0];
    if (!first) return;
    setFormLineItems([
      ...formLineItems,
      {
        itemId: first.id,
        itemCode: first.code,
        itemName: first.name,
        uom: first.uom,
        quantity: 1,
        estimatedUnitPrice: Number(first.standardPrice) || 100,
        lineTotal: Number(first.standardPrice) || 100,
        remarks: "",
      },
    ]);
  };

  const handleItemChange = (index: number, itemId: string) => {
    const selected = itemsCatalog?.find((i) => i.id === itemId);
    if (!selected) return;
    const updated = [...formLineItems];
    updated[index].itemId = selected.id;
    updated[index].itemCode = selected.code;
    updated[index].itemName = selected.name;
    updated[index].uom = selected.uom;
    updated[index].estimatedUnitPrice = Number(selected.standardPrice) || 100;
    updated[index].lineTotal = updated[index].quantity * (Number(selected.standardPrice) || 100);
    setFormLineItems(updated);
  };

  const handleQtyChange = (index: number, qty: number) => {
    const updated = [...formLineItems];
    updated[index].quantity = qty;
    updated[index].lineTotal = qty * updated[index].estimatedUnitPrice;
    setFormLineItems(updated);
  };

  const handlePriceChange = (index: number, price: number) => {
    const updated = [...formLineItems];
    updated[index].estimatedUnitPrice = price;
    updated[index].lineTotal = updated[index].quantity * price;
    setFormLineItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (formLineItems.length === 1) return;
    setFormLineItems(formLineItems.filter((_, i) => i !== index));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      companyId: "comp-bridgeone-01",
      officeId: formOfficeId,
      warehouseId: formWarehouseId,
      requestType: formRequestType,
      department: formDepartment,
      requesterName: formRequester,
      purchaseMethod: formPurchaseMethod,
      requestDate: new Date().toISOString().split("T")[0],
      requiredDeliveryDate: formDeliveryDate,
      businessJustification: formJustification,
      remarks: formRemarks,
      items: formLineItems,
    });
  };

  // Export CSV
  const handleExport = () => {
    const params = new URLSearchParams();
    params.append("reportType", "REQUISITION_REPORT");
    if (selectedOffice !== "ALL") params.append("officeId", selectedOffice);
    window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"}/purchase/reports/export-csv?${params.toString()}`, "_blank");
  };

  // Table Columns (Exact columns as in Managerium screenshots)
  const columns = [
    {
      header: "SL",
      cell: (_: any, idx: number) => <span className="font-mono text-slate-500">{idx + 1}</span>,
    },
    {
      header: "Actions",
      className: "bg-sky-50/70 text-slate-800 font-semibold w-[170px] text-center",
      cell: (row: PurchaseRequisition) => (
        <div className="flex items-center justify-center gap-1.5 text-slate-700">
          {/* 1. Edit */}
          <button
            type="button"
            onClick={() => handleOpenEdit(row)}
            className="p-1 rounded hover:bg-slate-200/80 hover:text-slate-950 transition-colors"
            title="Edit Requisition"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {/* 2. Print */}
          <button
            type="button"
            onClick={() => setPrintReq(row)}
            className="p-1 rounded hover:bg-slate-200/80 hover:text-slate-950 transition-colors"
            title="Print Requisition Voucher"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* 3. Close / Cancel */}
          <button
            type="button"
            onClick={() => {
              setCloseModal(row);
              setCloseComment("");
            }}
            className="p-1 rounded hover:bg-rose-100 hover:text-rose-700 transition-colors"
            title="Close / Cancel Requisition"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* 4. Reverse */}
          <button
            type="button"
            onClick={() => {
              setReverseModal(row);
              setReverseComment("");
            }}
            className="p-1 rounded hover:bg-amber-100 hover:text-amber-800 transition-colors"
            title="Reverse Requisition Status"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* 5. New PR (Duplicate / Template) */}
          <button
            type="button"
            onClick={() => handleDuplicateAsNew(row)}
            className="p-1 rounded hover:bg-sky-100 hover:text-sky-700 transition-colors"
            title="New PR (Duplicate from Template)"
          >
            <PlusCircle className="w-3.5 h-3.5" />
          </button>

          {/* 6. View Requisition */}
          <button
            type="button"
            onClick={() => setViewReq(row)}
            className="p-1 rounded hover:bg-slate-200/80 hover:text-slate-950 transition-colors"
            title="View Requisition Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
    {
      header: "Requisition No.",
      cell: (row: PurchaseRequisition) => (
        <span className="font-semibold text-sky-700 font-mono">{row.requisitionNumber}</span>
      ),
    },
    {
      header: "Reference",
      accessorKey: "referenceDocument",
    },
    {
      header: "Date",
      accessorKey: "requestDate",
    },
    {
      header: "Office",
      cell: (row: PurchaseRequisition) => {
        const off = offices?.find((o) => o.id === row.officeId);
        return <span>{off?.name || row.officeId}</span>;
      },
    },
    {
      header: "Warehouse",
      cell: (row: PurchaseRequisition) => {
        const wh = warehouses?.find((w) => w.id === row.warehouseId);
        return <span>{wh?.name || row.warehouseId}</span>;
      },
    },
    {
      header: "Section",
      accessorKey: "department",
    },
    {
      header: "Buyer / Requester",
      accessorKey: "requesterName",
    },
    {
      header: "Request Type",
      accessorKey: "requestType",
    },
    {
      header: "Purchase Method",
      accessorKey: "purchaseMethod",
    },
    {
      header: "Est. Amount",
      cell: (row: PurchaseRequisition) => (
        <span className="font-bold font-mono text-slate-900">
          {formatCurrency(row.totalEstimatedAmount)}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row: PurchaseRequisition) => <StatusBadge status={row.status} />,
    },
    {
      header: "Remarks",
      accessorKey: "remarks",
    },
  ];

  // Summary computations for REQUISITION SUMMARY tab
  const departmentSummary = React.useMemo(() => {
    if (!requisitions) return [];
    const deptMap = new Map<
      string,
      {
        department: string;
        totalCount: number;
        totalAmount: number;
        submitted: number;
        pending: number;
        approved: number;
        converted: number;
        rejected: number;
      }
    >();

    requisitions.forEach((r) => {
      const dept = r.department || "General";
      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          department: dept,
          totalCount: 0,
          totalAmount: 0,
          submitted: 0,
          pending: 0,
          approved: 0,
          converted: 0,
          rejected: 0,
        });
      }
      const entry = deptMap.get(dept)!;
      entry.totalCount += 1;
      entry.totalAmount += r.totalEstimatedAmount || 0;
      if (r.status === "SUBMITTED") entry.submitted += 1;
      else if (r.status === "PENDING_APPROVAL") entry.pending += 1;
      else if (r.status === "APPROVED") entry.approved += 1;
      else if (r.status === "CONVERTED_TO_PO") entry.converted += 1;
      else if (r.status === "REJECTED" || r.status === "CANCELLED") entry.rejected += 1;
    });

    return Array.from(deptMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [requisitions]);

  // Item-wise summary for REQUISITION SUMMARY tab
  const itemWiseSummary = React.useMemo(() => {
    if (!requisitions) return [];
    const itemMap = new Map<
      string,
      {
        itemId: string;
        itemCode: string;
        itemName: string;
        uom: string;
        departments: Set<string>;
        reqNumbers: Set<string>;
        totalReqQty: number;
        totalApprovedQty: number;
        totalPOQty: number;
        totalBalanceQty: number;
        unitPrice: number;
        totalAmount: number;
      }
    >();

    requisitions.forEach((r) => {
      r.items?.forEach((it) => {
        const key = it.itemId || it.itemCode;
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            itemId: it.itemId,
            itemCode: it.itemCode,
            itemName: it.itemName,
            uom: it.uom,
            departments: new Set<string>(),
            reqNumbers: new Set<string>(),
            totalReqQty: 0,
            totalApprovedQty: 0,
            totalPOQty: 0,
            totalBalanceQty: 0,
            unitPrice: it.estimatedUnitPrice,
            totalAmount: 0,
          });
        }
        const record = itemMap.get(key)!;
        record.departments.add(r.department || "General");
        record.reqNumbers.add(r.requisitionNumber);
        record.totalReqQty += it.quantity;
        if (r.status === "APPROVED" || r.status === "CONVERTED_TO_PO") {
          record.totalApprovedQty += it.quantity;
        }
        if (r.status === "CONVERTED_TO_PO") {
          record.totalPOQty += it.quantity;
        } else {
          record.totalBalanceQty += it.quantity;
        }
        record.totalAmount += it.lineTotal;
      });
    });

    return Array.from(itemMap.values())
      .map((it) => ({
        ...it,
        deptList: Array.from(it.departments).join(", "),
        reqList: Array.from(it.reqNumbers).join(", "),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [requisitions]);

  const totalSummaryMetrics = React.useMemo(() => {
    if (!requisitions) return { count: 0, amount: 0, pending: 0, approved: 0, converted: 0 };
    return {
      count: requisitions.length,
      amount: requisitions.reduce((acc, r) => acc + (r.totalEstimatedAmount || 0), 0),
      pending: requisitions.filter((r) => r.status === "PENDING_APPROVAL" || r.status === "SUBMITTED").length,
      approved: requisitions.filter((r) => r.status === "APPROVED").length,
      converted: requisitions.filter((r) => r.status === "CONVERTED_TO_PO").length,
    };
  }, [requisitions]);

  return (
    <div className="space-y-3">
      {/* 1. TOP HEADER (Exact Unified Box Layout) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Purchase Requisition
          </h1>
        </div>

        <div className="flex items-center gap-2">
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

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Requisition</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (PURCHASE REQUISITION | REQUISITION SUMMARY) */}
      <div className="flex items-center gap-8 border-b border-slate-200 mb-3 bg-white px-2">
        <button
          type="button"
          onClick={() => handleTabChange("PURCHASE_REQUISITION")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase ${
            activeTab === "PURCHASE_REQUISITION"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>PURCHASE REQUISITION</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("REQUISITION_SUMMARY")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase ${
            activeTab === "REQUISITION_SUMMARY"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>REQUISITION SUMMARY</span>
        </button>
      </div>

      {/* Enterprise Filter Card (Exact Managerium Layout) */}
      <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs mb-4">
        {/* Row 1: 5 Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-3.5">
          {/* 1. Office */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Office
            </label>
            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="w-full h-9 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">Office</option>
              {offices?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Warehouse */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Warehouse
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full h-9 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">Warehouse</option>
              {warehouses?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Request Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Request Type
            </label>
            <select
              value={selectedRequestType}
              onChange={(e) => setSelectedRequestType(e.target.value)}
              className="w-full h-9 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">Request Type</option>
              <option value="LOCAL">LOCAL</option>
              <option value="IMPORT">IMPORT</option>
              <option value="URGENT">URGENT</option>
              <option value="INTER_BRANCH">INTER_BRANCH</option>
            </select>
          </div>

          {/* 4. Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full h-9 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">Section</option>
              <option value="Operations">Operations</option>
              <option value="Production">Production</option>
              <option value="Administration">Administration</option>
              <option value="IT">IT</option>
              <option value="Logistics">Logistics</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Procurement">Procurement</option>
            </select>
          </div>

          {/* 5. From Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-9 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Row 2: 4 Columns with Clean Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-end">
          {/* 1. To Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-9 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 2. Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-9 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="CONVERTED_TO_PO">Converted to PO</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* 3. Buyer Office */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Buyer Office
            </label>
            <select
              value={selectedBuyerOffice}
              onChange={(e) => setSelectedBuyerOffice(e.target.value)}
              className="w-full h-9 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">Buyer Office</option>
              {offices?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Action Buttons (View & EXCEL) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refetch()}
              className="h-9 px-6 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs uppercase rounded shadow-xs transition flex items-center justify-center min-w-[70px]"
            >
              View
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="h-9 px-5 border border-[#2563eb] text-[#2563eb] hover:bg-blue-50 font-bold text-xs uppercase rounded shadow-xs transition flex items-center justify-center min-w-[75px]"
            >
              EXCEL
            </button>
            {(selectedOffice !== "ALL" ||
              selectedWarehouse !== "ALL" ||
              selectedRequestType !== "ALL" ||
              selectedSection !== "ALL" ||
              selectedStatus !== "ALL" ||
              selectedBuyerOffice !== "ALL" ||
              fromDate !== "" ||
              toDate !== "" ||
              search !== "") && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOffice("ALL");
                  setSelectedWarehouse("ALL");
                  setSelectedRequestType("ALL");
                  setSelectedSection("ALL");
                  setSelectedStatus("ALL");
                  setSelectedBuyerOffice("ALL");
                  setFromDate("");
                  setToDate("");
                  setSearch("");
                }}
                className="h-9 px-2 text-xs text-slate-500 hover:text-slate-800 underline transition"
                title="Reset Filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content: Requisitions List or Summary Matrix */}
      {activeTab === "PURCHASE_REQUISITION" ? (
        /* Requisitions Data Table */
        <DataTable
          columns={columns}
          data={requisitions || []}
          loading={isLoading}
          emptyMessage="No requisitions found matching the selected criteria."
        />
      ) : (
        /* Requisition Summary View */
        <div className="space-y-4">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Requisitions</span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">{totalSummaryMetrics.count}</p>
              <span className="text-[11px] text-slate-400">All matching filter criteria</span>
            </div>

            <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Estimated Budget</span>
              <p className="text-2xl font-bold font-mono text-blue-700 mt-1">
                {formatCurrency(totalSummaryMetrics.amount)}
              </p>
              <span className="text-[11px] text-slate-400">Total estimated outlay</span>
            </div>

            <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs">
              <span className="text-xs font-semibold text-amber-600 uppercase">Pending Approval</span>
              <p className="text-2xl font-bold font-mono text-amber-600 mt-1">{totalSummaryMetrics.pending}</p>
              <span className="text-[11px] text-slate-400">Awaiting management verification</span>
            </div>

            <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs">
              <span className="text-xs font-semibold text-emerald-600 uppercase">Approved / In-PO</span>
              <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {totalSummaryMetrics.approved + totalSummaryMetrics.converted}
              </p>
              <span className="text-[11px] text-slate-400">Converted or cleared for PO</span>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 rounded-t-md">
            <button
              type="button"
              onClick={() => setSummaryViewMode("ITEM_WISE")}
              className={`px-3 py-1.5 text-xs font-bold rounded transition ${
                summaryViewMode === "ITEM_WISE"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Item-Wise Summary ({itemWiseSummary.length} Items)
            </button>
            <button
              type="button"
              onClick={() => setSummaryViewMode("DEPARTMENT_WISE")}
              className={`px-3 py-1.5 text-xs font-bold rounded transition ${
                summaryViewMode === "DEPARTMENT_WISE"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Department / Section Matrix ({departmentSummary.length} Departments)
            </button>
          </div>

          {summaryViewMode === "ITEM_WISE" ? (
            /* Item-Wise Requisition Summary Table */
            <div className="bg-white rounded border border-slate-200/90 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Item-Wise Requisition Summary</h3>
                  <p className="text-xs text-slate-500">
                    Aggregated material demand, approved quantities, PO converted volume, and remaining balances
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600 font-mono">
                  {itemWiseSummary.length} Unique Items
                </span>
              </div>

              <div className="erp-table-container">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>SL</th>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Section(s)</th>
                      <th>Requisition Ref(s)</th>
                      <th className="text-center">UOM</th>
                      <th className="text-center">Req. Qty</th>
                      <th className="text-center">Approved Qty</th>
                      <th className="text-center">PO Qty</th>
                      <th className="text-center">Balance Qty</th>
                      <th className="text-right">Est. Unit Price</th>
                      <th className="text-right">Total Est. Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemWiseSummary.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="text-center py-8 text-slate-400">
                          No requisition items found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      itemWiseSummary.map((it, idx) => (
                        <tr key={it.itemId || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="font-mono font-semibold text-blue-700">{it.itemCode}</td>
                          <td className="font-semibold text-slate-800">{it.itemName}</td>
                          <td className="text-xs text-slate-600 max-w-[140px] truncate" title={it.deptList}>
                            {it.deptList}
                          </td>
                          <td className="font-mono text-xs text-slate-500 max-w-[150px] truncate" title={it.reqList}>
                            {it.reqList}
                          </td>
                          <td className="text-center text-slate-600 font-medium">{it.uom}</td>
                          <td className="text-center font-mono font-bold text-slate-900">{it.totalReqQty}</td>
                          <td className="text-center font-mono font-medium text-emerald-600">
                            {it.totalApprovedQty}
                          </td>
                          <td className="text-center font-mono font-medium text-blue-600">{it.totalPOQty}</td>
                          <td className="text-center font-mono font-bold text-amber-600">
                            {it.totalBalanceQty}
                          </td>
                          <td className="text-right font-mono text-slate-700">
                            {formatCurrency(it.unitPrice)}
                          </td>
                          <td className="text-right font-mono font-bold text-slate-900">
                            {formatCurrency(it.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Department / Section Summary Matrix Table */
            <div className="bg-white rounded border border-slate-200/90 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Department / Section Requisition Summary</h3>
                  <p className="text-xs text-slate-500">Breakdown of requests, total expenditure and approval status</p>
                </div>
                <span className="text-xs font-medium text-slate-500 font-mono">
                  {departmentSummary.length} Departments Active
                </span>
              </div>

              <div className="erp-table-container">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>SL</th>
                      <th>Section / Department</th>
                      <th className="text-center">Total Requests</th>
                      <th className="text-right">Total Est. Amount</th>
                      <th className="text-center">Submitted</th>
                      <th className="text-center">Pending</th>
                      <th className="text-center">Approved</th>
                      <th className="text-center">Converted to PO</th>
                      <th className="text-center">Rejected/Closed</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentSummary.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-slate-400">
                          No summary records found.
                        </td>
                      </tr>
                    ) : (
                      departmentSummary.map((d, idx) => (
                        <tr key={d.department} className="hover:bg-slate-50 transition-colors">
                          <td className="text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="font-semibold text-slate-800">{d.department}</td>
                          <td className="text-center font-mono font-medium">{d.totalCount}</td>
                          <td className="text-right font-mono font-bold text-slate-900">
                            {formatCurrency(d.totalAmount)}
                          </td>
                          <td className="text-center font-mono text-sky-600">{d.submitted}</td>
                          <td className="text-center font-mono text-amber-600">{d.pending}</td>
                          <td className="text-center font-mono text-emerald-600 font-semibold">{d.approved}</td>
                          <td className="text-center font-mono text-blue-600 font-semibold">{d.converted}</td>
                          <td className="text-center font-mono text-rose-500">{d.rejected}</td>
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSection(d.department);
                                handleTabChange("PURCHASE_REQUISITION");
                              }}
                              className="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                            >
                              View List &rarr;
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
        </div>
      )}

      {/* CREATE REQUISITION MODAL */}
      <ModalDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Purchase Requisition"
        subtitle="Submit a formal request for materials or equipment to the procurement department"
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {templateNotification && (
            <div className="flex items-center justify-between px-3 py-2 bg-sky-50 border border-sky-200 text-sky-800 rounded text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                <PlusCircle className="w-3.5 h-3.5 text-sky-600" />
                <span>{templateNotification}</span>
              </div>
              <button
                type="button"
                onClick={() => setTemplateNotification(null)}
                className="text-sky-500 hover:text-sky-700 font-bold"
              >
                ✕
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Office / Branch *
              </label>
              <select
                value={formOfficeId}
                onChange={(e) => setFormOfficeId(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                required
              >
                {offices?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Authorized Delivery Warehouse *
              </label>
              <select
                value={formWarehouseId}
                onChange={(e) => setFormWarehouseId(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                required
              >
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Required Delivery Date *
              </label>
              <input
                type="date"
                value={formDeliveryDate}
                onChange={(e) => setFormDeliveryDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Requesting Department *
              </label>
              <input
                type="text"
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Requester Name *
              </label>
              <input
                type="text"
                value={formRequester}
                onChange={(e) => setFormRequester(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Purchase Method
              </label>
              <select
                value={formPurchaseMethod}
                onChange={(e) => setFormPurchaseMethod(e.target.value as any)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
              >
                <option value="DIRECT">Direct Purchase</option>
                <option value="QUOTATION">Quotation / RFP</option>
                <option value="TENDER">Public Tender</option>
                <option value="CONTRACT">Rate Contract</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Business Justification *
              </label>
              <textarea
                value={formJustification}
                onChange={(e) => setFormJustification(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white"
                placeholder="Explain why this purchase is needed..."
                required
              />
            </div>
          </div>

          {/* Requested Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Requested Line Items
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs text-sky-600 font-semibold hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 w-20">UOM</th>
                    <th className="p-2 w-24">Qty</th>
                    <th className="p-2 w-32">Est. Unit Price</th>
                    <th className="p-2 w-32 text-right">Line Amount</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formLineItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2">
                        <select
                          value={item.itemId}
                          onChange={(e) => handleItemChange(idx, e.target.value)}
                          className="w-full border border-slate-200 rounded p-1 text-xs"
                        >
                          {itemsCatalog?.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.code} - {it.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-slate-500 font-mono text-[11px]">{item.uom}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                          className="w-full border border-slate-200 rounded p-1 text-xs text-center font-mono"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          value={item.estimatedUnitPrice}
                          onChange={(e) => handlePriceChange(idx, Number(e.target.value))}
                          className="w-full border border-slate-200 rounded p-1 text-xs text-right font-mono"
                          required
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.lineTotal)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="p-2 text-right text-slate-700">
                      Total Estimated Budget:
                    </td>
                    <td className="p-2 text-right font-mono text-sm text-sky-700">
                      {formatCurrency(
                        formLineItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0)
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold shadow transition disabled:opacity-50"
            >
              {createMutation.isPending ? "Submitting..." : "Submit for Approval"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* VIEW REQUISITION DETAILS & APPROVAL TIMELINE */}
      <ModalDialog
        isOpen={!!viewReq}
        onClose={() => setViewReq(null)}
        title={`Requisition Details: ${viewReq?.requisitionNumber}`}
        subtitle={`Requested by ${viewReq?.requesterName} on ${viewReq?.requestDate}`}
        maxWidth="2xl"
      >
        {viewReq && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-slate-400 text-[11px] block">Status</span>
                <StatusBadge status={viewReq.status} />
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Department</span>
                <span className="font-semibold text-slate-800">{viewReq.department}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Delivery Due</span>
                <span className="font-semibold text-slate-800">{viewReq.requiredDeliveryDate}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Total Amount</span>
                <span className="font-bold text-sky-700 font-mono">
                  {formatCurrency(viewReq.totalEstimatedAmount)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 text-[11px] block">Business Justification</span>
                <span className="text-slate-700">{viewReq.businessJustification}</span>
              </div>
            </div>

            {/* Line items list */}
            <div>
              <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-2">Item Specifications</h4>
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2">Code</th>
                      <th className="p-2">Item Name</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Unit Price</th>
                      <th className="p-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewReq.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-mono text-slate-500">{it.itemCode}</td>
                        <td className="p-2 font-medium text-slate-800">{it.itemName}</td>
                        <td className="p-2 text-center font-mono">
                          {it.quantity} {it.uom}
                        </td>
                        <td className="p-2 text-right font-mono">{formatCurrency(it.estimatedUnitPrice)}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(it.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit & Approval Timeline */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-800 uppercase text-[11px] mb-2">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Approval Audit History</span>
              </div>
              <div className="space-y-2 border-l-2 border-slate-200 pl-3 ml-2">
                {viewReq.approvalHistory.map((h, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{h.action}</span>
                      <span className="text-[10px] text-slate-400">by {h.actorName}</span>
                      <span className="text-[10px] text-slate-400">({new Date(h.timestamp).toLocaleDateString()})</span>
                    </div>
                    {h.comments && <p className="text-slate-600 italic mt-0.5">{h.comments}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* APPROVAL ACTION MODAL */}
      <ModalDialog
        isOpen={!!approvalModal}
        onClose={() => setApprovalModal(null)}
        title={`Confirm Action: ${approvalModal?.action} Requisition`}
        subtitle={`Requisition: ${approvalModal?.req.requisitionNumber}`}
        maxWidth="md"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600">
            Are you sure you want to <strong>{approvalModal?.action}</strong> requisition{" "}
            <strong>{approvalModal?.req.requisitionNumber}</strong> for amount{" "}
            <strong>{formatCurrency(approvalModal?.req.totalEstimatedAmount ?? 0)}</strong>?
          </p>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Comments / Reason
            </label>
            <textarea
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded p-2 text-xs"
              placeholder="Enter approval or rejection comments..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setApprovalModal(null)}
              className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={approvalMutation.isPending}
              onClick={() => {
                if (!approvalModal) return;
                approvalMutation.mutate({
                  id: approvalModal.req.id,
                  action: approvalModal.action,
                  comments: approvalComment,
                });
              }}
              className={`px-4 py-1.5 rounded text-white font-semibold ${
                approvalModal?.action === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              Confirm {approvalModal?.action}
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* EDIT REQUISITION MODAL */}
      <ModalDialog
        isOpen={!!editReq}
        onClose={() => setEditReq(null)}
        title={`Edit Purchase Requisition: ${editReq?.requisitionNumber}`}
        subtitle="Modify requisition details, delivery requirements, or line item quantities"
        maxWidth="4xl"
      >
        {editReq && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Office / Branch *
                </label>
                <select
                  value={editOfficeId}
                  onChange={(e) => setEditOfficeId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                  required
                >
                  {offices?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Delivery Warehouse *
                </label>
                <select
                  value={editWarehouseId}
                  onChange={(e) => setEditWarehouseId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                  required
                >
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Request Priority *
                </label>
                <select
                  value={editRequestType}
                  onChange={(e) => setEditRequestType(e.target.value as any)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                >
                  <option value="LOCAL">Local Purchase</option>
                  <option value="IMPORT">Import LC</option>
                  <option value="URGENT">Urgent Production</option>
                  <option value="INTER_BRANCH">Inter-Branch</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Department *
                </label>
                <input
                  type="text"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Buyer / Requester *
                </label>
                <input
                  type="text"
                  value={editRequester}
                  onChange={(e) => setEditRequester(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Required Delivery Date *
                </label>
                <input
                  type="date"
                  value={editDeliveryDate}
                  onChange={(e) => setEditDeliveryDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                  required
                />
              </div>
            </div>

            {/* Edit Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Requisition Items ({editLineItems.length})
                </span>
                <button
                  type="button"
                  onClick={handleEditAddItem}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded border border-sky-200 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold">
                    <tr>
                      <th className="p-2 w-10">SL</th>
                      <th className="p-2">Item Selection</th>
                      <th className="p-2 w-20 text-center">UOM</th>
                      <th className="p-2 w-24 text-right">Qty</th>
                      <th className="p-2 w-28 text-right">Est. Unit Price</th>
                      <th className="p-2 w-32 text-right">Line Total</th>
                      <th className="p-2 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editLineItems.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="p-2 text-slate-400 font-mono">{index + 1}</td>
                        <td className="p-2">
                          <select
                            value={item.itemId}
                            onChange={(e) => handleEditItemChange(index, e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 bg-white text-xs"
                          >
                            {itemsCatalog?.map((it) => (
                              <option key={it.id} value={it.id}>
                                [{it.code}] {it.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-center text-slate-500 font-mono">{item.uom}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleEditQtyChange(index, Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-full text-right border border-slate-300 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.estimatedUnitPrice}
                            onChange={(e) =>
                              handleEditPriceChange(index, Math.max(0, Number(e.target.value) || 0))
                            }
                            className="w-full text-right border border-slate-300 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-slate-800">
                          {formatCurrency(item.lineTotal)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleEditRemoveItem(index)}
                            disabled={editLineItems.length === 1}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold border-t border-slate-200">
                    <tr>
                      <td colSpan={5} className="p-2 text-right text-slate-600">
                        Total Estimated Amount:
                      </td>
                      <td className="p-2 text-right font-mono text-sky-700 text-sm">
                        {formatCurrency(
                          editLineItems.reduce((acc, curr) => acc + (curr.lineTotal || 0), 0)
                        )}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Business Justification
                </label>
                <textarea
                  value={editJustification}
                  onChange={(e) => setEditJustification(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Remarks / Special Instructions
                </label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditReq(null)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editMutation.isPending}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded font-semibold text-xs"
              >
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* PRINT REQUISITION VOUCHER MODAL */}
      <ModalDialog
        isOpen={!!printReq}
        onClose={() => setPrintReq(null)}
        title={`Print Voucher: ${printReq?.requisitionNumber}`}
        subtitle="Official Purchase Requisition Document for Physical Archival & Multi-level Signatures"
        maxWidth="4xl"
      >
        {printReq && (
          <div className="space-y-4 text-xs">
            {/* Printable Document Sheet */}
            <div className="bg-white p-6 border border-slate-200 rounded shadow-sm text-slate-800 space-y-4 print:p-0 print:border-none">
              {/* Organization Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3.5">
                  <img
                    src="/logo.png"
                    alt="BridgeOne Logo"
                    className="h-10 w-auto object-contain"
                  />
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-wide uppercase">
                      BridgeOne Technologies Ltd.
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Plot 18, Road 11, Gulshan-2, Dhaka-1212, Bangladesh
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Phone: +880 2 988-1234 | Web: erp.bridgeone.com
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-2.5 py-1 bg-slate-100 rounded text-[11px] font-bold text-slate-700 border border-slate-300">
                    PURCHASE REQUISITION
                  </div>
                  <p className="text-xs font-mono font-bold text-sky-800 mt-1">
                    {printReq.requisitionNumber}
                  </p>
                  <p className="text-[10px] text-slate-500">Date: {printReq.requestDate}</p>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/80 p-3 rounded border border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Department:</span>
                  <span className="font-semibold text-slate-800">{printReq.department}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Requester / Buyer:</span>
                  <span className="font-semibold text-slate-800">{printReq.requesterName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Delivery Office:</span>
                  <span className="font-semibold text-slate-800">
                    {offices?.find((o) => o.id === printReq.officeId)?.name || printReq.officeId}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Required Delivery:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {printReq.requiredDeliveryDate || "Immediate"}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2 w-10 text-center">SL</th>
                      <th className="p-2 w-28">Item Code</th>
                      <th className="p-2">Description / Specifications</th>
                      <th className="p-2 w-20 text-center">UOM</th>
                      <th className="p-2 w-20 text-right">Quantity</th>
                      <th className="p-2 w-28 text-right">Est. Unit Price</th>
                      <th className="p-2 w-32 text-right">Total (BDT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {printReq.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2 font-mono text-slate-600">{it.itemCode}</td>
                        <td className="p-2 font-medium text-slate-800">{it.itemName}</td>
                        <td className="p-2 text-center font-mono text-slate-600">{it.uom}</td>
                        <td className="p-2 text-right font-mono font-semibold">{it.quantity}</td>
                        <td className="p-2 text-right font-mono">
                          {formatCurrency(it.estimatedUnitPrice)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(it.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/80 font-semibold border-t border-slate-200">
                    <tr>
                      <td colSpan={6} className="p-2 text-right text-slate-700 uppercase text-[11px]">
                        Grand Total Estimated Value:
                      </td>
                      <td className="p-2 text-right font-mono text-sm font-bold text-slate-900">
                        {formatCurrency(printReq.totalEstimatedAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Justification & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50/60 p-2.5 rounded border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-700 block">Justification:</span>
                  <p className="text-slate-600 italic">
                    {printReq.businessJustification || "Standard replenishment."}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 block">Remarks:</span>
                  <p className="text-slate-600 italic">{printReq.remarks || "N/A"}</p>
                </div>
              </div>

              {/* 4 Official Authorization Signatures */}
              <div className="grid grid-cols-4 gap-4 pt-12 text-center text-[10px] text-slate-600 border-t border-slate-200 mt-6">
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    {printReq.createdBy}
                  </div>
                  <span>Prepared By</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Department Head
                  </div>
                  <span>Verified By</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Procurement Manager
                  </div>
                  <span>Checked & Sourced</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Managing Director
                  </div>
                  <span>Final Approval</span>
                </div>
              </div>
            </div>

            {/* Print & Close Toolbar */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPrintReq(null)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-semibold text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* CLOSE / CANCEL REQUISITION MODAL */}
      <ModalDialog
        isOpen={!!closeModal}
        onClose={() => setCloseModal(null)}
        title={`Close Requisition: ${closeModal?.requisitionNumber}`}
        subtitle="Terminate active requisition lifecycle with an audited reason"
        maxWidth="md"
      >
        {closeModal && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-700">
              Are you sure you want to <strong>Close / Cancel</strong> requisition{" "}
              <strong className="text-rose-700 font-mono">{closeModal.requisitionNumber}</strong>?
            </p>
            <p className="text-[11px] text-slate-500">
              This action terminates the approval process and stops any subsequent Purchase Order
              creation.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Reason for Closure / Cancellation *
              </label>
              <textarea
                value={closeComment}
                onChange={(e) => setCloseComment(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 rounded p-2 text-xs"
                placeholder="Enter cancellation reason..."
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCloseModal(null)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
              >
                Back
              </button>
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  cancelMutation.mutate({
                    id: closeModal.id,
                    comments: closeComment || "Cancelled by user via Action toolbar",
                  });
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded"
              >
                {cancelMutation.isPending ? "Closing..." : "Confirm Close"}
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* REVERSE REQUISITION STATUS MODAL */}
      <ModalDialog
        isOpen={!!reverseModal}
        onClose={() => setReverseModal(null)}
        title={`Reverse Status: ${reverseModal?.requisitionNumber}`}
        subtitle="Revert approved or finalized requisition back to Submitted for revision"
        maxWidth="md"
      >
        {reverseModal && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-700">
              You are about to reverse requisition{" "}
              <strong className="text-amber-700 font-mono">{reverseModal.requisitionNumber}</strong>{" "}
              (Current Status: <strong>{reverseModal.status}</strong>).
            </p>
            <p className="text-[11px] text-slate-500">
              The status will be reset back to <strong>SUBMITTED</strong>, allowing procurement
              managers to re-evaluate prices, change item quantities, or request revisions.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Revision / Reversal Comments *
              </label>
              <textarea
                value={reverseComment}
                onChange={(e) => setReverseComment(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 rounded p-2 text-xs"
                placeholder="Enter reason for reverting status..."
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setReverseModal(null)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
              >
                Back
              </button>
              <button
                type="button"
                disabled={reverseMutation.isPending}
                onClick={() => {
                  reverseMutation.mutate({
                    id: reverseModal.id,
                    comments: reverseComment || "Reversed for revision",
                  });
                }}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded"
              >
                {reverseMutation.isPending ? "Reversing..." : "Confirm Reversal"}
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
