import { Segment } from './segment.js';
import { GLOBSTAR } from '../regex.js';

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

  override toString(): string {
    return GLOBSTAR;
  }
}
