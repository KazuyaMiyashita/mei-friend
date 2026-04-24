/**
 * Represents musical part information.
 * Parts can be managed hierarchically (e.g., "Soprano:voice1").
 */
export class Part {
  constructor(public readonly hierarchy: string[]) {}

  /**
   * Creates a sub-part under the current hierarchy.
   */
  public spawn(childName: string): Part {
    return new Part([...this.hierarchy, childName]);
  }

  /**
   * Returns true if the provided part is a descendant of this part.
   * e.g., Part("Soprano") is a superset of Part("Soprano", "voice1").
   */
  public isSupersetOf(descendant: Part): boolean {
    if (descendant.hierarchy.length < this.hierarchy.length) return false;
    for (let i = 0; i < this.hierarchy.length; i++) {
      if (this.hierarchy[i] !== descendant.hierarchy[i]) return false;
    }
    return true;
  }

  public toString(): string {
    if (this.hierarchy.length === 0) return "Root";
    return this.hierarchy.join(":");
  }

  public compareTo(that: Part): number {
    // Compares hierarchy elements one by one from the top level.
    const len = Math.min(this.hierarchy.length, that.hierarchy.length);
    for (let i = 0; i < len; i++) {
      const cmp = this.hierarchy[i].localeCompare(that.hierarchy[i]);
      if (cmp !== 0) return cmp;
    }
    // If common parts match, the shallower hierarchy comes first.
    return this.hierarchy.length - that.hierarchy.length;
  }

  static readonly Root = new Part([]);

  public static of(...names: string[]): Part {
    return new Part(names);
  }

  /**
   * Finds the least common ancestor of the provided parts.
   * e.g., [A:B:C, A:B:D] -> A:B, [A:B, X:Y] -> Root.
   */
  public static commonAncestor(parts: Iterable<Part>): Part {
    const partsArray = Array.from(parts);
    if (partsArray.length === 0) return Part.Root;

    let common = partsArray[0].hierarchy;
    for (let i = 1; i < partsArray.length; i++) {
      const current = partsArray[i].hierarchy;
      let j = 0;
      while (
        j < common.length &&
        j < current.length &&
        common[j] === current[j]
      ) {
        j++;
      }
      common = common.slice(0, j);
    }
    return new Part(common);
  }

  /**
   * Creates a part comparator based on a specified part order.
   * The first level hierarchy follows the provided order, while deeper levels use alphabetical order.
   */
  public static ordering(...order: string[]): (x: Part, y: Part) => number {
    const orderMap = new Map(order.map((name, i) => [name, i]));
    const getValue = (name: string) => orderMap.get(name) ?? Infinity;

    return (x, y) => {
      const len = Math.min(x.hierarchy.length, y.hierarchy.length);
      for (let i = 0; i < len; i++) {
        let res = 0;
        if (i === 0) {
          res = getValue(x.hierarchy[i]) - getValue(y.hierarchy[i]);
        } else {
          res = x.hierarchy[i].localeCompare(y.hierarchy[i]);
        }
        if (res !== 0) return res;
      }
      return x.hierarchy.length - y.hierarchy.length;
    };
  }
}
