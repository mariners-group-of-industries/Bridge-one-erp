import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { runAssistant } from "@/features/assistant/server/agent";
import { ASSISTANT_TOOLS, serializeResult, toolSpec, toolsFor } from "@/features/assistant/server/tools";
import type { AssistantEvent } from "@/features/assistant/types";
import type { Actor } from "@/lib/auth/actor";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const daysAgo = (days: number) => new Date(`${new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)}T00:00:00.000Z`);

async function seedStock() {
  await saveCompany(adminActor, companyInput);
  const unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  const officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  const warehouse = await testPrisma().warehouse.create({ data: { officeId, name: "FG WH" } });
  const chips = await testPrisma().item.create({ data: { businessUnitId: unitId, code: "I-1", name: "Chips", salesRate: "10" } });
  const soap = await testPrisma().item.create({ data: { businessUnitId: unitId, code: "I-2", name: "Soap", salesRate: "50" } });
  const entry = (itemId: string, qty: string, source: "OPENING" | "SALES_DELIVERY", postingDate: Date) =>
    testPrisma().stockEntry.create({ data: { businessUnitId: unitId, warehouseId: warehouse.id, itemId, qty, source, postingDate, createdBy: "test" } });
  await entry(chips.id, "100", "OPENING", daysAgo(90));
  await entry(chips.id, "-40", "SALES_DELIVERY", daysAgo(5));
  await entry(soap.id, "4", "OPENING", daysAgo(90));
}

const find = (name: string) => ASSISTANT_TOOLS.find((t) => t.name === name)!;

describe("assistant tools", () => {
  it("describes every tool with a JSON schema object", () => {
    for (const t of ASSISTANT_TOOLS) {
      const spec = toolSpec(t);
      expect(spec.function.parameters.type).toBe("object");
      expect(spec.function.parameters).not.toHaveProperty("$schema");
    }
  });

  it("offers only the tools the actor may use", () => {
    const noSales: Actor = { ...adminActor, isMaster: false, permissions: new Set(["employees:read"]) };
    expect(toolsFor(noSales)).toEqual([]);
    expect(toolsFor(adminActor)).toHaveLength(ASSISTANT_TOOLS.length);
  });

  it("reports stock levels and low stock from the ledger", async () => {
    await seedStock();
    const stock = (await find("stock_levels").run(adminActor, { limit: 25 })) as { totalValue: number; rows: { item: string; qty: number; value: number }[] };
    expect(stock.totalValue).toBe(800);
    expect(stock.rows.map((r) => [r.item, r.qty, r.value])).toEqual([
      ["Chips", 60, 600],
      ["Soap", 4, 200],
    ]);
    const low = (await find("stock_levels").run(adminActor, { belowQty: 10, limit: 25 })) as { rows: { item: string }[] };
    expect(low.rows.map((r) => r.item)).toEqual(["Soap"]);
  });

  it("finds stock that has not sold recently", async () => {
    await seedStock();
    const slow = (await find("slow_moving_items").run(adminActor, { days: 30, limit: 15 })) as { rows: { item: string; lastSoldOn: string }[] };
    expect(slow.rows).toEqual([expect.objectContaining({ item: "Soap", lastSoldOn: "never" })]);
  });

  it("drops record ids from results sent to the model", () => {
    expect(JSON.parse(serializeResult({ id: "x", itemId: "y", name: "Chips", rows: [{ customerId: "z", amount: 1 }] }))).toEqual({ name: "Chips", rows: [{ amount: 1 }] });
  });
});

/** An SSE body like an OpenAI-compatible streaming response. */
function sse(chunks: unknown[]): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

describe("assistant agent", () => {
  it("calls a tool, feeds the result back and streams the answer", async () => {
    await seedStock();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sse([
          { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "stock_levels", arguments: '{"belowQty"' } }] } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ": 10}" } }] } }] },
        ]),
      )
      .mockResolvedValueOnce(sse([{ choices: [{ delta: { content: "Soap is low: " } }] }, { choices: [{ delta: { content: "**4** left." } }] }]));
    vi.stubGlobal("fetch", fetchMock);

    const events: AssistantEvent[] = [];
    await runAssistant(adminActor, { apiUrl: "https://llm.test/v1", apiKey: "k", model: "m" }, [{ role: "user", content: "What is low on stock?" }], (e) => events.push(e));

    expect(events).toEqual([
      { type: "status", text: "Checking stock levels…" },
      { type: "text", delta: "Soap is low: " },
      { type: "text", delta: "**4** left." },
    ]);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string) as { messages: { role: string; content: string }[] };
    const toolMessage = second.messages.find((m) => m.role === "tool")!;
    expect(JSON.parse(toolMessage.content).rows).toEqual([expect.objectContaining({ item: "Soap", qty: 4 })]);
  });

  it("returns invalid arguments to the model instead of failing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "slow_moving_items", arguments: '{"days": 2}' } }] } }] }]))
      .mockResolvedValueOnce(sse([{ choices: [{ delta: { content: "ok" } }] }]));
    vi.stubGlobal("fetch", fetchMock);

    await runAssistant(adminActor, { apiUrl: "https://llm.test/v1", apiKey: "k", model: "m" }, [{ role: "user", content: "slow stock?" }], () => {});
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string) as { messages: { role: string; content: string }[] };
    expect(second.messages.find((m) => m.role === "tool")!.content).toMatch(/^Error: invalid arguments/);
  });
});
