import { describe, expect, it } from "vitest";
import { deviceName, parseDevice } from "@/lib/audit/device";

describe("device names from the User-Agent", () => {
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "Chrome 131 · Windows · Desktop"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86", "Edge 131 · Windows · Desktop"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", "Safari 17 · macOS · Desktop"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Firefox 133 · Windows · Desktop"],
    ["Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36", "Chrome 131 · Android 14 · Mobile"],
    ["Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36", "Samsung Internet 25 · Android 13 · Mobile"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "Safari 17 · iOS 17 · Mobile"],
    ["Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1", "Chrome 131 · iPadOS 16 · Tablet"],
  ])("%s", (ua, expected) => {
    expect(deviceName(ua)).toBe(expected);
  });

  it("marks scripts and tools as bots", () => {
    expect(parseDevice("curl/8.4.0")).toEqual({ browser: "curl", os: null, kind: "Bot" });
    expect(deviceName("node")).toBe("node · Bot");
  });

  it("is empty when nothing was sent", () => {
    expect(deviceName(null)).toBeNull();
    expect(deviceName("")).toBeNull();
  });
});
