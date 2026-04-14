import type { Duration } from './Duration'

/**
 * Logical model representing a note or a rest.
 * Refer to the MEI document for specific pitch and other information.
 */
export class Note {
  constructor(
    public readonly id: string,
    public readonly duration: Duration,
  ) {}
}
