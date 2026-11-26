#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time setup of a fresh Hostinger VPS (Ubuntu 22.04 / 24.04) for BridgeOne.
# Run as root:
#
#   sudo bash setup-vps.sh <domain> "<deploy public key>" [port]
#   e.g. sudo bash setup-vps.sh erp.example.com "ssh-ed25519 AAAA... github-deploy"
#
# [port] is the local port the app listens on (default 3100; nginx forwards to
# it). Pick a free one when the server already runs other apps.
#
# Installs Node 22 (matches .nvmrc), PM2, nginx, certbot and a firewall, creates
# the `deploy` user that GitHub Actions logs in as, the /var/www/bridgeone layout,
# an nginx site for <domain>, and makes PM2 start on boot. On a server that
# already hosts other sites it keeps their Node/PM2 and does not switch the
# firewall on.
# Safe to re-run. Afterwards: create /var/www/bridgeone/shared/.env (see README).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:?usage: setup-vps.sh <domain> \"<deploy public key>\"}"
DEPLOY_KEY="${2:?usage: setup-vps.sh <domain> \"<deploy public key>\"}"
APP_PORT="${3:-3100}"
DEPLOY_USER="deploy"
APP_DIR="/var/www/bridgeone"
NODE_MAJOR=22

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)."; exit 1; }
[[ "$APP_PORT" =~ ^[0-9]+$ ]] || { echo "Port must be a number."; exit 1; }
if command -v ss >/dev/null && ss -Htln "sport = :$APP_PORT" | grep -q .; then
  echo "Port $APP_PORT is already in use on this server. Pass a free port as the third argument."
  exit 1
fi
# Other nginx sites (besides the default one and ours) mean a shared server.
OTHER_SITES="$(ls /etc/nginx/sites-enabled 2>/dev/null | grep -vxE 'default|bridgeone' || true)"
export DEBIAN_FRONTEND=noninteractive
# Use the system Node/PM2 that the deploy user also sees, never root's own (e.g. nvm in /root).
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

echo "== packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx ufw
if ! node -v 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
# Keep an existing PM2 (other apps on this server use it); install it otherwise.
command -v pm2 >/dev/null || npm install -g pm2@latest

echo "== deploy user"
id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AUTH="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AUTH"
grep -qxF "$DEPLOY_KEY" "$AUTH" || echo "$DEPLOY_KEY" >> "$AUTH"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"
chmod 600 "$AUTH"

echo "== app directories"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR" "$APP_DIR/releases" "$APP_DIR/incoming" "$APP_DIR/shared"
# Uploaded files (STORAGE_DRIVER=local) live outside releases so deploys keep them.
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR/shared/storage"
# The port the app listens on; release.sh reads it.
echo "$APP_PORT" > "$APP_DIR/shared/port"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/shared/port"

echo "== PM2 on boot"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER" >/dev/null
sudo -u "$DEPLOY_USER" pm2 install pm2-logrotate >/dev/null 2>&1 || true

echo "== nginx"
cat > /etc/nginx/sites-available/bridgeone <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Excel / attachment uploads.
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
}
NGINX
ln -sfn /etc/nginx/sites-available/bridgeone /etc/nginx/sites-enabled/bridgeone
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "== firewall"
if ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow OpenSSH >/dev/null
  ufw allow "Nginx Full" >/dev/null
elif [[ -n "$OTHER_SITES" ]]; then
  # Switching it on could block ports the other apps here rely on.
  echo "   ufw is off and this server hosts other sites ($(echo $OTHER_SITES)); leaving the firewall as it is."
else
  ufw allow OpenSSH >/dev/null
  ufw allow "Nginx Full" >/dev/null
  ufw --force enable >/dev/null
fi

cat <<DONE

Done. Next steps:
  1. Point the DNS A record of ${DOMAIN} at this server, then run:
       certbot --nginx -d ${DOMAIN} --redirect -m <your-email> --agree-tos -n
  2. Create ${APP_DIR}/shared/.env as the ${DEPLOY_USER} user (see deploy/README.md):
       sudo -u ${DEPLOY_USER} nano ${APP_DIR}/shared/.env && chmod 600 ${APP_DIR}/shared/.env
  3. Add the GitHub secrets/variables and run the "Deploy" workflow.
DONE
