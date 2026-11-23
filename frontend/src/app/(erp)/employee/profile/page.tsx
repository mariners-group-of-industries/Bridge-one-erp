import type { Metadata } from "next";
import { ProfileView } from "@/features/ess/components/ProfileView";

export const instant = false;

export const metadata: Metadata = { title: "My Profile" };

export default function EmployeeProfilePage() {
  return <ProfileView />;
}
