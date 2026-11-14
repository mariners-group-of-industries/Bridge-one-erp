import type ExcelJS from "exceljs";

export type ParsedCoaTier = "Group" | "Class" | "Category" | "GL";
export type ParsedAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type ParsedNormalBalance = "DEBIT" | "CREDIT";

export interface ParsedCoaImportRow {
  code: string;
  name: string;
  parentCode: string | null;
  tierLevel: ParsedCoaTier;
  accountSubtype: string;
  accountType: ParsedAccountType;
  normalBalance: ParsedNormalBalance;
  isGroup: boolean;
  openingBalance: number;
  status: "ACTIVE" | "INACTIVE";
  description?: string;
}

function readCellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("");
    }
    if ("text" in value) return String(value.text ?? "");
  }
  return String(value);
}

function deriveGroupMeta(groupCode: string): {
  accountType: ParsedAccountType;
  normalBalance: ParsedNormalBalance;
  defaultSubtype: string;
} {
  if (groupCode.startsWith("1")) {
    return { accountType: "ASSET", normalBalance: "DEBIT", defaultSubtype: "CURRENT_ASSET" };
  }
  if (groupCode.startsWith("2")) {
    return { accountType: "ASSET", normalBalance: "DEBIT", defaultSubtype: "FIXED_ASSET" };
  }
  if (groupCode.startsWith("3")) {
    return { accountType: "LIABILITY", normalBalance: "CREDIT", defaultSubtype: "CURRENT_LIABILITY" };
  }
  if (groupCode.startsWith("4")) {
    return { accountType: "LIABILITY", normalBalance: "CREDIT", defaultSubtype: "NON_CURRENT_LIABILITY" };
  }
  if (groupCode.startsWith("5")) {
    return { accountType: "EQUITY", normalBalance: "CREDIT", defaultSubtype: "EQUITY" };
  }
  if (groupCode.startsWith("6")) {
    return { accountType: "REVENUE", normalBalance: "CREDIT", defaultSubtype: "OPERATING_INCOME" };
  }
  if (groupCode.startsWith("7")) {
    return { accountType: "EXPENSE", normalBalance: "DEBIT", defaultSubtype: "COGS" };
  }
  return { accountType: "EXPENSE", normalBalance: "DEBIT", defaultSubtype: "OPERATING_EXPENSE" };
}

function deriveSubtype(
  groupCode: string,
  classCode: string | null,
  categoryCode: string | null,
  name: string,
  defaultSubtype: string
): string {
  const lower = name.toLowerCase();
  const cat = categoryCode || "";
  const cls = classCode || "";

  if (groupCode === "1") {
    if (cat === "10101" || (cls === "101" && lower.includes("cash in hand"))) return "CASH_IN_HAND";
    if (cat === "10102" || cls === "101") return "CASH_AT_BANK";
    if (cls === "102" || lower.includes("receivable")) return "ACCOUNTS_RECEIVABLE";
    if (cls === "103" || lower.includes("inventory") || lower.includes("stock")) return "INVENTORY";
    if (cls === "105" || cls === "106" || cls === "107" || lower.includes("advance")) return "ADVANCE_PREPAYMENT";
    return "CURRENT_ASSET";
  }
  if (groupCode === "2") return "FIXED_ASSET";
  if (groupCode === "3") {
    if ((cls === "301" || lower.includes("payable")) && !lower.includes("tax")) return "ACCOUNTS_PAYABLE";
    if (lower.includes("vat") || lower.includes("tax")) return "TAX_PAYABLE";
    if (cls === "302" || cls === "303" || lower.includes("provision")) return "ACCRUED_LIABILITY";
    return "CURRENT_LIABILITY";
  }
  if (groupCode === "4") return lower.includes("loan") ? "LONG_TERM_LOAN" : "NON_CURRENT_LIABILITY";
  if (groupCode === "5") return lower.includes("retained") ? "RETAINED_EARNINGS" : "EQUITY";
  if (groupCode === "6") return lower.includes("other") ? "OTHER_INCOME" : "SALES_REVENUE";
  if (groupCode === "7") return "COGS";
  if (groupCode === "8") return "OPERATING_EXPENSE";
  return defaultSubtype;
}

function indentToDepth(indent: number): number {
  if (indent === 0) return 0;
  if (indent <= 18) return 1;
  if (indent <= 32) return 2;
  return 3;
}

const DEPTH_TIERS: ParsedCoaTier[] = ["Group", "Class", "Category", "GL"];

/**
 * Parses a Chart of Accounts Excel worksheet supporting both:
 * 1) ERP indented hierarchy format (`SL | Code | Description`)
 * 2) Flat/explicit template format (`Code | Description | Parent Code | Account Type | Opening Balance`)
 */
export function parseCoaWorksheet(sheet: ExcelJS.Worksheet): ParsedCoaImportRow[] {
  const headerRow = sheet.getRow(1);
  const h1 = readCellText(headerRow.getCell(1).value).trim().toLowerCase();
  const h2 = readCellText(headerRow.getCell(2).value).trim().toLowerCase();
  const h3 = readCellText(headerRow.getCell(3).value).trim().toLowerCase();

  const isIndentedFormat =
    (h1 === "sl" && h2 === "code" && h3.includes("description")) ||
    (h1 === "code" && h2.includes("description") && !h3.includes("parent"));

  if (!isIndentedFormat) {
    const flatRows: ParsedCoaImportRow[] = [];
    const seen = new Set<string>();
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const code = readCellText(row.getCell(1).value).trim();
      const name = readCellText(row.getCell(2).value).trim();
      if (!code || !name || seen.has(code)) return;
      seen.add(code);
      const parentCode = readCellText(row.getCell(3).value).trim() || null;
      const rawTier = readCellText(row.getCell(4).value).trim();
      const tierLevel: ParsedCoaTier =
        rawTier === "Group" || rawTier === "Class" || rawTier === "Category" || rawTier === "GL"
          ? rawTier
          : "GL";
      const openingBalance = Number(readCellText(row.getCell(5).value) || 0) || 0;
      const rootChar = code.charAt(0);
      const meta = deriveGroupMeta(rootChar);
      flatRows.push({
        code,
        name,
        parentCode,
        tierLevel,
        accountSubtype: tierLevel === "GL" ? meta.defaultSubtype : tierLevel,
        accountType: meta.accountType,
        normalBalance: meta.normalBalance,
        isGroup: tierLevel !== "GL",
        openingBalance,
        status: "ACTIVE",
      });
    });
    return flatRows;
  }

  const codeCol = h1 === "sl" ? 2 : 1;
  const descCol = h1 === "sl" ? 3 : 2;

  interface StagedNode {
    idx: number;
    rawCode: string;
    name: string;
    depth: number;
    tierLevel: ParsedCoaTier;
    rawParentCode: string | null;
    rawGroupCode: string;
    rawClassCode: string | null;
    rawCategoryCode: string | null;
  }

  const staged: StagedNode[] = [];
  const rawStack: Array<string | null> = [null, null, null, null];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rawCode = readCellText(row.getCell(codeCol).value).trim();
    const rawDesc = readCellText(row.getCell(descCol).value);
    const cleanName = rawDesc.replace(/^[\s\u00a0]+/, "").trim();
    if (!rawCode && !cleanName) return;

    const indent = rawDesc.length - rawDesc.replace(/^[\s\u00a0]+/, "").length;
    const depth = indentToDepth(indent);
    const tierLevel = DEPTH_TIERS[depth];
    const rawParentCode = depth > 0 ? rawStack[depth - 1] ?? rawStack[0] : null;

    rawStack[depth] = rawCode || `${rawParentCode || "R"}-${staged.length + 1}`;
    for (let d = depth + 1; d < rawStack.length; d++) rawStack[d] = null;

    staged.push({
      idx: staged.length,
      rawCode,
      name: cleanName || rawCode,
      depth,
      tierLevel,
      rawParentCode,
      rawGroupCode: rawStack[0] || rawCode.charAt(0) || "1",
      rawClassCode: depth >= 1 ? rawStack[1] : null,
      rawCategoryCode: depth >= 2 ? rawStack[2] : null,
    });
  });

  // Pass 1: Choose native owner index for each rawCode so structural tiers & matching prefixes keep exact codes.
  const nativeOwnerByCode = new Map<string, number>();
  const groupedByRawCode = new Map<string, StagedNode[]>();
  for (const node of staged) {
    if (!node.rawCode) continue;
    const arr = groupedByRawCode.get(node.rawCode) || [];
    arr.push(node);
    groupedByRawCode.set(node.rawCode, arr);
  }

  for (const [rawCode, candidates] of groupedByRawCode.entries()) {
    if (candidates.length === 1) {
      nativeOwnerByCode.set(rawCode, candidates[0].idx);
      continue;
    }
    const sorted = [...candidates].sort((a, b) => {
      // Top-level groups/classes/categories take priority over leaf GL rows
      if (a.depth !== b.depth) return a.depth - b.depth;
      // GL row whose prefix matches its parent structural code wins over cross-pasted GL codes
      const aNative = a.rawParentCode && rawCode.startsWith(a.rawParentCode) ? 0 : 1;
      const bNative = b.rawParentCode && rawCode.startsWith(b.rawParentCode) ? 0 : 1;
      if (aNative !== bNative) return aNative - bNative;
      return a.idx - b.idx;
    });
    nativeOwnerByCode.set(rawCode, sorted[0].idx);
  }

  // Pass 2: Assign guaranteed unique DB codes and build resolved parent pointers.
  const usedCodes = new Set<string>();
  const resolvedStack: Array<string | null> = [null, null, null, null];
  const siblingCounter = new Map<string, number>();
  const result: ParsedCoaImportRow[] = [];

  for (let i = 0; i < staged.length; i++) {
    const node = staged[i];
    const parentDbCode =
      node.depth > 0 ? resolvedStack[node.depth - 1] ?? resolvedStack[0] : null;
    const nextCount = (siblingCounter.get(parentDbCode || "__ROOT__") ?? 0) + 1;
    siblingCounter.set(parentDbCode || "__ROOT__", nextCount);

    let dbCode = node.rawCode;
    const isNativeOwner = dbCode && nativeOwnerByCode.get(dbCode) === node.idx;

    if (!dbCode) {
      // Infer clean structural/child code when blank (e.g., Class 804 -> Category 80401 before GL 80401001)
      const nextNode = staged[i + 1];
      if (node.depth === 1 && nextNode?.rawCode && nextNode.rawCode.length >= 3) {
        dbCode = nextNode.rawCode.slice(0, 3);
      } else if (node.depth === 2 && nextNode?.rawCode && nextNode.rawCode.length >= 5) {
        dbCode = nextNode.rawCode.slice(0, 5);
      } else if (parentDbCode) {
        let seq = nextCount;
        const pad = node.depth === 3 ? 3 : 2;
        dbCode = `${parentDbCode}${String(seq).padStart(pad, "0")}`;
        while (usedCodes.has(dbCode) || groupedByRawCode.has(dbCode)) {
          seq++;
          dbCode = `${parentDbCode}${String(seq).padStart(pad, "0")}`;
        }
      } else {
        dbCode = `COA-${node.idx + 1}`;
      }
    } else if (!isNativeOwner || usedCodes.has(dbCode)) {
      if (node.depth === 1 || node.depth === 2) {
        // Advance numeric Category/Class code sequentially if free (e.g. second 10503 -> 10504, 20102 -> 20103)
        const num = Number(dbCode);
        if (
          Number.isFinite(num) &&
          /^\d+$/.test(dbCode) &&
          !usedCodes.has(String(num + 1)) &&
          !groupedByRawCode.has(String(num + 1))
        ) {
          dbCode = String(num + 1);
        } else {
          dbCode = parentDbCode ? `${parentDbCode}-${dbCode}` : `${dbCode}-2`;
        }
      } else {
        dbCode = parentDbCode ? `${parentDbCode}-${dbCode}` : `${dbCode}-2`;
      }
    }

    if (usedCodes.has(dbCode)) {
      let suffix = 2;
      while (usedCodes.has(`${dbCode}-${suffix}`)) suffix++;
      dbCode = `${dbCode}-${suffix}`;
    }

    usedCodes.add(dbCode);
    resolvedStack[node.depth] = dbCode;
    for (let d = node.depth + 1; d < resolvedStack.length; d++) resolvedStack[d] = null;

    const groupDbCode = resolvedStack[0] || dbCode.charAt(0) || "1";
    const classDbCode = resolvedStack[1];
    const categoryDbCode = resolvedStack[2];
    const meta = deriveGroupMeta(groupDbCode);
    const subtype = deriveSubtype(
      groupDbCode,
      classDbCode,
      categoryDbCode,
      node.name,
      meta.defaultSubtype
    );

    result.push({
      code: dbCode.slice(0, 50),
      name: node.name.slice(0, 150),
      parentCode: parentDbCode,
      tierLevel: node.tierLevel,
      accountSubtype: subtype,
      accountType: meta.accountType,
      normalBalance: meta.normalBalance,
      isGroup: node.tierLevel !== "GL",
      openingBalance: 0,
      status: "ACTIVE",
      description:
        node.rawCode && node.rawCode !== dbCode
          ? `Original COA Code: ${node.rawCode}`
          : undefined,
    });
  }

  return result;
}
