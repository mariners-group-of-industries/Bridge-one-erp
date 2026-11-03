"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SalesSetupSection } from "./sales-setup";
import { PointRedeemOtpSection } from "./point-redeem-otp";
import { CounterSetupSection } from "./counter-setup";
import { DiscountOfferSection } from "./discount-offer";
import {
  ArrowLeft,
  Plus,
  Pencil,
  RotateCw,
  UtensilsCrossed,
  Bell,
  Trash2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type SetupSection =
  | null
  | "DISCOUNT_OFFER"
  | "COUNTER_SETUP"
  | "SALES_SETUP"
  | "POINT_REDEEM_OTP"
  | "FLOOR_TABLE_SETUP";

interface FloorRecord {
  id: string;
  officeName: string;
  floorName: string;
  capacity: number;
  tableCount: number;
  status: "Active" | "Inactive";
}

interface TableRecord {
  id: string;
  floorId: string;
  floorName: string;
  tableName: string;
  capacity: number;
  status: "Available" | "Occupied" | "Reserved";
  isActive: boolean;
}

const INITIAL_FLOORS: FloorRecord[] = [
  {
    id: "fl-1",
    officeName: "Marinozz",
    floorName: "HALLROOM",
    capacity: 46,
    tableCount: 14,
    status: "Active",
  },
  {
    id: "fl-2",
    officeName: "Marinozz",
    floorName: "VIP",
    capacity: 22,
    tableCount: 6,
    status: "Active",
  },
  {
    id: "fl-3",
    officeName: "Marinozz",
    floorName: "OUTDOOR",
    capacity: 40,
    tableCount: 10,
    status: "Active",
  },
  {
    id: "fl-4",
    officeName: "Marinozz",
    floorName: "ROOF TOP",
    capacity: 14,
    tableCount: 4,
    status: "Active",
  },
];

const INITIAL_TABLES: TableRecord[] = [
  // ROOF TOP (4 tables)
  {
    id: "tb-rt-1",
    floorId: "fl-4",
    floorName: "ROOF TOP",
    tableName: "TABLE-1",
    capacity: 4,
    status: "Available",
    isActive: true,
  },
  {
    id: "tb-rt-2",
    floorId: "fl-4",
    floorName: "ROOF TOP",
    tableName: "LKNKJN",
    capacity: 4,
    status: "Available",
    isActive: true,
  },
  {
    id: "tb-rt-3",
    floorId: "fl-4",
    floorName: "ROOF TOP",
    tableName: "TABLE-6",
    capacity: 4,
    status: "Available",
    isActive: true,
  },
  {
    id: "tb-rt-4",
    floorId: "fl-4",
    floorName: "ROOF TOP",
    tableName: "5",
    capacity: 2,
    status: "Available",
    isActive: true,
  },
  // HALLROOM (14 tables)
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `tb-hr-${i + 1}`,
    floorId: "fl-1",
    floorName: "HALLROOM",
    tableName: `TABLE-${i + 1}`,
    capacity: i % 2 === 0 ? 4 : 2,
    status: "Available" as const,
    isActive: true,
  })),
  // VIP (6 tables)
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `tb-vip-${i + 1}`,
    floorId: "fl-2",
    floorName: "VIP",
    tableName: `VIP-${i + 1}`,
    capacity: 4,
    status: "Available" as const,
    isActive: true,
  })),
  // OUTDOOR (10 tables)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `tb-out-${i + 1}`,
    floorId: "fl-3",
    floorName: "OUTDOOR",
    tableName: `OUT-${i + 1}`,
    capacity: 4,
    status: "Available" as const,
    isActive: true,
  })),
];

function DiscountOfferIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-12" fill="none">
      <path d="M24 42L19 56L26 52L30 57L31 44" fill="#1e293b" />
      <path d="M40 42L45 56L38 52L34 57L33 44" fill="#0f172a" />
      <path
        d="M32 8L36.9 12.2L43.3 11L45.5 17.1L51.6 19.3L50.4 25.7L54.6 30.6L50.4 35.5L51.6 41.9L45.5 44.1L43.3 50.2L36.9 49L32 53.2L27.1 49L20.7 50.2L18.5 44.1L12.4 41.9L13.6 35.5L9.4 30.6L13.6 25.7L12.4 19.3L18.5 17.1L20.7 11L27.1 12.2L32 8Z"
        fill="#ff2e38"
      />
      <circle cx="48" cy="10" r="1.3" fill="#ff2e38" />
      <circle cx="53" cy="14" r="1" fill="#ff2e38" />
      <circle cx="26.5" cy="25.5" r="3" stroke="#ffffff" strokeWidth="2.2" />
      <circle cx="37.5" cy="35.5" r="3" stroke="#ffffff" strokeWidth="2.2" />
      <path d="M38 24L26 37" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function CounterSetupIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-12" fill="none">
      <rect x="14" y="8" width="36" height="26" rx="2" fill="#2563eb" />
      <rect x="18" y="12" width="28" height="18" rx="1" fill="#e0f2fe" />
      <rect x="20" y="14" width="4" height="3" fill="#3b82f6" />
      <rect x="25.5" y="14" width="4" height="3" fill="#3b82f6" />
      <rect x="31" y="14" width="4" height="3" fill="#3b82f6" />
      <rect x="20" y="18.5" width="4" height="3" fill="#3b82f6" />
      <rect x="25.5" y="18.5" width="4" height="3" fill="#3b82f6" />
      <rect x="31" y="18.5" width="4" height="3" fill="#3b82f6" />
      <rect x="20" y="23" width="4" height="3" fill="#3b82f6" />
      <rect x="25.5" y="23" width="4" height="3" fill="#3b82f6" />
      <rect x="31" y="23" width="4" height="3" fill="#3b82f6" />
      <rect x="37.5" y="14" width="6.5" height="4" fill="#93c5fd" />
      <rect x="37.5" y="20" width="6.5" height="6" fill="#60a5fa" />
      <rect x="26" y="34" width="12" height="6" fill="#1e3a8a" />
      <rect x="29" y="36" width="6" height="3" rx="0.8" fill="#ef4444" />
      <path d="M10 40H54L56 52H8L10 40Z" fill="#172554" />
    </svg>
  );
}

function SalesSetupIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-12" fill="none">
      <rect
        x="12"
        y="10"
        width="34"
        height="44"
        rx="3"
        fill="#dbeafe"
        stroke="#3b82f6"
        strokeWidth="2"
      />
      <rect x="16" y="15" width="26" height="34" rx="1" fill="#ffffff" />
      <rect x="22" y="7" width="14" height="6" rx="1.5" fill="#ef4444" />
      <rect x="19" y="26" width="3.5" height="8" fill="#ef4444" />
      <rect x="24" y="22" width="3.5" height="12" fill="#3b82f6" />
      <rect x="29" y="19" width="3.5" height="15" fill="#10b981" />
      <rect x="19" y="37" width="16" height="2" rx="1" fill="#94a3b8" />
      <rect x="19" y="41" width="12" height="2" rx="1" fill="#94a3b8" />
      <circle cx="44" cy="44" r="8" fill="#ef4444" />
      <circle cx="44" cy="44" r="3.2" fill="#ffffff" />
      <path
        d="M44 33.5V36M44 52V54.5M33.5 44H36M52 44H54.5M36.6 36.6L38.4 38.4M49.6 49.6L51.4 51.4M51.4 36.6L49.6 38.4M38.4 49.6L36.6 51.4"
        stroke="#ef4444"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PointRedeemIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-12" fill="none">
      <ellipse cx="24" cy="46" rx="11" ry="4" fill="#f59e0b" />
      <ellipse cx="24" cy="40" rx="11" ry="4" fill="#fbbf24" />
      <ellipse cx="24" cy="34" rx="11" ry="4" fill="#f59e0b" />
      <ellipse cx="24" cy="28" rx="11" ry="4" fill="#fbbf24" />
      <ellipse cx="24" cy="22" rx="11" ry="4" fill="#f59e0b" />
      <ellipse cx="24" cy="16" rx="11" ry="4" fill="#fcd34d" />
      <ellipse cx="42" cy="48" rx="10" ry="3.8" fill="#d97706" />
      <ellipse cx="42" cy="42" rx="10" ry="3.8" fill="#f59e0b" />
      <ellipse cx="42" cy="36" rx="10" ry="3.8" fill="#fbbf24" />
      <ellipse cx="42" cy="30" rx="10" ry="3.8" fill="#fcd34d" />
    </svg>
  );
}

const SETUP_CARDS: Array<{
  id: Exclude<SetupSection, null>;
  label: string;
  Icon: React.ComponentType;
}> = [
  { id: "DISCOUNT_OFFER", label: "Discount & Offer", Icon: DiscountOfferIcon },
  { id: "COUNTER_SETUP", label: "Counter Setup", Icon: CounterSetupIcon },
  { id: "SALES_SETUP", label: "Sales Setup", Icon: SalesSetupIcon },
  { id: "POINT_REDEEM_OTP", label: "Point Redeem OTP", Icon: PointRedeemIcon },
  { id: "FLOOR_TABLE_SETUP", label: "Floor & Table Setup", Icon: CounterSetupIcon },
];

function PosSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSection = searchParams.get("section");
  const activeSection: SetupSection =
    rawSection === "DISCOUNT_OFFER" ||
    rawSection === "COUNTER_SETUP" ||
    rawSection === "SALES_SETUP" ||
    rawSection === "POINT_REDEEM_OTP" ||
    rawSection === "FLOOR_TABLE_SETUP"
      ? rawSection
      : null;

  const handleSelectSection = (id: Exclude<SetupSection, null>) => {
    router.push('/pos/setup?section=' + id);
  };

  const handleBackToHub = () => {
    router.push('/pos/setup');
  };

  // Floor & Table specific states
  const [activeTab, setActiveTab] = useState<"FLOOR" | "FLOOR_LAYOUT">("FLOOR");
  const [selectedOffice, setSelectedOffice] = useState("All");
  const [selectedFloor, setSelectedFloor] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const [floors, setFloors] = useState<FloorRecord[]>(INITIAL_FLOORS);
  const [tables, setTables] = useState<TableRecord[]>(INITIAL_TABLES);

  // Pagination for FLOOR tab
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // Toast alert feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3000);
  };

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedFloors = localStorage.getItem("erp_pos_floors_v1");
      const storedTables = localStorage.getItem("erp_pos_tables_v1");
      queueMicrotask(() => {
        if (storedFloors) {
          const parsed = JSON.parse(storedFloors);
          if (Array.isArray(parsed) && parsed.length > 0) setFloors(parsed);
        }
        if (storedTables) {
          const parsed = JSON.parse(storedTables);
          if (Array.isArray(parsed) && parsed.length > 0) setTables(parsed);
        }
      });
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
    }
  }, []);

  // Persistence helpers
  const saveFloors = (newFloors: FloorRecord[]) => {
    setFloors(newFloors);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_floors_v1", JSON.stringify(newFloors));
      } catch (e) {
        console.warn("Could not save floors to localStorage:", e);
      }
    }
  };

  const saveTables = (newTables: TableRecord[]) => {
    setTables(newTables);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_tables_v1", JSON.stringify(newTables));
      } catch (e) {
        console.warn("Could not save tables to localStorage:", e);
      }
    }
  };

  // Modals state
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<FloorRecord | null>(null);
  const [editingTable, setEditingTable] = useState<TableRecord | null>(null);

  const [floorOfficeInput, setFloorOfficeInput] = useState("Marinozz");
  const [floorNameInput, setFloorNameInput] = useState("");

  const [tableOfficeInput, setTableOfficeInput] = useState("Marinozz");
  const [tableFloorInput, setTableFloorInput] = useState("ROOF TOP");
  const [tableNameInput, setTableNameInput] = useState("");
  const [tableSeatsInput, setTableSeatsInput] = useState("2");
  const [tableStatusInput, setTableStatusInput] = useState<"Available" | "Occupied" | "Reserved">("Available");

  // Toggle active status for Floor
  const handleToggleFloorStatus = (id: string) => {
    const updated = floors.map((f) =>
      f.id === id
        ? { ...f, status: f.status === "Active" ? ("Inactive" as const) : ("Active" as const) }
        : f
    );
    saveFloors(updated);
    const target = updated.find((f) => f.id === id);
    showToast(`Floor ${target?.floorName} is now ${target?.status}`);
  };

  // Toggle active status for Table
  const handleToggleTableActive = (id: string) => {
    const updated = tables.map((t) =>
      t.id === id ? { ...t, isActive: !t.isActive } : t
    );
    saveTables(updated);
    const target = updated.find((t) => t.id === id);
    showToast(`Table ${target?.tableName} is now ${target?.isActive ? "Active" : "Inactive"}`);
  };

  // Quick cycle Table status: Available -> Occupied -> Reserved -> Available
  const cycleTableStatus = (id: string) => {
    const updated = tables.map((t) => {
      if (t.id !== id) return t;
      let nextStatus: "Available" | "Occupied" | "Reserved" = "Available";
      if (t.status === "Available") nextStatus = "Occupied";
      else if (t.status === "Occupied") nextStatus = "Reserved";
      else nextStatus = "Available";
      return { ...t, status: nextStatus };
    });
    saveTables(updated);
    const target = updated.find((t) => t.id === id);
    showToast(`Table ${target?.tableName} status changed to ${target?.status}`);
  };

  // Open Floor Modal (Create or Edit)
  const openCreateFloor = () => {
    setEditingFloor(null);
    setFloorOfficeInput("Marinozz");
    setFloorNameInput("");
    setIsFloorModalOpen(true);
  };

  const openEditFloor = (floor: FloorRecord) => {
    setEditingFloor(floor);
    setFloorOfficeInput(floor.officeName || "Marinozz");
    setFloorNameInput(floor.floorName);
    setIsFloorModalOpen(true);
  };

  // Delete Floor
  const handleDeleteFloor = (id: string) => {
    const target = floors.find((f) => f.id === id);
    if (!target) return;
    if (confirm(`Are you sure you want to delete floor "${target.floorName}"?`)) {
      const updatedFloors = floors.filter((f) => f.id !== id);
      const updatedTables = tables.filter((t) => t.floorId !== id && t.floorName !== target.floorName);
      saveFloors(updatedFloors);
      saveTables(updatedTables);
      setIsFloorModalOpen(false);
      showToast(`Floor "${target.floorName}" deleted successfully`);
    }
  };

  // Save Floor
  const handleSaveFloor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!floorNameInput.trim()) return;

    if (editingFloor) {
      const oldName = editingFloor.floorName;
      const newName = floorNameInput.trim().toUpperCase();
      const updatedFloors = floors.map((f) =>
        f.id === editingFloor.id
          ? {
              ...f,
              officeName: floorOfficeInput,
              floorName: newName,
            }
          : f
      );
      // Also sync tables if floorName changed
      const updatedTables = tables.map((t) =>
        t.floorName === oldName ? { ...t, floorName: newName } : t
      );
      saveFloors(updatedFloors);
      saveTables(updatedTables);
      showToast(`Floor "${newName}" updated successfully`);
    } else {
      const newName = floorNameInput.trim().toUpperCase();
      const newFl: FloorRecord = {
        id: `fl-${Date.now()}`,
        officeName: floorOfficeInput,
        floorName: newName,
        capacity: 0,
        tableCount: 0,
        status: "Active",
      };
      saveFloors([...floors, newFl]);
      showToast(`New floor "${newName}" created successfully`);
    }

    setIsFloorModalOpen(false);
  };

  // Open Table Modal (Create or Edit)
  const openCreateTable = () => {
    setEditingTable(null);
    setTableOfficeInput("Marinozz");
    setTableFloorInput(selectedFloor !== "All" ? selectedFloor : (floors[0]?.floorName || "ROOF TOP"));
    setTableNameInput("");
    setTableSeatsInput("2");
    setTableStatusInput("Available");
    setIsTableModalOpen(true);
  };

  const openEditTable = (table: TableRecord) => {
    setEditingTable(table);
    setTableOfficeInput("Marinozz");
    setTableFloorInput(table.floorName);
    setTableNameInput(table.tableName);
    setTableSeatsInput(String(table.capacity));
    setTableStatusInput(table.status);
    setIsTableModalOpen(true);
  };

  // Delete Table
  const handleDeleteTable = (id: string) => {
    const target = tables.find((t) => t.id === id);
    if (!target) return;
    if (confirm(`Are you sure you want to delete table "${target.tableName}"?`)) {
      const updatedTables = tables.filter((t) => t.id !== id);
      saveTables(updatedTables);
      // update floor count
      saveFloors(
        floors.map((f) =>
          f.floorName === target.floorName
            ? {
                ...f,
                tableCount: Math.max(0, f.tableCount - 1),
                capacity: Math.max(0, f.capacity - target.capacity),
              }
            : f
        )
      );
      setIsTableModalOpen(false);
      showToast(`Table "${target.tableName}" deleted successfully`);
    }
  };

  // Save Table
  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNameInput.trim()) return;

    const seatsNum = Number(tableSeatsInput) || 2;
    const cleanTableName = tableNameInput.trim().toUpperCase();

    if (editingTable) {
      const oldFloor = editingTable.floorName;
      const oldCap = editingTable.capacity;

      const updatedTables = tables.map((t) =>
        t.id === editingTable.id
          ? {
              ...t,
              tableName: cleanTableName,
              floorName: tableFloorInput,
              capacity: seatsNum,
              status: tableStatusInput,
            }
          : t
      );
      saveTables(updatedTables);

      // adjust floor capacities if changed
      if (oldFloor !== tableFloorInput || oldCap !== seatsNum) {
        saveFloors(
          floors.map((f) => {
            if (f.floorName === oldFloor && oldFloor !== tableFloorInput) {
              return {
                ...f,
                tableCount: Math.max(0, f.tableCount - 1),
                capacity: Math.max(0, f.capacity - oldCap),
              };
            }
            if (f.floorName === tableFloorInput && oldFloor !== tableFloorInput) {
              return {
                ...f,
                tableCount: f.tableCount + 1,
                capacity: f.capacity + seatsNum,
              };
            }
            if (f.floorName === tableFloorInput) {
              return {
                ...f,
                capacity: f.capacity - oldCap + seatsNum,
              };
            }
            return f;
          })
        );
      }
      showToast(`Table "${cleanTableName}" updated successfully`);
    } else {
      const matchingFloor = floors.find((f) => f.floorName === tableFloorInput);
      const newTb: TableRecord = {
        id: `tb-${Date.now()}`,
        floorId: matchingFloor?.id || "fl-1",
        floorName: tableFloorInput,
        tableName: cleanTableName,
        capacity: seatsNum,
        status: tableStatusInput,
        isActive: true,
      };
      saveTables([...tables, newTb]);
      if (matchingFloor) {
        saveFloors(
          floors.map((f) =>
            f.id === matchingFloor.id
              ? {
                  ...f,
                  tableCount: f.tableCount + 1,
                  capacity: f.capacity + seatsNum,
                }
              : f
          )
        );
      }
      showToast(`New table "${cleanTableName}" added to ${tableFloorInput}`);
    }

    setIsTableModalOpen(false);
  };

  // Reset to default initial data
  const handleResetDefaults = () => {
    if (confirm("Reset Floor & Table setup to default Marinozz layout?")) {
      saveFloors(INITIAL_FLOORS);
      saveTables(INITIAL_TABLES);
      showToast("Reset to default setup successfully");
    }
  };

  // Filtered Floors
  const filteredFloors = useMemo(() => {
    return floors.filter((f) => {
      if (selectedFloor !== "All" && f.floorName !== selectedFloor) return false;
      if (selectedStatus !== "All" && f.status !== selectedStatus) return false;
      return true;
    });
  }, [floors, selectedFloor, selectedStatus]);

  // Grouped Tables for Layout view
  const groupedTables = useMemo(() => {
    const list = tables.filter((t) => {
      if (selectedFloor !== "All" && t.floorName !== selectedFloor) return false;
      if (selectedStatus !== "All" && t.status !== selectedStatus) return false;
      return true;
    });

    const groups: Record<string, TableRecord[]> = {};
    for (const t of list) {
      if (!groups[t.floorName]) groups[t.floorName] = [];
      groups[t.floorName].push(t);
    }
    return groups;
  }, [tables, selectedFloor, selectedStatus]);

  // Table statistics
  const totalTables = tables.length;
  const availableCount = tables.filter((t) => t.status === "Available").length;
  const occupiedCount = tables.filter((t) => t.status === "Occupied").length;
  const reservedCount = tables.filter((t) => t.status === "Reserved").length;

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredFloors.length / rowsPerPage));
  const paginatedFloors = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredFloors.slice(start, start + rowsPerPage);
  }, [filteredFloors, currentPage, rowsPerPage]);

  if (!activeSection) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {SETUP_CARDS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectSection(id)}
              className="group flex flex-col items-center justify-center gap-2.5 rounded-md border border-[#b6d4fe] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-6 shadow-[0_2px_8px_rgba(13,110,253,0.08)] hover:border-[#0d6efd] hover:shadow-md transition-all cursor-pointer min-h-[125px]"
            >
              <div className="transition-transform group-hover:scale-105">
                <Icon />
              </div>
              <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 text-center">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (activeSection === "DISCOUNT_OFFER") {
    return <DiscountOfferSection onBack={handleBackToHub} />;
  }

  if (activeSection === "SALES_SETUP") {
    return <SalesSetupSection onBack={handleBackToHub} />;
  }

  if (activeSection === "POINT_REDEEM_OTP") {
    return <PointRedeemOtpSection onBack={handleBackToHub} />;
  }

  if (activeSection === "COUNTER_SETUP") {
    return <CounterSetupSection onBack={handleBackToHub} />;
  }

  // --- FLOOR & TABLE SETUP FULL VIEW ---
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* 1. Header with back button & Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBackToHub}
          className="text-slate-700 dark:text-slate-200 hover:text-blue-600 transition p-1"
          title="Back to Setup Menu"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {activeTab === "FLOOR" ? "Floor" : "Floor Layout"}
        </h1>
      </div>

      {/* 2. Tabs Bar (FLOOR | FLOOR LAYOUT) */}
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("FLOOR")}
          className={`pb-2.5 text-xs font-bold tracking-wider uppercase transition-colors relative ${
            activeTab === "FLOOR"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          FLOOR
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("FLOOR_LAYOUT")}
          className={`pb-2.5 text-xs font-bold tracking-wider uppercase transition-colors relative ${
            activeTab === "FLOOR_LAYOUT"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          FLOOR LAYOUT
        </button>
      </div>

      {/* 3. Filter Bar & Buttons */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Office
            </label>
            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="h-9 w-40 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All</option>
              <option value="Marinozz">Marinozz</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Floor
            </label>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="h-9 w-40 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="All">All</option>
              {floors.map((f) => (
                <option key={f.id} value={f.floorName}>
                  {f.floorName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 w-32 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Reserved">Reserved</option>
            </select>
          </div>

          {activeTab === "FLOOR" && (
            <button
              type="button"
              onClick={() => showToast(`Filtered ${filteredFloors.length} floors`)}
              className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
            >
              View
            </button>
          )}

          {activeTab === "FLOOR_LAYOUT" && (
            /* Interactive Layout Stats Badges */
            <div className="flex items-center gap-2 mt-4 sm:mt-0 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedStatus("All")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                  selectedStatus === "All"
                    ? "bg-[#0284c7] text-white shadow-xs"
                    : "border border-slate-300 text-slate-600 bg-white hover:bg-slate-50"
                }`}
                title="Filter by All tables"
              >
                All: {totalTables}
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus("Available")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                  selectedStatus === "Available"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "border border-emerald-500 text-emerald-600 bg-white hover:bg-emerald-50"
                }`}
                title="Filter by Available tables"
              >
                Available: {availableCount}
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus("Occupied")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                  selectedStatus === "Occupied"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "border border-rose-500 text-rose-600 bg-white hover:bg-rose-50"
                }`}
                title="Filter by Occupied tables"
              >
                Occupied: {occupiedCount}
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus("Reserved")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                  selectedStatus === "Reserved"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "border border-amber-500 text-amber-600 bg-white hover:bg-amber-50"
                }`}
                title="Filter by Reserved tables"
              >
                Reserved: {reservedCount}
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {activeTab === "FLOOR" ? (
            <button
              type="button"
              onClick={openCreateFloor}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create New Floor</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="h-9 px-3 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs rounded flex items-center gap-1.5 transition cursor-pointer"
                title="Reset to default Marinozz layout"
              >
                <RotateCw className="size-3.5 text-blue-600" />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={openCreateTable}
                className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="size-4" />
                <span>Add Table</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4. Tab 1: FLOOR TABLE VIEW */}
      {activeTab === "FLOOR" && (
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3 font-semibold w-16">SL</th>
                <th className="p-3 font-semibold">Office Name</th>
                <th className="p-3 font-semibold">Floor Name</th>
                <th className="p-3 font-semibold">Capacity</th>
                <th className="p-3 font-semibold">Table Count</th>
                <th className="p-3 font-semibold text-center">Status</th>
                <th className="p-3 font-semibold text-center w-28">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedFloors.map((row, idx) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="p-3 font-mono text-slate-500">
                    {(currentPage - 1) * rowsPerPage + idx + 1}
                  </td>
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                    {row.officeName}
                  </td>
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                    {row.floorName}
                  </td>
                  <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                    {row.capacity}
                  </td>
                  <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                    {row.tableCount}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        row.status === "Active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEditFloor(row)}
                        className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition cursor-pointer"
                        title="Edit Floor"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFloorStatus(row.id)}
                        className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 cursor-pointer ${
                          row.status === "Active" ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                        title="Toggle status"
                      >
                        <span
                          className={`size-4 rounded-full bg-white shadow-xs transition-transform ${
                            row.status === "Active" ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedFloors.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No floors found matching the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Footer Pagination */}
          <div className="flex items-center justify-end gap-6 px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-xs cursor-pointer"
              >
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="50">50</option>
              </select>
            </div>
            <span>
              {filteredFloors.length === 0
                ? "0 of 0"
                : `${(currentPage - 1) * rowsPerPage + 1}–${Math.min(
                    currentPage * rowsPerPage,
                    filteredFloors.length
                  )} of ${filteredFloors.length}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab 2: FLOOR LAYOUT VIEW (Visual Grid of Tables with Chairs) */}
      {activeTab === "FLOOR_LAYOUT" && (
        <div className="space-y-6 pt-2">
          {Object.entries(groupedTables).map(([floorName, floorTables]) => (
            <div key={floorName} className="space-y-3">
              {/* Floor Group Header with vertical bar */}
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 bg-blue-700 rounded-full" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide uppercase">
                  {floorName}
                </h2>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                  {floorTables.length} tables
                </span>
              </div>

              {/* Grid of Interactive Table Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {floorTables.map((t) => (
                  <div
                    key={t.id}
                    className={`relative bg-white dark:bg-slate-900 border rounded-xl p-3 shadow-xs hover:shadow-md transition flex flex-col items-center justify-between min-h-[175px] ${
                      t.isActive
                        ? "border-slate-200/90 dark:border-slate-800"
                        : "border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50/50"
                    }`}
                  >
                    {/* Top Row: Clickable Status badge & Toggle Switches */}
                    <div className="w-full flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={() => cycleTableStatus(t.id)}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition cursor-pointer ${
                          t.status === "Available"
                            ? "border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100"
                            : t.status === "Occupied"
                            ? "border-rose-400 text-rose-700 dark:text-rose-300 bg-rose-50/60 dark:bg-rose-950/40 hover:bg-rose-100"
                            : "border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100"
                        }`}
                        title="Click to cycle status: Available -> Occupied -> Reserved"
                      >
                        <span
                          className={`size-2 rounded-full ${
                            t.status === "Available"
                              ? "bg-emerald-500"
                              : t.status === "Occupied"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                        />
                        <span>{t.status}</span>
                      </button>

                      <div className="flex items-center gap-2 text-slate-400">
                        <button
                          type="button"
                          onClick={() => showToast(`Table ${t.tableName}: Waiter service requested!`)}
                          className="hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                          title="Call waiter service"
                        >
                          <Bell className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditTable(t)}
                          className="hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                          title="Edit table"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleTableActive(t.id)}
                          className={`w-7 h-4 rounded-full transition-colors relative flex items-center px-0.5 cursor-pointer ${
                            t.isActive ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                          }`}
                          title={t.isActive ? "Deactivate table" : "Activate table"}
                        >
                          <span
                            className={`size-3 rounded-full bg-white shadow-xs transition-transform ${
                              t.isActive ? "translate-x-3" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Middle: Visual Table with 4 or 2 rounded chairs */}
                    <div className="relative my-2 size-20 flex items-center justify-center">
                      {t.capacity >= 4 ? (
                        <>
                          {/* Top chair */}
                          <div className="absolute top-0 w-6 h-3.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                          {/* Bottom chair */}
                          <div className="absolute bottom-0 w-6 h-3.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                          {/* Left chair */}
                          <div className="absolute left-0 w-3.5 h-6 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                          {/* Right chair */}
                          <div className="absolute right-0 w-3.5 h-6 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                        </>
                      ) : (
                        <>
                          {/* 2 persons: left and right chairs only per screenshot */}
                          <div className="absolute left-1 w-3.5 h-6 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                          <div className="absolute right-1 w-3.5 h-6 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                        </>
                      )}

                      {/* Main central table box with Fork & Knife icon */}
                      <div
                        className={`size-11 rounded-xl border flex items-center justify-center shadow-xs transition ${
                          t.status === "Available"
                            ? "border-emerald-400 bg-white dark:bg-slate-900"
                            : t.status === "Occupied"
                            ? "border-rose-400 bg-rose-50/30 dark:bg-rose-950/30"
                            : "border-amber-400 bg-amber-50/30 dark:bg-amber-950/30"
                        }`}
                      >
                        <UtensilsCrossed
                          className={`size-5 ${
                            t.status === "Available"
                              ? "text-emerald-600"
                              : t.status === "Occupied"
                              ? "text-rose-600"
                              : "text-amber-600"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Bottom: Table Name & Persons */}
                    <div className="text-center w-full">
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100 tracking-wider">
                        {t.tableName}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mt-0.5">
                        {t.capacity} PERSONS
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(groupedTables).length === 0 && (
            <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-800">
              No tables found matching the selected floor or status.
            </div>
          )}
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle className="size-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Create / Edit Floor Modal */}
      {isFloorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingFloor ? "Edit Floor" : "Create New Floor"}
              </h3>
              {editingFloor && (
                <button
                  type="button"
                  onClick={() => handleDeleteFloor(editingFloor.id)}
                  className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer"
                  title="Delete floor"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete Floor</span>
                </button>
              )}
            </div>
            <form onSubmit={handleSaveFloor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Floor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter floor name"
                  value={floorNameInput}
                  onChange={(e) => setFloorNameInput(e.target.value)}
                  className="w-full h-10 rounded border border-slate-300 dark:border-slate-700 px-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Office <span className="text-red-500">*</span>
                </label>
                <select
                  value={floorOfficeInput}
                  onChange={(e) => setFloorOfficeInput(e.target.value)}
                  className="w-full h-10 rounded border border-slate-300 dark:border-slate-700 px-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Marinozz">Marinozz</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsFloorModalOpen(false)}
                  className="px-3 py-1.5 text-sm font-bold text-rose-500 hover:text-rose-600 transition tracking-wider uppercase cursor-pointer"
                >
                  CLOSE
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition tracking-wider uppercase cursor-pointer"
                >
                  {editingFloor ? "UPDATE" : "CREATE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Table Modal */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingTable ? "Edit Table" : "Add New Table"}
              </h3>
              {editingTable && (
                <button
                  type="button"
                  onClick={() => handleDeleteTable(editingTable.id)}
                  className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer"
                  title="Delete table"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete Table</span>
                </button>
              )}
            </div>
            <form onSubmit={handleSaveTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Office <span className="text-red-500">*</span>
                </label>
                <select
                  value={tableOfficeInput}
                  onChange={(e) => setTableOfficeInput(e.target.value)}
                  className="w-full h-10 rounded border border-slate-300 dark:border-slate-700 px-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Marinozz">Marinozz</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Floor <span className="text-red-500">*</span>
                </label>
                <select
                  value={tableFloorInput}
                  onChange={(e) => setTableFloorInput(e.target.value)}
                  className="w-full h-10 rounded border border-slate-300 dark:border-slate-700 px-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {floors.map((f) => (
                    <option key={f.id} value={f.floorName}>
                      {f.floorName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Table Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter table name"
                  value={tableNameInput}
                  onChange={(e) => setTableNameInput(e.target.value)}
                  className="w-full h-10 rounded border border-slate-300 dark:border-slate-700 px-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Total Seats <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={20}
                  value={tableSeatsInput}
                  onChange={(e) => setTableSeatsInput(e.target.value)}
                  className="w-full h-10 rounded border border-slate-300 dark:border-slate-700 px-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {editingTable && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Status
                  </label>
                  <select
                    value={tableStatusInput}
                    onChange={(e) =>
                      setTableStatusInput(
                        e.target.value as "Available" | "Occupied" | "Reserved"
                      )
                    }
                    className="w-full h-10 rounded border border-slate-300 dark:border-slate-700 px-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Available">Available</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Reserved">Reserved</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsTableModalOpen(false)}
                  className="px-3 py-1.5 text-sm font-bold text-rose-500 hover:text-rose-600 transition tracking-wider uppercase cursor-pointer"
                >
                  CLOSE
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition tracking-wider uppercase cursor-pointer"
                >
                  {editingTable ? "UPDATE" : "ADD TABLE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default function PosSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 flex items-center justify-center text-xs text-slate-400">
          Loading POS Setup...
        </div>
      }
    >
      <PosSetupContent />
    </Suspense>
  );
}
