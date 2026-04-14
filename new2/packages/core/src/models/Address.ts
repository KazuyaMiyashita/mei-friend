/**
 * Represents a logical position on the score.
 * Measure, staff, and layer numbers correspond to the MEI @n attribute (starting from 1).
 * Physical index (elementIndex) has been deprecated, and position management has moved to Offset.
 */
export interface ScoreAddress {
  /** Measure number (@n) */
  measureN: number
  /** Staff number (@n) */
  staffN: number
  /** Layer number (@n) */
  layerN: number
}
