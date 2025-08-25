export default defineConfig({
  test: {
    environment: "node",            
    setupFiles: ["./vitest.setup.ts"],
  },
});
