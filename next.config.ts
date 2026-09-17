import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal self-contained server (server.js + trimmed node_modules)
  // for a small container image (W3-17 / ADR-006).
  output: "standalone",
};

export default nextConfig;
