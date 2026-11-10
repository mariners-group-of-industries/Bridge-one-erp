import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { collection } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: collection.label };

export default function CollectionPage() {
  return <RtmPagePlaceholder page={collection} />;
}
