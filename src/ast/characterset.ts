import { SubSegment } from './subsegment.js';
import type { Identifier } from './identifier.js';

/**
 * A bracketed character set, e.g. `[abcd]` in `/dev/sd[abcd]1`.
 */
export class CharacterSet extends SubSegment {
  constructor(readonly identifier: Identifier) {
    super();
  }

  text(): string {
    return `[${this.identifier.text()}]`;
  }

  override isWildcard(): boolean {
    return true;
  }

  override toString(): string {
    return `[${this.identifier.toString()}]`;
  }
}
