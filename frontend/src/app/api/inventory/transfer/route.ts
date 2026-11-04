import { documentListRoutes } from "@/features/inventory/server/routes";

/** GET: the page's documents (?from, ?to, ?status). POST: create one. */
export const { GET, POST } = documentListRoutes("transfer");
