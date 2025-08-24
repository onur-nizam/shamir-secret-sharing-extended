import { describe, it, expect } from "vitest"; // Jest kullanıyorsan: from '@jest/globals'
import {
  evalPoly,
  lagrangeBasisAtX,
  lagrangeInterpolateAtX,
  lagrangeInterpolateAtZero,
  buildPolynomial,
  assertDistinctXs,
  type Polynomial,
} from "../src/core/polynomial";
import { add, mul, ZERO, ONE } from "../src/core/gf256";

// Helper: make shares (xs, ys) from polynomial coeffs over given xs.
function makeShares(coeffs: Polynomial, xs: number[]) {
  const ys = xs.map((x) => evalPoly(coeffs, x & 0xff));
  return { xs: xs.map((x) => x & 0xff), ys };
}

describe("polynomial basics", () => {
  it("evalPoly matches manual evaluation on simple polynomials", () => {
    // P(x) = c0 + c1*x + c2*x^2 over GF(256)
    const c0 = 0x7b, c1 = 0x2d, c2 = 0x05;
    const coeffs: Polynomial = [c0, c1, c2];

    for (let x = 0; x < 256; x += 19) {
      const h = evalPoly(coeffs, x);
      const manual = add(add(c0, mul(c1, x)), mul(c2, mul(x, x)));
      expect(h).toBe(manual);
    }
  });
});

describe("Lagrange basis properties", () => {
  it("L_i(x_i) = 1 and L_i(x_j) = 0 for j≠i", () => {
    const xs = [1, 2, 5, 9].map((v) => v & 0xff);

    for (let i = 0; i < xs.length; i++) {
      const xi = xs[i];
      // At X = x_i -> basis is 1 for i, 0 for others
      for (let j = 0; j < xs.length; j++) {
        const Lji = lagrangeBasisAtX(xs, j, xi);
        expect(Lji).toBe(j === i ? ONE : ZERO);
      }
    }
  });

  it("Sum_i L_i(X) = 1 for any X (partition of unity)", () => {
    const xs = [7, 11, 23].map((v) => v & 0xff);
    for (let X = 0; X < 256; X += 17) {
      let sum = 0;
      for (let i = 0; i < xs.length; i++) {
        sum = add(sum, lagrangeBasisAtX(xs, i, X));
      }
      expect(sum).toBe(ONE);
    }
  });
});

describe("Lagrange interpolation correctness", () => {
  it("Interpolates P(X) exactly at arbitrary X", () => {
    // P(x) = 0x33 + 0x44*x + 0x55*x^2
    const coeffs: Polynomial = [0x33, 0x44, 0x55];
    const { xs, ys } = makeShares(coeffs, [1, 2, 7]); // 3 distinct points

    for (let X = 0; X < 256; X += 13) {
      const pX = lagrangeInterpolateAtX(xs, ys, X & 0xff);
      const ref = evalPoly(coeffs, X & 0xff);
      expect(pX).toBe(ref);
    }
  });

  it("Interpolates P(0) to constant term (secret)", () => {
    // P(x) = secret + a1*x + a2*x^2 + a3*x^3
    const secret = 0xab;
    const coeffs: Polynomial = [secret, 0x11, 0x22, 0x33];
    const { xs, ys } = makeShares(coeffs, [1, 3, 5, 7]); // 4 shares

    const s0 = lagrangeInterpolateAtZero(xs, ys);
    expect(s0).toBe(secret);
  });

  it("Works with minimal shares (k points for degree k-1)", () => {
    const coeffs: Polynomial = [0x01, 0x02]; // degree 1
    const { xs, ys } = makeShares(coeffs, [10, 200]); // two points
    // Any X should match P(X)
    for (const X of [0, 1, 2, 3, 17, 251]) {
      expect(lagrangeInterpolateAtX(xs, ys, X)).toBe(evalPoly(coeffs, X));
    }
    // At zero -> constant term
    expect(lagrangeInterpolateAtZero(xs, ys)).toBe(0x01);
  });
});

describe("Error handling / validations", () => {
  it("assertDistinctXs throws on duplicates", () => {
    expect(() => assertDistinctXs([1, 1])).toThrow();
    expect(() => assertDistinctXs([3, 5, 3])).toThrow();
  });

  it("Interpolation throws on duplicate xs", () => {
    const xs = [8, 8];
    const ys = [0x10, 0x20];
    expect(() => lagrangeInterpolateAtX(xs as any, ys as any, 0)).toThrow();
    expect(() => lagrangeInterpolateAtZero(xs as any, ys as any)).toThrow();
  });

  it("Length mismatch throws", () => {
    const xs = [1, 2, 3];
    const ys = [10, 20];
    expect(() => lagrangeInterpolateAtX(xs as any, ys as any, 0)).toThrow();
    expect(() => lagrangeInterpolateAtZero(xs as any, ys as any)).toThrow();
  });
});

describe("buildPolynomial", () => {
  it("Builds polynomial with fixed secret and RNG-provided coefficients", () => {
    const secret = 0xfe;
    const degree = 3;
    // Fake RNG returning a1=0x01, a2=0x02, a3=0x03
    const fakeRng = (len: number) => new Uint8Array([0x01, 0x02, 0x03].slice(0, len));
    const coeffs = buildPolynomial(secret, degree, fakeRng);

    expect(Array.from(coeffs)).toEqual([0xfe, 0x01, 0x02, 0x03]);
    // Spot-check evaluation at a few points
    for (const X of [0, 1, 2, 5, 13]) {
      const val = evalPoly(coeffs, X);
      const ref = add(
        add(secret, mul(0x01, X)),
        add(mul(0x02, mul(X, X)), mul(0x03, mul(mul(X, X), X)))
      );
      expect(val).toBe(ref);
    }
  });

  it("Rejects invalid degree or insufficient RNG bytes", () => {
    const okRng = (len: number) => new Uint8Array(len).fill(0x01);
    expect(() => buildPolynomial(0x00, -1, okRng)).toThrow();

    // RNG returns fewer bytes than requested degree
    const badRng = (_len: number) => new Uint8Array(1).fill(0xaa);
    expect(() => buildPolynomial(0x00, 4, badRng)).toThrow();
  });
});
