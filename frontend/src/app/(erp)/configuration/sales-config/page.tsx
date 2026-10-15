import type { Metadata } from "next";
import { WorkspaceView } from "@/components/layout/workspace-view";
import { configurationWorkspace, salesConfig } from "@/features/configuration/navigation";

export const instant = false;

export const metadata: Metadata = { title: "Sales Config" };

export default function SalesConfigPage() {
  return (
    <WorkspaceView
      workspace={{
        ...configurationWorkspace,
        id: "sales-config",
        label: salesConfig.label,
        href: salesConfig.href ?? configurationWorkspace.href,
        description: "Sales offices, prices, wallets and sales returns.",
        shortcuts: undefined,
        cards: [salesConfig],
      }}
    />
  );
}
