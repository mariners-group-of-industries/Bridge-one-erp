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
import { ConfirmDialog } from "@/components/ui/dialog";
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
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";

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
  const perms = useFeaturePermissions("/accounts/chart-of-accounts");
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
  // Deletes ask first: an account head or an employee's posting permission.
  const [toDelete, setToDelete] = useState<{ kind: "account"; account: AccountItem } | { kind: "permission"; permission: CoaPermissionItem } | null>(null);
  const [deleting, setDeleting] = useState(false);

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
                ? "bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 font-semibold"
                : "hover:bg-canvas text-ink"
            }`}
          >
            {children.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTreeNode(node.code);
                }}
                className="w-4 h-4 flex items-center justify-center text-ink-faint hover:text-blue-600 dark:hover:text-blue-400 shrink-0"
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
            <div className="ml-6 pl-2 border-l border-dashed border-line">
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
    <div className="space-y-3 font-sans bg-surface flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* 1. TOP HEADER — Contextual buttons match Screenshots 2, 3, 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-surface border-b border-line print:hidden shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-ink tracking-tight">
            Chart Of Accounts
          </h1>
          {!hasRootHierarchy && (
            (perms.create ? (<button
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
              className="h-7 px-2.5 text-[11px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 rounded hover:bg-amber-100 dark:hover:bg-amber-500/15 transition cursor-pointer"
            >
              Initialize Standard Hierarchy
            </button>) : null)
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "TABLE" && (
            <>
              {perms.create && (<button
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
              </button>)}

              {perms.export && (<button
                type="button"
                onClick={handleExportExcel}
                className="h-8 px-3.5 bg-surface hover:bg-canvas text-primary border border-blue-300 dark:border-blue-500/30 font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition uppercase cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>EXPORT EXCEL</span>
              </button>)}

              {perms.export && (<button
                type="button"
                onClick={handlePrint}
                className="h-8 px-3.5 bg-surface hover:bg-canvas text-primary border border-blue-300 dark:border-blue-500/30 font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition uppercase cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PRINT/PDF</span>
              </button>)}
            </>
          )}

          {activeTab === "TREE" && (
            (perms.export ? (<button
              type="button"
              onClick={handlePrint}
              className="h-8 px-3.5 bg-surface hover:bg-canvas text-primary border border-blue-300 dark:border-blue-500/30 font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition uppercase cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PRINT/PDF</span>
            </button>) : null)
          )}

          {activeTab === "PERMISSION" && (
            (perms.create ? (<button
              type="button"
              onClick={() => {
                setModalError("");
                setStagedPermissions([]);
                setIsPermModalOpen(true);
              }}
              className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded shadow-xs transition cursor-pointer"
            >
              Create
            </button>) : null)
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`shrink-0 mx-4 px-3 py-2 rounded border text-xs flex items-center justify-between print:hidden ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300"
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
      <div className="px-4 border-b border-line flex items-center gap-6 text-xs font-semibold uppercase tracking-wider print:hidden shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("TABLE")}
          className={`py-2.5 transition border-b-2 -mb-[1px] cursor-pointer ${
            activeTab === "TABLE"
              ? "text-primary border-[#2563eb] font-bold"
              : "text-ink-faint border-transparent hover:text-ink"
          }`}
        >
          TABLE VIEW
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TREE")}
          className={`py-2.5 transition border-b-2 -mb-[1px] cursor-pointer ${
            activeTab === "TREE"
              ? "text-primary border-[#2563eb] font-bold"
              : "text-ink-faint border-transparent hover:text-ink"
          }`}
        >
          TREE VIEW
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PERMISSION")}
          className={`py-2.5 transition border-b-2 -mb-[1px] cursor-pointer ${
            activeTab === "PERMISSION"
              ? "text-primary border-[#2563eb] font-bold"
              : "text-ink-faint border-transparent hover:text-ink"
          }`}
        >
          COA PERMISSION
        </button>
      </div>

      {/* 3. TAB 1: TABLE VIEW */}
      {activeTab === "TABLE" && (
        <div className="px-4 space-y-3 flex-1 min-h-0 flex flex-col print:block">
          <div className="w-64 print:hidden shrink-0">
            <label className="block text-[11px] text-ink-faint font-medium mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "Active" | "Inactive" | "All")}
              className="w-full h-9 px-2.5 border border-line-strong rounded text-xs text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="All">All</option>
            </select>
          </div>

          <div className="border border-line rounded flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-grid-head border-b border-line text-[11px] font-bold text-ink">
                <tr>
                  <th className="px-3 py-2 w-12 border-r border-line text-center">SL</th>
                  <th className="px-3 py-2 w-28 border-r border-line">Code</th>
                  <th className="px-4 py-2 border-r border-line">Description</th>
                  <th className="px-3 py-2 w-36 border-r border-line text-right">Amount</th>
                  <th className="px-3 py-2 w-32 border-r border-line">Account Type</th>
                  <th className="px-3 py-2 w-40 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {hierarchicalAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-ink-faint">
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
                        className="hover:bg-blue-50/30 dark:hover:bg-blue-500/10 transition-colors"
                      >
                        <td className="px-3 py-2 text-center text-ink-faint border-r border-line text-[11px] tabular-nums">
                          {index + 1}
                        </td>

                        <td className="px-3 py-2 text-ink border-r border-line text-xs tabular-nums">
                          {acc.code}
                        </td>

                        <td className={`py-2 pr-4 border-r border-line ${paddingLeft}`}>
                          <span
                            className={
                              isGroup
                                ? "font-semibold text-ink"
                                : isClass || isCategory
                                ? "font-medium text-ink"
                                : "text-ink-muted"
                            }
                          >
                            {acc.name}
                          </span>
                        </td>

                        <td className="px-3 py-2 text-right text-ink border-r border-line text-xs tabular-nums">
                          {isGL ? (
                            <button
                              type="button"
                              onClick={() => setLedgerAccount(acc)}
                              title="View General Ledger transactions"
                              className="underline decoration-ink-faint hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer tabular-nums"
                            >
                              {fmtAmount(acc.rollupBalance)}
                            </button>
                          ) : (
                            <span>{fmtAmount(acc.rollupBalance)}</span>
                          )}
                        </td>

                        <td className="px-3 py-2 text-ink-muted border-r border-line text-xs">
                          {acc.tier}
                        </td>

                        <td className="px-3 py-2 text-center print:hidden">
                          <div className="row-actions flex items-center justify-center gap-2">
                            {(isGroup || isClass || isCategory) && (
                              <button disabled={!perms.create}
                                type="button"
                                onClick={() => handleAddChild(acc)}
                                title={!perms.create ? needsPermission("create") : (`Add Child under ${acc.name}`)}
                                className="w-5 h-5 rounded-full bg-[#2563eb] hover:bg-blue-700 text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {isGL && (
                              <>
                                <button disabled={!perms.edit}
                                  type="button"
                                  onClick={() => handleEdit(acc)}
                                  title={!perms.edit ? needsPermission("edit") : "Edit Account Head"}
                                  className="p-1 text-ink-faint hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <button disabled={!perms.delete}
                                  type="button"
                                  onClick={() => setToDelete({ kind: "account", account: acc })}
                                  title={!perms.delete ? needsPermission("delete") : "Delete Account"}
                                  aria-label={`Delete account ${acc.code}`}
                                  className="inline-flex size-6 items-center justify-center rounded text-ink-faint hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {(isCategory || isGL) && (
                              <button disabled={!perms.edit}
                                type="button"
                                onClick={() => toggleAccountStatus(acc.id)}
                                title={!perms.edit ? needsPermission("edit") : (acc.status === "ACTIVE" ? "Deactivate" : "Activate")}
                                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 cursor-pointer ${
                                  acc.status === "ACTIVE" ? "bg-[#2563eb]" : "bg-line-strong"
                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                              >
                                <span
                                  className={`w-3 h-3 rounded-full bg-surface transition-transform ${
                                    acc.status === "ACTIVE" ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            )}

                            {isGL && (
                              <button disabled={!perms.create}
                                type="button"
                                onClick={() => {
                                  setModalAccountCode(acc.code);
                                  setModalError("");
                                  setStagedPermissions([]);
                                  setIsPermModalOpen(true);
                                }}
                                title={!perms.create ? needsPermission("create") : "Assign Employee COA Permission"}
                                className="p-1 text-ink-muted hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="px-4 space-y-2 shrink-0">
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:text-ink bg-control rounded transition cursor-pointer"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:text-ink bg-control rounded transition cursor-pointer"
            >
              Collapse All
            </button>
          </div>

          <div className="py-2 min-h-[460px] bg-surface">
            {rootNodes.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-faint">
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
        <div className="px-4 space-y-3 flex-1 min-h-0 flex flex-col print:block">
          {/* Filter Bar matching Screenshot 4 */}
          <div className="flex flex-wrap items-end gap-3 text-xs shrink-0">
            {/* Employee Autocomplete Filter */}
            <div className="w-72 relative">
              <label className="block text-[11px] text-ink-faint font-medium mb-1">
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
                  className="w-full h-9 pl-3 pr-8 border border-line-strong rounded text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <ChevronDown className="w-3.5 h-3.5 text-ink-faint absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              {showFilterEmpDropdown && matchingFilterEmployees.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-surface border border-line rounded shadow-md">
                  {matchingFilterEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onMouseDown={() => {
                        setPermEmpSearch(emp.name);
                        setShowFilterEmpDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium text-ink">{emp.name}</span>
                      <span className="text-[10px] text-ink-faint font-mono">
                        {emp.employeeCode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Voucher Type Filter */}
            <div className="w-60">
              <label className="block text-[11px] text-ink-faint font-medium mb-1">
                Voucher Type
              </label>
              <select
                value={permVoucherFilter}
                onChange={(e) => setPermVoucherFilter(e.target.value)}
                className="w-full h-9 px-2.5 border border-line-strong rounded text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <label className="block text-[11px] text-ink-faint font-medium mb-1">
                Account Head
              </label>
              <select
                value={permAccountFilter}
                onChange={(e) => setPermAccountFilter(e.target.value)}
                className="w-full h-9 px-2.5 border border-line-strong rounded text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <div className="border border-line rounded flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-grid-head border-b border-line text-[11px] font-bold text-ink">
                <tr>
                  <th className="px-3 py-2 w-16 border-r border-line text-center">SL</th>
                  <th className="px-4 py-2 border-r border-line">Employee Name</th>
                  <th className="px-4 py-2 border-r border-line">Voucher Type</th>
                  <th className="px-4 py-2 border-r border-line">Account Head</th>
                  <th className="px-3 py-2 w-32 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {displayedPermissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-ink-faint">
                      No COA permissions found. Click &quot;Create&quot; to assign access rights.
                    </td>
                  </tr>
                ) : (
                  displayedPermissions.map((perm, index) => (
                    <tr key={perm.id} className="hover:bg-canvas/70 transition">
                      <td className="px-3 py-2 text-center text-ink-faint border-r border-line tabular-nums">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2 font-medium text-ink border-r border-line">
                        {perm.employeeName}
                        <span className="text-[10px] text-ink-faint block font-mono">
                          {perm.employeeId}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-ink-muted border-r border-line">
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                          {perm.voucherType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-ink border-r border-line">
                        <span className="font-mono text-blue-700 dark:text-blue-300 font-semibold mr-1.5">
                          {perm.accountHeadCode}
                        </span>
                        {perm.accountHeadName}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="row-actions flex items-center justify-center gap-2">
                          <button disabled={!perms.edit}
                            type="button"
                            onClick={() => toggleCoaPermission(perm.id)}
                            title={!perms.edit ? needsPermission("edit") : (perm.status === "ACTIVE" ? "Revoke Permission" : "Restore Permission")}
                            className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 cursor-pointer ${
                              perm.status === "ACTIVE" ? "bg-[#2563eb]" : "bg-line-strong"
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            <span
                              className={`w-3 h-3 rounded-full bg-surface transition-transform ${
                                perm.status === "ACTIVE" ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>

                          <button disabled={!perms.delete}
                            type="button"
                            onClick={() => setToDelete({ kind: "permission", permission: perm })}
                            title={!perms.delete ? needsPermission("delete") : "Delete Permission"}
                            aria-label={`Delete permission of ${perm.employeeName}`}
                            className="inline-flex size-6 items-center justify-center rounded text-ink-faint hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div className="flex border-b border-line gap-4 mb-2">
              <button
                type="button"
                onClick={() => setCreateUploadTab("CREATE")}
                className={`pb-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-[1px] cursor-pointer ${
                  createUploadTab === "CREATE"
                    ? "text-primary border-[#2563eb]"
                    : "text-ink-faint border-transparent hover:text-ink"
                }`}
              >
                Create Single Account
              </button>
              <button
                type="button"
                onClick={() => setCreateUploadTab("UPLOAD")}
                className={`pb-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-[1px] cursor-pointer ${
                  createUploadTab === "UPLOAD"
                    ? "text-primary border-[#2563eb]"
                    : "text-ink-faint border-transparent hover:text-ink"
                }`}
              >
                Bulk Excel / CSV Upload
              </button>
            </div>
          )}

          {modalError && (
            <div className="flex items-center gap-2 rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-2 text-xs font-medium text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" /> {modalError}
            </div>
          )}

          {createUploadTab === "CREATE" ? (
            <form onSubmit={handleSaveAccount} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                    Account Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10101016"
                    value={accountForm.code}
                    onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                    className="w-full h-8 px-2.5 border border-line-strong rounded text-xs font-mono font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
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
                    className="w-full h-8 px-2.5 border border-line-strong rounded text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Group">Group</option>
                    <option value="Class">Class</option>
                    <option value="Category">Category</option>
                    <option value="GL">GL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cash in Hand - Dhaka Desk"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full h-8 px-2.5 border border-line-strong rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                    Parent Account
                  </label>
                  <select
                    value={accountForm.parentCode}
                    onChange={(e) => setAccountForm({ ...accountForm, parentCode: e.target.value })}
                    className="w-full h-8 px-2.5 border border-line-strong rounded text-xs focus:ring-1 focus:ring-blue-500"
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
                  <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                    Classification Pillar *
                  </label>
                  <select
                    value={accountForm.accountType}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, accountType: e.target.value as AccountType })
                    }
                    className="w-full h-8 px-2.5 border border-line-strong rounded text-xs focus:ring-1 focus:ring-blue-500"
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
                  <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={accountForm.openingBalance}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, openingBalance: Number(e.target.value) || 0 })
                    }
                    className="w-full h-8 px-2.5 border border-line-strong rounded text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                    Normal Balance
                  </label>
                  <select
                    value={accountForm.normalBalance}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, normalBalance: e.target.value as NormalBalance })
                    }
                    className="w-full h-8 px-2.5 border border-line-strong rounded text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsCreateUploadOpen(false)}
                  className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink cursor-pointer"
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
                className="border-2 border-dashed border-line-strong rounded-lg p-6 text-center hover:border-blue-500 transition cursor-pointer bg-canvas/50"
              >
                <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-ink">
                  {uploadFileName || "Click to choose Excel (.xlsx) or CSV file"}
                </p>
                <p className="text-[11px] text-ink-faint mt-1">
                  Columns: Code, Description, Parent Code, Account Type (Group/Class/Category/GL), Opening Balance
                </p>
              </div>

              {parsedUploadRows.length > 0 && (
                <div className="border border-line rounded max-h-40 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-canvas border-b border-line font-semibold">
                      <tr>
                        <th className="px-2 py-1">Code</th>
                        <th className="px-2 py-1">Description</th>
                        <th className="px-2 py-1">Parent</th>
                        <th className="px-2 py-1">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
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
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download Sample COA Excel Template</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateUploadOpen(false)}
                    className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink cursor-pointer"
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
            <div className="flex items-center gap-2 rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-2 text-xs font-medium text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" /> {modalError}
            </div>
          )}

          {/* Single Horizontal Row: Employee* | Voucher Type* | Account Head* | Add */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4 relative">
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
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
                  className="w-full h-9 pl-2.5 pr-7 border border-line-strong rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <ChevronDown className="w-3.5 h-3.5 text-ink-faint absolute right-2 top-2.5 pointer-events-none" />
              </div>

              {showModalEmpDropdown && matchingModalEmployees.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-surface border border-line rounded shadow-lg">
                  {matchingModalEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onMouseDown={() => {
                        setModalSelectedEmp(emp);
                        setModalEmpSearch(emp.name);
                        setShowModalEmpDropdown(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium text-ink">{emp.name}</span>
                      <span className="text-[10px] text-ink-faint font-mono">
                        {emp.employeeCode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                Voucher Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={modalVoucherType}
                onChange={(e) => setModalVoucherType(e.target.value)}
                className="w-full h-9 px-2.5 border border-line-strong rounded text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <label className="block text-[11px] font-medium text-ink-muted mb-1">
                Account Head <span className="text-rose-500">*</span>
              </label>
              <select
                value={modalAccountCode}
                onChange={(e) => setModalAccountCode(e.target.value)}
                className="w-full h-9 px-2.5 border border-line-strong rounded text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          <hr className="border-line" />

          {/* Staged Rows Preview */}
          {stagedPermissions.length > 0 && (
            <div className="border border-line rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-grid-head text-[11px] font-bold text-ink">
                  <tr>
                    <th className="px-3 py-1.5 w-12 text-center border-r border-line">SL</th>
                    <th className="px-3 py-1.5 border-r border-line">Employee Name</th>
                    <th className="px-3 py-1.5 border-r border-line">Voucher Type</th>
                    <th className="px-3 py-1.5 border-r border-line">Account Head</th>
                    <th className="px-3 py-1.5 w-16 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {stagedPermissions.map((row, idx) => (
                    <tr key={row.tempId}>
                      <td className="px-3 py-1.5 text-center border-r border-line">{idx + 1}</td>
                      <td className="px-3 py-1.5 border-r border-line">{row.employeeName}</td>
                      <td className="px-3 py-1.5 border-r border-line">{row.voucherType}</td>
                      <td className="px-3 py-1.5 border-r border-line">
                        {row.accountHeadCode} - {row.accountHeadName}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setStagedPermissions((prev) => prev.filter((x) => x.tempId !== row.tempId))
                          }
                          className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer"
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
              className="px-3.5 py-1.5 text-xs text-ink-muted hover:text-ink border border-line rounded cursor-pointer"
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
            <div className="flex flex-wrap justify-between gap-2 bg-canvas border border-line rounded p-2.5">
              <div>
                <span className="text-ink-faint">Opening Balance:</span>{" "}
                <span className="font-semibold tabular-nums">
                  {fmtAmount(ledgerAccount.openingBalance)}
                </span>
              </div>
              <div>
                <span className="text-ink-faint">Current Balance:</span>{" "}
                <span className="font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  {fmtAmount(ledgerAccount.currentBalance)}
                </span>
              </div>
            </div>

            <div className="border border-line rounded overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-grid-head text-[11px] font-bold text-ink sticky top-0">
                  <tr>
                    <th className="px-2.5 py-1.5 border-r border-line">Date</th>
                    <th className="px-2.5 py-1.5 border-r border-line">Voucher No</th>
                    <th className="px-2.5 py-1.5 border-r border-line">Narration</th>
                    <th className="px-2.5 py-1.5 text-right border-r border-line">Debit</th>
                    <th className="px-2.5 py-1.5 text-right border-r border-line">Credit</th>
                    <th className="px-2.5 py-1.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-faint">
                        No posted journal entries yet for this GL account.
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map((r, i) => (
                      <tr key={`${r.voucherNumber}-${i}`} className="hover:bg-canvas">
                        <td className="px-2.5 py-1.5 border-r border-line whitespace-nowrap">
                          {r.date}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono border-r border-line">
                          {r.voucherNumber}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-line">{r.narration}</td>
                        <td className="px-2.5 py-1.5 text-right border-r border-line tabular-nums">
                          {r.debit ? fmtAmount(r.debit) : "-"}
                        </td>
                        <td className="px-2.5 py-1.5 text-right border-r border-line tabular-nums">
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

      <ConfirmDialog
        open={toDelete !== null}
        title={toDelete?.kind === "account" ? "Delete account?" : "Delete permission?"}
        message={
          toDelete?.kind === "account"
            ? `${toDelete.account.code} - ${toDelete.account.name} will be removed from the chart of accounts. This cannot be undone.`
            : toDelete
              ? `${toDelete.permission.employeeName} will no longer be able to post ${toDelete.permission.voucherType} vouchers to ${toDelete.permission.accountHeadCode} - ${toDelete.permission.accountHeadName}.`
              : ""
        }
        busy={deleting}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          setDeleting(true);
          try {
            if (toDelete.kind === "account") await handleDeleteAccount(toDelete.account);
            else await deleteCoaPermission(toDelete.permission.id);
          } finally {
            setDeleting(false);
            setToDelete(null);
          }
        }}
      />
    </div>
  );
}
