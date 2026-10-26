import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Standard PDF fonts only cover Latin-1: anything else prints as "?". */
export const latin = (text: string) => text.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

export interface PdfColumn {
  header: string;
  width: number;
  align?: "left" | "right";
}

/** Minimal A4 table writer on pdf-lib (title, headings, label pairs, paged tables). */
export class PdfWriter {
  private page!: PDFPage;
  private y = 0;
  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly size: [number, number],
  ) {
    this.newPage();
  }

  private newPage() {
    this.page = this.doc.addPage(this.size);
    this.y = this.size[1] - 36;
  }

  private ensure(height: number) {
    if (this.y - height < 36) this.newPage();
  }

  private fit(text: string, width: number, font: PDFFont, size: number) {
    const value = latin(text);
    if (font.widthOfTextAtSize(value, size) <= width - 6) return value;
    let cut = value.length;
    while (cut > 1 && font.widthOfTextAtSize(`${value.slice(0, cut)}...`, size) > width - 6) cut--;
    return `${value.slice(0, cut)}...`;
  }

  title(text: string) {
    this.ensure(24);
    this.page.drawText(latin(text), { x: 36, y: this.y - 14, size: 14, font: this.bold });
    this.y -= 24;
  }

  heading(text: string, right?: string) {
    this.ensure(22);
    this.page.drawText(latin(text), { x: 36, y: this.y - 14, size: 11, font: this.bold });
    if (right) {
      const width = this.bold.widthOfTextAtSize(latin(right), 10);
      this.page.drawText(latin(right), { x: this.size[0] - 36 - width, y: this.y - 14, size: 10, font: this.bold });
    }
    this.y -= 20;
  }

  /** A plain line of small text (report subtitles, notes). */
  text(line: string) {
    this.ensure(13);
    this.page.drawText(this.fit(line, this.size[0] - 72, this.font, 8), { x: 36, y: this.y - 10, size: 8, font: this.font, color: rgb(0.3, 0.3, 0.3) });
    this.y -= 13;
  }

  /** Two-column "label : value" block. */
  pairs(pairs: [string, string][]) {
    const half = (this.size[0] - 72) / 2;
    for (let index = 0; index < pairs.length; index += 2) {
      this.ensure(14);
      [pairs[index], pairs[index + 1]].forEach((pair, column) => {
        if (!pair) return;
        const x = 36 + column * half;
        this.page.drawText(latin(pair[0]), { x, y: this.y - 10, size: 9, font: this.bold });
        this.page.drawText(this.fit(`:  ${pair[1]}`, half - 110, this.font, 9), { x: x + 110, y: this.y - 10, size: 9, font: this.font });
      });
      this.y -= 14;
    }
    this.y -= 6;
  }

  table(columns: PdfColumn[], rows: string[][], footer: string[][] = []) {
    const total = columns.reduce((sum, column) => sum + column.width, 0);
    const scale = (this.size[0] - 72) / total;
    const widths = columns.map((column) => column.width * scale);
    const drawRow = (cells: string[], font: PDFFont, fill?: [number, number, number]) => {
      this.ensure(16);
      let x = 36;
      if (fill) this.page.drawRectangle({ x, y: this.y - 15, width: this.size[0] - 72, height: 15, color: rgb(...fill) });
      cells.forEach((cell, index) => {
        const text = this.fit(cell, widths[index], font, 8);
        const width = font.widthOfTextAtSize(text, 8);
        const left = columns[index].align === "right" ? x + widths[index] - width - 3 : x + 3;
        this.page.drawText(text, { x: left, y: this.y - 11, size: 8, font });
        this.page.drawRectangle({ x, y: this.y - 15, width: widths[index], height: 15, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.5 });
        x += widths[index];
      });
      this.y -= 15;
    };
    const header = () => drawRow(columns.map((column) => column.header), this.bold, [0.86, 0.92, 1]);
    header();
    for (const row of rows) {
      if (this.y - 15 < 36) {
        this.newPage();
        header();
      }
      drawRow(row, this.font);
    }
    for (const row of footer) drawRow(row, this.bold, [0.95, 0.95, 0.95]);
    this.y -= 10;
  }
}

/** A new A4 document (portrait or landscape) with its writer. */
export async function pdfWriter(landscape: boolean) {
  const doc = await PDFDocument.create();
  const [font, bold] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  const a4: [number, number] = landscape ? [841.89, 595.28] : [595.28, 841.89];
  return { doc, pdf: new PdfWriter(doc, font, bold, a4) };
}

/** "Left text · Page n of N" at the bottom of every page (call once all content is drawn). */
export async function addPageFooters(doc: PDFDocument, left: string) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const right = `Page ${index + 1} of ${pages.length}`;
    page.drawText(latin(left), { x: 36, y: 18, size: 7, font, color: rgb(0.45, 0.45, 0.45) });
    page.drawText(right, { x: width - 36 - font.widthOfTextAtSize(right, 7), y: 18, size: 7, font, color: rgb(0.45, 0.45, 0.45) });
  });
}
