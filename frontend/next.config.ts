import path from "node:path";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Un solo .env para todo el proyecto: el de la raíz del repo (como el back).
// Solo las variables NEXT_PUBLIC_* llegan al navegador; el resto queda en el servidor.
// Con Docker, las variables llegan por env_file y este archivo no hace falta.
loadEnvConfig(path.resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  // No generar frontend/AGENTS.md: las reglas para IAs están en el AGENTS.md de la raíz
  // (incluido el aviso de leer la guía de Next en node_modules/next/dist/docs/).
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_MOCK_VERIFICATION_CODE: process.env.MOCK_VERIFICATION_CODE,
  },
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
