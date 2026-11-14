"use client";

import { useResource } from "@/hooks/use-resource";
import { inventoryApi } from "../services/inventory.api";

/** "" = all offices. Inventory documents belong to an office through their warehouse. */
export type OfficeChoice = string;

/** True when a row's office matches the chosen office ("" matches everything). */
export const inOffice = (choice: OfficeChoice, ...officeNames: (string | null | undefined)[]) =>
  !choice || officeNames.some((name) => name === choice);

/** The offices that have warehouses, for the Office dropdown on the inventory screens. */
export function useInventoryOffices(): string[] {
  const masters = useResource("inventory-masters", inventoryApi.masters);
  return [...new Set((masters.data?.warehouses ?? []).map((w) => w.officeName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** Office dropdown styled like the other inventory filters. */
export function OfficeFilter({ value, onChange, offices }: { value: OfficeChoice; onChange: (value: OfficeChoice) => void; offices: string[] }) {
  return (
    <div>
      <label className="mb-0.5 block text-[11px] font-medium text-slate-600">Office</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-44 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500"
      >
        <option value="">All offices</option>
        {offices.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
