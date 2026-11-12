/**
 * A readable device name from a browser's User-Agent header, e.g.
 * "Chrome 131 · Windows · Desktop". Browsers do not send the computer's own name,
 * so this is the most a web app can tell about the device.
 */

export interface DeviceInfo {
  browser: string | null;
  os: string | null;
  kind: "Desktop" | "Mobile" | "Tablet" | "Bot" | null;
}

const BROWSERS: [RegExp, string][] = [
  // Order matters: Edge, Opera and Samsung Internet also claim to be Chrome; Chrome claims to be Safari.
  [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/(?:OPR|Opera)\/(\d+)/, "Opera"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
  [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari\//, "Safari"],
];

const OSES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/Windows NT 10\.0/, "Windows"],
  [/Windows NT 6\.3/, "Windows 8.1"],
  [/Windows NT 6\.1/, "Windows 7"],
  [/Android (\d+)/, (m) => `Android ${m[1]}`],
  [/iPad.*OS (\d+)/, (m) => `iPadOS ${m[1]}`],
  [/(?:iPhone|CPU) OS (\d+)/, (m) => `iOS ${m[1]}`],
  [/Mac OS X/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

export function parseDevice(userAgent: string | null | undefined): DeviceInfo {
  const ua = userAgent?.trim() ?? "";
  if (!ua) return { browser: null, os: null, kind: null };

  if (/bot|crawler|spider|curl|wget|node|axios|postman|python|okhttp|undici/i.test(ua)) {
    return { browser: ua.split(/[\s/]/)[0] || null, os: null, kind: "Bot" };
  }

  let browser: string | null = null;
  for (const [pattern, name] of BROWSERS) {
    const m = ua.match(pattern);
    if (m) {
      browser = `${name} ${m[1]}`;
      break;
    }
  }

  let os: string | null = null;
  for (const [pattern, name] of OSES) {
    const m = ua.match(pattern);
    if (m) {
      os = typeof name === "string" ? name : name(m);
      break;
    }
  }

  const kind = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "Tablet" : /Mobi|iPhone|Android/.test(ua) ? "Mobile" : "Desktop";
  return { browser, os, kind };
}

/** "Chrome 131 · Windows · Desktop", or null when nothing is known. */
export function deviceName(userAgent: string | null | undefined): string | null {
  const { browser, os, kind } = parseDevice(userAgent);
  const parts = [browser, os, kind].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
