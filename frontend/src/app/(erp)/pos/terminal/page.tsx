import type { Metadata } from "next";
import { PosTerminalView } from "@/features/pos/components/PosTerminalView";

export const metadata: Metadata = { title: "POS Terminal" };

export default function PosTerminalPage() {
  return <PosTerminalView />;
}
