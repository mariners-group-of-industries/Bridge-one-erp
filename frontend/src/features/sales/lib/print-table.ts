/** Opens a printable page (Print / Save as PDF) with one table, the same rows as the Excel export. */
export function printTable(title: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (value: unknown) =>
    String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
  const numeric = headers.map((_, column) => rows.length > 0 && rows.every((row) => row[column] === "" || row[column] == null || typeof row[column] === "number" || /^-?[\d,]+(\.\d+)?$/.test(String(row[column]))));
  const cell = (value: unknown, column: number, tag: "td" | "th") => `<${tag}${numeric[column] ? ' class="num"' : ""}>${escape(value)}</${tag}>`;
  // A4 landscape (wide list tables). Margin 0 so the browser prints no URL/date header; per-page
  // margins come from the .frame spacer rows that repeat on every page, and the footer is fixed
  // to the bottom of every page (same scheme as components/ui/print-frame.tsx).
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  body { font: 11px/1.4 system-ui, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 15px; margin: 0 0 8px; }
  .frame { width: 100%; border-collapse: collapse; }
  .frame > * > tr > td { border: 0; padding: 0 12mm; }
  .frame-top { height: 10mm; }
  .frame-bottom { height: 16mm; }
  table.data { border-collapse: collapse; width: 100%; }
  .data th, .data td { border: 1px solid #bbb; padding: 3px 5px; text-align: left; }
  .data th { background: #eef2f7; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .page-footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 2mm 12mm 6mm; background: #fff;
    font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
  .page-footer::before { content: ""; position: absolute; top: 0; left: 12mm; right: 12mm; border-top: 1px solid #cbd5e1; }
</style></head><body>
<table class="frame">
<thead><tr><td><div class="frame-top"></div></td></tr></thead>
<tfoot><tr><td><div class="frame-bottom"></div></td></tr></tfoot>
<tbody><tr><td>
<h1>${escape(title)}</h1>
<table class="data"><thead><tr>${headers.map((header, column) => cell(header, column, "th")).join("")}</tr></thead>
<tbody>${rows.map((row) => `<tr>${row.map((value, column) => cell(value, column, "td")).join("")}</tr>`).join("")}</tbody></table>
</td></tr></tbody>
</table>
<div class="page-footer">
  <span style="font-weight:600;">Made by BridgeOne</span>
  <span>Printed ${new Date().toLocaleDateString('en-GB')}</span>
</div>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
  const page = window.open("", "_blank");
  if (!page) return false;
  page.document.write(html);
  page.document.close();
  return true;
}
