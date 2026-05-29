import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Permite distDir alternativo p. ej. NEXT_DIST_DIR=.next-dev npm run dev */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  experimental: {
    cpus: 1,
    workerThreads: false,
    memoryBasedWorkersCount: true,
  },
};

export default nextConfig;
