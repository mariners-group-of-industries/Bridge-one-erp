import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["argon2"],
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
