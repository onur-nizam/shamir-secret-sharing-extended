/**
 * Cryptographically secure RNG utilities (zero-dependency).
 *
 * Design goals:
 * - Use Web Crypto (browser: `crypto.getRandomValues`, Node: `globalThis.crypto` in Node ≥18).
 * - In Node 16/ESM, import { webcrypto } from "node:crypto".
 * - Never fall back to Math.random or any insecure source.
 * - Provide a deterministic RNG factory for tests/benchmarks only.
 */

import { webcrypto as nodeCrypto } from "node:crypto";

export type RNG = (len: number) => Uint8Array;

/** Narrow typing for Web Crypto we need. */
type WebCryptoLike = {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
};

/**
 * Resolve a WebCrypto-like provider at runtime.
 * Throws if a secure provider is not available.
 */
function resolveWebCrypto(): WebCryptoLike {
  // 1) Browser & modern Node (≥18) expose `globalThis.crypto`
  const g: any = typeof globalThis !== "undefined" ? globalThis : undefined;
  const c = g?.crypto;
  if (c && typeof c.getRandomValues === "function") {
    return c as WebCryptoLike;
  }

  // 2) Node (16+) fallback via node:crypto import
  if (nodeCrypto && typeof nodeCrypto.getRandomValues === "function") {
    return nodeCrypto as WebCryptoLike;
  }

  throw new Error(
    "Secure Web Crypto RNG is not available. " +
      "This library requires `crypto.getRandomValues` (browser) or Node.js >=16 with `node:crypto`."
  );
}

/** Cached provider to avoid repeated resolution. */
let _wc: WebCryptoLike | null = null;
function wc(): WebCryptoLike {
  if (_wc) return _wc;
  _wc = resolveWebCrypto();
  return _wc;
}

/**
 * Fill the given Uint8Array with cryptographically strong random bytes.
 */
export function fillRandomBytes(buf: Uint8Array): void {
  if (!(buf instanceof Uint8Array)) {
    throw new TypeError("fillRandomBytes expects a Uint8Array");
  }
  wc().getRandomValues(buf);
}

/**
 * Allocate and return a Uint8Array of length `len` filled with CSPRNG bytes.
 */
export function getRandomBytes(len: number): Uint8Array {
  if (!Number.isInteger(len) || len < 0) {
    throw new RangeError(
      `getRandomBytes length must be a non-negative integer, got ${len}`
    );
  }
  const out = new Uint8Array(len);
  if (len > 0) fillRandomBytes(out);
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * TEST-ONLY deterministic RNG
 * ------------------------------------------------------------------------------------------------
 * Useful for unit tests and reproducible benchmarks where you need stable output.
 * This is NOT cryptographically secure. Do not use in production paths.
 */

/**
 * Create a deterministic byte generator from a 32-bit seed using xorshift32.
 * WARNING: For TESTS ONLY — never use in production.
 */
export function makeDeterministicRng(seed32: number): RNG {
  let s = (seed32 >>> 0) || 0xdeadbeef; // avoid zero state
  return (len: number) => {
    if (!Number.isInteger(len) || len < 0) {
      throw new RangeError(
        `RNG length must be a non-negative integer, got ${len}`
      );
    }
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      // xorshift32 step
      s ^= (s << 13) >>> 0;
      s ^= (s >>> 17);
      s ^= (s << 5) >>> 0;
      out[i] = s & 0xff;
    }
    return out;
  };
}

/**
 * Convenience: the library's default CSPRNG function.
 */
export const defaultRng: RNG = (len: number) => getRandomBytes(len);
