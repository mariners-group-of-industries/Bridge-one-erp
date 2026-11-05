import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rtmLinks, rtmWorkspace } from "@/features/rtm/navigation";
import { findWorkspace } from "@/lib/navigation/registry";

describe("RTM module", () => {
  it("is an active workspace with all 23 pages in the menu", () => {
    expect(rtmWorkspace.status).toBe("active");
    expect(rtmLinks).toHaveLength(23);
    expect(new Set(rtmLinks.map((l) => l.href)).size).toBe(23);
  });

  it("has a page for every menu link", () => {
    for (const link of rtmLinks) {
      const file = path.join(process.cwd(), "src/app/(erp)", link.href, "page.tsx");
      expect(existsSync(file), link.href).toBe(true);
    }
  });

  it("is found for its routes", () => {
    expect(findWorkspace("/rtm")?.id).toBe("rtm");
    expect(findWorkspace("/rtm/outlet-ledger")?.id).toBe("rtm");
  });
});
