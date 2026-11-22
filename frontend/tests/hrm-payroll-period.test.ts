import { describe, expect, it } from "vitest";
import { defaultPayrollDate, defaultPeriodEnd, lastClosedPayrollMonth } from "@/features/hrm/payroll/period";

describe("Payroll period defaults", () => {
  it("opens on the last period that has ended (21st – 20th)", () => {
    // 22 Nov and 5 Dec: the salary due is October's (21 Oct – 20 Nov).
    expect(lastClosedPayrollMonth(new Date(2026, 10, 22))).toEqual({ year: "2026", month: "10" });
    expect(lastClosedPayrollMonth(new Date(2026, 11, 5))).toEqual({ year: "2026", month: "10" });
    expect(lastClosedPayrollMonth(new Date(2026, 11, 21))).toEqual({ year: "2026", month: "11" });
    // Across the year end.
    expect(lastClosedPayrollMonth(new Date(2027, 0, 10))).toEqual({ year: "2026", month: "11" });
    // Calendar-month periods.
    expect(lastClosedPayrollMonth(new Date(2026, 10, 3), 1)).toEqual({ year: "2026", month: "10" });
  });

  it("ends a month's period on the 20th of the next month and pays on the 5th after it", () => {
    expect(defaultPeriodEnd("2026-10")).toBe("2026-11-20");
    expect(defaultPeriodEnd("2026-12")).toBe("2027-01-20");
    expect(defaultPeriodEnd("2026-02", 1)).toBe("2026-02-28");
    expect(defaultPayrollDate("2026-11-20")).toBe("2026-12-05");
    expect(defaultPayrollDate("2026-12-20")).toBe("2027-01-05");
  });
});
