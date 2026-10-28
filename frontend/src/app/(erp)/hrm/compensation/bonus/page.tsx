import type { Metadata } from "next";
import { BonusView } from "@/features/hrm/compensation/components/BonusView";

export const instant = false;

export const metadata: Metadata = { title: "Bonus" };

export default function BonusPage() {
  return <BonusView />;
}
