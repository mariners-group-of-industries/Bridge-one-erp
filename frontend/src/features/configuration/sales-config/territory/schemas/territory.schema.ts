import { z } from "zod";

// Sales Setup (Configuration › Sales Config): the sales territory tree.

/** Default layers created for a business unit the first time the page is used. */
export const DEFAULT_LAYERS = [
  { code: "NAT", name: "National" },
  { code: "REG", name: "Region" },
  { code: "TER", name: "Territory", isTerritory: true },
  { code: "BP", name: "Base Point" },
  { code: "RTE", name: "Route" },
  { code: "MKT", name: "Market" },
] as const;

const code = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Code is required.")
    .max(max, `Code must be ${max} characters or fewer.`)
    .regex(/^[A-Za-z0-9._\-/]+$/, "Use letters, digits, . _ - / only.");
const optionalCode = z
  .string()
  .trim()
  .max(30, "Code must be 30 characters or fewer.")
  .regex(/^[A-Za-z0-9._\-/]*$/, "Use letters, digits, . _ - / only.")
  .optional()
  .default("");
const name = (max: number) => z.string().trim().min(1, "Name is required.").max(max, `Name must be ${max} characters or fewer.`);

export const layerInputSchema = z.object({ code: code(20), name: name(50) });
export const nodeInputSchema = z.object({
  businessUnitId: z.uuid("Select a business unit."),
  /** Empty for a top-layer node. */
  parentId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
  /** Optional: left empty, a code like "REG-001" is made from the layer code. */
  code: optionalCode,
  name: name(100),
});
/** An empty code keeps the current one. */
export const nodeUpdateSchema = z.object({ code: optionalCode, name: name(100) });
export const assignEmployeeSchema = z.object({
  employeeId: z.uuid("Select an employee."),
  distributionChannel: z.string().trim().max(100).optional().default(""),
});
export const assignmentUpdateSchema = z.object({ distributionChannel: z.string().trim().max(100).optional().default("") });

export type LayerInput = z.input<typeof layerInputSchema>;
export type NodeInput = z.input<typeof nodeInputSchema>;
export type NodeUpdate = z.input<typeof nodeUpdateSchema>;
export type AssignEmployeeInput = z.input<typeof assignEmployeeSchema>;
export type AssignmentUpdateInput = z.input<typeof assignmentUpdateSchema>;

export const customerListQuerySchema = z.object({
  businessUnitId: z.uuid(),
  nodeId: z.uuid(),
  customerId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(30),
});

export type TerritoryCustomerQuery = z.output<typeof customerListQuerySchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface LayerDto {
  id: string;
  level: number;
  code: string;
  name: string;
  isTerritory: boolean;
  nodeCount: number;
}

export interface NodeDto {
  id: string;
  layerId: string;
  level: number;
  parentId: string | null;
  code: string;
  name: string;
  employeeCount: number;
  /** Customers of the linked Sales territory (Territory layer only). */
  customerCount: number | null;
}

export interface TerritoryTree {
  businessUnits: { id: string; name: string }[];
  businessUnitId: string;
  layers: LayerDto[];
  nodes: NodeDto[];
}

export interface AssignmentDto {
  id: string;
  employeeId: string;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  distributionChannel: string | null;
}

export interface EmployeeOption {
  id: string;
  code: string;
  name: string;
  designation: string | null;
}

export interface TerritoryCustomerRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
  groupName: string | null;
  creditLimit: string | null;
}

export interface TerritoryCustomerList {
  territory: {
    id: string;
    code: string;
    name: string;
    path: string[];
    employees: { name: string; designation: string | null }[];
  };
  customers: { id: string; code: string; name: string }[];
  rows: TerritoryCustomerRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TerritoryImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

/** Territory Wise Customer List: every territory (or those under `nodeId`), each with its customers. */
export const customerGroupQuerySchema = z.object({
  businessUnitId: z.uuid(),
  /** One Sales territory (the territory customers are linked to). */
  territoryId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
  /** A tree entry: the Sales territories linked below it. */
  nodeId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
  customerId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
  search: z.string().trim().max(100).optional(),
});
export type TerritoryCustomerGroupQuery = z.input<typeof customerGroupQuerySchema>;

export interface TerritoryCustomerGroup {
  /** The Sales territory. */
  id: string;
  /** Code of its Sales Setup tree entry ("" when it is not in the tree). */
  code: string;
  name: string;
  rows: TerritoryCustomerRow[];
  creditTotal: number;
}

export interface TerritoryCustomerGroups {
  /** Every Sales territory of the business unit (for the Territory filter). */
  territories: { id: string; name: string }[];
  groups: TerritoryCustomerGroup[];
  /** Customers of the territories shown (for the Customer filter). */
  customers: { id: string; code: string; name: string }[];
  total: number;
  /** More customers matched than are listed. */
  truncated: boolean;
}
