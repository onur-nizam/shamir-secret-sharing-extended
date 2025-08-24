import { describe, it, expect } from "vitest"; // Jest kullanıyorsanız: from '@jest/globals'
import GF256, {
  Byte,
  add,
  sub,
  mul,
  div,
  inv,
  pow,
  xtime,
  evalPoly,
  ZERO,
  ONE,
} from "../src/core/gf256";

/**
 * Helper: clamp to byte (0..255) explicitly when needed in tests.
 */
const b = (n: number): Byte => (n & 0xff);

/**
 * Basic sanity tests for constants and type helpers.
 */
describe("GF(256) basics", () => {
  it("constants should be bytes", () => {
    expect(ZERO).toBe(0x00);
    expect(ONE).toBe(0x01);
    expect(GF256.IRREDUCIBLE).toBe(0x11b);
  });

  it("toByte clamps values into [0..255]", () => {
    expect(GF256.toByte(300)).toBe(44); // 300 & 0xff = 44
    expect(GF256.toByte(-1)).toBe(255);
    expect(GF256.toByte(256)).toBe(0);
  });
});

/**
 * Addition/Subtraction (XOR) properties.
 */
describe("add/sub (XOR) properties", () => {
  it("add is XOR and sub equals add", () => {
    for (let a = 0; a < 256; a += 37) {
      for (let c = 0; c < 256; c += 53) {
        const s1 = add(a, c);
        const s2 = sub(a, c);
        expect(s1).toBe((a ^ c) & 0xff);
        expect(s2).toBe(s1);
      }
    }
  });

  it("additive identity and self-cancel", () => {
    for (let a = 0; a < 256; a += 23) {
      expect(add(a, ZERO)).toBe(a & 0xff);
      expect(add(a, a)).toBe(0);
    }
  });

  it("commutative and associative (sampled)", () => {
    for (let a = 0; a < 256; a += 31) {
      for (let c = 0; c < 256; c += 47) {
        expect(add(a, c)).toBe(add(c, a));
      }
    }
    // associativity sample
    const samples = [0, 1, 2, 5, 19, 127, 200, 255];
    for (const a of samples) {
      for (const c of samples) {
        for (const d of samples) {
          expect(add(add(a, c), d)).toBe(add(a, add(c, d)));
        }
      }
    }
  });
});

/**
 * Multiplication properties and xtime relation.
 */
describe("mul / xtime", () => {
  it("multiplicative identity and zero", () => {
    for (let a = 0; a < 256; a += 29) {
      expect(mul(a, ONE)).toBe(a & 0xff);
      expect(mul(a, ZERO)).toBe(0);
      expect(mul(ZERO, a)).toBe(0);
    }
  });

  it("commutative (sampled) and distributive", () => {
    const S = [0, 1, 2, 3, 5, 9, 17, 31, 63, 127, 191, 255];
    for (const a of S) {
      for (const c of S) {
        expect(mul(a, c)).toBe(mul(c, a));
      }
    }
    // distributivity: a*(b⊕c) = a*b ⊕ a*c
    for (const a of S) {
      for (const b_ of S) {
        for (const c of S) {
          const left = mul(a, add(b_, c));
          const right = add(mul(a, b_), mul(a, c));
          expect(left).toBe(right);
        }
      }
    }
  });

  it("xtime(a) equals mul(a, 2)", () => {
    for (let a = 0; a < 256; a++) {
      expect(xtime(a)).toBe(mul(a, 2));
    }
  });
});

/**
 * Exponentiation and inverses.
 */
describe("pow / inv / div", () => {
  it("pow(a, 0) = 1 for all a (including 0^0 -> by convention here = 1)", () => {
    for (let a = 0; a < 256; a += 13) {
      expect(pow(a, 0)).toBe(ONE);
    }
  });

  it("pow(a, 1) = a", () => {
    for (let a = 0; a < 256; a += 11) {
      expect(pow(a, 1)).toBe(a & 0xff);
    }
  });

  it("inverse exists for all a != 0 and a * inv(a) = 1", () => {
    for (let a = 1; a < 256; a++) {
      const invA = inv(a);
      expect(invA).toBeGreaterThanOrEqual(0);
      expect(invA).toBeLessThanOrEqual(255);
      expect(mul(a, invA)).toBe(ONE);
      expect(mul(invA, a)).toBe(ONE);
    }
  });

  it("inv(0) throws", () => {
    expect(() => inv(0)).toThrow();
  });

  it("division a/b = a*inv(b), b≠0", () => {
    for (let a = 0; a < 256; a += 17) {
      for (let b_ = 1; b_ < 256; b_ += 17) {
        expect(div(a, b_)).toBe(mul(a, inv(b_)));
      }
    }
  });
});

/**
 * Polynomial evaluation (Horner) correctness on simple polynomials.
 */
describe("evalPoly (Horner’s method)", () => {
  it("constant polynomial P(x) = c0", () => {
    const c0 = 0xab;
    expect(evalPoly([c0], 0)).toBe(c0);
    expect(evalPoly([c0], 1)).toBe(c0);
    expect(evalPoly([c0], 255)).toBe(c0);
  });

  it("linear polynomial P(x) = c0 + c1*x", () => {
    const c0 = 0x12;
    const c1 = 0x34;
    for (let x = 0; x < 256; x += 37) {
      const left = evalPoly([c0, c1], x);
      const right = add(c0, mul(c1, x));
      expect(left).toBe(right);
    }
  });

  it("quadratic polynomial P(x) = c0 + c1*x + c2*x^2", () => {
    const c0 = 0x01, c1 = 0x02, c2 = 0x03;
    for (let x = 0; x < 256; x += 19) {
      const left = evalPoly([c0, c1, c2], x);
      const right = add(add(c0, mul(c1, x)), mul(c2, mul(x, x)));
      expect(left).toBe(right);
    }
  });
});

/**
 * Randomized property tests (lightweight) to catch regressions.
 */
describe("randomized properties (lightweight)", () => {
  function randByte() {
    return Math.floor(Math.random() * 256) & 0xff;
  }

  it("a * inv(a) = 1 for random a != 0", () => {
    for (let i = 0; i < 200; i++) {
      const a = (randByte() || 1) as Byte; // avoid 0
      expect(mul(a, inv(a))).toBe(ONE);
    }
  });

  it("distributivity a*(b⊕c) = a*b ⊕ a*c (random)", () => {
    for (let i = 0; i < 200; i++) {
      const a = randByte();
      const b1 = randByte();
      const c1 = randByte();
      const left = mul(a, add(b1, c1));
      const right = add(mul(a, b1), mul(a, c1));
      expect(left).toBe(right);
    }
  });
});
