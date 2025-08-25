// vitest.config.ts
// Ensure Web Crypto API is available in Node (16/18/20) before Vitest starts
import { webcrypto } from "node:crypto";

// Top-level polyfill: must run before Vite/Vitest boot
if (!(globalThis as any).crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],   // ekstra setup gerekirse burada
    include: ["test/**/*.test.ts"],
    reporters: "default",
  },
});
