"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { OrgAccessDto, OrgOptionsDto } from "../schemas/personal-info.schema";
import { personalInfoApi } from "../services/personal-info.api";
import { CONTROL_CLASS, Field, Panel, SaveState, Select, TABLE } from "./kit";

/**
 * Edit Profile › Personal Info › User Permission: the business units, offices
 * and warehouses this user may work with. Pick a type and a value (or "All")
 * and add it; nothing is stored until Save.
 */

type Kind = "businessUnitIds" | "officeIds" | "warehouseIds";
type AllFlag = "allBusinessUnits" | "allOffices" | "allWarehouses";
const KINDS: { id: Kind; all: AllFlag; label: string; plural: string }[] = [
  { id: "businessUnitIds", all: "allBusinessUnits", label: "Business Unit", plural: "Business Units" },
  { id: "officeIds", all: "allOffices", label: "Office", plural: "Offices" },
  { id: "warehouseIds", all: "allWarehouses", label: "Warehouse", plural: "Warehouses" },
];
const ALL = "__all__";

interface Item {
  id: string;
  name: string;
  /** The unit it belongs to (business unit of an office, office of a warehouse). */
  parent: string | null;
}

function itemsOf(kind: Kind, options: OrgOptionsDto): Item[] {
  const unitName = new Map(options.businessUnits.map((u) => [u.id, u.name]));
  const officeName = new Map(options.offices.map((o) => [o.id, o.name]));
  if (kind === "businessUnitIds") return options.businessUnits.map((u) => ({ id: u.id, name: u.name, parent: null }));
  if (kind === "officeIds") return options.offices.map((o) => ({ id: o.id, name: o.name, parent: unitName.get(o.businessUnitId) ?? null }));
  return options.warehouses.map((w) => ({ id: w.id, name: w.name, parent: officeName.get(w.officeId) ?? null }));
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

export function UserPermissionSection({
  employeeId,
  saved,
  options,
  onSaved,
}: {
  employeeId: string;
  saved: OrgAccessDto;
  options: OrgOptionsDto;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState<OrgAccessDto>(saved);
  const [kind, setKind] = useState<Kind>("businessUnitIds");
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = KINDS.some((k) => value[k.all] !== saved[k.all] || (!value[k.all] && !sameIds(value[k.id], saved[k.id])));

  const kindLabel = KINDS.find((k) => k.id === kind)!;
  const items = itemsOf(kind, options);
  const available = value[kindLabel.all] ? [] : items.filter((i) => !value[kind].includes(i.id));

  function add() {
    if (!pick) return;
    if (pick === ALL) setValue({ ...value, [kind]: items.map((i) => i.id), [kindLabel.all]: true });
    else setValue({ ...value, [kind]: [...new Set([...value[kind], pick])] });
    setPick("");
  }

  /** Removing anything from an "All" grant turns it back into a list. */
  const remove = (k: (typeof KINDS)[number], ids: string[]) =>
    setValue({ ...value, [k.id]: value[k.id].filter((id) => !ids.includes(id)), [k.all]: false });

  async function save() {
    setSaving(true);
    try {
      await personalInfoApi.updateOrgAccess(employeeId, value);
      toast.success("User permissions saved.");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // One row per granted value; an "All" grant shows as a single row.
  const rows = KINDS.flatMap((k) => {
    const all = itemsOf(k.id, options);
    if (value[k.all]) {
      return [{ key: `${k.id}:all`, kind: k, name: `All ${k.plural} (${all.length} now, new ones included)`, parent: null, ids: all.map((i) => i.id) }];
    }
    const granted = all.filter((i) => value[k.id].includes(i.id));
    if (granted.length === 0) return [];
    return granted.map((i) => ({ key: `${k.id}:${i.id}`, kind: k, name: i.name, parent: i.parent, ids: [i.id] }));
  });

  return (
    <Panel
      title="User Permission"
      description="Business units, offices and warehouses this user may work with. Add each one, or choose All, then save."
      footer={
        <>
          <SaveState dirty={dirty} />
          <Button variant="secondary" disabled={!dirty} onClick={() => setValue(saved)}>
            Cancel
          </Button>
          <Button variant="accent" loading={saving} disabled={!dirty} onClick={() => void save()}>
            {!saving && <Save />} Save User Permission
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Permission Type" className="w-full sm:w-48">
            {(id) => (
              <Select
                id={id}
                value={kind}
                placeholder={false}
                options={KINDS.map((k) => ({ value: k.id, label: `${k.label} (${itemsOf(k.id, options).length})` }))}
                onChange={(e) => (setKind(e.target.value as Kind), setPick(""))}
              />
            )}
          </Field>
          <Field label={kindLabel.label} className="w-full sm:w-72">
            {(id) => (
              <select id={id} value={pick} disabled={value[kindLabel.all] || items.length === 0} onChange={(e) => setPick(e.target.value)} className={cn(CONTROL_CLASS, "pr-7")}>
                <option value="">
                  {items.length === 0 ? `No ${kindLabel.plural.toLowerCase()} set up` : value[kindLabel.all] ? `All ${kindLabel.plural.toLowerCase()} added` : `Select ${kindLabel.label.toLowerCase()}…`}
                </option>
                {!value[kindLabel.all] && items.length > 0 && <option value={ALL}>All {kindLabel.plural} (includes new ones)</option>}
                {available.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.parent ? `${i.name} (${i.parent})` : i.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Button variant="accent-soft" disabled={!pick} onClick={add}>
            <Plus /> Add
          </Button>
        </div>

        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.head}>
              <tr>
                <th scope="col" className={`${TABLE.th} w-12 text-right`}>SL</th>
                <th scope="col" className={TABLE.th}>Type</th>
                <th scope="col" className={TABLE.th}>Value</th>
                <th scope="col" className={TABLE.th}>Belongs To</th>
                <th scope="col" className={`${TABLE.th} w-16 text-center`}>Remove</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-faint">
                    No user permissions yet. Choose a type and a value, then click Add.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.key} className={TABLE.row}>
                  <td className={`${TABLE.td} text-right text-ink-faint tabular-nums`}>{i + 1}</td>
                  <td className={`${TABLE.td} text-ink-muted`}>{r.kind.label}</td>
                  <td className={`${TABLE.td} font-medium`}>{r.name}</td>
                  <td className={`${TABLE.td} text-ink-muted`}>{r.parent ?? "—"}</td>
                  <td className={`${TABLE.td} text-center`}>
                    <Button variant="ghost" size="icon" className="size-7 hover:text-danger" aria-label={`Remove ${r.kind.label} ${r.name}`} title="Remove" onClick={() => remove(r.kind, r.ids)}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
