/**
 * Mathematical utilities and Rational number implementation.
 */

/**
 * Python-style modulo that always returns a positive result if the divisor is positive.
 */
export function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/**
 * Calculates the greatest common divisor of two numbers.
 */
export function gcd(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0 && !Number.isNaN(y)) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/**
 * Represents a rational number (fraction).
 */
export class Rational {
  public readonly n: number;
  public readonly d: number;

  constructor(numerator: number, denominator: number = 1) {
    if (denominator === 0) {
      throw new Error("Denominator cannot be zero");
    }

    const g = gcd(numerator, denominator);
    let n = numerator / g;
    let d = denominator / g;

    if (d < 0) {
      n = -n;
      d = -d;
    }

    this.n = n;
    this.d = d;
  }

  public add(that: Rational): Rational {
    return new Rational(this.n * that.d + that.n * this.d, this.d * that.d);
  }

  public sub(that: Rational): Rational {
    return new Rational(this.n * that.d - that.n * this.d, this.d * that.d);
  }

  public mul(that: Rational | number): Rational {
    if (typeof that === "number") {
      return new Rational(this.n * that, this.d);
    }
    return new Rational(this.n * that.n, this.d * that.d);
  }

  public div(that: Rational): Rational {
    return new Rational(this.n * that.d, this.d * that.n);
  }

  public compareTo(that: Rational): number {
    return this.n * that.d - that.n * this.d;
  }

  public equals(obj: unknown): boolean {
    if (obj instanceof Rational) {
      return this.n === obj.n && this.d === obj.d;
    }
    return false;
  }

  public toString(): string {
    if (this.d === 1) return `${this.n}`;
    return `${this.n}/${this.d}`;
  }

  /**
   * Returns a mixed number string representation (e.g., "1+1/2").
   */
  public toMixedNumberString(): string {
    const { whole, frac } = this.toMixedNumber();
    if (whole === 0 && frac.n === 0) return "0";
    if (whole === 0) return `${frac.n}/${frac.d}`;
    if (frac.n === 0) return `${whole}`;
    return `${whole}+${frac.n}/${frac.d}`;
  }

  public toDouble(): number {
    return this.n / this.d;
  }

  /**
   * Converts the rational to a mixed number (integer part and fractional part).
   * The fractional part is always positive.
   */
  public toMixedNumber(): { whole: number; frac: Rational } {
    const whole = Math.trunc(this.n / this.d);
    const remainder = Math.abs(this.n) % this.d;
    return {
      whole,
      frac: new Rational(remainder, this.d),
    };
  }

  /**
   * Parses a string like "1+1/2", "3/2", or "2" into a Rational.
   */
  public static parse(s: string): Rational {
    const trimmed = s.trim();
    const plusIndex = trimmed.indexOf("+");

    if (plusIndex !== -1) {
      const wholePartStr = trimmed.substring(0, plusIndex);
      const fractionPartStr = trimmed.substring(plusIndex + 1);
      return Rational.parse(wholePartStr).add(Rational.parse(fractionPartStr));
    }

    const slashIndex = trimmed.indexOf("/");
    if (slashIndex !== -1) {
      const numStr = trimmed.substring(0, slashIndex);
      const denStr = trimmed.substring(slashIndex + 1);
      return new Rational(parseInt(numStr, 10), parseInt(denStr, 10));
    }

    return new Rational(parseInt(trimmed, 10));
  }
}
