import type { Metadata } from "next";
import { WalletListView } from "@/features/configuration/sales-config/wallet/components/WalletListView";

export const instant = false;

export const metadata: Metadata = { title: "Wallet Setup" };

export default function WalletSetupPage() {
  return <WalletListView />;
}
