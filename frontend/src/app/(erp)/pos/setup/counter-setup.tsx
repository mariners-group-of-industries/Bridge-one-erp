"use client";

import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import type { PosCounter } from "@/features/pos/schemas/pos.schema";
import { posApi } from "@/features/pos/services/pos.api";
import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Search,
  CheckCircle,
  Calendar,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/** A random counter token; called from the "Generate Token" button only. */
const randomToken = () => "TKN-" + Math.random().toString(36).substring(2, 10).toUpperCase();

type CounterTab = "COUNTER_SETUP" | "MESSAGE_SETUP" | "CURRENCY_NOTE_SETUP" | "SEQUENCE_SETUP";

type SequenceSubTab =
  | "DEPARTMENT_SORT"
  | "CATEGORY_SORT"
  | "CATEGORY_WISE_ITEM_SORT"
  | "DEPARTMENT_WISE_ITEM_SORT"
  | "ALL_CATEGORY_WISE_ITEM_SORT"
  | "ALL_DEPARTMENT_WISE_ITEM_SORT";

const SEQUENCE_SUB_TABS: Array<{ id: SequenceSubTab; label: string }> = [
  { id: "DEPARTMENT_SORT", label: "DEPARTMENT SORT" },
  { id: "CATEGORY_SORT", label: "CATEGORY SORT" },
  { id: "CATEGORY_WISE_ITEM_SORT", label: "CATEGORY WISE ITEM SORT" },
  { id: "DEPARTMENT_WISE_ITEM_SORT", label: "DEPARTMENT WISE ITEM SORT" },
  { id: "ALL_CATEGORY_WISE_ITEM_SORT", label: "ALL CATEGORY WISE ITEM SORT" },
  { id: "ALL_DEPARTMENT_WISE_ITEM_SORT", label: "ALL DEPARTMENT WISE ITEM SORT" },
];

interface PosCounterRecord {
  id: string;
  warehouseId: string;
  receiptMessage: string;
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
  currency: string;
  noteName: string;
  noteValue: number;
  status: "Active" | "Inactive";
}

interface SequenceConfigItem {
  id: string;
  officeName: string;
  subTab: SequenceSubTab;
  targetName: string;
  serialNo: number;
  fromDateTime: string;
  toDateTime: string;
  status: "Active" | "Inactive";
}

/** Offices and warehouses a counter can be placed in (Configuration). */
interface OrgOptions {
  offices: { id: string; name: string }[];
  warehouses: { id: string; name: string; officeId: string }[];
}

function toRecord(c: PosCounter, token: string | null): PosCounterRecord {
  return {
    id: c.id,
    warehouseId: c.warehouseId,
    receiptMessage: c.receiptMessage ?? "",
    counterCode: c.code,
    counterName: c.name,
    officeName: c.officeName,
    warehouseName: c.warehouseName,
    floorName: c.floorName ?? "",
    userName: c.userName ?? "",
    baseUrl: "N/A",
    token,
    isEcommerce: c.isEcommerce,
    exeVersion: "",
    status: c.isActive ? "Active" : "Inactive",
  };
}

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
  { id: "note-1", currency: "BDT", noteName: "One Thousand Taka", noteValue: 1000, status: "Active" },
  { id: "note-2", currency: "BDT", noteName: "Five Hundred Taka", noteValue: 500, status: "Active" },
  { id: "note-3", currency: "BDT", noteName: "One Hundred Taka", noteValue: 100, status: "Active" },
  { id: "note-4", currency: "BDT", noteName: "Fifty Taka", noteValue: 50, status: "Active" },
  { id: "note-5", currency: "BDT", noteName: "Twenty Taka", noteValue: 20, status: "Active" },
  { id: "note-6", currency: "BDT", noteName: "Ten Taka", noteValue: 10, status: "Active" },
];

const INITIAL_SEQUENCES: SequenceConfigItem[] = [
  {
    id: "seq-1",
    officeName: "Marinozz",
    subTab: "DEPARTMENT_SORT",
    targetName: "Kitchen",
    serialNo: 1,
    fromDateTime: "2026-11-01 08:00",
    toDateTime: "2026-11-30 23:59",
    status: "Active",
  },
  {
    id: "seq-2",
    officeName: "Marinozz",
    subTab: "DEPARTMENT_SORT",
    targetName: "Beverages",
    serialNo: 2,
    fromDateTime: "2026-11-01 08:00",
    toDateTime: "2026-11-30 23:59",
    status: "Active",
  },
  {
    id: "seq-3",
    officeName: "Marinozz",
    subTab: "CATEGORY_SORT",
    targetName: "Appetizers & Fast Food",
    serialNo: 1,
    fromDateTime: "2026-11-01 08:00",
    toDateTime: "2026-11-30 23:59",
    status: "Active",
  },
  {
    id: "seq-4",
    officeName: "Marinozz",
    subTab: "CATEGORY_SORT",
    targetName: "Main Course Dishes",
    serialNo: 2,
    fromDateTime: "2026-11-01 08:00",
    toDateTime: "2026-11-30 23:59",
    status: "Active",
  },
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

  const [isCreatingSequence, setIsCreatingSequence] = useState(false);

  // Sub tab for Sequence Setup
  const [activeSequenceSubTab, setActiveSequenceSubTab] = useState<SequenceSubTab>("DEPARTMENT_SORT");

  // Data states
  // Counters are stored in the database; terminals sell from the counter's warehouse.
  const counterData = useResource("pos-setup-counters", posApi.counters);
  const org = useResource("pos-setup-org", () => apiRequest<OrgOptions>("/api/configuration/org-options"));
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const counters = (counterData.data ?? []).map((c) => toRecord(c, tokens[c.id] ?? null));
  const [savingCounter, setSavingCounter] = useState(false);
  const [messages, setMessages] = useState<MessageSetupRecord[]>(INITIAL_MESSAGES);
  const [currencyNotes, setCurrencyNotes] = useState<CurrencyNoteRecord[]>(INITIAL_CURRENCY_NOTES);
  const [sequences, setSequences] = useState<SequenceConfigItem[]>(INITIAL_SEQUENCES);

  // Filters for Counter Setup
  const [filterOffice, setFilterOffice] = useState("All");
  const [filterStatus, setFilterStatus] = useState("Active");
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters for Sequence Setup
  const [seqFilterOffice, setSeqFilterOffice] = useState("All");
  const [seqFilterTarget, setSeqFilterTarget] = useState("All");
  const [seqFilterFromDate, setSeqFilterFromDate] = useState("2026-11-01");
  const [seqFilterToDate, setSeqFilterToDate] = useState("2026-11-01");

  // Form states for Currency Note Setup (Image 1)
  const [selectedCurrency, setSelectedCurrency] = useState("BDT");
  const [noteNameInput, setNoteNameInput] = useState("");
  const [noteValueInput, setNoteValueInput] = useState("");

  // Form states for Sequence Configuration Create (Image 3)
  const [seqFormOffice, setSeqFormOffice] = useState("Marinozz");
  const [seqFormFromDateTime, setSeqFormFromDateTime] = useState("2026-11-01 08:00");
  const [seqFormToDateTime, setSeqFormToDateTime] = useState("2026-11-30 23:59");
  const [seqFormTarget, setSeqFormTarget] = useState("Kitchen");
  const [seqFormSerialNo, setSeqFormSerialNo] = useState("1");
  const [tempSeqItems, setTempSeqItems] = useState<Array<{ target: string; serial: number }>>([]);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3500);
  };

  // Pos Counter Form fields
  const [formOffice, setFormOffice] = useState("");
  const [formWarehouse, setFormWarehouse] = useState("");
  const [formUser, setFormUser] = useState("");
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
      const storedMessages = localStorage.getItem("erp_pos_messages_v1");
      const storedNotes = localStorage.getItem("erp_pos_currency_notes_v1");
      const storedSeqs = localStorage.getItem("erp_pos_sequences_v1");
      queueMicrotask(() => {
        if (storedMessages) {
          const parsed = JSON.parse(storedMessages);
          if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
        }
        if (storedNotes) {
          const parsed = JSON.parse(storedNotes);
          if (Array.isArray(parsed) && parsed.length > 0) setCurrencyNotes(parsed);
        }
        if (storedSeqs) {
          const parsed = JSON.parse(storedSeqs);
          if (Array.isArray(parsed) && parsed.length > 0) setSequences(parsed);
        }
      });
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
    }
  }, []);

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

  const saveCurrencyNotes = (newNotes: CurrencyNoteRecord[]) => {
    setCurrencyNotes(newNotes);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_currency_notes_v1", JSON.stringify(newNotes));
      } catch (e) {
        console.warn("Error saving notes:", e);
      }
    }
  };

  const saveSequences = (newSeqs: SequenceConfigItem[]) => {
    setSequences(newSeqs);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_sequences_v1", JSON.stringify(newSeqs));
      } catch (e) {
        console.warn("Error saving sequences:", e);
      }
    }
  };

  // Open Create Pos Counter
  const handleOpenCreateCounter = () => {
    setEditingCounterId(null);
    setFormOffice("");
    setFormWarehouse("");
    setFormUser("");
    setFormCounterName("");
    setFormMessage("Thank You for Your Purchase");
    setFormFloor("");
    setFormIsEcommerce(false);
    setIsCreatingCounter(true);
  };

  // Open Edit Pos Counter
  const handleOpenEditCounter = (c: PosCounterRecord) => {
    setEditingCounterId(c.id);
    setFormOffice(org.data?.warehouses.find((w) => w.id === c.warehouseId)?.officeId ?? "");
    setFormWarehouse(c.warehouseId);
    setFormUser(c.userName);
    setFormCounterName(c.counterName);
    setFormMessage(c.receiptMessage);
    setFormFloor(c.floorName);
    setFormIsEcommerce(c.isEcommerce);
    setIsCreatingCounter(true);
  };

  // Save Pos Counter
  const handleSaveCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCounterName.trim()) {
      showToast("Counter Name is required!");
      return;
    }

    if (!formWarehouse) {
      showToast("Select the warehouse the counter sells from.");
      return;
    }
    const input = {
      name: formCounterName.trim(),
      warehouseId: formWarehouse,
      userName: formUser || undefined,
      floorName: formFloor || undefined,
      receiptMessage: formMessage || undefined,
      isEcommerce: formIsEcommerce,
    };
    setSavingCounter(true);
    try {
      if (editingCounterId) await posApi.updateCounter(editingCounterId, input);
      else await posApi.createCounter(input);
      showToast(`Counter "${input.name}" ${editingCounterId ? "updated" : "created"}`);
      counterData.reload();
      setIsCreatingCounter(false);
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setSavingCounter(false);
    }
    setIsCreatingCounter(false);
  };

  // Toggle Counter Status
  const handleToggleCounterStatus = (id: string) => {
    const target = counters.find((c) => c.id === id);
    if (!target) return;
    const isActive = target.status !== "Active";
    posApi
      .updateCounter(id, { isActive })
      .then(() => {
        showToast(`Counter is now ${isActive ? "Active" : "Inactive"}`);
        counterData.reload();
      })
      .catch((error: unknown) => showToast(errorMessage(error)));
  };

  // Generate Token
  const handleGenerateToken = (id: string) => {
    const generatedToken = randomToken();
    // Shown for this session only; counter tokens are not stored yet.
    setTokens({ ...tokens, [id]: generatedToken });
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

  // Add Currency Note Item (Image 1)
  const handleAddCurrencyNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteNameInput.trim() || !noteValueInput.trim()) {
      showToast("Please enter Currency Note Name and Value");
      return;
    }
    const val = Number(noteValueInput);
    if (isNaN(val) || val <= 0) {
      showToast("Please enter a valid numeric value");
      return;
    }

    const newNote: CurrencyNoteRecord = {
      id: `note-${Date.now()}`,
      currency: selectedCurrency,
      noteName: noteNameInput.trim(),
      noteValue: val,
      status: "Active",
    };

    saveCurrencyNotes([...currencyNotes, newNote]);
    setNoteNameInput("");
    setNoteValueInput("");
    showToast(`Added ${newNote.noteName} (${newNote.noteValue} ${selectedCurrency})`);
  };

  // Save Currency Notes
  const handleSaveCurrencyNotes = () => {
    saveCurrencyNotes(currencyNotes);
    showToast("Currency Note Setup saved successfully");
  };

  // Delete Currency Note
  const handleDeleteCurrencyNote = (id: string) => {
    const updated = currencyNotes.filter((n) => n.id !== id);
    saveCurrencyNotes(updated);
    showToast("Currency note removed");
  };

  // Sequence Configuration Create Handlers (Image 3)
  const handleOpenCreateSequence = () => {
    setSeqFormOffice("Marinozz");
    setSeqFormFromDateTime("2026-11-01 08:00");
    setSeqFormToDateTime("2026-11-30 23:59");
    const defaultTarget =
      activeSequenceSubTab === "DEPARTMENT_SORT" ||
      activeSequenceSubTab === "DEPARTMENT_WISE_ITEM_SORT" ||
      activeSequenceSubTab === "ALL_DEPARTMENT_WISE_ITEM_SORT"
        ? "Kitchen"
        : "Appetizers & Fast Food";
    setSeqFormTarget(defaultTarget);
    setSeqFormSerialNo("1");
    setTempSeqItems([]);
    setIsCreatingSequence(true);
  };

  const handleAddTempSeqItem = (e: React.FormEvent) => {
    e.preventDefault();
    const sNo = parseInt(seqFormSerialNo, 10);
    if (!seqFormTarget.trim() || isNaN(sNo)) {
      showToast("Please select target and enter Serial No");
      return;
    }
    setTempSeqItems((prev) => [...prev, { target: seqFormTarget, serial: sNo }]);
    setSeqFormSerialNo(String(sNo + 1));
    showToast(`Added ${seqFormTarget} (Serial: ${sNo})`);
  };

  const handleSaveSequenceConfiguration = () => {
    if (tempSeqItems.length === 0) {
      // If none added to temp list, add the current one
      const sNo = parseInt(seqFormSerialNo, 10) || 1;
      const newSeq: SequenceConfigItem = {
        id: `seq-${Date.now()}`,
        officeName: seqFormOffice,
        subTab: activeSequenceSubTab,
        targetName: seqFormTarget,
        serialNo: sNo,
        fromDateTime: seqFormFromDateTime,
        toDateTime: seqFormToDateTime,
        status: "Active",
      };
      saveSequences([...sequences, newSeq]);
    } else {
      const newItems: SequenceConfigItem[] = tempSeqItems.map((item, idx) => ({
        id: `seq-${Date.now()}-${idx}`,
        officeName: seqFormOffice,
        subTab: activeSequenceSubTab,
        targetName: item.target,
        serialNo: item.serial,
        fromDateTime: seqFormFromDateTime,
        toDateTime: seqFormToDateTime,
        status: "Active",
      }));
      saveSequences([...sequences, ...newItems]);
    }
    showToast("Sequence Configuration saved successfully");
    setIsCreatingSequence(false);
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

  // Filtered Sequences for active subtab
  const filteredSequences = useMemo(() => {
    return sequences.filter((s) => {
      if (s.subTab !== activeSequenceSubTab) return false;
      if (seqFilterOffice !== "All" && s.officeName !== seqFilterOffice) return false;
      if (seqFilterTarget !== "All" && s.targetName !== seqFilterTarget) return false;
      return true;
    });
  }, [sequences, activeSequenceSubTab, seqFilterOffice, seqFilterTarget]);

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
            disabled={savingCounter}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer disabled:opacity-60"
          >
            {savingCounter ? "SAVING…" : "SAVE"}
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
                <option value="">Select office</option>
                {(org.data?.offices ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
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
                <option value="">Select warehouse</option>
                {(org.data?.warehouses ?? [])
                  .filter((w) => !formOffice || w.officeId === formOffice)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* User */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                User <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formUser}
                maxLength={150}
                placeholder="Cashier name / ID"
                onChange={(e) => setFormUser(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
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
  // VIEW: Sequence Configuration of Sub-Tab (Image 3)
  // -------------------------------------------------------------
  if (isCreatingSequence) {
    const isDeptType =
      activeSequenceSubTab === "DEPARTMENT_SORT" ||
      activeSequenceSubTab === "DEPARTMENT_WISE_ITEM_SORT" ||
      activeSequenceSubTab === "ALL_DEPARTMENT_WISE_ITEM_SORT";

    const subTabLabel = SEQUENCE_SUB_TABS.find((t) => t.id === activeSequenceSubTab)?.label || "Department Sort";

    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingSequence(false)}
              className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Sequence Configuration of {subTabLabel.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase())}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSaveSequenceConfiguration}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        </div>

        {/* Top Card: Office *, From Date And Time *, To Date And Time * */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office <span className="text-red-500">*</span>
              </label>
              <select
                value={seqFormOffice}
                onChange={(e) => setSeqFormOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
                <option value="Dhanmondi Branch">Dhanmondi Branch</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                From Date And Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="yyyy-mm-dd hh:mm"
                  value={seqFormFromDateTime}
                  onChange={(e) => setSeqFormFromDateTime(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                To Date And Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="yyyy-mm-dd hh:mm"
                  value={seqFormToDateTime}
                  onChange={(e) => setSeqFormToDateTime(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-8 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <Calendar className="size-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Card: Department / Category, Serial No *, Add button */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-4">
          <form onSubmit={handleAddTempSeqItem} className="flex items-end gap-4 flex-wrap">
            <div className="w-64">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isDeptType ? "Department" : "Category"}
              </label>
              <select
                value={seqFormTarget}
                onChange={(e) => setSeqFormTarget(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {isDeptType ? (
                  <>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Service">Service</option>
                    <option value="Billing">Billing</option>
                  </>
                ) : (
                  <>
                    <option value="Appetizers & Fast Food">Appetizers & Fast Food</option>
                    <option value="Main Course Dishes">Main Course Dishes</option>
                    <option value="Desserts & Drinks">Desserts & Drinks</option>
                    <option value="Combo Packages">Combo Packages</option>
                  </>
                )}
              </select>
            </div>

            <div className="w-48">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serial No <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                placeholder="Serial No"
                value={seqFormSerialNo}
                onChange={(e) => setSeqFormSerialNo(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <button
              type="submit"
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              Add
            </button>
          </form>

          {/* Table of Added Sequence Items */}
          {tempSeqItems.length > 0 && (
            <div className="rounded border border-slate-200 dark:border-slate-800 overflow-x-auto mt-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5 font-semibold w-12">#</th>
                    <th className="p-2.5 font-semibold">{isDeptType ? "Department" : "Category"}</th>
                    <th className="p-2.5 font-semibold">Serial No</th>
                    <th className="p-2.5 font-semibold text-center w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tempSeqItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2.5 text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{item.target}</td>
                      <td className="p-2.5 font-mono font-bold text-blue-600">{item.serial}</td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setTempSeqItems(tempSeqItems.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="size-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
  // VIEW: Main Counter Setup with 4 Tabs (Screenshots 1 & 3 & 4)
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
      {/* 1. Header with back button & Title & Optional Save for Currency Note */}
      <div className="flex items-center justify-between flex-wrap gap-4">
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

        {activeTab === "CURRENCY_NOTE_SETUP" && (
          <button
            type="button"
            onClick={handleSaveCurrencyNotes}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            SAVE
          </button>
        )}
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
      {/* TAB 3: CURRENCY NOTE SETUP (Image 1) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "CURRENCY_NOTE_SETUP" && (
        <div className="space-y-4">
          {/* Top Card: Currency * */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs">
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="BDT">BDT - Bangladeshi Taka</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
          </div>

          {/* Bottom Card: Currency Note Name *, Currency Value *, Add Button */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs space-y-4">
            <form onSubmit={handleAddCurrencyNote} className="flex items-end gap-4 flex-wrap">
              <div className="w-72">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Currency Note Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Currency Note Name"
                  value={noteNameInput}
                  onChange={(e) => setNoteNameInput(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="w-56">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Currency Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="Currency Value"
                  value={noteValueInput}
                  onChange={(e) => setNoteValueInput(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <button
                type="submit"
                className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
              >
                Add
              </button>
            </form>

            {/* Notes Table */}
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs mt-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold w-16">SL</th>
                    <th className="p-3 font-semibold">Currency</th>
                    <th className="p-3 font-semibold">Currency Note Name</th>
                    <th className="p-3 font-semibold">Currency Value</th>
                    <th className="p-3 font-semibold text-center w-28">Status</th>
                    <th className="p-3 font-semibold text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currencyNotes.map((n, idx) => (
                    <tr key={n.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{n.currency}</td>
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{n.noteName}</td>
                      <td className="p-3 font-mono font-bold text-blue-600">{n.noteValue}</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {n.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteCurrencyNote(n.id)}
                          className="text-rose-500 hover:text-rose-700 transition p-1"
                          title="Delete Note"
                        >
                          <Trash2 className="size-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TAB 4: SEQUENCE SETUP (Images 2, 3, 4) */}
      {/* ----------------------------------------------------------- */}
      {activeTab === "SEQUENCE_SETUP" && (
        <div className="space-y-4">
          {/* Sub Navigation Bar for Sequence Setup (Images 2 & 4) */}
          <div className="border-b border-slate-200 dark:border-slate-800">
            <nav className="flex items-center gap-6 -mb-px overflow-x-auto text-[11px] font-bold tracking-wide">
              {SEQUENCE_SUB_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSequenceSubTab(tab.id)}
                  className={`py-2.5 transition border-b-2 whitespace-nowrap cursor-pointer uppercase ${
                    activeSequenceSubTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Top Controls: + Create Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleOpenCreateSequence}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          </div>

          {/* Filter Bar (Images 2 & 4) */}
          <div className="flex items-end gap-4 flex-wrap">
            {/* Office */}
            <div className="w-56">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office
              </label>
              <select
                value={seqFilterOffice}
                onChange={(e) => setSeqFilterOffice(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Offices</option>
                <option value="Marinozz">Marinozz</option>
                <option value="Head Office">Head Office</option>
              </select>
            </div>

            {/* Department / Category Filter */}
            <div className="w-56">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {activeSequenceSubTab.includes("CATEGORY") ? "Category" : "Department"}
              </label>
              <select
                value={seqFilterTarget}
                onChange={(e) => setSeqFilterTarget(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All</option>
                {activeSequenceSubTab.includes("CATEGORY") ? (
                  <>
                    <option value="Appetizers & Fast Food">Appetizers & Fast Food</option>
                    <option value="Main Course Dishes">Main Course Dishes</option>
                    <option value="Desserts & Drinks">Desserts & Drinks</option>
                  </>
                ) : (
                  <>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Service">Service</option>
                  </>
                )}
              </select>
            </div>

            {/* From Date */}
            <div className="w-44">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                From Date
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={seqFilterFromDate}
                  onChange={(e) => setSeqFilterFromDate(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <Calendar className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* To Date */}
            <div className="w-44">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                To Date
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={seqFilterToDate}
                  onChange={(e) => setSeqFilterToDate(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <Calendar className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => showToast(`Filtered ${filteredSequences.length} sequence records`)}
              className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              View
            </button>
          </div>

          {/* Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold w-16">SL</th>
                  <th className="p-3 font-semibold">Office Name</th>
                  <th className="p-3 font-semibold">
                    {activeSequenceSubTab.includes("CATEGORY") ? "Category Name" : "Department Name"}
                  </th>
                  <th className="p-3 font-semibold">Serial No</th>
                  <th className="p-3 font-semibold">From Date & Time</th>
                  <th className="p-3 font-semibold">To Date & Time</th>
                  <th className="p-3 font-semibold text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSequences.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{s.officeName}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{s.targetName}</td>
                    <td className="p-3 font-mono font-bold text-blue-600">{s.serialNo}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{s.fromDateTime}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{s.toDateTime}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredSequences.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No sequence configuration found. Click + Create to configure.
                    </td>
                  </tr>
                )}
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
