import type { Metadata } from "next";
import { SalesSetupView } from "@/features/configuration/sales-config/territory/components/SalesSetupView";

export const instant = false;

export const metadata: Metadata = { title: "Sales Setup" };

export default function SalesSetupPage() {
  return <SalesSetupView />;
}
