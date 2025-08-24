/**
 * Shamir's Secret Sharing — combine (shares -> secret)
 *
 * Design:
 * - Each share is (x, bytes[]) where x ∈ [1..255] and bytes[].length equals the
 *   original secret length. To reconstruct the secret, for each byte position `p`
 *   we take the set of points {(x_i, y_i[p])} and evaluate the unique polynomial
 *   that passes through them at X = 0 using Lagrange interpolation:
 *
 *       secret[p] = P_p(0) = Σ_i y_i[p] * L_i(0),
 *       L_i(0) = Π_{j!=i} (x_j) / (x_i ⊕ x_j)   over GF(256)
 *
 * Validation:
 * - At least one share required.
 * - All x (indices) must be distinct and in [1..255].
 * - All shares must have the same non-zero bytes length.
 *
 * Notes:
 * - The caller MUST supply at least `threshold` shares (the combine function
 *   cannot know the original threshold). With fewer than `t` shares, the result
 *   is not guaranteed to equal the original secret.
 */

import type { Byte } from "./gf256.js";
import { lagrangeInterpolateAtZero } from "./polynomial.js";
import type { Share } from "./split.js"; // type-only import; no runtime dependency

/** Combine any >= t valid shares into the original secret bytes. */
export function combine(shares: ReadonlyArray<Share>): Uint8Array {
  if (!Array.isArray(shares) || shares.length === 0) {
    throw new RangeError("combine requires at least one share");
  }

  // Validate indices and determine secret length
  const seen = new Uint8Array(256);
  let secretLen = -1;

  for (let i = 0; i < shares.length; i++) {
    const sh = shares[i]!;
    // Basic shape
    if (!(sh.bytes instanceof Uint8Array)) {
      throw new TypeError(`share[${i}].bytes must be a Uint8Array`);
    }
    if (!Number.isInteger(sh.index) || sh.index < 1 || sh.index > 255) {
      throw new RangeError(`share[${i}].index must be an integer in [1,255]`);
    }
    if (seen[sh.index]) {
      throw new RangeError(`duplicate share index detected: ${sh.index}`);
    }
    seen[sh.index] = 1;

    // Length coherence
    if (secretLen < 0) {
      secretLen = sh.bytes.length;
    } else if (sh.bytes.length !== secretLen) {
      throw new RangeError(
        `all shares must have the same bytes length; got ${secretLen} and ${sh.bytes.length} at index ${i}`
      );
    }
  }

  if (secretLen <= 0) {
    throw new RangeError("shares must contain non-empty byte arrays");
  }

  // Collect x's once; order of shares does not matter.
  const xs: Byte[] = shares.map((s) => s.index & 0xff);

  // Reconstruct each byte position independently using Lagrange at zero.
  const out = new Uint8Array(secretLen);
  for (let pos = 0; pos < secretLen; pos++) {
    const ys: Byte[] = shares.map((s) => s.bytes[pos] & 0xff);
    out[pos] = lagrangeInterpolateAtZero(xs, ys) & 0xff;
  }
  return out;
}

export default combine;
