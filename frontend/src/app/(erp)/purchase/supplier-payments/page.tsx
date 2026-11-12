"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Printer,
  FileText,
  Search,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  Truck,
  CheckCircle2,
  Calendar,
  Ban,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { AdvancePaymentModal } from "@/features/purchase/components/AdvancePaymentModal";
import { toast } from "@/components/purchase/Toast";
import { Spinner } from "@/components/ui/spinner";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { PURCHASE_QUERY_KEYS, downloadCsv, localToday } from "@/features/purchase/lib/client";
import {
  SupplierPaymentRecord,
  SupplierInvoiceItem,
} from "@bridgeone/contracts";

const formatNum = (num: number) => {
  if (Math.abs(num) < 0.0001) return "0.00";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// ============================================================================
// DATA SET 1: DUE LIST (LOCAL) - 34 ROWS MATCHING SCREENSHOT 1
// ============================================================================
interface DueListRow {
  sl: number;
  /** Supplier id, needed to post a payment. */
  supplierId: string;
  /** Set when paying one receipt or bill. */
  receiptId?: string;
  billId?: string;
  supplierCode: string;
  supplierName: string;
  mobileNumber: string;
  totalAmount: number;
  returnAmount: number;
  paymentAmount: number;
  dueAmount: number;
}

export interface PendingBillRow {
  sl: number;
  billId: string;
  supplierId: string;
  receiptId?: string;
  billNo: string;
  billDate: string;
  supplierCode: string;
  supplierName: string;
  poNumber: string;
  grnNumber: string;
  billType: "Local" | "Foreign";
  currency: string;
  grossAmount: number;
  taxVat: number;
  netPayable: number;
  dueDate: string;
  status: "Pending" | "Approved" | "In_Review" | "In_Progress";
}

interface PaidRow {
  id: string;
  sl: number;
  paidDate: string;
  invoiceNo: string;
  supplier: string;
  moneyReceiptNo: string;
  bankAmount: number;
  cashAmount: number;
  paidAmount: number;
}

interface PaymentHistoryRow {
  id: string;
  number: string;
  paymentDate: string;
  supplierName: string;
  settles: string;
  method: string;
  referenceNumber: string;
  amount: number;
}

interface AdvanceApiRow {
  supplierName: string;
  advanceAmount: number;
  adjustAmount: number;
  remainingAdvance: number;
}

interface DueInvoiceRow {
  sl: number;
  receDate: string;
  invoice: string;
  supplierName: string;
  creditDays: number;
  exPaymentDate: string;
  totalAmount: number;
  netAmount: number;
  dueAmount: number;
}

interface AdvanceRow {
  sl: number;
  supplierName: string;
  advanceAmount: number;
  adjustAmount: number;
  remainingAdvance: number;
}

interface LedgerReconRow {
  sl: number;
  supplierCode: string;
  supplierName: string;
  supplierGroup: string;
  purchasePaymentDue: number;
  ledger: number;
  difference: number;
}


export default function SupplierPaymentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 6 Tabs state
  const [activeTab, setActiveTab] = useState<
    | "DUE_LIST_LOCAL"
    | "PENDING_BILLS"
    | "PAID_GRN_BILL"
    | "DUE_INVOICES"
    | "PAYMENT_ADVANCE"
    | "SUPPLIER_PURCHASE_VS_LEDGER"
  >("DUE_LIST_LOCAL");

  // Global search input
  const [searchTerm, setSearchTerm] = useState("");

  // Tab 1 filters
  const [tab1FromDate, setTab1FromDate] = useState("");
  const [tab1ToDate, setTab1ToDate] = useState("");

  // Tab 2 filter
  const [pendingBillFilter, setPendingBillFilter] = useState("Pending");

  // Tab 3 filters
  const [tab3Supplier, setTab3Supplier] = useState("");
  const [tab3FromDate, setTab3FromDate] = useState("");
  const [tab3ToDate, setTab3ToDate] = useState("");

  // Tab 4 filters
  const [tab4FromDate, setTab4FromDate] = useState("09/10/2026");
  const [tab4ToDate, setTab4ToDate] = useState("10/11/2026");

  // Tab 5 filters
  const [tab5Supplier, setTab5Supplier] = useState("");
  const [tab5FromDate, setTab5FromDate] = useState("09/10/2026");
  const [tab5ToDate, setTab5ToDate] = useState("10/11/2026");
  const [tab5DetailsCheck, setTab5DetailsCheck] = useState(false);

  // Pagination states
  const [rowsPerPage1, setRowsPerPage1] = useState(50);
  const [rowsPerPage3, setRowsPerPage3] = useState(50);
  const [rowsPerPage4, setRowsPerPage4] = useState(50);
  const [rowsPerPage6, setRowsPerPage6] = useState(50);

  // Tab 6 filters
  const [tab6FromDate, setTab6FromDate] = useState("09/10/2026");
  const [tab6ToDate, setTab6ToDate] = useState("10/11/2026");

  // Modals state
  const [isPaymentByGRNOpen, setIsPaymentByGRNOpen] = useState(false);
  const [isAdvancePaymentOpen, setIsAdvancePaymentOpen] = useState(false);
  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false);

  // Quick Pay Modal
  const [quickPayTarget, setQuickPayTarget] = useState<DueListRow | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState<number>(0);
  const [quickPayMode, setQuickPayMode] = useState<"CASH" | "BANK_TRANSFER" | "CHEQUE" | "EFT">("BANK_TRANSFER");
  const [quickPayBank, setQuickPayBank] = useState("Dutch-Bangla Bank PLC (Corporate)");
  const [quickPayRef, setQuickPayRef] = useState("");

  // View / Print Voucher from Tab 3
  const [viewPaidVoucher, setViewPaidVoucher] = useState<PaidRow | null>(null);
  const [printPaidVoucher, setPrintPaidVoucher] = useState<PaidRow | null>(null);

  // Advance Payment Modal inputs
  const [advSupplier, setAdvSupplier] = useState("");
  const [advAmount, setAdvAmount] = useState(0);
  const [advDate, setAdvDate] = useState(localToday);
  const [advMode, setAdvMode] = useState<"CASH" | "BANK_TRANSFER" | "CHEQUE">("BANK_TRANSFER");
  const [advRef, setAdvRef] = useState("");
  const [advRemarks, setAdvRemarks] = useState("");

  // Create Bill Modal inputs
  const [billSupplier, setBillSupplier] = useState("");
  const [billReceiptId, setBillReceiptId] = useState("");
  const [billInvoiceNo, setBillInvoiceNo] = useState("");
  const [billAmount, setBillAmount] = useState(0);
  const [billDate, setBillDate] = useState(localToday);
  const [billDueDate, setBillDueDate] = useState(localToday);

  // Payment By GRN inputs
  const [grnPaySupplier, setGrnPaySupplier] = useState("");
  const [grnPayDate, setGrnPayDate] = useState(localToday);
  const [grnPaySelected, setGrnPaySelected] = useState<string[]>([]);

  // Dynamic Data Lists
  // Supplier payables and open receipts come from the server (receipts - returns - payments).
  const { data: serverPayables } = useQuery<SupplierPaymentRecord[]>({
    queryKey: ["supplierPayables"],
    queryFn: () => fetchApi("/purchase/supplier-payments"),
  });
  const { data: serverInvoices } = useQuery<SupplierInvoiceItem[]>({
    queryKey: ["supplierInvoices"],
    queryFn: () => fetchApi("/purchase/supplier-payments/invoices"),
  });
  const dueList = useMemo<DueListRow[]>(
    () =>
      (serverPayables ?? [])
        .filter((p) => p.totalPurchasedAmount > 0 || p.paidAmount > 0)
        .map((p, i) => ({
          sl: i + 1,
          supplierId: p.supplierId,
          supplierCode: p.supplierCode,
          supplierName: p.supplierName,
          mobileNumber: p.mobileNumber ?? "",
          totalAmount: p.totalPurchasedAmount,
          returnAmount: p.returnedAmount,
          paymentAmount: p.paidAmount,
          dueAmount: p.dueAmount,
        })),
    [serverPayables],
  );
  const { data: serverBills } = useQuery<SupplierInvoiceItem[]>({
    queryKey: ["supplierBills"],
    queryFn: () => fetchApi("/purchase/supplier-bills"),
  });
  const { data: serverHistory } = useQuery<PaymentHistoryRow[]>({
    queryKey: ["supplierPaymentHistory"],
    queryFn: () => fetchApi("/purchase/supplier-payments/history"),
  });
  const { data: serverAdvances } = useQuery<AdvanceApiRow[]>({
    queryKey: ["supplierAdvances"],
    queryFn: () => fetchApi("/purchase/supplier-payments/advances"),
  });
  // Booked bills that still have something to pay.
  const pendingBills = useMemo<PendingBillRow[]>(
    () =>
      (serverBills ?? [])
        .filter((b) => b.billStatus !== "CANCELLED" && b.dueAmount > 0)
        .map((b, i) => ({
          sl: i + 1,
          billId: b.billId ?? b.id,
          supplierId: b.supplierId ?? "",
          receiptId: b.receiptId,
          billNo: b.billNumber ?? b.invoiceNumber,
          billDate: b.invoiceDate,
          supplierCode: b.supplierCode ?? "",
          supplierName: b.supplierName,
          poNumber: b.poNumber || "—",
          grnNumber: b.grnNumber ?? "Ad-hoc",
          billType: b.type === "FOREIGN" ? ("Foreign" as const) : ("Local" as const),
          currency: "BDT",
          grossAmount: b.totalAmount,
          taxVat: 0,
          netPayable: b.dueAmount,
          dueDate: b.dueDate,
          status: b.billStatus === "APPROVED" ? ("Approved" as const) : ("Pending" as const),
        })),
    [serverBills],
  );
  const paidList = useMemo<PaidRow[]>(
    () =>
      (serverHistory ?? []).map((p, i) => ({
        id: p.id,
        sl: i + 1,
        paidDate: p.paymentDate,
        invoiceNo: p.settles,
        supplier: p.supplierName,
        moneyReceiptNo: p.referenceNumber || p.number,
        bankAmount: p.method === "CASH" ? 0 : p.amount,
        cashAmount: p.method === "CASH" ? p.amount : 0,
        paidAmount: p.amount,
      })),
    [serverHistory],
  );
  const dueInvoices = useMemo<DueInvoiceRow[]>(
    () =>
      (serverInvoices ?? []).map((inv, i) => ({
        sl: i + 1,
        receDate: inv.invoiceDate,
        invoice: inv.invoiceNumber,
        supplierName: inv.supplierName,
        // Days the supplier gives: bill due date less the invoice / receipt date.
        creditDays: Math.max(0, Math.round((new Date(`${inv.dueDate}T00:00:00Z`).getTime() - new Date(`${inv.invoiceDate}T00:00:00Z`).getTime()) / 86_400_000)),
        exPaymentDate: inv.dueDate,
        totalAmount: inv.totalAmount,
        netAmount: inv.totalAmount,
        dueAmount: inv.dueAmount,
      })),
    [serverInvoices],
  );

  // Posts a supplier payment: lowers the supplier's payable.
  const paymentMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchApi<{ number: string }>("/purchase/supplier-payments", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      refreshPayables();
      setQuickPayTarget(null);
      setIsAdvancePaymentOpen(false);
      toast.success(`Payment ${data.number} posted. Supplier payable updated.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const advanceList = useMemo<AdvanceRow[]>(
    () => (serverAdvances ?? []).map((a, i) => ({ sl: i + 1, supplierName: a.supplierName, advanceAmount: a.advanceAmount, adjustAmount: a.adjustAmount, remainingAdvance: a.remainingAdvance })),
    [serverAdvances],
  );
  // Payable worked out from documents vs the supplier balance stored on each movement.
  const ledgerReconList = useMemo<LedgerReconRow[]>(
    () =>
      (serverPayables ?? [])
        .filter((p) => p.totalPurchasedAmount > 0 || p.paidAmount > 0 || (p.ledgerBalance ?? 0) !== 0)
        .map((p, i) => {
          const due = Math.round((p.totalPurchasedAmount - p.returnedAmount - p.paidAmount) * 100) / 100;
          const ledger = p.ledgerBalance ?? 0;
          return {
            sl: i + 1,
            supplierCode: p.supplierCode,
            supplierName: p.supplierName,
            supplierGroup: p.category === "FOREIGN" ? "Foreign" : "Local",
            purchasePaymentDue: due,
            ledger,
            difference: Math.round((ledger - due) * 100) / 100,
          };
        }),
    [serverPayables],
  );
  const refreshPayables = () => {
    for (const key of PURCHASE_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };
  const [cancelPayment, setCancelPayment] = useState<PaidRow | null>(null);
  const [cancelPaymentReason, setCancelPaymentReason] = useState("");
  const cancelPaymentMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      fetchApi<{ number: string }>(`/purchase/supplier-payments/${id}/cancel`, { method: "POST", body: JSON.stringify({ comments }) }),
    onSuccess: (data) => {
      refreshPayables();
      setCancelPayment(null);
      toast.success(`Payment ${data.number} cancelled; the amount is due to the supplier again.`, { title: "Payment Cancelled" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Cancel Failed" }),
  });
  const billMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchApi<{ number: string }>("/purchase/supplier-bills", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      refreshPayables();
      setIsCreateBillOpen(false);
      setBillReceiptId("");
      setBillInvoiceNo("");
      setBillAmount(0);
      toast.success(`Bill ${data.number} booked. Approve it to release it for payment.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const approveMutation = useMutation({
    mutationFn: (billId: string | null) =>
      fetchApi<{ approved?: number; number?: string }>(billId ? `/purchase/supplier-bills/${billId}/approve` : "/purchase/supplier-bills/approve-pending", { method: "POST", body: "{}" }),
    onSuccess: (data) => {
      refreshPayables();
      toast.success(data.number ? `Bill ${data.number} approved for payment.` : `${data.approved ?? 0} bills approved for payment.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Filtering Tab 1
  const filteredDueList = useMemo(() => {
    return dueList.filter((row) => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        row.supplierCode.toLowerCase().includes(s) ||
        row.supplierName.toLowerCase().includes(s) ||
        row.mobileNumber.toLowerCase().includes(s)
      );
    });
  }, [dueList, searchTerm]);

  // Filtering Tab 2 (Pending Bills)
  const filteredPendingBills = useMemo(() => {
    return pendingBills.filter((bill) => {
      if (pendingBillFilter !== "ALL" && bill.status !== pendingBillFilter) return false;
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        bill.billNo.toLowerCase().includes(s) ||
        bill.supplierName.toLowerCase().includes(s) ||
        bill.poNumber.toLowerCase().includes(s) ||
        bill.grnNumber.toLowerCase().includes(s)
      );
    });
  }, [pendingBills, pendingBillFilter, searchTerm]);

  const handleApproveBill = (billNo: string) => {
    const bill = pendingBills.find((b) => b.billNo === billNo);
    if (bill) approveMutation.mutate(bill.billId);
  };

  const handlePayPendingBill = (bill: PendingBillRow) => {
    setQuickPayTarget({
      sl: 0,
      supplierId: bill.supplierId,
      // A bill against a receipt settles the receipt; an ad-hoc bill settles itself.
      receiptId: bill.receiptId,
      billId: bill.receiptId ? undefined : bill.billId,
      supplierCode: bill.supplierCode,
      supplierName: bill.supplierName,
      mobileNumber: "",
      totalAmount: bill.grossAmount,
      returnAmount: 0,
      paymentAmount: 0,
      dueAmount: bill.netPayable,
    });
    setQuickPayAmount(bill.netPayable);
    setQuickPayRef(bill.billNo);
  };

  // Filtering Tab 3
  const filteredPaidList = useMemo(() => {
    return paidList.filter((row) => {
      if (tab3Supplier && !row.supplier.toLowerCase().includes(tab3Supplier.toLowerCase())) return false;
      if (tab3FromDate && row.paidDate < tab3FromDate) return false;
      if (tab3ToDate && row.paidDate > tab3ToDate) return false;
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        row.invoiceNo.toLowerCase().includes(s) ||
        row.supplier.toLowerCase().includes(s) ||
        row.paidDate.toLowerCase().includes(s)
      );
    });
  }, [paidList, tab3Supplier, tab3FromDate, tab3ToDate, searchTerm]);

  // Filtering Tab 4
  const filteredDueInvoices = useMemo(() => {
    return dueInvoices.filter((row) => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        row.invoice.toLowerCase().includes(s) ||
        row.supplierName.toLowerCase().includes(s)
      );
    });
  }, [dueInvoices, searchTerm]);

  // Filtering Tab 6
  const filteredLedgerReconList = useMemo(() => {
    return ledgerReconList.filter((row) => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        row.supplierCode.toLowerCase().includes(s) ||
        row.supplierName.toLowerCase().includes(s) ||
        row.supplierGroup.toLowerCase().includes(s)
      );
    });
  }, [ledgerReconList, searchTerm]);

  // Totals calculations
  const totalLedgerRecon = useMemo(() => {
    const due = filteredLedgerReconList.reduce((acc, r) => acc + r.purchasePaymentDue, 0);
    const ledger = filteredLedgerReconList.reduce((acc, r) => acc + r.ledger, 0);
    const diff = filteredLedgerReconList.reduce((acc, r) => acc + r.difference, 0);
    return {
      due: due.toFixed(2),
      ledger: ledger.toFixed(2),
      diff: diff.toFixed(2),
    };
  }, [filteredLedgerReconList]);


  // Handlers
  const handleOpenQuickPay = (row: DueListRow) => {
    setQuickPayTarget(row);
    setQuickPayAmount(row.dueAmount);
    setQuickPayRef("");
  };

  const handleConfirmQuickPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayTarget) return;

    if (!quickPayTarget.supplierId) {
      toast.error("This bill is not linked to a supplier yet.");
      return;
    }
    paymentMutation.mutate({
      supplierId: quickPayTarget.supplierId,
      amount: quickPayAmount,
      method: quickPayMode === "CASH" ? "CASH" : quickPayMode === "CHEQUE" ? "CHEQUE" : "BANK",
      paymentDate: localToday(),
      receiptId: quickPayTarget.receiptId,
      billId: quickPayTarget.billId,
      referenceNumber: quickPayRef,
    });
  };

  const handleCreateAdvancePayment = (e: React.FormEvent) => {
    e.preventDefault();
    paymentMutation.mutate({
      supplierId: advSupplier,
      amount: advAmount,
      isAdvance: true,
      method: advMode === "CASH" ? "CASH" : advMode === "CHEQUE" ? "CHEQUE" : "BANK",
      paymentDate: advDate,
      referenceNumber: advRef || undefined,
      narration: advRemarks,
    });
  };

  // Pays each ticked invoice in full (one payment per invoice).
  const grnPayInvoices = (serverInvoices ?? []).filter((inv) => inv.supplierId === grnPaySupplier && inv.dueAmount > 0);
  const handleConfirmGrnPayment = async () => {
    const chosen = grnPayInvoices.filter((inv) => grnPaySelected.includes(inv.id));
    if (!chosen.length) {
      toast.error("Tick at least one invoice to settle.");
      return;
    }
    try {
      for (const inv of chosen) {
        await paymentMutation.mutateAsync({
          supplierId: grnPaySupplier,
          amount: inv.dueAmount,
          paymentDate: grnPayDate,
          receiptId: inv.receiptId,
          billId: inv.receiptId ? undefined : inv.billId,
          referenceNumber: inv.invoiceNumber,
        });
      }
      setIsPaymentByGRNOpen(false);
      setGrnPaySelected([]);
    } catch {
      // paymentMutation already showed the error; the invoices paid so far stay paid.
    }
  };

  const handleCreateBill = () => {
    billMutation.mutate({
      supplierId: billSupplier,
      receiptId: billReceiptId || undefined,
      number: billInvoiceNo,
      amount: billAmount,
      billDate,
      dueDate: billDueDate,
    });
  };
  // Receipts of the chosen supplier that have no bill yet.
  const billableReceipts = (serverInvoices ?? []).filter((inv) => inv.supplierId === billSupplier && inv.receiptId && !inv.billId);

  const handleExportCSV = () => {
    downloadCsv(
      `supplier_payment_report_${localToday()}.csv`,
      ["SL", "Supplier Code", "Supplier Name", "Mobile No", "Total Amount", "Return Amount", "Payment Amount", "Due Amount"],
      filteredDueList.map((r) => [r.sl, r.supplierCode, r.supplierName, r.mobileNumber, r.totalAmount, r.returnAmount, r.paymentAmount, r.dueAmount]),
    );
  };

  return (
    <div className="space-y-2 p-1">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER (Exact Unified Box Layout) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Supplier Payment</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

          {/* + Payment By GRN */}
          <button
            type="button"
            onClick={() => router.push("/purchase/supplier-payments/payment-by-grn")}
            className="h-9 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Payment By GRN</span>
          </button>

          {/* + Advance Payment */}
          <button
            type="button"
            onClick={() => setIsAdvancePaymentOpen(true)}
            className="h-9 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Advance Payment</span>
          </button>

          {/* + Create Bill */}
          <button
            type="button"
            onClick={() => setIsCreateBillOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Bill</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SIX TABS NAVIGATION MATCHING SCREENSHOTS */}
      {/* ------------------------------------------------------------- */}
      <div className="flex border-b border-slate-200 gap-6 text-[11px] font-bold uppercase tracking-wider overflow-x-auto select-none">
        <button
          type="button"
          onClick={() => setActiveTab("DUE_LIST_LOCAL")}
          className={`pb-2 whitespace-nowrap transition ${
            activeTab === "DUE_LIST_LOCAL"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          DUE LIST(LOCAL)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PENDING_BILLS")}
          className={`pb-2 whitespace-nowrap transition ${
            activeTab === "PENDING_BILLS"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          PENDING BILL(LOCAL/FOREIGN)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PAID_GRN_BILL")}
          className={`pb-2 whitespace-nowrap transition ${
            activeTab === "PAID_GRN_BILL"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          PAID GRN/BILL
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DUE_INVOICES")}
          className={`pb-2 whitespace-nowrap transition ${
            activeTab === "DUE_INVOICES"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          DUE INVOICES
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PAYMENT_ADVANCE")}
          className={`pb-2 whitespace-nowrap transition ${
            activeTab === "PAYMENT_ADVANCE"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          PAYMENT ADVANCE
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("SUPPLIER_PURCHASE_VS_LEDGER")}
          className={`pb-2 whitespace-nowrap transition ${
            activeTab === "SUPPLIER_PURCHASE_VS_LEDGER"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          SUPPLIER PURCHASE VS LEDGER BALANCE
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: DUE LIST(LOCAL) (SCREENSHOT 1) */}
      {/* ============================================================= */}
      {activeTab === "DUE_LIST_LOCAL" && (
        <div className="space-y-2">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-end gap-3 text-xs bg-slate-50/50 p-2 rounded border border-slate-200">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">From Date</label>
              <input
                type="text"
                placeholder="mm/dd/yyyy"
                value={tab1FromDate}
                onChange={(e) => setTab1FromDate(e.target.value)}
                className="w-36 border border-slate-300 rounded px-2 py-1 bg-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">To Date</label>
              <input
                type="text"
                placeholder="mm/dd/yyyy"
                value={tab1ToDate}
                onChange={(e) => setTab1ToDate(e.target.value)}
                className="w-36 border border-slate-300 rounded px-2 py-1 bg-white text-xs"
              />
            </div>
            <button
              type="button"
              className="px-4 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold rounded text-xs transition"
            >
              View
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-1.5 border border-[#1976d2] text-[#1976d2] hover:bg-blue-50 font-bold rounded text-xs transition"
            >
              Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 px-4 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold rounded text-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>

          {/* Table Container with All Borders */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-12 text-center">Action</th>
                  <th className="p-2 border border-slate-300 w-32">Supplier Code</th>
                  <th className="p-2 border border-slate-300">Supplier Name</th>
                  <th className="p-2 border border-slate-300 w-32">Mobile No.</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Total Amount</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">Return Amount</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Payment Amount</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Due Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredDueList.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-1 border border-slate-300 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenQuickPay(row)}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 font-bold text-xs inline-flex items-center justify-center border border-slate-300 transition"
                        title="Make Payment to Supplier"
                      >
                        $
                      </button>
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-700 whitespace-nowrap">
                      {row.supplierCode}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-900 font-medium">
                      {row.supplierName}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-600 whitespace-nowrap">
                      {row.mobileNumber}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-800 whitespace-nowrap">
                      {formatCurrency(row.totalAmount)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-500 whitespace-nowrap">
                      {formatCurrency(row.returnAmount)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-800 whitespace-nowrap">
                      {formatCurrency(row.paymentAmount)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(row.dueAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold text-xs border-t-2 border-slate-300 text-slate-900">
                  <td colSpan={5} className="p-2 border border-slate-300 text-left">
                    Total :
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                    {formatCurrency(filteredDueList.reduce((t, r) => t + r.totalAmount, 0))}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                    {formatCurrency(filteredDueList.reduce((t, r) => t + r.returnAmount, 0))}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                    {formatCurrency(filteredDueList.reduce((t, r) => t + r.paymentAmount, 0))}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs font-bold text-sky-900">
                    {formatCurrency(filteredDueList.reduce((t, r) => t + r.dueAmount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage1}
                onChange={(e) => setRowsPerPage1(Number(e.target.value))}
                className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>1-{filteredDueList.length} of {filteredDueList.length}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled className="p-1 border border-slate-200 rounded text-slate-300">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button type="button" disabled className="p-1 border border-slate-200 rounded text-slate-300">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: PENDING BILL(LOCAL/FOREIGN) (SCREENSHOT 2) */}
      {/* ============================================================= */}
      {activeTab === "PENDING_BILLS" && (
        <div className="space-y-3">
          {/* Filter Bar & Quick Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 p-2.5 rounded border border-slate-200 text-xs">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Filter Status</label>
                <select
                  value={pendingBillFilter}
                  onChange={(e) => setPendingBillFilter(e.target.value)}
                  className="border border-blue-500 rounded px-2.5 py-1 text-xs bg-white text-blue-700 font-bold focus:outline-none"
                >
                  <option value="Pending">Pending Approval ({pendingBills.filter((b) => b.status === "Pending").length})</option>
                  <option value="Approved">Approved for Payment ({pendingBills.filter((b) => b.status === "Approved").length})</option>
                  <option value="In_Review">In Review ({pendingBills.filter((b) => b.status === "In_Review").length})</option>
                  <option value="In_Progress">In Progress ({pendingBills.filter((b) => b.status === "In_Progress").length})</option>
                  <option value="ALL">All Bills ({pendingBills.length})</option>
                </select>
              </div>

              <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Payable Bills:</span>
                  <span className="font-bold text-slate-800">{filteredPendingBills.length} Bills</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Net Payable Amount:</span>
                  <span className="font-bold font-mono text-sky-700">
                    {formatCurrency(filteredPendingBills.reduce((acc, b) => acc + b.netPayable, 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const pendingOnly = pendingBills.filter((b) => b.status === "Pending");
                  if (pendingOnly.length === 0) {
                    toast.info("No pending bills left to approve.");
                    return;
                  }
                  approveMutation.mutate(null);
                }}
                disabled={approveMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded text-xs font-semibold shadow-xs transition"
              >
                {approveMutation.isPending ? <Spinner className="size-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Batch Approve All</span>
              </button>
            </div>
          </div>

          {/* Table or Empty State */}
          {filteredPendingBills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded border border-slate-200">
              <div className="text-xl font-black tracking-tight text-slate-900 mb-1 font-sans flex items-center justify-center gap-1.5">
                <span>Bridge</span>
                <span className="text-[#0057b8]">One</span>
                <span className="text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 font-bold uppercase tracking-wider">ERP</span>
              </div>
              <p className="text-sm font-semibold text-slate-700">No Bills Found</p>
              <p className="text-xs text-slate-400 mt-1 mb-3">There are no vendor bills currently matching the &ldquo;{pendingBillFilter}&rdquo; criteria.</p>
              <button
                type="button"
                onClick={() => {
                  setPendingBillFilter("ALL");
                  setSearchTerm("");
                }}
                className="px-3 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-semibold rounded transition"
              >
                Show All Bills
              </button>
            </div>
          ) : (
            <div className="bg-white rounded border border-slate-300 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="erp-table w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="p-2 border border-slate-300 text-center w-10">SL</th>
                      <th className="p-2 border border-slate-300">Bill No</th>
                      <th className="p-2 border border-slate-300">Date</th>
                      <th className="p-2 border border-slate-300">Supplier Name</th>
                      <th className="p-2 border border-slate-300">PO Ref</th>
                      <th className="p-2 border border-slate-300">GRN Ref</th>
                      <th className="p-2 border border-slate-300 text-center">Type</th>
                      <th className="p-2 border border-slate-300 text-right">Gross (BDT)</th>
                      <th className="p-2 border border-slate-300 text-right">Tax / VAT</th>
                      <th className="p-2 border border-slate-300 text-right">Net Payable</th>
                      <th className="p-2 border border-slate-300">Due Date</th>
                      <th className="p-2 border border-slate-300 text-center">Status</th>
                      <th className="p-2 border border-slate-300 text-center w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPendingBills.map((bill, idx) => (
                      <tr key={bill.billNo} className="hover:bg-sky-50/40 transition-colors border-b border-slate-200">
                        <td className="p-2 border border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 font-mono font-bold text-sky-700">{bill.billNo}</td>
                        <td className="p-2 border border-slate-200 font-mono text-slate-600">{bill.billDate}</td>
                        <td className="p-2 border border-slate-200 font-medium text-slate-800">
                          <div>{bill.supplierName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{bill.supplierCode}</div>
                        </td>
                        <td className="p-2 border border-slate-200 font-mono text-slate-600">{bill.poNumber}</td>
                        <td className="p-2 border border-slate-200 font-mono text-slate-600">{bill.grnNumber}</td>
                        <td className="p-2 border border-slate-200 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-semibold text-slate-700">{bill.billType}</span>
                        </td>
                        <td className="p-2 border border-slate-200 text-right font-mono">{formatCurrency(bill.grossAmount)}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-slate-500">{formatCurrency(bill.taxVat)}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono font-bold text-slate-900">{formatCurrency(bill.netPayable)}</td>
                        <td className="p-2 border border-slate-200 font-mono text-slate-600">{bill.dueDate}</td>
                        <td className="p-2 border border-slate-200 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              bill.status === "Approved"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : bill.status === "Pending"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : bill.status === "In_Review"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            {bill.status}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-200 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {bill.status !== "Approved" && (
                              <button
                                type="button"
                                onClick={() => handleApproveBill(bill.billNo)}
                                disabled={approveMutation.isPending}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded text-[11px] font-semibold transition"
                                title="Approve Bill"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePayPendingBill(bill)}
                              disabled={bill.status !== "Approved"}
                              className="px-2 py-1 bg-[#1976d2] hover:bg-[#1565c0] disabled:opacity-40 disabled:hover:bg-[#1976d2] text-white rounded text-[11px] font-semibold transition"
                              title={bill.status === "Approved" ? "Pay Bill" : "Approve the bill before paying it"}
                            >
                              Pay Now
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td colSpan={7} className="p-2 border border-slate-300 text-center uppercase">
                        Total
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                        {formatCurrency(filteredPendingBills.reduce((acc, b) => acc + b.grossAmount, 0))}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-mono text-xs text-slate-600">
                        {formatCurrency(filteredPendingBills.reduce((acc, b) => acc + b.taxVat, 0))}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-mono text-xs font-bold text-sky-900">
                        {formatCurrency(filteredPendingBills.reduce((acc, b) => acc + b.netPayable, 0))}
                      </td>
                      <td colSpan={3} className="p-2 border border-slate-300 text-center text-slate-400">
                        -
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 3: PAID GRN/BILL (SCREENSHOT 3) */}
      {/* ============================================================= */}
      {activeTab === "PAID_GRN_BILL" && (
        <div className="space-y-2">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 text-xs bg-slate-50/50 p-2 rounded border border-slate-200">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Supplier</label>
              <input
                type="text"
                placeholder="Select/Search Supplier (min 3 letters)"
                value={tab3Supplier}
                onChange={(e) => setTab3Supplier(e.target.value)}
                className="w-64 border border-slate-300 rounded px-2 py-1 bg-white text-xs placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">From</label>
              <input
                type="date"
                aria-label="Paid from date"
                value={tab3FromDate}
                onChange={(e) => setTab3FromDate(e.target.value)}
                className="w-32 border border-slate-300 rounded px-2 py-1 bg-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">To</label>
              <input
                type="date"
                aria-label="Paid to date"
                value={tab3ToDate}
                onChange={(e) => setTab3ToDate(e.target.value)}
                className="w-32 border border-slate-300 rounded px-2 py-1 bg-white text-xs"
              />
            </div>
            <button
              type="button"
              className="px-4 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold rounded text-xs transition"
            >
              View
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-1.5 border border-[#1976d2] text-[#1976d2] hover:bg-blue-50 font-bold rounded text-xs transition"
            >
              Excel
            </button>
          </div>

          {/* Table Container with All Borders */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Actions</th>
                  <th className="p-2 border border-slate-300 w-24">Paid Date</th>
                  <th className="p-2 border border-slate-300">Invoice No</th>
                  <th className="p-2 border border-slate-300">Supplier</th>
                  <th className="p-2 border border-slate-300 w-32">Money receipt No</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Bank Amount</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Cash Amount</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Paid Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredPaidList.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>

                    {/* Actions: View, Receipt, Print */}
                    <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2 text-slate-600">
                        <button
                          type="button"
                          onClick={() => setViewPaidVoucher(row)}
                          className="p-0.5 hover:text-blue-600 transition"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPrintPaidVoucher(row);
                          }}
                          className="p-0.5 hover:text-blue-600 transition"
                          title="Money Receipt"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintPaidVoucher(row)}
                          className="p-0.5 hover:text-blue-600 transition"
                          title="Print Payment Voucher"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCancelPayment(row);
                            setCancelPaymentReason("");
                          }}
                          className="p-0.5 hover:text-rose-600 transition"
                          title="Cancel payment"
                          aria-label={`Cancel payment ${row.moneyReceiptNo}`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    <td className="p-2 border border-slate-300 text-slate-700 whitespace-nowrap">
                      {row.paidDate}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800 max-w-sm truncate" title={row.invoiceNo}>
                      {row.invoiceNo}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-900 font-medium">
                      {row.supplier}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-600">
                      {row.moneyReceiptNo}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-700 whitespace-nowrap">
                      {formatCurrency(row.bankAmount)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-700 whitespace-nowrap">
                      {formatCurrency(row.cashAmount)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(row.paidAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold text-xs border-t-2 border-slate-300 text-slate-900">
                  <td colSpan={6} className="p-2 border border-slate-300 text-left">
                    Total :
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                    {formatCurrency(filteredPaidList.reduce((t, r) => t + r.bankAmount, 0))}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                    {formatCurrency(filteredPaidList.reduce((t, r) => t + r.cashAmount, 0))}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs font-bold text-sky-900">
                    {formatCurrency(filteredPaidList.reduce((t, r) => t + r.paidAmount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage3}
                onChange={(e) => setRowsPerPage3(Number(e.target.value))}
                className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>1-{filteredPaidList.length} of {filteredPaidList.length}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled className="p-1 border border-slate-200 rounded text-slate-300">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button type="button" className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 4: DUE INVOICES (SCREENSHOT 4) */}
      {/* ============================================================= */}
      {activeTab === "DUE_INVOICES" && (
        <div className="space-y-2">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 text-xs bg-slate-50/50 p-2 rounded border border-slate-200">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Rece. From Date</label>
              <input
                type="text"
                value={tab4FromDate}
                onChange={(e) => setTab4FromDate(e.target.value)}
                className="w-32 border border-slate-300 rounded px-2 py-1 bg-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Rece. To Date</label>
              <input
                type="text"
                value={tab4ToDate}
                onChange={(e) => setTab4ToDate(e.target.value)}
                className="w-32 border border-slate-300 rounded px-2 py-1 bg-white text-xs"
              />
            </div>
            <button
              type="button"
              className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold rounded text-xs transition"
            >
              View
            </button>
          </div>

          {/* Table Container with All Borders */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-10 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-24">Rece. Date</th>
                  <th className="p-2 border border-slate-300 w-40">Invoice</th>
                  <th className="p-2 border border-slate-300">Supplier Name</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">Credit Days</th>
                  <th className="p-2 border border-slate-300 w-28">Ex. Payment Date</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Total Amount</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Net Amount</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Due Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredDueInvoices.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700 whitespace-nowrap">
                      {row.receDate}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">
                      {row.invoice}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-900 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{row.supplierName}</span>
                      </span>
                    </td>
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-500">
                      {row.creditDays.toFixed(2)}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-700 whitespace-nowrap">
                      {row.exPaymentDate}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-800 whitespace-nowrap">
                      {formatCurrency(row.totalAmount)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-800 whitespace-nowrap">
                      {formatCurrency(row.netAmount)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(row.dueAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage4}
                onChange={(e) => setRowsPerPage4(Number(e.target.value))}
                className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>1-{filteredDueInvoices.length} of {filteredDueInvoices.length}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled className="p-1 border border-slate-200 rounded text-slate-300">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button type="button" className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 5: PAYMENT ADVANCE (SCREENSHOT 5) */}
      {/* ============================================================= */}
      {activeTab === "PAYMENT_ADVANCE" && (
        <div className="space-y-2">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 text-xs bg-slate-50/50 p-2 rounded border border-slate-200">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Supplier</label>
              <input
                type="text"
                placeholder="Select/Search Supplier (min 3 letters)"
                value={tab5Supplier}
                onChange={(e) => setTab5Supplier(e.target.value)}
                className="w-64 border border-slate-300 rounded px-2 py-1 bg-white text-xs placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">From</label>
              <input
                type="text"
                value={tab5FromDate}
                onChange={(e) => setTab5FromDate(e.target.value)}
                className="w-32 border border-slate-300 rounded px-2 py-1 bg-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">To</label>
              <input
                type="text"
                value={tab5ToDate}
                onChange={(e) => setTab5ToDate(e.target.value)}
                className="w-32 border border-slate-300 rounded px-2 py-1 bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5 pb-1">
              <input
                type="checkbox"
                id="detailsCheck"
                checked={tab5DetailsCheck}
                onChange={(e) => setTab5DetailsCheck(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              <label htmlFor="detailsCheck" className="text-slate-700 text-xs">Details</label>
            </div>
            <button
              type="button"
              className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold rounded text-xs transition"
            >
              View
            </button>
          </div>

          {/* Table Container */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                  <th className="p-2 border border-slate-300">Supplier Name</th>
                  <th className="p-2 border border-slate-300 w-44 text-right">Advance Amount</th>
                  <th className="p-2 border border-slate-300 w-44 text-right">Adjust Amount</th>
                  <th className="p-2 border border-slate-300 w-44 text-right">Remaining Advance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {advanceList.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-900 font-medium">
                      {row.supplierName}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-700">
                      {formatCurrency(row.advanceAmount)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-800">
                      {formatCurrency(row.adjustAmount)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                      {formatCurrency(row.remainingAdvance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold text-xs border-t-2 border-slate-300 text-slate-900">
                  <td colSpan={2} className="p-2 border border-slate-300 text-right font-bold">
                    Total
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                    {formatCurrency(advanceList.reduce((t, r) => t + r.advanceAmount, 0))}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                    {formatCurrency(advanceList.reduce((t, r) => t + r.adjustAmount, 0))}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs font-bold text-rose-700">
                    {formatCurrency(advanceList.reduce((t, r) => t + r.remainingAdvance, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 6: SUPPLIER PURCHASE VS LEDGER BALANCE (SCREENSHOT 6) */}
      {/* ============================================================= */}
      {activeTab === "SUPPLIER_PURCHASE_VS_LEDGER" && (
        <div className="space-y-2">
          {/* Filters Bar: From, To, View */}
          <div className="flex flex-wrap items-end gap-3 text-xs p-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">From</label>
              <div className="relative">
                <input
                  type="text"
                  value={tab6FromDate}
                  onChange={(e) => setTab6FromDate(e.target.value)}
                  className="w-36 border border-slate-300 rounded px-2 py-1 bg-white text-xs pr-7"
                />
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">To</label>
              <div className="relative">
                <input
                  type="text"
                  value={tab6ToDate}
                  onChange={(e) => setTab6ToDate(e.target.value)}
                  className="w-36 border border-slate-300 rounded px-2 py-1 bg-white text-xs pr-7"
                />
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
              </div>
            </div>
            <button
              type="button"
              className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold rounded text-xs transition shadow-xs"
            >
              View
            </button>
          </div>

          {/* Table Container with All Borders */}
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-36">Supplier Code</th>
                  <th className="p-2 border border-slate-300">Supplier Name</th>
                  <th className="p-2 border border-slate-300 w-36">Supplier Group</th>
                  <th className="p-2 border border-slate-300 w-44 text-right">Purchase Payment (Due)</th>
                  <th className="p-2 border border-slate-300 w-36 text-right">Ledger</th>
                  <th className="p-2 border border-slate-300 w-36 text-right">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredLedgerReconList.map((row) => (
                  <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                      {row.sl}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-800">
                      {row.supplierCode}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-900 font-medium">
                      {row.supplierName}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {row.supplierGroup || ""}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-800">
                      {formatNum(row.purchasePaymentDue)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-800">
                      {formatNum(row.ledger)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-slate-800">
                      {formatNum(row.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white font-bold text-xs border-t-2 border-slate-300 text-slate-900">
                  <td colSpan={4} className="p-2 border border-slate-300 text-center font-bold">
                    Total
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                    {totalLedgerRecon.due}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                    {totalLedgerRecon.ledger}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-xs">
                    {totalLedgerRecon.diff}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-end gap-6 text-xs text-slate-600 px-2 py-3">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage6}
                onChange={(e) => setRowsPerPage6(Number(e.target.value))}
                className="border-0 bg-transparent font-medium text-slate-800 focus:ring-0 cursor-pointer text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <span>
              1-{filteredLedgerReconList.length} of {filteredLedgerReconList.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-50"
                disabled
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-50"
                disabled
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 3. MODAL: QUICK PAY TO SUPPLIER ($ ICON) */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(quickPayTarget)}
        onClose={() => setQuickPayTarget(null)}
        title={`Supplier Payment Settlement: ${quickPayTarget?.supplierName || ""}`}
        subtitle={`Supplier Code: ${quickPayTarget?.supplierCode || ""} • Outstanding Due: BDT ${formatCurrency(quickPayTarget?.dueAmount || 0)}`}
        maxWidth="lg"
      >
        {quickPayTarget && (
          <form onSubmit={handleConfirmQuickPay} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Invoiced</span>
                <span className="font-bold text-slate-800 font-mono">{formatCurrency(quickPayTarget.totalAmount)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Previously Paid</span>
                <span className="font-bold text-emerald-700 font-mono">{formatCurrency(quickPayTarget.paymentAmount)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Returns / Adjustments</span>
                <span className="font-bold text-rose-600 font-mono">{formatCurrency(quickPayTarget.returnAmount)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Balance Due to Settle</span>
                <span className="font-bold text-sky-800 font-mono text-sm">{formatCurrency(quickPayTarget.dueAmount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Amount (BDT) *</label>
                <input
                  type="number"
                  min="1"
                  max={quickPayTarget.dueAmount}
                  step="0.01"
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(Number(e.target.value))}
                  className="w-full border border-blue-400 rounded p-1.5 text-xs bg-white font-mono font-bold text-sky-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Disbursement Mode *</label>
                <select
                  value={quickPayMode}
                  onChange={(e) => setQuickPayMode(e.target.value as any)}
                  className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                >
                  <option value="BANK_TRANSFER">Bank Online Transfer / BEFTN</option>
                  <option value="CASH">Petty Cash / Corporate Cash</option>
                  <option value="CHEQUE">Corporate Cheque</option>
                  <option value="EFT">NPSB / Realtime EFT</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Paying Bank / Account</label>
                <input
                  type="text"
                  value={quickPayBank}
                  onChange={(e) => setQuickPayBank(e.target.value)}
                  className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cheque / Txn Reference No.</label>
                <input
                  type="text"
                  value={quickPayRef}
                  onChange={(e) => setQuickPayRef(e.target.value)}
                  placeholder="e.g. CQ-992140 / TXN-88123"
                  className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setQuickPayTarget(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={paymentMutation.isPending}
                className="px-5 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] disabled:opacity-60 text-white font-bold rounded shadow-xs transition inline-flex items-center gap-1.5"
              >
                {paymentMutation.isPending && <Spinner className="size-3.5" />}
                Disburse & Generate Money Receipt
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 4. MODAL: + PAYMENT BY GRN */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={isPaymentByGRNOpen}
        onClose={() => setIsPaymentByGRNOpen(false)}
        title="Payment By GRN (Goods Receipt Settlement)"
        subtitle="Batch pay or clear invoices linked to received store goods"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Supplier / Vendor *</label>
              <select
                value={grnPaySupplier}
                onChange={(e) => {
                  setGrnPaySupplier(e.target.value);
                  setGrnPaySelected([]);
                }}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              >
                <option value="">Select supplier</option>
                {dueList.filter((d) => d.dueAmount > 0).map((d) => (
                  <option key={d.supplierId} value={d.supplierId}>
                    {d.supplierName} (due {formatCurrency(d.dueAmount)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Payment Date *</label>
              <input type="date" value={grnPayDate} onChange={(e) => setGrnPayDate(e.target.value)} className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Select Outstanding Invoices to Settle</label>
            <div className="border border-slate-200 rounded max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold">
                  <tr>
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2">Invoice / GRN</th>
                    <th className="p-2">Rece. Date</th>
                    <th className="p-2 text-right">Net Amount</th>
                    <th className="p-2 text-right">Due Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grnPayInvoices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-3 text-center text-slate-500">
                        {grnPaySupplier ? "Nothing is due for this supplier." : "Select a supplier to see its open invoices."}
                      </td>
                    </tr>
                  )}
                  {grnPayInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={grnPaySelected.includes(inv.id)}
                          onChange={(e) =>
                            setGrnPaySelected(e.target.checked ? [...grnPaySelected, inv.id] : grnPaySelected.filter((id) => id !== inv.id))
                          }
                          className="rounded"
                        />
                      </td>
                      <td className="p-2 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                      <td className="p-2 text-slate-600">{inv.invoiceDate}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(inv.totalAmount)}</td>
                      <td className="p-2 text-right font-mono font-bold text-sky-800">{formatCurrency(inv.dueAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setIsPaymentByGRNOpen(false)}
              className="px-4 py-1.5 border border-slate-200 rounded text-slate-600 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={paymentMutation.isPending}
              onClick={handleConfirmGrnPayment}
              className="px-5 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] disabled:opacity-60 text-white font-bold rounded shadow-xs inline-flex items-center gap-1.5"
            >
              {paymentMutation.isPending && <Spinner className="size-3.5" />}
              Confirm Settlement
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* ============================================================= */}
      {/* 5. MODAL: + ADVANCE PAYMENT */}
      {/* ============================================================= */}
      <AdvancePaymentModal
        isOpen={isAdvancePaymentOpen}
        onClose={() => setIsAdvancePaymentOpen(false)}
      />

      {/* ============================================================= */}
      {/* 6. MODAL: + CREATE BILL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={isCreateBillOpen}
        onClose={() => setIsCreateBillOpen(false)}
        title="Create Ad-hoc Vendor Bill"
        subtitle="Book direct procurement or utility bill payable"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Supplier *</label>
              <select
                value={billSupplier}
                onChange={(e) => {
                  setBillSupplier(e.target.value);
                  setBillReceiptId("");
                }}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              >
                <option value="">Select supplier</option>
                {(serverPayables ?? []).map((p) => (
                  <option key={p.supplierId} value={p.supplierId}>
                    {p.supplierName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Against Goods Receipt</label>
              <select
                value={billReceiptId}
                onChange={(e) => {
                  setBillReceiptId(e.target.value);
                  const receipt = billableReceipts.find((r) => r.receiptId === e.target.value);
                  if (receipt) setBillAmount(receipt.totalAmount);
                }}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              >
                <option value="">None (service / utility bill)</option>
                {billableReceipts.map((r) => (
                  <option key={r.receiptId} value={r.receiptId}>
                    {r.grnNumber} · {formatCurrency(r.totalAmount)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Bill Date *</label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Bill / Invoice No *</label>
              <input
                type="text"
                value={billInvoiceNo}
                onChange={(e) => setBillInvoiceNo(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Bill Amount (BDT) *</label>
              <input
                type="number"
                value={billAmount}
                disabled={Boolean(billReceiptId)}
                title={billReceiptId ? "A bill against a goods receipt takes the receipt's value." : undefined}
                onChange={(e) => setBillAmount(Number(e.target.value))}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white font-mono font-bold disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Due Date *</label>
              <input
                type="date"
                value={billDueDate}
                onChange={(e) => setBillDueDate(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setIsCreateBillOpen(false)}
              className="px-4 py-1.5 border border-slate-200 rounded text-slate-600 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={billMutation.isPending}
              onClick={handleCreateBill}
              className="px-5 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] disabled:opacity-60 text-white font-bold rounded shadow-xs inline-flex items-center gap-1.5"
            >
              {billMutation.isPending && <Spinner className="size-3.5" />}
              Save Vendor Bill
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* ============================================================= */}
      {/* 7. PRINT PAYMENT VOUCHER / MONEY RECEIPT MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(printPaidVoucher)}
        onClose={() => setPrintPaidVoucher(null)}
        title="Official Money Receipt / Payment Voucher"
        subtitle="Disbursement voucher with authorization signatures"
        maxWidth="4xl"
      >
        {printPaidVoucher && (
          <div className="space-y-4 text-xs">
            <div className="bg-white p-6 border border-slate-200 rounded shadow-sm text-slate-800 space-y-4 print:p-0 print:border-none">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="BridgeOne Logo" className="h-10 w-auto object-contain" />
                  <div>
                    <h2 className="font-bold text-base text-slate-900 tracking-wide uppercase">BridgeOne ERP Industries Ltd.</h2>
                    <p className="text-[11px] text-slate-500">Accounts & Procurement Finance Division • Dhaka, Bangladesh</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded text-xs">
                    MONEY RECEIPT VOUCHER
                  </span>
                  <p className="font-mono font-bold text-slate-900 text-sm mt-1">{printPaidVoucher.moneyReceiptNo || "MR-2026-0914"}</p>
                  <p className="text-[10px] text-slate-400">Payment Date: {printPaidVoucher.paidDate}</p>
                </div>
              </div>

              {/* Payee Info */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
                <div>
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase mb-1">Paid To Vendor</h4>
                  <p className="font-bold text-slate-900 text-sm">{printPaidVoucher.supplier}</p>
                  <p className="text-slate-600">Settled Invoices: <span className="font-mono">{printPaidVoucher.invoiceNo}</span></p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase mb-1">Payment Channel</h4>
                  <p className="text-slate-700">Bank Amount: <span className="font-mono font-bold">{formatCurrency(printPaidVoucher.bankAmount)}</span></p>
                  <p className="text-slate-700">Cash Amount: <span className="font-mono font-bold">{formatCurrency(printPaidVoucher.cashAmount)}</span></p>
                  <p className="text-slate-900 font-bold text-sm mt-1">Total Disbursed: <span className="font-mono text-emerald-700">{formatCurrency(printPaidVoucher.paidAmount)}</span></p>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-16 grid grid-cols-4 gap-4 text-center text-[10px] text-slate-500">
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Fuad Hossain</span>
                  <span>Prepared By</span>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Accounts Officer</span>
                  <span>Verified & Posted</span>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Head of Finance</span>
                  <span>Approved Disbursement</span>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Payee Receiver</span>
                  <span>Signature & Seal</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPrintPaidVoucher(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-700 font-semibold"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white rounded font-bold flex items-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ============================================================= */}
      {/* 8. VIEW PAID DETAILS MODAL */}
      {/* ============================================================= */}
      <ModalDialog
        isOpen={Boolean(viewPaidVoucher)}
        onClose={() => setViewPaidVoucher(null)}
        title="Disbursement Voucher Details"
        subtitle={`Vendor: ${viewPaidVoucher?.supplier || ""} • Date: ${viewPaidVoucher?.paidDate || ""}`}
        maxWidth="md"
      >
        {viewPaidVoucher && (
          <div className="space-y-3 text-xs">
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-bold text-slate-900">{viewPaidVoucher.supplier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoices Cleared:</span>
                <span className="font-mono text-slate-800">{viewPaidVoucher.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Date:</span>
                <span className="text-slate-800">{viewPaidVoucher.paidDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bank Channel:</span>
                <span className="font-mono">{formatCurrency(viewPaidVoucher.bankAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cash Channel:</span>
                <span className="font-mono">{formatCurrency(viewPaidVoucher.cashAmount)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t text-sm font-bold">
                <span className="text-slate-800">Total Settled:</span>
                <span className="font-mono text-emerald-700">{formatCurrency(viewPaidVoucher.paidAmount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewPaidVoucher(null)}
                className="px-4 py-1.5 border border-slate-200 rounded text-slate-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintPaidVoucher(viewPaidVoucher);
                  setViewPaidVoucher(null);
                }}
                className="px-4 py-1.5 bg-[#1976d2] text-white rounded font-bold hover:bg-[#1565c0]"
              >
                Print Voucher
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
      <ModalDialog
        isOpen={Boolean(cancelPayment)}
        onClose={() => !cancelPaymentMutation.isPending && setCancelPayment(null)}
        title="Cancel Supplier Payment"
        subtitle={cancelPayment ? `${cancelPayment.moneyReceiptNo} · ${cancelPayment.supplier}` : ""}
        maxWidth="md"
      >
        {cancelPayment && (
          <form
            className="space-y-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              cancelPaymentMutation.mutate({ id: cancelPayment.id, comments: cancelPaymentReason });
            }}
          >
            <p className="text-slate-600">
              {formatCurrency(cancelPayment.paidAmount)} paid on {cancelPayment.paidDate} is reversed and becomes due to {cancelPayment.supplier} again. The ledger posts a reversing voucher.
            </p>
            <div>
              <label htmlFor="cancel-payment-reason" className="block text-slate-700 font-semibold mb-1">Reason *</label>
              <textarea
                id="cancel-payment-reason"
                required
                maxLength={300}
                value={cancelPaymentReason}
                onChange={(e) => setCancelPaymentReason(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs h-20"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelPayment(null)} disabled={cancelPaymentMutation.isPending} className="h-9 px-4 border border-slate-200 rounded text-slate-600">
                Back
              </button>
              <button type="submit" disabled={cancelPaymentMutation.isPending} className="h-9 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded font-bold inline-flex items-center gap-1.5">
                {cancelPaymentMutation.isPending && <Spinner className="size-3.5" />}
                Cancel Payment
              </button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
}
