export const PNAMES = ['c', 'd', 'e', 'f', 'g', 'a', 'b'] as const
export type PName = (typeof PNAMES)[number]
export type AccidGes = 's' | 'f' | 'ss' | 'ff' | 'ts' | 'tf' | 'n'

const DIATONIC_STEPS = [2, 8, 14, 19, 25, 31, 37]
const ACCID_TO_ALTERATION: Record<AccidGes, number> = {
  n: 0,
  s: 1,
  f: -1,
  ss: 2,
  ff: -2,
  ts: 3,
  tf: -3,
}
const ALTERATION_TO_ACCID: Record<string, AccidGes> = {
  '0': 'n',
  '1': 's',
  '-1': 'f',
  '2': 'ss',
  '-2': 'ff',
  '3': 'ts',
  '-3': 'tf',
}

export interface PitchInfo {
  pname: PName
  accidGes: AccidGes
  oct: number
}

/** Converts pitch to a Base40 value */
export function pitchToBase40({ pname, accidGes, oct }: PitchInfo): number {
  return 40 * oct + DIATONIC_STEPS[PNAMES.indexOf(pname)] + ACCID_TO_ALTERATION[accidGes]
}

/** Converts a Base40 value to pitch information */
export function base40ToPitch(n: number): PitchInfo {
  const oct = Math.floor(n / 40)
  const chroma = n - oct * 40
  for (const [i, step] of DIATONIC_STEPS.entries()) {
    if (chroma < step + 3) {
      return { oct, pname: PNAMES[i], accidGes: ALTERATION_TO_ACCID[String(chroma - step)] ?? 'n' }
    }
  }
  return { oct, pname: 'c', accidGes: 'n' }
}
