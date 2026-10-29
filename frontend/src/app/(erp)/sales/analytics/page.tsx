import { redirect } from "next/navigation";
import { paths } from "@/features/sales/paths";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

/** Sales Analytics moved into Sales Report & Analytics; old links open its Analytics tab. */
export default function SalesAnalyticsPage() {
  redirect(paths.reportTab("analytics"));
}
