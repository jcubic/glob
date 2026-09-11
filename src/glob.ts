import fs from 'node:fs';
import { Parser } from './parser.js';
import { Segment, WildcardSegment } from './ast/index.js';

/** Error passed to a {@link GlobCallback} when the search fails. */
export type GlobError = NodeJS.ErrnoException;

/**
 * Node-style callback receiving the matched paths.
 */
export type GlobCallback = (error: GlobError | null, matches?: string[]) => void;

/**
 * Search the filesystem asynchronously for paths matching `pattern`.
 *
 * @param pattern glob pattern to expand
 * @param flags currently unused; accepted so this is a drop-in replacement
 * @param cb called with the matched paths
 */
export function glob(pattern: string, cb: GlobCallback): void;
export function glob(pattern: string, flags: unknown, cb: GlobCallback): void;
export function glob(pattern: string, flags: unknown | GlobCallback, cb?: GlobCallback): void {
  const done = typeof flags === 'function' && !cb ? (flags as GlobCallback) : cb;

  if (typeof done !== 'function') {
    throw new TypeError('glob: a callback function is required');
  }

  const parser = new Parser(pattern);
  const path = parser.parse();
  const segments = [...path.items];
  const calm: string[] = [];

  // consume the leading non-wildcard segments; they are the directory to walk from
  while (segments.length > 0) {
    const segment = segments.shift() as Segment;
    if (segment.isWildcard()) {
      segments.unshift(segment);
      break;
    }
    calm.push(segment.toString());
  }

  walk(withSlash(calm.join('/')), segments, done);
}

/**
 * Test whether `str` matches `pattern`. Performs no filesystem access.
 */
export function fnmatch(pattern: string, str: string): boolean {
  const parser = new Parser(pattern);
  const path = parser.parse();
  const re = new RegExp(path.toString());

  return re.test(str);
}

function withSlash(s: string): string {
  if (s.endsWith('/') || s.endsWith('\\')) {
    return s;
  }

  return `${s}/`;
}

function walk(dir: string, segments: Segment[], done: GlobCallback): void {
  let results: string[] = [];

  fs.readdir(dir, (err, list) => {
    if (err) {
      done(err);
      return;
    }

    const segment = segments.shift() as Segment;
    const re = new RegExp(segment.toString());
    let dw = false;

    if (segment instanceof WildcardSegment) {
      // `**` can span several levels, so put it back and deal with it per entry
      segments.unshift(segment);
      dw = true;
    }

    let pending = list.length;
    if (pending === 0) {
      done(null, list);
      return;
    }

    const tryComplete = (): void => {
      if (!--pending) {
        done(null, results);
      }
    };

    const subwalk = (f: string, sgmnts: Segment[]): void => {
      walk(f, sgmnts, (subErr, res) => {
        if (subErr) {
          console.log(`ERROR in subwalk:${f}`);
        }

        results = results.concat(res ?? []);
        tryComplete();
      });
    };

    list.forEach((entry) => {
      const pathTest = re.test(entry);
      const file = withSlash(dir) + entry;

      fs.stat(file, (_statErr, stat) => {
        if (stat?.isDirectory()) {
          let min = 0;
          if (dw) {
            // a directory wildcard is in play, so also recurse keeping the `**`
            pending++;
            subwalk(file, segments.slice(0));
            min++;
          }

          // ...and recurse without it
          if (segments.length > min && (min === 1 || pathTest)) {
            subwalk(file, segments.slice(min));
            return;
          }
        }

        if (pathTest && segments.length === 0) {
          results.push(file);
        }

        tryComplete();
      });
    });
  });
}
