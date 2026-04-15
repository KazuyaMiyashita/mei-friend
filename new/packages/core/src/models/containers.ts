import { Duration, Part } from "./elements.js";

/**
 * A tree structure representing musical scores for analysis.
 * Consists of Notes, Melodies (sequential), and Chords (simultaneous).
 *
 * @template A The type of data held at the leaves (e.g., Pitch).
 */
export abstract class Score<A> {
  public abstract readonly duration: Duration;
  public abstract readonly part: Part;

  /**
   * Transforms the values held in the leaves of the score.
   */
  public abstract mapValue<A2>(f: (val: A) => A2): Score<A2>;

  /**
   * Returns an iterator that traverses the score and all its descendants in depth-first order.
   */
  public abstract [Symbol.iterator](): Iterator<Score<A>>;

  protected validateDuration(): void {
    if (this.duration.compareTo(Duration.of(0)) <= 0) {
      throw new Error(
        `Duration must be a positive value. duration: ${this.duration}`,
      );
    }
  }
}

/**
 * A leaf node in the score tree, representing a single musical event (e.g., a note).
 */
export class Note<A> extends Score<A> {
  constructor(
    public readonly value: A,
    public override readonly duration: Duration,
    public override readonly part: Part,
  ) {
    super();
    this.validateDuration();
  }

  public override mapValue<A2>(f: (val: A) => A2): Note<A2> {
    return new Note(f(this.value), this.duration, this.part);
  }

  public override *[Symbol.iterator](): Iterator<Score<A>> {
    yield this;
  }
}

/**
 * A container representing a sequence of musical elements.
 */
export class Melody<A> extends Score<A> {
  public override readonly duration: Duration;
  public override readonly part: Part;

  constructor(public readonly elements: Score<A>[]) {
    super();
    this.duration = elements.reduce(
      (acc, e) => acc.add(e.duration),
      Duration.of(0),
    );
    this.part = Part.commonAncestor(elements.map((e) => e.part));
    this.validateDuration();
  }

  public override mapValue<A2>(f: (val: A) => A2): Melody<A2> {
    return new Melody(this.elements.map((e) => e.mapValue(f)));
  }

  public override *[Symbol.iterator](): Iterator<Score<A>> {
    yield this;
    for (const element of this.elements) {
      yield* element;
    }
  }
}

/**
 * A container representing a set of musical elements sounding simultaneously.
 */
export class Chord<A> extends Score<A> {
  public override readonly duration: Duration;
  public override readonly part: Part;

  constructor(public readonly elements: Set<Score<A>>) {
    super();
    const elemsArray = Array.from(elements);
    if (elemsArray.length === 0) {
      throw new Error("Chord must contain at least one element.");
    }

    this.duration = elemsArray[0].duration;
    this.part = Part.commonAncestor(elemsArray.map((e) => e.part));

    // Validation: All elements must have the same duration
    const durations = new Set(elemsArray.map((e) => e.duration.toString()));
    if (durations.size !== 1) {
      const details = elemsArray
        .map((e) => `${e.part}: ${e.duration}`)
        .join(", ");
      throw new Error(
        `All notes in a chord must have the same duration. ${details}`,
      );
    }

    // Validation: Each element must belong to a different part
    const parts = new Set(elemsArray.map((e) => e.part.toString()));
    if (parts.size !== elemsArray.length) {
      throw new Error(
        "Each element in a chord must belong to a different part.",
      );
    }

    this.validateDuration();
  }

  public override mapValue<A2>(f: (val: A) => A2): Chord<A2> {
    const newElements = new Set(
      Array.from(this.elements).map((e) => e.mapValue(f)),
    );
    return new Chord(newElements);
  }

  public override *[Symbol.iterator](): Iterator<Score<A>> {
    yield this;
    for (const element of this.elements) {
      yield* element;
    }
  }
}
