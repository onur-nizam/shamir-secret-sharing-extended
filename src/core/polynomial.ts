/**
 * Polynomial helpers for GF(2^8) used by Shamir's Secret Sharing.
 *
 * What this file provides:
 * - Lagrange interpolation (general x and specifically x = 0).
 * - Small helpers for building/evaluating polynomials over GF(256).
 *
 * Why interpolate at x = 0?
 * - In Shamir's Secret Sharing, the secret is the constant term P(0).
 * - When combining shares, we only need P(0). Interpolating directly at 0
 *   is simpler/faster than reconstructing the whole polynomial.
 *
 * Field notes:
 * - We work over GF(256) (bytes 0..255) with the AES polynomial (0x11b).
 * - Addition/subtraction is XOR. Division uses multiplicative inverse.
 */

import {
  Byte,
  add,
  mul,
  div,
  evalPoly as evalPolyGF,
  ZERO,
} from "./gf256.js";

/** A polynomial represented by its coefficients:
 *  P(x) = coeffs[0] + coeffs[1]*x + ... + coeffs[n]*x^n
 *  All coefficients are in GF(256).
 */
export type Polynomial = ReadonlyArray<Byte>;

/**
 * Evaluate a polynomial P at x over GF(256).
 * Thin wrapper over gf256.evalPoly to keep imports cohesive in core layer.
 */
export function evalPoly(coeffs: Polynomial, x: Byte): Byte {
  return evalPolyGF(coeffs, x & 0xff);
}

/**
 * Ensure all x-coordinates are distinct (a Shamir requirement).
 * Throws if a duplicate is found.
 */
export function assertDistinctXs(xs: ReadonlyArray<Byte>): void {
  const seen = new Uint8Array(256);
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i] & 0xff;
    if (seen[x]) {
      throw new RangeError(`duplicate x detected at index ${i}: ${x}`);
    }
    seen[x] = 1;
  }
}

/**
 * Compute Lagrange basis coefficient L_i(X) evaluated at a specific X:
 *
 *      L_i(X) = Π_{j != i} (X - x_j) / (x_i - x_j)
 *
 * Over GF(256):
 * - (X - x) == (X ⊕ x) because subtraction is XOR in characteristic 2.
 * - Division is multiplication by inverse.
 *
 * Preconditions:
 * - xs must be distinct (checked by caller or via assertDistinctXs).
 */
export function lagrangeBasisAtX(
  xs: ReadonlyArray<Byte>,
  i: number,
  X: Byte
): Byte {
  const Xi = X & 0xff;
  const xi = xs[i] & 0xff;
  let num: Byte = 1;
  let den: Byte = 1;

  for (let j = 0; j < xs.length; j++) {
    if (j === i) continue;
    const xj = xs[j] & 0xff;

    // (X - xj) ≡ (X ⊕ xj) in GF(256)
    const termNum = add(Xi, xj);
    // (xi - xj) ≡ (xi ⊕ xj)
    const termDen = add(xi, xj);

    if (termDen === ZERO) {
      // This can only happen if xi == xj, which should be prevented by distinct xs.
      throw new RangeError(`invalid denominator (xi == xj) at i=${i}, j=${j}`);
    }

    num = mul(num, termNum);
    den = mul(den, termDen);
  }

  // L_i(X) = num / den
  return den === ZERO ? ZERO : div(num, den);
}

/**
 * Lagrange interpolation at a general X:
 *
 *    P(X) = Σ_i ( y_i * L_i(X) )
 *
 * Where L_i(X) is defined as in lagrangeBasisAtX.
 *
 * Preconditions:
 * - shares.length >= 1
 * - xs are distinct
 */
export function lagrangeInterpolateAtX(
  xs: ReadonlyArray<Byte>,
  ys: ReadonlyArray<Byte>,
  X: Byte
): Byte {
  if (xs.length !== ys.length) {
    throw new RangeError(`xs and ys length mismatch: ${xs.length} vs ${ys.length}`);
  }
  if (xs.length === 0) {
    throw new RangeError("at least one share required");
  }

  assertDistinctXs(xs);

  let acc: Byte = 0;
  for (let i = 0; i < xs.length; i++) {
    const Li = lagrangeBasisAtX(xs, i, X);
    acc = add(acc, mul(ys[i] & 0xff, Li));
  }
  return acc & 0xff;
}

/**
 * Optimized form: Lagrange interpolation specifically at X = 0.
 *
 * For X = 0, the basis simplifies:
 *    L_i(0) = Π_{j != i} (0 - x_j) / (x_i - x_j)
 *           = Π_{j != i} (x_j) / (x_i ⊕ x_j)
 *
 * Then:
 *    P(0) = Σ_i ( y_i * L_i(0) )
 *
 * This is exactly what Shamir combine needs: the secret (constant term).
 */
export function lagrangeInterpolateAtZero(
  xs: ReadonlyArray<Byte>,
  ys: ReadonlyArray<Byte>
): Byte {
  if (xs.length !== ys.length) {
    throw new RangeError(`xs and ys length mismatch: ${xs.length} vs ${ys.length}`);
  }
  if (xs.length === 0) {
    throw new RangeError("at least one share required");
  }

  assertDistinctXs(xs);

  let secret: Byte = 0;
  const k = xs.length;

  for (let i = 0; i < k; i++) {
    const xi = xs[i] & 0xff;

    let num: Byte = 1; // numerator: Π_{j != i} x_j
    let den: Byte = 1; // denominator: Π_{j != i} (xi ⊕ x_j)

    for (let j = 0; j < k; j++) {
      if (j === i) continue;
      const xj = xs[j] & 0xff;

      num = mul(num, xj);

      const denomTerm = add(xi, xj);
      if (denomTerm === ZERO) {
        // This can only happen if xi == xj, which should be prevented by distinct xs.
        throw new RangeError(`invalid denominator (xi == xj) at i=${i}, j=${j}`);
      }
      den = mul(den, denomTerm);
    }

    const Li0 = div(num, den);       // L_i(0)
    const term = mul(ys[i] & 0xff, Li0);
    secret = add(secret, term);       // sum_i y_i * L_i(0)
  }

  return secret & 0xff;
}

/**
 * Build a random polynomial of given degree over GF(256) with a fixed constant term.
 * P(x) = secret + a1*x + a2*x^2 + ... + ad*x^d
 *
 * Notes:
 * - The RNG is injected for testability/determinism (prod should use CSPRNG).
 * - Callers may ensure highest-degree coefficient is nonzero if they require
 *   the polynomial to have *exact* degree d. For Shamir, it's acceptable if
 *   the drawn random ends up zero; secrecy still holds.
 */
export function buildPolynomial(
  secret: Byte,
  degree: number,
  rng: (len: number) => Uint8Array
): Polynomial {
  if (!Number.isInteger(degree) || degree < 0) {
    throw new RangeError(`degree must be a non-negative integer, got ${degree}`);
  }
  const coeffs = new Uint8Array(degree + 1);
  coeffs[0] = secret & 0xff;
  if (degree > 0) {
    const r = rng(degree);
    if (r.length < degree) {
      throw new RangeError(`rng returned insufficient bytes: ${r.length} < ${degree}`);
    }
    for (let i = 0; i < degree; i++) {
      coeffs[i + 1] = r[i] & 0xff;
    }
  }
  return coeffs as unknown as Polynomial;
}
