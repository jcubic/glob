import { Segment } from './segment.js';
import type { Identifier } from './identifier.js';

/**
 * The anchor a pattern is resolved against.
 *
 * - no value — a POSIX absolute path (`/usr/lib`)
 * - an {@link Identifier} — a Windows drive (`c:/windows`)
 * - a string — the current working directory, for relative patterns
 */
export class Root extends Segment {
  constructor(readonly value?: Identifier | string) {
    super([]);
  }

  override text(): string {
    if (this.value !== undefined) {
      if (typeof this.value === 'string') {
        return this.value; // cwd
      }

      return `${this.value.text()}:`; // windows
    }
    return '/'; // linux
  }

  override isWildcard(): boolean {
    return false;
  }

  override toString(): string {
    if (this.value !== undefined) {
      if (typeof this.value === 'string') {
        return this.value; // cwd
      }

      return `${this.value.text()}:`; // windows
    }
    return ''; // linux
  }
}
