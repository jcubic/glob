import { Segment } from './segment.js';

/**
 * The `**` segment, which matches any number of directory levels.
 */
export class WildcardSegment extends Segment {
  constructor() {
    super([]);
  }

  override text(): string {
    return '**';
  }

  override isWildcard(): boolean {
    return true;
  }

  override toString(): string {
    return '.*';
  }
}
