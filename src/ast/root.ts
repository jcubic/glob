import { Segment } from './segment.js';
import type { Identifier } from './identifier.js';
import { escapeRegExp } from '../regex.js';

/**
 * The anchor a pattern is resolved against, in one of three kinds:
 *
 * - `undefined` — a POSIX absolute path (`/usr/lib`)
 * - an {@link Identifier} — a Windows drive (`c:/windows`)
 * - a string — the directory a relative pattern (`src/*.ts`) resolves against,
 *   empty when the caller supplied none
 *
 * Unlike the other segments, a root contributes no separator of its own: it is
 * whatever comes *before* the first `/`, which for a POSIX path is nothing.
 */
export class Root extends Segment {
  constructor(readonly value?: Identifier | string) {
    super([]);
  }

  /** True when the pattern was written without a leading separator or drive. */
  get isRelative(): boolean {
    return typeof this.value === 'string';
  }

  override text(): string {
    if (this.value === undefined) {
      return ''; // posix, the leading '/' belongs to the first segment
    }

    if (typeof this.value === 'string') {
      return this.value; // the cwd a relative pattern hangs off
    }

    return `${this.value.text()}:`; // windows drive
  }

  override isWildcard(): boolean {
    return false;
  }

  override toString(): string {
    return escapeRegExp(this.text());
  }
}
