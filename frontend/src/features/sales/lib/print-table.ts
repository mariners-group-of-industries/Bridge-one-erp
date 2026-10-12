/** Opens a printable page (Print / Save as PDF) with one table, the same rows as the Excel export. */
export function printTable(title: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (value: unknown) =>
    String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
  const numeric = headers.map((_, column) => rows.length > 0 && rows.every((row) => row[column] === "" || row[column] == null || typeof row[column] === "number" || /^-?[\d,]+(\.\d+)?$/.test(String(row[column]))));
  const cell = (value: unknown, column: number, tag: "td" | "th") => `<${tag}${numeric[column] ? ' class="num"' : ""}>${escape(value)}</${tag}>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>
  body { font: 11px/1.4 system-ui, sans-serif; color: #111; margin: 16px; }
  h1 { font-size: 15px; margin: 0 0 8px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #bbb; padding: 3px 5px; text-align: left; }
  th { background: #eef2f7; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  @page { size: A4 landscape; margin: 10mm; }
</style></head><body>
<h1>${escape(title)}</h1>
<table><thead><tr>${headers.map((header, column) => cell(header, column, "th")).join("")}</tr></thead>
<tbody>${rows.map((row) => `<tr>${row.map((value, column) => cell(value, column, "td")).join("")}</tr>`).join("")}</tbody></table>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
  const page = window.open("", "_blank");
  if (!page) return false;
  page.document.write(html);
  page.document.close();
  return true;
}
