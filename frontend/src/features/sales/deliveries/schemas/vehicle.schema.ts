import { z } from "zod";
import { optionalPhone, optionalText } from "@/lib/validation/fields";

const optionalId = z.uuid().nullish().transform((value) => value ?? null);
const required = (label: string, max: number) =>
  z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max, `${label} must be at most ${max} characters.`);

export const compartmentInputSchema = z.object({
  compartmentType: required("Compartment type", 60),
  compartmentName: required("Compartment name", 60),
  capacity: z.number({ error: "Capacity must be a number." }).gt(0, "Capacity must be more than 0.").max(999_999_999),
  uom: required("UOM", 20),
});
export type CompartmentInput = z.input<typeof compartmentInputSchema>;

/** Vehicle Create: vehicle, its default driver and compartments. */
export const vehicleInputSchema = z.object({
  businessUnitId: z.uuid({ error: "Select an office first." }),
  vehicleNumber: required("Vehicle number", 40),
  vehicleSize: optionalText("Vehicle size", 50),
  chassisNumber: optionalText("Chassis number", 60),
  vehicleName: optionalText("Vehicle name", 100),
  serviceProvider: optionalText("Service provider", 150),
  contactNumber: optionalPhone("Contact number"),
  isRent: z.boolean(),
  isCargo: z.boolean(),
  driverEmployeeId: optionalId,
  driverName: optionalText("Driver name", 100),
  driverContact: optionalPhone("Driver contact number"),
  securityCode: optionalText("Security code", 40),
  compartments: z.array(compartmentInputSchema).max(50, "At most 50 compartments."),
});
export type VehicleInput = z.input<typeof vehicleInputSchema>;

export const driverQuerySchema = z.object({
  businessUnitId: z.uuid(),
  search: z.string().trim().min(3, "Type at least 3 letters.").max(60),
});

export interface VehicleCompartment {
  compartmentNo: number;
  compartmentType: string;
  compartmentName: string;
  capacity: number;
  uom: string;
}

export interface VehicleOption {
  id: string;
  businessUnitId: string;
  vehicleNumber: string;
  vehicleSize: string | null;
  chassisNumber: string | null;
  vehicleName: string | null;
  serviceProvider: string | null;
  contactNumber: string | null;
  isRent: boolean;
  isCargo: boolean;
  driverEmployeeId: string | null;
  driverEmployeeName: string | null;
  driverName: string | null;
  driverContact: string | null;
  securityCode: string | null;
  compartments: VehicleCompartment[];
}

/** An employee who can drive (Driver (Employee) search). */
export interface DriverOption {
  id: string;
  code: string;
  name: string;
  mobile: string | null;
}
