import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default.
  // Empty turbopack config silences the webpack/turbopack mismatch warning.
  // Turbopack handles node built-ins (fs, net, tls) automatically.
  turbopack: {},
};

export default nextConfig;
