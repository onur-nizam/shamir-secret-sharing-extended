/**
 * GF(2^8) finite field (also known as GF(256)) core operations.
 *
 * - Reduction polynomial: x^8 + x^4 + x^3 + x + 1  (0x11b)
 * - This is the same field used in AES and many cryptographic systems.
 * - Zero-dependency: works in both Node.js (>=16) and modern browsers.
 *
 * Field properties:
 * - Elements are bytes in the range [0, 255].
 * - Addition and subtraction are XOR (bitwise ⊕).
 * - Multiplication is done modulo the irreducible polynomial.
 * - Every nonzero element has a multiplicative inverse.
 *
 * Why this matters:
 * Shamir’s Secret Sharing requires evaluating and interpolating polynomials
 * over a finite field. GF(256) is commonly chosen because:
 *   - It aligns naturally with byte-oriented data.
 *   - It provides strong mathematical guarantees.
 *   - It is efficient on modern CPUs.
 */

export type Byte = number; // Values restricted to [0..255].

/** Irreducible polynomial used for reduction: 0x11b */
export const IRREDUCIBLE = 0x11b as const;

/** Ensures result is within [0..255] */
export function toByte(n: number): Byte {
  return n & 0xff;
}

/**
 * Asserts that a given number is a valid byte (0..255).
 * Helps catch logic errors early.
 */
export function assertByte(n: number, name = "value"): asserts n is Byte {
  if (!Number.isInteger(n) || n < 0 || n > 255) {
    throw new RangeError(`${name} must be an integer in [0,255], got ${n}`);
  }
}

/**
 * Addition in GF(256).
 * Implemented as XOR since this is characteristic-2 field.
 */
export function add(a: Byte, b: Byte): Byte {
  return (a ^ b) & 0xff;
}

/**
 * Subtraction in GF(256).
 * Same as addition (a ⊕ b), because -1 = 1 in GF(2).
 */
export const sub = add;

/**
 * xtime(a): multiply by x (i.e., left shift by 1) modulo the irreducible polynomial.
 * - If the left shift overflows (carry bit set), we reduce by XOR with 0x1b
 *   (which is 0x11b - 0x100, the low 8 bits of the polynomial).
 */
export function xtime(a: Byte): Byte {
  const carry = a & 0x80;
  let res = (a << 1) & 0xff;
  if (carry) res ^= 0x1b;
  return res;
}

/**
 * Multiplication in GF(256) using the "Russian peasant" algorithm:
 * - Iteratively check lowest bit of multiplier.
 * - Add (XOR) multiplicand when bit is set.
 * - Shift multiplicand with xtime, halve multiplier.
 */
export function mul(a: Byte, b: Byte): Byte {
  let x = a & 0xff;
  let y = b & 0xff;
  let product = 0;
  while (y) {
    if (y & 1) product ^= x;
    x = xtime(x);
    y >>>= 1;
  }
  return product & 0xff;
}

/**
 * Exponentiation in GF(256) using exponentiation by squaring.
 * - Efficiently computes a^e (mod 0x11b).
 */
export function pow(a: Byte, e: number): Byte {
  if (e < 0 || !Number.isInteger(e)) {
    throw new RangeError(`exponent must be a non-negative integer, got ${e}`);
  }
  let result: Byte = 1;
  let base: Byte = a & 0xff;
  let exp = e >>> 0;
  while (exp > 0) {
    if (exp & 1) result = mul(result, base);
    base = mul(base, base);
    exp >>>= 1;
  }
  return result & 0xff;
}

/**
 * Multiplicative inverse in GF(256).
 * - By Fermat’s little theorem: a^(255) = 1 for nonzero a.
 * - So inverse is a^(254).
 * - Throws if a = 0 (no inverse exists).
 */
export function inv(a: Byte): Byte {
  a &= 0xff;
  if (a === 0) throw new RangeError("inverse of 0 does not exist in GF(256)");
  return pow(a, 254);
}

/**
 * Division in GF(256): a / b = a * (b^-1).
 * - Throws if b = 0.
 */
export function div(a: Byte, b: Byte): Byte {
  const bi = inv(b & 0xff);
  return mul(a & 0xff, bi);
}

/**
 * Polynomial evaluation using Horner’s method:
 * P(x) = c0 + c1*x + c2*x^2 + ... + cn*x^n
 * - Coefficients and x are elements of GF(256).
 */
export function evalPoly(coeffs: ReadonlyArray<Byte>, x: Byte): Byte {
  let y: Byte = 0;
  const xx = x & 0xff;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    y = add(mul(y, xx), coeffs[i] & 0xff);
  }
  return y & 0xff;
}

/** Useful constants */
export const ZERO: Byte = 0x00;
export const ONE: Byte = 0x01;

/**
 * Optional grouped export for convenience.
 */
const GF256 = Object.freeze({
  IRREDUCIBLE,
  toByte,
  assertByte,
  add,
  sub,
  xtime,
  mul,
  pow,
  inv,
  div,
  evalPoly,
  ZERO,
  ONE,
});
export default GF256;
