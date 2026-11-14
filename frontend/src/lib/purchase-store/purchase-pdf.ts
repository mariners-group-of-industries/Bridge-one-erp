import { readFileSync, existsSync } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { ReportQuery } from "@bridgeone/contracts";
import { notFound } from "@/lib/api/errors";
import { db } from "@/lib/prisma/client";
import { purchaseStore } from "./store";
import { listSupplierPayables } from "./payables";

export interface SignatureSlot {
  roleLabel: string;
  name?: string | null;
  designation?: string | null;
  mobile?: string | null;
}

export interface PdfTableColumn {
  header: string;
  weight: number;
  align?: "left" | "center" | "right";
}

export interface CorporateHeaderInfo {
  companyName: string;
  officeName: string;
  businessUnitName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

export interface CorporatePdfSpec {
  filename: string;
  title: string;
  header: CorporateHeaderInfo;
  metaLeft: [string, string][];
  metaRight: [string, string][];
  columns: PdfTableColumn[];
  rows: string[][];
  totalRows?: string[][];
  signatures?: [SignatureSlot, SignatureSlot, SignatureSlot];
  landscape?: boolean;
}

const latin = (text: string) => String(text ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
const fmtDate = (isoOrDate?: string | Date | null) => {
  if (!isoOrDate) return "";
  const raw = typeof isoOrDate === "string" ? isoOrDate : isoOrDate.toISOString();
  const ymd = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  }
  return raw;
};
const fmtNum = (val: unknown, digits = 2) => {
  const n = Number(val ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "0.00";
};

let cachedLogoBytes: Buffer | null | undefined;
function getLogoBytes(): Buffer | null {
  if (cachedLogoBytes !== undefined) return cachedLogoBytes;
  try {
    const p1 = path.join(process.cwd(), "public", "logo.png");
    if (existsSync(/*turbopackIgnore: true*/ p1)) {
      cachedLogoBytes = readFileSync(/*turbopackIgnore: true*/ p1);
      return cachedLogoBytes;
    }
    const p2 = path.join(process.cwd(), "frontend", "public", "logo.png");
    if (existsSync(/*turbopackIgnore: true*/ p2)) {
      cachedLogoBytes = readFileSync(/*turbopackIgnore: true*/ p2);
      return cachedLogoBytes;
    }
  } catch {
    // Ignore unreadable asset and fall back to text-only header.
  }
  cachedLogoBytes = null;
  return null;
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const clean = latin(text).replace(/\r?\n+/g, " ").trim();
  if (!clean) return [""];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else if (!current) {
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      current = chunk;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawAlignedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size: number,
  align: "left" | "center" | "right" = "left",
  color = rgb(0.06, 0.09, 0.14),
) {
  const safe = latin(text);
  const w = font.widthOfTextAtSize(safe, size);
  const drawX =
    align === "right" ? x + width - w : align === "center" ? x + (width - w) / 2 : x;
  page.drawText(safe, { x: Math.max(x, drawX), y, size, font, color });
}

export async function renderCorporatePurchasePdf(spec: CorporatePdfSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logoImage: PDFImage | null = null;
  const logoBytes = getLogoBytes();
  if (logoBytes) {
    try {
      logoImage = await doc.embedPng(logoBytes);
    } catch {
      logoImage = null;
    }
  }

  const pageWidth = spec.landscape ? 841.89 : 595.28;
  const pageHeight = spec.landscape ? 595.28 : 841.89;
  const marginX = 34;
  const marginTop = 34;
  const marginBottom = 38;
  const contentWidth = pageWidth - marginX * 2;
  const black = rgb(0, 0, 0);
  const headerShade = rgb(0.84, 0.85, 0.87);
  const ink = rgb(0.05, 0.07, 0.11);
  const muted = rgb(0.22, 0.27, 0.34);

  const pages: PDFPage[] = [];
  const createPage = () => {
    const p = doc.addPage([pageWidth, pageHeight]);
    pages.push(p);
    return p;
  };

  let page = createPage();
  let y = pageHeight - marginTop;

  // 1. CORPORATE LETTERHEAD (left logo + centered info)
  const logoSlotWidth = 104;
  if (logoImage) {
    const scale = Math.min(logoSlotWidth / logoImage.width, 30 / logoImage.height);
    const lw = logoImage.width * scale;
    const lh = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: marginX,
      y: y - lh + 2,
      width: lw,
      height: lh,
    });
  }

  const centerTextWidth = contentWidth - logoSlotWidth * 2;
  const centerBlock = (text: string, size: number, f: PDFFont, color = ink, gapAfter = 3) => {
    const lines = wrapLines(text, f, size, Math.max(240, centerTextWidth + 60));
    for (const line of lines) {
      drawAlignedText(page, line, marginX, y - size, contentWidth, f, size, "center", color);
      y -= size + 2.5;
    }
    y -= gapAfter;
  };

  centerBlock(spec.header.companyName || "Company Name", 13.5, bold, black, 1);
  if (spec.header.officeName) {
    centerBlock(spec.header.officeName, 8.5, font, ink, 0);
  }
  if (
    spec.header.businessUnitName &&
    spec.header.businessUnitName.toLowerCase() !== spec.header.officeName.toLowerCase()
  ) {
    centerBlock(spec.header.businessUnitName, 8, font, muted, 0);
  }
  if (spec.header.address) {
    centerBlock(spec.header.address, 7.5, font, muted, 0);
  }
  const contactParts: string[] = [];
  if (spec.header.phone) contactParts.push(`Phone: ${spec.header.phone}`);
  if (spec.header.email) contactParts.push(`Email: ${spec.header.email}`);
  if (contactParts.length) {
    centerBlock(contactParts.join(" , "), 7.5, font, muted, 0);
  }
  if (spec.header.website) {
    centerBlock(`Website : ${spec.header.website}`, 7.5, font, muted, 0);
  }

  y -= 5;

  // 2. BOXED CENTERED DOCUMENT TITLE
  const titleText = latin(spec.title);
  const titleSize = 10.5;
  const titleTextW = bold.widthOfTextAtSize(titleText, titleSize);
  const boxPadX = 14;
  const boxH = 21;
  const boxW = Math.min(contentWidth, titleTextW + boxPadX * 2);
  const boxX = marginX + (contentWidth - boxW) / 2;
  page.drawRectangle({
    x: boxX,
    y: y - boxH,
    width: boxW,
    height: boxH,
    borderColor: black,
    borderWidth: 0.9,
  });
  page.drawText(titleText, {
    x: boxX + (boxW - titleTextW) / 2,
    y: y - boxH + 6.5,
    size: titleSize,
    font: bold,
    color: black,
  });
  y -= boxH + 8;

  // 3. BORDERED 2-COLUMN METADATA BOX
  const metaSize = 7.8;
  const metaLineH = 10.5;
  const metaPadX = 8;
  const metaPadY = 6;
  const colHalfW = contentWidth / 2 - metaPadX * 1.5;

  const measureMetaSide = (pairs: [string, string][]) => {
    const wrapped: string[][] = [];
    let totalLines = 0;
    for (const [k, v] of pairs) {
      const full = `${latin(k)} : ${latin(v || "")}`;
      const lines = wrapLines(full, font, metaSize, colHalfW);
      wrapped.push(lines);
      totalLines += lines.length;
    }
    return { wrapped, totalLines };
  };

  const leftMeta = measureMetaSide(spec.metaLeft);
  const rightMeta = measureMetaSide(spec.metaRight);
  const metaRowsCount = Math.max(leftMeta.totalLines, rightMeta.totalLines, 1);
  const metaBoxH = metaRowsCount * metaLineH + metaPadY * 2;

  page.drawRectangle({
    x: marginX,
    y: y - metaBoxH,
    width: contentWidth,
    height: metaBoxH,
    borderColor: black,
    borderWidth: 0.7,
  });

  const drawMetaSide = (wrapped: string[][], startX: number, startY: number) => {
    let cy = startY;
    for (const lines of wrapped) {
      for (const line of lines) {
        page.drawText(line, { x: startX, y: cy, size: metaSize, font, color: ink });
        cy -= metaLineH;
      }
    }
  };

  const metaTextStartY = y - metaPadY - metaSize + 1;
  drawMetaSide(leftMeta.wrapped, marginX + metaPadX, metaTextStartY);
  drawMetaSide(rightMeta.wrapped, marginX + contentWidth / 2 + 4, metaTextStartY);

  y -= metaBoxH + 8;

  // 4. CRISP BORDERED TABLE
  const totalWeight = spec.columns.reduce((s, c) => s + c.weight, 0) || 1;
  const colWidths = spec.columns.map((c) => (c.weight / totalWeight) * contentWidth);
  const colXs: number[] = [];
  let accX = marginX;
  for (const w of colWidths) {
    colXs.push(accX);
    accX += w;
  }

  const headSize = 7.4;
  const cellSize = 7.3;
  const cellLineH = 9.8;
  const cellPadX = 4;
  const cellPadY = 4;

  const measureRow = (cells: string[], f: PDFFont, size: number) => {
    const wrapped = cells.map((c, idx) => wrapLines(c, f, size, Math.max(16, colWidths[idx] - cellPadX * 2)));
    const maxLines = Math.max(1, ...wrapped.map((w) => w.length));
    return { wrapped, height: maxLines * cellLineH + cellPadY * 2 };
  };

  const drawRow = (
    cells: string[],
    f: PDFFont,
    size: number,
    opts?: { fill?: ReturnType<typeof rgb>; aligns?: ("left" | "center" | "right")[] },
  ) => {
    const { wrapped, height } = measureRow(cells, f, size);
    const sigReserve = 0;
    if (y - height < marginBottom + sigReserve) {
      page = createPage();
      y = pageHeight - marginTop;
      drawTableHeader();
    }
    const rowTop = y;
    const rowBottom = rowTop - height;

    for (let i = 0; i < spec.columns.length; i++) {
      page.drawRectangle({
        x: colXs[i],
        y: rowBottom,
        width: colWidths[i],
        height,
        color: opts?.fill,
        borderColor: black,
        borderWidth: 0.6,
      });
      const lines = wrapped[i] ?? [""];
      const align = opts?.aligns?.[i] ?? spec.columns[i].align ?? "left";
      // Vertically center single-line cells nicely or start from top padding
      const blockH = lines.length * cellLineH;
      let textY = rowTop - (height - blockH) / 2 - size + 1;
      for (const line of lines) {
        drawAlignedText(
          page,
          line,
          colXs[i] + cellPadX,
          textY,
          Math.max(8, colWidths[i] - cellPadX * 2),
          f,
          size,
          align,
          black,
        );
        textY -= cellLineH;
      }
    }
    y = rowBottom;
  };

  const drawTableHeader = () => {
    const headers = spec.columns.map((c) => c.header);
    const { wrapped, height } = measureRow(headers, bold, headSize);
    if (y - height < marginBottom + 20) {
      page = createPage();
      y = pageHeight - marginTop;
    }
    const rowTop = y;
    const rowBottom = rowTop - height;
    for (let i = 0; i < spec.columns.length; i++) {
      page.drawRectangle({
        x: colXs[i],
        y: rowBottom,
        width: colWidths[i],
        height,
        color: headerShade,
        borderColor: black,
        borderWidth: 0.7,
      });
      const lines = wrapped[i] ?? [""];
      const blockH = lines.length * cellLineH;
      let textY = rowTop - (height - blockH) / 2 - headSize + 1;
      const align = spec.columns[i].align ?? "left";
      for (const line of lines) {
        drawAlignedText(
          page,
          line,
          colXs[i] + cellPadX,
          textY,
          Math.max(8, colWidths[i] - cellPadX * 2),
          bold,
          headSize,
          align,
          black,
        );
        textY -= cellLineH;
      }
    }
    y = rowBottom;
  };

  drawTableHeader();
  if (spec.rows.length === 0) {
    drawRow(
      spec.columns.map((_, idx) => (idx === 1 ? "No line items" : "")),
      font,
      cellSize,
    );
  } else {
    for (const r of spec.rows) {
      drawRow(r, font, cellSize);
    }
  }

  if (spec.totalRows?.length) {
    for (const tr of spec.totalRows) {
      drawRow(tr, bold, cellSize);
    }
  }

  // 5. 3-COLUMN SIGNATURE FOOTER BLOCK
  if (spec.signatures) {
    const sigBlockHeight = 68;
    if (y - sigBlockHeight < marginBottom + 10) {
      page = createPage();
      y = pageHeight - marginTop;
    }
    // Anchor at fixed readable zone or neatly below the table (max gap, matching reference PDF)
    const sigY = Math.min(y - 38, Math.max(marginBottom + sigBlockHeight + 8, Math.min(y - 44, 150)));
    const sigCols = 3;
    const slotW = contentWidth / sigCols;
    spec.signatures.forEach((slot, idx) => {
      const sx = marginX + idx * slotW + (idx === 0 ? 0 : idx === 1 ? 26 : 52);
      const lineW = 86;
      page.drawLine({
        start: { x: sx, y: sigY },
        end: { x: sx + lineW, y: sigY },
        thickness: 0.7,
        color: black,
      });
      let ly = sigY - 10;
      page.drawText(latin(slot.roleLabel), { x: sx, y: ly, size: 7.5, font: bold, color: black });
      ly -= 10;
      page.drawText(latin(`Name: ${slot.name?.trim() || ""}`), { x: sx, y: ly, size: 7, font, color: ink });
      ly -= 10;
      page.drawText(latin(`Designation: ${slot.designation?.trim() || ""}`), { x: sx, y: ly, size: 7, font, color: ink });
      ly -= 10;
      page.drawText(latin(`Mobile: ${slot.mobile?.trim() || ""}`), { x: sx, y: ly, size: 7, font, color: ink });
    });
  }

  // Subtle footer page count if multiple pages
  if (pages.length > 1) {
    pages.forEach((p, idx) => {
      const label = `Page ${idx + 1} of ${pages.length}`;
      const w = font.widthOfTextAtSize(label, 7);
      p.drawText(label, { x: pageWidth - marginX - w, y: 16, size: 7, font, color: muted });
    });
  }

  return doc.save();
}

/** Resolves Company / Business Unit / Office letterhead details from PostgreSQL. */
async function resolveCorporateHeader(officeId?: string | null, businessUnitId?: string | null): Promise<CorporateHeaderInfo> {
  const prisma = db();
  const [office, bu] = await Promise.all([
    officeId
      ? prisma.office.findUnique({
          where: { id: officeId },
          include: { businessUnit: { include: { company: true } } },
        })
      : null,
    businessUnitId
      ? prisma.businessUnit.findUnique({
          where: { id: businessUnitId },
          include: { company: true },
        })
      : prisma.businessUnit.findFirst({
          include: { company: true },
          orderBy: { createdAt: "asc" },
        }),
  ]);

  const resolvedBu = office?.businessUnit ?? bu;
  return {
    companyName: resolvedBu?.company?.name || resolvedBu?.name || "BridgeOne Technologies Ltd.",
    officeName: office?.name || resolvedBu?.name || "Head Office",
    businessUnitName: resolvedBu?.name || "",
    address: office?.address || resolvedBu?.address || resolvedBu?.company?.address || "",
    phone: office?.phone || resolvedBu?.contactNumber || "",
    email: office?.email || resolvedBu?.email || resolvedBu?.company?.email || "",
    website: "",
  };
}

/** Resolves Name / Designation / Mobile from Employee & User tables for signature blocks. */
async function resolvePersonContact(name?: string | null): Promise<{ name: string; designation: string; mobile: string }> {
  const clean = name?.trim() || "";
  if (!clean) return { name: "", designation: "", mobile: "" };
  const prisma = db();
  const [emp, usr] = await Promise.all([
    prisma.employee.findFirst({
      where: { name: { equals: clean, mode: "insensitive" } },
      select: { name: true, designation: true, mobile: true, officialContact: true },
    }),
    prisma.user.findFirst({
      where: { name: { equals: clean, mode: "insensitive" } },
      select: { name: true, phone: true, role: true },
    }),
  ]);
  return {
    name: emp?.name || usr?.name || clean,
    designation: emp?.designation || (usr?.role ? String(usr.role) : ""),
    mobile: emp?.mobile || emp?.officialContact || usr?.phone || "",
  };
}

export async function requisitionPdf(id: string): Promise<{ filename: string; bytes: Uint8Array }> {
  const req = await purchaseStore.getRequisitionById(id);
  if (!req) throw notFound("Purchase requisition");

  const header = await resolveCorporateHeader(req.officeId, req.companyId);
  const offices = await purchaseStore.getOffices();
  const warehouses = await purchaseStore.getWarehouses();
  const officeName = offices.find((o) => o.id === req.officeId)?.name || header.officeName;
  const warehouseName = warehouses.find((w) => w.id === req.warehouseId)?.name || "-";

  const approvedEntry = [...(req.approvalHistory || [])]
    .reverse()
    .find((h) => /approv/i.test(h.action));
  const [prep, appr] = await Promise.all([
    resolvePersonContact(req.requesterName || req.createdBy),
    resolvePersonContact(approvedEntry?.actorName),
  ]);

  const totalQty = req.items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const totalEst = req.items.reduce((s, i) => s + Number(i.lineTotal || 0), 0);

  const bytes = await renderCorporatePurchasePdf({
    filename: `${req.requisitionNumber}.pdf`,
    title: "Purchase Requisition",
    header,
    metaLeft: [
      ["Requisition No", req.requisitionNumber],
      ["Req. Office Name", officeName],
      ["Req. Warehouse Name", warehouseName],
      ["Department / Section", req.department || "-"],
      ["Remarks", req.remarks || req.businessJustification || ""],
    ],
    metaRight: [
      ["Req. Date", fmtDate(req.requestDate)],
      ["Expected Date", fmtDate(req.requiredDeliveryDate || req.requestDate)],
      ["Purchase Method", req.purchaseMethod || "DIRECT"],
      ["Ref. Document", req.referenceDocument || "Direct"],
      ["Review Comment", approvedEntry?.comments || req.status],
    ],
    columns: [
      { header: "SL", weight: 6, align: "center" },
      { header: "Item Code/Model", weight: 16, align: "left" },
      { header: "Item Name", weight: 32, align: "left" },
      { header: "UOM", weight: 9, align: "center" },
      { header: "Req. Qty", weight: 12, align: "right" },
      { header: "Est. Rate", weight: 12, align: "right" },
      { header: "Est. Amount", weight: 13, align: "right" },
    ],
    rows: req.items.map((it, idx) => [
      String(idx + 1),
      it.itemCode,
      it.itemName,
      it.uom || "PCS",
      fmtNum(it.quantity, 2),
      fmtNum(it.estimatedUnitPrice, 2),
      fmtNum(it.lineTotal, 2),
    ]),
    totalRows: [
      ["", "", "", "Total", fmtNum(totalQty, 2), "", fmtNum(totalEst, 2)],
    ],
    signatures: [
      { roleLabel: "Prepared By", ...prep },
      { roleLabel: "Approved By", ...appr },
      { roleLabel: "Received By" },
    ],
  });

  return { filename: `${req.requisitionNumber}.pdf`, bytes };
}

export async function purchaseOrderPdf(id: string): Promise<{ filename: string; bytes: Uint8Array }> {
  const po = await purchaseStore.getPurchaseOrderById(id);
  if (!po) throw notFound("Purchase order");

  const [header, supplier] = await Promise.all([
    resolveCorporateHeader(po.officeId, po.companyId),
    db().supplier.findUnique({ where: { id: po.supplierId }, select: { phone: true, contactPerson: true } }),
  ]);

  const approvedEntry = [...(po.approvalHistory || [])]
    .reverse()
    .find((h) => /approv/i.test(h.action));
  const [prep, appr] = await Promise.all([
    resolvePersonContact(po.createdBy),
    resolvePersonContact(approvedEntry?.actorName),
  ]);

  const totalQty = po.items.reduce((s, i) => s + Number(i.orderedQuantity || 0), 0);

  const bytes = await renderCorporatePurchasePdf({
    filename: `${po.poNumber}.pdf`,
    title: "Purchase Order",
    header,
    metaLeft: [
      ["PO No", po.poNumber],
      ["Supplier Name", po.supplierName],
      ["Office Name", po.officeName],
      ["Warehouse Name", po.warehouseName],
      ["Remarks / Terms", po.notes || po.paymentTerms || ""],
    ],
    metaRight: [
      ["PO Date", fmtDate(po.orderDate)],
      ["Expected Date", fmtDate(po.expectedDeliveryDate)],
      ["Requisition No", po.requisitionNumber || "Direct"],
      ["Reference No", po.referenceNumber || "-"],
      ["Status", po.status],
    ],
    columns: [
      { header: "SL", weight: 5, align: "center" },
      { header: "Item Code/Model", weight: 15, align: "left" },
      { header: "Item Name", weight: 30, align: "left" },
      { header: "UOM", weight: 8, align: "center" },
      { header: "Order Qty", weight: 11, align: "right" },
      { header: "Unit Rate", weight: 12, align: "right" },
      { header: "VAT %", weight: 7, align: "right" },
      { header: "Amount (BDT)", weight: 12, align: "right" },
    ],
    rows: po.items.map((it, idx) => [
      String(idx + 1),
      it.itemCode,
      it.itemName,
      it.uom || "PCS",
      fmtNum(it.orderedQuantity, 2),
      fmtNum(it.unitPrice, 2),
      fmtNum(it.taxPercentage ?? 0, 2),
      fmtNum(it.lineTotal, 2),
    ]),
    totalRows: [
      ["", "", "", "Total", fmtNum(totalQty, 2), "", "", fmtNum(po.totalAmount, 2)],
    ],
    signatures: [
      { roleLabel: "Prepared By", ...prep },
      { roleLabel: "Approved By", ...appr },
      {
        roleLabel: "Supplier / Receiver",
        name: supplier?.contactPerson || po.supplierName,
        designation: "Supplier",
        mobile: supplier?.phone || "",
      },
    ],
  });

  return { filename: `${po.poNumber}.pdf`, bytes };
}

export async function goodsReceiptPdf(id: string): Promise<{ filename: string; bytes: Uint8Array }> {
  const list = await purchaseStore.getGoodsReceipts({});
  const grn = list.find((g) => g.id === id || g.grnNumber === id);
  if (!grn) throw notFound("Goods receipt");

  const [header, supplier, prep] = await Promise.all([
    resolveCorporateHeader(grn.officeId, grn.companyId),
    db().supplier.findUnique({ where: { id: grn.supplierId }, select: { phone: true, contactPerson: true } }),
    resolvePersonContact(grn.preparedBy),
  ]);

  const totalOrdered = grn.items.reduce((s, i) => s + Number(i.orderedQuantity || 0), 0);
  const totalReceived = grn.items.reduce((s, i) => s + Number(i.currentReceivedQuantity || 0), 0);
  const totalRejected = grn.items.reduce((s, i) => s + Number(i.rejectedDamagedQuantity || 0), 0);

  const bytes = await renderCorporatePurchasePdf({
    filename: `${grn.grnNumber}.pdf`,
    title: "Goods Receipt Note (GRN)",
    header,
    metaLeft: [
      ["GRN No", grn.grnNumber],
      ["Supplier Name", grn.supplierName],
      ["Office Name", grn.officeName],
      ["Warehouse Name", grn.warehouseName],
      ["Remarks", grn.remarks || ""],
    ],
    metaRight: [
      ["Receive Date", fmtDate(grn.receiptDate)],
      ["PO No", grn.poNumber || "Direct"],
      ["Challan No", grn.challanNumber || "-"],
      ["Invoice / VAT Challan", [grn.supplierInvoiceNumber, grn.vatChallanNumber].filter(Boolean).join(" / ") || "-"],
      ["Status", grn.status],
    ],
    columns: [
      { header: "SL", weight: 5, align: "center" },
      { header: "Item Code/Model", weight: 15, align: "left" },
      { header: "Item Name", weight: 28, align: "left" },
      { header: "UOM", weight: 8, align: "center" },
      { header: "Order Qty", weight: 11, align: "right" },
      { header: "Recv. Qty", weight: 11, align: "right" },
      { header: "Rej. Qty", weight: 9, align: "right" },
      { header: "Amount", weight: 13, align: "right" },
    ],
    rows: grn.items.map((it, idx) => [
      String(idx + 1),
      it.itemCode,
      it.itemName,
      it.uom || "PCS",
      fmtNum(it.orderedQuantity, 2),
      fmtNum(it.currentReceivedQuantity, 2),
      fmtNum(it.rejectedDamagedQuantity, 2),
      fmtNum(it.lineTotal, 2),
    ]),
    totalRows: [
      [
        "",
        "",
        "",
        "Total",
        fmtNum(totalOrdered, 2),
        fmtNum(totalReceived, 2),
        fmtNum(totalRejected, 2),
        fmtNum(grn.totalReceivedAmount, 2),
      ],
    ],
    signatures: [
      { roleLabel: "Received By", ...prep },
      { roleLabel: "Quality Checked By" },
      {
        roleLabel: "Store In-Charge",
        name: supplier?.contactPerson || "",
        designation: "",
        mobile: supplier?.phone || "",
      },
    ],
  });

  return { filename: `${grn.grnNumber}.pdf`, bytes };
}

export async function purchaseReturnPdf(id: string): Promise<{ filename: string; bytes: Uint8Array }> {
  const list = await purchaseStore.getPurchaseReturns({});
  const ret = list.find((r) => r.id === id || r.returnNumber === id);
  if (!ret) throw notFound("Purchase return");

  const [header, supplier, prep, retRow] = await Promise.all([
    resolveCorporateHeader(ret.officeId, ret.companyId),
    db().supplier.findUnique({ where: { id: ret.supplierId }, select: { phone: true, contactPerson: true } }),
    resolvePersonContact(ret.createdBy),
    db().purchaseReturn.findUnique({ where: { id: ret.id }, select: { warehouse: { select: { name: true } } } }),
  ]);

  const totalQty = ret.items.reduce((s, i) => s + Number(i.returnQuantity || 0), 0);

  const bytes = await renderCorporatePurchasePdf({
    filename: `${ret.returnNumber}.pdf`,
    title: "Purchase Return / Debit Note",
    header,
    metaLeft: [
      ["Return No", ret.returnNumber],
      ["Supplier Name", ret.supplierName],
      ["Office Name", ret.officeName || header.officeName],
      ["Warehouse Name", retRow?.warehouse?.name || "-"],
      ["Remarks / Reason", ret.remarks || ""],
    ],
    metaRight: [
      ["Return Date", fmtDate(ret.returnDate)],
      ["GRN No", ret.grnNumber || "Without Ref."],
      ["PO No", ret.poNumber || "-"],
      ["Return Type", ret.returnType || "SUPPLIER_CREDIT"],
      ["Status", ret.status],
    ],
    columns: [
      { header: "SL", weight: 6, align: "center" },
      { header: "Item Code/Model", weight: 16, align: "left" },
      { header: "Item Name", weight: 32, align: "left" },
      { header: "UOM", weight: 9, align: "center" },
      { header: "Return Qty", weight: 12, align: "right" },
      { header: "Unit Rate", weight: 12, align: "right" },
      { header: "Debit Amount", weight: 13, align: "right" },
    ],
    rows: ret.items.map((it, idx) => [
      String(idx + 1),
      it.itemCode,
      it.itemName,
      it.uom || "PCS",
      fmtNum(it.returnQuantity, 2),
      fmtNum(it.unitPrice, 2),
      fmtNum(it.lineTotal, 2),
    ]),
    totalRows: [
      ["", "", "", "Total", fmtNum(totalQty, 2), "", fmtNum(ret.totalReturnAmount, 2)],
    ],
    signatures: [
      { roleLabel: "Prepared By", ...prep },
      { roleLabel: "Approved By" },
      {
        roleLabel: "Supplier Ack.",
        name: supplier?.contactPerson || ret.supplierName,
        designation: "Supplier",
        mobile: supplier?.phone || "",
      },
    ],
  });

  return { filename: `${ret.returnNumber}.pdf`, bytes };
}

export async function supplierPaymentPdf(id: string): Promise<{ filename: string; bytes: Uint8Array }> {
  const prisma = db();
  const payment = await prisma.supplierPayment.findFirst({
    where: /^[0-9a-f-]{36}$/i.test(id) ? { id } : { number: id },
    include: {
      supplier: true,
      receipt: true,
      bill: true,
      order: true,
      office: true,
      bankAccount: true,
      cashAccount: true,
    },
  });
  if (!payment) throw notFound("Supplier payment");

  const [header, prep] = await Promise.all([
    resolveCorporateHeader(payment.officeId, payment.businessUnitId),
    resolvePersonContact(payment.createdBy),
  ]);

  const settledDoc = payment.bill?.number ?? payment.receipt?.number ?? payment.order?.number ?? (payment.isAdvance ? "Advance Payment" : "On Account");
  const channel = payment.bankAccount
    ? `${payment.bankAccount.bankName} (${payment.bankAccount.accountNumber})`
    : payment.cashAccount
      ? `${payment.cashAccount.code} - ${payment.cashAccount.name}`
      : payment.method;

  const amount = Number(payment.amount ?? 0);
  const bankAmt = payment.method === "CASH" ? 0 : amount;
  const cashAmt = payment.method === "CASH" ? amount : 0;

  const bytes = await renderCorporatePurchasePdf({
    filename: `${payment.number}.pdf`,
    title: "Supplier Payment Voucher",
    header,
    metaLeft: [
      ["Voucher / Receipt No", payment.number],
      ["Supplier Name", `${payment.supplier.code} - ${payment.supplier.name}`],
      ["Office Name", payment.office?.name || header.officeName],
      ["Payment Method", payment.method],
      ["Remarks / Narration", payment.remarks || ""],
    ],
    metaRight: [
      ["Payment Date", fmtDate(payment.paymentDate)],
      ["Settled Document", settledDoc],
      ["Bank / Cash A/C", channel],
      ["Reference / Cheque No", payment.referenceNumber || "-"],
      ["Status", payment.status],
    ],
    columns: [
      { header: "SL", weight: 6, align: "center" },
      { header: "Document / Ref", weight: 22, align: "left" },
      { header: "Description", weight: 32, align: "left" },
      { header: "Bank Amount", weight: 13, align: "right" },
      { header: "Cash Amount", weight: 13, align: "right" },
      { header: "Total Paid", weight: 14, align: "right" },
    ],
    rows: [
      [
        "1",
        settledDoc,
        payment.isAdvance ? "Supplier Advance Disbursement" : `Supplier Payment (${payment.supplier.name})`,
        fmtNum(bankAmt, 2),
        fmtNum(cashAmt, 2),
        fmtNum(amount, 2),
      ],
    ],
    totalRows: [
      ["", "", "Total Disbursed", fmtNum(bankAmt, 2), fmtNum(cashAmt, 2), fmtNum(amount, 2)],
    ],
    signatures: [
      { roleLabel: "Prepared By", ...prep },
      { roleLabel: "Approved By" },
      {
        roleLabel: "Received By",
        name: payment.supplier.contactPerson || payment.supplier.name,
        designation: "Supplier / Payee",
        mobile: payment.supplier.phone || "",
      },
    ],
  });

  return { filename: `${payment.number}.pdf`, bytes };
}

export async function payablesDueListPdf(filters?: { fromDate?: string; toDate?: string; search?: string }): Promise<{ filename: string; bytes: Uint8Array }> {
  const [header, rows] = await Promise.all([
    resolveCorporateHeader(null, null),
    listSupplierPayables({ fromDate: filters?.fromDate, toDate: filters?.toDate }),
  ]);

  const filtered = filters?.search
    ? rows.filter((r) => {
        const s = filters.search!.toLowerCase();
        return r.supplierName.toLowerCase().includes(s) || r.supplierCode.toLowerCase().includes(s);
      })
    : rows;

  const totals = filtered.reduce(
    (acc, r) => ({
      total: acc.total + Number(r.totalPurchasedAmount || 0),
      returned: acc.returned + Number(r.returnedAmount || 0),
      paid: acc.paid + Number(r.paidAmount || 0),
      due: acc.due + Number(r.dueAmount || 0),
    }),
    { total: 0, returned: 0, paid: 0, due: 0 },
  );

  const bytes = await renderCorporatePurchasePdf({
    filename: `Supplier-Due-List.pdf`,
    title: "Supplier Payables Due List",
    header,
    metaLeft: [
      ["Report Type", "Supplier Due List (Local)"],
      ["Total Suppliers", String(filtered.length)],
    ],
    metaRight: [
      ["From Date", filters?.fromDate ? fmtDate(filters.fromDate) : "All"],
      ["To Date", filters?.toDate ? fmtDate(filters.toDate) : "All"],
    ],
    columns: [
      { header: "SL", weight: 6, align: "center" },
      { header: "Supplier Code", weight: 16, align: "left" },
      { header: "Supplier Name", weight: 30, align: "left" },
      { header: "Total Amount", weight: 12, align: "right" },
      { header: "Return Amount", weight: 12, align: "right" },
      { header: "Payment Amount", weight: 12, align: "right" },
      { header: "Due Amount", weight: 12, align: "right" },
    ],
    rows: filtered.map((r, idx) => [
      String(idx + 1),
      r.supplierCode,
      r.supplierName,
      fmtNum(r.totalPurchasedAmount, 2),
      fmtNum(r.returnedAmount, 2),
      fmtNum(r.paidAmount, 2),
      fmtNum(r.dueAmount, 2),
    ]),
    totalRows: [
      [
        "",
        "",
        "Total",
        fmtNum(totals.total, 2),
        fmtNum(totals.returned, 2),
        fmtNum(totals.paid, 2),
        fmtNum(totals.due, 2),
      ],
    ],
    signatures: [
      { roleLabel: "Prepared By" },
      { roleLabel: "Verified By" },
      { roleLabel: "Approved By" },
    ],
  });

  return { filename: "Supplier-Due-List.pdf", bytes };
}

export async function purchaseReportPdf(query: ReportQuery): Promise<{ filename: string; bytes: Uint8Array }> {
  const [header, report] = await Promise.all([
    resolveCorporateHeader(query.officeId && query.officeId !== "ALL" ? query.officeId : null, null),
    purchaseStore.generateReport(query),
  ]);

  const cols: string[] = Array.isArray(report.columns) ? report.columns : [];
  const rowsData: Record<string, unknown>[] = Array.isArray(report.rows) ? report.rows : [];

  const isNumericCol = (col: string) => rowsData.some((r) => typeof r[col] === "number");

  const hasSlCol = cols[0]?.toLowerCase() === "sl";
  const tableColumns: PdfTableColumn[] = [
    ...(hasSlCol ? [] : [{ header: "SL", weight: 5, align: "center" as const }]),
    ...cols.map((col) => ({
      header: col,
      weight: col.toLowerCase() === "sl" ? 5 : isNumericCol(col) ? 11 : 16,
      align: (col.toLowerCase() === "sl" ? "center" : isNumericCol(col) ? "right" : "left") as
        | "center"
        | "right"
        | "left",
    })),
  ];

  const rows = rowsData.map((r, idx) => [
    ...(hasSlCol ? [] : [String(idx + 1)]),
    ...cols.map((col) => {
      const v = r[col];
      if (typeof v === "number") return col.toLowerCase() === "sl" ? String(v) : fmtNum(v, 2);
      return String(v ?? "-");
    }),
  ]);

  const totalRow = [
    ...(hasSlCol ? [] : [""]),
    ...cols.map((col, idx) => {
      if (idx === (hasSlCol ? 1 : 0)) return "Total";
      if (col.toLowerCase() === "sl" || !isNumericCol(col)) return "";
      const sum = rowsData.reduce((s, r) => s + (typeof r[col] === "number" ? Number(r[col]) : 0), 0);
      return fmtNum(sum, 2);
    }),
  ];

  const reportTitle = report.reportType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const bytes = await renderCorporatePurchasePdf({
    filename: `${report.reportType}.pdf`,
    title: reportTitle,
    header,
    metaLeft: [
      ["Report Title", reportTitle],
      ["Mode", query.isSummary ? "Summary View" : "Detailed Ledger"],
      ["Total Rows", String(rowsData.length)],
    ],
    metaRight: [
      ["Generated Date", fmtDate(report.generatedAt)],
      ["Period", `${query.fromDate ? fmtDate(query.fromDate) : "Start"} - ${query.toDate ? fmtDate(query.toDate) : "Today"}`],
      ["Status Filter", query.status || "ALL"],
    ],
    columns: tableColumns,
    rows,
    totalRows: rowsData.length ? [totalRow] : undefined,
    signatures: [
      { roleLabel: "Prepared By" },
      { roleLabel: "Checked By" },
      { roleLabel: "Approved By" },
    ],
    landscape: tableColumns.length > 8,
  });

  return { filename: `${report.reportType}.pdf`, bytes };
}
