import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dashboard is fully dynamic (per-request DB reads); cacheComponents is off so route segment config (runtime/maxDuration/dynamic) applies.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
