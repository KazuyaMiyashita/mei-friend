import { describe, expect, it } from 'vitest'
import { Duration } from '../src/models/Duration'
import { Fraction } from '../src/models/Fraction'
import { Meter } from '../src/models/Meter'

describe('Fraction', () => {
  it('should handle addition', () => {
    const f1 = new Fraction(1, 4)
    const f2 = new Fraction(1, 2)
    const res = f1.add(f2)
    expect(res.n).toBe(3)
    expect(res.d).toBe(4)
  })

  it('should simplify', () => {
    const f = new Fraction(2, 4)
    const s = f.simplify()
    expect(s.n).toBe(1)
    expect(s.d).toBe(2)
  })
})

describe('Duration', () => {
  it('should parse MEI duration', () => {
    const d = Duration.fromMei('4') // Quarter
    expect(d.value.n).toBe(1)
    expect(d.value.d).toBe(1)

    const d8 = Duration.fromMei('8') // Eighth
    expect(d8.value.n).toBe(1)
    expect(d8.value.d).toBe(2)
  })

  it('should handle dots', () => {
    const d = Duration.fromMei('4', 1) // Dotted quarter = 1 + 1/2 = 3/2
    expect(d.value.n).toBe(3)
    expect(d.value.d).toBe(2)

    const d2 = Duration.fromMei('4', 2) // Double dotted quarter = 1 + 1/2 + 1/4 = 7/4
    expect(d2.value.n).toBe(7)
    expect(d2.value.d).toBe(4)
  })
})

describe('Meter', () => {
  it('should calculate total measure length', () => {
    const m = new Meter(3, Duration.fromMei('4')) // 3/4
    expect(m.totalLength.n).toBe(3)
    expect(m.totalLength.d).toBe(1)

    const m68 = new Meter(6, Duration.fromMei('8')) // 6/8
    expect(m68.totalLength.n).toBe(3)
    expect(m68.totalLength.d).toBe(1)
  })
})
