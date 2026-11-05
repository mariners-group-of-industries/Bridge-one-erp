import { apiHandler, ok } from "@/lib/api/handler";
import { ACTION_LABELS, permissionModules } from "@/lib/permissions/registry";

/** The permission registry: modules, their pages (with submodule) and the actions each page supports. */
export const GET = apiHandler("configuration:read", async () => ok({ actions: ACTION_LABELS, modules: permissionModules() }));
