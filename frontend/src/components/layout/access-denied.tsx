"use client";

import { ShieldX } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session";
import { pathAllowed } from "@/lib/permissions/registry";
import { PageContainer } from "./page";

/** Shown in place of a page the signed-in user may not open. */
export function AccessDenied() {
  return (
    <PageContainer>
      <section className="mx-auto mt-12 flex max-w-md flex-col items-center gap-3 rounded border border-line bg-surface px-6 py-10 text-center shadow-xs">
        <span className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger [&_svg]:size-6">
          <ShieldX aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold text-ink">Access denied</h1>
        <p className="text-sm text-ink-muted">You do not have permission to open this page. If you need it for your work, ask your administrator to grant access.</p>
        <Link href="/" className={buttonClasses("primary", "md", "mt-2")}>
          Go to Home
        </Link>
      </section>
    </PageContainer>
  );
}

/** Renders the page only when the user may view it (direct URLs included). The server checks every API call as well. */
export function PageGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { grants } = useSession();
  return pathAllowed(grants, pathname) ? <>{children}</> : <AccessDenied />;
}
