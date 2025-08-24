/**
 * Shamir's Secret Sharing — split (secret -> shares)
 *
 * Design:
 * - Work byte-wise over GF(256). For each byte of the secret, construct an
 *   independent random polynomial of degree (threshold - 1) whose constant term
 *   equals the secret byte. Evaluate that polynomial at distinct nonzero x-values
 *   to produce shares. Each share carries the same x, but a different y-array
 *   formed by concatenating all byte-wise evaluations.
 *
 * Security notes:
 * - Uses CSPRNG by default (Web Crypto). Callers may inject an RNG for tests.
 * - Never use x = 0 for shares (P(0) is the secret).
 * - Distinct x-values are REQUIRED. We default to [1,2,...,n] which is safe.
 *
 * Constraints:
 * - 1 <= threshold <= shares <= 255
 * - secret must be a non-empty Uint8Array
 */

import type { RNG } from "./rng.js";
import { defaultRng } from "./rng.js";
import type { Byte } from "./gf256.js";
import { evalPoly } from "./polynomial.js";
import { buildPolynomial } from "./polynomial.js";

/** A single Shamir share: x-coordinate and y-bytes (same length as secret). */
export interface Share {
  /** Distinct, nonzero x in [1..255]. */
  index: Byte;
  /** Evaluated bytes for all secret positions. Length === secret.length */
  bytes: Uint8Array;
}

export interface SplitOptions {
  /** Threshold t (minimum shares to reconstruct). */
  threshold: number;
  /** Total number of shares n to produce. */
  shares: number;
  /**
   * Distinct nonzero x values to use (length must equal `shares`).
   * Defaults to [1,2,...,n]. Never include 0 here.
   */
  xValues?: number[];
  /** RNG to use (defaults to cryptographically secure Web Crypto). */
  rng?: RNG;
}

/**
 * Split a secret into `n` shares with threshold `t` over GF(256).
 *
 * @param secret  Raw secret bytes (Uint8Array). Must be non-empty.
 * @param opts    SplitOptions (threshold, shares, optional rng and xValues).
 * @returns       Array<Share> of length `n`.
 */
export function split(secret: Uint8Array, opts: SplitOptions): Share[] {
  if (!(secret instanceof Uint8Array)) {
    throw new TypeError("secret must be a Uint8Array");
  }
  if (secret.length === 0) {
    throw new RangeError("secret must not be empty");
  }

  const t = opts.threshold | 0;
  const n = opts.shares | 0;

  if (!Number.isInteger(t) || !Number.isInteger(n)) {
    throw new RangeError("threshold and shares must be integers");
  }
  if (t < 1) throw new RangeError("threshold must be >= 1");
  if (n < 1 || n > 255) throw new RangeError("shares must be in [1, 255]");
  if (t > n) throw new RangeError("threshold cannot exceed shares");

  const rng = opts.rng ?? defaultRng;

  // Prepare x-values (distinct, nonzero).
  let xVals: number[];
  if (opts.xValues) {
    if (!Array.isArray(opts.xValues) || opts.xValues.length !== n) {
      throw new RangeError("xValues must be an array of length equal to `shares`");
    }
    xVals = opts.xValues.map((x, i) => {
      if (!Number.isInteger(x) || x < 1 || x > 255) {
        throw new RangeError(`xValues[${i}] must be an integer in [1,255], got ${x}`);
      }
      return x & 0xff;
    });
    // Distinctness check
    const seen = new Uint8Array(256);
    for (let i = 0; i < xVals.length; i++) {
      const x = xVals[i]!;
      if (seen[x]) throw new RangeError(`xValues contain duplicates (value ${x} at index ${i})`);
      seen[x] = 1;
    }
  } else {
    // Default to consecutive x-values starting at 1 (never 0).
    xVals = Array.from({ length: n }, (_, i) => (i + 1) & 0xff);
  }

  // Initialize output shares
  const out: Share[] = xVals.map((x) => ({
    index: x as Byte,
    bytes: new Uint8Array(secret.length),
  }));

  // For each byte position, build a random degree-(t-1) polynomial P_i(x)
  // with constant term secret[i], then evaluate at all xVals.
  const degree = t - 1;

  for (let pos = 0; pos < secret.length; pos++) {
    const sByte: Byte = secret[pos]! & 0xff;
    // P_pos(x) = sByte + a1*x + ... + a_degree*x^degree
    const coeffs = buildPolynomial(sByte, degree, rng);

    // Evaluate at all chosen x-values
    for (let j = 0; j < n; j++) {
      const x = out[j]!.index;
      out[j]!.bytes[pos] = evalPoly(coeffs, x);
    }
  }

  return out;
}

export default split;
