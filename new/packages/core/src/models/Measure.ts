import type { Meter } from './Meter'
import type { Note } from './Note'

/**
 * Logical model representing a measure.
 * Contains an array of notes and a meter for a specific layer.
 */
export class Measure {
  constructor(
    public readonly id: string,
    public readonly notes: Note[],
    public readonly meter: Meter | null,
  ) {}
}
