import type { Metadata } from "next";
import { IncrementView } from "@/features/hrm/compensation/components/IncrementView";

export const instant = false;

export const metadata: Metadata = { title: "Increment" };

export default function IncrementPage() {
  return <IncrementView />;
}
