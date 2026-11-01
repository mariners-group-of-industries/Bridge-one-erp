"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Search,
  CheckCircle,
  Key,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type CounterTab = "COUNTER_SETUP" | "MESSAGE_SETUP" | "CURRENCY_NOTE_SETUP" | "SEQUENCE_SETUP";

interface PosCounterRecord {
  id: string;
  counterCode: string;
  counterName: string;
  officeName: string;
  warehouseName: string;
  floorName: string;
  userName: string;
  baseUrl: string;
  token: string | null;
  isEcommerce: boolean;
  exeVersion: string;
  status: "Active" | "Inactive";
}

interface MessageSetupRecord {
  id: string;
  body: string;
  user: string;
  date: string;
  isActive: boolean;
}

interface CurrencyNoteRecord {
  id: string;
  currencyName: string;
  noteValue: number;
  noteType: "Note" | "Coin";
  isActive: boolean;
}

interface SequenceSetupRecord {
  id: string;
  officeName: string;
  prefix: string;
  startingNo: number;
  currentNo: number;
  isActive: boolean;
}

const INITIAL_COUNTERS: PosCounterRecord[] = [
  {
    id: "cnt-1",
    counterCode: "12",
    counterName: "Counter 01",
    officeName: "Marinozz",
    warehouseName: "Marinozz",
    floorName: "ROOF TOP,OUTDOOR,VIP,HALLROOM",
    userName: "Marinozz-Mirpur-14 [01335149059]",
    baseUrl: "N/A",
    token: null,
    isEcommerce: false,
    exeVersion: "1.1.4.0",
    status: "Active",
  },
  {
    id: "cnt-2",
    counterCode: "11",
    counterName: "Counter 01",
    officeName: "Marinozz",
    warehouseName: "Marinozz",
    floorName: "ROOF TOP,OUTDOOR,VIP,HALLROOM",
    userName: "Md. Usuf Ali [10000]",
    baseUrl: "N/A",
    token: null,
    isEcommerce: false,
    exeVersion: "1.1.3.0",
    status: "Active",
  },
];

const INITIAL_MESSAGES: MessageSetupRecord[] = [
  {
    id: "msg-1",
    body: "Thank You for Your Purchase",
    user: "Md. Usuf Ali",
    date: "2026-09-26",
    isActive: true,
  },
];

const INITIAL_CURRENCY_NOTES: CurrencyNoteRecord[] = [
  { id: "note-1", currencyName: "BDT", noteValue: 1000, noteType: "Note", isActive: true },
  { id: "note-2", currencyName: "BDT", noteValue: 500, noteType: "Note", isActive: true },
  { id: "note-3", currencyName: "BDT", noteValue: 100, noteType: "Note", isActive: true },
  { id: "note-4", currencyName: "BDT", noteValue: 50, noteType: "Note", isActive: true },
  { id: "note-5", currencyName: "BDT", noteValue: 20, noteType: "Note", isActive: true },
  { id: "note-6", currencyName: "BDT", noteValue: 10, noteType: "Note", isActive: true },
  { id: "note-7", currencyName: "BDT", noteValue: 5, noteType: "Coin", isActive: true },
];

const INITIAL_SEQUENCES: SequenceSetupRecord[] = [
  { id: "seq-1", officeName: "Marinozz", prefix: "POS-INV-", startingNo: 1000, currentNo: 1245, isActive: true },
  { id: "seq-2", officeName: "Marinozz", prefix: "POS-ORD-", startingNo: 1000, currentNo: 1180, isActive: true },
];

interface CounterSetupSectionProps {
  onBack: () => void;
}

export function CounterSetupSection({ onBack }: CounterSetupSectionProps) {
  const [activeTab, setActiveTab] = useState<CounterTab>("COUNTER_SETUP");

  // Create/Edit views
  const [isCreatingCounter, setIsCreatingCounter] = useState(false);
  const [editingCounterId, setEditingCounterId] = useState<string | null>(null);

  const [isCreatingMessage, setIsCreatingMessage] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Data states
  const [counters, setCounters] = useState<PosCounterRecord[]>(INITIAL_COUNTERS);
  const [messages, setMessages] = useState<MessageSetupRecord[]>(INITIAL_MESSAGES);
  const [notes, setNotes] = useState<CurrencyNoteRecord[]>(INITIAL_CURRENCY_NOTES);
  const [sequences, setSequences] = useState<SequenceSetupRecord[]>(INITIAL_SEQUENCES);

  // Filters for Counter Setup
  const [filterOffice, setFilterOffice] = useState("All");
  const [filterStatus, setFilterStatus] = useState("Active");
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3500);
  };

  // Pos Counter Form fields
  const [formOffice, setFormOffice] = useState("Marinozz");
  const [formWarehouse, setFormWarehouse] = useState("Marinozz");
  const [formUser, setFormUser] = useState("Md. Usuf Ali [10000]");
  const [formCounterName, setFormCounterName] = useState("");
  const [formMessage, setFormMessage] = useState("Thank You for Your Purchase");
  const [formFloor, setFormFloor] = useState("ROOF TOP,OUTDOOR,VIP,HALLROOM");
  const [formIsEcommerce, setFormIsEcommerce] = useState(false);

  // Message Form fields
  const [formMessageBody, setFormMessageBody] = useState("");

  // LocalStorage Persistence
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedCounters = localStorage.getItem("erp_pos_counters_v1");
      if (storedCounters) {
        const parsed = JSON.parse(storedCounters);
        if (Array.isArray(parsed) && parsed.length > 0) setCounters(parsed);
      }
      const storedMessages = localStorage.getItem("erp_pos_messages_v1");
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
    }
  }, []);

  const saveCounters = (newCounters: PosCounterRecord[]) => {
    setCounters(newCounters);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_counters_v1", JSON.stringify(newCounters));
      } catch (e) {
        console.warn("Error saving counters:", e);
      }
    }
  };

  const saveMessages = (newMessages: MessageSetupRecord[]) => {
    setMessages(newMessages);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_messages_v1", JSON.stringify(newMessages));
      } catch (e) {
        console.warn("Error saving messages:", e);
      }
    }
  };

  // Open Create Pos Counter
  const handleOpenCreateCounter = () => {
    setEditingCounterId(null);
    setFormOffice("Marinozz");
    setFormWarehouse("Marinozz");
    setFormUser("Md. Usuf Ali [10000]");
    setFormCounterName("");
    setFormMessage("Thank You for Your Purchase");
    setFormFloor("ROOF TOP,OUTDOOR,VIP,HALLROOM");
    setFormIsEcommerce(false);
    setIsCreatingCounter(true);
  };

  // Open Edit Pos Counter
  const handleOpenEditCounter = (c: PosCounterRecord) => {
    setEditingCounterId(c.id);
    setFormOffice(c.officeName);
    setFormWarehouse(c.warehouseName);
    setFormUser(c.userName);
    setFormCounterName(c.counterName);
    setFormMessage("Thank You for Your Purchase");
    setFormFloor(c.floorName);
    setFormIsEcommerce(c.isEcommerce);
    setIsCreatingCounter(true);
  };

  // Save Pos Counter
  const handleSaveCounter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCounterName.trim()) {
      showToast("Counter Name is required!");
      return;
    }

    if (editingCounterId) {
      const updated = counters.map((c) =>
        c.id === editingCounterId
          ? {
              ...c,
              officeName: formOffice,
              warehouseName: formWarehouse,
              userName: formUser,
              counterName: formCounterName.trim(),
              floorName: formFloor,
              isEcommerce: formIsEcommerce,
            }
          : c
      );
      saveCounters(updated);
      showToast(`Counter "${formCounterName}" updated successfully`);
    } else {
      const newCounter: PosCounterRecord = {
        id: `cnt-${Date.now()}`,
        counterCode: String(Math.floor(10 + Math.random() * 90)),
        counterName: formCounterName.trim(),
        officeName: formOffice,
        warehouseName: formWarehouse,
        floorName: formFloor,
        userName: formUser,
        baseUrl: "N/A",
        token: null,
        isEcommerce: formIsEcommerce,
        exeVersion: "1.1.4.0",
        status: "Active",
      };
      saveCounters([newCounter, ...counters]);
      showToast(`Counter "${formCounterName}" created successfully`);
    }

    setIsCreatingCounter(false);
  };

  // Toggle Counter Status
  const handleToggleCounterStatus = (id: string) => {
    const updated = counters.map((c) =>
      c.id === id ? { ...c, status: c.status === "Active" ? ("Inactive" as const) : ("Active" as const) } : c
    );
    saveCounters(updated);
    const target = updated.find((c) => c.id === id);
    showToast(`Counter is now ${target?.status}`);
  };

  // Generate Token
  const handleGenerateToken = (id: string) => {
    const generatedToken = "TKN-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    const updated = counters.map((c) => (c.id === id ? { ...c, token: generatedToken } : c));
    saveCounters(updated);
    showToast(`Token generated: ${generatedToken}`);
  };

  // Open Create Message
  const handleOpenCreateMessage = () => {
    setEditingMessageId(null);
    setFormMessageBody("");
    setIsCreatingMessage(true);
  };

  // Open Edit Message
  const handleOpenEditMessage = (m: MessageSetupRecord) => {
    setEditingMessageId(m.id);
    setFormMessageBody(m.body);
    setIsCreatingMessage(true);
  };

  // Save Message
  const handleSaveMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMessageBody.trim()) {
      showToast("Message Body is required!");
      return;
    }

    if (editingMessageId) {
      const updated = messages.map((m) =>
        m.id === editingMessageId ? { ...m, body: formMessageBody.trim() } : m
      );
      saveMessages(updated);
      showToast("Message updated successfully");
    } else {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const newMsg: MessageSetupRecord = {
        id: `msg-${Date.now()}`,
        body: formMessageBody.trim(),
        user: "Md. Usuf Ali",
        date: dateStr,
        isActive: true,
      };
      saveMessages([newMsg, ...messages]);
      showToast("Message created successfully");
    }

    setIsCreatingMessage(false);
  };

  // Toggle Message Status
  const handleToggleMessageActive = (id: string) => {
    const updated = messages.map((m) =>
      m.id === id ? { ...m, isActive: !m.isActive } : m
    );
    saveMessages(updated);
    const target = updated.find((m) => m.id === id);
    showToast(`Message is now ${target?.isActive ? "Active" : "Inactive"}`);
  };

  // Filtered Counters
  const filteredCounters = useMemo(() => {
    return counters.filter((c) => {
      if (filterOffice !== "All" && c.officeName !== filterOffice) return false;
      if (filterStatus !== "All" && c.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !c.counterName.toLowerCase().includes(q) &&
          !c.counterCode.toLowerCase().includes(q) &&
          !c.userName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [counters, filterOffice, filterStatus, searchQuery]);

  // Pagination for Counters
  const totalCounterPages = Math.max(1, Math.ceil(filteredCounters.length / rowsPerPage));
  const paginatedCounters = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredCounters.slice(start, start + rowsPerPage);
  }, [filteredCounters, currentPage, rowsPerPage]);

  // -------------------------------------------------------------
  // VIEW: Pos Counter Create (Screenshot 2)
  // -------------------------------------------------------------
  if (isCreatingCounter) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingCounter(false)}
              className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {editingCounterId ? "Pos Counter Edit" : "Pos Counter Create"}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSaveCounter}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        </div>

        {/* Card Form */}
        <form onSubmit={handleSaveCounter} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Office */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office <span className="text-red-500">*</span>
              </label>
              <select
                value={formOffice}
                onChange={(e) => setFormOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
                <option value="Dhanmondi Branch">Dhanmondi Branch</option>
                <option value="Gulshan Branch">Gulshan Branch</option>
              </select>
            </div>

            {/* Warehouse */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                value={formWarehouse}
                onChange={(e) => setFormWarehouse(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Marinozz">Marinozz</option>
                <option value="Central Warehouse">Central Warehouse</option>
                <option value="Kitchen Store">Kitchen Store</option>
              </select>
            </div>

            {/* User */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                User <span className="text-red-500">*</span>
              </label>
              <select
                value={formUser}
                onChange={(e) => setFormUser(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Md. Usuf Ali [10000]">Md. Usuf Ali [10000]</option>
                <option value="Marinozz-Mirpur-14 [01335149059]">Marinozz-Mirpur-14 [01335149059]</option>
                <option value="Admin User [10001]">Admin User [10001]</option>
                <option value="Cashier 02 [10002]">Cashier 02 [10002]</option>
              </select>
            </div>

            {/* Counter Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Counter Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Counter Name"
                value={formCounterName}
                onChange={(e) => setFormCounterName(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* Message */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <select
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {messages.map((m) => (
                  <option key={m.id} value={m.body}>
                    {m.body}
                  </option>
                ))}
              </select>
            </div>

            {/* Floor */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Floor
              </label>
              <select
                value={formFloor}
                onChange={(e) => setFormFloor(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ROOF TOP,OUTDOOR,VIP,HALLROOM">ROOF TOP,OUTDOOR,VIP,HALLROOM</option>
                <option value="HALLROOM">HALLROOM</option>
                <option value="VIP">VIP</option>
                <option value="OUTDOOR">OUTDOOR</option>
                <option value="ROOF TOP">ROOF TOP</option>
              </select>
            </div>

            {/* Is Ecommerce ? */}
            <div className="flex items-center gap-2 pt-5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <span>Is Ecommerce ?</span>
                <input
                  type="checkbox"
                  checked={formIsEcommerce}
                  onChange={(e) => setFormIsEcommerce(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </form>

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700">
            <CheckCircle className="size-4 text-emerald-400" />
            <span>{toast}</span>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: Message Setup Create (Screenshot 4)
  // -------------------------------------------------------------
  if (isCreatingMessage) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingMessage(false)}
              className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {editingMessageId ? "Message Setup Edit" : "Message Setup Create"}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSaveMessage}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        </div>

        {/* Card Form */}
        <form onSubmit={handleSaveMessage} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-5">
          <div className="max-w-xl">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Message Body <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Message Body"
              value={formMessageBody}
              onChange={(e) => setFormMessageBody(e.target.value)}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </form>

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700">
            <CheckCircle className="size-4 text-emerald-400" />
            <span>{toast}</span>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: Main Counter Setup with 4 Tabs (Screenshots 1 & 3)
  // -------------------------------------------------------------
  const headerTitle =
    activeTab === "COUNTER_SETUP"
      ? "Counter Setup"
      : activeTab === "MESSAGE_SETUP"
      ? "Message Setup"
      : activeTab === "CURRENCY_NOTE_SETUP"
      ? "Currency Note Setup"
      : "Sequence Setup";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* 1. Header with back button & Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
          title="Back to Setup Menu"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {headerTitle}
        </h1>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex items-center gap-8 -mb-px overflow-x-auto text-xs font-bold tracking-wide">
          <button
            type="button"
            onClick={() => setActiveTab("COUNTER_SETUP")}
            className={`py-3 transition border-b-2 whitespace-nowrap cursor-pointer uppercase ${
              activeTab === "COUNTER_SETUP"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            COUNTER SETUP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("MESSAGE_SETUP")}
            className={`py-3 transition border-b-2 whitespace-nowrap cursor-pointer uppercase ${
              activeTab === "MESSAGE_SETUP"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            MESSAGE SETUP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("CURRENCY_NOTE_SETUP")}
            className={`py-3 transition border-b-2 whitespace-nowrap cursor-pointer uppercase ${
              activeTab === "CURRENCY_NOTE_SETUP"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            CURRENCY NOTE SETUP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SEQUENCE_SETUP")}
            className={`py-3 transition border-b-2 whitespace-nowrap cursor-pointer uppercase ${
              activeTab === "SEQUENCE_SETUP"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            SEQUENCE SETUP
          </button>
        </nav>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* TAB 1: COUNTER SETUP (Screenshot 1) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "COUNTER_SETUP" && (
        <div className="space-y-4">
          {/* Top Controls: Search box + Create Button */}
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search...."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={handleOpenCreateCounter}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          {/* Filter Bar: Office *, Status, View */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-64">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office <span className="text-red-500">*</span>
              </label>
              <select
                value={filterOffice}
                onChange={(e) => setFilterOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All</option>
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
              </select>
            </div>

            <div className="w-56">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="All">All</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => showToast(`Filtered ${filteredCounters.length} counters`)}
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              View
            </button>
          </div>

          {/* Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">SL</th>
                  <th className="p-3 font-semibold">Counter Code</th>
                  <th className="p-3 font-semibold">Counter Name</th>
                  <th className="p-3 font-semibold">Office Name</th>
                  <th className="p-3 font-semibold">Warehouse Name</th>
                  <th className="p-3 font-semibold">Floor Name</th>
                  <th className="p-3 font-semibold">User Name</th>
                  <th className="p-3 font-semibold">Base URL</th>
                  <th className="p-3 font-semibold">Token</th>
                  <th className="p-3 font-semibold">isEcommerce</th>
                  <th className="p-3 font-semibold">Exe Version</th>
                  <th className="p-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedCounters.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">
                      {(currentPage - 1) * rowsPerPage + idx + 1}
                    </td>
                    <td className="p-3 font-mono font-medium text-slate-800 dark:text-slate-200">
                      {row.counterCode}
                    </td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                      {row.counterName}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {row.officeName}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {row.warehouseName}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {row.floorName}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {row.userName}
                    </td>
                    <td className="p-3 text-slate-500 font-mono">
                      {row.baseUrl}
                    </td>
                    <td className="p-3">
                      {row.token ? (
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {row.token}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleGenerateToken(row.id)}
                          className="text-[#0d9488] hover:text-[#0f766e] hover:underline font-semibold cursor-pointer"
                        >
                          Generate Token
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={row.isEcommerce ? "text-emerald-600 font-semibold" : "text-rose-500 font-semibold"}>
                        {String(row.isEcommerce)}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                      {row.exeVersion}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditCounter(row)}
                          className="p-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 transition cursor-pointer"
                          title="Edit Counter"
                        >
                          <Pencil className="size-4" />
                        </button>
                        {/* Status Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleCounterStatus(row.id)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            row.status === "Active" ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                          }`}
                          title={`Toggle status (Currently ${row.status})`}
                        >
                          <span
                            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              row.status === "Active" ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCounters.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400">
                      No counters found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-end gap-6 text-xs text-slate-600 dark:text-slate-400 pt-2">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs focus:outline-none"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div>
              {filteredCounters.length === 0
                ? "0-0 of 0"
                : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(
                    currentPage * rowsPerPage,
                    filteredCounters.length
                  )} of ${filteredCounters.length}`}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalCounterPages}
                onClick={() => setCurrentPage((p) => Math.min(totalCounterPages, p + 1))}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TAB 2: MESSAGE SETUP (Screenshot 3) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "MESSAGE_SETUP" && (
        <div className="space-y-4">
          {/* Create Button Top Right */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleOpenCreateMessage}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          {/* Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold w-16">SL</th>
                  <th className="p-3 font-semibold">Body</th>
                  <th className="p-3 font-semibold w-48">User</th>
                  <th className="p-3 font-semibold w-36">Date</th>
                  <th className="p-3 font-semibold text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {messages.map((m, idx) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">
                      {idx + 1}
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                      {m.body}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {m.user}
                    </td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                      {m.date}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditMessage(m)}
                          className="p-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 transition cursor-pointer"
                          title="Edit Message"
                        >
                          <Pencil className="size-4" />
                        </button>
                        {/* Status Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleMessageActive(m.id)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            m.isActive ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                          }`}
                          title={`Toggle status (Currently ${m.isActive ? "Active" : "Inactive"})`}
                        >
                          <span
                            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              m.isActive ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
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

      {/* ----------------------------------------------------------- */}
      {/* TAB 3: CURRENCY NOTE SETUP */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "CURRENCY_NOTE_SETUP" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Manage acceptable currency notes and coins for POS cash transactions.
            </p>
          </div>
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold w-16">SL</th>
                  <th className="p-3 font-semibold">Currency</th>
                  <th className="p-3 font-semibold">Note / Coin Value</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {notes.map((n, idx) => (
                  <tr key={n.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{n.currencyName}</td>
                    <td className="p-3 font-mono font-bold text-blue-600">{n.noteValue} ৳</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{n.noteType}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TAB 4: SEQUENCE SETUP */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "SEQUENCE_SETUP" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Configure invoice and order serial number prefixes and starting ranges.
            </p>
          </div>
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold w-16">SL</th>
                  <th className="p-3 font-semibold">Office Name</th>
                  <th className="p-3 font-semibold">Prefix</th>
                  <th className="p-3 font-semibold">Starting No</th>
                  <th className="p-3 font-semibold">Current No</th>
                  <th className="p-3 font-semibold text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sequences.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{s.officeName}</td>
                    <td className="p-3 font-mono font-bold text-blue-600">{s.prefix}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{s.startingNo}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{s.currentNo}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle className="size-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
