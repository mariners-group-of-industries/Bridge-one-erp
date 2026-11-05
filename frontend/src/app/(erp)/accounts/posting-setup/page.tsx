import type { Metadata } from "next";
import { PostingSetupView } from "@/features/accounts/components/PostingSetupView";

export const metadata: Metadata = { title: "Posting Setup" };

export default function PostingSetupPage() {
  return <PostingSetupView />;
}
