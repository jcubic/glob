import { Segment } from './segment.js';
import { globstar } from '../regex.js';

/**
 * The `**` segment, which matches any number of directory levels — including
 * none at all, so `/a/**` + `/b.js` matches `/a/b.js`.
 *
 * Because it spans separators, {@link Path} assembles it rather than simply
 * joining it between two `/`. The fragment here is the general form, which
 * carries its own trailing separator.
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

  /**
   * @param dot let the levels crossed start with a dot. Off by default, the
   * way `**` behaves in bash and in {@link Glob}.
   */
  override toString(dot = false): string {
    return globstar(dot);
  }
}
