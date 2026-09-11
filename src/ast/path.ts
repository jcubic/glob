import type { GlobNode } from './node.js';
import type { Segment } from './segment.js';
import { Root } from './root.js';
import { WildcardSegment } from './wildcardsegment.js';
import { GLOBSTAR_TRAILING, SEPARATOR } from '../regex.js';

/**
 * A whole parsed pattern: a {@link Root} followed by its {@link Segment}s.
 */
export class Path implements GlobNode {
  constructor(readonly items: Segment[]) {}

  /** The pattern rendered back as glob source text. */
  text(): string {
    let source = '';
    let separator = this.#opensWithSeparator();

    for (const segment of this.#segments()) {
      if (separator) {
        source += '/';
      }
      source += segment.text();
      separator = true;
    }

    return this.#root().text() + source;
  }

  isWildcard(): boolean {
    return this.items.some((item) => item.isWildcard());
  }

  /**
   * The pattern as an anchored regular expression source string.
   *
   * Anchored deliberately: an unanchored fragment would report a match for any
   * string merely *containing* one, so `/tmp/*.js` would accept `/tmp/a.jsx`.
   */
  toString(): string {
    const segments = this.#segments();
    let source = this.#root().toString();
    let separator = this.#opensWithSeparator();

    segments.forEach((segment, index) => {
      if (segment instanceof WildcardSegment) {
        if (index === segments.length - 1) {
          // nothing follows, so `**` covers zero or more levels below here
          source += GLOBSTAR_TRAILING;
          separator = false;
          return;
        }

        // the general form ends with its own separator, so the next segment
        // must not add another — that is what lets `**` match zero levels
        if (separator) {
          source += SEPARATOR;
        }
        source += segment.toString();
        separator = false;
        return;
      }

      if (separator) {
        source += SEPARATOR;
      }
      source += segment.toString();
      separator = true;
    });

    return `^${source}$`;
  }

  #root(): Root | Segment {
    return this.items[0] ?? new Root();
  }

  #segments(): Segment[] {
    return this.items.slice(1);
  }

  /**
   * Whether a separator belongs between the root and the first segment. It does
   * for `/usr` and for `c:/windows`, but not for a bare relative `src/*.ts`.
   */
  #opensWithSeparator(): boolean {
    const root = this.#root();

    return !(root instanceof Root && root.isRelative && root.text() === '');
  }
}
