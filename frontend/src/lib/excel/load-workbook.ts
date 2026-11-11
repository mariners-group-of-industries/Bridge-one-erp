import ExcelJS from "exceljs";
import JSZip from "jszip";
import { AppError } from "@/lib/api/errors";

const INVALID = "The file is not a valid Excel (.xlsx) workbook.";

/**
 * Reads an uploaded .xlsx. Some tools (the .NET Open XML SDK and programs built
 * on it) write valid workbooks that ExcelJS cannot read: every tag carries a
 * namespace prefix (`<x:workbook>`) and part paths are absolute (`/xl/...`).
 * Excel opens those files fine, so when the first read fails the workbook is
 * rewritten into the plain form and read again.
 */
export async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  } catch {
    // Fall through to the normalised read.
  }
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await normaliseXlsx(buffer));
    return workbook;
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", INVALID);
  }
}

/** Removes namespace prefixes from tags and makes relationship targets relative. */
export async function normaliseXlsx(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (entry.dir || !/\.(xml|rels)$/i.test(name)) continue;
    const xml = await entry.async("string");
    zip.file(name, normaliseXml(name, xml));
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

export function normaliseXml(name: string, xml: string): string {
  let out = xml.replace(/^﻿/, "");

  // The root element's prefix (<x:workbook>, <ap:Properties>) becomes the default namespace.
  // Only for the parts ExcelJS reads unprefixed; docProps/core.xml keeps its standard cp:/dc: prefixes.
  const unprefixed = name.startsWith("xl/") || name === "docProps/app.xml";
  const prefix = unprefixed ? /^\s*(?:<\?[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<([A-Za-z_][\w.-]*):[A-Za-z_][\w.-]*[\s/>]/.exec(out)?.[1] : undefined;
  if (prefix && out.includes(`xmlns:${prefix}="`)) {
    out = out
      .replace(new RegExp(`<(/?)${prefix}:`, "g"), "<$1")
      .replace(`xmlns:${prefix}="`, 'xmlns="');
  }

  // Absolute targets (/xl/worksheets/sheet1.xml) → relative to the folder that owns the .rels file.
  if (name.endsWith(".rels")) {
    const owner = name.replace(/_rels\/[^/]+\.rels$/, ""); // "" for _rels/.rels, "xl/" for xl/_rels/workbook.xml.rels
    out = out.replace(/Target="\/([^"]+)"/g, (_match, target: string) =>
      `Target="${owner && target.startsWith(owner) ? target.slice(owner.length) : target}"`,
    );
  }
  return out;
}
