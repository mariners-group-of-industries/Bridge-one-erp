import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page";
import { buttonClasses } from "@/components/ui/button";

/** Root 404 (unmatched URLs and notFound() calls), rendered inside the desk shell. */
export default function NotFound() {
  return (
    <AppShell>
      <PageContainer className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-xl font-semibold text-ink">Page not found</p>
        <p className="text-sm text-ink-faint">The page you are looking for does not exist or has been moved.</p>
        <Link href="/" className={buttonClasses("primary")}>
          Go to Home
        </Link>
      </PageContainer>
    </AppShell>
  );
}
