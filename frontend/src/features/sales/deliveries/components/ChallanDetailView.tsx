"use client";

import { ArrowLeft, Download, Info, Package, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { buttonClasses } from "@/components/ui/button";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatQty } from "../../dashboard/lib/format";
import { altQty } from "../../orders/lib/order-totals";
import { paths } from "../../paths";
import type { DeliveryDetail } from "../schemas/delivery.schema";
import { challanPdfUrl, fetchDelivery } from "../services/delivery.api";
import { DeliveryBanner, DeliveryInfo, TermsAndRemarks, TransportDetails } from "./DeliveryDetailParts";

/** Challan Details: what was handed over, in units and packs (no prices). */
export function ChallanDetailView({ id }: { id: string }) {
  const delivery = useResource(`delivery:${id}`, () => fetchDelivery(id));
  if (delivery.error) {
    return (
      <PageContainer>
        <PageHead title="Challan Details" />
        <Card>
          <ErrorState message={errorMessage(delivery.error)} onRetry={delivery.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (!delivery.data) {
    return (
      <PageContainer>
        <PageHead title="Challan Details" />
        <LoadingState />
      </PageContainer>
    );
  }
  return <ChallanBody delivery={delivery.data} />;
}

function ChallanBody({ delivery }: { delivery: DeliveryDetail }) {
  const [tab, setTab] = useState<"items" | "transport">("items");
  const altTotal = Math.round(delivery.lines.reduce((sum, line) => sum + (altQty(line.qty, line.altUomFactor) ?? 0), 0) * 1000) / 1000;
  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.deliveryTab("challans")} aria-label="Back to challans" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            Challan Details
          </span>
        }
      />
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <DeliveryBanner delivery={delivery}>
            <a href={challanPdfUrl(delivery.id)} target="_blank" rel="noopener" aria-label="Print challan" title="Print challan (PDF)" className={buttonClasses("ghost", "icon")}>
              <Printer />
            </a>
            <a href={challanPdfUrl(delivery.id, true)} aria-label="Download challan" title="Download challan (PDF)" className={buttonClasses("ghost", "icon")}>
              <Download />
            </a>
          </DeliveryBanner>
          <DeliveryInfo delivery={delivery} />
        </Card>

        <Card>
          <Tabs
            label="Challan sections"
            tabs={[
              { id: "items", label: "Item List", badge: delivery.lines.length },
              { id: "transport", label: "Transportation Details" },
            ]}
            value={tab}
            onChange={setTab}
          >
            {tab === "items" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-accent-soft font-semibold text-ink">
                    <tr>
                      <th scope="col" className="w-12 px-3 py-2 text-left">SL</th>
                      <th scope="col" className="px-3 py-2 text-left">Item Code</th>
                      <th scope="col" className="px-3 py-2 text-left">Item Name</th>
                      <th scope="col" className="px-3 py-2 text-right">Delivery QTY</th>
                      <th scope="col" className="px-3 py-2 text-right">Delivery Alt. QTY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {delivery.lines.map((line) => {
                      const alt = altQty(line.qty, line.altUomFactor);
                      return (
                        <tr key={line.id}>
                          <td className="px-3 py-1.5 tabular-nums">{line.lineNo}</td>
                          <td className="px-3 py-1.5 text-ink-muted">{line.itemCode}</td>
                          <td className="px-3 py-1.5 text-ink">
                            <span className="inline-flex items-center gap-1.5">
                              <Package aria-hidden="true" className="size-3.5 text-warning" />
                              <Info aria-hidden="true" className="size-3.5 text-ink-faint" />
                              {line.itemName}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {formatQty(line.qty)} {line.uom}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{alt === null ? "—" : `${formatQty(alt)} ${line.altUom ?? ""}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-line-strong bg-canvas font-semibold text-ink">
                    <tr>
                      <td colSpan={3} />
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(delivery.totalQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(altTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <TransportDetails delivery={delivery} />
            )}
          </Tabs>
        </Card>
        <TermsAndRemarks delivery={delivery} />
      </div>
    </PageContainer>
  );
}
