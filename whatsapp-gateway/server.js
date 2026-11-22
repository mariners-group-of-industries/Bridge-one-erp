require("dotenv").config();

const fs = require("fs");
const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

function detectChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  return candidates.find((p) => fs.existsSync(p));
}

const app = express();
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || "0.0.0.0";
const AUTH_DATA_PATH = process.env.AUTH_DATA_PATH || "./.wwebjs_auth";
const TOKEN = process.env.GATEWAY_TOKEN;
const DEFAULT_GROUP_ID = (process.env.WHATSAPP_GROUP_ID || "").trim();
const ALLOWED_GROUPS = new Set(
  (process.env.WHATSAPP_ALLOWED_GROUPS || DEFAULT_GROUP_ID)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.endsWith("@g.us")),
);

if (!TOKEN) {
  console.error("FATAL: GATEWAY_TOKEN is required in .env");
  process.exit(1);
}

let ready = false;
let lastQr = null;
let clientPhone = null;

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: AUTH_DATA_PATH,
  }),
  puppeteer: {
    headless: true,
    ...(detectChromePath() ? { executablePath: detectChromePath() } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
});

client.on("qr", (qr) => {
  ready = false;
  lastQr = qr;
  console.log("\n[WhatsApp Gateway] Scan this QR code with WhatsApp (Linked Devices -> Link a Device):\n");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  ready = true;
  lastQr = null;
  clientPhone = client.info?.wid?.user || null;
  console.log(`[WhatsApp Gateway] Connected as ${clientPhone || "unknown"}`);

  try {
    const chats = await client.getChats();
    const groups = chats.filter((c) => c.isGroup);
    console.log(`[WhatsApp Gateway] Found ${groups.length} group(s):`);
    for (const g of groups) {
      console.log(`  - ${g.name} => ${g.id._serialized}`);
    }
  } catch (err) {
    console.error("[WhatsApp Gateway] Could not list groups on ready:", err.message);
  }
});

client.on("disconnected", (reason) => {
  ready = false;
  console.warn("[WhatsApp Gateway] Disconnected:", reason);
});

function requireAuth(req, res, next) {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "bridgeone-whatsapp-gateway", connected: ready });
});

app.get("/health", requireAuth, (_req, res) => {
  res.json({
    connected: ready,
    phone: clientPhone,
    qrPending: Boolean(lastQr) && !ready,
  });
});

app.get("/groups", requireAuth, async (_req, res) => {
  if (!ready) {
    return res.status(503).json({ error: "WhatsApp session is offline" });
  }
  try {
    const chats = await client.getChats();
    const groups = chats
      .filter((c) => c.isGroup)
      .map((c) => ({ id: c.id._serialized, name: c.name }));
    res.json({ groups });
  } catch (err) {
    console.error("[WhatsApp Gateway] Failed to list groups:", err.message);
    res.status(502).json({ error: "Failed to fetch groups" });
  }
});

app.post("/join-invite", requireAuth, async (req, res) => {
  if (!ready) {
    return res.status(503).json({ error: "WhatsApp session is offline" });
  }
  const raw = String(req.body?.invite || process.env.WHATSAPP_INVITE_CODE || "").trim();
  const code = raw.replace(/^https?:\/\/chat\.whatsapp\.com\//i, "").split("?")[0].trim();
  if (!code) {
    return res.status(400).json({ error: "Invite code or URL is required" });
  }
  try {
    const groupId = await client.acceptInvite(code);
    res.json({ joined: true, groupId });
  } catch (err) {
    console.error("[WhatsApp Gateway] Invite accept failed:", err.message);
    res.status(502).json({ error: err.message || "Failed to join group" });
  }
});

app.post("/send", requireAuth, async (req, res) => {
  if (!ready) {
    return res.status(503).json({ error: "WhatsApp offline" });
  }

  const targetGroupId = String(req.body?.groupId || DEFAULT_GROUP_ID || "").trim();
  if (!targetGroupId || !targetGroupId.endsWith("@g.us")) {
    return res.status(400).json({ error: "Valid WhatsApp groupId (@g.us) is required" });
  }

  if (ALLOWED_GROUPS.size > 0 && !ALLOWED_GROUPS.has(targetGroupId)) {
    return res.status(403).json({ error: "Target group is not in WHATSAPP_ALLOWED_GROUPS" });
  }

  const message = req.body?.message;
  if (typeof message !== "string" || !message.trim() || message.length > 2000) {
    return res.status(400).json({ error: "Invalid message" });
  }

  try {
    const sent = await client.sendMessage(targetGroupId, message);
    res.json({
      accepted: true,
      messageId: sent?.id?._serialized || null,
    });
  } catch (err) {
    console.error("[WhatsApp Gateway] Message send failed:", err.message);
    res.status(502).json({ error: err.message || "Send failed" });
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[WhatsApp Gateway] Listening on http://${HOST}:${PORT}`);
});

async function shutdown() {
  console.log("\n[WhatsApp Gateway] Shutting down...");
  server.close();
  try {
    await client.destroy();
  } catch {}
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

client.initialize();
