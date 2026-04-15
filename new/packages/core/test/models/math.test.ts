import { describe, expect, it } from "vitest";
import { gcd, mod, Rational } from "../../src/models/math.js";

describe("Math Utils", () => {
  it("should calculate gcd correctly", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
    expect(gcd(0, 5)).toBe(5);
  });

  it("should calculate mod correctly (always positive)", () => {
    expect(mod(5, 3)).toBe(2);
    expect(mod(-1, 3)).toBe(2);
    expect(mod(-5, 3)).toBe(1);
  });
});

describe("Rational", () => {
  it("should simplify fractions", () => {
    const r = new Rational(2, 4);
    expect(r.n).toBe(1);
    expect(r.d).toBe(2);
  });

  it("should handle negative numbers correctly", () => {
    const r1 = new Rational(-1, 2);
    expect(r1.n).toBe(-1);
    expect(r1.d).toBe(2);

    const r2 = new Rational(1, -2);
    expect(r2.n).toBe(-1);
    expect(r2.d).toBe(2);

    const r3 = new Rational(-2, -4);
    expect(r3.n).toBe(1);
    expect(r3.d).toBe(2);
  });

  it("should add correctly", () => {
    const r1 = new Rational(1, 2);
    const r2 = new Rational(1, 3);
    const result = r1.add(r2);
    expect(result.n).toBe(5);
    expect(result.d).toBe(6);
  });

  it("should parse correctly", () => {
    expect(Rational.parse("1/2").equals(new Rational(1, 2))).toBe(true);
    expect(Rational.parse("1+1/2").equals(new Rational(3, 2))).toBe(true);
    expect(Rational.parse("2").equals(new Rational(2, 1))).toBe(true);
  });

  it("should format as mixed number string correctly", () => {
    expect(new Rational(3, 2).toMixedNumberString()).toBe("1+1/2");
    expect(new Rational(1, 2).toMixedNumberString()).toBe("1/2");
    expect(new Rational(2, 1).toMixedNumberString()).toBe("2");
    expect(new Rational(0, 1).toMixedNumberString()).toBe("0");
  });
});
