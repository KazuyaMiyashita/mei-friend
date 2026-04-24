/**
 * MEI accidental attribute knowledge.
 *
 * Written accidentals (data.ACCIDENTAL.WRITTEN) appear as the `accid` attribute
 * on `<accid>` elements or directly on `<note>` elements. Natural signs are written
 * explicitly as "n".
 *
 * Gestural accidentals (data.ACCIDENTAL.GESTURAL) appear as the `accid.ges`
 * attribute on `<note>` elements. Natural is expressed by the *absence* of the
 * attribute — "n" is not used.
 */

/**
 * MEI written accid value → IPN alter integer.
 * Covers data.ACCIDENTAL.WRITTEN.basic.
 */
export const writtenAccidToAlter: Readonly<Record<string, number>> = {
  s: 1,
  x: 2,
  ss: 2,
  f: -1,
  ff: -2,
  n: 0,
};

/**
 * IPN alter integer → MEI written accid value.
 * Natural (alter = 0) maps to "n" (an explicit natural sign on the score).
 */
export const alterToWrittenAccid: Readonly<Record<number, string>> = {
  2: "ss",
  1: "s",
  0: "n",
  [-1]: "f",
  [-2]: "ff",
};

/**
 * MEI gestural accid.ges value → IPN alter integer.
 */
export const gesturalAccidToAlter: Readonly<Record<string, number>> = {
  s: 1,
  x: 2,
  ss: 2,
  f: -1,
  ff: -2,
};

/**
 * IPN alter integer → MEI gestural accid.ges value.
 * Natural (alter = 0) → `undefined`; the `accid.ges` attribute should be absent.
 */
export const alterToGesturalAccid: Readonly<Record<number, string>> = {
  2: "ss",
  1: "s",
  [-1]: "f",
  [-2]: "ff",
};
