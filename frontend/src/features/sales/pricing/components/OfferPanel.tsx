"use client";

import { Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useResource } from "@/hooks/use-resource";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import type { PricingQuery, PricingResult } from "../schemas/pricing.schema";
import { fetchPricing } from "../services/pricing.api";

/** Rates and offers for the form so far (debounced); null query = nothing to price yet. */
export function usePricing(query: PricingQuery | null) {
  const key = useDebouncedValue(query ? JSON.stringify(query) : null, 400);
  return useResource<PricingResult>(key, () => fetchPricing(JSON.parse(key!) as PricingQuery));
}

/** Offers from Configuration › Sales Config that the server applies when the document is saved. */
export function OfferPanel({ result, itemName, withInvoiceDiscount = true }: { result?: PricingResult; itemName: (itemId: string) => string; withInvoiceDiscount?: boolean }) {
  const offers = result?.offers;
  const invoice = withInvoiceDiscount && offers && offers.invoiceDiscount > 0;
  if (!offers || (offers.freeLines.length === 0 && offers.discounts.length === 0 && !invoice)) return null;
  return (
    <div role="status" className="rounded-md border border-line bg-canvas p-3 text-sm">
      <p className="mb-2 flex items-center gap-1.5 font-medium text-ink">
        <Gift aria-hidden className="size-4 text-success" />
        Offers applied on save
      </p>
      <ul className="flex flex-col gap-1 text-ink-muted">
        {offers.freeLines.map((line) => (
          <li key={`free-${line.itemId}`} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <Badge variant="success">Free</Badge> {formatQty(line.qty)} × {line.code ? `${line.code} - ` : ""}
              {line.name}
            </span>
            <span className="text-xs">{line.offerName}</span>
          </li>
        ))}
        {offers.discounts.map((line) => (
          <li key={`discount-${line.itemId}`} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <Badge variant="primary">{line.percent}% off</Badge> {itemName(line.itemId)}
            </span>
            <span className="text-xs">{line.offerName}</span>
          </li>
        ))}
        {invoice && (
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <Badge variant="primary">Invoice discount</Badge> {formatAmount(offers.invoiceDiscount)}
            </span>
            <span className="text-xs">{offers.invoiceOfferName}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
