# ZKTeco attendance agent

Reads punches from ZKTeco attendance devices on the office network and uploads them to
BridgeOne ERP. Punches then appear in **HRM › Attendance › Daily** (first punch = in,
last punch = out).

The device keeps sending to its cloud server (e.g. iBOS, `time.ibos.io`) as before; the
agent reads the device separately over the LAN.

## Before you start (in the ERP)

1. **Configuration › Community & Gateways › Attendance Devices → Add Device**: the device's
   IP address (device menu *Comm. › Ethernet*, e.g. `192.168.0.119`) and TCP port
   (normally `4370`), and its office.
2. In every employee's profile, set **Attendance ID** to the employee's user number on the
   device. Punches of unknown numbers are kept and linked once the ID is set.
3. **Configuration › Community & Gateways › API Configuration → Generate New Token** with
   **Read & write** access. Copy it; it is shown only once.

Tip: give the device a fixed IP (turn DHCP off on the device, or reserve its address in
the router), otherwise its address can change and the agent can no longer find it.

## Run it

On a PC that stays on and is in the same network as the device, with Node.js 20.12 or newer,
create a file named `.env` in this folder (it is kept out of git — never commit the token):

```ini
ERP_URL=https://bridge-one-erp.vercel.app
ERP_TOKEN=b1_your_token_here
INTERVAL_MINUTES=5
```

Then:

```bat
cd zk-attendance-agent
npm install
npm start
```

(Environment variables such as `set ERP_TOKEN=…` work too and take precedence over `.env`.)

It syncs right away and then every 5 minutes (`INTERVAL_MINUTES` to change). In the ERP the
device's status shows **Syncing**; errors (e.g. device unreachable) appear on the device's row.

To run it at start-up instead of in an open window, use Windows Task Scheduler with
`npm run once` every few minutes, or a process manager such as `pm2`.

## Notes

- The PC's time zone must match the device's (Bangladesh: UTC+6); punch times are sent with
  the PC's offset.
- If the device has a **communication key (Comm Key)** set, the agent cannot connect; set it
  to 0 on the device.
- Only devices marked **Active** in the ERP are read.
- The token can read and change ERP data; keep it private and revoke it in API
  Configuration if the PC is lost.
