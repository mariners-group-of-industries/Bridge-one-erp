import type { Metadata } from "next";
import { SalesSetupView } from "@/features/configuration/sales-config/territory/components/SalesSetupView";

export const instant = false;

export const metadata: Metadata = { title: "Sales Setup" };

export default async function SalesSetupPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <SalesSetupView initialTab={tab} />;
}
