import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared KidQ Player ships as TypeScript source.
  transpilePackages: ["@kidq/player"],
  poweredByHeader: false,
};

export default nextConfig;
