import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@saas/auth", "@saas/database", "@saas/ui", "@saas/notifications"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};
export default nextConfig;
