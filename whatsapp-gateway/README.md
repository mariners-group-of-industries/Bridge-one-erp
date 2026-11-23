# BridgeOne WhatsApp Attendance Gateway

Isolated Node.js gateway using `whatsapp-web.js` (`LocalAuth`) to send attendance notifications to an existing WhatsApp group.

> **Important:** `whatsapp-web.js` is an unofficial Linked Device integration and carries a risk of session disconnection or account suspension. Use a dedicated notification phone number (`01325088126`) rather than a primary business number.

## 24/7 Cloud Deployment (Recommended for Vercel ERP)

Deploy the `whatsapp-gateway` directory using **Railway** (or **Render** / **Fly.io** / Docker VPS):

1. Create a new project on **Railway** from your GitHub repository (`development` branch) and set **Root Directory** to `whatsapp-gateway`.
2. Railway automatically detects the included `Dockerfile` (with Node 20 + Chromium).
3. Add a **Volume** mounted at `/app/.wwebjs_auth` so your WhatsApp login persists across restarts.
4. Set Environment Variables in Railway:
   - `GATEWAY_TOKEN` = `<strong-random-secret>`
   - `WHATSAPP_GROUP_ID` = `120363427373068927@g.us`
5. Open the Railway **Deploy Logs**, scan the QR code once with `01325088126` (**Linked Devices → Link a Device**).
6. Copy the Railway public `https://...` domain into **Vercel → Settings → Environment Variables**:
   - `WHATSAPP_GATEWAY_URL` = `https://<your-railway-domain>`
   - `WHATSAPP_GATEWAY_TOKEN` = `<same GATEWAY_TOKEN>`
7. Redeploy Vercel once.
