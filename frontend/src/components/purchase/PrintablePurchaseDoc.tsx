"use client";

import React from "react";
import { Download, ExternalLink, Printer } from "lucide-react";

export interface PrintHeaderContext {
  company?: {
    name?: string;
    businessUnitName?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  officesById?: Record<
    string,
    {
      id?: string;
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
    }
  >;
}

export interface PrintableColumn {
  header: string;
  align?: "left" | "center" | "right";
  widthClass?: string;
}

export interface PrintableSignature {
  roleLabel: string;
  name?: string;
  designation?: string;
  mobile?: string;
}

export interface PrintablePurchaseDocProps {
  context?: PrintHeaderContext | null;
  officeId?: string;
  officeName?: string;
  title: string;
  metaLeft: [string, string][];
  metaRight: [string, string][];
  columns: PrintableColumn[];
  rows: (string | number)[][];
  totalRows?: (string | number)[][];
  signatures?: [PrintableSignature, PrintableSignature, PrintableSignature];
}

export function fmtPrintDate(raw?: string | null): string {
  if (!raw) return "";
  const ymd = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  }
  return raw;
}

export function fmtPrintNum(val: unknown, digits = 2): string {
  const n = Number(val ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "0.00";
}

/** Unified ERP print sheet matching the formal Purchase PDF letterhead, bordered boxes & 3-signer footer. */
export function PrintablePurchaseDoc({
  context,
  officeId,
  officeName,
  title,
  metaLeft,
  metaRight,
  columns,
  rows,
  totalRows,
  signatures = [
    { roleLabel: "Prepared By" },
    { roleLabel: "Approved By" },
    { roleLabel: "Received By" },
  ],
}: PrintablePurchaseDocProps) {
  const officeInfo = officeId && context?.officesById ? context.officesById[officeId] : undefined;
  const companyName = context?.company?.name || context?.company?.businessUnitName || "";
  const resolvedOffice = officeInfo?.name || officeName || context?.company?.businessUnitName || "";
  const businessUnitName = context?.company?.businessUnitName || "";
  const address = officeInfo?.address || context?.company?.address || "";
  const phone = officeInfo?.phone || context?.company?.phone || "";
  const email = officeInfo?.email || context?.company?.email || "";
  const website = context?.company?.website || "";

  const contactLine = [phone ? `Phone: ${phone}` : "", email ? `Email: ${email}` : ""]
    .filter(Boolean)
    .join(" , ");

  return (
    <div className="bg-white p-6 text-black space-y-3 border border-slate-300 rounded-none print:p-0 print:border-0 print:space-y-2.5 font-sans">
      {/* 1. Corporate Letterhead (Centered, Clean, No Misplaced Logos) */}
      <div className="text-center space-y-0.5 pb-0.5">
        {companyName && (
          <h2 className="text-xl font-bold uppercase tracking-wider text-slate-950">
            {companyName}
          </h2>
        )}
        {resolvedOffice && (
          <p className="text-xs font-semibold text-slate-800">
            {resolvedOffice}
          </p>
        )}
        {businessUnitName &&
          businessUnitName.toLowerCase() !== companyName.toLowerCase() &&
          businessUnitName.toLowerCase() !== resolvedOffice.toLowerCase() && (
            <p className="text-[11px] font-medium text-slate-700">{businessUnitName}</p>
          )}
        {address && <p className="text-[10px] text-slate-600 leading-tight">{address}</p>}
        {contactLine && <p className="text-[10px] text-slate-600">{contactLine}</p>}
        {website && <p className="text-[10px] text-slate-600">Website: {website}</p>}
      </div>

      {/* 2. Centered Boxed Document Title */}
      <div className="flex justify-center my-1.5">
        <div className="border border-slate-900 bg-slate-100/90 px-6 py-1 text-center font-bold text-xs uppercase tracking-widest text-slate-950 shadow-2xs">
          {title}
        </div>
      </div>

      {/* 3. Bordered 2-Column Metadata Box with Perfectly Aligned Fields */}
      <div className="border border-slate-800 rounded-[2px] bg-white p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-900 leading-snug">
        <div className="space-y-0.5">
          {metaLeft.map(([label, value], idx) => (
            <div key={idx} className="grid grid-cols-[135px_1fr] gap-1 items-start">
              <span className="font-semibold text-slate-700">{label}</span>
              <span className="font-medium text-slate-950 break-words">: {value || "-"}</span>
            </div>
          ))}
        </div>
        <div className="space-y-0.5">
          {metaRight.map(([label, value], idx) => (
            <div key={idx} className="grid grid-cols-[130px_1fr] gap-1 items-start">
              <span className="font-semibold text-slate-700">{label}</span>
              <span className="font-medium text-slate-950 break-words">: {value || "-"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Crisp Black-Bordered Line Items Table */}
      <div className="overflow-x-auto my-1.5">
        <table className="w-full border-collapse border border-slate-800 text-[11px] text-slate-950">
          <thead>
            <tr className="bg-[#e9ecef] font-bold text-slate-900 text-[10.5px]">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`border border-slate-800 px-2 py-1.5 ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left"
                  } ${col.widthClass ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="border border-slate-800 px-3 py-3 text-center text-slate-500 italic">
                  No line items found
                </td>
              </tr>
            ) : (
              rows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 1 ? "bg-slate-50/40" : ""}>
                  {row.map((cell, cIdx) => {
                    const align = columns[cIdx]?.align ?? "left";
                    return (
                      <td
                        key={cIdx}
                        className={`border border-slate-800 px-2 py-1 align-middle ${
                          align === "right"
                            ? "text-right tabular-nums font-mono text-[10.5px]"
                            : align === "center"
                              ? "text-center"
                              : "text-left"
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {totalRows && totalRows.length > 0 && (
            <tfoot>
              {totalRows.map((row, tIdx) => (
                <tr key={tIdx} className="font-bold bg-[#f1f3f5] text-slate-950">
                  {row.map((cell, cIdx) => {
                    const align = columns[cIdx]?.align ?? "left";
                    return (
                      <td
                        key={cIdx}
                        className={`border border-slate-800 px-2 py-1.5 ${
                          align === "right"
                            ? "text-right tabular-nums font-mono text-[10.5px]"
                            : align === "center"
                              ? "text-center"
                              : "text-left"
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>

      {/* 5. 3-Column Signature Block */}
      <div className="pt-14 grid grid-cols-3 gap-8 text-[10.5px] leading-tight text-slate-900 print:break-inside-avoid">
        {signatures.map((slot, idx) => (
          <div key={idx} className="min-w-0">
            <div className="border-t border-slate-800 w-36 pt-1 font-bold text-slate-950">{slot.roleLabel}</div>
            <div className="text-slate-700">Name: <span className="text-slate-950 font-medium">{slot.name || ""}</span></div>
            <div className="text-slate-700">Designation: <span className="text-slate-950">{slot.designation || ""}</span></div>
            <div className="text-slate-700">Mobile: <span className="text-slate-950">{slot.mobile || ""}</span></div>
          </div>
        ))}
      </div>

      {/* 6. Document Footer: Made by BridgeOne */}
      <div className="pt-4 mt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-medium tracking-tight print:break-inside-avoid">
        <span className="font-semibold text-slate-600">Made by BridgeOne</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );
}

export function PurchasePrintToolbar({
  pdfUrl,
  onClose,
  canExportPdf = true,
}: {
  pdfUrl: string;
  onClose: () => void;
  canExportPdf?: boolean;
}) {
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = "";
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  return (
    <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200 print:hidden">
      <button
        type="button"
        onClick={onClose}
        className="px-3.5 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-xs font-medium"
      >
        Close
      </button>
      {canExportPdf && (
        <>
          <a
            href={`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded font-semibold text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </a>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded font-semibold text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open PDF</span>
          </a>
        </>
      )}
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-semibold text-xs"
      >
        <Printer className="w-3.5 h-3.5" />
        <span>Print Document</span>
      </button>
    </div>
  );
}

