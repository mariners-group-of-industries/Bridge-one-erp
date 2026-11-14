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
    <div className="bg-white p-6 text-black space-y-3 border border-slate-300 rounded-none print:p-0 print:border-0">
      {/* 1. Corporate Letterhead (Left Logo + Centered Details) */}
      <div className="relative flex items-start justify-center min-h-[54px]">
        <div className="absolute left-0 top-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Company Logo" className="h-9 w-auto max-w-[125px] object-contain" />
        </div>
        <div className="text-center px-32 leading-snug">
          {companyName && (
            <h2 className="text-lg font-bold tracking-tight text-black">{companyName}</h2>
          )}
          {resolvedOffice && <p className="text-[11px] font-medium text-black">{resolvedOffice}</p>}
          {businessUnitName &&
            businessUnitName.toLowerCase() !== resolvedOffice.toLowerCase() && (
              <p className="text-[11px] text-black">{businessUnitName}</p>
            )}
          {address && <p className="text-[10.5px] text-slate-900">{address}</p>}
          {contactLine && <p className="text-[10.5px] text-slate-900">{contactLine}</p>}
          {website && <p className="text-[10.5px] text-slate-900">Website : {website}</p>}
        </div>
      </div>

      {/* 2. Centered Boxed Document Title */}
      <div className="flex justify-center pt-1">
        <div className="border border-black px-4 py-1 text-center font-bold text-sm text-black tracking-tight">
          {title}
        </div>
      </div>

      {/* 3. Bordered 2-Column Metadata Box */}
      <div className="border border-black px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-[11px] leading-[1.45] text-black">
        <div className="space-y-0.5">
          {metaLeft.map(([label, value], idx) => (
            <div key={idx} className="break-words">
              <span>{label} : </span>
              <span>{value || ""}</span>
            </div>
          ))}
        </div>
        <div className="space-y-0.5">
          {metaRight.map(([label, value], idx) => (
            <div key={idx} className="break-words">
              <span>{label} : </span>
              <span>{value || ""}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Crisp Black-Bordered Line Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-black text-[11px] text-black">
          <thead>
            <tr className="bg-[#d9d9d9] font-bold">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`border border-black px-1.5 py-1 ${
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
                <td colSpan={columns.length} className="border border-black px-2 py-2 text-center text-slate-600">
                  No line items
                </td>
              </tr>
            ) : (
              rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => {
                    const align = columns[cIdx]?.align ?? "left";
                    return (
                      <td
                        key={cIdx}
                        className={`border border-black px-1.5 py-1 align-middle ${
                          align === "right"
                            ? "text-right tabular-nums"
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
                <tr key={tIdx} className="font-bold">
                  {row.map((cell, cIdx) => {
                    const align = columns[cIdx]?.align ?? "left";
                    return (
                      <td
                        key={cIdx}
                        className={`border border-black px-1.5 py-1 ${
                          align === "right"
                            ? "text-right tabular-nums"
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
      <div className="pt-14 grid grid-cols-3 gap-8 text-[10.5px] leading-snug text-black print:break-inside-avoid">
        {signatures.map((slot, idx) => (
          <div key={idx} className="min-w-0">
            <div className="border-t border-black w-32 pt-1 font-bold">{slot.roleLabel}</div>
            <div>Name: {slot.name || ""}</div>
            <div>Designation: {slot.designation || ""}</div>
            <div>Mobile: {slot.mobile || ""}</div>
          </div>
        ))}
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
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-semibold text-xs"
      >
        <Printer className="w-3.5 h-3.5" />
        <span>Print Document</span>
      </button>
    </div>
  );
}

