import type { GlobNode } from './node.js';
import type { Segment } from './segment.js';

/**
 * A whole parsed pattern: a {@link Root} followed by its {@link Segment}s.
 */
export class Path implements GlobNode {
  constructor(readonly items: Segment[]) {}

  text(): string {
    return this.items.map((item) => item.text()).join('/');
  }

  isWildcard(): boolean {
    return this.items.some((item) => item.isWildcard());
  }

  toString(): string {
    return this.items.map((item) => item.toString()).join('/');
  }
}
