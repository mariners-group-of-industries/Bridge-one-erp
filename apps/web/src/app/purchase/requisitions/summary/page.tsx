import { redirect } from "next/navigation";

export default function RequisitionSummaryRoutePage() {
  redirect("/purchase/requisitions?tab=summary");
}
