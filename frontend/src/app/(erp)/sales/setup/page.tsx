import type { Metadata } from "next";
import { SalesSetupView } from "@/features/sales/setup/components/SalesSetupView";

export const metadata: Metadata = { title: "Sales Setup" };

export default function SalesSetupPage() {
  return <SalesSetupView />;
}
