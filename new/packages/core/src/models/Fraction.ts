/**
 * A rational number (fraction) class for accurately representing musical time.
 * Used to prevent floating-point errors.
 */
export class Fraction {
  constructor(
    public readonly n: number, // numerator
    public readonly d: number, // denominator
  ) {
    if (d === 0) throw new Error('Denominator cannot be zero')
    // Always normalize with a positive denominator
    if (d < 0) {
      this.n = -n
      this.d = -d
    }
  }

  static zero(): Fraction {
    return new Fraction(0, 1)
  }

  static fromInt(i: number): Fraction {
    return new Fraction(i, 1)
  }

  add(other: Fraction): Fraction {
    return new Fraction(this.n * other.d + other.n * this.d, this.d * other.d).simplify()
  }

  sub(other: Fraction): Fraction {
    return new Fraction(this.n * other.d - other.n * this.d, this.d * other.d).simplify()
  }

  mul(other: Fraction): Fraction {
    return new Fraction(this.n * other.n, this.d * other.d).simplify()
  }

  div(other: Fraction): Fraction {
    if (other.n === 0) throw new Error('Cannot divide by zero')
    return new Fraction(this.n * other.d, this.d * other.n).simplify()
  }

  simplify(): Fraction {
    const common = gcd(Math.abs(this.n), this.d)
    return new Fraction(this.n / common, this.d / common)
  }

  toNumber(): number {
    return this.n / this.d
  }

  equals(other: Fraction): boolean {
    const s1 = this.simplify()
    const s2 = other.simplify()
    return s1.n === s2.n && s1.d === s2.d
  }

  compare(other: Fraction): number {
    const diff = this.sub(other)
    if (diff.n === 0) return 0
    return diff.n > 0 ? 1 : -1
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}
