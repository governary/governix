import path from "path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@governix/shared", "@governix/db"],
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: path.join(__dirname, "../../")
};

export default nextConfig;
