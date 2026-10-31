import Image from "next/image";
import type { ComponentProps } from "react";
import { EmptyState as BaseEmptyState } from "@/components/ui/section";

/**
 * "No data" state of this module: the platform empty state with the BridgeOne logo
 * (public/main-logo/Logo.png). Pass `icon` only for states that are not "no data" (e.g. coming soon).
 */
export function EmptyState({ icon, ...props }: ComponentProps<typeof BaseEmptyState>) {
  return <BaseEmptyState {...props} icon={icon ?? <Image src="/main-logo/Logo.png" alt="BridgeOne" width={8452} height={1738} className="mb-1 h-12 w-auto" />} />;
}
