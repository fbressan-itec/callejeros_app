import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No generar frontend/AGENTS.md: las reglas para IAs están en el AGENTS.md de la raíz
  // (incluido el aviso de leer la guía de Next en node_modules/next/dist/docs/).
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
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
