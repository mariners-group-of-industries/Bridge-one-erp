import type { Metadata } from "next";
import { MyProfileView } from "@/features/hrm/self-service/profile/components/MyProfileView";

export const instant = false;

export const metadata: Metadata = { title: "Profile" };

export default function SelfServiceProfilePage() {
  return <MyProfileView />;
}
