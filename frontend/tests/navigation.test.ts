import { Settings } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  findWorkspace,
  matchesPattern,
  resolveBreadcrumbs,
  searchEntries,
  workspaceLinks,
  workspaces,
} from "@/lib/navigation/registry";
import { filterEntries } from "@/lib/navigation/search";
import type { Workspace } from "@/lib/navigation/types";

const sales: Workspace = {
  id: "sales",
  label: "Sales",
  icon: Settings,
  href: "/sales",
  description: "Sales module",
  status: "active",
  shortcuts: [{ label: "Customers", href: "/sales/customers", keywords: ["client"] }],
  cards: [{ label: "Masters", links: [{ label: "Customers", href: "/sales/customers" }] }],
  routes: [{ pattern: "/sales/customers/[customerId]", label: "Customer", parent: "/sales/customers" }],
};
const planned: Workspace = { ...sales, id: "hr", label: "HR", href: "/hr", status: "planned" };
const list = [sales, planned];

describe("matchesPattern", () => {
  it("matches dynamic segments of the same depth only", () => {
    expect(matchesPattern("/sales/customers/[customerId]", "/sales/customers/42")).toBe(true);
    expect(matchesPattern("/sales/customers/[customerId]", "/sales/customers")).toBe(false);
    expect(matchesPattern("/sales/customers/[customerId]", "/sales/orders/42")).toBe(false);
  });
});

describe("findWorkspace", () => {
  it("finds the owning active workspace by path prefix", () => {
    expect(findWorkspace("/sales/customers/1", list)?.id).toBe("sales");
    expect(findWorkspace("/salesforce", list)).toBeUndefined();
    expect(findWorkspace("/hr", list)).toBeUndefined();
    expect(findWorkspace("/", list)).toBeUndefined();
  });
});

describe("resolveBreadcrumbs", () => {
  it("builds workspace › list › record crumbs", () => {
    expect(resolveBreadcrumbs("/sales", list)).toEqual([{ label: "Sales", href: "/sales" }]);
    expect(resolveBreadcrumbs("/sales/customers", list)).toEqual([
      { label: "Sales", href: "/sales" },
      { label: "Customers", href: "/sales/customers" },
    ]);
    expect(resolveBreadcrumbs("/sales/customers/7", list)).toEqual([
      { label: "Sales", href: "/sales" },
      { label: "Customers", href: "/sales/customers" },
      { label: "Customer", href: "/sales/customers/7" },
    ]);
    expect(resolveBreadcrumbs("/", list)).toEqual([]);
  });

  it("resolves the real configuration routes", () => {
    expect(resolveBreadcrumbs("/configuration/business-config/offices/abc").map((crumb) => crumb.label)).toEqual([
      "Configuration",
      "Business Units",
      "Office",
    ]);
  });
});

describe("searchEntries / filterEntries", () => {
  it("lists Home, active workspaces and their unique pages", () => {
    const entries = searchEntries(list);
    expect(entries.map((entry) => entry.href)).toEqual(["/", "/sales", "/sales/customers"]);
  });

  it("matches every word against label, group, description and keywords", () => {
    const entries = searchEntries(list);
    expect(filterEntries(entries, "client").map((entry) => entry.label)).toEqual(["Customers"]);
    expect(filterEntries(entries, "sales cust").map((entry) => entry.label)).toEqual(["Customers"]);
    expect(filterEntries(entries, "nothing-matches")).toEqual([]);
    expect(filterEntries(entries, "  ")).toHaveLength(entries.length);
  });

  it("ranks label-prefix matches first", () => {
    const entries = searchEntries(list);
    expect(filterEntries(entries, "sales")[0].label).toBe("Sales");
  });

  it("every registered workspace has a unique id and href", () => {
    expect(new Set(workspaces.map((workspace) => workspace.id)).size).toBe(workspaces.length);
    expect(new Set(workspaces.map((workspace) => workspace.href)).size).toBe(workspaces.length);
  });
});

describe("sales workspace", () => {
  it("lists the sales pages in sidebar order", () => {
    const salesWorkspace = workspaces.find((workspace) => workspace.id === "sales");
    expect(salesWorkspace?.status).toBe("active");
    expect(salesWorkspace && workspaceLinks(salesWorkspace).slice(0, 8).map((link) => link.label)).toEqual([
      "Sales Dashboard",
      "Sales Quotation",
      "Sales Order",
      "Sales Delivery",
      "Sales Return",
      "Sales Collection",
      "Sales Target",
      "Sales Report & Analytics",
    ]);
  });

  it("resolves breadcrumbs for a sales page", () => {
    expect(resolveBreadcrumbs("/sales/orders").map((crumb) => crumb.label)).toEqual(["Sales", "Sales Order"]);
    expect(resolveBreadcrumbs("/sales/reports").map((crumb) => crumb.label)).toEqual(["Sales", "Sales Report & Analytics"]);
  });
});

describe("purchase workspace", () => {
  it("lists purchase pages flat directly under Purchase like Inventory", () => {
    const purchase = workspaces.find((workspace) => workspace.id === "purchase");
    expect(purchase?.status).toBe("active");
    expect(purchase?.cards).toHaveLength(1);
    expect(purchase?.cards?.[0]?.label).toBe("");
    expect(purchase?.cards?.[0]?.links.map((link) => link.label)).toEqual([
      "Purchase Dashboard",
      "Purchase Requisition",
      "Purchase Order",
      "Purchase Receive",
      "Purchase Return",
      "Supplier Payment",
      "Purchase Analytics",
      "Purchase Report",
    ]);
  });
});


describe("pos workspace", () => {
  it("lists POS Dashboard, Setup, and Reports under POS", () => {
    const pos = workspaces.find((workspace) => workspace.id === "pos");
    expect(pos?.status).toBe("active");
    expect(pos?.cards?.[0]?.links.map((link) => link.label)).toEqual([
      "POS Dashboard",
      "Setup",
      "Reports",
    ]);
  });
});
