// TEMPORARY rehearsal: copies the real database (read-only) into an in-process PostgreSQL
// and uses every Production feature there through the real API route handlers.
import pg from "pg";
import { afterAll, beforeAll, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { startTestDb, stopTestDb, testPg } from "./helpers/test-db";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma, resetDb: () => {} };
});
const who: { actor: Record<string, unknown> | null } = { actor: null };
vi.mock("@/lib/audit/record", async (original) => ({ ...(await original<object>()), auditRequest: async () => {} }));
vi.mock("@/lib/auth/actor", async (original) => {
  const real = await original<Record<string, unknown>>();
  const { checkApiAccess } = await import("@/lib/permissions/api-rules");
  const { AppError } = await import("@/lib/api/errors");
  const requireActor = async (request: Request) => {
    const actor = who.actor as { isMaster: boolean; grants: never };
    if (actor.isMaster) return actor;
    const check = checkApiAccess(actor.grants, request.method, new URL(request.url).pathname);
    if (!check.allowed) throw new AppError(403, "FORBIDDEN", `No permission: ${JSON.stringify(check.required)}`);
    return actor;
  };
  return { ...real, requireActor };
});

const SKIP = new Set(["attendance_punches", "audit_logs", "user_sessions", "_prisma_migrations", "permission_audit_logs"]);
const routes = import.meta.glob<Record<string, (request: Request, context: unknown) => Promise<Response>>>("../src/app/api/**/route.ts");
let prisma: PrismaClient;
const out: string[] = [];

async function call(method: string, path: string, opts: { params?: Record<string, string>; query?: Record<string, string>; body?: unknown } = {}) {
  const mod = await routes[`../src/app/api/${path}/route.ts`]();
  let url = `http://localhost/api/${path}`;
  for (const [key, value] of Object.entries(opts.params ?? {})) url = url.replace(`[${key}]`, value);
  const qs = new URLSearchParams(opts.query ?? {}).toString();
  const response = await mod[method](new Request(`${url}${qs ? `?${qs}` : ""}`, { method, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }), { params: Promise.resolve(opts.params ?? {}) });
  if (response.status === 204) return undefined as never;
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("json")) {
    const bytes = (await response.arrayBuffer()).byteLength;
    if (!response.ok || bytes < 400) throw new Error(`${response.status} ${type} ${bytes} bytes`);
    return { bytes } as never;
  }
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body.error).slice(0, 460)}`);
  return body.data;
}
async function step<T>(name: string, run: () => Promise<T>, expectFail = false): Promise<T | undefined> {
  try {
    const value = await run();
    out.push(`${expectFail ? "BUG  (should be refused)" : "PASS"} | ${name}`);
    return value;
  } catch (error) {
    out.push(`${expectFail ? "PASS (refused)" : "FAIL"} | ${name} | ${(error instanceof Error ? error.message : String(error)).slice(0, 460)}`);
    return undefined;
  }
}
const note = (text: string) => out.push(`NOTE | ${text}`);
const eq = (name: string, actual: unknown, expected: unknown) => out.push(`${JSON.stringify(actual) === JSON.stringify(expected) ? "PASS" : "FAIL"} | ${name} | got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
const r3 = (value: number) => Math.round(value * 1000) / 1000;

beforeAll(async () => {
  prisma = await startTestDb();
  process.loadEnvFile(".env");
  const url = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL!);
  url.searchParams.set("options", "-c default_transaction_read_only=on");
  const source = new pg.Client({ connectionString: url.toString() });
  await source.connect();
  const lite = testPg();
  const tables = (await source.query(`select tablename from pg_tables where schemaname='public' order by 1`)).rows.map((row) => row.tablename as string).filter((name) => !SKIP.has(name) && !name.startsWith("connect_"));
  await lite.exec(`SET session_replication_role = replica`);
  for (const table of tables) await lite.exec(`delete from "${table}"`).catch(() => {});
  for (const table of tables) {
    const { rows } = await source.query(`select coalesce(json_agg(t), '[]')::text as data, count(*)::int as n from "${table}" t`);
    if (rows[0].n) await lite.query(`insert into "${table}" select * from json_populate_recordset(null::"${table}", $1::json) on conflict do nothing`, [rows[0].data]).catch((error) => out.push(`NOTE | copy of ${table} failed: ${String(error).slice(0, 120)}`));
  }
  await lite.exec(`SET session_replication_role = DEFAULT`);
  await source.end();
}, 600_000);

afterAll(async () => {
  (await import("node:fs")).writeFileSync("node_modules/.cache/production-results.txt", out.join("\n"));
  await stopTestDb();
});

it("production rehearsal", async () => {
  try {
    await body();
  } catch (error) {
    out.push("CRASH | " + (error as Error).stack?.slice(0, 900));
  }
}, 900_000);

async function body() {
  const today = "2026-11-16";
  const { resolveGrants } = await import("@/lib/permissions/resolve");
  const { grantsAllow, FULL_ACCESS } = await import("@/lib/permissions/registry");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, isMaster: true, erpAccess: true, permissionGroups: { select: { group: { select: { name: true, status: true, fullAccess: true, entries: true } } } }, permissionOverrides: { select: { activityKey: true, action: true, effect: true } } } });
  const actorOf = (user: (typeof users)[number]) => ({ id: user.id, name: user.name, role: "STAFF", isMaster: user.isMaster, permissions: new Set(), companyScope: "ALL", via: "session", grants: user.isMaster ? FULL_ACCESS : resolveGrants(user.permissionGroups.map((g) => g.group) as never, user.permissionOverrides as never) });
  const master = users.find((user) => user.isMaster)!;
  who.actor = actorOf(master);

  // ── Who may use Production ──
  out.push("== Production permissions per user (v=view c=create e=edit d=delete a=approve) ==");
  const pages = ["/production/dashboard", "/production/work-centers", "/production/bill-of-materials", "/production/orders", "/production/entries", "/production/reports"];
  for (const user of users) {
    if (user.isMaster || !user.erpAccess) continue;
    const grants = actorOf(user).grants;
    const cells = pages.map((page) => `${page.replace("/production/", "")}:${(["view", "create", "edit", "delete", "approve"] as const).map((action) => (grantsAllow(grants, page, action) ? action[0] : "-")).join("")}`);
    if (cells.some((cell) => /[vceda]$|:[vceda]/.test(cell.split(":")[1]))) out.push(`${user.name} [${user.permissionGroups.map((g) => g.group.name).join(", ") || "no group"}]: ${cells.join(" ")}`);
  }
  const pipeline = await prisma.approvalPipeline.findFirst({ where: { feature: "Production Order" }, include: { stages: { orderBy: { stageNo: "asc" }, include: { approvers: { include: { employee: { select: { name: true, userId: true } }, user: { select: { name: true } } } } } } } });
  for (const stage of pipeline?.stages ?? []) {
    out.push(`Production Order approval stage ${stage.stageNo} [${stage.approvalOrder}]: ${stage.approvers.map((a) => { const userId = a.userType === "EMPLOYEE" ? a.employee?.userId : a.userId; const user = users.find((u) => u.id === userId); return `${a.employee?.name ?? a.user?.name}${!userId ? " (NO LOGIN)" : user && !grantsAllow(actorOf(user).grants, "/production/orders", "approve") && !user.isMaster ? " (NO approve PERMISSION)" : ""}`; }).join("; ") || "NO APPROVERS"}`);
  }
  if (!pipeline) note("no approval pipeline for Production Order");

  // ── Real data as it is ──
  out.push("== Existing real data ==");
  const wcLookups = await step("Work Center: lookups", () => call("GET", "production/work-centers/lookups"));
  const bu = (wcLookups.departments.find((d: { name: string }) => d.name === "Production") ?? wcLookups.departments[0]).businessUnitId as string;
  note(`business units in lookups: ${JSON.stringify(wcLookups.businessUnits)}; in db: ${JSON.stringify(await prisma.businessUnit.findMany({ select: { id: true, name: true } }))}; Production dept rows: ${JSON.stringify(await prisma.productionDepartment.findMany({ where: { name: "Production" }, select: { id: true, businessUnitId: true } }))}`);
  note(`work center lookups: types ${wcLookups.types.length}, departments ${wcLookups.departments.length}, sections ${wcLookups.sections.length}, warehouses ${wcLookups.warehouses.length}`);
  const wcList = (await step("Work Center: list", () => call("GET", "production/work-centers"))) ?? [];
  note(`work centers: ${(wcList.rows ?? wcList).length}`);
  const bomList = (await step("BOM: list (active)", () => call("GET", "production/bill-of-materials", { query: { status: "ACTIVE" } }))) ?? [];
  const realBoms = (bomList.rows ?? bomList) as { id: string; name: string }[];
  note(`real BOMs: ${realBoms.length}`);
  const orderLookups = await step("Order: lookups", () => call("GET", "production/orders/lookups"));
  note(`order lookups: offices ${orderLookups.offices.length}, warehouses ${orderLookups.warehouses.length}, workCenters ${orderLookups.workCenters.length}, producible items ${orderLookups.items.length}, boms ${orderLookups.boms.length}, canApprove ${orderLookups.canApprove}`);
  note(`producible item sample: ${JSON.stringify(orderLookups.items[0]).slice(0, 300)}`);

  // Every real BOM: open it, and preview an order of 100 for its first output.
  let bomFail = 0;
  let noStock = 0;
  let zeroRate = 0;
  let previewShape = "";
  const warehouse0 = orderLookups.warehouses[0];
  for (const row of realBoms) {
    try {
      const bom = await call("GET", "production/bill-of-materials/[bomId]", { params: { bomId: row.id } });
      const output = bom.outputs[0];
      if (bom.materials.some((line: { rate: number }) => !(line.rate > 0))) zeroRate++;
      const preview = await call("GET", "production/orders/preview", { query: { bomId: row.id, itemId: output.itemId, quantity: "100", warehouseId: warehouse0.id } });
      if (!previewShape) previewShape = JSON.stringify(preview).slice(0, 400);
      if ((preview.materials ?? []).some((line: { stock?: number; requiredQty?: number; required?: number }) => (line.stock ?? 0) < (line.requiredQty ?? line.required ?? 0))) noStock++;
    } catch (error) {
      bomFail++;
      if (bomFail <= 5) out.push(`FAIL | real BOM "${row.name}" | ${(error as Error).message.slice(0, 300)}`);
    }
  }
  out.push(`${bomFail ? "FAIL" : "PASS"} | all ${realBoms.length} real BOMs open and preview (${bomFail} failed)`);
  note(`real BOMs with a material at rate 0: ${zeroRate}; BOMs short of material stock in ${warehouse0.name} for 100 units: ${noStock}`);
  note(`preview shape: ${previewShape}`);
  const stockByWh = await prisma.stockEntry.groupBy({ by: ["warehouseId"], _sum: { qty: true }, _count: true });
  const whName = new Map((orderLookups.warehouses as { id: string; name: string }[]).map((w) => [w.id, w.name]));
  note(`stock entries per warehouse: ${stockByWh.map((row) => `${whName.get(row.warehouseId) ?? row.warehouseId}: ${row._count} entries, qty ${row._sum.qty}`).join(" | ")}`);
  await step("Order: list", () => call("GET", "production/orders"));
  await step("Entry: list", () => call("GET", "production/entries"));
  await step("Entry: approved orders queue", () => call("GET", "production/entries/approved-orders"));
  await step("Dashboard: this year", () => call("GET", "production/dashboard", { query: { from: "2026-01-01", to: "2026-12-31" } }));

  // ── Work Center ──
  out.push("== Work Center ==");
  const type = await step("Work Center: ADD NEW type", () => call("POST", "production/work-centers/masters/[kind]", { params: { kind: "types" }, body: { name: "Rehearsal Line", businessUnitId: bu } }));
  await step("Work Center: duplicate type is refused", () => call("POST", "production/work-centers/masters/[kind]", { params: { kind: "types" }, body: { name: "Rehearsal Line", businessUnitId: bu } }), true);
  const dept = wcLookups.departments.find((d: { name: string }) => d.name === "Production") ?? wcLookups.departments[0];
  const section = await step("Work Center: ADD NEW department section", () => call("POST", "production/work-centers/masters/[kind]", { params: { kind: "sections" }, body: { name: "Rehearsal Section", departmentId: dept.id } }));
  const newDept = await step("Work Center: ADD NEW department", () => call("POST", "production/work-centers/masters/[kind]", { params: { kind: "departments" }, body: { name: "Rehearsal Dept", businessUnitId: bu } }));
  const operators = (await step("Work Center: operator dropdown (empty search)", () => call("GET", "production/work-centers/operators", { query: { search: "" } }))) ?? [];
  const opSearch = (await step("Work Center: operator search 'moh'", () => call("GET", "production/work-centers/operators", { query: { search: "moh" } }))) ?? [];
  note(`operators: ${operators.length} listed, ${opSearch.length} match 'moh'; sample ${JSON.stringify(operators[0]).slice(0, 200)}`);
  await step("Work Center: operator search with 2 letters is refused", () => call("GET", "production/work-centers/operators", { query: { search: "mo" } }), true);
  const wcBody = { businessUnitId: bu, name: "Rehearsal Machine 1", typeId: type?.id ?? wcLookups.types[0].id, code: "RH-01", standardRunHour: 8, capacityPerHour: 100, ratedCapacityPerHour: 120, costPerHour: 500, remarks: "test", departmentId: dept.id, departmentSectionId: section?.id ?? null, warehouseIds: [wcLookups.warehouses[0].id], operatorIds: operators.slice(0, 2).map((o: { employeeId: string }) => o.employeeId) };
  let wc = await step("Work Center: create", () => call("POST", "production/work-centers", { body: wcBody }));
  await step("Work Center: same code again is refused", () => call("POST", "production/work-centers", { body: { ...wcBody, name: "Other" } }), true);
  await step("Work Center: section of another department is refused", () => call("POST", "production/work-centers", { body: { ...wcBody, code: "RH-02", departmentId: newDept?.id, departmentSectionId: section?.id } }), true);
  await step("Work Center: run hour 25 is refused", () => call("POST", "production/work-centers", { body: { ...wcBody, code: "RH-03", standardRunHour: 25 } }), true);
  if (wc) {
    note(`work center: ${JSON.stringify(wc).slice(0, 350)}`);
    const got = await step("Work Center: open", () => call("GET", "production/work-centers/[workCenterId]", { params: { workCenterId: wc.id } }));
    eq("Work Center: operators saved", got?.operators?.length ?? got?.operatorIds?.length, 2);
    wc = (await step("Work Center: edit (capacity 150, 1 operator)", () => call("PUT", "production/work-centers/[workCenterId]", { params: { workCenterId: wc.id }, body: { version: wc.updatedAt, data: { ...wcBody, capacityPerHour: 150, operatorIds: wcBody.operatorIds.slice(0, 1) } } }))) ?? wc;
    await step("Work Center: stale edit is refused", () => call("PUT", "production/work-centers/[workCenterId]", { params: { workCenterId: wc.id }, body: { version: "2020-01-01T00:00:00.000Z", data: wcBody } }), true);
    const off = await step("Work Center: deactivate", () => call("PUT", "production/work-centers/[workCenterId]/status", { params: { workCenterId: wc.id }, body: { version: wc.updatedAt, isActive: false } }));
    wc = (await step("Work Center: activate again", () => call("PUT", "production/work-centers/[workCenterId]/status", { params: { workCenterId: wc.id }, body: { version: off?.updatedAt, isActive: true } }))) ?? wc;
    await step("Work Center: filter by department", () => call("GET", "production/work-centers", { query: { departmentId: dept.id } }));
    await step("Work Center: Excel export", () => call("GET", "production/work-centers/export"));
  }

  // ── Bill Of Material ──
  out.push("== Bill Of Material ==");
  const bomLookups = await step("BOM: lookups", () => call("GET", "production/bill-of-materials/lookups"));
  note(`bom lookups: accounts ${bomLookups.accounts.length}, departments ${bomLookups.departments.length}, sections ${bomLookups.sections.length}, categories ${bomLookups.categories.length}, items ${bomLookups.items.length}; item sample ${JSON.stringify(bomLookups.items[0]).slice(0, 260)}`);
  const typeCounts: Record<string, number> = {};
  for (const item of bomLookups.items) typeCounts[item.itemType ?? "(no type)"] = (typeCounts[item.itemType ?? "(no type)"] ?? 0) + 1;
  note(`bom item types: ${JSON.stringify(typeCounts)}`);
  const usedOutputs = new Set((await prisma.productionBomOutput.findMany({ select: { itemId: true } })).map((row) => row.itemId));
  const fgs = bomLookups.items.filter((item: { itemType: string | null; id: string }) => item.itemType === "Finished Goods" && !usedOutputs.has(item.id));
  const raws = bomLookups.items.filter((item: { itemType: string | null }) => item.itemType === "Raw Material");
  const packs = bomLookups.items.filter((item: { itemType: string | null }) => item.itemType === "Packaging Material");
  const [fg1, fg2, fg3] = fgs;
  const [rm1, rm2] = raws;
  const pm1 = packs[0];
  note(`finished goods without a BOM yet: ${fgs.length}; using ${fg1?.name} / ${fg2?.name}; materials ${rm1?.name}, ${rm2?.name}, ${pm1?.name}`);
  // 100 units per lot: rm1 80 (+25% wastage → 100) at 20, rm2 10 at 150, pm1 100 at 2 → 2000 + 1500 + 200 = 3700 per lot
  const bomBody = {
    businessUnitId: bu, name: "Rehearsal BOM A", bomType: "SINGLE_OUTPUT", remarks: "test",
    outputs: [{ itemId: fg1.id, outputType: "FINISHED_GOODS", netWeight: 1, lotSizeQty: 100, costPercent: 100, tolerancePercent: 5 }],
    materials: [
      { itemId: rm1.id, materialType: "Raw Material", qty: 80, wastagePercent: 20, rate: 20, excludeFromScrap: false },
      { itemId: rm2.id, materialType: "Raw Material", qty: 10, wastagePercent: 0, rate: 150, excludeFromScrap: false },
      { itemId: pm1.id, materialType: "Packaging Material", qty: 100, wastagePercent: 0, rate: 2, excludeFromScrap: true },
    ],
    wastages: [{ itemId: raws[2].id, itemType: "Raw Material", outputType: "SCRAP", ratioPercent: 2, isMandatory: false }],
    overheads: [{ accountId: bomLookups.accounts[0].id, percentage: 10, amount: 0 }, { accountId: bomLookups.accounts[1].id, amount: 250 }],
  };
  let bomA = await step("BOM: create single output", () => call("POST", "production/bill-of-materials", { body: bomBody }));
  if (bomA) note(`bom A: ${JSON.stringify({ ...bomA, outputs: undefined, materials: bomA.materials?.slice(0, 1), wastages: undefined, overheads: bomA.overheads }).slice(0, 700)}`);
  await step("BOM: same name again is refused", () => call("POST", "production/bill-of-materials", { body: { ...bomBody, outputs: [{ ...bomBody.outputs[0], itemId: fg3.id }] } }), true);
  await step("BOM: cost % not 100 is refused", () => call("POST", "production/bill-of-materials", { body: { ...bomBody, name: "X1", outputs: [{ ...bomBody.outputs[0], itemId: fg3.id, costPercent: 60 }] } }), true);
  await step("BOM: no material is refused", () => call("POST", "production/bill-of-materials", { body: { ...bomBody, name: "X2", outputs: [{ ...bomBody.outputs[0], itemId: fg3.id }], materials: [] } }), true);
  await step("BOM: output as its own material is refused", () => call("POST", "production/bill-of-materials", { body: { ...bomBody, name: "X3", outputs: [{ ...bomBody.outputs[0], itemId: fg3.id }], materials: [{ ...bomBody.materials[0], itemId: fg3.id }] } }), true);
  await step("BOM: multiple output without department is refused", () => call("POST", "production/bill-of-materials", { body: { ...bomBody, name: "X4", bomType: "MULTIPLE_OUTPUT", outputs: [{ ...bomBody.outputs[0], itemId: fg2.id, costPercent: 50 }, { ...bomBody.outputs[0], itemId: fg3.id, costPercent: 50 }] } }), true);
  const bomM = await step("BOM: create multiple output (60/40)", () => call("POST", "production/bill-of-materials", { body: { ...bomBody, name: "Rehearsal BOM Multi", bomType: "MULTIPLE_OUTPUT", departmentId: dept.id, departmentSectionId: section?.id ?? wcLookups.sections[0].id, outputs: [{ ...bomBody.outputs[0], itemId: fg2.id, costPercent: 60, isPrimary: true }, { ...bomBody.outputs[0], itemId: fg3.id, costPercent: 40 }], wastages: [], overheads: [] } }));
  if (bomA) {
    bomA = (await step("BOM: edit (rm2 qty 10 → 12)", () => call("PUT", "production/bill-of-materials/[bomId]", { params: { bomId: bomA.id }, body: { version: bomA.updatedAt, data: { ...bomBody, materials: [bomBody.materials[0], { ...bomBody.materials[1], qty: 12 }, bomBody.materials[2]] } } }))) ?? bomA;
    bomA = (await step("BOM: edit back", () => call("PUT", "production/bill-of-materials/[bomId]", { params: { bomId: bomA.id }, body: { version: bomA.updatedAt, data: bomBody } }))) ?? bomA;
    await step("BOM: PDF", () => call("GET", "production/bill-of-materials/[bomId]/pdf", { params: { bomId: bomA.id } }));
    await step("BOM: Excel export", () => call("GET", "production/bill-of-materials/export", { query: { status: "ACTIVE" } }));
    await step("BOM: search list", () => call("GET", "production/bill-of-materials", { query: { search: "Rehearsal" } }));
    const options = await step("BOM: child BOM options", () => call("GET", "production/bill-of-materials/options", { query: { search: "", exclude: bomA.id } }));
    note(`child options: ${options?.length}`);
    if (bomM) {
      const tagged = await step("BOM: tag child BOM", () => call("PUT", "production/bill-of-materials/[bomId]/children", { params: { bomId: bomA.id }, body: { links: [{ childBomId: bomM.id, stage: "Stage 1" }] } }));
      await step("BOM: tag itself as child is refused", () => call("PUT", "production/bill-of-materials/[bomId]/children", { params: { bomId: bomA.id }, body: { links: [{ childBomId: bomA.id, stage: "S" }] } }), true);
      const freshM = await call("GET", "production/bill-of-materials/[bomId]", { params: { bomId: bomM.id } });
      await step("BOM: delete a BOM used as a child is refused", () => call("DELETE", "production/bill-of-materials/[bomId]", { params: { bomId: bomM.id }, body: { version: freshM.updatedAt } }), true);
      await step("BOM: remove child tags", () => call("PUT", "production/bill-of-materials/[bomId]/children", { params: { bomId: bomA.id }, body: { links: [] } }));
      void tagged;
    }
    bomA = await call("GET", "production/bill-of-materials/[bomId]", { params: { bomId: bomA.id } });
    const inactive = await step("BOM: deactivate", () => call("PUT", "production/bill-of-materials/[bomId]/status", { params: { bomId: bomA.id }, body: { version: bomA.updatedAt, isActive: false } }));
    await step("BOM: order on an inactive BOM is refused", () => call("POST", "production/orders", { body: { orderDate: today, productionDate: today, itemId: fg1.id, bomId: bomA.id, quantity: 10, officeId: orderLookups.offices[0].id, warehouseId: warehouse0.id } }), true);
    bomA = (await step("BOM: activate again", () => call("PUT", "production/bill-of-materials/[bomId]/status", { params: { bomId: bomA.id }, body: { version: inactive?.updatedAt, isActive: true } }))) ?? bomA;
  }
  const bomDel = await step("BOM: create then delete", () => call("POST", "production/bill-of-materials", { body: { ...bomBody, name: "Rehearsal BOM Del", outputs: [{ ...bomBody.outputs[0], itemId: fgs[3].id }], wastages: [], overheads: [] } }));
  if (bomDel) await step("BOM: delete", () => call("DELETE", "production/bill-of-materials/[bomId]", { params: { bomId: bomDel.id }, body: { version: bomDel.updatedAt } }));

  // ── Production Order ──
  out.push("== Production Order ==");
  const rmWh = (orderLookups.warehouses as { id: string; name: string; officeId: string }[]).find((w) => /rm|raw/i.test(w.name)) ?? warehouse0;
  const office = orderLookups.offices.find((o: { id: string }) => o.id === rmWh.officeId) ?? orderLookups.offices[0];
  const fgWh = (orderLookups.warehouses as { id: string; name: string; officeId: string }[]).find((w) => w.officeId === office.id && /fg|finish/i.test(w.name)) ?? (orderLookups.warehouses as { id: string; name: string; officeId: string }[]).find((w) => w.officeId === office.id && w.id !== rmWh.id) ?? rmWh;
  note(`office ${office.name}; material warehouse ${rmWh.name}; output warehouse ${fgWh.name}; warehouses of this office: ${(orderLookups.warehouses as { name: string; officeId: string }[]).filter((w) => w.officeId === office.id).map((w) => w.name).join(", ")}`);
  const stockOf = async (warehouseId: string, itemId: string) => ((await call("GET", "sales/stock", { query: { warehouseId, itemIds: itemId } })) as { qty: number }[])[0]?.qty ?? 0;
  const customers = (await step("Order: customer dropdown", () => call("GET", "production/orders/customers", { query: { search: "" } }))) ?? [];
  const custSearch = await step("Order: customer search 'ent'", () => call("GET", "production/orders/customers", { query: { search: "ent" } }));
  note(`customers: ${customers.length} listed, ${custSearch?.length} match 'ent'`);
  const soCustomer = await prisma.salesOrder.findFirst({ where: { status: "APPROVED" }, select: { customerId: true, id: true, number: true } });
  const sos = soCustomer ? await step("Order: sales orders of a customer", () => call("GET", "production/orders/customers/[customerId]/sales-orders", { params: { customerId: soCustomer.customerId } })) : undefined;
  note(`sales orders of customer: ${String(JSON.stringify(sos)).slice(0, 250)}`);
  const preview = bomA ? await step("Order: preview 200 of BOM A", () => call("GET", "production/orders/preview", { query: { bomId: bomA.id, itemId: fg1.id, quantity: "200", warehouseId: rmWh.id } })) : undefined;
  note(`preview: ${String(JSON.stringify(preview)).slice(0, 600)}`);
  const oBody = { orderDate: today, productionDate: "2026-11-17", customerId: soCustomer?.customerId ?? null, salesOrderId: sos?.[0]?.id ?? null, customerPoNo: "PO-77", itemId: fg1.id, bomId: bomA?.id, quantity: 200, officeId: office.id, warehouseId: rmWh.id, workCenterId: wc?.id ?? null, machineName: "M-1", narration: "rehearsal" };
  await step("Order: production date before order date is refused", () => call("POST", "production/orders", { body: { ...oBody, productionDate: "2026-11-01" } }), true);
  await step("Order: item not in the BOM is refused", () => call("POST", "production/orders", { body: { ...oBody, itemId: fg2.id } }), true);
  await step("Order: quantity 0 is refused", () => call("POST", "production/orders", { body: { ...oBody, quantity: 0 } }), true);
  let order = await step("Order: create (200 units, linked to a sales order)", () => call("POST", "production/orders", { body: oBody }));
  if (order) {
    note(`order: ${JSON.stringify({ ...order, materials: order.materials?.slice(0, 3), approvals: order.approvals }).slice(0, 900)}`);
    order = (await step("Order: edit (quantity 300)", () => call("PUT", "production/orders/[orderId]", { params: { orderId: order.id }, body: { version: order.updatedAt, data: { ...oBody, quantity: 300 } } }))) ?? order;
    order = (await step("Order: edit back (200)", () => call("PUT", "production/orders/[orderId]", { params: { orderId: order.id }, body: { version: order.updatedAt, data: oBody } }))) ?? order;
    await step("Order: PDF", () => call("GET", "production/orders/[orderId]/pdf", { params: { orderId: order.id } }));
    await step("Order: entry before approval is refused", () => call("GET", "production/entries/form", { query: { orderId: order.id } }), true);
    await step("Order: start before approval is refused", () => call("POST", "production/orders/[orderId]/actions", { params: { orderId: order.id }, body: { version: order.updatedAt, action: "start" } }), true);
    for (let i = 0; i < 6 && order.status === "PENDING_APPROVAL"; i++) {
      const next = await step(`Order: approve (click ${i + 1})`, () => call("POST", "production/orders/[orderId]/actions", { params: { orderId: order.id }, body: { version: order.updatedAt, action: "approve", comment: "ok" } }));
      if (!next) break;
      order = next;
    }
    eq("Order: approved", order.status, "APPROVED");
    await step("Order: edit after approval is refused", () => call("PUT", "production/orders/[orderId]", { params: { orderId: order.id }, body: { version: order.updatedAt, data: oBody } }), true);
    await step("Order: list filters", async () => { await call("GET", "production/orders", { query: { status: "APPROVED", from: "2026-11-01", to: "2026-11-30" } }); await call("GET", "production/orders", { query: { search: order.number } }); await call("GET", "production/orders", { query: { status: "IN_REVIEW" } }); });
  }
  const o2 = await step("Order: second order → reject", () => call("POST", "production/orders", { body: { ...oBody, customerId: null, salesOrderId: null, quantity: 50 } }));
  if (o2) {
    await step("Order: reject without reason is refused", () => call("POST", "production/orders/[orderId]/actions", { params: { orderId: o2.id }, body: { version: o2.updatedAt, action: "reject" } }), true);
    const rejected = await step("Order: reject", () => call("POST", "production/orders/[orderId]/actions", { params: { orderId: o2.id }, body: { version: o2.updatedAt, action: "reject", comment: "No material" } }));
    note(`rejected order status: ${rejected?.status}`);
    if (rejected) await step("Order: edit a rejected order (re-submit)", () => call("PUT", "production/orders/[orderId]", { params: { orderId: o2.id }, body: { version: rejected.updatedAt, data: { ...oBody, customerId: null, salesOrderId: null, quantity: 60 } } }));
  }
  const o3 = await step("Order: third order → cancel", () => call("POST", "production/orders", { body: { ...oBody, customerId: null, salesOrderId: null, quantity: 10 } }));
  if (o3) await step("Order: cancel", () => call("POST", "production/orders/[orderId]/actions", { params: { orderId: o3.id }, body: { version: o3.updatedAt, action: "cancel", comment: "Plan changed" } }));

  // ── Production Entry ──
  out.push("== Production Entry ==");
  if (order?.status === "APPROVED") {
    const queue = await step("Entry: queue shows the approved order", () => call("GET", "production/entries/approved-orders", { query: { search: order.number } }));
    eq("Entry: queue remaining", queue?.[0]?.remainingQty, 200);
    let form = await step("Entry: open form", () => call("GET", "production/entries/form", { query: { orderId: order.id } }));
    note(`entry form materials: ${JSON.stringify(form?.materials).slice(0, 500)}`);
    note(`entry form: workCenters ${form?.workCenters.length}, departments ${form?.departments.length}, sections ${form?.sections.length}, warehouses ${form?.warehouses.length}`);
    // 120 units: rm1 120, rm2 12, pm1 120
    const eBody = { orderId: order.id, entryDate: today, shift: "Morning", workCenterId: wc?.id ?? null, departmentId: dept.id, departmentSectionId: section?.id ?? null, outputWarehouseId: fgWh.id, totalQty: 120, rejectQty: 20, hours: 6, remarks: "first shift", materials: [{ itemId: rm1.id, actualQty: 125, wastageQty: 3, scrapQty: 2 }, { itemId: rm2.id, actualQty: 12 }, { itemId: pm1.id, actualQty: 120 }] };
    const short = await step("Entry: without material stock is refused", () => call("POST", "production/entries", { body: eBody }), true);
    void short;
    for (const [itemId, qty] of [[rm1.id, 1000], [rm2.id, 100], [pm1.id, 1000]] as const) await call("POST", "sales/stock", { body: { warehouseId: rmWh.id, itemId, qty, source: "OPENING", postingDate: "2026-11-01" } });
    const before = { rm1: await stockOf(rmWh.id, rm1.id), rm2: await stockOf(rmWh.id, rm2.id), pm1: await stockOf(rmWh.id, pm1.id), fg: await stockOf(fgWh.id, fg1.id) };
    form = await call("GET", "production/entries/form", { query: { orderId: order.id } });
    eq("Entry: form shows stock after receipt", form.materials.map((line: { stock: number }) => line.stock), [before.rm1, before.rm2, before.pm1]);
    eq("Entry: form standard per unit", form.materials.map((line: { perUnit: number }) => line.perUnit), [0.96, 0.1, 1]);
    await step("Entry: reject more than total is refused", () => call("POST", "production/entries", { body: { ...eBody, rejectQty: 200 } }), true);
    await step("Entry: wastage above consumed is refused", () => call("POST", "production/entries", { body: { ...eBody, materials: [{ itemId: rm1.id, actualQty: 10, wastageQty: 30 }, eBody.materials[1], eBody.materials[2]] } }), true);
    await step("Entry: 25 machine hours is refused", () => call("POST", "production/entries", { body: { ...eBody, hours: 25 } }), true);
    await step("Entry: entry date before order date is refused", () => call("POST", "production/entries", { body: { ...eBody, entryDate: "2026-11-01" } }), true);
    const entry = await step("Entry: post (120 produced, 20 rejected)", () => call("POST", "production/entries", { body: eBody }));
    if (entry) {
      note(`entry: ${JSON.stringify({ ...entry, materials: entry.materials?.slice(0, 1) }).slice(0, 900)}`);
      eq("Entry: net good quantity", entry.netQty, 100);
      // standard for 120: 120*20 + 12*150 + 120*2 = 2400+1800+240 = 4440 ; actual 125*20 + 1800 + 240 = 4540
      eq("Entry: standard / actual material cost", [entry.standardCost, entry.actualCost, entry.variance], [4344, 4540, 196]);
      eq("Entry: material stock consumed", [r3(before.rm1 - (await stockOf(rmWh.id, rm1.id))), r3(before.rm2 - (await stockOf(rmWh.id, rm2.id))), r3(before.pm1 - (await stockOf(rmWh.id, pm1.id)))], [125, 12, 120]);
      eq("Entry: good output added to the finished goods warehouse", r3((await stockOf(fgWh.id, fg1.id)) - before.fg), 100);
      const after = await call("GET", "production/orders/[orderId]", { params: { orderId: order.id } });
      note(`order after first entry: status ${after.status}, produced ${after.producedQty ?? after.completedQty}, remaining ${after.remainingQty}`);
      await step("Entry: PDF", () => call("GET", "production/entries/[entryId]/pdf", { params: { entryId: entry.id } }));
      await step("Entry: open", () => call("GET", "production/entries/[entryId]", { params: { entryId: entry.id } }));
      const wform = await step("Entry: process wise wastage form", () => call("GET", "production/entries/[entryId]/wastage", { params: { entryId: entry.id } }));
      note(`wastage form: processes ${wform?.processes?.length}, items ${wform?.items?.length}, lines ${wform?.lines?.length}`);
      const process = await step("Entry: ADD NEW process", () => call("POST", "production/processes", { body: { name: "Rehearsal Frying", businessUnitId: bu } }));
      await step("Entry: duplicate process is refused", () => call("POST", "production/processes", { body: { name: "Rehearsal Frying", businessUnitId: bu } }), true);
      const wItem = wform?.items?.[0];
      if (process && wItem) {
        const saved = await step("Entry: save process wise wastage", () => call("PUT", "production/entries/[entryId]/wastage", { params: { entryId: entry.id }, body: { lines: [{ processId: process.id, itemId: wItem.itemId ?? wItem.id, qty: 2.5 }] } }));
        note(`wastage saved: ${JSON.stringify(saved?.lines ?? saved).slice(0, 250)}`);
        await step("Entry: same wastage item twice is refused", () => call("PUT", "production/entries/[entryId]/wastage", { params: { entryId: entry.id }, body: { lines: [{ processId: process.id, itemId: wItem.itemId ?? wItem.id, qty: 1 }, { processId: process.id, itemId: wItem.itemId ?? wItem.id, qty: 2 }] } }), true);
      }
      const e2 = await step("Entry: second entry (rest: 100 good, Night shift)", () => call("POST", "production/entries", { body: { ...eBody, shift: "Night", totalQty: 100, rejectQty: 0, hours: 5, materials: [{ itemId: rm1.id, actualQty: 100 }, { itemId: rm2.id, actualQty: 10 }, { itemId: pm1.id, actualQty: 100 }] } }));
      const done = await call("GET", "production/orders/[orderId]", { params: { orderId: order.id } });
      note(`order after second entry: status ${done.status}, produced ${done.producedQty ?? done.completedQty}, remaining ${done.remainingQty}`);
      const e3 = await step("Entry: producing beyond the order (tolerance 5%: 50 more)", () => call("POST", "production/entries", { body: { ...eBody, totalQty: 50, rejectQty: 0, materials: [{ itemId: rm1.id, actualQty: 50 }, { itemId: rm2.id, actualQty: 5 }, { itemId: pm1.id, actualQty: 50 }] } }), true);
      void e3;
      if (e2) {
        const fresh = await call("GET", "production/entries/[entryId]", { params: { entryId: e2.id } });
        const s = { rm1: await stockOf(rmWh.id, rm1.id), fg: await stockOf(fgWh.id, fg1.id) };
        await step("Entry: cancel without reason is refused", () => call("POST", "production/entries/[entryId]/cancel", { params: { entryId: e2.id }, body: { version: fresh.updatedAt, reason: "" } }), true);
        await step("Entry: cancel the second entry", () => call("POST", "production/entries/[entryId]/cancel", { params: { entryId: e2.id }, body: { version: fresh.updatedAt, reason: "Wrong shift" } }));
        eq("Entry: cancel returns materials and removes output", [r3((await stockOf(rmWh.id, rm1.id)) - s.rm1), r3((await stockOf(fgWh.id, fg1.id)) - s.fg)], [100, -100]);
        const back = await call("GET", "production/orders/[orderId]", { params: { orderId: order.id } });
        note(`order after cancel: status ${back.status}, remaining ${back.remainingQty}`);
      }
      const closing = await call("GET", "production/orders/[orderId]", { params: { orderId: order.id } });
      const closed = await step("Order: close (short close)", () => call("POST", "production/orders/[orderId]/actions", { params: { orderId: order.id }, body: { version: closing.updatedAt, action: "close", comment: "short close" } }));
      note(`closed order status: ${closed?.status}`);
      await step("Entry: entry on a closed order is refused", () => call("POST", "production/entries", { body: { ...eBody, totalQty: 10, rejectQty: 0, materials: [{ itemId: rm1.id, actualQty: 10 }, { itemId: rm2.id, actualQty: 1 }, { itemId: pm1.id, actualQty: 10 }] } }), true);
    }
    await step("Entry: list filters", async () => { await call("GET", "production/entries", { query: { from: "2026-11-01", to: "2026-11-30", status: "POSTED" } }); await call("GET", "production/entries", { query: { status: "CANCELLED" } }); await call("GET", "production/entries", { query: { departmentId: dept.id } }); });
  }

  // ── A real (imported) BOM: it has no material lines ──
  out.push("== Order and entry on a real imported BOM ==");
  {
    const real = orderLookups.items.find((item: { boms: unknown[] }) => item.boms.length > 0);
    const fgStock = await stockOf(fgWh.id, real.itemId);
    let ro = await step("Real BOM: create order of 100", () => call("POST", "production/orders", { body: { orderDate: today, productionDate: today, itemId: real.itemId, bomId: real.boms[0].id, quantity: 100, officeId: office.id, warehouseId: rmWh.id } }));
    if (ro) {
      note(`real BOM order: materials ${ro.materials?.length}, unit cost ${ro.unitCost ?? ro.standardUnitCost}, status ${ro.status}`);
      ro = (await step("Real BOM: approve", () => call("POST", "production/orders/[orderId]/actions", { params: { orderId: ro.id }, body: { version: ro.updatedAt, action: "approve" } }))) ?? ro;
      const rf = await step("Real BOM: entry form", () => call("GET", "production/entries/form", { query: { orderId: ro.id } }));
      note(`real BOM entry form materials: ${rf?.materials?.length}`);
      const re = await step("Real BOM: post entry of 100 with no materials", () => call("POST", "production/entries", { body: { orderId: ro.id, entryDate: today, shift: "Day", outputWarehouseId: fgWh.id, totalQty: 100, rejectQty: 0, hours: 2, materials: [] } }));
      if (re) note(`real BOM entry: standardCost ${re.standardCost}, actualCost ${re.actualCost}, materials ${re.materials?.length}, finished stock added ${(await stockOf(fgWh.id, real.itemId)) - fgStock}`);
    }
  }

  // ── Dashboard & Reports ──
  out.push("== Dashboard & Reports ==");
  const board = await step("Dashboard: November", () => call("GET", "production/dashboard", { query: { from: "2026-11-01", to: "2026-11-30" } }));
  note(`dashboard: ${JSON.stringify(board).slice(0, 500)}`);
  await step("Dashboard: by office", () => call("GET", "production/dashboard", { query: { from: "2026-11-01", to: "2026-11-30", officeId: office.id } }));
  await step("Reports: lookups", () => call("GET", "production/reports/lookups"));
  const { REPORT_IDS } = await import("@/features/production/reports/schemas/report.schema");
  for (const viewBy of REPORT_IDS) {
    const base = { viewBy, from: "2026-11-01", to: "2026-11-30" };
    const report = await step(`Report: ${viewBy}`, () => call("GET", "production/reports", { query: base }));
    if (report) out.push(`NOTE |   ${viewBy}: ${report.rows?.length ?? "?"} rows, ${report.columns?.length ?? "?"} columns`);
    for (const flag of ["summary", "materialsVariance", "monthly", "shiftWise", "workCenterWise"]) {
      await step(`Report: ${viewBy} + ${flag}`, () => call("GET", "production/reports", { query: { ...base, [flag]: "true" } })).then(() => { if (out.at(-1)?.startsWith("PASS")) out.pop(); });
    }
    await step(`Report: ${viewBy} Excel`, () => call("GET", "production/reports/export-excel", { query: base })).then(() => { if (out.at(-1)?.startsWith("PASS")) out.pop(); });
    await step(`Report: ${viewBy} PDF`, () => call("GET", "production/reports/export-pdf", { query: base })).then(() => { if (out.at(-1)?.startsWith("PASS")) out.pop(); });
    await step(`Report: ${viewBy} filtered`, () => call("GET", "production/reports", { query: { ...base, departmentId: dept.id, officeId: office.id, ...(wc ? { workCenterId: wc.id } : {}), filterBy: "item", itemId: fg1.id, shift: "Morning" } })).then(() => { if (out.at(-1)?.startsWith("PASS")) out.pop(); });
  }
  await step("Report: from after to is refused", () => call("GET", "production/reports", { query: { viewBy: "production", from: "2026-11-30", to: "2026-11-01" } }), true);

  // ── As a real production user ──
  out.push("== As real users ==");
  const canDo = (user: (typeof users)[number], page: string, action: "view" | "create" | "approve") => grantsAllow(actorOf(user).grants, page, action);
  const maker = users.find((user) => !user.isMaster && user.erpAccess && canDo(user, "/production/orders", "create"));
  if (!maker) note("no non-master user may create production orders");
  else {
    who.actor = actorOf(maker);
    out.push(`-- as ${maker.name}`);
    await step("user: work center lookups", () => call("GET", "production/work-centers/lookups"));
    await step("user: BOM lookups", () => call("GET", "production/bill-of-materials/lookups"));
    await step("user: order lookups", () => call("GET", "production/orders/lookups"));
    await step("user: customers", () => call("GET", "production/orders/customers", { query: { search: "" } }));
    await step("user: operators", () => call("GET", "production/work-centers/operators", { query: { search: "" } }));
    let mine = await step("user: create order", () => call("POST", "production/orders", { body: { ...oBody, customerId: null, salesOrderId: null, quantity: 20 } }));
    if (mine) {
      const stages = await prisma.documentApproval.findMany({ where: { feature: "Production Order", documentId: mine.id }, orderBy: { stageNo: "asc" } });
      note(`approval stages copied for the order: ${stages.map((s) => `${s.stageNo}:${s.status}(approvers ${s.approverUserIds.length})`).join(" ") || "none yet"}`);
      for (let round = 0; round < 6 && mine.status === "PENDING_APPROVAL"; round++) {
        const stage = await prisma.documentApproval.findFirst({ where: { feature: "Production Order", documentId: mine.id, status: "PENDING" }, orderBy: { stageNo: "asc" } });
        const waiting = stage?.approverUserIds.filter((id) => !stage.approvedUserIds.includes(id)) ?? [];
        const pipelineUserIds = (pipeline?.stages ?? []).flatMap((st) => st.approvers.map((a) => (a.userType === "EMPLOYEE" ? a.employee?.userId : a.userId)));
        const approver = users.find((user) => user.id === waiting[0]) ?? users.find((user) => pipelineUserIds.includes(user.id)) ?? maker;
        who.actor = actorOf(approver);
        const next = await step(`user: stage ${stage?.stageNo ?? "?"} approve as ${approver.name}`, () => call("POST", "production/orders/[orderId]/actions", { params: { orderId: mine.id }, body: { version: mine.updatedAt, action: "approve" } }));
        if (!next) break;
        mine = next;
      }
      note(`user order final status: ${mine.status}`);
      who.actor = actorOf(maker);
      if (mine.status === "APPROVED") {
        await step("user: entry form", () => call("GET", "production/entries/form", { query: { orderId: mine.id } }));
        const posted = await step("user: post entry", () => call("POST", "production/entries", { body: { orderId: mine.id, entryDate: today, shift: "Day", outputWarehouseId: fgWh.id, totalQty: 20, rejectQty: 0, hours: 1, materials: [{ itemId: rm1.id, actualQty: 20 }, { itemId: rm2.id, actualQty: 2 }, { itemId: pm1.id, actualQty: 20 }] } }));
        if (posted) await step("user: entry PDF", () => call("GET", "production/entries/[entryId]/pdf", { params: { entryId: posted.id } }));
      }
    }
    await step("user: dashboard", () => call("GET", "production/dashboard", { query: { from: "2026-11-01", to: "2026-11-30" } }));
    await step("user: report", () => call("GET", "production/reports", { query: { viewBy: "production", from: "2026-11-01", to: "2026-11-30" } }));
    await step("user: report Excel", () => call("GET", "production/reports/export-excel", { query: { viewBy: "production", from: "2026-11-01", to: "2026-11-30" } }));
  }

  // ── Ledger ──
  who.actor = actorOf(master);
  const posting = await import("@/lib/accounting/posting.service");
  const run = await step("Accounts: post production documents to the ledger", () => posting.postPendingDocuments("Rehearsal"));
  note(`posting run: ${JSON.stringify(run).slice(0, 500)}`);
}
