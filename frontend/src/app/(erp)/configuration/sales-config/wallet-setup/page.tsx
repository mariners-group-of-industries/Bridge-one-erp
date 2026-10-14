import type { Metadata } from "next";
import { PendingProfileView } from "@/features/configuration/entity-master-data/components/PendingProfileView";
import { salesConfigPaths } from "@/features/configuration/sales-config/paths";

export const instant = false;

export const metadata: Metadata = { title: "Wallet Setup" };

export default function WalletSetupPage() {
  return <PendingProfileView title="Wallet Setup" path={salesConfigPaths.walletSetup} />;
}
