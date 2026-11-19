#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time setup of a fresh Hostinger VPS (Ubuntu 22.04 / 24.04) for BridgeOne.
# Run as root:
#
#   sudo bash setup-vps.sh <domain> "<deploy public key>"
#   e.g. sudo bash setup-vps.sh erp.example.com "ssh-ed25519 AAAA... github-deploy"
#
# Installs Node 22 (matches .nvmrc), PM2, nginx, certbot and a firewall, creates
# the `deploy` user that GitHub Actions logs in as, the /var/www/bridgeone layout,
# an nginx site for <domain>, and makes PM2 start on boot.
# Safe to re-run. Afterwards: create /var/www/bridgeone/shared/.env (see README).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:?usage: setup-vps.sh <domain> \"<deploy public key>\"}"
DEPLOY_KEY="${2:?usage: setup-vps.sh <domain> \"<deploy public key>\"}"
DEPLOY_USER="deploy"
APP_DIR="/var/www/bridgeone"
NODE_MAJOR=22

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "== packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx ufw
if ! node -v 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
npm install -g pm2@latest

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
        proxy_pass http://127.0.0.1:3000;
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
ufw allow OpenSSH >/dev/null
ufw allow "Nginx Full" >/dev/null
ufw --force enable >/dev/null

cat <<DONE

Done. Next steps:
  1. Point the DNS A record of ${DOMAIN} at this server, then run:
       certbot --nginx -d ${DOMAIN} --redirect -m <your-email> --agree-tos -n
  2. Create ${APP_DIR}/shared/.env as the ${DEPLOY_USER} user (see deploy/README.md):
       sudo -u ${DEPLOY_USER} nano ${APP_DIR}/shared/.env && chmod 600 ${APP_DIR}/shared/.env
  3. Add the GitHub secrets/variables and run the "Deploy" workflow.
DONE
