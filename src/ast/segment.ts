import type { GlobNode } from './node.js';
import type { SubSegment } from './subsegment.js';

/**
 * One component of a path — everything between two `/` separators.
 */
export class Segment implements GlobNode {
  constructor(readonly items: SubSegment[]) {}

  text(): string {
    return this.items.map((item) => item.text()).join('');
  }

  isWildcard(): boolean {
    return this.items.some((item) => item.isWildcard());
  }

  toString(): string {
    return this.items.map((item) => item.toString()).join('');
  }
}
