// <reference types="vitest/config" />
import type { UserConfig } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./tests/setup.ts"],
      include: ["tests/**/*.test.{ts,tsx}"],
      restoreMocks: true,
      clearMocks: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/routeTree.gen.ts", "src/routes/**", "src/router.tsx", "src/start.ts"],
      },
    },
  } as unknown as UserConfig,
});
