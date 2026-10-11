import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "@/lib/auth/session";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
