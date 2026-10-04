import type { GlobNode } from './node.js';
import type { Segment } from './segment.js';
import { Root } from './root.js';
import { WildcardSegment } from './wildcardsegment.js';
import { NOT_DOT, SEPARATOR, globstarTrailing } from '../regex.js';

/**
 * Options accepted when compiling a {@link Path} to a regular expression.
 */
export interface PathRegExpOptions {
  /**
   * Let a wildcard match a path portion starting with a `.`. Defaults to
   * `false`, so the compiled expression agrees with `match()` and with
   * `Glob#expand()`. A portion written with a leading dot matches those
   * either way.
   */
  dot?: boolean | undefined;
}

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
   *
   * A path portion starting with a `.` is matched only where the pattern says
   * so outright, unless `dot` is set — the rule bash follows, and the one
   * `match()` and `Glob#expand()` apply, so the three agree.
   */
  toString(options?: PathRegExpOptions): string {
    const dot = options?.dot ?? false;
    const segments = this.#segments();
    let source = this.#root().toString();
    let separator = this.#opensWithSeparator();

    segments.forEach((segment, index) => {
      if (segment instanceof WildcardSegment) {
        if (index === segments.length - 1) {
          // nothing follows, so `**` covers zero or more levels below here
          source += globstarTrailing(dot);
          separator = false;
          return;
        }

        // the general form ends with its own separator, so the next segment
        // must not add another — that is what lets `**` match zero levels
        if (separator) {
          source += SEPARATOR;
        }
        source += segment.toString(dot);
        separator = false;
        return;
      }

      if (separator) {
        source += SEPARATOR;
      }
      // the dot has to be literal text at the front of the portion, so `[.]x`
      // is no more explicit than `*` — which is how bash reads it too
      if (!dot && !segment.text().startsWith('.')) {
        source += NOT_DOT;
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
