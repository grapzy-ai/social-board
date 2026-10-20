import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Share-card fonts are read from disk at request time; make sure Vercel traces them into the function bundle.
  outputFileTracingIncludes: { "/api/share": ["./assets/fonts/*.ttf"] },
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
