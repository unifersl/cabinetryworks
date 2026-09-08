import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove "standalone" so `next start` works correctly in production.
  // The standalone output requires `node .next/standalone/server.js` which
  // doesn't handle environment variables and static files properly in this sandbox.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
