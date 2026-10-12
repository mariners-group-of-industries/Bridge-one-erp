"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { useToday } from "../../lib/use-today";
import { paths } from "../../paths";
import { fetchDelivery } from "../services/delivery.api";
import { DeliveryOrderFormView } from "./DeliveryOrderForm";
import { DirectDeliveryFormView } from "./DirectDeliveryForm";

function Waiting({ title }: { title: string }) {
  return (
    <PageContainer>
      <PageHead title={title} />
      <LoadingState />
    </PageContainer>
  );
}

/** /sales/deliveries/new[?order=<salesOrderId>] — read inside <Suspense>. */
export function NewDeliveryView() {
  const today = useToday();
  const orderId = useSearchParams().get("order");
  if (!today) return <Waiting title={orderId ? "Delivery For SO" : "Direct Delivery"} />;
  return orderId ? <DeliveryOrderFormView orderId={orderId} today={today} /> : <DirectDeliveryFormView mode="DIRECT" today={today} />;
}

export function NewExchangeView() {
  const today = useToday();
  if (!today) return <Waiting title="Exchange" />;
  return <DirectDeliveryFormView mode="EXCHANGE" today={today} />;
}

/** Opens the right form for the delivery type. */
export function EditDeliveryView({ id }: { id: string }) {
  const today = useToday();
  const delivery = useResource(id, () => fetchDelivery(id));
  if (delivery.error) {
    return (
      <PageContainer>
        <PageHead title="Edit Delivery" />
        <Card>
          <ErrorState message={errorMessage(delivery.error)} onRetry={delivery.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (!today || !delivery.data) return <Waiting title="Edit Delivery" />;
  const data = delivery.data;
  if (data.status !== "SUBMITTED" || data.confirmation !== "PENDING") {
    return (
      <PageContainer>
        <PageHead title={`Edit ${data.number}`} />
        <Card>
          <EmptyState title={data.status !== "SUBMITTED" ? "This delivery was deleted" : "Confirmed deliveries cannot be edited"}>
            <Link href={paths.delivery(id)} className="font-medium text-ink underline underline-offset-2">
              View the challan
            </Link>
          </EmptyState>
        </Card>
      </PageContainer>
    );
  }
  if (data.deliveryType === "SALES_ORDER" && data.salesOrderId) {
    return <DeliveryOrderFormView orderId={data.salesOrderId} deliveryId={id} today={today} />;
  }
  return <DirectDeliveryFormView mode={data.deliveryType === "EXCHANGE" ? "EXCHANGE" : "DIRECT"} deliveryId={id} today={today} />;
}
