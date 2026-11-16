"use client";

import { toast } from "@/components/purchase/Toast";
import { Spinner } from "@/components/ui/spinner";
import { usePending } from "@/hooks/use-pending";
import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Eye,
  Search,
  X,
  Check,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import { localDaysFromToday, localToday } from "@/features/purchase/lib/client";
import type { FundTransferRecord } from "@/features/accounts/types";

/** What each stored status is called on screen (the server writes upper case). */
const STATUS_TEXT: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "text-slate-500" },
  SUBMITTED: { label: "Submitted", tone: "text-amber-600" },
  PENDING_APPROVAL: { label: "Pending Approval", tone: "text-amber-600" },
  APPROVED: { label: "Approved", tone: "text-emerald-600" },
  Approved: { label: "Approved", tone: "text-emerald-600" },
  DISPATCHED: { label: "Dispatched", tone: "text-blue-600" },
  Completed: { label: "Completed", tone: "text-blue-600" },
  IN_TRANSIT: { label: "In Transit", tone: "text-blue-600" },
  RECEIVED: { label: "Received", tone: "text-emerald-600" },
  RETURNED: { label: "Returned", tone: "text-rose-600" },
  CANCELLED: { label: "Cancelled", tone: "text-rose-600" },
};
const statusOf = (status: string) => STATUS_TEXT[status] ?? { label: status, tone: "text-slate-600" };
const isApproved = (status: string) => status === "APPROVED" || status === "Approved";
const isAwaitingApproval = (status: string) => status === "PENDING_APPROVAL" || status === "SUBMITTED" || status === "DRAFT";
const iconButton = "inline-flex size-6 items-center justify-center rounded transition";

export default function FundTransferPage() {
  const { pending, run } = usePending();
  const transfers = useAccountingStore((s) => s.transfers);
  const dbOffices = useAccountingStore((s) => s.offices);
  const accounts = useAccountingStore((s) => s.accounts);
  const employees = useAccountingStore((s) => s.employees);
  // Cash and bank posting accounts money can move between.
  const cashBankAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === "ASSET" && !a.isGroup && a.status === "ACTIVE" && /cash|bank/i.test(`${a.name} ${a.accountSubtype}`)),
    [accounts],
  );
  const createTransfer = useAccountingStore((s) => s.createTransfer);
  const receiveTransfer = useAccountingStore((s) => s.receiveTransfer);
  const approveTransfer = useAccountingStore((s) => s.approveTransfer);
  const dispatchTransfer = useAccountingStore((s) => s.dispatchTransfer);
  const returnTransfer = useAccountingStore((s) => s.returnTransfer);
  // Approve a request, send (pay) an approved transfer, or cancel it — each confirmed first.
  const [actionOn, setActionOn] = useState<{ kind: "approve" | "dispatch" | "cancel"; transfer: FundTransferRecord } | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Tabs: REQUEST | OUT | IN_TRANSIT | IN_RECEIVED | RETURN
  const [activeTab, setActiveTab] = useState<
    "REQUEST" | "OUT" | "IN_TRANSIT" | "IN_RECEIVED" | "RETURN"
  >("REQUEST");

  // Filter states
  const [search, setSearch] = useState("");
  const [reqOfficeFilter, setReqOfficeFilter] = useState("ALL");
  const [sendingOfficeFilter, setSendingOfficeFilter] = useState("ALL");
  // This month until today.
  const [fromDate, setFromDate] = useState(() => `${localToday().slice(0, 8)}01`);
  const [toDate, setToDate] = useState(() => localToday());

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [viewingTransfer, setViewingTransfer] = useState<FundTransferRecord | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<FundTransferRecord | null>(null);

  // Create Form State
  const blankForm = () => ({
    requestDate: localToday(),
    expectedDate: localDaysFromToday(1),
    fromOfficeId: "",
    fromOfficeName: "",
    toOfficeId: "",
    toOfficeName: "",
    fromAccountId: "",
    fromAccountName: "",
    toAccountId: "",
    toAccountName: "",
    requestedAmount: 0,
    responsiblePerson: "",
    purpose: "",
    referenceNumber: "",
    receiveType: "Cash" as "Cash" | "Bank",
  });
  const [form, setForm] = useState(blankForm);
  // Cash heads and bank heads, for the request's Req./Receive Type.
  const isBankHead = (a: { code: string; name: string; accountSubtype: string }) => /bank/i.test(`${a.name} ${a.accountSubtype}`) || a.code.startsWith("10102");
  const receiveHeads = cashBankAccounts.filter((a) => (form.receiveType === "Bank" ? isBankHead(a) : !isBankHead(a)));
  const [formError, setFormError] = useState("");

  /** The form with real office ids (picked by name) and account names, or an error. */
  const resolveForm = (needAccounts: boolean) => {
    const from = dbOffices.find((o) => o.name === form.fromOfficeName) ?? dbOffices[0];
    const to = dbOffices.find((o) => o.name === form.toOfficeName) ?? dbOffices[0];
    if (!from || !to) return { error: "No office is available." };
    if (from.id === to.id) return { error: "The source and destination offices must be different." };
    const fromAcc = cashBankAccounts.find((a) => a.id === form.fromAccountId);
    const toAcc = cashBankAccounts.find((a) => a.id === form.toAccountId);
    if (needAccounts && (!fromAcc || !toAcc)) return { error: "Select the source and destination cash/bank heads." };
    return {
      data: {
        ...form,
        fromOfficeId: from.id,
        fromOfficeName: from.name,
        toOfficeId: to.id,
        toOfficeName: to.name,
        fromAccountId: fromAcc?.id ?? "",
        fromAccountName: fromAcc?.name ?? "",
        toAccountId: toAcc?.id ?? "",
        toAccountName: toAcc?.name ?? "",
      },
    };
  };

  const officeList = useMemo(
    () => [
      { id: "ALL", name: "All Offices" },
      ...dbOffices.map((o) => ({ id: o.name, name: o.name })),
    ],
    [dbOffices]
  );

  // Tab Dataset Filtering
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      // Tab 1: FUND TRANSFER REQUEST
      if (activeTab === "REQUEST") {
        if (!isApproved(t.status) && !isAwaitingApproval(t.status))
          return false;
      }
      // Tab 2: FUND TRANSFER OUT
      else if (activeTab === "OUT") {
        // Dispatched or Completed or Approved out
        if (!isApproved(t.status) && t.status !== "Completed" && t.status !== "DISPATCHED")
          return false;
      }
      // Tab 3: FUND TRANSFER IN TRANSIT
      else if (activeTab === "IN_TRANSIT") {
        if (t.status !== "IN_TRANSIT") return false;
      }
      // Tab 4: FUND TRANSFER IN/RECEIVED
      else if (activeTab === "IN_RECEIVED") {
        if (t.status !== "RECEIVED") return false;
      }
      // Tab 5: FUND TRANSFER RETURN
      else if (activeTab === "RETURN") {
        if (t.status !== "RETURNED") return false;
      }

      // Office filters
      const day = (t.requestDate ?? "").slice(0, 10);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      if (reqOfficeFilter !== "ALL" && t.toOfficeName !== reqOfficeFilter) return false;
      if (sendingOfficeFilter !== "ALL" && t.fromOfficeName !== sendingOfficeFilter) return false;

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const m =
          (t.outCode && t.outCode.toLowerCase().includes(q)) ||
          (t.reqCode && t.reqCode.toLowerCase().includes(q)) ||
          t.transferNumber.toLowerCase().includes(q) ||
          t.fromOfficeName.toLowerCase().includes(q) ||
          t.toOfficeName.toLowerCase().includes(q) ||
          (t.responsiblePerson && t.responsiblePerson.toLowerCase().includes(q));
        if (!m) return false;
      }

      return true;
    });
  }, [transfers, activeTab, reqOfficeFilter, sendingOfficeFilter, search, fromDate, toDate]);

  // Paginated Slicing
  const totalRows = filteredTransfers.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const paginatedTransfers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredTransfers.slice(start, start + rowsPerPage);
  }, [filteredTransfers, currentPage, rowsPerPage]);

  const handleCreateRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.requestedAmount <= 0) return setFormError("Enter the request amount.");
    // A request names only who asks for the money and where it goes; the sending office is chosen when it is sent out.
    const office = dbOffices.find((o) => o.name === form.toOfficeName) ?? dbOffices[0];
    const head = receiveHeads.find((a) => a.id === form.toAccountId);
    if (!office) return setFormError("No office is available.");
    if (!head) return setFormError(`Select the ${form.receiveType.toLowerCase()} the money is received in.`);
    if (form.expectedDate && form.expectedDate < form.requestDate) return setFormError("The expected date cannot be before the request date.");
    const ok = await run("request", () => createTransfer({
      ...form,
      fromOfficeId: "",
      fromOfficeName: "",
      fromAccountId: "",
      fromAccountName: "",
      toOfficeId: office.id,
      toOfficeName: office.name,
      toAccountId: head.id,
      toAccountName: head.name,
      status: "SUBMITTED",
    }));
    if (!ok) return;
    toast.success("Fund transfer request saved.");
    setIsRequestModalOpen(false);
    setForm(blankForm());
    setFormError("");
  };

  const handleDirectTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.requestedAmount <= 0) return;
    const resolved = resolveForm(true);
    if (!resolved.data) return setFormError(resolved.error);
    const count = transfers.length + 1;
    const outCode = `FTO-MG260500${(10 + count).toString()}`;
    const ok = await run("direct", () => createTransfer({
      ...resolved.data,
      status: "Completed",
      outCode,
    }));
    if (!ok) return;
    toast.success("Fund transfer saved.");
    setIsDirectModalOpen(false);
    setForm(blankForm());
    setFormError("");
  };

  const handleConfirmReceive = async () => {
    if (!receiveTarget) return;
    const ok = await run("receive", () => receiveTransfer(receiveTarget.id));
    if (!ok) return;
    toast.success("Transfer received.");
    setReceiveTarget(null);
  };

  return (
    <div className="space-y-2.5 font-sans pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER: TITLE + SEARCH + CONTEXTUAL ACTIONS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs p-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-slate-800">Fund Transfer</h1>

          <div className="flex items-center gap-2">
            {/* Search Box */}
            <div className="relative min-w-[200px]">
              <input
                type="text"
                placeholder="Search...."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-8 pl-2.5 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Top Right Action Buttons */}
            {activeTab === "REQUEST" && (
              <button
                onClick={() => setIsRequestModalOpen(true)}
                className="px-3 py-1 bg-white hover:bg-blue-50 border border-blue-600 text-blue-600 rounded text-xs font-semibold transition-colors shadow-2xs"
              >
                CREATE FUND TRANSFER REQUEST
              </button>
            )}

            {activeTab === "OUT" && (
              <button
                onClick={() => setIsDirectModalOpen(true)}
                className="px-3 py-1 bg-white hover:bg-blue-50 border border-blue-600 text-blue-600 rounded text-xs font-semibold transition-colors shadow-2xs"
              >
                DIRECT FUND TRANSFER
              </button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 2. MAIN 5 TABS: EXACT SCREENSHOT DESIGN */}
        {/* ------------------------------------------------------------- */}
        <div className="flex items-center gap-6 border-b border-slate-200 mt-3 pt-1 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab("REQUEST");
              setCurrentPage(1);
            }}
            className={`pb-2 tracking-wide uppercase transition-colors whitespace-nowrap ${
              activeTab === "REQUEST"
                ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            FUND TRANSFER REQUEST
          </button>
          <button
            onClick={() => {
              setActiveTab("OUT");
              setCurrentPage(1);
            }}
            className={`pb-2 tracking-wide uppercase transition-colors whitespace-nowrap ${
              activeTab === "OUT"
                ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            FUND TRANSFER OUT
          </button>
          <button
            onClick={() => {
              setActiveTab("IN_TRANSIT");
              setCurrentPage(1);
            }}
            className={`pb-2 tracking-wide uppercase transition-colors whitespace-nowrap ${
              activeTab === "IN_TRANSIT"
                ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            FUND TRANSFER IN TRANSIT
          </button>
          <button
            onClick={() => {
              setActiveTab("IN_RECEIVED");
              setCurrentPage(1);
            }}
            className={`pb-2 tracking-wide uppercase transition-colors whitespace-nowrap ${
              activeTab === "IN_RECEIVED"
                ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            FUND TRANSFER IN/RECEIVED
          </button>
          <button
            onClick={() => {
              setActiveTab("RETURN");
              setCurrentPage(1);
            }}
            className={`pb-2 tracking-wide uppercase transition-colors whitespace-nowrap ${
              activeTab === "RETURN"
                ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            FUND TRANSFER RETURN
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 3. FILTER TOOLBAR PER TAB */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-3">
          {/* TAB 1, 3, 5: Req./Receive Office Filter */}
          {(activeTab === "REQUEST" || activeTab === "IN_TRANSIT" || activeTab === "RETURN") && (
            <div className="flex items-end gap-2.5 max-w-sm">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Req./Receive Office</label>
                <select
                  value={reqOfficeFilter}
                  onChange={(e) => setReqOfficeFilter(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                >
                  <option value="ALL">Req./Receive Office</option>
                  {officeList.filter((o) => o.id !== "ALL").map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                className="px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
              >
                View
              </button>
            </div>
          )}

          {/* TAB 2: From/Sending Office Filter */}
          {activeTab === "OUT" && (
            <div className="flex items-end gap-2.5 max-w-sm">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">From/Sending Office</label>
                <select
                  value={sendingOfficeFilter}
                  onChange={(e) => setSendingOfficeFilter(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                >
                  <option value="ALL">From/Sending Office</option>
                  {officeList.filter((o) => o.id !== "ALL").map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                className="px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
              >
                View
              </button>
            </div>
          )}

          {/* TAB 4: Both Offices + Date Range */}
          {activeTab === "IN_RECEIVED" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">From/Sending Office</label>
                <select
                  value={sendingOfficeFilter}
                  onChange={(e) => setSendingOfficeFilter(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                >
                  <option value="ALL">From/Sending Office</option>
                  {officeList.filter((o) => o.id !== "ALL").map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Req./Receive Office</label>
                <select
                  value={reqOfficeFilter}
                  onChange={(e) => setReqOfficeFilter(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                >
                  <option value="ALL">Req./Receive Office</option>
                  {officeList.filter((o) => o.id !== "ALL").map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  className="px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                >
                  View
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. MAIN DATA TABLES PER TAB */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {/* TAB 1: FUND TRANSFER REQUEST TABLE (Screenshot 1) */}
          {activeTab === "REQUEST" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-24">Request Date</th>
                  <th className="py-2 px-3 w-24">Expect Date</th>
                  <th className="py-2 px-3 w-24">Req Code</th>
                  <th className="py-2 px-3 w-36">Out Code</th>
                  <th className="py-2 px-3 w-40">Req Office</th>
                  <th className="py-2 px-3 w-40">Responsible Person</th>
                  <th className="py-2 px-3 text-right w-28">Req Amount</th>
                  <th className="py-2 px-3 text-right w-28">Approve Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                  <th className="py-2 px-3 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No fund transfer requests found.
                    </td>
                  </tr>
                ) : (
                  paginatedTransfers.map((t, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-500">{sl}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">{t.requestDate}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">{t.expectedDate}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{t.reqCode || ""}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{t.outCode || t.transferNumber}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{t.toOfficeName}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700">{t.responsiblePerson}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800 whitespace-nowrap">
                          {t.requestedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {t.approvedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className={`font-semibold ${statusOf(t.status).tone}`}>{statusOf(t.status).label}</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="row-actions flex items-center justify-center gap-1.5 text-slate-400">
                            <button
                              type="button"
                              onClick={() => setViewingTransfer(t)}
                              title="View"
                              aria-label={`View ${t.reqCode || t.transferNumber}`}
                              className={`${iconButton} hover:text-blue-600`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {isAwaitingApproval(t.status) && (
                              <button
                                type="button"
                                onClick={() => setActionOn({ kind: "approve", transfer: t })}
                                title="Approve"
                                aria-label={`Approve ${t.reqCode || t.transferNumber}`}
                                className={`${iconButton} hover:text-emerald-600`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 2: FUND TRANSFER OUT TABLE (Screenshot 2) */}
          {activeTab === "OUT" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-24">Date</th>
                  <th className="py-2 px-3 w-24">Req Code</th>
                  <th className="py-2 px-3 w-36">Out Code</th>
                  <th className="py-2 px-3 w-36">From/Sending Office</th>
                  <th className="py-2 px-3 w-40">Req./Receive Office</th>
                  <th className="py-2 px-3 w-36">Responsible Person</th>
                  <th className="py-2 px-3 text-right w-28">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                  <th className="py-2 px-3 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No fund transfer out records found.
                    </td>
                  </tr>
                ) : (
                  paginatedTransfers.map((t, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-500">{sl}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">{t.date || t.requestDate}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{t.reqCode || ""}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{t.outCode || t.transferNumber}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{t.fromOfficeName}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{t.toOfficeName}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700">{t.responsiblePerson}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {t.transferredAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className={`font-semibold ${statusOf(t.status).tone}`}>{statusOf(t.status).label}</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="row-actions flex items-center justify-center gap-1.5 text-slate-400">
                            {isApproved(t.status) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setActionOn({ kind: "dispatch", transfer: t })}
                                  title="Payment"
                                  aria-label={`Send payment for ${t.outCode || t.transferNumber}`}
                                  className={`${iconButton} hover:text-emerald-600`}
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelReason("");
                                    setActionOn({ kind: "cancel", transfer: t });
                                  }}
                                  title="Cancel"
                                  aria-label={`Cancel ${t.outCode || t.transferNumber}`}
                                  className={`${iconButton} hover:text-rose-600`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setViewingTransfer(t)}
                              title="View"
                              className="hover:text-blue-600 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 3: FUND TRANSFER IN TRANSIT TABLE (Screenshot 3) */}
          {activeTab === "IN_TRANSIT" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-28">Pay Date</th>
                  <th className="py-2 px-3 w-24">Req Code</th>
                  <th className="py-2 px-3 w-36">Out Code</th>
                  <th className="py-2 px-3 w-36">From/Sending Office</th>
                  <th className="py-2 px-3 w-40">Req./Receive Office</th>
                  <th className="py-2 px-3 w-36">Responsible Person</th>
                  <th className="py-2 px-3 text-right w-28">Sent Amount</th>
                  <th className="py-2 px-3 text-right w-28">Received Amount</th>
                  <th className="py-2 px-3 text-right w-28">Remaining Amount</th>
                  <th className="py-2 px-3 text-center w-24">In/Receive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No fund transfers currently in transit.
                    </td>
                  </tr>
                ) : (
                  paginatedTransfers.map((t, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-500">{sl}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">{t.payDate || t.requestDate}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{t.reqCode || ""}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{t.outCode}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{t.fromOfficeName}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{t.toOfficeName}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700">{t.responsiblePerson}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {(t.sentAmount || t.transferredAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                          {t.receivedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-blue-600 whitespace-nowrap">
                          {(t.remainingAmount || t.transferredAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => setReceiveTarget(t)}
                            title="Receive Fund"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 4: FUND TRANSFER IN/RECEIVED TABLE (Screenshot 4) */}
          {activeTab === "IN_RECEIVED" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-24">Receive Date</th>
                  <th className="py-2 px-3 w-20">Req Code</th>
                  <th className="py-2 px-3 w-32">Out Code</th>
                  <th className="py-2 px-3 w-32">Receive Code</th>
                  <th className="py-2 px-3 w-36">From/Sending Office</th>
                  <th className="py-2 px-3 w-40">Req./Receive Office</th>
                  <th className="py-2 px-3 w-32">Responsible Person</th>
                  <th className="py-2 px-3 w-32">Received Person</th>
                  <th className="py-2 px-3 w-32">Transaction Type</th>
                  <th className="py-2 px-3 text-right w-28">Receive Amount</th>
                  <th className="py-2 px-3 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      No received fund transfers found.
                    </td>
                  </tr>
                ) : (
                  paginatedTransfers.map((t, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-500">{sl}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">{t.receiveDate || "10/12/2026"}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{t.reqCode || ""}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{t.outCode}</td>
                        <td className="py-2 px-3 font-mono text-blue-600 whitespace-nowrap">{t.receiveCode || "FTR-MG261000001"}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{t.fromOfficeName}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{t.toOfficeName}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700">{t.responsiblePerson}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700">{t.receivedPerson || "MD. Tofajjol Hossin"}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">{t.transactionType || "Bank Transfer"}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {(t.receiveAmount || t.receivedAmount || t.transferredAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => setViewingTransfer(t)}
                            title="View"
                            className="text-slate-400 hover:text-blue-600 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 5: FUND TRANSFER RETURN TABLE (Screenshot 5) */}
          {activeTab === "RETURN" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-28">Date</th>
                  <th className="py-2 px-3 w-32">Return Code</th>
                  <th className="py-2 px-3 w-24">Req Code</th>
                  <th className="py-2 px-3 w-32">Out Code</th>
                  <th className="py-2 px-3 w-36">From/Sending Office</th>
                  <th className="py-2 px-3 w-40">Req./Receive Office</th>
                  <th className="py-2 px-3 w-36">Responsible Person</th>
                  <th className="py-2 px-3 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No returned fund transfers recorded.
                    </td>
                  </tr>
                ) : (
                  paginatedTransfers.map((t, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-500">{sl}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">{t.date || t.requestDate}</td>
                        <td className="py-2 px-3 font-mono text-rose-600 font-medium whitespace-nowrap">{t.returnCode || "RET-MG261000001"}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{t.reqCode || ""}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{t.outCode}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{t.fromOfficeName}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{t.toOfficeName}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700">{t.responsiblePerson}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {t.requestedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 5. TABLE FOOTER / PAGINATION (Matches Screenshots) */}
        {/* ------------------------------------------------------------- */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-end gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white text-slate-700 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              {totalRows === 0 ? "0-0 of 0" : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, totalRows)} of ${totalRows}`}
            </span>

            <div className="flex items-center gap-1">
              <button aria-label="Previous page"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button aria-label="Next page"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. MODAL: CREATE FUND TRANSFER REQUEST */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title="Create Fund Transfer Request"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRequestSubmit} className="space-y-3.5 text-xs">
          {formError && (
            <p role="alert" className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ft-request-date" className="block font-medium text-slate-700 mb-1">Request Date *</label>
              <input id="ft-request-date" type="date" required value={form.requestDate} onChange={(e) => setForm({ ...form, requestDate: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="ft-office" className="block font-medium text-slate-700 mb-1">Req./Receiving Office *</label>
              <select id="ft-office" value={form.toOfficeName} onChange={(e) => setForm({ ...form, toOfficeName: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500">
                {officeList.filter((o) => o.id !== "ALL").map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ft-type" className="block font-medium text-slate-700 mb-1">Req./Receive Type *</label>
              <select
                id="ft-type"
                value={form.receiveType}
                onChange={(e) => setForm({ ...form, receiveType: e.target.value as "Cash" | "Bank", toAccountId: "" })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
            <div>
              <label htmlFor="ft-head" className="block font-medium text-slate-700 mb-1">Select Cash/Bank *</label>
              <select id="ft-head" required value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500">
                <option value="">{form.receiveType === "Bank" ? "Select bank" : "Select cash"}</option>
                {receiveHeads.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ft-person" className="block font-medium text-slate-700 mb-1">Responsible Person</label>
              <select id="ft-person" value={form.responsiblePerson} onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500">
                <option value="">Responsible Person</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ft-expected" className="block font-medium text-slate-700 mb-1">Expected Date *</label>
              <input id="ft-expected" type="date" required value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="ft-amount" className="block font-medium text-slate-700 mb-1">Request Amount (৳) *</label>
              <input
                id="ft-amount"
                type="number"
                required
                min="1"
                step="0.01"
                placeholder="Request Amount"
                value={form.requestedAmount || ""}
                onChange={(e) => setForm({ ...form, requestedAmount: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 font-mono text-right"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ft-remarks" className="block font-medium text-slate-700 mb-1">Remarks</label>
              <input id="ft-remarks" type="text" placeholder="Remarks" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRequestModalOpen(false)}
              className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button disabled={pending === "request"}
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
            >{pending === "request" && <Spinner className="size-3.5" />}
              Submit Request
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 7. MODAL: DIRECT FUND TRANSFER */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isDirectModalOpen}
        onClose={() => setIsDirectModalOpen(false)}
        title="Direct Fund Transfer"
        maxWidth="lg"
      >
        <form onSubmit={handleDirectTransferSubmit} className="space-y-3.5 text-xs">
          {formError && (
            <p role="alert" className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Source Office *</label>
              <select
                value={form.fromOfficeName}
                onChange={(e) => setForm({ ...form, fromOfficeName: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                {officeList.filter((o) => o.id !== "ALL").map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Destination Office *</label>
              <select
                value={form.toOfficeName}
                onChange={(e) => setForm({ ...form, toOfficeName: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                {officeList.filter((o) => o.id !== "ALL").map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Source Bank/Cash Head *</label>
              <select
                value={form.fromAccountId}
                onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}
                required
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select source head</option>
                {cashBankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Destination Head *</label>
              <select
                value={form.toAccountId}
                onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}
                required
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select destination head</option>
                {cashBankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Direct Transfer Amount (৳) *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                placeholder="0.00"
                value={form.requestedAmount || ""}
                onChange={(e) => setForm({ ...form, requestedAmount: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Responsible Officer *</label>
              <input
                type="text"
                required
                value={form.responsiblePerson}
                onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Transfer Remarks *</label>
            <textarea
              required
              rows={2}
              placeholder="Immediate inter-unit direct fund dispatch..."
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDirectModalOpen(false)}
              className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button disabled={pending === "direct"}
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
            >{pending === "direct" && <Spinner className="size-3.5" />}
              Execute Direct Transfer
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 8. MODAL: VIEW TRANSFER DETAILS */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(viewingTransfer)}
        onClose={() => setViewingTransfer(null)}
        title={viewingTransfer ? `Transfer Voucher: ${viewingTransfer.outCode || viewingTransfer.transferNumber}` : ""}
        maxWidth="md"
      >
        {viewingTransfer && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">From Sending Office:</span>
                <span className="font-semibold text-slate-800">{viewingTransfer.fromOfficeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">To Receiving Office:</span>
                <span className="font-semibold text-slate-800">{viewingTransfer.toOfficeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium text-slate-800">{viewingTransfer.date || viewingTransfer.requestDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Responsible Person:</span>
                <span className="font-medium text-slate-800">{viewingTransfer.responsiblePerson}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-blue-600">{viewingTransfer.status}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-semibold text-slate-700">Amount:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ৳{(viewingTransfer.transferredAmount || viewingTransfer.requestedAmount).toLocaleString()}
                </span>
              </div>
            </div>
            <div>
              <span className="font-semibold text-slate-700 block mb-0.5">Remarks / Purpose:</span>
              <p className="p-2 bg-white rounded border border-slate-200 text-slate-600">
                {viewingTransfer.purpose}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingTransfer(null)}
                className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 9. MODAL: RECEIVE IN-TRANSIT FUND */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(receiveTarget)}
        onClose={() => setReceiveTarget(null)}
        title="Receive In-Transit Fund"
        maxWidth="sm"
      >
        {receiveTarget && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-700">
              Confirm receiving <strong>৳{(receiveTarget.remainingAmount || receiveTarget.transferredAmount).toLocaleString()}</strong> dispatched from{" "}
              <strong>{receiveTarget.fromOfficeName}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceiveTarget(null)}
                className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button disabled={pending === "receive"}
                type="button"
                onClick={handleConfirmReceive}
                className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-2xs transition"
              >{pending === "receive" && <Spinner className="size-3.5" />}
                Confirm Receive
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      <ConfirmDialog
        open={actionOn !== null}
        title={actionOn?.kind === "approve" ? "Approve fund transfer?" : actionOn?.kind === "dispatch" ? "Send this payment?" : "Cancel fund transfer?"}
        confirmLabel={actionOn?.kind === "approve" ? "Approve" : actionOn?.kind === "dispatch" ? "Send Payment" : "Cancel Transfer"}
        busy={pending === "transfer-action"}
        message={
          actionOn && (
            <div className="space-y-3">
              <p>
                {actionOn.kind === "approve"
                  ? `Approve ${actionOn.transfer.requestedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} for ${actionOn.transfer.toOfficeName}.`
                  : actionOn.kind === "dispatch"
                    ? `${(actionOn.transfer.approvedAmount || actionOn.transfer.requestedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} will be posted from ${actionOn.transfer.fromOfficeName} and shown as in transit to ${actionOn.transfer.toOfficeName}.`
                    : `${actionOn.transfer.outCode || actionOn.transfer.transferNumber} will be marked as returned.`}
              </p>
              {actionOn.kind === "cancel" && (
                <label className="block text-xs font-medium text-ink">
                  Reason <span className="text-rose-600">*</span>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={2}
                    maxLength={300}
                    className="mt-1 w-full rounded border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-blue-500 focus:outline-none"
                  />
                </label>
              )}
            </div>
          )
        }
        onClose={() => setActionOn(null)}
        onConfirm={async () => {
          if (!actionOn) return;
          if (actionOn.kind === "cancel" && !cancelReason.trim()) {
            toast.error("Enter why the transfer is cancelled.", { title: "Reason needed" });
            return;
          }
          const t = actionOn.transfer;
          const ok = await run("transfer-action", () =>
            actionOn.kind === "approve"
              ? approveTransfer(t.id, t.requestedAmount)
              : actionOn.kind === "dispatch"
                ? dispatchTransfer(t.id)
                : returnTransfer(t.id, cancelReason.trim()),
          );
          if (!ok) return;
          toast.success(actionOn.kind === "approve" ? "Transfer approved." : actionOn.kind === "dispatch" ? "Payment sent; the transfer is in transit." : "Transfer cancelled.");
          setActionOn(null);
        }}
      />
    </div>
  );
}
