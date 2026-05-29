import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Permite distDir alternativo p. ej. NEXT_DIST_DIR=.next-dev npm run dev */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
