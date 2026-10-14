import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal self-contained server (server.js + trimmed node_modules)
  // for a small container image (W3-17 / ADR-006).
  output: "standalone",
  // The contract page reads these from disk at request time, so the tracer
  // cannot see them; name them so the standalone image carries them (I-02).
  outputFileTracingIncludes: {
    "/docs/[file]": [
      "./docs/keel-api.yaml",
      "./node_modules/swagger-ui-dist/swagger-ui.css",
      "./node_modules/swagger-ui-dist/swagger-ui-bundle.js",
    ],
  },
};

export default nextConfig;
