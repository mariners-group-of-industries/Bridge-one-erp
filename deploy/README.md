# Deploying BridgeOne ERP to the Hostinger VPS

```text
push / merge to development
        │
        ▼  GitHub Actions (.github/workflows/deploy.yml)
  build job:  npm ci → prisma validate → lint → typecheck → test → next build (standalone)
              → assemble release.tgz → smoke test /api/health → upload artifact
        │
        ▼
  deploy job: check SSH config → prisma migrate deploy (Neon, DIRECT_URL)
              → scp release.tgz + release.sh → release.sh on the VPS
        │
        ▼  VPS (/var/www/bridgeone)
  releases/<commit>/   unpacked standalone server (server.js + traced node_modules)
  current → releases/<commit>   switched atomically
  shared/.env          runtime secrets (only on the server)
  shared/storage/      uploaded files (STORAGE_DRIVER=local)
  PM2 "bridgeone" → node server.js on 127.0.0.1:3000 ← nginx (80/443) ← users
```

The VPS never runs `npm install` or `next build`; it only unpacks and restarts.
If `/api/health` does not answer after the restart, `release.sh` switches
`current` back to the previous release and the workflow fails. The last 5
releases are kept.

`ci.yml` still checks every pull request and pushes to `main`; pushes to
`development` are checked by the deploy workflow (once, not twice).

---

## One-time setup

### 1. Create a deploy SSH key (on your PC)

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f bridgeone_deploy -N ""
```

This makes `bridgeone_deploy` (private key, goes into GitHub) and
`bridgeone_deploy.pub` (public key, goes onto the VPS). Do not commit either.

### 2. Prepare the VPS

In hPanel make sure the VPS runs **Ubuntu 22.04 or 24.04**, then from your PC:

```bash
scp deploy/setup-vps.sh root@<VPS_IP>:/root/
ssh root@<VPS_IP>
bash /root/setup-vps.sh erp.example.com "$(cat bridgeone_deploy.pub)"   # paste the .pub content
```

It installs Node 22, PM2, nginx, certbot and the firewall (SSH + HTTP/HTTPS only),
creates the `deploy` user and `/var/www/bridgeone`, and makes PM2 start on boot.

Point the domain's **A record** at the VPS IP, then enable HTTPS:

```bash
certbot --nginx -d erp.example.com --redirect -m you@example.com --agree-tos -n
```

### 3. Runtime secrets on the VPS

```bash
sudo -u deploy nano /var/www/bridgeone/shared/.env
sudo chmod 600 /var/www/bridgeone/shared/.env
```

Copy the keys from `frontend/.env.example` and fill in production values:

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** URL (host contains `-pooler`) |
| `DIRECT_URL` | Neon direct URL |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | a production key pair (command in `.env.example`) |
| `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_EXPIRY` | as in `.env.example` |
| `STORAGE_DRIVER` | `local` (or `cloudinary` / `r2` with their keys) |
| `STORAGE_LOCAL_DIR` | `/var/www/bridgeone/shared/storage` |
| `PUSHER_*` | Pusher credentials, if BRG Connect is used |
| `APP_TIMEZONE` | e.g. `Asia/Dhaka` |

Never set `ERP_DEV_AUTH_BYPASS` on the server. Do **not** put `PORT`/`HOSTNAME`
here; PM2 sets them (`deploy/ecosystem.config.cjs`).

### 4. GitHub settings

Repository → **Settings → Environments → New environment → `production`**.
Optionally add yourself under *Required reviewers* to approve each deploy.

**Environment secrets** (`production`):

| Secret | Value |
| --- | --- |
| `VPS_SSH_KEY` | the whole content of the private key file `bridgeone_deploy` |
| `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -p 22 <VPS_IP>` (pins the server's identity) |
| `DIRECT_URL` | Neon direct URL (used only for `prisma migrate deploy`) |

**Environment variables** (`production`):

| Variable | Value |
| --- | --- |
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | `deploy` (default) |
| `VPS_PORT` | `22` (default) |
| `APP_URL` | `https://erp.example.com` (shown on the run page) |

**Repository variables** (Settings → Secrets and variables → Actions → Variables),
baked into the browser bundle at build time:
`NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`,
`NEXT_PUBLIC_ACCOUNTING_STORAGE_KEY`. Leave `NEXT_PUBLIC_API_URL` unset (the
API is on the same domain).

### 5. First deploy

Actions → **Deploy** → *Run workflow* on `development`. After that every merge
into `development` deploys by itself.

---

## Day to day

| Task | How |
| --- | --- |
| Redeploy | Actions → Deploy → Run workflow |
| Roll back | on the VPS: `bash /var/www/bridgeone/shared/release.sh --rollback` (or re-run the Deploy run of an older commit) |
| Logs | `ssh deploy@<VPS_IP>` then `pm2 logs bridgeone` |
| Status | `pm2 status`, `curl -s localhost:3000/api/health` |
| Change a secret | edit `shared/.env`, then `pm2 restart bridgeone --update-env` |

**Migrations** run before the new code goes live and are not rolled back with
the code. Write them so the release that is still running keeps working (add
columns/tables first, remove old ones in a later release).

---

## Attendance devices pushing directly (ZKTeco ADMS)

Devices set to **Comm. › Cloud Server Setting → ADMS** with this server's domain send
their punches to `/iclock/cdata`, `/iclock/getrequest` and `/iclock/devicecmd`
(see Configuration › Attendance Devices). Devices with an HTTPS option use port 443
and need nothing more.

Many devices speak **plain HTTP only** (port 80) and do not follow redirects, but
`certbot --redirect` sends all port-80 traffic to HTTPS. Keep `/iclock/` on HTTP: in
`/etc/nginx/sites-available/bridgeone`, change the port-80 `server` block that certbot
wrote so it reads:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name erp.example.com;

    # ZKTeco devices (ADMS) without HTTPS.
    location /iclock/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 5m;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

(remove certbot's `if ($host = …) { return 301 … }` and `return 404;` lines from that
block), then `nginx -t && systemctl reload nginx`. Only the device endpoints answer on
HTTP; they accept punches only from serial numbers registered as Active devices.
