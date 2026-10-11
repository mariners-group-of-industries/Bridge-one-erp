"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/form-field";
import { FieldGrid } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import type { ZodType } from "zod";
import {
  customerInputSchema,
  itemInputSchema,
  salesPersonInputSchema,
  type CustomerOption,
  type ItemOption,
  type SalesPersonOption,
} from "../schemas/masters.schema";
import { createCustomer, createItem, createSalesPerson } from "../services/masters.api";

type Values = Record<string, string>;

interface FieldSpec {
  name: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "tel";
  hint?: string;
}

interface QuickEntryProps<T> {
  open: boolean;
  businessUnitId: string;
  onClose: () => void;
  onCreated: (record: T) => void;
}

/**
 * ERPNext quick entry: only the essential fields, validated with the same Zod
 * schema as the API. Codes are generated when left blank.
 */
function QuickEntry<T>({
  title,
  fields,
  initial,
  toInput,
  schema,
  create,
  open,
  businessUnitId,
  onClose,
  onCreated,
  description,
}: QuickEntryProps<T> & {
  title: string;
  description?: ReactNode;
  fields: FieldSpec[];
  initial: Values;
  toInput: (values: Values, businessUnitId: string) => unknown;
  schema: ZodType;
  create: (input: never) => Promise<T>;
}) {
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function close() {
    setValues(initial);
    setErrors({});
    onClose();
  }

  async function submit() {
    const input = toInput(values, businessUnitId);
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    setBusy(true);
    try {
      const record = await create(input as never);
      toast.success(`${title.replace("New ", "")} created.`);
      setValues(initial);
      setErrors({});
      onCreated(record);
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([key, messages]) => [key, messages[0]])));
      }
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={busy ? () => undefined : close}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <FieldGrid>
        {fields.map((field) => (
          <TextField
            key={field.name}
            label={field.label}
            required={field.required}
            type={field.type ?? "text"}
            inputMode={field.type === "number" ? "decimal" : undefined}
            step={field.type === "number" ? "any" : undefined}
            hint={field.hint}
            value={values[field.name] ?? ""}
            error={errors[field.name]}
            onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
          />
        ))}
      </FieldGrid>
    </Dialog>
  );
}

const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

export function CustomerQuickEntry(props: QuickEntryProps<CustomerOption> & { salesPersonId?: string | null }) {
  return (
    <QuickEntry<CustomerOption>
      {...props}
      title="New Customer"
      fields={[
        { name: "name", label: "Customer Name", required: true },
        { name: "phone", label: "Mobile No.", type: "tel" },
        { name: "creditDays", label: "Credit Days", type: "number", hint: "Days before an unpaid delivery is overdue." },
        { name: "address", label: "Address" },
        { name: "code", label: "Customer Code", hint: "Leave blank to generate." },
      ]}
      initial={{ creditDays: "0" }}
      toInput={(values, businessUnitId) => ({
        businessUnitId,
        name: values.name ?? "",
        code: values.code,
        phone: values.phone,
        address: values.address,
        creditDays: numberOrNull(values.creditDays ?? "") ?? 0,
        salesPersonId: props.salesPersonId ?? null,
      })}
      schema={customerInputSchema}
      create={createCustomer}
    />
  );
}

export function ItemQuickEntry(props: QuickEntryProps<ItemOption>) {
  return (
    <QuickEntry<ItemOption>
      {...props}
      title="New Item"
      fields={[
        { name: "name", label: "Item Name", required: true },
        { name: "uom", label: "Unit", required: true, hint: "Pcs, Pkt, Kg, Ctn …" },
        { name: "salesRate", label: "Sales Rate", type: "number", required: true },
        { name: "code", label: "Item Code", hint: "Leave blank to generate." },
      ]}
      initial={{ uom: "Pcs", salesRate: "0" }}
      toInput={(values, businessUnitId) => ({
        businessUnitId,
        name: values.name ?? "",
        code: values.code,
        uom: values.uom ?? "",
        salesRate: numberOrNull(values.salesRate ?? "") ?? Number.NaN,
      })}
      schema={itemInputSchema}
      create={createItem}
    />
  );
}

export function SalesPersonQuickEntry(props: QuickEntryProps<SalesPersonOption>) {
  return (
    <QuickEntry<SalesPersonOption>
      {...props}
      title="New Sales Person"
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "designation", label: "Designation", hint: "RSM, ASM, SR …" },
        { name: "phone", label: "Mobile No.", type: "tel" },
        { name: "code", label: "Code", hint: "Leave blank to generate." },
      ]}
      initial={{}}
      toInput={(values, businessUnitId) => ({
        businessUnitId,
        name: values.name ?? "",
        code: values.code,
        designation: values.designation,
        phone: values.phone,
      })}
      schema={salesPersonInputSchema}
      create={createSalesPerson}
    />
  );
}
