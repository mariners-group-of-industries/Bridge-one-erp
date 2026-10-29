"use client";

import { useId, useState } from "react";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { Field, FormGrid, Input, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { TerritoryCustomerGroup, TerritoryTree } from "../schemas/territory.schema";
import { territoryApi } from "../services/territory.api";

const money = (value: string | number | null) =>
  value === null
    ? "—"
    : Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/**
 * Territory Wise Customer List (as in Managerium): every territory, or the one chosen,
 * each with its customers and their credit limit total.
 */
export function TerritoryCustomersTab({ tree, search }: { tree: TerritoryTree; search: string }) {
  const listId = useId();
  const territoryLayer = tree.layers.find((layer) => layer.isTerritory);
  const [territoryId, setTerritoryId] = useState("");
  const [customerText, setCustomerText] = useState("");
  const [customerId, setCustomerId] = useState("");
  const params = { businessUnitId: tree.businessUnitId, territoryId, customerId, search };
  const list = useResource(`territory-customers:${JSON.stringify(params)}`, () => territoryApi.customerGroups(params));
  // Every Sales territory, kept while a narrower list reloads.
  const [territories, setTerritories] = useState<{ id: string; name: string }[]>([]);
  if (list.data && list.data.territories !== territories) setTerritories(list.data.territories);

  const customers = list.data?.customers ?? [];
  const label = (customer: { code: string; name: string }) => `${customer.code} - ${customer.name}`;
  // As in Managerium, customer suggestions start after 2 letters.
  const suggestions = customerText.trim().length >= 2 ? customers.filter((customer) => label(customer).toLowerCase().includes(customerText.trim().toLowerCase())).slice(0, 50) : [];

  function pickCustomer(text: string) {
    setCustomerText(text);
    const match = customers.find((customer) => label(customer) === text);
    // Text that no longer names a customer drops the filter.
    setCustomerId(match?.id ?? "");
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <FormGrid cols={2}>
        <Field label={territoryLayer?.name ?? "Territory"}>
          {(id) => (
            <Select
              id={id}
              value={territoryId}
              placeholder={`Select ${territoryLayer?.name ?? "Territory"} (all)`}
              options={territories.map((territory) => ({ value: territory.id, label: territory.name }))}
              onChange={(e) => {
                setTerritoryId(e.target.value);
                setCustomerId("");
                setCustomerText("");
              }}
            />
          )}
        </Field>
        <Field label="Customer">
          {(id) => (
            <>
              <Input id={id} list={listId} type="search" value={customerText} placeholder="Select/Search Customer (min 2 letters)" onChange={(e) => pickCustomer(e.target.value)} />
              <datalist id={listId}>
                {suggestions.map((customer) => (
                  <option key={customer.id} value={label(customer)} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      </FormGrid>

      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState label="Loading customers…" />
      ) : list.data.groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-faint">No customers{territoryId ? " in this territory" : ""}{search ? ` matching “${search}”` : ""}.</p>
      ) : (
        <>
          {list.data.groups.map((group) => (
            <TerritoryGroup key={group.id} group={group} />
          ))}
          <p className="text-center text-xs text-ink-faint" aria-live="polite">
            {list.data.truncated
              ? `Showing the first ${list.data.groups.reduce((sum, group) => sum + group.rows.length, 0)} of ${list.data.total} customers; choose a territory or customer to narrow the list.`
              : `${list.data.total} customers in ${list.data.groups.length} ${list.data.groups.length === 1 ? "territory" : "territories"}`}
          </p>
        </>
      )}
    </div>
  );
}

function TerritoryGroup({ group }: { group: TerritoryCustomerGroup }) {
  return (
    <section aria-label={`Territory ${group.name}`} className="overflow-hidden rounded-md border border-line">
      <h3 className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">
        Territory Name : {group.name} <span className="text-xs font-normal text-ink-faint">{group.code}</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="data-grid w-full min-w-max">
          <thead>
            <tr>
              {["SL", "Customer Code", "Customer Name", "Customer Address", "Customer Group"].map((h) => (
                <th key={h} scope="col" className="px-2.5 py-2 text-left">
                  {h}
                </th>
              ))}
              <th scope="col" className="px-2.5 py-2 text-right">
                Credit Limit
              </th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, index) => (
              <tr key={row.id}>
                <td className="w-12 px-2.5 py-1.5 text-right text-ink-faint tabular-nums">{index + 1}</td>
                <td className="px-2.5 py-1.5 font-medium whitespace-nowrap">{row.code}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap">{row.name}</td>
                <td className="max-w-96 truncate px-2.5 py-1.5" title={row.address ?? undefined}>
                  {row.address ?? "N/A"}
                </td>
                <td className="px-2.5 py-1.5 whitespace-nowrap">{row.groupName ?? "—"}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">{money(row.creditLimit ?? 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="px-2.5 py-1.5 text-right font-semibold text-ink">
                Total
              </td>
              <td className="px-2.5 py-1.5 text-right font-semibold text-ink tabular-nums">{money(group.creditTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
