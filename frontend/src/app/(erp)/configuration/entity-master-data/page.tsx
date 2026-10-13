import type { Metadata } from "next";
import { WorkspaceView } from "@/components/layout/workspace-view";
import { configurationWorkspace, entityMasterData } from "@/features/configuration/navigation";

export const metadata: Metadata = { title: "Entity Master Data" };

export default function EntityMasterDataPage() {
  return (
    <WorkspaceView
      workspace={{
        ...configurationWorkspace,
        id: "entity-master-data",
        label: entityMasterData.label,
        href: entityMasterData.href ?? configurationWorkspace.href,
        description: "Employees, items, customers and suppliers.",
        shortcuts: undefined,
        cards: [entityMasterData],
      }}
    />
  );
}
