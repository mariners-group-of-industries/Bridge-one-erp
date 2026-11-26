"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Eye,
  X,
  Trash2,
  History,
  Pencil,
  Printer,
  PlusCircle,
  Search,
  Check,
  Ban,
  Upload,
  Info,
} from "lucide-react";
import { PURCHASE_QUERY_KEYS, downloadCsv, localToday, uploadPurchaseBulk } from "@/features/purchase/lib/client";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { usePurchasePermissions } from "@/features/purchase/lib/usePurchasePermissions";

type ReqStatus = PurchaseRequisition["status"];
const AWAITING_APPROVAL: ReqStatus[] = ["DRAFT", "SUBMITTED", "PENDING_APPROVAL"];
/** What each requisition status allows (mirrors requisitionTransition / requisitionEditable on the server). */
const can = {
  approve: (s: ReqStatus) => AWAITING_APPROVAL.includes(s),
  edit: (s: ReqStatus) => AWAITING_APPROVAL.includes(s) || s === "REJECTED",
  cancel: (s: ReqStatus) => AWAITING_APPROVAL.includes(s) || s === "APPROVED" || s === "REJECTED",
  // As in the reference ERP: only an approved (or rejected) requisition is reversed; a closed one is not.
  reverse: (s: ReqStatus) => s === "APPROVED" || s === "REJECTED",
};
const actionBtn =
  "inline-flex size-6 items-center justify-center rounded transition-colors disabled:opacity-30 disabled:pointer-events-none hover:bg-control text-ink-muted hover:text-ink";
import { DataTable } from "@/components/purchase/DataTable";
import { StatusBadge } from "@/components/purchase/StatusBadge";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { ConfirmPrompt } from "@/components/purchase/ConfirmPrompt";
import {
  PrintablePurchaseDoc,
  PurchasePrintToolbar,
  fmtPrintDate,
  fmtPrintNum,
  type PrintHeaderContext,
} from "@/components/purchase/PrintablePurchaseDoc";
import { toast } from "@/components/purchase/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { PurchaseFormOptions } from "@/features/purchase/components/PurchaseFormShared";
import {
  PurchaseRequisition,
  Office,
  Warehouse,
  Item,
  CreateRequisitionInput,
} from "@bridgeone/contracts";
import { NativeDateInput } from "@/components/ui/date-input";

export default function PurchaseRequisitionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const perms = usePurchasePermissions();

  // Tab state (supporting direct URL / tab param)
  const [activeTab, setActiveTab] = useState<"PURCHASE_REQUISITION" | "REQUISITION_SUMMARY">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("tab") === "summary") return "REQUISITION_SUMMARY";
    }
    return "PURCHASE_REQUISITION";
  });
  const [summaryViewMode, setSummaryViewMode] = useState<"ITEM_WISE" | "DEPARTMENT_WISE">("ITEM_WISE");

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
  const [selectedInventoryType, setSelectedInventoryType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedBuyerOffice, setSelectedBuyerOffice] = useState("ALL");
  const [summaryCategory, setSummaryCategory] = useState("ALL");
  const [summarySubCategory, setSummarySubCategory] = useState("ALL");
  const [isRemainingDetails, setIsRemainingDetails] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [viewReq, setViewReq] = useState<PurchaseRequisition | null>(null);
  const [viewReqTab, setViewReqTab] = useState<"ITEM_LIST" | "APPROVAL_STATUS">("ITEM_LIST");
  const [selectedViewItems, setSelectedViewItems] = useState<string[]>([]);
  const [stockModalItem, setStockModalItem] = useState<{
    itemId: string;
    itemCode: string;
    itemName: string;
    uom: string;
  } | null>(null);
  const [printReq, setPrintReq] = useState<PurchaseRequisition | null>(null);
  const [closeModal, setCloseModal] = useState<PurchaseRequisition | null>(null);
  const [newPrFrom, setNewPrFrom] = useState<PurchaseRequisition | null>(null);
  const [reverseModal, setReverseModal] = useState<PurchaseRequisition | null>(null);
  const [templateNotification, setTemplateNotification] = useState<string | null>(null);

  // Approval modal state (for view details or quick review)
  const [approvalModal, setApprovalModal] = useState<{
    req: PurchaseRequisition;
    action: "APPROVE" | "REJECT" | "CANCEL";
  } | null>(null);
  const [approvalComment, setApprovalComment] = useState("");

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
  // Every warehouse, for the edit / duplicate dialogs (filtered by the office chosen there).
  const { data: allWarehouses } = useQuery<Warehouse[]>({
    queryKey: ["warehouses", "ALL"],
    queryFn: () => fetchApi("/master/warehouses"),
  });

  // Dynamically filter warehouses in-memory according to the selected Office.
  // When no office is selected (ALL), no warehouses should be available/selectable.
  const isOfficeSelected = Boolean(selectedOffice && selectedOffice !== "ALL");

  const filteredWarehouses = useMemo(() => {
    if (!isOfficeSelected) return [];
    const list = allWarehouses ?? warehouses ?? [];
    return list.filter((w) => w.officeId === selectedOffice);
  }, [allWarehouses, warehouses, selectedOffice, isOfficeSelected]);

  // When office filter changes, update office and reset warehouse filter to ALL
  const handleOfficeChange = (newOffice: string) => {
    setSelectedOffice(newOffice);
    setSelectedWarehouse("ALL");
  };

  // If no office is selected or selected warehouse is not valid for chosen office, treat as ALL
  const effectiveWarehouse = useMemo(() => {
    if (!isOfficeSelected || selectedWarehouse === "ALL") return "ALL";
    if (filteredWarehouses.length > 0 && !filteredWarehouses.some((w) => w.id === selectedWarehouse)) {
      return "ALL";
    }
    return selectedWarehouse;
  }, [isOfficeSelected, selectedWarehouse, filteredWarehouses]);
  const { data: itemsCatalog } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: () => fetchApi("/master/items"),
  });
  const { data: context } = useQuery<PrintHeaderContext>({ queryKey: ["context"], queryFn: () => fetchApi("/master/context") });
  // Departments come from Configuration › Employee profiles (same list the requisition form uses).
  const { data: formOptions } = useQuery<PurchaseFormOptions>({
    queryKey: ["purchase-form-options"],
    queryFn: () => fetchApi("/master/purchase-form-options"),
  });

  const { data: stockOnHandRows = [] } = useQuery<{ warehouseId: string; itemId: string; qty: number }[]>({
    queryKey: ["inventory-stock-on-hand"],
    queryFn: () => fetchApi("/inventory/stock"),
    enabled: !!viewReq,
  });

  // Requisitions query with full ERP filters
  const { data: requisitions, isLoading, isFetching, refetch } = useQuery<PurchaseRequisition[]>({
    queryKey: [
      "requisitions",
      selectedOffice,
      effectiveWarehouse,
      selectedStatus,
      selectedRequestType,
      selectedSection,
      search,
      fromDate,
      toDate,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedOffice !== "ALL") params.append("officeId", selectedOffice);
      if (effectiveWarehouse !== "ALL") params.append("warehouseId", effectiveWarehouse);
      if (selectedStatus !== "ALL") params.append("status", selectedStatus);
      if (selectedRequestType !== "ALL") params.append("requestType", selectedRequestType);
      if (selectedSection !== "ALL") params.append("section", selectedSection);
      if (search) params.append("search", search);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      return fetchApi(`/purchase/requisitions?${params.toString()}`);
    },
  });

  // "New PR from this one" form state (filled from the source requisition when the dialog opens)
  const [formOfficeId, setFormOfficeId] = useState("");
  const [formWarehouseId, setFormWarehouseId] = useState("");
  const [formRequestType] = useState<"LOCAL" | "IMPORT" | "INTER_BRANCH" | "URGENT">("LOCAL");
  const [formDepartment, setFormDepartment] = useState("");
  const [formRequester, setFormRequester] = useState("");
  const [formPurchaseMethod, setFormPurchaseMethod] = useState<"DIRECT" | "QUOTATION" | "TENDER" | "CONTRACT">("DIRECT");
  const [formDeliveryDate, setFormDeliveryDate] = useState(localToday);
  const [formJustification, setFormJustification] = useState("");
  const [formRemarks] = useState("");
  const [formLineItems, setFormLineItems] = useState<
    { itemId: string; itemCode: string; itemName: string; uom: string; quantity: number; estimatedUnitPrice: number; lineTotal: number; remarks: string }[]
  >([]);

  // Default office with warehouses for Quick Requisition
  const defaultFormOfficeId = useMemo(() => {
    if (!offices?.length) return "";
    const withWh = offices.find((o) => (allWarehouses ?? []).some((w) => w.officeId === o.id));
    return withWh?.id || offices[0]?.id || "";
  }, [offices, allWarehouses]);

  const activeFormOfficeId = formOfficeId || defaultFormOfficeId;
  const activeFormWarehouseId =
    formWarehouseId || (allWarehouses?.find((w) => w.officeId === activeFormOfficeId)?.id ?? "");

  const invalidateAll = () => {
    for (const key of PURCHASE_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateRequisitionInput) =>
      fetchApi("/purchase/requisitions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      invalidateAll();
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
      invalidateAll();
      setApprovalModal(null);
      setApprovalComment("");
      if (viewReq) setViewReq(null);
      const done: Record<string, string> = { APPROVE: "approved", REJECT: "rejected" };
      toast.success(`Requisition ${done[variables.action] ?? "updated"} successfully.`, {
        title: "Status Updated",
      });
    },
    onError: (err: any) => {
      toast.error(`Action failed: ${err.message}`, {
        title: "Action Failed",
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
      invalidateAll();
      setReverseModal(null);
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
      invalidateAll();
      setCloseModal(null);
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

  // Duplicate existing Requisition to create a New PR quickly
  const handleDuplicateAsNew = (req: PurchaseRequisition) => {
    router.push(`/purchase/requisitions/create?fromId=${req.id}`);
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
      officeId: activeFormOfficeId,
      warehouseId: activeFormWarehouseId,
      requestType: formRequestType,
      department: formDepartment,
      requesterName: formRequester,
      purchaseMethod: formPurchaseMethod,
      requestDate: localToday(),
      requiredDeliveryDate: formDeliveryDate,
      businessJustification: formJustification,
      remarks: formRemarks,
      items: formLineItems,
    });
  };

  const openApproval = (req: PurchaseRequisition, action: "APPROVE" | "REJECT") => {
    setApprovalComment("");
    setApprovalModal({ req, action });
  };

  const officeName = (id: string) => offices?.find((o) => o.id === id)?.name ?? "";
  const warehouseName = (id: string) => allWarehouses?.find((w) => w.id === id)?.name ?? warehouses?.find((w) => w.id === id)?.name ?? "";

  // Export CSV: exactly the rows on screen (all filters applied).
  const handleExport = () => {
    const rows = requisitions ?? [];
    if (!rows.length) {
      toast.info("No requisitions to export.");
      return;
    }
    downloadCsv(
      `purchase_requisitions_${localToday()}.csv`,
      [
        "SL",
        "Requisition Code",
        "Reference Document",
        "Date",
        "Office",
        "Warehouse",
        "Buyer Office",
        "Request Type",
        "Employee/Department/Project",
        "Section",
        "Buyer Name",
        "Method",
        "Budget",
        "Created By",
        "Status",
        "Remarks",
        "Review Comment",
      ],
      rows.map((r, i) => [
        i + 1,
        r.requisitionNumber,
        r.referenceDocument ?? "",
        r.requestDate,
        officeName(r.officeId),
        warehouseName(r.warehouseId),
        officeName(r.officeId),
        r.requestType,
        r.requesterName,
        r.department,
        r.requesterName,
        r.purchaseMethod,
        r.totalEstimatedAmount,
        r.createdBy,
        r.status,
        r.remarks ?? "",
        r.approvalHistory?.[r.approvalHistory.length - 1]?.comments ?? "",
      ]),
    );
  };

  // Section filter: the departments configured on employee profiles, plus any older ones still on requisitions.
  const sectionOptions = React.useMemo(
    () =>
      [...new Set([...(formOptions?.employees ?? []).map((e) => e.department), ...(requisitions ?? []).map((r) => r.department), selectedSection])]
        .filter((s) => s && s !== "ALL")
        .sort(),
    [formOptions, requisitions, selectedSection],
  );

  // Table Columns (Exact columns as in Managerium screenshots)
  const formatTableDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const formatRequestType = (type?: string) => {
    if (!type) return "department";
    const lower = type.toLowerCase();
    if (lower === "local" || lower === "department") return "department";
    if (lower === "employee") return "Employee";
    if (lower === "project") return "Project";
    return lower;
  };

  const formatMethod = (method?: string) => {
    if (!method || method === "DIRECT" || method === "PURCHASE_ORDER") return "Purchase Order Method";
    const label = method.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return label.endsWith("Method") ? label : `${label} Method`;
  };

  // Status as a small pill with a dot (DESIGN.md semantic colours).
  const renderStatus = (status: string) => {
    const pill = (label: string, tone: string, dot: string) => (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>
        <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
        {label}
      </span>
    );
    switch (status) {
      case "PENDING_APPROVAL":
      case "SUBMITTED":
      case "DRAFT":
        return pill("Pending", "bg-amber-500/10 text-amber-700 dark:text-amber-300", "bg-amber-500");
      case "APPROVED":
        return pill("Approved", "bg-blue-500/10 text-blue-700 dark:text-blue-300", "bg-blue-600");
      case "CONVERTED_TO_PO":
        return pill("Ordered", "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", "bg-emerald-600");
      case "REJECTED":
        return pill("Rejected", "bg-rose-500/10 text-rose-700 dark:text-rose-300", "bg-rose-600");
      case "CANCELLED":
      case "CLOSED":
        return pill("Closed", "bg-slate-500/10 text-slate-600 dark:text-slate-300", "bg-slate-400");
      default:
        return pill(status, "bg-slate-500/10 text-ink-muted", "bg-slate-400");
    }
  };

  const columns = [
    {
      header: "SL",
      className: "w-7 text-center font-mono text-[11px] text-ink-faint",
      cell: (_: any, idx: number) => idx + 1,
    },
    {
      header: "Actions",
      className: "w-[125px] min-w-[125px] text-center whitespace-nowrap",
      cell: (row: PurchaseRequisition) => (
        <div className="flex items-center justify-center gap-0.5 text-ink-muted">
          {/* Edit */}
          <button
            type="button"
            disabled={!can.edit(row.status) || !perms.requisitions.edit}
            onClick={() => router.push(`/purchase/requisitions/edit/${row.id}`)}
            className={`${actionBtn} hover:bg-hover/80 hover:text-ink`}
            title={
              !perms.requisitions.edit
                ? "Requires Edit permission in Configuration"
                : can.edit(row.status)
                  ? "Edit requisition"
                  : "Approved, ordered or cancelled requisitions cannot be edited; reverse it first"
            }
            aria-label={`Edit ${row.requisitionNumber}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {/* Print */}
          <button
            type="button"
            onClick={() => setPrintReq(row)}
            className={`${actionBtn} hover:bg-hover/80 hover:text-ink`}
            title="Print requisition voucher"
            aria-label={`Print ${row.requisitionNumber}`}
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Close / Cancel */}
          <button
            type="button"
            disabled={!can.cancel(row.status) || !perms.requisitions.delete}
            onClick={() => {
              setCloseModal(row);
            }}
            className={`${actionBtn} hover:bg-rose-100 dark:hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-rose-300`}
            title={!perms.requisitions.delete ? "Requires Delete permission in Configuration" : "Close / cancel requisition"}
            aria-label={`Cancel ${row.requisitionNumber}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Reverse / Audit History */}
          <button
            type="button"
            disabled={!can.reverse(row.status) || !perms.requisitions.edit}
            onClick={() => {
              setReverseModal(row);
            }}
            className={`${actionBtn} hover:bg-amber-100 dark:hover:bg-amber-500/15 hover:text-amber-800 dark:hover:text-amber-300`}
            title={!perms.requisitions.edit ? "Requires Edit permission in Configuration" : "Reverse to submitted"}
            aria-label={`Reverse ${row.requisitionNumber}`}
          >
            <History className="w-3.5 h-3.5" />
          </button>

          {/* New PR (Duplicate / Template) */}
          <button
            type="button"
            disabled={!perms.requisitions.create}
            onClick={() => setNewPrFrom(row)}
            className={`${actionBtn} hover:bg-sky-100 dark:hover:bg-sky-500/15 hover:text-sky-700 dark:hover:text-sky-300`}
            title={!perms.requisitions.create ? "Requires Create permission in Configuration" : "New PR (Duplicate from Template)"}
            aria-label={`New requisition from ${row.requisitionNumber}`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
          </button>

          {/* View Requisition */}
          <button
            type="button"
            onClick={() => {
              setViewReqTab("ITEM_LIST");
              setSelectedViewItems([]);
              setViewReq(row);
            }}
            className={`${actionBtn} hover:bg-hover/80 hover:text-ink`}
            title="View requisition details"
            aria-label={`View ${row.requisitionNumber}`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
    {
      header: "Requisition Code",
      className: "whitespace-nowrap font-mono font-semibold text-sky-700 dark:text-sky-300 text-left",
      cell: (row: PurchaseRequisition) => (
        <span className="font-semibold text-sky-700 dark:text-sky-300 font-mono">{row.requisitionNumber}</span>
      ),
    },
    {
      header: "Date",
      className: "whitespace-nowrap font-mono text-center text-[11px]",
      cell: (row: PurchaseRequisition) => (
        <span className="whitespace-nowrap">{formatTableDate(row.requestDate)}</span>
      ),
    },
    {
      header: "Office",
      className: "text-left leading-tight",
      cell: (row: PurchaseRequisition) => <span>{officeName(row.officeId) || "—"}</span>,
    },
    {
      header: "Warehouse",
      className: "text-left leading-tight",
      cell: (row: PurchaseRequisition) => <span>{warehouseName(row.warehouseId) || "—"}</span>,
    },
    {
      header: "Buyer Office",
      className: "text-left leading-tight",
      cell: (row: PurchaseRequisition) => <span>{officeName(row.officeId) || "—"}</span>,
    },
    {
      header: "Request Type",
      className: "text-center leading-tight",
      cell: (row: PurchaseRequisition) => <span>{formatRequestType(row.requestType)}</span>,
    },
    {
      header: "Inventory Type",
      className: "text-left leading-tight whitespace-nowrap",
      cell: () => <span>Inventory Item</span>,
    },
    {
      header: "Employee/Department/Project",
      className: "text-left leading-tight max-w-[150px]",
      cell: (row: PurchaseRequisition) => <span>{row.requesterName || row.department || ""}</span>,
    },
    {
      header: "Section",
      className: "text-center leading-tight",
      cell: (row: PurchaseRequisition) => <span>{row.section || row.department || ""}</span>,
    },
    {
      header: "Buyer Name",
      className: "text-left leading-tight",
      cell: (row: PurchaseRequisition) => <span>{row.requesterName || ""}</span>,
    },
    {
      header: "Method",
      className: "text-left leading-tight",
      cell: (row: PurchaseRequisition) => <span>{formatMethod(row.purchaseMethod)}</span>,
    },
    {
      header: "Budget",
      className: "text-right whitespace-nowrap font-mono font-semibold",
      cell: (row: PurchaseRequisition) => (
        <span className="font-mono font-semibold text-ink">
          {(row.totalEstimatedAmount || 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      header: "Created By",
      className: "text-left leading-tight",
      cell: (row: PurchaseRequisition) => <span>{row.createdBy || row.requesterName || ""}</span>,
    },
    {
      header: "Status",
      className: "text-center whitespace-nowrap",
      cell: (row: PurchaseRequisition) => renderStatus(row.status),
    },
    {
      header: "Remarks",
      className: "text-left leading-tight min-w-[140px]",
      cell: (row: PurchaseRequisition) => <span>{row.remarks || ""}</span>,
    },
    {
      header: "Review Comment",
      className: "text-left leading-tight min-w-[140px]",
      cell: (row: PurchaseRequisition) => {
        const lastComment = [...(row.approvalHistory ?? [])].reverse().find((h) => h.comments)?.comments;
        return <span>{lastComment || ""}</span>;
      },
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
      .map((it) => {
        const cat = itemsCatalog?.find((c) => c.id === it.itemId || c.code === it.itemCode);
        return {
          ...it,
          category: cat?.category || "General",
          subCategory: cat?.subCategory || "",
          deptList: Array.from(it.departments).join(", "),
          reqList: Array.from(it.reqNumbers).join(", "),
        };
      })
      .filter((it) => {
        if (summaryCategory !== "ALL" && it.category !== summaryCategory) return false;
        if (summarySubCategory !== "ALL" && it.subCategory !== summarySubCategory) return false;
        if (isRemainingDetails && it.totalBalanceQty <= 0) return false;
        return true;
      })
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [requisitions, itemsCatalog, summaryCategory, summarySubCategory, isRemainingDetails]);

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
    <div className="flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden font-sans bg-surface p-3 space-y-2.5">
      {/* 1. TOP HEADER */}
      <div className="shrink-0 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-ink tracking-tight">
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
                className="w-56 sm:w-64 h-8 pl-3 pr-8 text-xs border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-surface placeholder:text-ink-faint"
              />
              <Search className="w-3.5 h-3.5 text-ink-faint absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {perms.requisitions.import && (
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="h-8 px-3 border border-line-strong rounded text-ink-muted hover:bg-canvas font-medium text-xs inline-flex items-center gap-1.5 transition"
                title="Bulk upload requisitions from an Excel file"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Bulk Upload</span>
              </button>
            )}
            {perms.requisitions.create && (
              <button
                type="button"
                onClick={() => router.push("/purchase/requisitions/create")}
                className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Requisition</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs (PURCHASE REQUISITION | REQUISITION SUMMARY) */}
        <div className="flex items-center gap-6 border-b border-line pt-1">
          <button
            type="button"
            onClick={() => handleTabChange("PURCHASE_REQUISITION")}
            className={`pb-2 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase ${activeTab === "PURCHASE_REQUISITION"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]"
              : "text-ink-faint hover:text-ink"
              }`}
          >
            <span>PURCHASE REQUISITION</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("REQUISITION_SUMMARY")}
            className={`pb-2 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase ${activeTab === "REQUISITION_SUMMARY"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]"
              : "text-ink-faint hover:text-ink"
              }`}
          >
            <span>REQUISITION SUMMARY</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PURCHASE REQUISITION */}
      {activeTab === "PURCHASE_REQUISITION" && (
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          <div className="shrink-0 py-1.5">
          {/* Row 1: Office | Warehouse | Request Type | Section | Inventory Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-2.5">
            {/* 1. Office */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                Office
              </label>
              <select
                value={selectedOffice}
                onChange={(e) => handleOfficeChange(e.target.value)}
                className="w-full h-8 border border-line-strong rounded px-2.5 py-1 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                Warehouse
              </label>
              <select
                value={effectiveWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                disabled={!isOfficeSelected}
                className="w-full h-8 border border-line-strong rounded px-2.5 py-1 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed disabled:border-line"
              >
                <option value="ALL">Warehouse</option>
                {filteredWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Request Type */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                Request Type
              </label>
              <select
                value={selectedRequestType}
                onChange={(e) => setSelectedRequestType(e.target.value)}
                className="w-full h-8 border border-line-strong rounded px-2.5 py-1 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                Section
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full h-8 border border-line-strong rounded px-2.5 py-1 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">Section</option>
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Inventory Type */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                Inventory Type
              </label>
              <div className="relative">
                <select
                  value={selectedInventoryType}
                  onChange={(e) => setSelectedInventoryType(e.target.value)}
                  className="w-full h-8 border border-line-strong rounded px-2.5 pr-7 py-1 text-xs text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ALL">All</option>
                  <option value="Inventory Item">Inventory Item</option>
                </select>
                {selectedInventoryType !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setSelectedInventoryType("ALL")}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                    aria-label="Clear inventory type"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: From Date | To Date | Status | Buyer Office | View & EXCEL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
            {/* 1. From Date */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                From Date
              </label>
              <NativeDateInput
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full h-8 border border-line-strong rounded px-2.5 py-1 text-xs text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 2. To Date */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                To Date
              </label>
              <NativeDateInput
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full h-8 border border-line-strong rounded px-2.5 py-1 text-xs text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 3. Status */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-8 border border-line-strong rounded px-2.5 py-1 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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

            {/* 4. Buyer Office */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                Buyer Office
              </label>
              <select
                value={selectedBuyerOffice}
                onChange={(e) => {
                  setSelectedBuyerOffice(e.target.value);
                }}
                className="w-full h-8 border border-line-strong rounded px-2.5 py-1 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">Buyer Office</option>
                {offices?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Action Buttons (View & EXCEL) */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-70 text-white font-semibold text-xs rounded shadow-2xs transition flex items-center justify-center gap-1.5"
              >
                {isFetching && <Spinner className="size-3.5" />}
                View
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={!perms.requisitions.export}
                title={!perms.requisitions.export ? "Requires Export permission in Configuration" : "Export Excel (CSV)"}
                className="h-8 px-4 border border-[#2563eb] text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-40 disabled:pointer-events-none font-semibold text-xs uppercase rounded shadow-2xs transition flex items-center justify-center"
              >
                EXCEL
              </button>
              {(selectedOffice !== "ALL" ||
                selectedWarehouse !== "ALL" ||
                selectedRequestType !== "ALL" ||
                selectedSection !== "ALL" ||
                selectedInventoryType !== "ALL" ||
                selectedStatus !== "ALL" ||
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
                      setSelectedInventoryType("ALL");
                      setSelectedStatus("ALL");
                      setSelectedBuyerOffice("ALL");
                      setFromDate("");
                      setToDate("");
                      setSearch("");
                    }}
                    className="h-8 px-2 text-xs text-ink-faint hover:text-ink underline transition"
                    title="Reset Filters"
                  >
                    Clear
                  </button>
                )}
            </div>
          </div>
        </div>

        {/* Requisitions Data Table (Only Table Scrolls) */}
        <div className="flex-1 min-h-0">
          <DataTable
            columns={columns}
            data={requisitions || []}
            loading={isLoading}
            pageSize={50}
            emptyMessage="No requisitions found matching the selected criteria."
            compact
          />
        </div>
      </div>
    )}

    {/* TAB 2: REQUISITION SUMMARY */}
    {activeTab === "REQUISITION_SUMMARY" && (
      <div className="flex-1 min-h-0 flex flex-col space-y-2.5">
        <div className="shrink-0 bg-surface rounded border border-line/90 p-4 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-3.5">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">Office</label>
              <select
                value={selectedOffice}
                onChange={(e) => handleOfficeChange(e.target.value)}
                className="w-full h-9 border border-line-strong rounded px-2.5 py-1.5 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All</option>
                {offices?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">Warehouse</label>
              <select
                value={effectiveWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                disabled={!isOfficeSelected}
                className="w-full h-9 border border-line-strong rounded px-2.5 py-1.5 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed disabled:border-line"
              >
                <option value="ALL">All</option>
                {filteredWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">From Date</label>
              <NativeDateInput
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full h-9 border border-line-strong rounded px-2.5 py-1.5 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">To Date</label>
              <NativeDateInput
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full h-9 border border-line-strong rounded px-2.5 py-1.5 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">Category</label>
              <select
                value={summaryCategory}
                onChange={(e) => {
                  setSummaryCategory(e.target.value);
                  setSummarySubCategory("ALL");
                }}
                className="w-full h-9 border border-line-strong rounded px-2.5 py-1.5 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All</option>
                {Array.from(new Set((itemsCatalog ?? []).map((i) => i.category).filter(Boolean))).sort().map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-end">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">Sub Category</label>
              <select
                value={summarySubCategory}
                onChange={(e) => setSummarySubCategory(e.target.value)}
                className="w-full h-9 border border-line-strong rounded px-2.5 py-1.5 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All</option>
                {Array.from(
                  new Set(
                    (itemsCatalog ?? [])
                      .filter((i) => summaryCategory === "ALL" || i.category === summaryCategory)
                      .map((i) => i.subCategory || "")
                      .filter(Boolean)
                  )
                )
                  .sort()
                  .map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">Buyer Office</label>
              <select
                value={selectedBuyerOffice}
                onChange={(e) => {
                  setSelectedBuyerOffice(e.target.value);
                }}
                className="w-full h-9 border border-line-strong rounded px-2.5 py-1.5 text-xs text-ink-muted bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Buyer Office</option>
                {offices?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex h-9 cursor-pointer items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={isRemainingDetails}
                onChange={(e) => setIsRemainingDetails(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong text-blue-600 dark:text-blue-400"
              />
              <span>Is Remaining Details</span>
            </label>
            <div className="flex items-center gap-3 lg:col-span-2">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-9 px-6 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-70 text-white font-bold text-xs uppercase rounded shadow-xs transition flex items-center justify-center gap-1.5 min-w-[70px]"
              >
                {isFetching && <Spinner className="size-3.5" />}
                View
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={!perms.requisitions.export}
                title={!perms.requisitions.export ? "Requires Export permission in Configuration" : "Export Excel (CSV)"}
                className="h-9 px-5 border border-[#2563eb] text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-40 disabled:pointer-events-none font-bold text-xs uppercase rounded shadow-xs transition flex items-center justify-center min-w-[75px]"
              >
                EXCEL
              </button>
            </div>
          </div>
        </div>

        {/* Requisition Summary View (Scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface rounded border border-line/90 p-4 shadow-2xs">
              <span className="text-xs font-semibold text-ink-faint uppercase">Total Requisitions</span>
              <p className="text-2xl font-bold font-mono text-ink mt-1">{totalSummaryMetrics.count}</p>
              <span className="text-[11px] text-ink-faint">All matching filter criteria</span>
            </div>

            <div className="bg-surface rounded border border-line/90 p-4 shadow-2xs">
              <span className="text-xs font-semibold text-ink-faint uppercase">Estimated Budget</span>
              <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-300 mt-1">
                {formatCurrency(totalSummaryMetrics.amount)}
              </p>
              <span className="text-[11px] text-ink-faint">Total estimated outlay</span>
            </div>

            <div className="bg-surface rounded border border-line/90 p-4 shadow-2xs">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">Pending Approval</span>
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">{totalSummaryMetrics.pending}</p>
              <span className="text-[11px] text-ink-faint">Awaiting management verification</span>
            </div>

            <div className="bg-surface rounded border border-line/90 p-4 shadow-2xs">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Approved / In-PO</span>
              <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {totalSummaryMetrics.approved + totalSummaryMetrics.converted}
              </p>
              <span className="text-[11px] text-ink-faint">Converted or cleared for PO</span>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 rounded-t-md">
            <button
              type="button"
              onClick={() => setSummaryViewMode("ITEM_WISE")}
              className={`px-3 py-1.5 text-xs font-bold rounded transition ${summaryViewMode === "ITEM_WISE"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-control text-ink-muted hover:bg-hover"
                }`}
            >
              Item-Wise Summary ({itemWiseSummary.length} Items)
            </button>
            <button
              type="button"
              onClick={() => setSummaryViewMode("DEPARTMENT_WISE")}
              className={`px-3 py-1.5 text-xs font-bold rounded transition ${summaryViewMode === "DEPARTMENT_WISE"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-control text-ink-muted hover:bg-hover"
                }`}
            >
              Department / Section Matrix ({departmentSummary.length} Departments)
            </button>
          </div>

          {summaryViewMode === "ITEM_WISE" ? (
            /* Item-Wise Requisition Summary Table */
            <div className="bg-surface rounded border border-line/90 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-line bg-canvas flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-ink text-sm">Item-Wise Requisition Summary</h3>
                  <p className="text-xs text-ink-faint">
                    Aggregated material demand, approved quantities, PO converted volume, and remaining balances
                  </p>
                </div>
                <span className="text-xs font-semibold text-ink-muted font-mono">
                  {itemWiseSummary.length} Unique Items
                </span>
              </div>

              <div className="erp-table-container">
                <table className="erp-table erp-table-compact">
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
                        <td colSpan={12} className="text-center py-8 text-ink-faint">
                          No requisition items found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      itemWiseSummary.map((it, idx) => (
                        <tr key={it.itemId || idx} className="hover:bg-canvas transition-colors">
                          <td className="text-center font-mono text-ink-faint">{idx + 1}</td>
                          <td className="font-mono font-semibold text-blue-700 dark:text-blue-300">{it.itemCode}</td>
                          <td className="font-semibold text-ink">{it.itemName}</td>
                          <td className="text-xs text-ink-muted max-w-[140px] truncate" title={it.deptList}>
                            {it.deptList}
                          </td>
                          <td className="font-mono text-xs text-ink-faint max-w-[150px] truncate" title={it.reqList}>
                            {it.reqList}
                          </td>
                          <td className="text-center text-ink-muted font-medium">{it.uom}</td>
                          <td className="text-center font-mono font-bold text-ink">{it.totalReqQty}</td>
                          <td className="text-center font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {it.totalApprovedQty}
                          </td>
                          <td className="text-center font-mono font-medium text-blue-600 dark:text-blue-400">{it.totalPOQty}</td>
                          <td className="text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                            {it.totalBalanceQty}
                          </td>
                          <td className="text-right font-mono text-ink-muted">
                            {formatCurrency(it.unitPrice)}
                          </td>
                          <td className="text-right font-mono font-bold text-ink">
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
            <div className="bg-surface rounded border border-line/90 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-line bg-canvas flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-ink text-sm">Department / Section Requisition Summary</h3>
                  <p className="text-xs text-ink-faint">Breakdown of requests, total expenditure and approval status</p>
                </div>
                <span className="text-xs font-medium text-ink-faint font-mono">
                  {departmentSummary.length} Departments Active
                </span>
              </div>

              <div className="erp-table-container">
                <table className="erp-table erp-table-compact">
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
                        <td colSpan={10} className="text-center py-8 text-ink-faint">
                          No summary records found.
                        </td>
                      </tr>
                    ) : (
                      departmentSummary.map((d, idx) => (
                        <tr key={d.department} className="hover:bg-canvas transition-colors">
                          <td className="text-center font-mono text-ink-faint">{idx + 1}</td>
                          <td className="font-semibold text-ink">{d.department}</td>
                          <td className="text-center font-mono font-medium">{d.totalCount}</td>
                          <td className="text-right font-mono font-bold text-ink">
                            {formatCurrency(d.totalAmount)}
                          </td>
                          <td className="text-center font-mono text-sky-600 dark:text-sky-400">{d.submitted}</td>
                          <td className="text-center font-mono text-amber-600 dark:text-amber-400">{d.pending}</td>
                          <td className="text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{d.approved}</td>
                          <td className="text-center font-mono text-blue-600 dark:text-blue-400 font-semibold">{d.converted}</td>
                          <td className="text-center font-mono text-rose-500">{d.rejected}</td>
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSection(d.department);
                                handleTabChange("PURCHASE_REQUISITION");
                              }}
                              className="px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-semibold"
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
            <div className="flex items-center justify-between px-3 py-2 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 text-sky-800 dark:text-sky-300 rounded text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                <PlusCircle className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>{templateNotification}</span>
              </div>
              <button
                type="button"
                onClick={() => setTemplateNotification(null)}
                className="text-sky-500 hover:text-sky-700 dark:hover:text-sky-300 font-bold"
              >
                ✕
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-canvas p-3 rounded border border-line text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                Office / Branch *
              </label>
              <select
                value={activeFormOfficeId}
                onChange={(e) => {
                  setFormOfficeId(e.target.value);
                  setFormWarehouseId(allWarehouses?.find((w) => w.officeId === e.target.value)?.id ?? "");
                }}
                className="w-full border border-line-strong rounded px-2 py-1.5 bg-surface text-xs"
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
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                Authorized Delivery Warehouse *
              </label>
              <select
                value={activeFormWarehouseId}
                onChange={(e) => setFormWarehouseId(e.target.value)}
                disabled={!activeFormOfficeId}
                className="w-full border border-line-strong rounded px-2 py-1.5 bg-surface text-xs disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
                required
              >
                <option value="">
                  {!activeFormOfficeId
                    ? "Select Office first"
                    : allWarehouses?.filter((w) => w.officeId === activeFormOfficeId).length === 0
                      ? "No warehouse for this office"
                      : "Select warehouse"}
                </option>
                {allWarehouses?.filter((w) => w.officeId === activeFormOfficeId).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                Required Delivery Date *
              </label>
              <NativeDateInput
                type="date"
                value={formDeliveryDate}
                onChange={(e) => setFormDeliveryDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2 py-1.5 bg-surface text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                Requesting Department *
              </label>
              <input
                type="text"
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
                className="w-full border border-line-strong rounded px-2 py-1.5 bg-surface text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                Requester Name *
              </label>
              <input
                type="text"
                value={formRequester}
                onChange={(e) => setFormRequester(e.target.value)}
                className="w-full border border-line-strong rounded px-2 py-1.5 bg-surface text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                Purchase Method
              </label>
              <select
                value={formPurchaseMethod}
                onChange={(e) => setFormPurchaseMethod(e.target.value as any)}
                className="w-full border border-line-strong rounded px-2 py-1.5 bg-surface text-xs"
              >
                <option value="DIRECT">Direct Purchase</option>
                <option value="QUOTATION">Quotation / RFP</option>
                <option value="TENDER">Public Tender</option>
                <option value="CONTRACT">Rate Contract</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                Business Justification *
              </label>
              <textarea
                value={formJustification}
                onChange={(e) => setFormJustification(e.target.value)}
                rows={2}
                className="w-full border border-line-strong rounded p-2 text-xs bg-surface"
                placeholder="Explain why this purchase is needed..."
                required
              />
            </div>
          </div>

          {/* Requested Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wide">
                Requested Line Items
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="border border-line rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-control text-ink-muted font-semibold text-[11px]">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 w-20">UOM</th>
                    <th className="p-2 w-24">Qty</th>
                    <th className="p-2 w-32">Est. Unit Price</th>
                    <th className="p-2 w-32 text-right">Line Amount</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {formLineItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-canvas">
                      <td className="p-2">
                        <select
                          value={item.itemId}
                          onChange={(e) => handleItemChange(idx, e.target.value)}
                          className="w-full border border-line rounded p-1 text-xs"
                        >
                          {itemsCatalog?.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.code} - {it.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-ink-faint font-mono text-[11px]">{item.uom}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                          className="w-full border border-line rounded p-1 text-xs text-center font-mono"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          value={item.estimatedUnitPrice}
                          onChange={(e) => handlePriceChange(idx, Number(e.target.value))}
                          className="w-full border border-line rounded p-1 text-xs text-right font-mono"
                          required
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-ink">
                        {formatCurrency(item.lineTotal)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-ink-faint hover:text-rose-600 dark:hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-canvas font-bold border-t border-line">
                  <tr>
                    <td colSpan={4} className="p-2 text-right text-ink-muted">
                      Total Estimated Budget:
                    </td>
                    <td className="p-2 text-right font-mono text-sm text-sky-700 dark:text-sky-300">
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
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3 py-1.5 border border-line rounded text-xs text-ink-muted hover:bg-control"
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
        title="View Requisition"
        maxWidth="4xl"
      >
        {viewReq && (() => {
          const approveEntry = [...(viewReq.approvalHistory ?? [])].reverse().find((h) => h.action === "APPROVED");
          const lastReviewComment = [...(viewReq.approvalHistory ?? [])].reverse().find((h) => h.comments)?.comments;
          const fmtStamp = (iso?: string) => {
            if (!iso) return "N/A";
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return iso;
            const datePart = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
            return `${datePart} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
          };
          const fmtNum = (n: number) =>
            (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

          return (
            <div className="space-y-4 text-xs">
              {/* 2-Column Header Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 bg-surface p-4 rounded border border-line shadow-2xs">
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Requisition No</span>
                    <span className="text-ink-faint">:</span>
                    <span className="font-semibold text-ink font-mono">{viewReq.requisitionNumber}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Department</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink">{viewReq.department || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Buyer Name</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink">{viewReq.requesterName || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Buyer Office</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink">{officeName(viewReq.officeId) || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Office</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink">{officeName(viewReq.officeId) || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Purchase Method</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink">{formatMethod(viewReq.purchaseMethod)}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Remarks</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink">{viewReq.remarks || viewReq.businessJustification || "N/A"}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Request Date</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink font-mono">{formatTableDate(viewReq.requestDate)}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Expected Date</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink font-mono">{formatTableDate(viewReq.requiredDeliveryDate)}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Create Date Time</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink font-mono">{fmtStamp(viewReq.createdAt)}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Created By</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink">{viewReq.createdBy || viewReq.requesterName || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Approve Date Time</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink font-mono">{approveEntry ? fmtStamp(approveEntry.timestamp) : "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Approved By</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink">{approveEntry?.actorName || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[130px_10px_1fr] items-center">
                    <span className="text-ink-muted font-medium">Review Comment</span>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink">{lastReviewComment || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Tabs: ITEM LIST | APPROVAL STATUS */}
              <div className="flex items-center gap-6 border-b border-line">
                <button
                  type="button"
                  onClick={() => setViewReqTab("ITEM_LIST")}
                  className={`pb-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                    viewReqTab === "ITEM_LIST"
                      ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]"
                      : "text-ink-faint hover:text-ink"
                  }`}
                >
                  ITEM LIST
                </button>
                <button
                  type="button"
                  onClick={() => setViewReqTab("APPROVAL_STATUS")}
                  className={`pb-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                    viewReqTab === "APPROVAL_STATUS"
                      ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]"
                      : "text-ink-faint hover:text-ink"
                  }`}
                >
                  APPROVAL STATUS
                </button>
              </div>

              {viewReqTab === "ITEM_LIST" ? (
                <div className="space-y-2">
                  {selectedViewItems.length > 0 && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const itemsParam = encodeURIComponent(selectedViewItems.join(","));
                          setViewReq(null);
                          router.push(`/purchase/orders/create?requisitionId=${viewReq.id}&items=${itemsParam}`);
                        }}
                        className="px-3 py-1 text-xs font-medium text-primary border border-primary rounded hover:bg-primary/10 transition-colors"
                      >
                        ({selectedViewItems.length}) Add To Purchase Order (Local)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const itemsParam = encodeURIComponent(selectedViewItems.join(","));
                          setViewReq(null);
                          router.push(`/purchase/orders/create?requisitionId=${viewReq.id}&type=FOREIGN&items=${itemsParam}`);
                        }}
                        className="px-3 py-1 text-xs font-medium text-primary border border-primary rounded hover:bg-primary/10 transition-colors"
                      >
                        ({selectedViewItems.length}) Add To Purchase Order (Foreign)
                      </button>
                    </div>
                  )}
                  <div className="border border-grid-line rounded overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-grid-head text-grid-head-ink font-semibold text-[11px] border-b border-grid-head-line">
                          <th className="px-2.5 py-2 border-r border-grid-head-line w-8 text-center">
                            <input
                              type="checkbox"
                              className="size-3.5 cursor-pointer accent-primary"
                              aria-label="Select all items"
                              checked={
                                viewReq.items.length > 0 &&
                                viewReq.items.every((it) => selectedViewItems.includes(it.itemId))
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedViewItems(viewReq.items.map((it) => it.itemId));
                                } else {
                                  setSelectedViewItems([]);
                                }
                              }}
                            />
                          </th>
                          <th className="px-2.5 py-2 border-r border-grid-head-line whitespace-nowrap">Code</th>
                          <th className="px-2.5 py-2 border-r border-grid-head-line min-w-[160px]">Item</th>
                          <th className="px-2.5 py-2 border-r border-grid-head-line whitespace-nowrap">UoM</th>
                          <th className="px-2.5 py-2 border-r border-grid-head-line min-w-[160px]">Description</th>
                          <th className="px-2.5 py-2 border-r border-grid-head-line text-right whitespace-nowrap">Requested Quantity</th>
                          <th className="px-2.5 py-2 border-r border-grid-head-line text-right whitespace-nowrap">Rate</th>
                          <th className="px-2.5 py-2 border-r border-grid-head-line text-right whitespace-nowrap">Total</th>
                          <th className="px-2.5 py-2 border-r border-grid-head-line text-right whitespace-nowrap">Current Stock</th>
                          <th className="px-2.5 py-2 text-right whitespace-nowrap">Shortage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewReq.items.map((it, idx) => {
                          const currentStock = stockOnHandRows
                            .filter((s) => s.itemId === it.itemId)
                            .reduce((sum, s) => sum + Number(s.qty || 0), 0);
                          const shortage = Math.max(0, Number(it.quantity || 0) - currentStock);
                          const isChecked = selectedViewItems.includes(it.itemId);
                          return (
                            <tr key={idx} className="border-b border-grid-line hover:bg-grid-hover">
                              <td className="px-2.5 py-1.5 border-r border-grid-line text-center">
                                <input
                                  type="checkbox"
                                  className="size-3.5 cursor-pointer accent-primary"
                                  aria-label={`Select ${it.itemCode}`}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedViewItems((prev) =>
                                        prev.includes(it.itemId) ? prev : [...prev, it.itemId]
                                      );
                                    } else {
                                      setSelectedViewItems((prev) => prev.filter((id) => id !== it.itemId));
                                    }
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-1.5 border-r border-grid-line font-mono text-ink-muted whitespace-nowrap">
                                {it.itemCode}
                              </td>
                              <td className="px-2.5 py-1.5 border-r border-grid-line font-medium text-ink">{it.itemName}</td>
                              <td className="px-2.5 py-1.5 border-r border-grid-line text-ink-muted whitespace-nowrap">{it.uom}</td>
                              <td className="px-2.5 py-1.5 border-r border-grid-line text-ink-muted">{it.remarks || ""}</td>
                              <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmtNum(it.quantity)}</td>
                              <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">
                                <span className="inline-flex items-center justify-end gap-1">
                                  <span>{fmtNum(it.estimatedUnitPrice)}</span>
                                  <Info className="w-3.5 h-3.5 text-ink-muted" />
                                </span>
                              </td>
                              <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">{fmtNum(it.lineTotal)}</td>
                              <td className="px-2.5 py-1.5 border-r border-grid-line text-right font-mono">
                                <span className="inline-flex items-center justify-end gap-1">
                                  <span>{fmtNum(currentStock)}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setStockModalItem({
                                        itemId: it.itemId,
                                        itemCode: it.itemCode,
                                        itemName: it.itemName,
                                        uom: it.uom,
                                      })
                                    }
                                    className="text-ink-muted hover:text-primary transition-colors"
                                    title="View Warehouse Stock"
                                    aria-label={`View warehouse stock for ${it.itemCode}`}
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono">{fmtNum(shortage)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-surface font-semibold">
                          <td colSpan={7} className="px-2.5 py-2 text-right border-r border-grid-line text-ink">
                            Budget
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono border-r border-grid-line text-ink">
                            {fmtNum(viewReq.totalEstimatedAmount)}
                          </td>
                          <td colSpan={2} className="px-2.5 py-2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="border border-grid-line rounded overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-grid-head text-grid-head-ink font-semibold text-[11px] border-b border-grid-head-line">
                        <th className="px-3 py-2 border-r border-grid-head-line w-10 text-center">SL</th>
                        <th className="px-3 py-2 border-r border-grid-head-line">Stage Name</th>
                        <th className="px-3 py-2 border-r border-grid-head-line">Approver Name</th>
                        <th className="px-3 py-2 border-r border-grid-head-line">Order Type</th>
                        <th className="px-3 py-2 border-r border-grid-head-line">Status</th>
                        <th className="px-3 py-2 border-r border-grid-head-line">Comment</th>
                        <th className="px-3 py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewReq.approvalHistory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-ink-muted">
                            No approval history recorded yet.
                          </td>
                        </tr>
                      ) : (
                        viewReq.approvalHistory.map((h, i) => {
                          const upperAction = h.action.toUpperCase();
                          const statusText = upperAction.includes("REJECT")
                            ? "Rejected"
                            : upperAction.includes("APPROVE")
                              ? "Approved"
                              : "Pending";
                          const statusColor =
                            statusText === "Approved"
                              ? "text-emerald-600 dark:text-emerald-400 font-medium"
                              : statusText === "Rejected"
                                ? "text-rose-600 dark:text-rose-400 font-medium"
                                : "text-amber-600 dark:text-amber-400 font-medium";
                          return (
                            <tr key={i} className="border-b border-grid-line">
                              <td className="px-3 py-2 border-r border-grid-line text-center">{i + 1}</td>
                              <td className="px-3 py-2 border-r border-grid-line text-ink">Purchase Requisition</td>
                              <td className="px-3 py-2 border-r border-grid-line text-ink">{h.actorName}</td>
                              <td className="px-3 py-2 border-r border-grid-line text-ink-muted">Any_Person</td>
                              <td className={`px-3 py-2 border-r border-grid-line ${statusColor}`}>{statusText}</td>
                              <td className="px-3 py-2 border-r border-grid-line text-ink-muted">{h.comments || "N/A"}</td>
                              <td className="px-3 py-2 font-mono text-ink-muted">
                                {statusText === "Pending" ? "N/A" : fmtStamp(h.timestamp)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {viewReq.referenceDocument && (
                <p className="text-ink-muted">
                  Purchase order: <span className="font-mono font-semibold text-sky-700 dark:text-sky-300">{viewReq.referenceDocument}</span>
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-2 print:hidden">
                <button
                  type="button"
                  onClick={() => setViewReq(null)}
                  className="h-8 px-4 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded font-bold uppercase text-xs"
                >
                  CLOSE
                </button>
              </div>
            </div>
          );
        })()}
      </ModalDialog>

      {/* VIEW WAREHOUSE STOCK MODAL */}
      <ModalDialog
        isOpen={!!stockModalItem}
        onClose={() => setStockModalItem(null)}
        title="View Warehouse Stock"
        maxWidth="2xl"
      >
        {stockModalItem && viewReq && (() => {
          const itemStocks = (stockOnHandRows ?? []).filter((s) => s.itemId === stockModalItem.itemId);
          const fromRows = itemStocks
            .map((s) => {
              const wh = allWarehouses?.find((w) => w.id === s.warehouseId);
              return { officeId: wh?.officeId ?? "", officeName: officeName(wh?.officeId ?? ""), warehouseName: wh?.name ?? "Warehouse", qty: s.qty };
            })
            .filter((r) => r.officeId === viewReq.officeId);
          const toRows = itemStocks
            .map((s) => {
              const wh = allWarehouses?.find((w) => w.id === s.warehouseId);
              return { officeId: wh?.officeId ?? "", officeName: officeName(wh?.officeId ?? ""), warehouseName: wh?.name ?? "Warehouse", qty: s.qty };
            })
            .filter((r) => r.officeId !== viewReq.officeId);

          return (
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="text-sm font-medium text-ink mb-2">From Office</h4>
                <div className="border border-grid-line rounded overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-grid-head text-grid-head-ink font-semibold text-[11px] border-b border-grid-head-line">
                        <th className="px-3 py-2 border-r border-grid-head-line w-12">SL</th>
                        <th className="px-3 py-2 border-r border-grid-head-line">Office Name</th>
                        <th className="px-3 py-2 border-r border-grid-head-line">Warehouse</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fromRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-3 text-center text-ink-muted">No stock in this office.</td>
                        </tr>
                      ) : (
                        fromRows.map((r, idx) => (
                          <tr key={idx} className="border-b border-grid-line">
                            <td className="px-3 py-1.5 border-r border-grid-line">{idx + 1}</td>
                            <td className="px-3 py-1.5 border-r border-grid-line">{r.officeName}</td>
                            <td className="px-3 py-1.5 border-r border-grid-line">{r.warehouseName}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{r.qty}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-ink mb-2">To Office</h4>
                <div className="border border-grid-line rounded overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-grid-head text-grid-head-ink font-semibold text-[11px] border-b border-grid-head-line">
                        <th className="px-3 py-2 border-r border-grid-head-line w-12">SL</th>
                        <th className="px-3 py-2 border-r border-grid-head-line">Office Name</th>
                        <th className="px-3 py-2 border-r border-grid-head-line">Warehouse</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-3 text-center text-ink-muted">No stock in other offices.</td>
                        </tr>
                      ) : (
                        toRows.map((r, idx) => (
                          <tr key={idx} className="border-b border-grid-line">
                            <td className="px-3 py-1.5 border-r border-grid-line">{idx + 1}</td>
                            <td className="px-3 py-1.5 border-r border-grid-line">{r.officeName}</td>
                            <td className="px-3 py-1.5 border-r border-grid-line">{r.warehouseName}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{r.qty}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setStockModalItem(null)}
                  className="h-8 px-4 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded font-bold uppercase text-xs"
                >
                  CLOSE
                </button>
              </div>
            </div>
          );
        })()}
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
          <p className="text-ink-muted">
            Are you sure you want to <strong>{approvalModal?.action}</strong> requisition{" "}
            <strong>{approvalModal?.req.requisitionNumber}</strong> for amount{" "}
            <strong>{formatCurrency(approvalModal?.req.totalEstimatedAmount ?? 0)}</strong>?
          </p>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
              Comments / Reason
            </label>
            <textarea
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              rows={2}
              className="w-full border border-line-strong rounded p-2 text-xs"
              placeholder="Enter approval or rejection comments..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setApprovalModal(null)}
              className="px-3 py-1.5 border border-line rounded text-ink-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={approvalMutation.isPending}
              onClick={() => {
                if (!approvalModal) return;
                if (approvalModal.action === "REJECT" && !approvalComment.trim()) {
                  toast.error("Give a reason for rejecting the requisition.", { title: "Reason Required" });
                  return;
                }
                approvalMutation.mutate({
                  id: approvalModal.req.id,
                  action: approvalModal.action,
                  comments: approvalComment,
                });
              }}
              className={`px-4 py-1.5 rounded text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 ${approvalModal?.action === "APPROVE"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-rose-600 hover:bg-rose-700"
                }`}
            >
              {approvalMutation.isPending && <Spinner className="size-3.5" />}
              Confirm {approvalModal?.action}
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* PRINT REQUISITION VOUCHER MODAL */}
      <ModalDialog
        isOpen={!!printReq}
        onClose={() => setPrintReq(null)}
        title={`Print Voucher: ${printReq?.requisitionNumber}`}
        subtitle="Official Purchase Requisition Document for Physical Archival & Multi-level Signatures"
        maxWidth="4xl"
      >
        {printReq && (() => {
          const officeName = offices?.find((o) => o.id === printReq.officeId)?.name || printReq.officeId;
          const warehouseName = allWarehouses?.find((w) => w.id === printReq.warehouseId)?.name || printReq.warehouseId || "-";
          const approvedEntry = [...(printReq.approvalHistory || [])].reverse().find((h) => /approv/i.test(h.action));
          const totalQty = printReq.items.reduce((s, it) => s + Number(it.quantity || 0), 0);
          const totalIssued = printReq.status === "CONVERTED_TO_PO" ? totalQty : 0;
          return (
            <div className="space-y-4 text-xs">
              <PrintablePurchaseDoc
                context={context}
                officeId={printReq.officeId}
                officeName={officeName}
                title="Purchase Requisition"
                metaLeft={[
                  ["Requisition No", printReq.requisitionNumber],
                  ["Req. Office Name", officeName],
                  ["Req. Warehouse Name", warehouseName],
                  ["Remarks", printReq.remarks || ""],
                ]}
                metaRight={[
                  ["Req. Date", fmtPrintDate(printReq.requestDate)],
                  ["Expected Date", fmtPrintDate(printReq.requiredDeliveryDate || printReq.requestDate)],
                  ["Production Order No", printReq.referenceDocument || "Direct"],
                  ["Review Comment", approvedEntry?.comments || ""],
                ]}
                columns={[
                  { header: "SL", align: "center", widthClass: "w-10" },
                  { header: "Item Code/Model", align: "left", widthClass: "w-28" },
                  { header: "Item Name", align: "left" },
                  { header: "Item Description", align: "left" },
                  { header: "UOM", align: "center", widthClass: "w-14" },
                  { header: "Req. Qty", align: "right", widthClass: "w-24" },
                  { header: "Issue Qty", align: "right", widthClass: "w-24" },
                  { header: "Remain Qty", align: "right", widthClass: "w-24" },
                ]}
                // A requisition is ordered as a whole: once converted to a PO its full quantity is issued.
                rows={printReq.items.map((it, idx) => {
                  const issued = printReq.status === "CONVERTED_TO_PO" ? Number(it.quantity || 0) : 0;
                  return [
                    idx + 1,
                    it.itemCode,
                    it.itemName,
                    it.remarks || "",
                    it.uom || "PCS",
                    fmtPrintNum(it.quantity),
                    fmtPrintNum(issued),
                    fmtPrintNum(Number(it.quantity || 0) - issued),
                  ];
                })}
                totalRows={[["", "", "", "", "Total", fmtPrintNum(totalQty), fmtPrintNum(totalIssued), fmtPrintNum(totalQty - totalIssued)]]}
                signatures={[
                  { roleLabel: "Prepared By", name: printReq.requesterName || printReq.createdBy },
                  { roleLabel: "Approved By", name: approvedEntry?.actorName },
                  { roleLabel: "Received By" },
                ]}
              />
              <PurchasePrintToolbar
                pdfUrl={`/api/v1/purchase/requisitions/${encodeURIComponent(printReq.id)}/pdf`}
                onClose={() => setPrintReq(null)}
                canExportPdf={perms.requisitions.export}
              />
            </div>
          );
        })()}
      </ModalDialog>

      {/* CLOSE / REVERSE / NEW PR: simple confirmations, as in the reference ERP */}
      <ConfirmPrompt
        open={!!closeModal}
        question="Do you want to close?"
        pending={cancelMutation.isPending}
        onNo={() => setCloseModal(null)}
        onYes={() => closeModal && cancelMutation.mutate({ id: closeModal.id, comments: "Closed from the requisition list" })}
      />
      <ConfirmPrompt
        open={!!reverseModal}
        question="Do you want to reverse?"
        pending={reverseMutation.isPending}
        onNo={() => setReverseModal(null)}
        onYes={() => reverseModal && reverseMutation.mutate({ id: reverseModal.id, comments: "Reversed from the requisition list" })}
      />
      <ConfirmPrompt
        open={!!newPrFrom}
        question="Do you want to create a new purchase requisition?"
        onNo={() => setNewPrFrom(null)}
        onYes={() => {
          if (newPrFrom) handleDuplicateAsNew(newPrFrom);
          setNewPrFrom(null);
        }}
      />
      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={invalidateAll}
        noun="requisitions"
        templateUrl="/api/v1/purchase/requisitions/import"
        maxRows={2000}
        matchHint="Office and Warehouse must match existing names; Item Code must match an active item. Rows with the same Ref are saved as one requisition."
        upload={(file) => uploadPurchaseBulk("/api/v1/purchase/requisitions/import", file)}
      />
    </div>
  );
}
