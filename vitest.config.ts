import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The modules under test are plain TypeScript with no Astro or Vite
    // integration, so no getViteConfig() wrapper is needed.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
