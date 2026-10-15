import type { Metadata } from "next";
import { WalletFormView } from "@/features/configuration/sales-config/wallet/components/WalletFormView";

export const instant = false;

export const metadata: Metadata = { title: "Add Wallet" };

export default function NewWalletPage() {
  return <WalletFormView />;
}
