// Stable fallback globals for Next.js App Router typed pages.
// next typegen overwrites .next/types/routes.d.ts at typecheck time with
// precise route strings; this file ensures PageProps, LayoutProps and
// RouteContext are always resolvable on a clean checkout before that runs.

type AppRoutes = string;
type AppRouteHandlerRoutes = string;
type LayoutRoutes = string;

interface PageProps<_AppRoute extends AppRoutes = string> {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type LayoutProps<_LayoutRoute extends LayoutRoutes = string> = {
  params: Promise<Record<string, string>>;
  children: React.ReactNode;
};

interface RouteContext<_AppRouteHandlerRoute extends AppRouteHandlerRoutes = string> {
  params: Promise<Record<string, string>>;
}
