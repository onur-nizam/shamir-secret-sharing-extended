import { describe, it, expect } from "vitest";
import { split } from "../src/core/split";
import { combine } from "../src/core/combine";
import { makeDeterministicRng } from "../src/core/rng";

/**
 * Integration tests: split + combine round-trip.
 * For various (t, n) configurations and secrets, ensure that:
 *  - Any subset of size t reconstructs the original secret exactly.
 *  - Using all n shares also reconstructs exactly.
 */

function pickSubset<T>(arr: T[], k: number, idxs: number[]): T[] {
  return idxs.map((i) => arr[i]!);
}

describe("split + combine round-trip", () => {
  it("3-of-5 round-trip with ASCII secret", () => {
    const secret = new TextEncoder().encode("shamir-sss-core");
    const t = 3, n = 5;

    const shares = split(secret, { threshold: t, shares: n, rng: makeDeterministicRng(4242) });

    // Try multiple t-subsets
    for (const subsetIdxs of [
      [0, 1, 2],
      [1, 3, 4],
      [0, 2, 4]
    ]) {
      const recovered = combine(pickSubset(shares, t, subsetIdxs));
      expect(Array.from(recovered)).toEqual(Array.from(secret));
    }

    // Use all shares
    const recoveredAll = combine(shares);
    expect(Array.from(recoveredAll)).toEqual(Array.from(secret));
  });

  it("4-of-8 round-trip with full byte-range secret", () => {
    const secret = new Uint8Array(Array.from({ length: 32 }, (_, i) => (i * 7) & 0xff));
    const t = 4, n = 8;

    const shares = split(secret, { threshold: t, shares: n, rng: makeDeterministicRng(777) });

    for (const subsetIdxs of [
      [0, 1, 2, 3],
      [1, 3, 5, 7],
      [0, 2, 4, 6]
    ]) {
      const recovered = combine(pickSubset(shares, t, subsetIdxs));
      expect(Array.from(recovered)).toEqual(Array.from(secret));
    }

    const recoveredAll = combine(shares);
    expect(Array.from(recoveredAll)).toEqual(Array.from(secret));
  });
});
