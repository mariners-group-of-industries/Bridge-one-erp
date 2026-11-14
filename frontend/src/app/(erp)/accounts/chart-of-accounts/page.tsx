"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  MinusSquare,
  Pencil,
  Plus,
  PlusSquare,
  Printer,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { parseCoaWorksheet } from "@/lib/accounting/coa-import";
import {
  useAccountingStore,
  type AccountingEmployeeOption,
} from "@/features/accounts/store/accounting-store";
import type {
  AccountItem,
  AccountType,
  CoaPermissionItem,
  NormalBalance,
} from "@/features/accounts/types";

type TierLevel = "Group" | "Class" | "Category" | "GL";

interface HierarchyNode extends AccountItem {
  depth: number;
  tier: TierLevel;
  rollupBalance: number;
  hasChildren: boolean;
}

interface StagedPermissionRow {
  tempId: string;
  employeeUuid?: string;
  employeeId: string;
  employeeName: string;
  voucherType: string;
  accountId?: string;
  accountHeadCode: string;
  accountHeadName: string;
}

function fmtAmount(n: number): string {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function inferAccountTypeFromCode(code: string): { accountType: AccountType; normalBalance: NormalBalance } {
  if (code.startsWith("1") || code.startsWith("2")) {
    return { accountType: "ASSET", normalBalance: "DEBIT" };
  }
  if (code.startsWith("3") || code.startsWith("4")) {
    return { accountType: "LIABILITY", normalBalance: "CREDIT" };
  }
  if (code.startsWith("5")) {
    return { accountType: "EQUITY", normalBalance: "CREDIT" };
  }
  if (code.startsWith("6")) {
    return { accountType: "REVENUE", normalBalance: "CREDIT" };
  }
  return { accountType: "EXPENSE", normalBalance: "DEBIT" };
}

export default function ChartOfAccountsPage() {
  const accounts = useAccountingStore((s) => s.accounts);
  const coaPermissions = useAccountingStore((s) => s.coaPermissions);
  const employees = useAccountingStore((s) => s.employees);
  const vouchers = useAccountingStore((s) => s.vouchers);

  const addAccountAsync = useAccountingStore((s) => s.addAccountAsync);
  const updateAccountAsync = useAccountingStore((s) => s.updateAccountAsync);
  const deleteAccountAsync = useAccountingStore((s) => s.deleteAccountAsync);
  const toggleAccountStatus = useAccountingStore((s) => s.toggleAccountStatus);
  const seedStandardCoaAsync = useAccountingStore((s) => s.seedStandardCoaAsync);
  const bulkUploadAccountsAsync = useAccountingStore((s) => s.bulkUploadAccountsAsync);
  const saveCoaPermissionsBatchAsync = useAccountingStore((s) => s.saveCoaPermissionsBatchAsync);
  const deleteCoaPermission = useAccountingStore((s) => s.deleteCoaPermission);
  const toggleCoaPermission = useAccountingStore((s) => s.toggleCoaPermission);
  const syncDatabase = useAccountingStore((s) => s.syncDatabase);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"TABLE" | "TREE" | "PERMISSION">("TABLE");

  // Feedback Banner
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Table View Filters
  const [statusFilter, setStatusFilter] = useState<"Active" | "Inactive" | "All">("Active");

  // Tree View Expansion State (collapsed by default to match root 1..8 screenshot)
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({});
  const [selectedTreeCode, setSelectedTreeCode] = useState<string>("");

  // COA Permission Tab Filter States
  const [permEmpSearch, setPermEmpSearch] = useState("");
  const [permVoucherFilter, setPermVoucherFilter] = useState("ALL");
  const [permAccountFilter, setPermAccountFilter] = useState("ALL");
  const [appliedPermFilters, setAppliedPermFilters] = useState({
    employee: "",
    voucherType: "ALL",
    accountHeadCode: "ALL",
  });
  const [fetchedPermissions, setFetchedPermissions] = useState<CoaPermissionItem[] | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // Create / Edit / Upload Account Modal
  const [isCreateUploadOpen, setIsCreateUploadOpen] = useState(false);
  const [createUploadTab, setCreateUploadTab] = useState<"CREATE" | "UPLOAD">("CREATE");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [modalError, setModalError] = useState("");

  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    parentCode: "",
    accountType: "ASSET" as AccountType,
    tierLevel: "GL" as TierLevel,
    accountSubtype: "GL",
    normalBalance: "DEBIT" as NormalBalance,
    openingBalance: 0,
    currency: "BDT",
    isGroup: false,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    description: "",
  });

  // Bulk Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedUploadRows, setParsedUploadRows] = useState<Array<Partial<AccountItem>>>([]);
  const [uploadFileName, setUploadFileName] = useState("");

  // Create COA Permission Modal
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [modalEmpSearch, setModalEmpSearch] = useState("");
  const [modalSelectedEmp, setModalSelectedEmp] = useState<AccountingEmployeeOption | null>(null);
  const [showModalEmpDropdown, setShowModalEmpDropdown] = useState(false);
  const [showFilterEmpDropdown, setShowFilterEmpDropdown] = useState(false);
  const [modalVoucherType, setModalVoucherType] = useState("");
  const [modalAccountCode, setModalAccountCode] = useState("");
  const [stagedPermissions, setStagedPermissions] = useState<StagedPermissionRow[]>([]);
  const [savingPerm, setSavingPerm] = useState(false);

  // GL Ledger Drilldown Modal (clicking underlined Amount)
  const [ledgerAccount, setLedgerAccount] = useState<AccountItem | null>(null);

  useEffect(() => {
    void syncDatabase();
  }, [syncDatabase]);

  // Build hierarchical tree & bottom-up rollup balances
  const { hierarchicalAccounts, rootNodes, childrenByParent, hasRootHierarchy } = useMemo(() => {
    const sorted = [...accounts].sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" })
    );
    const byCode = new Map(sorted.map((a) => [a.code, a]));
    const childMap = new Map<string, AccountItem[]>();

    for (const acc of sorted) {
      const pCode = acc.parentCode && byCode.has(acc.parentCode) ? acc.parentCode : "__ROOT__";
      const list = childMap.get(pCode) || [];
      list.push(acc);
      childMap.set(pCode, list);
    }

    const computeRollup = (code: string, visited = new Set<string>()): number => {
      if (visited.has(code)) return 0;
      visited.add(code);
      const node = byCode.get(code);
      if (!node) return 0;
      const children = childMap.get(code) || [];
      if (children.length === 0) {
        return Number(node.currentBalance || 0);
      }
      const childSum = children
        .filter((c) => c.status === "ACTIVE")
        .reduce((s, c) => s + computeRollup(c.code, new Set(visited)), 0);
      return Number(node.currentBalance || 0) + childSum;
    };

    const getTier = (acc: AccountItem, depth: number): TierLevel => {
      if (
        acc.tierLevel === "Group" ||
        acc.tierLevel === "Class" ||
        acc.tierLevel === "Category" ||
        acc.tierLevel === "GL"
      ) {
        return acc.tierLevel;
      }
      if (!acc.isGroup) return "GL";
      if (depth === 0) return "Group";
      if (depth === 1) return "Class";
      return "Category";
    };

    const flat: HierarchyNode[] = [];
    const seen = new Set<string>();

    const traverse = (parentCode: string, depth: number) => {
      const children = childMap.get(parentCode) || [];
      for (const child of children) {
        if (seen.has(child.code)) continue;
        seen.add(child.code);
        const tier = getTier(child, depth);
        const subChildren = childMap.get(child.code) || [];
        flat.push({
          ...child,
          depth,
          tier,
          rollupBalance: computeRollup(child.code),
          hasChildren: subChildren.length > 0,
        });
        traverse(child.code, depth + 1);
      }
    };

    traverse("__ROOT__", 0);

    const roots = childMap.get("__ROOT__") || [];
    const hasStdRoots = roots.some((r) => ["1", "2", "3", "4", "5", "6", "7", "8"].includes(r.code));

    return {
      hierarchicalAccounts: flat.filter((item) => {
        if (statusFilter === "Active") return item.status === "ACTIVE";
        if (statusFilter === "Inactive") return item.status === "INACTIVE";
        return true;
      }),
      rootNodes: roots,
      childrenByParent: childMap,
      hasRootHierarchy: hasStdRoots,
    };
  }, [accounts, statusFilter]);

  const glAndAllAccountOptions = useMemo(
    () =>
      [...accounts]
        .filter((a) => a.status === "ACTIVE")
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accounts]
  );

  const matchingFilterEmployees = useMemo(() => {
    const q = permEmpSearch.trim().toLowerCase();
    if (q.length < 3) return [];
    return employees
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [employees, permEmpSearch]);

  const matchingModalEmployees = useMemo(() => {
    const q = modalEmpSearch.trim().toLowerCase();
    if (q.length < 3) return [];
    return employees
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [employees, modalEmpSearch]);

  const loadPermissionsFromApi = useCallback(
    async (filters: { employee: string; voucherType: string; accountHeadCode: string }) => {
      setLoadingPermissions(true);
      try {
        const params = new URLSearchParams();
        if (filters.employee) params.set("employee", filters.employee);
        if (filters.voucherType !== "ALL") params.set("voucherType", filters.voucherType);
        if (filters.accountHeadCode !== "ALL") params.set("accountHeadCode", filters.accountHeadCode);
        const res = await fetch(`/api/accounts/coa-permissions?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setFetchedPermissions(json.data);
          }
        }
      } finally {
        setLoadingPermissions(false);
      }
    },
    []
  );

  const displayedPermissions = useMemo(() => {
    const base = fetchedPermissions ?? coaPermissions;
    return base.filter((p) => {
      if (appliedPermFilters.employee.trim()) {
        const q = appliedPermFilters.employee.toLowerCase();
        if (
          !p.employeeName.toLowerCase().includes(q) &&
          !p.employeeId.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (
        appliedPermFilters.voucherType !== "ALL" &&
        p.voucherType !== appliedPermFilters.voucherType
      ) {
        return false;
      }
      if (
        appliedPermFilters.accountHeadCode !== "ALL" &&
        p.accountHeadCode !== appliedPermFilters.accountHeadCode
      ) {
        return false;
      }
      return true;
    });
  }, [fetchedPermissions, coaPermissions, appliedPermFilters]);

  const toggleTreeNode = (code: string) => {
    setExpandedCodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    accounts.forEach((a) => {
      all[a.code] = true;
    });
    setExpandedCodes(all);
  };

  const collapseAll = () => {
    setExpandedCodes({});
  };

  // Recursive Tree renderer (handles arbitrary depth cleanly)
  const renderTreeNodes = (parentCode: string, depth = 0): React.ReactNode => {
    const nodes = childrenByParent.get(parentCode) || [];
    if (nodes.length === 0) return null;

    return nodes.map((node) => {
      const children = childrenByParent.get(node.code) || [];
      const isExpanded = !!expandedCodes[node.code];
      const isSelected = selectedTreeCode === node.code;

      return (
        <div key={node.id} className={depth === 0 ? "mb-1.5" : "mt-0.5"}>
          <div
            onClick={() => {
              setSelectedTreeCode(node.code);
              if (children.length > 0) toggleTreeNode(node.code);
            }}
            className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer select-none transition ${
              isSelected
                ? "bg-blue-50 text-blue-800 font-semibold"
                : "hover:bg-slate-50 text-slate-800"
            }`}
          >
            {children.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTreeNode(node.code);
                }}
                className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-blue-600 shrink-0"
              >
                {isExpanded ? (
                  <MinusSquare className="w-3.5 h-3.5" />
                ) : (
                  <PlusSquare className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0 inline-block" />
            )}
            <span className="text-[13px] font-sans">
              {node.code} - {node.name}
            </span>
          </div>

          {isExpanded && children.length > 0 && (
            <div className="ml-6 pl-2 border-l border-dashed border-slate-200">
              {renderTreeNodes(node.code, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Open Create Child modal
  const handleAddChild = (parent: AccountItem) => {
    setEditingAccountId(null);
    setModalError("");
    const siblings = childrenByParent.get(parent.code) || [];
    const suggestedSuffix = String(siblings.length + 1).padStart(2, "0");
    const defaultTier: TierLevel =
      parent.tierLevel === "Group"
        ? "Class"
        : parent.tierLevel === "Class"
        ? "Category"
        : "GL";

    setAccountForm({
      code: `${parent.code}${suggestedSuffix}`,
      name: "",
      parentCode: parent.code,
      accountType: parent.accountType,
      tierLevel: defaultTier,
      accountSubtype: defaultTier,
      normalBalance: parent.normalBalance,
      openingBalance: 0,
      currency: "BDT",
      isGroup: defaultTier !== "GL",
      status: "ACTIVE",
      description: "",
    });
    setCreateUploadTab("CREATE");
    setIsCreateUploadOpen(true);
  };

  // Open Edit modal
  const handleEdit = (acc: AccountItem) => {
    setEditingAccountId(acc.id);
    setModalError("");
    setAccountForm({
      code: acc.code,
      name: acc.name,
      parentCode: acc.parentCode || "",
      accountType: acc.accountType,
      tierLevel: (acc.tierLevel as TierLevel) || (acc.isGroup ? "Group" : "GL"),
      accountSubtype: acc.accountSubtype,
      normalBalance: acc.normalBalance,
      openingBalance: acc.openingBalance,
      currency: acc.currency,
      isGroup: acc.isGroup,
      status: acc.status,
      description: acc.description || "",
    });
    setCreateUploadTab("CREATE");
    setIsCreateUploadOpen(true);
  };

  const handleDeleteAccount = async (acc: AccountItem) => {
    const res = await deleteAccountAsync(acc.id);
    if (!res.success) {
      setFeedback({ type: "error", text: res.error || "Could not delete account." });
    } else {
      setFeedback({ type: "success", text: `Deleted account ${acc.code} - ${acc.name}.` });
    }
  };

  // Save Account (Create or Edit) to PostgreSQL
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (!accountForm.code.trim() || !accountForm.name.trim()) {
      setModalError("Account code and name are required.");
      return;
    }

    setSavingAccount(true);
    try {
      const payload = {
        code: accountForm.code.trim(),
        name: accountForm.name.trim(),
        parentCode: accountForm.parentCode ? accountForm.parentCode.trim() : null,
        accountType: accountForm.accountType,
        tierLevel: accountForm.tierLevel,
        accountSubtype: accountForm.tierLevel,
        normalBalance: accountForm.normalBalance,
        openingBalance: Number(accountForm.openingBalance || 0),
        currency: accountForm.currency,
        isGroup: accountForm.tierLevel !== "GL",
        status: accountForm.status,
        description: accountForm.description,
      };

      const res = editingAccountId
        ? await updateAccountAsync(editingAccountId, payload)
        : await addAccountAsync(payload);

      if (!res.success) {
        setModalError(res.error || "Failed to save account.");
        return;
      }

      setFeedback({
        type: "success",
        text: editingAccountId
          ? `Account ${payload.code} updated in database.`
          : `Account ${payload.code} created in database.`,
      });
      setIsCreateUploadOpen(false);
    } finally {
      setSavingAccount(false);
    }
  };

  // Export real Excel (.xlsx) via ExcelJS
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Chart Of Accounts");
    sheet.columns = [
      { header: "SL", key: "sl", width: 8 },
      { header: "Code", key: "code", width: 16 },
      { header: "Parent Code", key: "parentCode", width: 16 },
      { header: "Description", key: "name", width: 42 },
      { header: "Amount", key: "amount", width: 18 },
      { header: "Account Type", key: "tier", width: 15 },
      { header: "Classification", key: "accountType", width: 16 },
      { header: "Status", key: "status", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };

    hierarchicalAccounts.forEach((acc, idx) => {
      sheet.addRow({
        sl: idx + 1,
        code: acc.code,
        parentCode: acc.parentCode || "",
        name: `${"  ".repeat(acc.depth)}${acc.name}`,
        amount: acc.rollupBalance,
        tier: acc.tier,
        accountType: acc.accountType,
        status: acc.status,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chart_of_accounts_${new Date().toISOString().split("T")[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSampleTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("COA_Template");
    sheet.columns = [
      { header: "Code", key: "code", width: 16 },
      { header: "Description", key: "name", width: 36 },
      { header: "Parent Code", key: "parentCode", width: 16 },
      { header: "Account Type", key: "tierLevel", width: 15 },
      { header: "Opening Balance", key: "openingBalance", width: 18 },
    ];
    sheet.addRow({
      code: "10101016",
      name: "Cash in Hand - Corporate Desk",
      parentCode: "10101",
      tierLevel: "GL",
      openingBalance: 0,
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "coa_upload_template.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Parse .xlsx / .csv uploaded file with ExcelJS / CSV fallback
  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setModalError("");
    setUploadFileName(file.name);

    try {
      const rows: Array<Partial<AccountItem>> = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
          if (!cols[0] || !cols[1]) continue;
          const inferred = inferAccountTypeFromCode(cols[0]);
          const tier = (["Group", "Class", "Category", "GL"].includes(cols[3]) ? cols[3] : "GL") as TierLevel;
          rows.push({
            code: cols[0],
            name: cols[1],
            parentCode: cols[2] || null,
            tierLevel: tier,
            accountSubtype: tier,
            isGroup: tier !== "GL",
            openingBalance: Number(cols[4] || 0),
            accountType: inferred.accountType,
            normalBalance: inferred.normalBalance,
            status: "ACTIVE",
          });
        }
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const sheet = workbook.worksheets[0];
        if (sheet) {
          const parsed = parseCoaWorksheet(sheet);
          for (const item of parsed) {
            rows.push(item);
          }
        }
      }
      if (rows.length === 0) {
        setModalError("No valid COA rows found in the uploaded file.");
      }
      setParsedUploadRows(rows);
    } catch {
      setModalError("Failed to parse file. Please use the sample .xlsx or .csv format.");
    }
  };

  const handleBulkImport = async () => {
    if (parsedUploadRows.length === 0) {
      setModalError("Please choose an Excel or CSV file first.");
      return;
    }
    setSavingAccount(true);
    try {
      const res = await bulkUploadAccountsAsync(parsedUploadRows);
      if (!res.success) {
        setModalError(res.error || "Bulk upload failed.");
        return;
      }
      setFeedback({
        type: "success",
        text: `Imported ${parsedUploadRows.length} account(s) to Chart of Accounts.`,
      });
      setParsedUploadRows([]);
      setUploadFileName("");
      setIsCreateUploadOpen(false);
    } finally {
      setSavingAccount(false);
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  // Add row inside Create COA Permission Modal
  const handleStagePermissionRow = () => {
    setModalError("");
    const empName = modalSelectedEmp?.name || modalEmpSearch.trim();
    const empCode = modalSelectedEmp?.employeeCode || empName;
    if (!empName || !modalVoucherType || !modalAccountCode) {
      setModalError("Please select Employee, Voucher Type, and Account Head.");
      return;
    }
    const acc = accounts.find((a) => a.code === modalAccountCode);
    const alreadyStaged = stagedPermissions.some(
      (r) =>
        r.employeeId === empCode &&
        r.voucherType === modalVoucherType &&
        r.accountHeadCode === modalAccountCode
    );
    if (alreadyStaged) {
      setModalError("This combination is already in the staged list.");
      return;
    }
    setStagedPermissions((prev) => [
      ...prev,
      {
        tempId: `${empCode}-${modalVoucherType}-${modalAccountCode}-${Date.now()}`,
        employeeUuid: modalSelectedEmp?.id,
        employeeId: empCode,
        employeeName: empName,
        voucherType: modalVoucherType,
        accountId: acc?.id,
        accountHeadCode: modalAccountCode,
        accountHeadName: acc?.name || modalAccountCode,
      },
    ]);
  };

  // Save staged permissions (or current form selection) to PostgreSQL
  const handleSavePermissionsModal = async () => {
    setModalError("");
    let rowsToSave = [...stagedPermissions];

    if (rowsToSave.length === 0) {
      const empName = modalSelectedEmp?.name || modalEmpSearch.trim();
      const empCode = modalSelectedEmp?.employeeCode || empName;
      if (empName && modalVoucherType && modalAccountCode) {
        const acc = accounts.find((a) => a.code === modalAccountCode);
        rowsToSave = [
          {
            tempId: "single",
            employeeUuid: modalSelectedEmp?.id,
            employeeId: empCode,
            employeeName: empName,
            voucherType: modalVoucherType,
            accountId: acc?.id,
            accountHeadCode: modalAccountCode,
            accountHeadName: acc?.name || modalAccountCode,
          },
        ];
      }
    }

    if (rowsToSave.length === 0) {
      setModalError("Click Add to stage at least one COA Permission.");
      return;
    }

    setSavingPerm(true);
    try {
      const res = await saveCoaPermissionsBatchAsync(
        rowsToSave.map((r) => ({
          employeeUuid: r.employeeUuid,
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          voucherType: r.voucherType,
          accountId: r.accountId,
          accountHeadCode: r.accountHeadCode,
          accountHeadName: r.accountHeadName,
          status: "ACTIVE",
        }))
      );
      if (!res.success) {
        setModalError(res.error || "Failed to save permissions.");
        return;
      }
      setFeedback({
        type: "success",
        text: `Saved ${rowsToSave.length} COA permission(s) to database.`,
      });
      setStagedPermissions([]);
      setFetchedPermissions(null);
      setIsPermModalOpen(false);
    } finally {
      setSavingPerm(false);
    }
  };

  // Ledger lines for clicked GL Amount
  const ledgerRows = useMemo(() => {
    if (!ledgerAccount) return [];
    const posted = vouchers
      .filter((v) => v.status === "POSTED")
      .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
    let running = Number(ledgerAccount.openingBalance || 0);
    const items: Array<{
      date: string;
      voucherNumber: string;
      type: string;
      narration: string;
      debit: number;
      credit: number;
      balance: number;
    }> = [];
    for (const v of posted) {
      for (const l of v.lines) {
        if (l.accountId === ledgerAccount.id || l.accountCode === ledgerAccount.code) {
          const delta =
            ledgerAccount.normalBalance === "DEBIT"
              ? l.debit - l.credit
              : l.credit - l.debit;
          running += delta;
          items.push({
            date: v.transactionDate,
            voucherNumber: v.voucherNumber,
            type: v.journalType,
            narration: l.narration || v.narration,
            debit: l.debit,
            credit: l.credit,
            balance: running,
          });
        }
      }
    }
    return items;
  }, [ledgerAccount, vouchers]);

  return (
    <div className="space-y-3 font-sans pb-12 bg-white min-h-screen">
      {/* 1. TOP HEADER — Contextual buttons match Screenshots 2, 3, 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            Chart Of Accounts
          </h1>
          {!hasRootHierarchy && (
            <button
              type="button"
              onClick={async () => {
                const res = await seedStandardCoaAsync();
                if (res.success) {
                  setFeedback({
                    type: "success",
                    text: "Standard 8-group Chart of Accounts hierarchy initialized.",
                  });
                }
              }}
              className="h-7 px-2.5 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition cursor-pointer"
            >
              Initialize Standard Hierarchy
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "TABLE" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingAccountId(null);
                  setModalError("");
                  setAccountForm({
                    code: "",
                    name: "",
                    parentCode: "",
                    accountType: "ASSET",
                    tierLevel: "GL",
                    accountSubtype: "GL",
                    normalBalance: "DEBIT",
                    openingBalance: 0,
                    currency: "BDT",
                    isGroup: false,
                    status: "ACTIVE",
                    description: "",
                  });
                  setCreateUploadTab("CREATE");
                  setIsCreateUploadOpen(true);
                }}
                className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <span>Create Upload</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="h-8 px-3.5 bg-white hover:bg-slate-50 text-[#2563eb] border border-blue-300 font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition uppercase cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>EXPORT EXCEL</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="h-8 px-3.5 bg-white hover:bg-slate-50 text-[#2563eb] border border-blue-300 font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition uppercase cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PRINT/PDF</span>
              </button>
            </>
          )}

          {activeTab === "TREE" && (
            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-3.5 bg-white hover:bg-slate-50 text-[#2563eb] border border-blue-300 font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition uppercase cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PRINT/PDF</span>
            </button>
          )}

          {activeTab === "PERMISSION" && (
            <button
              type="button"
              onClick={() => {
                setModalError("");
                setStagedPermissions([]);
                setIsPermModalOpen(true);
              }}
              className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded shadow-xs transition cursor-pointer"
            >
              Create
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mx-4 px-3 py-2 rounded border text-xs flex items-center justify-between print:hidden ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. TABS BAR */}
      <div className="px-4 border-b border-slate-200 flex items-center gap-6 text-xs font-semibold uppercase tracking-wider print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("TABLE")}
          className={`py-2.5 transition border-b-2 -mb-[1px] cursor-pointer ${
            activeTab === "TABLE"
              ? "text-[#2563eb] border-[#2563eb] font-bold"
              : "text-slate-500 border-transparent hover:text-slate-800"
          }`}
        >
          TABLE VIEW
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TREE")}
          className={`py-2.5 transition border-b-2 -mb-[1px] cursor-pointer ${
            activeTab === "TREE"
              ? "text-[#2563eb] border-[#2563eb] font-bold"
              : "text-slate-500 border-transparent hover:text-slate-800"
          }`}
        >
          TREE VIEW
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PERMISSION")}
          className={`py-2.5 transition border-b-2 -mb-[1px] cursor-pointer ${
            activeTab === "PERMISSION"
              ? "text-[#2563eb] border-[#2563eb] font-bold"
              : "text-slate-500 border-transparent hover:text-slate-800"
          }`}
        >
          COA PERMISSION
        </button>
      </div>

      {/* 3. TAB 1: TABLE VIEW */}
      {activeTab === "TABLE" && (
        <div className="px-4 space-y-3">
          <div className="w-64 print:hidden">
            <label className="block text-[11px] text-slate-500 font-medium mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "Active" | "Inactive" | "All")}
              className="w-full h-9 px-2.5 border border-slate-300 rounded text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="All">All</option>
            </select>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#d8ebfc] border-b border-slate-200 text-[11px] font-bold text-slate-800">
                <tr>
                  <th className="px-3 py-2 w-12 border-r border-slate-200 text-center">SL</th>
                  <th className="px-3 py-2 w-28 border-r border-slate-200">Code</th>
                  <th className="px-4 py-2 border-r border-slate-200">Description</th>
                  <th className="px-3 py-2 w-36 border-r border-slate-200 text-right">Amount</th>
                  <th className="px-3 py-2 w-32 border-r border-slate-200">Account Type</th>
                  <th className="px-3 py-2 w-40 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hierarchicalAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No accounts found for the selected status.
                    </td>
                  </tr>
                ) : (
                  hierarchicalAccounts.map((acc, index) => {
                    const isGroup = acc.tier === "Group";
                    const isClass = acc.tier === "Class";
                    const isCategory = acc.tier === "Category";
                    const isGL = acc.tier === "GL";

                    const paddingLeft =
                      acc.depth === 0
                        ? "pl-3"
                        : acc.depth === 1
                        ? "pl-8"
                        : acc.depth === 2
                        ? "pl-14"
                        : "pl-20";

                    return (
                      <tr
                        key={acc.id}
                        className="hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="px-3 py-2 text-center text-slate-500 border-r border-slate-100 text-[11px] tabular-nums">
                          {index + 1}
                        </td>

                        <td className="px-3 py-2 text-slate-800 border-r border-slate-100 text-xs tabular-nums">
                          {acc.code}
                        </td>

                        <td className={`py-2 pr-4 border-r border-slate-100 ${paddingLeft}`}>
                          <span
                            className={
                              isGroup
                                ? "font-semibold text-slate-900"
                                : isClass || isCategory
                                ? "font-medium text-slate-800"
                                : "text-slate-700"
                            }
                          >
                            {acc.name}
                          </span>
                        </td>

                        <td className="px-3 py-2 text-right text-slate-800 border-r border-slate-100 text-xs tabular-nums">
                          {isGL ? (
                            <button
                              type="button"
                              onClick={() => setLedgerAccount(acc)}
                              title="View General Ledger transactions"
                              className="underline decoration-slate-500 hover:text-blue-600 cursor-pointer tabular-nums"
                            >
                              {fmtAmount(acc.rollupBalance)}
                            </button>
                          ) : (
                            <span>{fmtAmount(acc.rollupBalance)}</span>
                          )}
                        </td>

                        <td className="px-3 py-2 text-slate-700 border-r border-slate-100 text-xs">
                          {acc.tier}
                        </td>

                        <td className="px-3 py-2 text-center print:hidden">
                          <div className="flex items-center justify-center gap-2">
                            {(isGroup || isClass || isCategory) && (
                              <button
                                type="button"
                                onClick={() => handleAddChild(acc)}
                                title={`Add Child under ${acc.name}`}
                                className="w-5 h-5 rounded-full bg-[#2563eb] hover:bg-blue-700 text-white flex items-center justify-center transition cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {isGL && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(acc)}
                                  title="Edit Account Head"
                                  className="p-1 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleDeleteAccount(acc)}
                                  title="Delete Account"
                                  className="p-1 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {(isCategory || isGL) && (
                              <button
                                type="button"
                                onClick={() => toggleAccountStatus(acc.id)}
                                title={acc.status === "ACTIVE" ? "Deactivate" : "Activate"}
                                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 cursor-pointer ${
                                  acc.status === "ACTIVE" ? "bg-[#2563eb]" : "bg-slate-300"
                                }`}
                              >
                                <span
                                  className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                    acc.status === "ACTIVE" ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            )}

                            {isGL && (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalAccountCode(acc.code);
                                  setModalError("");
                                  setStagedPermissions([]);
                                  setIsPermModalOpen(true);
                                }}
                                title="Assign Employee COA Permission"
                                className="p-1 text-slate-600 hover:text-blue-600 transition cursor-pointer"
                              >
                                <User className="w-3.5 h-3.5" />
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
          </div>
        </div>
      )}

      {/* 4. TAB 2: TREE VIEW */}
      {activeTab === "TREE" && (
        <div className="px-4 space-y-2">
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded transition cursor-pointer"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded transition cursor-pointer"
            >
              Collapse All
            </button>
          </div>

          <div className="py-2 min-h-[460px] bg-white">
            {rootNodes.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No Chart of Accounts loaded yet.
              </div>
            ) : (
              renderTreeNodes("__ROOT__", 0)
            )}
          </div>
        </div>
      )}

      {/* 5. TAB 3: COA PERMISSION */}
      {activeTab === "PERMISSION" && (
        <div className="px-4 space-y-3">
          {/* Filter Bar matching Screenshot 4 */}
          <div className="flex flex-wrap items-end gap-3 text-xs">
            {/* Employee Autocomplete Filter */}
            <div className="w-72 relative">
              <label className="block text-[11px] text-slate-500 font-medium mb-1">
                Employee
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Select/Search Employee (min 3 letters)"
                  value={permEmpSearch}
                  onFocus={() => setShowFilterEmpDropdown(true)}
                  onBlur={() => setTimeout(() => setShowFilterEmpDropdown(false), 180)}
                  onChange={(e) => {
                    setPermEmpSearch(e.target.value);
                    setShowFilterEmpDropdown(true);
                  }}
                  className="w-full h-9 pl-3 pr-8 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              {showFilterEmpDropdown && matchingFilterEmployees.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded shadow-md">
                  {matchingFilterEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onMouseDown={() => {
                        setPermEmpSearch(emp.name);
                        setShowFilterEmpDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium text-slate-800">{emp.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {emp.employeeCode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Voucher Type Filter */}
            <div className="w-60">
              <label className="block text-[11px] text-slate-500 font-medium mb-1">
                Voucher Type
              </label>
              <select
                value={permVoucherFilter}
                onChange={(e) => setPermVoucherFilter(e.target.value)}
                className="w-full h-9 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Voucher Type</option>
                <option value="Payment">Payment</option>
                <option value="Receipt">Receipt</option>
                <option value="General">General</option>
                <option value="Contra">Contra</option>
                <option value="Adjustment">Adjustment</option>
                <option value="Journal">Journal</option>
              </select>
            </div>

            {/* Account Head Filter */}
            <div className="w-64">
              <label className="block text-[11px] text-slate-500 font-medium mb-1">
                Account Head
              </label>
              <select
                value={permAccountFilter}
                onChange={(e) => setPermAccountFilter(e.target.value)}
                className="w-full h-9 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Account Head</option>
                {glAndAllAccountOptions.map((acc) => (
                  <option key={acc.id} value={acc.code}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* View Button */}
            <button
              type="button"
              onClick={() => {
                const next = {
                  employee: permEmpSearch.trim(),
                  voucherType: permVoucherFilter,
                  accountHeadCode: permAccountFilter,
                };
                setAppliedPermFilters(next);
                void loadPermissionsFromApi(next);
              }}
              disabled={loadingPermissions}
              className="h-9 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded shadow-xs transition cursor-pointer"
            >
              {loadingPermissions ? "Loading..." : "View"}
            </button>
          </div>

          {/* Permissions Table matching Screenshot 4 */}
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#d8ebfc] border-b border-slate-200 text-[11px] font-bold text-slate-800">
                <tr>
                  <th className="px-3 py-2 w-16 border-r border-slate-200 text-center">SL</th>
                  <th className="px-4 py-2 border-r border-slate-200">Employee Name</th>
                  <th className="px-4 py-2 border-r border-slate-200">Voucher Type</th>
                  <th className="px-4 py-2 border-r border-slate-200">Account Head</th>
                  <th className="px-3 py-2 w-32 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedPermissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      No COA permissions found. Click &quot;Create&quot; to assign access rights.
                    </td>
                  </tr>
                ) : (
                  displayedPermissions.map((perm, index) => (
                    <tr key={perm.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-2 text-center text-slate-500 border-r border-slate-100 tabular-nums">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-900 border-r border-slate-100">
                        {perm.employeeName}
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {perm.employeeId}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-700 border-r border-slate-100">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold">
                          {perm.voucherType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-800 border-r border-slate-100">
                        <span className="font-mono text-blue-700 font-semibold mr-1.5">
                          {perm.accountHeadCode}
                        </span>
                        {perm.accountHeadName}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleCoaPermission(perm.id)}
                            title={perm.status === "ACTIVE" ? "Revoke Permission" : "Restore Permission"}
                            className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 cursor-pointer ${
                              perm.status === "ACTIVE" ? "bg-[#2563eb]" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                perm.status === "ACTIVE" ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteCoaPermission(perm.id)}
                            title="Delete Permission"
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. CREATE / UPLOAD MODAL */}
      <ModalDialog
        isOpen={isCreateUploadOpen}
        onClose={() => setIsCreateUploadOpen(false)}
        title={editingAccountId ? "Edit Account Head" : "Create / Upload Chart of Accounts"}
        maxWidth="lg"
      >
        <div className="space-y-3 text-xs">
          {!editingAccountId && (
            <div className="flex border-b border-slate-200 gap-4 mb-2">
              <button
                type="button"
                onClick={() => setCreateUploadTab("CREATE")}
                className={`pb-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-[1px] cursor-pointer ${
                  createUploadTab === "CREATE"
                    ? "text-[#2563eb] border-[#2563eb]"
                    : "text-slate-500 border-transparent hover:text-slate-800"
                }`}
              >
                Create Single Account
              </button>
              <button
                type="button"
                onClick={() => setCreateUploadTab("UPLOAD")}
                className={`pb-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-[1px] cursor-pointer ${
                  createUploadTab === "UPLOAD"
                    ? "text-[#2563eb] border-[#2563eb]"
                    : "text-slate-500 border-transparent hover:text-slate-800"
                }`}
              >
                Bulk Excel / CSV Upload
              </button>
            </div>
          )}

          {modalError && (
            <div className="flex items-center gap-2 rounded bg-rose-50 border border-rose-200 p-2 text-xs font-medium text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" /> {modalError}
            </div>
          )}

          {createUploadTab === "CREATE" ? (
            <form onSubmit={handleSaveAccount} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Account Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10101016"
                    value={accountForm.code}
                    onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-mono font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Account Type *
                  </label>
                  <select
                    value={accountForm.tierLevel}
                    onChange={(e) => {
                      const tier = e.target.value as TierLevel;
                      setAccountForm({
                        ...accountForm,
                        tierLevel: tier,
                        accountSubtype: tier,
                        isGroup: tier !== "GL",
                      });
                    }}
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Group">Group</option>
                    <option value="Class">Class</option>
                    <option value="Category">Category</option>
                    <option value="GL">GL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cash in Hand - Dhaka Desk"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Parent Account
                  </label>
                  <select
                    value={accountForm.parentCode}
                    onChange={(e) => setAccountForm({ ...accountForm, parentCode: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">None (Top Level Group)</option>
                    {accounts
                      .filter((a) => a.isGroup || a.tierLevel !== "GL")
                      .map((a) => (
                        <option key={a.id} value={a.code}>
                          {a.code} - {a.name} ({a.tierLevel || a.accountSubtype})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Classification Pillar *
                  </label>
                  <select
                    value={accountForm.accountType}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, accountType: e.target.value as AccountType })
                    }
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ASSET">Asset</option>
                    <option value="LIABILITY">Liability</option>
                    <option value="EQUITY">Equity</option>
                    <option value="REVENUE">Revenue</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={accountForm.openingBalance}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, openingBalance: Number(e.target.value) || 0 })
                    }
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Normal Balance
                  </label>
                  <select
                    value={accountForm.normalBalance}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, normalBalance: e.target.value as NormalBalance })
                    }
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateUploadOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs rounded transition cursor-pointer"
                >
                  {savingAccount ? "Saving..." : editingAccountId ? "Save Changes" : "Create Account"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => void handleFileSelected(e.target.files?.[0])}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition cursor-pointer bg-slate-50/50"
              >
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-800">
                  {uploadFileName || "Click to choose Excel (.xlsx) or CSV file"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Columns: Code, Description, Parent Code, Account Type (Group/Class/Category/GL), Opening Balance
                </p>
              </div>

              {parsedUploadRows.length > 0 && (
                <div className="border border-slate-200 rounded max-h-40 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="px-2 py-1">Code</th>
                        <th className="px-2 py-1">Description</th>
                        <th className="px-2 py-1">Parent</th>
                        <th className="px-2 py-1">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedUploadRows.slice(0, 20).map((r, i) => (
                        <tr key={`${r.code}-${i}`}>
                          <td className="px-2 py-1 font-mono">{r.code}</td>
                          <td className="px-2 py-1">{r.name}</td>
                          <td className="px-2 py-1 font-mono">{r.parentCode || "-"}</td>
                          <td className="px-2 py-1">{r.tierLevel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download Sample COA Excel Template</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateUploadOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={savingAccount || parsedUploadRows.length === 0}
                    onClick={() => void handleBulkImport()}
                    className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded transition cursor-pointer"
                  >
                    {savingAccount ? "Importing..." : `Import ${parsedUploadRows.length || ""} Rows`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ModalDialog>

      {/* 7. CREATE COA PERMISSION MODAL — Matches Screenshot 5 */}
      <ModalDialog
        isOpen={isPermModalOpen}
        onClose={() => setIsPermModalOpen(false)}
        title="Create COA Permission"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          {modalError && (
            <div className="flex items-center gap-2 rounded bg-rose-50 border border-rose-200 p-2 text-xs font-medium text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" /> {modalError}
            </div>
          )}

          {/* Single Horizontal Row: Employee* | Voucher Type* | Account Head* | Add */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4 relative">
              <label className="block text-[11px] font-medium text-slate-700 mb-1">
                Employee <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Select/Search Employee (min 3 letters)"
                  value={modalEmpSearch}
                  onFocus={() => setShowModalEmpDropdown(true)}
                  onBlur={() => setTimeout(() => setShowModalEmpDropdown(false), 180)}
                  onChange={(e) => {
                    setModalEmpSearch(e.target.value);
                    setModalSelectedEmp(null);
                    setShowModalEmpDropdown(true);
                  }}
                  className="w-full h-9 pl-2.5 pr-7 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>

              {showModalEmpDropdown && matchingModalEmployees.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded shadow-lg">
                  {matchingModalEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onMouseDown={() => {
                        setModalSelectedEmp(emp);
                        setModalEmpSearch(emp.name);
                        setShowModalEmpDropdown(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium text-slate-800">{emp.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {emp.employeeCode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-medium text-slate-700 mb-1">
                Voucher Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={modalVoucherType}
                onChange={(e) => setModalVoucherType(e.target.value)}
                className="w-full h-9 px-2.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Voucher Type</option>
                <option value="Payment">Payment</option>
                <option value="Receipt">Receipt</option>
                <option value="General">General</option>
                <option value="Contra">Contra</option>
                <option value="Adjustment">Adjustment</option>
                <option value="Journal">Journal</option>
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-medium text-slate-700 mb-1">
                Account Head <span className="text-rose-500">*</span>
              </label>
              <select
                value={modalAccountCode}
                onChange={(e) => setModalAccountCode(e.target.value)}
                className="w-full h-9 px-2.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Account Head</option>
                {glAndAllAccountOptions.map((acc) => (
                  <option key={acc.id} value={acc.code}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-1">
              <button
                type="button"
                onClick={handleStagePermissionRow}
                className="w-full h-9 px-3 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded shadow-xs transition cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Staged Rows Preview */}
          {stagedPermissions.length > 0 && (
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#d8ebfc] text-[11px] font-bold text-slate-800">
                  <tr>
                    <th className="px-3 py-1.5 w-12 text-center border-r border-slate-200">SL</th>
                    <th className="px-3 py-1.5 border-r border-slate-200">Employee Name</th>
                    <th className="px-3 py-1.5 border-r border-slate-200">Voucher Type</th>
                    <th className="px-3 py-1.5 border-r border-slate-200">Account Head</th>
                    <th className="px-3 py-1.5 w-16 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stagedPermissions.map((row, idx) => (
                    <tr key={row.tempId}>
                      <td className="px-3 py-1.5 text-center border-r border-slate-100">{idx + 1}</td>
                      <td className="px-3 py-1.5 border-r border-slate-100">{row.employeeName}</td>
                      <td className="px-3 py-1.5 border-r border-slate-100">{row.voucherType}</td>
                      <td className="px-3 py-1.5 border-r border-slate-100">
                        {row.accountHeadCode} - {row.accountHeadName}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setStagedPermissions((prev) => prev.filter((x) => x.tempId !== row.tempId))
                          }
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsPermModalOpen(false)}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingPerm}
              onClick={() => void handleSavePermissionsModal()}
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs rounded transition cursor-pointer"
            >
              {savingPerm ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* 8. GL LEDGER DRILLDOWN MODAL */}
      <ModalDialog
        isOpen={Boolean(ledgerAccount)}
        onClose={() => setLedgerAccount(null)}
        title={
          ledgerAccount
            ? `General Ledger — ${ledgerAccount.code} ${ledgerAccount.name}`
            : "General Ledger"
        }
        maxWidth="2xl"
      >
        {ledgerAccount && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap justify-between gap-2 bg-slate-50 border border-slate-200 rounded p-2.5">
              <div>
                <span className="text-slate-500">Opening Balance:</span>{" "}
                <span className="font-semibold tabular-nums">
                  {fmtAmount(ledgerAccount.openingBalance)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Current Balance:</span>{" "}
                <span className="font-bold text-blue-700 tabular-nums">
                  {fmtAmount(ledgerAccount.currentBalance)}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#d8ebfc] text-[11px] font-bold text-slate-800 sticky top-0">
                  <tr>
                    <th className="px-2.5 py-1.5 border-r border-slate-200">Date</th>
                    <th className="px-2.5 py-1.5 border-r border-slate-200">Voucher No</th>
                    <th className="px-2.5 py-1.5 border-r border-slate-200">Narration</th>
                    <th className="px-2.5 py-1.5 text-right border-r border-slate-200">Debit</th>
                    <th className="px-2.5 py-1.5 text-right border-r border-slate-200">Credit</th>
                    <th className="px-2.5 py-1.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No posted journal entries yet for this GL account.
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map((r, i) => (
                      <tr key={`${r.voucherNumber}-${i}`} className="hover:bg-slate-50">
                        <td className="px-2.5 py-1.5 border-r border-slate-100 whitespace-nowrap">
                          {r.date}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono border-r border-slate-100">
                          {r.voucherNumber}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-slate-100">{r.narration}</td>
                        <td className="px-2.5 py-1.5 text-right border-r border-slate-100 tabular-nums">
                          {r.debit ? fmtAmount(r.debit) : "-"}
                        </td>
                        <td className="px-2.5 py-1.5 text-right border-r border-slate-100 tabular-nums">
                          {r.credit ? fmtAmount(r.credit) : "-"}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                          {fmtAmount(r.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
