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
};

export default nextConfig;
