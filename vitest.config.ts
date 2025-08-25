import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],   // <-- burası önemli
    include: ["test/**/*.test.ts"],
    reporters: "default",
  },
});