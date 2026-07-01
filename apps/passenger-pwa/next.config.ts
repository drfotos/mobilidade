import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@saas/auth", "@saas/database", "@saas/ui", "@saas/maps", "@saas/pricing", "@saas/payments", "@saas/notifications", "@saas/pwa-helpers"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};
export default nextConfig;
