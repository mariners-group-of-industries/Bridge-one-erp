import { listGlAccounts } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET: leaf GL accounts (cash account, adjust with GL, bank deduction heads). */
export const GET = apiHandler("sales:read", async () => ok(await listGlAccounts()));
