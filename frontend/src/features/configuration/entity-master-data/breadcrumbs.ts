import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import type { Breadcrumb } from "@/lib/navigation/types";

/** In-page trail for Entity Master Data pages ("Entity Master Data / Employee"), without the workspace crumb. */
export function entityMasterDataBreadcrumbs(pathname: string): Breadcrumb[] {
  return resolveBreadcrumbs(pathname).slice(1);
}
