/**
 * PM2 process for BridgeOne ERP on the VPS.
 *
 * `current` is a symlink to the active release (deploy/release.sh switches it),
 * and Next's standalone server.js chdirs into its own real directory, so a
 * restart always runs the release the symlink points at.
 *
 * Secrets live only on the server in shared/.env (loaded with Node's --env-file).
 */
const APP_DIR = process.env.APP_DIR || "/var/www/bridgeone";
// release.sh passes the port from shared/port (written by setup-vps.sh), so
// BridgeOne can share a server with other apps.
const APP_PORT = process.env.APP_PORT || "3100";

module.exports = {
  apps: [
    {
      name: "bridgeone",
      cwd: `${APP_DIR}/current`,
      script: `${APP_DIR}/current/server.js`,
      node_args: `--env-file=${APP_DIR}/shared/.env`,
      env: {
        NODE_ENV: "production",
        PORT: APP_PORT,
        // Only nginx talks to Node; never expose this port publicly.
        HOSTNAME: "127.0.0.1",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1500M",
      kill_timeout: 10000,
      time: true,
    },
  ],
};
