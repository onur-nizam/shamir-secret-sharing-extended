import { describe, it, expect } from "vitest";
import {
  getRandomBytes,
  fillRandomBytes,
  makeDeterministicRng,
  defaultRng
} from "../src/core/rng";

describe("rng.ts", () => {
  it("getRandomBytes returns Uint8Array of correct length", () => {
    const arr = getRandomBytes(16);
    expect(arr).toBeInstanceOf(Uint8Array);
    expect(arr.length).toBe(16);
  });

  it("getRandomBytes(0) returns empty array", () => {
    const arr = getRandomBytes(0);
    expect(arr.length).toBe(0);
  });

  it("getRandomBytes throws on invalid length", () => {
    // negative
    expect(() => getRandomBytes(-5 as any)).toThrow();
    // float
    expect(() => getRandomBytes(3.14 as any)).toThrow();
  });

  it("fillRandomBytes fills provided buffer", () => {
    const buf = new Uint8Array(8);
    fillRandomBytes(buf);
    // Not guaranteed to change *all* bytes, but extremely unlikely to be all zeros.
    const allZero = buf.every((b) => b === 0);
    expect(allZero).toBe(false);
  });

  it("makeDeterministicRng produces reproducible sequence", () => {
    const rngA = makeDeterministicRng(1234);
    const rngB = makeDeterministicRng(1234);
    const out1 = rngA(16);
    const out2 = rngB(16);
    expect(Array.from(out1)).toEqual(Array.from(out2));
  });

  it("makeDeterministicRng different seeds produce different sequences", () => {
    const rng1 = makeDeterministicRng(1);
    const rng2 = makeDeterministicRng(2);
    const out1 = rng1(16);
    const out2 = rng2(16);
    // Not guaranteed to differ in every byte, but unlikely to be identical arrays
    expect(Array.from(out1)).not.toEqual(Array.from(out2));
  });

  it("defaultRng delegates to getRandomBytes", () => {
    const arr = defaultRng(8);
    expect(arr).toBeInstanceOf(Uint8Array);
    expect(arr.length).toBe(8);
  });
});
