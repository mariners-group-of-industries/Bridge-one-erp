"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { ChequeBookItem } from "@/features/accounts/types";

type TabKey = "REGISTER" | "OUTGOING_REPORT" | "POST_DATE_REPORT" | "RECEIVE_REPORT";

// -------------------------------------------------------------
// Bridge One Branded Empty State (Replacing Legacy "AKIJ iBOS")
// -------------------------------------------------------------
function BridgeOneEmptyState() {
  return (
    <div className="py-24 flex flex-col items-center justify-center select-none bg-white">
      <img
        src="/logo.png"
        alt="BridgeOne Logo"
        className="h-11 w-auto max-w-[190px] object-contain mb-2"
      />
      <p className="text-xs text-slate-400 font-medium tracking-wide">No Data Found</p>
    </div>
  );
}

export default function ChequeSetupPage() {
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
  const [fromDate, setFromDate] = useState("2026-09-12");
  const [toDate, setToDate] = useState("2026-10-13");
  const [receiveFilter, setReceiveFilter] = useState<"ALL" | "DEPOSITED" | "NOT_DEPOSITED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination states
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [isNewChequeOpen, setIsNewChequeOpen] = useState(false);
  const [newChequeModalMode, setNewChequeModalMode] = useState<"BOOK" | "ISSUE">("BOOK");
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [viewBook, setViewBook] = useState<ChequeBookItem | null>(null);
  const [editBook, setEditBook] = useState<ChequeBookItem | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Forms
  const [bookForm, setBookForm] = useState({
    bookName: "",
    bankAccountId: "ba-9",
    bankName: "DUTCH-BANGLA BANK LTD PLC",
    branchName: "MOHAKHALI",
    accountNumber: "1141100508628",
    startChequeNumber: "CD 0161770",
    endChequeNumber: "CD 0161819",
    status: "Running" as const,
  });

  const [issueForm, setIssueForm] = useState({
    bankAccountId: "ba-9",
    bankName: "DUTCH-BANGLA BANK LTD PLC",
    chequeBookId: "cb-1",
    chequeNumber: "CD 0161715",
    payeeName: "",
    issueDate: new Date().toISOString().split("T")[0],
    chequeDate: new Date().toISOString().split("T")[0],
    amount: 0,
    purpose: "Vendor payment",
    referenceVoucher: "JV-CHQ-2026",
    status: "ISSUED" as const,
  });

  const [receiveForm, setReceiveForm] = useState({
    chequeNumber: "",
    customerName: "",
    bankName: "DUTCH-BANGLA BANK LTD PLC",
    branchName: "Dhaka Main",
    receivedDate: new Date().toISOString().split("T")[0],
    chequeDate: new Date().toISOString().split("T")[0],
    amount: 0,
    depositStatus: "NOT_DEPOSITED" as const,
    remarks: "",
  });

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
        branchName: bank.branchName || "MOHAKHALI",
        accountNumber: bank.accountNumber,
      });
    }
  };

  // Save new cheque book
  const handleSaveBook = (e: React.FormEvent) => {
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

    const res = addChequeBook({ ...bookForm, totalLeaves });
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
  const handleSaveIssue = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!issueForm.payeeName || !issueForm.chequeNumber || issueForm.amount <= 0) {
      setErrorMessage("Please complete all required fields with a valid amount.");
      return;
    }

    const res = issueCheque({
      ...issueForm,
      status: new Date(issueForm.chequeDate) > new Date() ? "POST_DATED" : "ISSUED",
    });

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
  const handleSaveReceivedCheque = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!receiveForm.chequeNumber || !receiveForm.customerName || receiveForm.amount <= 0) {
      setErrorMessage("Please complete all required fields with a valid amount.");
      return;
    }

    const res = addReceivedCheque(receiveForm);
    setSuccessMessage(res.message);
    setTimeout(() => {
      setIsReceiveModalOpen(false);
      setSuccessMessage("");
      setReceiveForm({
        chequeNumber: "",
        customerName: "",
        bankName: "DUTCH-BANGLA BANK LTD PLC",
        branchName: "Dhaka Main",
        receivedDate: new Date().toISOString().split("T")[0],
        chequeDate: new Date().toISOString().split("T")[0],
        amount: 0,
        depositStatus: "NOT_DEPOSITED",
        remarks: "",
      });
    }, 800);
  };

  // Save edited book
  const handleSaveEditBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBook) return;
    updateChequeBook(editBook.id, {
      bookName: editBook.bookName,
      branchName: editBook.branchName,
      status: editBook.status,
    });
    setEditBook(null);
  };



  return (
    <div className="space-y-0 font-sans pb-16 bg-[#f8fafc] min-h-screen">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP TAB NAVIGATION BAR (Matching Screenshot 1 to 4) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-b border-slate-200 px-4 pt-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
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
                ? "bg-[#eaf2fd] text-blue-700 border-blue-600"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent"
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
                ? "bg-[#eaf2fd] text-blue-700 border-blue-600"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent"
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
                ? "bg-[#eaf2fd] text-blue-700 border-blue-600"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent"
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
                ? "bg-[#eaf2fd] text-blue-700 border-blue-600"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent"
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
              className="w-48 sm:w-60 h-8 pl-8 pr-3 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {activeTab === "RECEIVE_REPORT" ? (
            <button
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
            </button>
          ) : (
            <button
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
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER TOOLBAR (Tailored for each active tab) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-4 text-xs">
        {/* TAB 1: Cheque Register Filters */}
        {activeTab === "REGISTER" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Bank Account</label>
              <select
                value={selectedBank}
                onChange={(e) => {
                  setSelectedBank(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 w-56 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <label className="text-[11px] font-semibold text-slate-600">Book Name</label>
              <select
                value={selectedBookName}
                onChange={(e) => {
                  setSelectedBookName(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 w-60 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="h-8 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded transition flex items-center gap-1"
                  title="Reset Filters"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
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
              <label className="text-[11px] font-semibold text-slate-600">Bank Account</label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="h-8 w-56 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <label className="text-[11px] font-semibold text-slate-600">Book Name</label>
              <select
                value={selectedBookName}
                onChange={(e) => setSelectedBookName(e.target.value)}
                className="h-8 w-60 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <label className="text-[11px] font-semibold text-slate-600">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-36 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-36 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end self-end">
              <button
                type="button"
                className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
              >
                View
              </button>
            </div>
          </>
        )}

        {/* TAB 3: Post Date Cheque Report Filters */}
        {activeTab === "POST_DATE_REPORT" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Bank Account</label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="h-8 w-56 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <label className="text-[11px] font-semibold text-slate-600">Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="h-8 w-60 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <label className="text-[11px] font-semibold text-slate-600">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-36 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-36 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end self-end">
              <button
                type="button"
                className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
              >
                View
              </button>
            </div>
          </>
        )}

        {/* TAB 4: Receive Cheque Report Filters */}
        {activeTab === "RECEIVE_REPORT" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-36 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-36 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4 pt-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="receiveRadio"
                  checked={receiveFilter === "ALL"}
                  onChange={() => setReceiveFilter("ALL")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>All</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="receiveRadio"
                  checked={receiveFilter === "DEPOSITED"}
                  onChange={() => setReceiveFilter("DEPOSITED")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Deposited</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="receiveRadio"
                  checked={receiveFilter === "NOT_DEPOSITED"}
                  onChange={() => setReceiveFilter("NOT_DEPOSITED")}
                  className="text-blue-600 focus:ring-blue-500"
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
      <div className="bg-white border-b border-slate-200">
        {/* ========================================================= */}
        {/* TAB 1: CHEQUE REGISTER TABLE (Matching Screenshot 1) */}
        {/* ========================================================= */}
        {activeTab === "REGISTER" && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
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
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {paginatedBooks.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <BridgeOneEmptyState />
                      </td>
                    </tr>
                  ) : (
                    paginatedBooks.map((b, idx) => (
                      <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-3.5 py-2 font-medium text-slate-500">
                          {(currentPage - 1) * rowsPerPage + idx + 1}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-slate-400">
                            <button
                              type="button"
                              onClick={() => setViewBook(b)}
                              className="hover:text-blue-600 transition p-0.5"
                              title="View Cheque Book"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditBook(b)}
                              className="hover:text-emerald-600 transition p-0.5"
                              title="Edit Cheque Book"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3.5 py-2 font-mono text-slate-700">{b.accountNumber}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-900">{b.bankName}</td>
                        <td className="px-3.5 py-2 text-slate-600">{b.branchName || "Main"}</td>
                        <td className="px-3.5 py-2 font-mono text-slate-700">{b.startChequeNumber}</td>
                        <td className="px-3.5 py-2 font-mono text-slate-700">{b.endChequeNumber}</td>
                        <td className="px-3.5 py-2 text-center font-mono font-medium text-slate-800">
                          {b.totalLeaves}
                        </td>
                        <td className="px-3.5 py-2 text-slate-800 font-medium">{b.bookName}</td>
                        <td className="px-3.5 py-2">
                          <span className="text-[#16a34a] font-semibold text-xs">
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
            <div className="px-4 py-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>
                  Showing{" "}
                  <strong className="text-slate-800 font-semibold">
                    {filteredRegisterBooks.length === 0
                      ? "0–0"
                      : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(
                          currentPage * rowsPerPage,
                          filteredRegisterBooks.length,
                        )}`}
                  </strong>{" "}
                  of <strong className="text-slate-800 font-semibold">{filteredRegisterBooks.length}</strong> Rows
                </span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-slate-300 rounded px-2 py-0.5 text-xs bg-white text-slate-700 focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-400"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 text-white font-bold text-xs">
                  {currentPage}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage * rowsPerPage >= filteredRegisterBooks.length}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-400"
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
          <div>
            {outgoingCheques.length === 0 ? (
              <BridgeOneEmptyState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    <tr>
                      <th className="px-3.5 py-2.5 w-12">SL</th>
                      <th className="px-3.5 py-2.5">Cheque No</th>
                      <th className="px-3.5 py-2.5">Bank Name</th>
                      <th className="px-3.5 py-2.5">Payee</th>
                      <th className="px-3.5 py-2.5">Cheque Date</th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-slate-900">Amount (৳)</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {outgoingCheques.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-blue-50/30">
                        <td className="px-3.5 py-2 text-slate-500 font-medium">{idx + 1}</td>
                        <td className="px-3.5 py-2 font-mono font-bold text-blue-600">{c.chequeNumber}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-900">{c.bankName}</td>
                        <td className="px-3.5 py-2 text-slate-800 font-medium">{c.payeeName}</td>
                        <td className="px-3.5 py-2 text-slate-600">{c.chequeDate}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900">
                          ৳{c.amount.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              c.status === "CLEARED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : c.status === "POST_DATED"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
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
          <div>
            {postDateCheques.length === 0 ? (
              <BridgeOneEmptyState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    <tr>
                      <th className="px-3.5 py-2.5 w-12">SL</th>
                      <th className="px-3.5 py-2.5">Cheque No</th>
                      <th className="px-3.5 py-2.5">Bank Name</th>
                      <th className="px-3.5 py-2.5">Supplier / Payee</th>
                      <th className="px-3.5 py-2.5">Cheque Date</th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-slate-900">Amount (৳)</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {postDateCheques.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-blue-50/30">
                        <td className="px-3.5 py-2 text-slate-500 font-medium">{idx + 1}</td>
                        <td className="px-3.5 py-2 font-mono font-bold text-blue-600">{c.chequeNumber}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-900">{c.bankName}</td>
                        <td className="px-3.5 py-2 text-slate-800 font-medium">{c.payeeName}</td>
                        <td className="px-3.5 py-2 text-amber-700 font-medium">{c.chequeDate}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900">
                          ৳{c.amount.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
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
          <div>
            {filteredReceivedCheques.length === 0 ? (
              <BridgeOneEmptyState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    <tr>
                      <th className="px-3.5 py-2.5 w-12">SL</th>
                      <th className="px-3.5 py-2.5">Cheque No</th>
                      <th className="px-3.5 py-2.5">Customer / Payer</th>
                      <th className="px-3.5 py-2.5">Bank Name</th>
                      <th className="px-3.5 py-2.5">Received Date</th>
                      <th className="px-3.5 py-2.5">Cheque Date</th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-slate-900">Amount (৳)</th>
                      <th className="px-3.5 py-2.5 text-center">Deposit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredReceivedCheques.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-blue-50/30">
                        <td className="px-3.5 py-2 text-slate-500 font-medium">{idx + 1}</td>
                        <td className="px-3.5 py-2 font-mono font-bold text-blue-600">{r.chequeNumber}</td>
                        <td className="px-3.5 py-2 text-slate-900 font-medium">{r.customerName}</td>
                        <td className="px-3.5 py-2 text-slate-700">{r.bankName}</td>
                        <td className="px-3.5 py-2 text-slate-600">{r.receivedDate}</td>
                        <td className="px-3.5 py-2 text-slate-600">{r.chequeDate}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900">
                          ৳{r.amount.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              r.depositStatus === "DEPOSITED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
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
          <div className="flex border-b border-slate-200 pb-2 gap-4">
            <button
              type="button"
              onClick={() => setNewChequeModalMode("BOOK")}
              className={`pb-1 font-semibold text-xs transition border-b-2 ${
                newChequeModalMode === "BOOK"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Register Cheque Book
            </button>
            <button
              type="button"
              onClick={() => setNewChequeModalMode("ISSUE")}
              className={`pb-1 font-semibold text-xs transition border-b-2 ${
                newChequeModalMode === "ISSUE"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Issue Bank Cheque
            </button>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              {successMessage}
            </div>
          )}

          {newChequeModalMode === "BOOK" ? (
            <form onSubmit={handleSaveBook} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Bank Account *</label>
                <select
                  value={bookForm.bankAccountId}
                  onChange={(e) => handleBankChangeInForm(e.target.value)}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white text-slate-800"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} — A/C: {b.accountNumber} ({b.branchName || "Main"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cheque Book Name / Reference *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DBBL Cheque Book - Commercial 01"
                  value={bookForm.bookName}
                  onChange={(e) => setBookForm({ ...bookForm, bookName: e.target.value })}
                  className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={bookForm.branchName}
                    onChange={(e) => setBookForm({ ...bookForm, branchName: e.target.value })}
                    className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={bookForm.status}
                    onChange={(e) => setBookForm({ ...bookForm, status: e.target.value as any })}
                    className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white text-slate-800"
                  >
                    <option value="Running">Running</option>
                    <option value="ACTIVE">Active</option>
                    <option value="EXHAUSTED">Exhausted</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Cheque # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CD 0161770"
                    value={bookForm.startChequeNumber}
                    onChange={(e) => setBookForm({ ...bookForm, startChequeNumber: e.target.value })}
                    className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Cheque # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CD 0161819"
                    value={bookForm.endChequeNumber}
                    onChange={(e) => setBookForm({ ...bookForm, endChequeNumber: e.target.value })}
                    className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewChequeOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
                >
                  Register Cheque Book
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveIssue} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Bank Account *</label>
                <select
                  value={issueForm.bankAccountId}
                  onChange={(e) => {
                    const b = bankAccounts.find((x) => x.id === e.target.value);
                    setIssueForm({
                      ...issueForm,
                      bankAccountId: e.target.value,
                      bankName: b?.bankName || issueForm.bankName,
                    });
                  }}
                  className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white text-slate-800"
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
                  <label className="block font-semibold text-slate-700 mb-1">Cheque Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CD 0161715"
                    value={issueForm.chequeNumber}
                    onChange={(e) => setIssueForm({ ...issueForm, chequeNumber: e.target.value })}
                    className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (৳) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={issueForm.amount || ""}
                    onChange={(e) => setIssueForm({ ...issueForm, amount: Number(e.target.value) })}
                    className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payee Name (Vendor / Supplier) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meghna Group of Industries"
                  value={issueForm.payeeName}
                  onChange={(e) => setIssueForm({ ...issueForm, payeeName: e.target.value })}
                  className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cheque Date *</label>
                  <input
                    type="date"
                    required
                    value={issueForm.chequeDate}
                    onChange={(e) => setIssueForm({ ...issueForm, chequeDate: e.target.value })}
                    className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={issueForm.issueDate}
                    onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })}
                    className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Purpose / Narration</label>
                <input
                  type="text"
                  placeholder="e.g. Raw material procurement settlement"
                  value={issueForm.purpose}
                  onChange={(e) => setIssueForm({ ...issueForm, purpose: e.target.value })}
                  className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewChequeOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
                >
                  Issue Cheque
                </button>
              </div>
            </form>
          )}
        </div>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: + RECEIVE CHEQUE */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        title="Receive Customer Cheque"
        subtitle="Record received party cheques for bank deposit & clearing"
        maxWidth="md"
      >
        <form onSubmit={handleSaveReceivedCheque} className="space-y-3 text-xs">
          {errorMessage && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              {successMessage}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Customer / Payer Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Square Pharmaceuticals Ltd"
              value={receiveForm.customerName}
              onChange={(e) => setReceiveForm({ ...receiveForm, customerName: e.target.value })}
              className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cheque Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. CHQ-99120"
                value={receiveForm.chequeNumber}
                onChange={(e) => setReceiveForm({ ...receiveForm, chequeNumber: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Amount (৳) *</label>
              <input
                type="number"
                min="1"
                required
                value={receiveForm.amount || ""}
                onChange={(e) => setReceiveForm({ ...receiveForm, amount: Number(e.target.value) })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={receiveForm.bankName}
                onChange={(e) => setReceiveForm({ ...receiveForm, bankName: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Deposit Status</label>
              <select
                value={receiveForm.depositStatus}
                onChange={(e) => setReceiveForm({ ...receiveForm, depositStatus: e.target.value as any })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white text-slate-800"
              >
                <option value="NOT_DEPOSITED">Not Deposited</option>
                <option value="DEPOSITED">Deposited</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Received Date</label>
              <input
                type="date"
                value={receiveForm.receivedDate}
                onChange={(e) => setReceiveForm({ ...receiveForm, receivedDate: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cheque Date</label>
              <input
                type="date"
                value={receiveForm.chequeDate}
                onChange={(e) => setReceiveForm({ ...receiveForm, chequeDate: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
            <input
              type="text"
              placeholder="e.g. Sales delivery settlement"
              value={receiveForm.remarks}
              onChange={(e) => setReceiveForm({ ...receiveForm, remarks: e.target.value })}
              className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsReceiveModalOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Confirm Received Cheque
            </button>
          </div>
        </form>
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
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Bank Name</span>
                <span className="font-bold text-slate-900">{viewBook.bankName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Branch Name</span>
                <span className="font-semibold text-slate-800">{viewBook.branchName || "Main"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Account Number</span>
                <span className="font-mono text-slate-800 font-semibold">{viewBook.accountNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status</span>
                <span className="text-[#16a34a] font-bold">
                  {viewBook.status === "ACTIVE" ? "Running" : viewBook.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center p-3 border border-slate-200 rounded">
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Total Leaf</span>
                <span className="text-base font-bold text-slate-800">{viewBook.totalLeaves}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Used Leaves</span>
                <span className="text-base font-bold text-amber-600">{viewBook.usedLeaves}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Remaining</span>
                <span className="text-base font-bold text-emerald-600">{viewBook.remainingLeaves}</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/50 rounded border border-blue-100">
              <span className="text-[10px] font-semibold text-blue-700 uppercase block mb-1">Serial Range</span>
              <div className="flex items-center justify-between font-mono font-bold text-slate-800">
                <span>Start: {viewBook.startChequeNumber}</span>
                <span className="text-slate-400">→</span>
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
              <label className="block font-semibold text-slate-700 mb-1">Book Name</label>
              <input
                type="text"
                required
                value={editBook.bookName}
                onChange={(e) => setEditBook({ ...editBook, bookName: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Branch Name</label>
              <input
                type="text"
                value={editBook.branchName || ""}
                onChange={(e) => setEditBook({ ...editBook, branchName: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={editBook.status}
                onChange={(e) => setEditBook({ ...editBook, status: e.target.value as any })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white text-slate-800"
              >
                <option value="Running">Running</option>
                <option value="ACTIVE">Active</option>
                <option value="EXHAUSTED">Exhausted</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditBook(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold"
              >
                Save Changes
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
    </div>
  );
}
