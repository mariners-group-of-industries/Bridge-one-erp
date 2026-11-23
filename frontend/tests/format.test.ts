import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, shortTimeAgo, timeAgo } from "@/lib/format";

const now = new Date("2026-10-11T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("shortTimeAgo", () => {
  it.each([
    [10, "now"],
    [5 * 60, "5 m"],
    [3 * 3600, "3 h"],
    [2 * 86400, "2 d"],
    [15 * 86400, "2 w"],
    [90 * 86400, "3 M"],
    [800 * 86400, "2 y"],
  ])("%i seconds ago → %s", (seconds, expected) => {
    expect(shortTimeAgo(ago(seconds), now)).toBe(expected);
  });

  it("never shows a negative age for clock skew", () => {
    expect(shortTimeAgo(new Date(now.getTime() + 60_000), now)).toBe("now");
  });
});

describe("timeAgo", () => {
  it("formats sentence-style relative times", () => {
    expect(timeAgo(ago(5), now)).toBe("just now");
    expect(timeAgo(ago(5 * 60), now)).toBe("5 minutes ago");
    expect(timeAgo(ago(86400), now)).toBe("yesterday");
    expect(timeAgo(ago(3 * 86400), now)).toBe("3 days ago");
  });
});

describe("DD/MM/YYYY display", () => {
  it("shows dates as DD/MM/YYYY", () => {
    expect(formatDate("2026-11-23")).toBe("23/11/2026");
    expect(formatDate(new Date(2026, 0, 5, 10, 0))).toBe("05/01/2026");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not a date")).toBe("not a date");
  });

  it("shows date-times as DD/MM/YYYY hh:mm AM/PM on the viewer's clock", () => {
    expect(formatDateTime(new Date(2026, 10, 23, 9, 5))).toBe("23/11/2026 09:05 AM");
    expect(formatDateTime(new Date(2026, 10, 23, 0, 30))).toBe("23/11/2026 12:30 AM");
    expect(formatDateTime(new Date(2026, 10, 23, 18, 0))).toBe("23/11/2026 06:00 PM");
    expect(formatDateTime(undefined)).toBe("—");
  });
});
