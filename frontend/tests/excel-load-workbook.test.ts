import { existsSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { loadWorkbook, normaliseXml } from "@/lib/excel/load-workbook";

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/** A workbook rewritten the way the .NET Open XML SDK saves it: `x:` prefixed tags and absolute targets. */
async function prefixedWorkbook(): Promise<Uint8Array> {
  const source = new ExcelJS.Workbook();
  const sheet = source.addWorksheet("Customers");
  sheet.addRow(["Customer Name *", "Mobile *"]);
  sheet.addRow(["Rahim Store", "01700000000"]);
  const zip = await JSZip.loadAsync(await source.xlsx.writeBuffer());
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir) continue;
    let xml = await zip.files[name].async("string");
    if (name.startsWith("xl/") && name.endsWith(".xml") && xml.includes(`xmlns="${MAIN}"`)) {
      xml = xml
        .replace(`xmlns="${MAIN}"`, `xmlns:x="${MAIN}"`)
        .replace(/<(\/?)([A-Za-z][\w.-]*)(?=[\s/>])/g, "<$1x:$2");
    }
    if (name === "_rels/.rels") xml = xml.replace(/Target="xl\//g, 'Target="/xl/');
    if (name === "xl/_rels/workbook.xml.rels") xml = xml.replace(/Target="(?!\/)/g, 'Target="/xl/');
    zip.file(name, xml);
  }
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

describe("loadWorkbook", () => {
  it("reads a plain ExcelJS workbook", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Items").addRow(["Code"]);
    const loaded = await loadWorkbook(new Uint8Array(await wb.xlsx.writeBuffer()));
    expect(loaded.worksheets.map((w) => w.name)).toEqual(["Items"]);
  });

  it("reads a workbook with x: prefixed tags and absolute part paths", async () => {
    const bytes = await prefixedWorkbook();
    await expect(new ExcelJS.Workbook().xlsx.load(bytes.buffer as ArrayBuffer)).rejects.toThrow();
    const loaded = await loadWorkbook(bytes);
    const sheet = loaded.getWorksheet("Customers")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Rahim Store");
    expect(sheet.getRow(2).getCell(2).value).toBe("01700000000");
  });

  it("rejects a file that is not a workbook", async () => {
    await expect(loadWorkbook(new TextEncoder().encode("name,mobile\nA,1"))).rejects.toThrow("not a valid Excel");
  });

  it("only removes the root element's prefix", () => {
    expect(normaliseXml("xl/workbook.xml", '<?xml version="1.0"?><x:workbook xmlns:x="m"><x:sheets/></x:workbook>')).toBe('<?xml version="1.0"?><workbook xmlns="m"><sheets/></workbook>');
    const plain = '<worksheet xmlns="m" xmlns:mc="c"><mc:AlternateContent/></worksheet>';
    expect(normaliseXml("xl/worksheets/sheet1.xml", plain)).toBe(plain);
  });

  it("makes relationship targets relative to their owner", () => {
    expect(normaliseXml("_rels/.rels", '<Relationship Target="/xl/workbook.xml"/>')).toBe('<Relationship Target="xl/workbook.xml"/>');
    expect(normaliseXml("xl/_rels/workbook.xml.rels", '<Relationship Target="/xl/worksheets/sheet1.xml"/>')).toBe('<Relationship Target="worksheets/sheet1.xml"/>');
  });

  // Optional check against a real file: set XLSX_SAMPLE to its path.
  const sample = process.env.XLSX_SAMPLE;
  it.skipIf(!sample || !existsSync(sample))("reads the sample file", async () => {
    const loaded = await loadWorkbook(new Uint8Array(readFileSync(sample!)));
    console.log("sample sheets:", loaded.worksheets.map((w) => `${w.name} (${w.rowCount} rows)`).join(", "));
    expect(loaded.worksheets.length).toBeGreaterThan(0);
  });
});
