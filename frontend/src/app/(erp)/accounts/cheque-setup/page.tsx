"use client";

import { toast } from "@/components/purchase/Toast";
import { Spinner } from "@/components/ui/spinner";
import { usePending } from "@/hooks/use-pending";
import Image from "next/image";
import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import { localToday } from "@/features/purchase/lib/client";
import type { ChequeBookItem } from "@/features/accounts/types";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";

type TabKey = "REGISTER" | "OUTGOING_REPORT" | "POST_DATE_REPORT" | "RECEIVE_REPORT";

// -------------------------------------------------------------
// Bridge One Branded Empty State (Replacing Legacy "AKIJ iBOS")
// -------------------------------------------------------------
function BridgeOneEmptyState() {
  return (
    <div className="py-24 flex flex-col items-center justify-center select-none bg-surface">
      <Image
        src="/logo.png"
        width={8452}
        height={1738}
        alt="BridgeOne Logo"
        className="h-11 w-auto max-w-[190px] object-contain mb-2"
      />
      <p className="text-xs text-ink-faint font-medium tracking-wide">No Data Found</p>
    </div>
  );
}

let nextReceiveRowId = 1;

export default function ChequeSetupPage() {
  const perms = useFeaturePermissions("/accounts/cheque-setup");
  const chequeIssuePerms = useFeaturePermissions("/accounts/cheque-issue");
  const { pending, run } = usePending();
  const syncDatabase = useAccountingStore((s) => s.syncDatabase);
  const chequeBooks = useAccountingStore((s) => s.chequeBooks);
  const cheques = useAccountingStore((s) => s.cheques);
  const rawReceivedCheques = useAccountingStore((s) => s.receivedCheques);
  const receivedCheques = useMemo(() => rawReceivedCheques ?? [], [rawReceivedCheques]);
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const addChequeBook = useAccountingStore((s) => s.addChequeBook);
  const updateChequeBook = useAccountingStore((s) => s.updateChequeBook);
  const issueCheque = useAccountingStore((s) => s.issueCheque);
  const addReceivedCheque = useAccountingStore((s) => s.addReceivedCheque);

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabKey>("REGISTER");

  // Filter states
  const [selectedBank, setSelectedBank] = useState("Bank");
  const [selectedBookName, setSelectedBookName] = useState("Select Book Name");
  const [selectedSupplier, setSelectedSupplier] = useState("Select Supplier");
  // This month until today.
  const [fromDate, setFromDate] = useState(() => `${localToday().slice(0, 8)}01`);
  const [toDate, setToDate] = useState(() => localToday());
  const [receiveFilter, setReceiveFilter] = useState<"ALL" | "DEPOSITED" | "NOT_DEPOSITED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination states
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [isNewChequeOpen, setIsNewChequeOpen] = useState(false);
  const [isChequeCardCollapsed, setIsChequeCardCollapsed] = useState(false);
  const [newChequeModalMode, setNewChequeModalMode] = useState<"BOOK" | "ISSUE">("BOOK");
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [viewBook, setViewBook] = useState<ChequeBookItem | null>(null);
  const [editBook, setEditBook] = useState<ChequeBookItem | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Forms
  const [bookForm, setBookForm] = useState({
    bookName: "",
    bankAccountId: "",
    bankName: "",
    branchName: "",
    accountNumber: "",
    prefix: "",
    startChequeNumber: "",
    endChequeNumber: "",
    totalLeaves: 0,
    status: "Running" as const,
  });

  const [issueForm, setIssueForm] = useState({
    bankAccountId: "",
    bankName: "",
    chequeBookId: "",
    chequeNumber: "",
    payeeName: "",
    issueDate: localToday(),
    chequeDate: localToday(),
    amount: 0,
    purpose: "",
    referenceVoucher: "",
    status: "ISSUED" as const,
  });
  /** The bank account chosen on a form, or the first one until the user picks. */
  const bankOf = (id: string) => bankAccounts.find((b) => b.id === id) ?? bankAccounts[0];

  const [receiveForm, setReceiveForm] = useState({
    chequeNumber: "",
    customerName: "",
    bankName: "",
    branchName: "",
    receivedDate: new Date().toISOString().split("T")[0],
    chequeDate: new Date().toISOString().split("T")[0],
    amount: 0,
    depositStatus: "NOT_DEPOSITED" as const,
    remarks: "",
  });

  const blankReceiveRow = () => ({
    key: `r-${nextReceiveRowId++}`,
    date: localToday(),
    customerName: "",
    bankName: "",
    instrumentNo: "",
    instrumentDate: localToday(),
    amount: 0,
  });
  const [receiveRows, setReceiveRows] = useState([blankReceiveRow()]);

  // Unique bank options for filter
  const bankOptions = useMemo(() => {
    const list = Array.from(new Set(chequeBooks.map((b) => b.bankName)));
    return list;
  }, [chequeBooks]);

  // Unique book name options for filter
  const bookNameOptions = useMemo(() => {
    const list = Array.from(new Set(chequeBooks.map((b) => b.bookName)));
    return list;
  }, [chequeBooks]);

  // Unique supplier / payee options
  const supplierOptions = useMemo(() => {
    const list = Array.from(new Set(cheques.map((c) => c.payeeName)));
    return list;
  }, [cheques]);

  // Filtered Cheque Register books
  const filteredRegisterBooks = useMemo(() => {
    return chequeBooks.filter((b) => {
      if (selectedBank !== "Bank" && selectedBank !== "All") {
        if (b.bankName.toLowerCase() !== selectedBank.toLowerCase()) return false;
      }
      if (selectedBookName !== "Select Book Name" && selectedBookName !== "All") {
        if (b.bookName.toLowerCase() !== selectedBookName.toLowerCase()) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const m =
          b.bookName.toLowerCase().includes(q) ||
          b.bankName.toLowerCase().includes(q) ||
          b.accountNumber.includes(q) ||
          b.startChequeNumber.toLowerCase().includes(q) ||
          b.endChequeNumber.toLowerCase().includes(q) ||
          (b.branchName && b.branchName.toLowerCase().includes(q));
        if (!m) return false;
      }
      return true;
    });
  }, [chequeBooks, selectedBank, selectedBookName, searchQuery]);

  // Paginated books for Tab 1
  const paginatedBooks = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRegisterBooks.slice(start, start + rowsPerPage);
  }, [filteredRegisterBooks, currentPage, rowsPerPage]);

  // Outgoing cheques matching filters
  const outgoingCheques = useMemo(() => {
    return cheques.filter((c) => {
      if (selectedBank !== "Bank" && selectedBank !== "All") {
        if (c.bankName.toLowerCase() !== selectedBank.toLowerCase()) return false;
      }
      if (selectedBookName !== "Select Book Name" && selectedBookName !== "All") {
        const book = chequeBooks.find((b) => b.id === c.chequeBookId);
        if (book && book.bookName.toLowerCase() !== selectedBookName.toLowerCase()) return false;
      }
      if (fromDate && c.chequeDate < fromDate) return false;
      if (toDate && c.chequeDate > toDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const m =
          c.chequeNumber.toLowerCase().includes(q) ||
          c.payeeName.toLowerCase().includes(q) ||
          c.bankName.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [cheques, chequeBooks, selectedBank, selectedBookName, fromDate, toDate, searchQuery]);

  // Post-dated cheques matching filters
  const postDateCheques = useMemo(() => {
    return cheques.filter((c) => {
      const isPostDated = c.status === "POST_DATED" || new Date(c.chequeDate) > new Date();
      if (!isPostDated) return false;

      if (selectedBank !== "Bank" && selectedBank !== "All") {
        if (c.bankName.toLowerCase() !== selectedBank.toLowerCase()) return false;
      }
      if (selectedSupplier !== "Select Supplier" && selectedSupplier !== "All") {
        if (c.payeeName.toLowerCase() !== selectedSupplier.toLowerCase()) return false;
      }
      if (fromDate && c.chequeDate < fromDate) return false;
      if (toDate && c.chequeDate > toDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const m =
          c.chequeNumber.toLowerCase().includes(q) ||
          c.payeeName.toLowerCase().includes(q) ||
          c.bankName.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [cheques, selectedBank, selectedSupplier, fromDate, toDate, searchQuery]);

  // Received cheques matching filters
  const filteredReceivedCheques = useMemo(() => {
    return receivedCheques.filter((r) => {
      if (receiveFilter === "DEPOSITED" && r.depositStatus !== "DEPOSITED") return false;
      if (receiveFilter === "NOT_DEPOSITED" && r.depositStatus !== "NOT_DEPOSITED") return false;
      if (fromDate && r.chequeDate < fromDate) return false;
      if (toDate && r.chequeDate > toDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const m =
          r.chequeNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.bankName.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [receivedCheques, receiveFilter, fromDate, toDate, searchQuery]);

  // Bank selection helper for create modal
  const handleBankChangeInForm = (bankId: string) => {
    const bank = bankAccounts.find((b) => b.id === bankId);
    if (bank) {
      setBookForm({
        ...bookForm,
        bankAccountId: bank.id,
        bankName: bank.bankName,
        branchName: bank.branchName || "",
        accountNumber: bank.accountNumber,
      });
    }
  };

  // Save new cheque book
  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!bookForm.bookName || !bookForm.startChequeNumber || !bookForm.endChequeNumber) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    const start = parseInt(bookForm.startChequeNumber.replace(/\D/g, "")) || 0;
    const end = parseInt(bookForm.endChequeNumber.replace(/\D/g, "")) || 0;
    const totalLeaves = Math.max(1, end - start + 1);

    const bank = bankOf(bookForm.bankAccountId);
    if (!bank) {
      setErrorMessage("Add a bank account under Finance & Banking first.");
      return;
    }
    const res = await run("book", () => addChequeBook({
      ...bookForm,
      bankAccountId: bank.id,
      bankName: bank.bankName,
      branchName: bank.branchName || "",
      accountNumber: bank.accountNumber,
      totalLeaves,
    }));
    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    setSuccessMessage(res.message);
    setTimeout(() => {
      setIsNewChequeOpen(false);
      setSuccessMessage("");
    }, 800);
  };

  // Issue cheque
  const handleSaveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!issueForm.payeeName || !issueForm.chequeNumber || issueForm.amount <= 0) {
      setErrorMessage("Please complete all required fields with a valid amount.");
      return;
    }

    const bank = bankOf(issueForm.bankAccountId);
    if (!bank) {
      setErrorMessage("Add a bank account under Finance & Banking first.");
      return;
    }
    // The running cheque book of that bank account.
    const book = chequeBooks.find((b) => b.bankAccountId === bank.id && b.status !== "EXHAUSTED" && b.status !== "CANCELLED");
    const res = await run("issue", () => issueCheque({
      ...issueForm,
      bankAccountId: bank.id,
      bankName: bank.bankName,
      chequeBookId: book?.id ?? "",
      status: issueForm.chequeDate > localToday() ? "POST_DATED" : "ISSUED",
    }));

    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    setSuccessMessage(res.message);
    setTimeout(() => {
      setIsNewChequeOpen(false);
      setSuccessMessage("");
    }, 800);
  };

  // Save received cheque
  const _handleSaveReceivedCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!receiveForm.chequeNumber || !receiveForm.customerName || receiveForm.amount <= 0) {
      setErrorMessage("Please complete all required fields with a valid amount.");
      return;
    }

    const res = await run("received", () => addReceivedCheque(receiveForm));
    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }
    setSuccessMessage(res.message);
    setTimeout(() => {
      setIsReceiveModalOpen(false);
      setSuccessMessage("");
      setReceiveForm({
        chequeNumber: "",
        customerName: "",
        bankName: "",
        branchName: "",
        receivedDate: new Date().toISOString().split("T")[0],
        chequeDate: new Date().toISOString().split("T")[0],
        amount: 0,
        depositStatus: "NOT_DEPOSITED",
        remarks: "",
      });
    }, 800);
  };

  // Save edited book
  const handleSaveEditBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBook) return;
    const res = await run("editBook", () => updateChequeBook(editBook.id, {
      bookName: editBook.bookName,
      branchName: editBook.branchName,
      status: editBook.status,
    }));
    if (!res.success) {
      toast.error(res.message, { title: "Not saved" });
      return;
    }
    toast.success(res.message);
    setEditBook(null);
  };

  const handleSaveAllReceivedCheques = async () => {
    const validRows = receiveRows.filter((r) => r.amount > 0 && r.customerName.trim());
    if (validRows.length === 0) {
      toast.error("Please enter at least one valid cheque with customer and amount.");
      return;
    }
    await run("received", async () => {
      for (const row of validRows) {
        await addReceivedCheque({
          chequeNumber: row.instrumentNo || `CHQ-${Date.now().toString().slice(-5)}`,
          customerName: row.customerName,
          bankName: row.bankName || "Corporate Bank",
          branchName: "Principal Branch",
          receivedDate: row.date,
          chequeDate: row.instrumentDate,
          amount: Number(row.amount),
          depositStatus: "NOT_DEPOSITED",
          remarks: "Customer Received Cheque",
        });
      }
    });
    toast.success(`${validRows.length} cheque(s) received successfully.`);
    setIsReceiveModalOpen(false);
    setReceiveRows([blankReceiveRow()]);
  };

  // -------------------------------------------------------------
  // FULL-PAGE MANAGERIUM VIEW: Create Cheque Setup (Screenshot 5)
  // -------------------------------------------------------------
  if (isNewChequeOpen) {
    const inputCls =
      "h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
    return (
      <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6 text-slate-800">
        <div className="bg-white border border-slate-200/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNewChequeOpen(false)}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Create Cheque Setup</h1>
          </div>
          <button
            type="submit"
            form="create-cheque-setup-form"
            disabled={pending === "book"}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {pending === "book" && <Spinner className="size-3.5" />}
            Save
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden mb-3">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-t bg-[#e6f2fb] text-blue-700 border-b-2 border-blue-600 transition"
              >
                Cheque Info
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsChequeCardCollapsed(!isChequeCardCollapsed)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition"
            >
              {isChequeCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!isChequeCardCollapsed && (
            <form id="create-cheque-setup-form" onSubmit={handleSaveBook} className="p-4 space-y-3.5">
              {errorMessage && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-medium text-xs">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium text-xs">
                  {successMessage}
                </div>
              )}

              {/* Row 1: Bank Account, Account Number, Bank Name, Branch Name, Prefix, Start No */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Bank Account
                  </label>
                  <select
                    value={bankOf(bookForm.bankAccountId)?.id ?? ""}
                    onChange={(e) => handleBankChangeInForm(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select Bank Account</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.accountNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Account Number
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={bookForm.accountNumber || ""}
                    placeholder="Account Number"
                    className="h-8 w-full border border-slate-200 bg-slate-100 rounded px-2.5 text-xs text-slate-700 cursor-default"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Bank Name
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={bookForm.bankName || ""}
                    placeholder="Bank Name"
                    className="h-8 w-full border border-slate-200 bg-slate-100 rounded px-2.5 text-xs text-slate-700 cursor-default"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Branch Name
                  </label>
                  <input
                    type="text"
                    value={bookForm.branchName || ""}
                    onChange={(e) => setBookForm({ ...bookForm, branchName: e.target.value })}
                    placeholder="Branch Name"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Prefix
                  </label>
                  <input
                    type="text"
                    value={bookForm.prefix || ""}
                    onChange={(e) => setBookForm({ ...bookForm, prefix: e.target.value })}
                    placeholder="Prefix"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Start No
                  </label>
                  <input
                    type="text"
                    required
                    value={bookForm.startChequeNumber}
                    onChange={(e) => {
                      const start = e.target.value;
                      const sNum = parseInt(start.replace(/\D/g, "")) || 0;
                      const eNum = parseInt(bookForm.endChequeNumber.replace(/\D/g, "")) || 0;
                      const total = eNum >= sNum && sNum > 0 ? eNum - sNum + 1 : bookForm.totalLeaves;
                      setBookForm({ ...bookForm, startChequeNumber: start, totalLeaves: total });
                    }}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Row 2: End No, Total Leaf, Book Name */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>End No
                  </label>
                  <input
                    type="text"
                    required
                    value={bookForm.endChequeNumber}
                    onChange={(e) => {
                      const end = e.target.value;
                      const sNum = parseInt(bookForm.startChequeNumber.replace(/\D/g, "")) || 0;
                      const eNum = parseInt(end.replace(/\D/g, "")) || 0;
                      const total = eNum >= sNum && sNum > 0 ? eNum - sNum + 1 : bookForm.totalLeaves;
                      setBookForm({ ...bookForm, endChequeNumber: end, totalLeaves: total });
                    }}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Total Leaf
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={bookForm.totalLeaves || ""}
                    onChange={(e) => setBookForm({ ...bookForm, totalLeaves: Number(e.target.value) })}
                    placeholder="Total Leaf"
                    className={inputCls}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Book Name
                  </label>
                  <input
                    type="text"
                    required
                    value={bookForm.bookName}
                    onChange={(e) => setBookForm({ ...bookForm, bookName: e.target.value })}
                    placeholder="Book Name"
                    className={inputCls}
                  />
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULL-PAGE MANAGERIUM VIEW: Create Receive Cheque
  // -------------------------------------------------------------
  if (isReceiveModalOpen) {
    const receiveTotal = receiveRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    return (
      <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6 text-slate-800">
        <div className="bg-white border border-slate-200/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsReceiveModalOpen(false)}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Create Receive Cheque</h1>
          </div>
          <button
            type="button"
            onClick={handleSaveAllReceivedCheques}
            disabled={pending === "received"}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {pending === "received" && <Spinner className="size-3.5" />}
            Save
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#e6f2fb] border-b border-slate-200 text-slate-800 font-semibold text-[11px]">
                  <th className="py-2.5 px-3 w-12 text-center">SL</th>
                  <th className="py-2.5 px-3 w-32">Date</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Customer Name</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Bank Name</th>
                  <th className="py-2.5 px-3 w-36">Instrument No</th>
                  <th className="py-2.5 px-3 w-32">Instrument Date</th>
                  <th className="py-2.5 px-3 w-32 text-right">Amount</th>
                  <th className="py-2.5 px-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receiveRows.map((r, idx) => {
                  const set = (patch: Partial<typeof r>) =>
                    setReceiveRows(receiveRows.map((x) => (x.key === r.key ? { ...x, ...patch } : x)));
                  return (
                    <tr key={r.key} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-center">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                          {idx === 0 ? "New" : idx + 1}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={r.date}
                          onChange={(e) => set({ date: e.target.value })}
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={r.customerName}
                          onChange={(e) => set({ customerName: e.target.value })}
                          placeholder="Customer"
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={r.bankName}
                          onChange={(e) => set({ bankName: e.target.value })}
                          placeholder="Bank Account"
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={r.instrumentNo}
                          onChange={(e) => set({ instrumentNo: e.target.value })}
                          placeholder="Instrument No"
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={r.instrumentDate}
                          onChange={(e) => set({ instrumentDate: e.target.value })}
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.amount || ""}
                          onChange={(e) => set({ amount: parseFloat(e.target.value) || 0 })}
                          placeholder="Amount"
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-mono"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setReceiveRows([
                                ...receiveRows.slice(0, idx + 1),
                                blankReceiveRow(),
                                ...receiveRows.slice(idx + 1),
                              ])
                            }
                            className="text-emerald-600 hover:text-emerald-800 text-base font-bold"
                            title="Add row"
                          >
                            +
                          </button>
                          {receiveRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setReceiveRows(receiveRows.filter((x) => x.key !== r.key))}
                              className="text-slate-400 hover:text-rose-600"
                              title="Delete row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white border-t border-slate-200 px-6 py-2.5 flex items-center justify-end gap-3 text-xs">
            <span className="font-bold text-slate-700">Total:</span>
            <span className="font-bold font-mono text-slate-900 text-sm">
              {receiveTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0 font-sans bg-canvas flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP TAB NAVIGATION BAR (Matching Screenshot 1 to 4) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface border-b border-line px-4 pt-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs shrink-0">
        {/* Four Tabs */}
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("REGISTER");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 font-bold tracking-wide transition border-b-2 whitespace-nowrap rounded-t-md ${
              activeTab === "REGISTER"
                ? "bg-grid-head text-blue-700 dark:text-blue-300 border-blue-600"
                : "text-ink-muted hover:text-ink hover:bg-canvas border-transparent"
            }`}
          >
            Cheque Register
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("OUTGOING_REPORT");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 font-bold tracking-wide transition border-b-2 whitespace-nowrap rounded-t-md ${
              activeTab === "OUTGOING_REPORT"
                ? "bg-grid-head text-blue-700 dark:text-blue-300 border-blue-600"
                : "text-ink-muted hover:text-ink hover:bg-canvas border-transparent"
            }`}
          >
            Outgoing Cheque Report
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("POST_DATE_REPORT");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 font-bold tracking-wide transition border-b-2 whitespace-nowrap rounded-t-md ${
              activeTab === "POST_DATE_REPORT"
                ? "bg-grid-head text-blue-700 dark:text-blue-300 border-blue-600"
                : "text-ink-muted hover:text-ink hover:bg-canvas border-transparent"
            }`}
          >
            Post Date Cheque Report
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("RECEIVE_REPORT");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 font-bold tracking-wide transition border-b-2 whitespace-nowrap rounded-t-md ${
              activeTab === "RECEIVE_REPORT"
                ? "bg-grid-head text-blue-700 dark:text-blue-300 border-blue-600"
                : "text-ink-muted hover:text-ink hover:bg-canvas border-transparent"
            }`}
          >
            Receive Cheque Report
          </button>
        </div>

        {/* Right side search + action button */}
        <div className="flex items-center gap-2 pb-2">
          {/* Search bar (active on reports or anytime) */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search..."
              className="w-48 sm:w-60 h-8 pl-8 pr-3 text-xs border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-surface placeholder:text-ink-faint"
            />
            <Search className="w-3.5 h-3.5 text-ink-faint absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {activeTab === "RECEIVE_REPORT" ? (
            (perms.create ? (<button
              type="button"
              onClick={() => {
                setErrorMessage("");
                setSuccessMessage("");
                setIsReceiveModalOpen(true);
              }}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Receive Cheque</span>
            </button>) : null)
          ) : (
            (perms.create ? (<button
              type="button"
              onClick={() => {
                setErrorMessage("");
                setSuccessMessage("");
                setIsNewChequeOpen(true);
              }}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Cheque</span>
            </button>) : null)
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER TOOLBAR (Tailored for each active tab) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface border-b border-line px-4 py-3 flex flex-wrap items-center gap-4 text-xs shrink-0">
        {/* TAB 1: Cheque Register Filters */}
        {activeTab === "REGISTER" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Bank Account</label>
              <select
                value={selectedBank}
                onChange={(e) => {
                  setSelectedBank(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 w-56 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Bank">Bank</option>
                <option value="All">All Banks</option>
                {bankOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Book Name</label>
              <select
                value={selectedBookName}
                onChange={(e) => {
                  setSelectedBookName(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 w-60 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Select Book Name">Select Book Name</option>
                <option value="All">All Books</option>
                {bookNameOptions.map((bName) => (
                  <option key={bName} value={bName}>
                    {bName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end self-end">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
              >
                View
              </button>
            </div>

            {(selectedBank !== "Bank" || selectedBookName !== "Select Book Name" || searchQuery) && (
              <div className="flex items-end self-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBank("Bank");
                    setSelectedBookName("Select Book Name");
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="h-8 px-3 border border-line hover:bg-canvas text-ink-muted text-xs rounded transition flex items-center gap-1"
                  title="Reset Filters"
                >
                  <RotateCcw className="w-3 h-3 text-ink-faint" />
                  <span>Reset</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* TAB 2: Outgoing Cheque Report Filters */}
        {activeTab === "OUTGOING_REPORT" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Bank Account</label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="h-8 w-56 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Bank">Bank</option>
                <option value="All">All Banks</option>
                {bankOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Book Name</label>
              <select
                value={selectedBookName}
                onChange={(e) => setSelectedBookName(e.target.value)}
                className="h-8 w-60 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Select Book Name">Select Book Name</option>
                <option value="All">All Books</option>
                {bookNameOptions.map((bName) => (
                  <option key={bName} value={bName}>
                    {bName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-36 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-36 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end self-end">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
              
 onClick={() => void run("view", () => syncDatabase())}
 disabled={pending === "view"}
>
                {pending === "view" && <Spinner className="size-3.5" />}View
              </button>
            </div>
          </>
        )}

        {/* TAB 3: Post Date Cheque Report Filters */}
        {activeTab === "POST_DATE_REPORT" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Bank Account</label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="h-8 w-56 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Bank">Bank</option>
                <option value="All">All Banks</option>
                {bankOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="h-8 w-60 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Select Supplier">Select Supplier</option>
                <option value="All">All Suppliers</option>
                {supplierOptions.map((sup) => (
                  <option key={sup} value={sup}>
                    {sup}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-36 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-36 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end self-end">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
              
 onClick={() => void run("view", () => syncDatabase())}
 disabled={pending === "view"}
>
                {pending === "view" && <Spinner className="size-3.5" />}View
              </button>
            </div>
          </>
        )}

        {/* TAB 4: Receive Cheque Report Filters */}
        {activeTab === "RECEIVE_REPORT" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-36 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-36 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4 pt-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-ink-muted">
                <input
                  type="radio"
                  name="receiveRadio"
                  checked={receiveFilter === "ALL"}
                  onChange={() => setReceiveFilter("ALL")}
                  className="text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                />
                <span>All</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-ink-muted">
                <input
                  type="radio"
                  name="receiveRadio"
                  checked={receiveFilter === "DEPOSITED"}
                  onChange={() => setReceiveFilter("DEPOSITED")}
                  className="text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                />
                <span>Deposited</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-ink-muted">
                <input
                  type="radio"
                  name="receiveRadio"
                  checked={receiveFilter === "NOT_DEPOSITED"}
                  onChange={() => setReceiveFilter("NOT_DEPOSITED")}
                  className="text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                />
                <span>Not Deposited</span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN CONTENT BODY */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface border-b border-line flex-1 min-h-0 flex flex-col print:block">
        {/* ========================================================= */}
        {/* TAB 1: CHEQUE REGISTER TABLE (Matching Screenshot 1) */}
        {/* ========================================================= */}
        {activeTab === "REGISTER" && (
          <div className="flex-1 min-h-0 flex flex-col print:block">
            <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas border-b border-line text-[11px] font-bold text-ink-muted uppercase tracking-wide">
                  <tr>
                    <th className="px-3.5 py-2.5 w-12">SL</th>
                    <th className="px-3 py-2.5 w-16 text-center">Action</th>
                    <th className="px-3.5 py-2.5">Account Number</th>
                    <th className="px-3.5 py-2.5">Bank Name</th>
                    <th className="px-3.5 py-2.5">Branch Name</th>
                    <th className="px-3.5 py-2.5">Start No</th>
                    <th className="px-3.5 py-2.5">End No</th>
                    <th className="px-3.5 py-2.5 text-center">Total Leaf</th>
                    <th className="px-3.5 py-2.5">Book Name</th>
                    <th className="px-3.5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {paginatedBooks.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <BridgeOneEmptyState />
                      </td>
                    </tr>
                  ) : (
                    paginatedBooks.map((b, idx) => (
                      <tr key={b.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-500/10 transition-colors">
                        <td className="px-3.5 py-2 font-medium text-ink-faint">
                          {(currentPage - 1) * rowsPerPage + idx + 1}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="row-actions flex items-center justify-center gap-1.5 text-ink-faint">
                            <button
                              type="button"
                              onClick={() => setViewBook(b)}
                              className="hover:text-blue-600 dark:hover:text-blue-400 transition p-0.5"
                              title="View Cheque Book"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button disabled={!perms.edit}
                              type="button"
                              onClick={() => setEditBook(b)}
                              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition p-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={!perms.edit ? needsPermission("edit") : "Edit Cheque Book"}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3.5 py-2 font-mono text-ink-muted">{b.accountNumber}</td>
                        <td className="px-3.5 py-2 font-semibold text-ink">{b.bankName}</td>
                        <td className="px-3.5 py-2 text-ink-muted">{b.branchName || "Main"}</td>
                        <td className="px-3.5 py-2 font-mono text-ink-muted">{b.startChequeNumber}</td>
                        <td className="px-3.5 py-2 font-mono text-ink-muted">{b.endChequeNumber}</td>
                        <td className="px-3.5 py-2 text-center font-mono font-medium text-ink">
                          {b.totalLeaves}
                        </td>
                        <td className="px-3.5 py-2 text-ink font-medium">{b.bookName}</td>
                        <td className="px-3.5 py-2">
                          <span className="text-success font-semibold text-xs">
                            {b.status === "ACTIVE" ? "Running" : b.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer (Matching Screenshot 1) */}
            <div className="px-4 py-2 border-t border-line flex flex-wrap items-center justify-between gap-4 text-xs text-ink-faint shrink-0">
              <div className="flex items-center gap-2">
                <span>
                  Showing{" "}
                  <strong className="text-ink font-semibold">
                    {filteredRegisterBooks.length === 0
                      ? "0–0"
                      : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(
                          currentPage * rowsPerPage,
                          filteredRegisterBooks.length,
                        )}`}
                  </strong>{" "}
                  of <strong className="text-ink font-semibold">{filteredRegisterBooks.length}</strong> Rows
                </span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-line-strong rounded px-2 py-0.5 text-xs bg-surface text-ink-muted focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button aria-label="Previous page"
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-control disabled:opacity-30 disabled:pointer-events-none text-ink-faint"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 text-white font-bold text-xs">
                  {currentPage}
                </span>
                <button aria-label="Next page"
                  type="button"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage * rowsPerPage >= filteredRegisterBooks.length}
                  className="p-1 rounded hover:bg-control disabled:opacity-30 disabled:pointer-events-none text-ink-faint"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: OUTGOING CHEQUE REPORT (Matching Screenshot 2) */}
        {/* ========================================================= */}
        {activeTab === "OUTGOING_REPORT" && (
          <div className="flex-1 min-h-0 flex flex-col print:block">
            {outgoingCheques.length === 0 ? (
              <BridgeOneEmptyState />
            ) : (
              <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas border-b border-line text-[11px] font-bold text-ink-muted uppercase tracking-wide">
                    <tr>
                      <th className="px-3.5 py-2.5 w-12">SL</th>
                      <th className="px-3.5 py-2.5">Cheque No</th>
                      <th className="px-3.5 py-2.5">Bank Name</th>
                      <th className="px-3.5 py-2.5">Payee</th>
                      <th className="px-3.5 py-2.5">Cheque Date</th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-ink">Amount (৳)</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink">
                    {outgoingCheques.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-500/10">
                        <td className="px-3.5 py-2 text-ink-faint font-medium">{idx + 1}</td>
                        <td className="px-3.5 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">{c.chequeNumber}</td>
                        <td className="px-3.5 py-2 font-semibold text-ink">{c.bankName}</td>
                        <td className="px-3.5 py-2 text-ink font-medium">{c.payeeName}</td>
                        <td className="px-3.5 py-2 text-ink-muted">{c.chequeDate}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-ink">
                          ৳{c.amount.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              c.status === "CLEARED"
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                                : c.status === "POST_DATED"
                                ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                                : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: POST DATE CHEQUE REPORT (Matching Screenshot 3) */}
        {/* ========================================================= */}
        {activeTab === "POST_DATE_REPORT" && (
          <div className="flex-1 min-h-0 flex flex-col print:block">
            {postDateCheques.length === 0 ? (
              <BridgeOneEmptyState />
            ) : (
              <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas border-b border-line text-[11px] font-bold text-ink-muted uppercase tracking-wide">
                    <tr>
                      <th className="px-3.5 py-2.5 w-12">SL</th>
                      <th className="px-3.5 py-2.5">Cheque No</th>
                      <th className="px-3.5 py-2.5">Bank Name</th>
                      <th className="px-3.5 py-2.5">Supplier / Payee</th>
                      <th className="px-3.5 py-2.5">Cheque Date</th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-ink">Amount (৳)</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink">
                    {postDateCheques.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-500/10">
                        <td className="px-3.5 py-2 text-ink-faint font-medium">{idx + 1}</td>
                        <td className="px-3.5 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">{c.chequeNumber}</td>
                        <td className="px-3.5 py-2 font-semibold text-ink">{c.bankName}</td>
                        <td className="px-3.5 py-2 text-ink font-medium">{c.payeeName}</td>
                        <td className="px-3.5 py-2 text-amber-700 dark:text-amber-300 font-medium">{c.chequeDate}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-ink">
                          ৳{c.amount.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                            POST DATED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: RECEIVE CHEQUE REPORT (Matching Screenshot 4) */}
        {/* ========================================================= */}
        {activeTab === "RECEIVE_REPORT" && (
          <div className="flex-1 min-h-0 flex flex-col print:block">
            {filteredReceivedCheques.length === 0 ? (
              <BridgeOneEmptyState />
            ) : (
              <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas border-b border-line text-[11px] font-bold text-ink-muted uppercase tracking-wide">
                    <tr>
                      <th className="px-3.5 py-2.5 w-12">SL</th>
                      <th className="px-3.5 py-2.5">Cheque No</th>
                      <th className="px-3.5 py-2.5">Customer / Payer</th>
                      <th className="px-3.5 py-2.5">Bank Name</th>
                      <th className="px-3.5 py-2.5">Received Date</th>
                      <th className="px-3.5 py-2.5">Cheque Date</th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-ink">Amount (৳)</th>
                      <th className="px-3.5 py-2.5 text-center">Deposit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink">
                    {filteredReceivedCheques.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-500/10">
                        <td className="px-3.5 py-2 text-ink-faint font-medium">{idx + 1}</td>
                        <td className="px-3.5 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">{r.chequeNumber}</td>
                        <td className="px-3.5 py-2 text-ink font-medium">{r.customerName}</td>
                        <td className="px-3.5 py-2 text-ink-muted">{r.bankName}</td>
                        <td className="px-3.5 py-2 text-ink-muted">{r.receivedDate}</td>
                        <td className="px-3.5 py-2 text-ink-muted">{r.chequeDate}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-ink">
                          ৳{r.amount.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              r.depositStatus === "DEPOSITED"
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                            }`}
                          >
                            {r.depositStatus === "DEPOSITED" ? "Deposited" : "Not Deposited"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: + NEW CHEQUE (Register Book or Issue Cheque) */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewChequeOpen}
        onClose={() => setIsNewChequeOpen(false)}
        title="Commercial Cheque Management"
        subtitle="Register new cheque book inventory or issue a bank cheque voucher"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          {/* Sub tabs inside modal */}
          <div className="flex border-b border-line pb-2 gap-4">
            <button
              type="button"
              onClick={() => setNewChequeModalMode("BOOK")}
              className={`pb-1 font-semibold text-xs transition border-b-2 ${
                newChequeModalMode === "BOOK"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
                  : "border-transparent text-ink-faint hover:text-ink"
              }`}
            >
              Register Cheque Book
            </button>
            {/* Issuing a cheque is a Cheque Issue record: it needs that page's Create permission. */}
            {chequeIssuePerms.create && <button
              type="button"
              onClick={() => setNewChequeModalMode("ISSUE")}
              className={`pb-1 font-semibold text-xs transition border-b-2 ${
                newChequeModalMode === "ISSUE"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
                  : "border-transparent text-ink-faint hover:text-ink"
              }`}
            >
              Issue Bank Cheque
            </button>}
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 font-medium">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium">
              {successMessage}
            </div>
          )}

          {newChequeModalMode === "BOOK" ? (
            <form onSubmit={handleSaveBook} className="space-y-3">
              <div>
                <label className="block font-semibold text-ink-muted mb-1">Select Bank Account *</label>
                <select
                  value={bankOf(bookForm.bankAccountId)?.id ?? ""}
                  onChange={(e) => handleBankChangeInForm(e.target.value)}
                  className="w-full h-8 border border-line-strong rounded px-2 text-xs bg-surface text-ink"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} — A/C: {b.accountNumber} ({b.branchName || "Main"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink-muted mb-1">Cheque Book Name / Reference *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DBBL Cheque Book - Commercial 01"
                  value={bookForm.bookName}
                  onChange={(e) => setBookForm({ ...bookForm, bookName: e.target.value })}
                  className="w-full h-8 border border-line-strong rounded px-2.5 text-xs text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-muted mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={bookForm.branchName}
                    onChange={(e) => setBookForm({ ...bookForm, branchName: e.target.value })}
                    className="w-full h-8 border border-line-strong rounded px-2.5 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-muted mb-1">Status</label>
                  <select
                    value={bookForm.status}
                    onChange={(e) => setBookForm({ ...bookForm, status: e.target.value as any })}
                    className="w-full h-8 border border-line-strong rounded px-2 text-xs bg-surface text-ink"
                  >
                    <option value="Running">Running</option>
                    <option value="ACTIVE">Active</option>
                    <option value="EXHAUSTED">Exhausted</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-muted mb-1">Start Cheque # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CD 0161770"
                    value={bookForm.startChequeNumber}
                    onChange={(e) => setBookForm({ ...bookForm, startChequeNumber: e.target.value })}
                    className="w-full h-8 border border-line-strong rounded px-2.5 text-xs font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-muted mb-1">End Cheque # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CD 0161819"
                    value={bookForm.endChequeNumber}
                    onChange={(e) => setBookForm({ ...bookForm, endChequeNumber: e.target.value })}
                    className="w-full h-8 border border-line-strong rounded px-2.5 text-xs font-mono text-ink"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsNewChequeOpen(false)}
                  className="px-3.5 py-1.5 border border-line-strong hover:bg-canvas text-ink-muted rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button disabled={pending === "book"}
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
                >{pending === "book" && <Spinner className="size-3.5" />}
                  Register Cheque Book
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveIssue} className="space-y-3">
              <div>
                <label className="block font-semibold text-ink-muted mb-1">Select Bank Account *</label>
                <select
                  value={bankOf(issueForm.bankAccountId)?.id ?? ""}
                  onChange={(e) => {
                    const b = bankAccounts.find((x) => x.id === e.target.value);
                    setIssueForm({
                      ...issueForm,
                      bankAccountId: e.target.value,
                      bankName: b?.bankName || issueForm.bankName,
                    });
                  }}
                  className="w-full h-8 border border-line-strong rounded px-2 text-xs bg-surface text-ink"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} — A/C: {b.accountNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-muted mb-1">Cheque Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CD 0161715"
                    value={issueForm.chequeNumber}
                    onChange={(e) => setIssueForm({ ...issueForm, chequeNumber: e.target.value })}
                    className="w-full h-8 border border-line-strong rounded px-2.5 text-xs font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-muted mb-1">Amount (৳) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={issueForm.amount || ""}
                    onChange={(e) => setIssueForm({ ...issueForm, amount: Number(e.target.value) })}
                    className="w-full h-8 border border-line-strong rounded px-2.5 text-xs font-mono text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink-muted mb-1">Payee Name (Vendor / Supplier) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meghna Group of Industries"
                  value={issueForm.payeeName}
                  onChange={(e) => setIssueForm({ ...issueForm, payeeName: e.target.value })}
                  className="w-full h-8 border border-line-strong rounded px-2.5 text-xs text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-muted mb-1">Cheque Date *</label>
                  <input
                    type="date"
                    required
                    value={issueForm.chequeDate}
                    onChange={(e) => setIssueForm({ ...issueForm, chequeDate: e.target.value })}
                    className="w-full h-8 border border-line-strong rounded px-2.5 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-muted mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={issueForm.issueDate}
                    onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })}
                    className="w-full h-8 border border-line-strong rounded px-2.5 text-xs text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink-muted mb-1">Purpose / Narration</label>
                <input
                  type="text"
                  placeholder="e.g. Raw material procurement settlement"
                  value={issueForm.purpose}
                  onChange={(e) => setIssueForm({ ...issueForm, purpose: e.target.value })}
                  className="w-full h-8 border border-line-strong rounded px-2.5 text-xs text-ink"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsNewChequeOpen(false)}
                  className="px-3.5 py-1.5 border border-line-strong hover:bg-canvas text-ink-muted rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button disabled={pending === "issue"}
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
                >{pending === "issue" && <Spinner className="size-3.5" />}
                  Issue Cheque
                </button>
              </div>
            </form>
          )}
        </div>
      </ModalDialog>



      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: VIEW CHEQUE BOOK DETAILS */}
      {/* ------------------------------------------------------------- */}
      {viewBook && (
        <ModalDialog
          isOpen={!!viewBook}
          onClose={() => setViewBook(null)}
          title="Cheque Book Details"
          subtitle={viewBook.bookName}
          maxWidth="md"
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-canvas rounded border border-line">
              <div>
                <span className="text-ink-faint block text-[10px] uppercase font-semibold">Bank Name</span>
                <span className="font-bold text-ink">{viewBook.bankName}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[10px] uppercase font-semibold">Branch Name</span>
                <span className="font-semibold text-ink">{viewBook.branchName || "Main"}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[10px] uppercase font-semibold">Account Number</span>
                <span className="font-mono text-ink font-semibold">{viewBook.accountNumber}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[10px] uppercase font-semibold">Status</span>
                <span className="text-success font-bold">
                  {viewBook.status === "ACTIVE" ? "Running" : viewBook.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center p-3 border border-line rounded">
              <div>
                <span className="text-ink-faint block text-[10px] font-semibold">Total Leaf</span>
                <span className="text-base font-bold text-ink">{viewBook.totalLeaves}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[10px] font-semibold">Used Leaves</span>
                <span className="text-base font-bold text-amber-600 dark:text-amber-400">{viewBook.usedLeaves}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[10px] font-semibold">Remaining</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{viewBook.remainingLeaves}</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/50 dark:bg-blue-500/10 rounded border border-blue-100 dark:border-blue-500/30">
              <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase block mb-1">Serial Range</span>
              <div className="flex items-center justify-between font-mono font-bold text-ink">
                <span>Start: {viewBook.startChequeNumber}</span>
                <span className="text-ink-faint">→</span>
                <span>End: {viewBook.endChequeNumber}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewBook(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: EDIT CHEQUE BOOK */}
      {/* ------------------------------------------------------------- */}
      {editBook && (
        <ModalDialog
          isOpen={!!editBook}
          onClose={() => setEditBook(null)}
          title="Edit Cheque Book"
          subtitle={`A/C: ${editBook.accountNumber} • ${editBook.bankName}`}
          maxWidth="sm"
        >
          <form onSubmit={handleSaveEditBook} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-ink-muted mb-1">Book Name</label>
              <input
                type="text"
                required
                value={editBook.bookName}
                onChange={(e) => setEditBook({ ...editBook, bookName: e.target.value })}
                className="w-full h-8 border border-line-strong rounded px-2.5 text-xs text-ink"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink-muted mb-1">Branch Name</label>
              <input
                type="text"
                value={editBook.branchName || ""}
                onChange={(e) => setEditBook({ ...editBook, branchName: e.target.value })}
                className="w-full h-8 border border-line-strong rounded px-2.5 text-xs text-ink"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink-muted mb-1">Status</label>
              <select
                value={editBook.status}
                onChange={(e) => setEditBook({ ...editBook, status: e.target.value as any })}
                className="w-full h-8 border border-line-strong rounded px-2 text-xs bg-surface text-ink"
              >
                <option value="Running">Running</option>
                <option value="ACTIVE">Active</option>
                <option value="EXHAUSTED">Exhausted</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setEditBook(null)}
                className="px-3.5 py-1.5 border border-line-strong text-ink-muted rounded text-xs font-semibold"
              >
                Cancel
              </button>
              <button disabled={pending === "editBook"}
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold"
              >{pending === "editBook" && <Spinner className="size-3.5" />}
                Save Changes
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
    </div>
  );
}
