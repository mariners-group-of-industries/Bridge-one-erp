import type { Metadata } from "next";
import { PosTerminalView } from "@/features/pos/components/PosTerminalView";

export const metadata: Metadata = { title: "POS Terminal" };

// Rendered only after the session loads in the browser; instant-navigation validation cannot run.
export const instant = false;

export default function PosTerminalPage() {
  return <PosTerminalView />;
}
