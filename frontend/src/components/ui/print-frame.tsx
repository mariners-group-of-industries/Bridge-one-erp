import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

/**
 * Printed-page frame for A4 documents (see `.print-frame` in globals.css).
 *
 * `@page` has margin 0 so the browser never prints its own URL/date header and footer.
 * To still get a margin on *every* printed page, the document sits in a table whose
 * empty <thead>/<tfoot> rows repeat on each page as top/bottom spacers; the bottom one
 * leaves room for <PrintPageFooter />, which is pinned to the bottom of every page.
 * On screen the frame is a plain block, so layouts are unchanged.
 */
export function PrintFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <table className={cn("print-frame", className)} role="presentation">
      <thead aria-hidden="true">
        <tr>
          <td>
            <div className="print-frame-top" />
          </td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{children}</td>
        </tr>
      </tbody>
      <tfoot aria-hidden="true">
        <tr>
          <td>
            <div className="print-frame-bottom" />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

/**
 * "Made by BridgeOne" document footer. On screen it closes the document; when printed it
 * is fixed to the very bottom of every A4 page. Use inside a <PrintFrame> so content
 * never runs underneath it.
 */
export function PrintPageFooter({ className }: { className?: string }) {
  // `className` replaces the default spacing/colour (cn does not merge conflicting utilities).
  return (
    <div
      className={cn(
        "print-page-footer flex items-center justify-between border-t",
        className ?? "mt-6 border-line pt-2 text-[9px] text-ink-muted",
      )}
    >
      <span className="font-semibold">Made by BridgeOne</span>
      <span suppressHydrationWarning>Printed {formatDateTime(new Date())}</span>
    </div>
  );
}
