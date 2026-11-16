import { describe, expect, it } from "vitest";
import { dmyToIso, isoToDmy } from "@/components/ui/date-input";

describe("DD/MM/YYYY date input helpers", () => {
  it("shows ISO dates as DD/MM/YYYY", () => {
    expect(isoToDmy("2026-11-05")).toBe("05/11/2026");
    expect(isoToDmy("2026-11-05T10:00:00Z")).toBe("05/11/2026");
    expect(isoToDmy("")).toBe("");
  });

  it("reads day first, with /, - or . and single-digit parts", () => {
    expect(dmyToIso("05/11/2026")).toBe("2026-11-05");
    expect(dmyToIso("5-1-2026")).toBe("2026-01-05");
    expect(dmyToIso(" 31.12.2026 ")).toBe("2026-12-31");
  });

  it("rejects dates that do not exist or are not DD/MM/YYYY", () => {
    expect(dmyToIso("31/02/2026")).toBeNull();
    expect(dmyToIso("13/13/2026")).toBeNull();
    expect(dmyToIso("2026-11-05")).toBeNull();
    expect(dmyToIso("05/11/26")).toBeNull();
  });
});
