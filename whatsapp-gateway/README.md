# BridgeOne WhatsApp Attendance Gateway

Isolated Node.js gateway using `whatsapp-web.js` (`LocalAuth`) to send attendance notifications to an existing WhatsApp group.

> **Important:** `whatsapp-web.js` is an unofficial Linked Device integration and carries a risk of session disconnection or account suspension. Use a dedicated notification phone number (`01325088126`) rather than a primary business number.

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Set a strong random `GATEWAY_TOKEN`.

2. Install dependencies and start:
   ```bash
   npm install
   npm start
   ```

3. Scan the QR code shown in the terminal using WhatsApp on `01325088126` (**Linked Devices → Link a Device**).

4. If `01325088126` has not joined the target group yet, join via the invite link or call:
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:3100/join-invite" -Method Post -Headers @{ Authorization = "Bearer YOUR_TOKEN" } -ContentType "application/json" -Body '{"invite":"https://chat.whatsapp.com/HdRuyK6WyR4HxS9QtCduYv"}'
   ```

5. Configure the same `WHATSAPP_GATEWAY_URL=http://127.0.0.1:3100` and `WHATSAPP_GATEWAY_TOKEN=...` in `frontend/.env.local` (or `shared/.env` on the VPS).
   Then open **Configuration › Community & Gateways › Attendance Notifications** in BridgeOne ERP to select the group, enable notifications, and send a test message.
