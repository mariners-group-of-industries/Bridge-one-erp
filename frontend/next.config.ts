import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone (server.js + only the traced
  // node_modules). The VPS runs it under PM2 without npm install; see deploy/.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["argon2"],
  experimental: {
    agentUpgrade: "security",
  },
  // Some ZKTeco firmwares push to /iclock/cdata.aspx etc. (ADMS); same handlers.
  async rewrites() {
    return ["cdata", "getrequest", "devicecmd"].map((name) => ({ source: `/iclock/${name}.aspx`, destination: `/iclock/${name}` }));
  },
};

export default nextConfig;
