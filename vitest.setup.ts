// Provide Web Crypto in Node (16/18/20) for tests
import { webcrypto } from "node:crypto";

if (!(globalThis as any).crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}