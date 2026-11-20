import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Configuración según la guía de Next 16 (node_modules/next/dist/docs/.../testing/vitest.md).
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Simula un navegador para poder dibujar componentes en los tests.
    environment: "jsdom",
    // Suma comprobaciones como toBeInTheDocument() a expect().
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
