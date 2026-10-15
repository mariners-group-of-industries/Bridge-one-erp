import type { Metadata } from "next";
import { ApiTokenView } from "@/features/configuration/gateways/components/ApiTokenView";

export const instant = false;

export const metadata: Metadata = { title: "API Configuration" };

export default function ApiConfigurationPage() {
  return <ApiTokenView />;
}
