import { purchaseStore, type PurchaseActor } from "@/lib/purchase-store/store";
import type { Item, Office, Supplier, Warehouse } from "@bridgeone/contracts";

/**
 * Name → record lookups for the purchase bulk-upload templates. Offices and
 * warehouses respect the user's org scope; suppliers and items are active rows.
 */
export interface PurchaseLookups {
  offices: Office[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  items: Item[];
}

export async function loadPurchaseLookups(actor: PurchaseActor): Promise<PurchaseLookups> {
  const [offices, warehouses, suppliers, items] = await Promise.all([
    purchaseStore.getOffices(actor),
    purchaseStore.getWarehouses(undefined, actor),
    purchaseStore.getSuppliers(),
    purchaseStore.getItems(),
  ]);
  return { offices, warehouses, suppliers, items };
}

export function officeByName(lookups: PurchaseLookups, raw: string): Office {
  const value = raw.trim();
  if (!value) throw new Error("Office is required.");
  const found = lookups.offices.find((o) => o.name.trim().toLowerCase() === value.toLowerCase());
  if (!found) throw new Error(`Office "${value}" not found (or not in your access).`);
  return found;
}

export function warehouseByName(lookups: PurchaseLookups, raw: string, officeId?: string): Warehouse {
  const value = raw.trim();
  if (!value) throw new Error("Warehouse is required.");
  const scoped = officeId ? lookups.warehouses.filter((w) => w.officeId === officeId) : lookups.warehouses;
  const found =
    scoped.find((w) => w.name.trim().toLowerCase() === value.toLowerCase()) ??
    lookups.warehouses.find((w) => w.name.trim().toLowerCase() === value.toLowerCase());
  if (!found) throw new Error(`Warehouse "${value}" not found (or not in your access).`);
  if (officeId && found.officeId !== officeId) throw new Error(`Warehouse "${found.name}" belongs to another office.`);
  return found;
}

export function supplierByName(lookups: PurchaseLookups, raw: string): Supplier {
  const value = raw.trim();
  if (!value) throw new Error("Supplier is required.");
  const found = lookups.suppliers.find((s) => s.name.trim().toLowerCase() === value.toLowerCase());
  if (!found) throw new Error(`Supplier "${value}" not found. Create it first (Purchase › any form › quick-create, or Configuration › Supplier Profile).`);
  return found;
}

export function itemByCode(lookups: PurchaseLookups, raw: string): Item {
  const value = raw.trim();
  if (!value) throw new Error("Item Code is required.");
  const found = lookups.items.find((i) => i.code.trim().toLowerCase() === value.toLowerCase());
  if (!found) throw new Error(`Item code "${value}" not found. Create it first (Configuration › Item Profile).`);
  return found;
}
