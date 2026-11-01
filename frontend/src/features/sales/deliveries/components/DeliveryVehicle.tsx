"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { EmptyState } from "@/features/sales/components/EmptyState";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatQty } from "../../dashboard/lib/format";
import { SearchPick } from "../../components/SearchPick";
import { issuesToErrors, requiredNumber } from "../../lib/form";
import { compartmentInputSchema, vehicleInputSchema, type DriverOption, type VehicleOption } from "../schemas/vehicle.schema";
import { createVehicle, searchDrivers } from "../services/delivery.api";
import type { HeaderValues } from "./DeliveryFormParts";

const UOMS = ["Litre", "KG", "Ton", "PCS", "CTN", "Bag", "Cubic Feet"];

/** Driver (Employee): searches employees of the business unit after 3 letters. */
export function DriverPick({
  businessUnitId,
  selected,
  onChange,
  label = "Driver (Employee)",
  placeholder = "Select/Search Driver(Employee) (min 3 letters)",
  required,
  error,
}: {
  businessUnitId: string | null;
  selected: { id: string; name: string } | null;
  onChange: (driver: DriverOption | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  const [text, setText] = useState("");
  const needle = text.trim();
  const found = useResource(businessUnitId && needle.length >= 3 ? `drivers:${businessUnitId}:${needle}` : null, () => searchDrivers(businessUnitId!, needle));
  const label_ = (driver: { name: string; code?: string }) => (driver.code ? `${driver.name} (${driver.code})` : driver.name);
  const options = [
    ...(selected && !found.data?.some((driver) => driver.id === selected.id) ? [{ id: selected.id, label: label_(selected) }] : []),
    ...(found.data ?? []).map((driver) => ({ id: driver.id, label: label_(driver) })),
  ];
  return (
    <SearchPick
      label={label}
      placeholder={placeholder}
      required={required}
      error={error}
      disabled={!businessUnitId}
      options={options}
      selectedId={selected?.id ?? ""}
      onSearch={setText}
      onPick={(id) => onChange(id ? (found.data?.find((driver) => driver.id === id) ?? (selected ? { id: selected.id, code: "", name: selected.name, mobile: null } : null)) : null)}
    />
  );
}

type VehicleValues = Pick<HeaderValues, "vehicleId" | "vehicleNo" | "driverEmployeeId" | "driverEmployeeName" | "driverName" | "driverPhone" | "securityCode" | "transporterName">;

/** Delivery "Vehicle" card: registered vehicle (or a typed number), driver and security code. */
export function VehicleSection({
  values,
  errors,
  set,
  businessUnitId,
  vehicles,
  onVehicleCreated,
}: {
  values: VehicleValues;
  errors: Record<string, string>;
  set: <K extends keyof HeaderValues>(key: K, value: HeaderValues[K]) => void;
  businessUnitId: string | null;
  vehicles: VehicleOption[];
  onVehicleCreated: (vehicle: VehicleOption) => void;
}) {
  const fieldId = useId();
  const [creating, setCreating] = useState(false);
  const [details, setDetails] = useState(Boolean(values.transporterName));
  const vehicle = vehicles.find((candidate) => candidate.id === values.vehicleId);

  function pickVehicle(next: VehicleOption | undefined) {
    set("vehicleId", next?.id ?? "");
    set("vehicleNo", next?.vehicleNumber ?? "");
    if (!next) return;
    // The vehicle's usual driver, unless one is already chosen.
    if (next.driverEmployeeId && !values.driverEmployeeId) {
      set("driverEmployeeId", next.driverEmployeeId);
      set("driverEmployeeName", next.driverEmployeeName ?? "");
    }
    if (next.driverName && !values.driverName) set("driverName", next.driverName);
    if (next.driverContact && !values.driverPhone) set("driverPhone", next.driverContact);
    if (next.securityCode && !values.securityCode) set("securityCode", next.securityCode);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.2fr]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label htmlFor={`${fieldId}-vehicle`} className="text-xs font-semibold text-ink-muted">
              Vehicle Number
            </label>
            <button type="button" className="text-xs font-medium text-accent-strong hover:underline disabled:text-ink-faint" disabled={!businessUnitId} onClick={() => setCreating(true)}>
              + ADD NEW
            </button>
          </div>
          {vehicles.length > 0 ? (
            <select
              id={`${fieldId}-vehicle`}
              value={values.vehicleId}
              onChange={(event) => pickVehicle(vehicles.find((candidate) => candidate.id === event.target.value))}
              className={cn(CONTROL, "h-8")}
            >
              <option value="">Select a Vehicle Number</option>
              {vehicles.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.vehicleNumber}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${fieldId}-vehicle`}
              placeholder="Vehicle number (or + ADD NEW)"
              value={values.vehicleNo}
              onChange={(event) => set("vehicleNo", event.target.value)}
              className={cn(CONTROL, "h-8", errors.vehicleNo && "ring-1 ring-danger")}
            />
          )}
          {errors.vehicleNo && <p className="text-xs text-danger">{errors.vehicleNo}</p>}
        </div>
        <DriverPick
          businessUnitId={businessUnitId}
          selected={values.driverEmployeeId ? { id: values.driverEmployeeId, name: values.driverEmployeeName } : null}
          onChange={(driver) => {
            set("driverEmployeeId", driver?.id ?? "");
            set("driverEmployeeName", driver?.name ?? "");
            if (driver?.mobile && !values.driverPhone) set("driverPhone", driver.mobile);
          }}
        />
        <TextField label="Driver Name(External)" value={values.driverName} error={errors.driverName} onChange={(event) => set("driverName", event.target.value)} />
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 self-center text-xs">
          <Info label="Vehicle Size" value={vehicle?.vehicleSize} />
          <Info label="Chassis No" value={vehicle?.chassisNumber} />
          <Info label="Vehicle Name" value={vehicle?.vehicleName} />
          <Info label="Service Provider" value={vehicle?.serviceProvider} />
          <Info label="Contact No" value={vehicle?.contactNumber} />
          {vehicle && vehicle.compartments.length > 0 && (
            <Info label="Compartments" value={vehicle.compartments.map((compartment) => `${compartment.compartmentName} ${formatQty(compartment.capacity)} ${compartment.uom}`).join(", ")} />
          )}
        </dl>
        <TextField label="Contact No" type="tel" value={values.driverPhone} error={errors.driverPhone} onChange={(event) => set("driverPhone", event.target.value)} />
        <TextField label="Security Code" value={values.securityCode} error={errors.securityCode} onChange={(event) => set("securityCode", event.target.value)} />
      </div>
      <div className="flex justify-end">
        <button type="button" className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink" aria-expanded={details} onClick={() => setDetails((value) => !value)}>
          View Details {details ? <ChevronUp aria-hidden="true" className="size-3.5" /> : <ChevronDown aria-hidden="true" className="size-3.5" />}
        </button>
      </div>
      {details && (
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
          <TextField label="Transporter" value={values.transporterName} error={errors.transporterName} onChange={(event) => set("transporterName", event.target.value)} />
        </div>
      )}
      {creating && businessUnitId && (
        <VehicleDialog
          businessUnitId={businessUnitId}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            onVehicleCreated(saved);
            pickVehicle(saved);
          }}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-1">
      <dt className="text-ink-muted">{label} :</dt>
      <dd className="text-ink">{value ?? ""}</dd>
    </div>
  );
}

interface CompartmentRow {
  key: string;
  compartmentType: string;
  compartmentName: string;
  capacity: string;
  uom: string;
}

/** Vehicle Create: vehicle, driver and compartment information. */
export function VehicleDialog({ businessUnitId, onClose, onSaved }: { businessUnitId: string; onClose: () => void; onSaved: (vehicle: VehicleOption) => void }) {
  const toast = useToast();
  const listId = useId();
  const [values, setValues] = useState({
    vehicleNumber: "",
    vehicleSize: "",
    chassisNumber: "",
    vehicleName: "",
    serviceProvider: "",
    contactNumber: "",
    isRent: false,
    isCargo: false,
    driverName: "",
    driverContact: "",
    securityCode: "",
  });
  const [driver, setDriver] = useState<{ id: string; name: string } | null>(null);
  const [compartments, setCompartments] = useState<CompartmentRow[]>([]);
  const [draft, setDraft] = useState({ compartmentType: "", compartmentName: "", capacity: "", uom: "" });
  const [draftError, setDraftError] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const field = (key: keyof typeof values) => ({
    value: values[key] as string,
    error: errors[key],
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value })),
  });
  const known = (key: "compartmentType" | "compartmentName") => [...new Set(compartments.map((row) => row[key]))];

  function addCompartment() {
    const parsed = compartmentInputSchema.safeParse({ ...draft, capacity: requiredNumber(draft.capacity) });
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0]?.message);
      return;
    }
    setCompartments((current) => [...current, { key: crypto.randomUUID(), ...draft }]);
    setDraft({ compartmentType: draft.compartmentType, compartmentName: "", capacity: "", uom: draft.uom });
    setDraftError(undefined);
  }

  async function save() {
    if (busy) return;
    const input = {
      businessUnitId,
      ...values,
      driverEmployeeId: driver?.id ?? null,
      compartments: compartments.map((row) => ({
        compartmentType: row.compartmentType,
        compartmentName: row.compartmentName,
        capacity: requiredNumber(row.capacity),
        uom: row.uom,
      })),
    };
    const parsed = vehicleInputSchema.safeParse(input);
    if (!parsed.success) {
      const next = issuesToErrors(parsed.error);
      setErrors(next);
      toast.error(Object.values(next)[0] ?? "Please correct the highlighted fields.");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = await createVehicle(input);
      toast.success(`Vehicle ${saved.vehicleNumber} added.`);
      onSaved(saved);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title="Vehicle Create"
      size="xl"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" className="text-danger" onClick={onClose} disabled={busy}>
            CLOSE
          </Button>
          <Button variant="primary" onClick={save} loading={busy}>
            SAVE
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-semibold text-ink">Vehicle Information</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Vehicle Number" required {...field("vehicleNumber")} />
            <TextField label="Vehicle Size" {...field("vehicleSize")} />
            <TextField label="Chassis Number" {...field("chassisNumber")} />
            <TextField label="Vehicle Name" {...field("vehicleName")} />
            <TextField label="Service Provider" {...field("serviceProvider")} />
            <TextField label="Contact Number" type="tel" {...field("contactNumber")} />
            <div className="flex items-end gap-6 pb-1">
              <CheckboxField label="Is Rent" checked={values.isRent} onChange={(event) => setValues((current) => ({ ...current, isRent: event.target.checked }))} />
              <CheckboxField label="Is Cargo" checked={values.isCargo} onChange={(event) => setValues((current) => ({ ...current, isCargo: event.target.checked }))} />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-semibold text-ink">Driver Information</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DriverPick businessUnitId={businessUnitId} label="Driver" selected={driver} onChange={(next) => {
              setDriver(next ? { id: next.id, name: next.name } : null);
              if (next?.mobile && !values.driverContact) setValues((current) => ({ ...current, driverContact: next.mobile ?? "" }));
            }} />
            <TextField label="Driver Name(External)" {...field("driverName")} />
            <TextField label="Contact Number" type="tel" {...field("driverContact")} />
            <TextField label="Security Code" {...field("securityCode")} />
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-semibold text-ink">Compartment Information</legend>
          <datalist id={`${listId}-type`}>
            {known("compartmentType").map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <datalist id={`${listId}-name`}>
            {known("compartmentName").map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_8rem_8rem_auto]">
            <TextField label="Compartment Type" required list={`${listId}-type`} placeholder="Type or pick" value={draft.compartmentType} onChange={(event) => setDraft({ ...draft, compartmentType: event.target.value })} />
            <TextField label="Compartment Name" required list={`${listId}-name`} placeholder="e.g. Chamber 1" value={draft.compartmentName} onChange={(event) => setDraft({ ...draft, compartmentName: event.target.value })} />
            <TextField label="Capacity" required type="number" min={0} step="any" value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} />
            <SelectField
              label="UOM"
              required
              value={draft.uom}
              options={[{ value: "", label: "Select UOM" }, ...UOMS.map((value) => ({ value, label: value }))]}
              onChange={(event) => setDraft({ ...draft, uom: event.target.value })}
            />
            <Button variant="primary" onClick={addCompartment}>
              <Plus aria-hidden="true" />
              Add Compartment
            </Button>
          </div>
          {(draftError || errors.compartments) && <p role="alert" className="mt-1 text-xs text-danger">{draftError ?? errors.compartments}</p>}
          <div className="mt-3 overflow-x-auto rounded-lg border border-line">
            {compartments.length === 0 ? (
              <EmptyState title="No compartments">Optional: add the vehicle&apos;s chambers or sections.</EmptyState>
            ) : (
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-accent-soft text-xs font-semibold text-ink">
                  <tr>
                    {["SL", "Compartment Type", "Compartment No", "Compartment Name", "Capacity", "UOM", "Action"].map((header) => (
                      <th key={header} scope="col" className="px-2 py-2 text-left">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {compartments.map((row, index) => (
                    <tr key={row.key}>
                      <td className="px-2 py-1.5 tabular-nums">{index + 1}</td>
                      <td className="px-2 py-1.5">{row.compartmentType}</td>
                      <td className="px-2 py-1.5 tabular-nums">{index + 1}</td>
                      <td className="px-2 py-1.5">{row.compartmentName}</td>
                      <td className="px-2 py-1.5 tabular-nums">{formatQty(requiredNumber(row.capacity))}</td>
                      <td className="px-2 py-1.5">{row.uom}</td>
                      <td className="px-2 py-1">
                        <Button variant="ghost" size="icon" aria-label={`Remove compartment ${index + 1}`} onClick={() => setCompartments((current) => current.filter((candidate) => candidate.key !== row.key))}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}
