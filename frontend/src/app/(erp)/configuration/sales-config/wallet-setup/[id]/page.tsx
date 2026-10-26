import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WalletFormView } from "@/features/configuration/sales-config/wallet/components/WalletFormView";

export const instant = false;

export const metadata: Metadata = { title: "Edit Wallet" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditWalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <WalletFormView walletId={id} />;
}
