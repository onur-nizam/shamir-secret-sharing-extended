import { describe, it, expect } from "vitest";
import { split, type Share } from "../src/core/split";
import { combine } from "../src/core/combine";
import { makeDeterministicRng } from "../src/core/rng";

/**
 * Test scope:
 * - Shape & validation: distinct indices, same bytes length, non-empty, etc.
 * - Order independence: combine should work regardless of share order.
 * - Happy-path correctness: with >= threshold shares, secret reconstructs exactly.
 * - Note: We do NOT attempt to prove secrecy with <threshold shares here;
 *   cryptographic guarantees are out of scope for unit tests.
 */

describe("combine() validation", () => {
  it("throws when given no shares", () => {
    expect(() => combine([] as any)).toThrow();
    expect(() => combine([])).toThrow();
  });

  it("throws on duplicate share indices", () => {
    const secret = new Uint8Array([1, 2, 3]);
    const shares = split(secret, { threshold: 2, shares: 3, rng: makeDeterministicRng(7) });

    // Force a duplicate index by cloning first share but keeping bytes same length
    const dup: Share = { index: shares[0]!.index, bytes: new Uint8Array(shares[1]!.bytes) };
    expect(() => combine([shares[0]!, dup, shares[2]!])).toThrow();
  });

  it("throws on mismatched bytes length across shares", () => {
    const secret = new Uint8Array([1, 2, 3, 4]);
    const [a, b, c] = split(secret, { threshold: 2, shares: 3, rng: makeDeterministicRng(99) });

    // Make b's bytes length different (truncate or extend)
    const bBad: Share = { index: b.index, bytes: b.bytes.slice(0, 2) };
    expect(() => combine([a, bBad, c])).toThrow();
  });
});

describe("combine() correctness", () => {
  it("reconstructs with exactly threshold shares (order independent)", () => {
    const secret = new TextEncoder().encode("threshold-3-of-5");
    const t = 3, n = 5;

    const shares = split(secret, { threshold: t, shares: n, rng: makeDeterministicRng(1337) });

    // pick a nontrivial order: [4th, 1st, 5th]
    const subset = [shares[3]!, shares[0]!, shares[4]!];

    const recovered = combine(subset);
    expect(Array.from(recovered)).toEqual(Array.from(secret));

    // Try another random order with different indices
    const subset2 = [shares[2]!, shares[1]!, shares[4]!];
    const recovered2 = combine(subset2);
    expect(Array.from(recovered2)).toEqual(Array.from(secret));
  });

  it("reconstructs with all n shares as well", () => {
    const secret = new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253, 254, 255]);
    const t = 4, n = 7;

    const shares = split(secret, { threshold: t, shares: n, rng: makeDeterministicRng(2025) });
    const recovered = combine(shares); // use all n
    expect(Array.from(recovered)).toEqual(Array.from(secret));
  });
});
