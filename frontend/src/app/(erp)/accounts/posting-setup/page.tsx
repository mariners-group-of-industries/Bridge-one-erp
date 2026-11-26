import type { Metadata } from "next";
import { PostingSetupView } from "@/features/accounts/components/PostingSetupView";

export const metadata: Metadata = { title: "Posting Setup" };

// Rendered only after the session loads in the browser; instant-navigation validation cannot run.
export const instant = false;

export default function PostingSetupPage() {
  return <PostingSetupView />;
}
