import { SubSegment } from './subsegment.js';
import type { Identifier } from './identifier.js';

/**
 * A brace alternation, e.g. `{jpg,png}` in `img/*.{jpg,png}`.
 */
export class LiteralSet extends SubSegment {
  constructor(readonly items: Identifier[]) {
    super();
  }

  text(): string {
    return `{${this.items.map((item) => item.text()).join(',')}}`;
  }

  override isWildcard(): boolean {
    return true;
  }

  override toString(): string {
    return `(${this.items.map((item) => item.toString()).join('|')})`;
  }
}
