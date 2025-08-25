// test/setup.ts
// Ensure Web Crypto exists in Node test runs (Node 16/18/20)
import { webcrypto } from "node:crypto";

// Define once, but allow override if needed
if (!(globalThis as any).crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}