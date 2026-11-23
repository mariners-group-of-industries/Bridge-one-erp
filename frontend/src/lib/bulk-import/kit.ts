import ExcelJS from "exceljs";
import { cellText } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { loadWorkbook } from "@/lib/excel/load-workbook";
import { AppError } from "@/lib/api/errors";

/**
 * Shared helpers for the transactional Excel bulk-upload templates (Purchase,
 * Accounts, Inventory). One row per line item; rows that belong to the same
 * document carry the same `Ref` value. Master-data importers (items, suppliers …)
 * keep their own copies — this kit is for documents with header + lines.
 */

export const MAX_IMPORT_LINES = 2000;

export interface DocColumn<K extends string = string> {
  key: K;
  header: string;
  width: number;
}

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } } as const;
const HEADER_FONT = { bold: true, color: { argb: "FF1E3A8A" } } as const;
const HEADER_SEARCH_ROWS = 10;

/** Header text compared loosely: ignores case, "*", parenthetic hints and extra spaces. */
export const headerKey = (header: string) =>
  header
    .replace(/[​﻿]/g, "")
    .replace(/ /g, " ")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Writes the styled header row and freezes it. */
export function styledSheet(workbook: ExcelJS.Workbook, name: string, columns: readonly DocColumn[]): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((column) => ({ ...column }));
  const header = sheet.getRow(1);
  header.font = HEADER_FONT;
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle" };
  return sheet;
}

/** Adds an Instructions sheet (one line per row). */
export function writeInstructions(workbook: ExcelJS.Workbook, lines: string[]): void {
  const help = workbook.addWorksheet("Instructions");
  help.columns = [{ width: 120 }];
  lines.forEach((line) => help.addRow([line]));
}

export async function toXlsxBytes(workbook: ExcelJS.Workbook): Promise<Uint8Array> {
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** Builds the downloadable template: styled sheet + instructions. */
export async function buildTemplate(sheetName: string, columns: readonly DocColumn[], instructions: string[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  styledSheet(workbook, sheetName, columns);
  writeInstructions(workbook, instructions);
  return toXlsxBytes(workbook);
}

export interface ParsedRow<K extends string = string> {
  /** Spreadsheet row number (header is row 1), for error reports. */
  row: number;
  /** Value of the `Ref` column — rows sharing a Ref form one document. */
  ref: string;
  get: (key: K) => string;
}

/**
 * Finds the header row (the first of the first {@link HEADER_SEARCH_ROWS} rows that
 * matches `matchKey`), maps columns by header text (aliases allowed), and returns
 * the non-empty data rows grouped by their Ref value.
 */
interface OpenedSheet<K extends string> {
  sheetName: string;
  rows: ParsedRow<K>[];
}

async function openLineSheet<K extends string>(
  bytes: Uint8Array,
  sheetName: string,
  columns: readonly DocColumn<K>[],
  aliases: Partial<Record<K, string[]>>,
  matchKey: K,
  requiredKeys: readonly K[],
): Promise<OpenedSheet<K>> {
  const workbook = await loadWorkbook(bytes);
  const sheet =
    workbook.getWorksheet(sheetName) ??
    workbook.worksheets.find((ws) => ws.name.toLowerCase() !== "instructions") ??
    workbook.worksheets[0];
  if (!sheet) throw new AppError(400, "VALIDATION_ERROR", "The workbook has no sheets.");

  const columnFor = (headerText: string): DocColumn<K> | undefined => {
    const raw = headerKey(headerText);
    return columns.find((c) => {
      const canonical = headerKey(c.header);
      const extra = aliases[c.key] ?? [];
      return canonical === raw || extra.includes(raw);
    });
  };

  const readHeaders = (rowNumber: number) => {
    const found = new Map<K, number>();
    sheet.getRow(rowNumber).eachCell((cell, column) => {
      const match = columnFor(cellText(cell.value));
      if (match && !found.has(match.key)) found.set(match.key, column);
    });
    return found;
  };

  let headerRow = 1;
  for (let r = 1; r <= Math.min(HEADER_SEARCH_ROWS, Math.max(sheet.rowCount, 1)); r++) {
    if (readHeaders(r).has(matchKey)) {
      headerRow = r;
      break;
    }
  }
  const headerIndex = readHeaders(headerRow);

  for (const required of requiredKeys) {
    if (!headerIndex.has(required)) {
      const seen: string[] = [];
      sheet.getRow(headerRow).eachCell((cell) => {
        const text = cellText(cell.value);
        if (text) seen.push(text);
      });
      const found = seen.length > 0 ? ` Found: ${seen.join(", ")}.` : ` Sheet "${sheet.name}" has no header row.`;
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `Column "${columns.find((c) => c.key === required)!.header}" is missing. Use the template.${found}`,
      );
    }
  }

  const keySet = new Set(columns.map((c) => c.key));
  const rows: ParsedRow<K>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const get = (k: K) => {
      const column = headerIndex.get(k);
      return column ? cellText(row.getCell(column).value) : "";
    };
    const empty = [...keySet].every((k) => (headerIndex.has(k) ? get(k) === "" : true));
    if (empty) return;
    rows.push({ row: rowNumber, ref: get("ref" as K), get });
  });
  if (rows.length === 0) throw new AppError(400, "VALIDATION_ERROR", "The sheet has no rows.");
  if (rows.length > MAX_IMPORT_LINES) {
    throw new AppError(400, "VALIDATION_ERROR", `Upload at most ${MAX_IMPORT_LINES} rows per file.`);
  }
  return { sheetName: sheet.name, rows };
}

export async function parseLineSheet<K extends string>(
  bytes: Uint8Array,
  sheetName: string,
  columns: readonly DocColumn<K>[],
  aliases: Partial<Record<K, string[]>>,
  matchKey: K,
  requiredKeys: readonly K[],
): Promise<{ groups: { ref: string; firstRow: number; rows: ParsedRow<K>[] }[]; rowCount: number }> {
  const { rows } = await openLineSheet(bytes, sheetName, columns, aliases, matchKey, requiredKeys);

  const groups = new Map<string, { ref: string; firstRow: number; rows: ParsedRow<K>[] }>();
  for (const row of rows) {
    const ref = row.ref.trim();
    if (!ref) throw new AppError(400, "VALIDATION_ERROR", `Row ${row.row}: enter a Ref (rows with the same Ref form one document).`);
    const group = groups.get(ref.toLowerCase());
    if (group) group.rows.push(row);
    else groups.set(ref.toLowerCase(), { ref, firstRow: row.row, rows: [row] });
  }
  return { groups: [...groups.values()], rowCount: rows.length };
}

/** "1,234.56" / "1.234,56" / "1 234" → number. Throws with `label` when not a number. */
export function toNumber(raw: string, label: string, { required = false }: { required?: boolean } = {}): number {
  const value = raw.trim().replace(/\s+/g, "");
  if (!value) {
    if (required) throw new Error(`${label} is required.`);
    return 0;
  }
  let parsed: number;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) parsed = Number(value.replace(/,/g, "")); // 1,234.56
  else if (/^-?\d+(,\d+)?$/.test(value)) parsed = Number(value.replace(",", ".")); // 1234,56
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(value)) parsed = Number(value.replace(/\./g, "")); // 1.234.567
  else parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label}: "${raw}" is not a number.`);
  return parsed;
}

/** Normalises dd.mm.yyyy / dd-mm-yyyy / dd/mm/yyyy and yyyy-mm-dd to yyyy-mm-dd. */
export function toIsoDate(raw: string, label: string, { required = true }: { required?: boolean } = {}): string {
  const value = raw.trim();
  if (!value) {
    if (required) throw new Error(`${label} is required.`);
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dmy = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  throw new Error(`${label}: use YYYY-MM-DD (e.g. ${new Date().toISOString().slice(0, 10)}).`);
}

/** Same parsing, but each row is a whole document (no Ref grouping). */
export async function parseFlatSheet<K extends string>(
  bytes: Uint8Array,
  sheetName: string,
  columns: readonly DocColumn<K>[],
  aliases: Partial<Record<K, string[]>>,
  matchKey: K,
  requiredKeys: readonly K[],
): Promise<{ rows: ParsedRow<K>[]; rowCount: number }> {
  const { rows } = await openLineSheet(bytes, sheetName, columns, aliases, matchKey, requiredKeys);
  return { rows, rowCount: rows.length };
}

/** Case-insensitive exact match in a name→record list. */
export function byName<T>(list: readonly T[], nameOf: (item: T) => string, raw: string, label: string, { required = true }: { required?: boolean } = {}): T | undefined {
  const value = raw.trim();
  if (!value) {
    if (required) throw new Error(`${label} is required.`);
    return undefined;
  }
  const found = list.find((item) => nameOf(item).trim().toLowerCase() === value.toLowerCase());
  if (!found) throw new Error(`${label}: "${value}" not found.`);
  return found;
}

/** Case-insensitive exact match on a code field. */
export function byCode<T>(list: readonly T[], codeOf: (item: T) => string | null | undefined, raw: string, label: string): T {
  const value = raw.trim();
  if (!value) throw new Error(`${label} is required.`);
  const found = list.find((item) => (codeOf(item) ?? "").trim().toLowerCase() === value.toLowerCase());
  if (!found) throw new Error(`${label}: "${value}" not found.`);
  return found;
}
