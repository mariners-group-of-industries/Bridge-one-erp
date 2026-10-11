"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { FieldGrid } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { apiFieldErrors, issuesToErrors, numberText, optionalNumber, requiredNumber } from "../../lib/form";
import {
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  customerInputSchema,
  customerUpdateSchema,
  type AreaKind,
  type CustomerOption,
  type CustomerType,
  type SetupLookups,
} from "../../masters/schemas/masters.schema";
import { createCustomer, updateCustomer } from "../../masters/services/masters.api";

interface AddressRow {
  key: string;
  id?: string;
  label: string;
  address: string;
  isDefault: boolean;
}

interface Values {
  code: string;
  name: string;
  customerType: CustomerType;
  customerGroupId: string;
  phone: string;
  email: string;
  contactPerson: string;
  binNumber: string;
  address: string;
  zoneId: string;
  territoryId: string;
  routeId: string;
  sectionId: string;
  salesPersonId: string;
  creditDays: string;
  creditLimit: string;
  isActive: boolean;
  addresses: AddressRow[];
}

function initialValues(customer: CustomerOption | null): Values {
  return {
    code: customer?.code ?? "",
    name: customer?.name ?? "",
    customerType: customer?.customerType ?? "GENERAL",
    customerGroupId: customer?.customerGroupId ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    contactPerson: customer?.contactPerson ?? "",
    binNumber: customer?.binNumber ?? "",
    address: customer?.address ?? "",
    zoneId: customer?.zoneId ?? "",
    territoryId: customer?.territoryId ?? "",
    routeId: customer?.routeId ?? "",
    sectionId: customer?.sectionId ?? "",
    salesPersonId: customer?.salesPersonId ?? "",
    creditDays: String(customer?.creditDays ?? 0),
    creditLimit: numberText(customer?.creditLimit),
    isActive: customer?.isActive ?? true,
    addresses: (customer?.addresses ?? []).map((address) => ({ ...address, key: address.id })),
  };
}

interface CustomerDialogProps {
  open: boolean;
  businessUnitId: string;
  lookups: SetupLookups;
  /** null = new customer. */
  customer: CustomerOption | null;
  onClose: () => void;
  onSaved: (customer: CustomerOption) => void;
}

/** Full customer form. Mount with a `key` per customer so it starts from that record. */
export function CustomerDialog({ open, businessUnitId, lookups, customer, onClose, onSaved }: CustomerDialogProps) {
  const toast = useToast();
  const [values, setValues] = useState<Values>(() => initialValues(customer));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));

  const areaOptions = (kind: AreaKind) => [
    { value: "", label: "None" },
    ...lookups.areas
      .filter((area) => area.kind === kind && area.businessUnitId === businessUnitId)
      .map((area) => ({ value: area.id, label: area.name })),
  ];

  async function save() {
    const body = {
      code: values.code,
      name: values.name,
      customerType: values.customerType,
      customerGroupId: values.customerGroupId || null,
      phone: values.phone,
      email: values.email,
      contactPerson: values.contactPerson,
      binNumber: values.binNumber,
      address: values.address,
      zoneId: values.zoneId || null,
      territoryId: values.territoryId || null,
      routeId: values.routeId || null,
      sectionId: values.sectionId || null,
      salesPersonId: values.salesPersonId || null,
      creditDays: requiredNumber(values.creditDays),
      creditLimit: optionalNumber(values.creditLimit),
      isActive: values.isActive,
      addresses: values.addresses.map(({ id, label, address, isDefault }) => ({ ...(id ? { id } : {}), label, address, isDefault })),
    };
    const parsed = customer ? customerUpdateSchema.safeParse(body) : customerInputSchema.safeParse({ ...body, businessUnitId });
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = customer ? await updateCustomer(customer.id, body) : await createCustomer({ ...body, businessUnitId });
      toast.success(`${saved.name} saved.`);
      onSaved(saved);
    } catch (error) {
      setErrors(apiFieldErrors(error));
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const setAddress = (key: string, patch: Partial<AddressRow>) =>
    set(
      "addresses",
      values.addresses.map((row) =>
        row.key === key ? { ...row, ...patch } : patch.isDefault ? { ...row, isDefault: false } : row,
      ),
    );

  return (
    <Dialog
      open={open}
      size="lg"
      title={customer ? `Edit ${customer.name}` : "New Customer"}
      description={customer ? `Code ${customer.code}` : "Leave the code blank to generate one."}
      onClose={busy ? () => undefined : onClose}
      onSubmit={save}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <FieldGrid>
          <TextField label="Customer Name" required value={values.name} error={errors.name} onChange={(event) => set("name", event.target.value)} />
          <TextField label="Customer Code" value={values.code} error={errors.code} onChange={(event) => set("code", event.target.value)} />
          <SelectField
            label="Customer Type"
            value={values.customerType}
            options={CUSTOMER_TYPES.map((value) => ({ value, label: CUSTOMER_TYPE_LABELS[value] }))}
            onChange={(event) => set("customerType", event.target.value as CustomerType)}
          />
          <SelectField
            label="Customer Group"
            value={values.customerGroupId}
            error={errors.customerGroupId}
            options={[
              { value: "", label: "None" },
              ...lookups.customerGroups
                .filter((group) => group.businessUnitId === businessUnitId)
                .map((group) => ({ value: group.id, label: group.name })),
            ]}
            onChange={(event) => set("customerGroupId", event.target.value)}
          />
          <TextField label="Mobile No." type="tel" value={values.phone} error={errors.phone} onChange={(event) => set("phone", event.target.value)} />
          <TextField label="Email" type="email" value={values.email} error={errors.email} onChange={(event) => set("email", event.target.value)} />
          <TextField
            label="Contact Person"
            value={values.contactPerson}
            error={errors.contactPerson}
            onChange={(event) => set("contactPerson", event.target.value)}
          />
          <TextField label="BIN" value={values.binNumber} error={errors.binNumber} onChange={(event) => set("binNumber", event.target.value)} />
          <TextField
            label="Billing Address"
            className="md:col-span-2"
            value={values.address}
            error={errors.address}
            onChange={(event) => set("address", event.target.value)}
          />
        </FieldGrid>

        <FieldGrid>
          <SelectField label="Zone" value={values.zoneId} error={errors.zoneId} options={areaOptions("ZONE")} onChange={(event) => set("zoneId", event.target.value)} />
          <SelectField
            label="Territory"
            value={values.territoryId}
            error={errors.territoryId}
            options={areaOptions("TERRITORY")}
            onChange={(event) => set("territoryId", event.target.value)}
          />
          <SelectField label="Route" value={values.routeId} error={errors.routeId} options={areaOptions("ROUTE")} onChange={(event) => set("routeId", event.target.value)} />
          <SelectField
            label="Section"
            value={values.sectionId}
            error={errors.sectionId}
            options={areaOptions("SECTION")}
            onChange={(event) => set("sectionId", event.target.value)}
          />
          <SelectField
            label="Sales Force"
            value={values.salesPersonId}
            error={errors.salesPersonId}
            options={[
              { value: "", label: "None" },
              ...lookups.salesPersons
                .filter((person) => person.businessUnitId === businessUnitId)
                .map((person) => ({ value: person.id, label: person.name })),
            ]}
            onChange={(event) => set("salesPersonId", event.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Credit Days"
              type="number"
              min={0}
              max={365}
              value={values.creditDays}
              error={errors.creditDays}
              onChange={(event) => set("creditDays", event.target.value)}
            />
            <TextField
              label="Credit Limit"
              type="number"
              min={0}
              step="any"
              hint="Blank = no limit"
              value={values.creditLimit}
              error={errors.creditLimit}
              onChange={(event) => set("creditLimit", event.target.value)}
            />
          </div>
        </FieldGrid>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Ship-to Addresses</h3>
            <Button
              size="sm"
              onClick={() =>
                set("addresses", [
                  ...values.addresses,
                  { key: crypto.randomUUID(), label: values.addresses.length ? "Address" : "Shop", address: "", isDefault: !values.addresses.length },
                ])
              }
            >
              <Plus aria-hidden="true" />
              Add Address
            </Button>
          </div>
          {errors.addresses && <p className="text-xs text-danger">{errors.addresses}</p>}
          {values.addresses.length === 0 ? (
            <p className="text-xs text-ink-faint">No ship-to addresses. Orders can still type a delivery address.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {values.addresses.map((row, index) => (
                <li key={row.key} className="grid grid-cols-[8rem_1fr_auto_auto] items-start gap-2">
                  <TextField
                    label="Label"
                    value={row.label}
                    error={errors[`addresses.${index}.label`]}
                    onChange={(event) => setAddress(row.key, { label: event.target.value })}
                  />
                  <TextField
                    label="Address"
                    value={row.address}
                    error={errors[`addresses.${index}.address`]}
                    onChange={(event) => setAddress(row.key, { address: event.target.value })}
                  />
                  <label className="mt-6 inline-flex items-center gap-1.5 text-xs text-ink-muted">
                    <Checkbox checked={row.isDefault} onChange={(event) => setAddress(row.key, { isDefault: event.target.checked })} />
                    Default
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-5"
                    aria-label={`Remove address ${index + 1}`}
                    onClick={() => set("addresses", values.addresses.filter((candidate) => candidate.key !== row.key))}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CheckboxField label="Active" hint="Inactive customers cannot be used on new documents." checked={values.isActive} onChange={(event) => set("isActive", event.target.checked)} />
      </div>
    </Dialog>
  );
}
