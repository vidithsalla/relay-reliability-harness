import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  typedRoutes: false,
  outputFileTracingRoot: process.cwd()
};

export default nextConfig;
