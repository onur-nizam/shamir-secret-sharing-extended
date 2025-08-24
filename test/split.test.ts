// File: test/split.test.ts
import { describe, it, expect } from "vitest";
import { split, type Share } from "../src/core/split";
import { makeDeterministicRng } from "../src/core/rng";
import { lagrangeInterpolateAtZero } from "../src/core/polynomial";

/**
 * Test strategy (high level):
 * 1) Shape/validation:
 *    - split() returns exactly `n` shares
 *    - each share has a distinct nonzero index in [1..255]
 *    - each share.bytes length equals the secret length
 *    - throws on invalid inputs (empty secret, t>n, x=0, duplicate x, etc.)
 *
 * 2) Determinism (with injected RNG):
 *    - Using a deterministic RNG (xorshift32) ensures reproducible output:
 *      two splits with the same seed, secret, threshold, and xValues
 *      should yield identical shares.
 *
 * 3) Reconstruction soundness (via Lagrange at x=0):
 *    - With ANY subset of size `t` from the produced shares, reconstruct
 *      the secret byte-wise using Lagrange interpolation at x=0.
 *      The recovered secret must exactly equal the original secret.
 *
 * Notes:
 * - We are not testing cryptographic strength here (out of scope).
 * - We avoid using a full "combine.ts" until it's implemented; instead,
 *   we directly use `lagrangeInterpolateAtZero` from the polynomial module.
 */

// Small helper to reconstruct the secret bytes from a subset of shares.
// This emulates what `combine` will do internally.
function reconstructFromShares(subset: Share[], secretLen: number): Uint8Array {
  const out = new Uint8Array(secretLen);
  const xs = subset.map((s) => s.index);

  for (let pos = 0; pos < secretLen; pos++) {
    const ys = subset.map((s) => s.bytes[pos] & 0xff);
    out[pos] = lagrangeInterpolateAtZero(xs, ys) & 0xff;
  }
  return out;
}

describe("split() shape and validation", () => {
  it("returns n shares; each share.index is distinct, nonzero, and bytes length matches secret", () => {
    const secret = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const t = 3, n = 5;

    const shares = split(secret, { threshold: t, shares: n });
    expect(shares.length).toBe(n);

    const seen = new Uint8Array(256);
    for (const sh of shares) {
      // index in [1..255]
      expect(sh.index).toBeGreaterThanOrEqual(1);
      expect(sh.index).toBeLessThanOrEqual(255);
      // distinctness
      expect(seen[sh.index]).toBe(0);
      seen[sh.index] = 1;
      // bytes length equals secret length
      expect(sh.bytes.length).toBe(secret.length);
    }
  });

  it("accepts custom xValues when valid", () => {
    const secret = new Uint8Array([1, 2, 3]);
    const t = 2, n = 3;
    const xValues = [10, 20, 30];

    const shares = split(secret, { threshold: t, shares: n, xValues });
    expect(shares.map((s) => s.index)).toEqual(xValues);
  });

  it("throws on empty secret", () => {
    expect(() => split(new Uint8Array([]), { threshold: 2, shares: 3 }))
      .toThrow();
  });

  it("throws when threshold > shares", () => {
    const secret = new Uint8Array([1]);
    expect(() => split(secret, { threshold: 4, shares: 3 }))
      .toThrow();
  });

  it("throws on invalid xValues (wrong length / out-of-range / duplicate / zero)", () => {
    const secret = new Uint8Array([1, 2]);
    // wrong length
    expect(() => split(secret, { threshold: 2, shares: 3, xValues: [1, 2] as any }))
      .toThrow();

    // zero is forbidden (x=0 reveals constant term directly)
    expect(() => split(secret, { threshold: 2, shares: 2, xValues: [0, 2] }))
      .toThrow();

    // out of range (>255)
    expect(() => split(secret, { threshold: 2, shares: 2, xValues: [1, 256] as any }))
      .toThrow();

    // duplicate x
    expect(() => split(secret, { threshold: 2, shares: 3, xValues: [5, 5, 7] }))
      .toThrow();
  });
});

describe("split() determinism with injected RNG (TEST-ONLY)", () => {
  it("same seed + same inputs => identical shares", () => {
    const secret = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
    const t = 3, n = 5;
    const xValues = [1, 2, 3, 4, 5];

    const rng1 = makeDeterministicRng(42);
    const rng2 = makeDeterministicRng(42);

    const A = split(secret, { threshold: t, shares: n, xValues, rng: rng1 });
    const B = split(secret, { threshold: t, shares: n, xValues, rng: rng2 });

    expect(A.length).toBe(B.length);
    for (let i = 0; i < A.length; i++) {
      expect(A[i]!.index).toBe(B[i]!.index);
      expect(Array.from(A[i]!.bytes)).toEqual(Array.from(B[i]!.bytes));
    }
  });

  it("different seeds => different shares (very likely)", () => {
    const secret = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
    const t = 2, n = 3;

    const A = split(secret, { threshold: t, shares: n, rng: makeDeterministicRng(1) });
    const B = split(secret, { threshold: t, shares: n, rng: makeDeterministicRng(2) });

    // Not guaranteed to differ in every byte, but arrays should not be identical overall
    const equal =
      A.length === B.length &&
      A.every((sa, i) => sa.index === B[i]!.index &&
        Array.from(sa.bytes).every((b, j) => b === B[i]!.bytes[j]));
    expect(equal).toBe(false);
  });
});

describe("split() + Lagrange at zero => perfect reconstruction from any t shares", () => {
  it("reconstructs the secret from the first t shares", () => {
    const secret = new TextEncoder().encode("shamir-sss-core");
    const t = 3, n = 6;

    const shares = split(secret, { threshold: t, shares: n, rng: makeDeterministicRng(1337) });
    const subset = shares.slice(0, t);
    const recovered = reconstructFromShares(subset, secret.length);

    expect(Array.from(recovered)).toEqual(Array.from(secret));
  });

  it("reconstructs the secret from a random t-subset (indices not consecutive)", () => {
    const secret = new Uint8Array([0, 1, 2, 3, 4, 5, 250, 251, 252, 253, 254, 255]);
    const t = 4, n = 8;

    const shares = split(secret, { threshold: t, shares: n, rng: makeDeterministicRng(9001) });
    // pick a nontrivial subset, e.g., [n-1, 1, 3, 6]
    const subset = [shares[7]!, shares[1]!, shares[3]!, shares[6]!];
    const recovered = reconstructFromShares(subset, secret.length);

    expect(Array.from(recovered)).toEqual(Array.from(secret));
  });
});
