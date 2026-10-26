import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApprovalFormView } from "@/features/configuration/security/approval/components/ApprovalFormView";

export const instant = false;

export const metadata: Metadata = { title: "Edit Approval Setup" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <ApprovalFormView pipelineId={id} />;
}
