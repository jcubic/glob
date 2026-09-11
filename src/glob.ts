import { Parser } from './parser.js';
import { Root, Segment, WildcardSegment } from './ast/index.js';
import { toPromises, type GlobFs, type GlobFsPromises } from './fs.js';

/**
 * Options accepted by the {@link Glob} constructor.
 */
export interface GlobOptions {
  /**
   * The filesystem to search. Required — the library ships no default, which is
   * what keeps it free of any platform specific import.
   */
  fs: GlobFs;
  /**
   * Directory that relative patterns resolve against. Defaults to `'.'`.
   */
  cwd?: string | undefined;
}

/**
 * Expands glob patterns against an injected filesystem.
 *
 * ```js
 * const glob = new Glob({ fs });
 * const matches = await glob.expand('/usr/lib/*.so');
 * ```
 */
export class Glob {
  readonly #fs: GlobFsPromises;
  readonly #cwd: string;

  constructor(options: GlobOptions) {
    if (!options?.fs) {
      throw new TypeError('Glob: the `fs` option is required');
    }

    this.#fs = toPromises(options.fs);
    this.#cwd = options.cwd ?? '.';
  }

  /**
   * Find every path matching `pattern`.
   *
   * Rejects if the first directory the search starts from cannot be read.
   * Directories that fail to be read *during* the walk contribute no matches
   * rather than failing the whole search. The order of the result is not
   * specified.
   */
  async expand(pattern: string): Promise<string[]> {
    const path = new Parser(pattern, { cwd: this.#cwd }).parse();
    const segments = [...path.items];

    // the leading literal segments are not searched, they are where the walk
    // starts. they are taken as source text, not as the compiled regex, so that
    // a directory like `my.dir` is not turned into `my\.dir`
    let start = '';
    let separator = false;

    while (segments.length > 0) {
      const segment = segments[0] as Segment;
      if (segment.isWildcard()) {
        break;
      }
      segments.shift();

      if (segment instanceof Root) {
        start = segment.text();
        // a POSIX root is empty but still introduces a separator; a relative
        // pattern with no base does not
        separator = !(segment.isRelative && start === '');
        continue;
      }

      if (separator) {
        start += '/';
      }
      start += segment.text();
      separator = true;
    }

    // nothing to expand — the pattern either names an existing path or matches
    // nothing at all
    if (segments.length === 0) {
      const literal = start === '' ? '/' : start;
      return (await this.#exists(literal)) ? [literal] : [];
    }

    return this.#walk(start === '' ? '/' : start, segments);
  }

  async #exists(path: string): Promise<boolean> {
    try {
      await this.#fs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async #isDirectory(path: string): Promise<boolean> {
    try {
      return (await this.#fs.stat(path)).isDirectory();
    } catch {
      return false;
    }
  }

  async #walk(dir: string, segments: Segment[]): Promise<string[]> {
    return this.#collect(dir, segments, await this.#fs.readdir(dir));
  }

  /** A branch we cannot read simply contributes no matches. */
  async #subwalk(dir: string, segments: Segment[]): Promise<string[]> {
    try {
      return await this.#walk(dir, segments);
    } catch {
      return [];
    }
  }

  /**
   * Match `segments` against an already listed directory.
   *
   * Takes the listing as an argument so that `**`, which has to try the rest of
   * the pattern against the very same directory, does not read it twice.
   */
  async #collect(dir: string, segments: Segment[], entries: string[]): Promise<string[]> {
    const [segment, ...rest] = segments;
    if (segment === undefined) {
      return [];
    }

    const results: string[] = [];

    if (segment instanceof WildcardSegment) {
      const trailing = rest.length === 0;

      if (trailing) {
        // `**` last: everything from here down, this directory included
        results.push(withoutSlash(dir));
      } else {
        // `**` matches zero levels, so the rest of the pattern applies here too
        results.push(...(await this.#collect(dir, rest, entries)));
      }

      await Promise.all(
        entries.map(async (entry) => {
          const file = withSlash(dir) + entry;

          if (await this.#isDirectory(file)) {
            // ...and one level or more, by descending with the `**` retained
            results.push(...(await this.#subwalk(file, segments)));
          } else if (trailing) {
            results.push(file);
          }
        }),
      );

      return results;
    }

    // anchored, so a segment pattern has to match the whole entry name
    const re = new RegExp(`^(?:${segment.toString()})$`);

    await Promise.all(
      entries.map(async (entry) => {
        if (!re.test(entry)) {
          return;
        }

        const file = withSlash(dir) + entry;

        if (rest.length === 0) {
          results.push(file);
          return;
        }

        if (await this.#isDirectory(file)) {
          results.push(...(await this.#subwalk(file, rest)));
        }
      }),
    );

    return results;
  }
}

function withSlash(s: string): string {
  if (s.endsWith('/') || s.endsWith('\\')) {
    return s;
  }

  return `${s}/`;
}

/** Drop a trailing separator, but leave a bare root like `/` or `c:/` alone. */
function withoutSlash(s: string): string {
  if (s.length <= 1 || (!s.endsWith('/') && !s.endsWith('\\'))) {
    return s;
  }

  const trimmed = s.slice(0, -1);

  return trimmed.endsWith(':') ? s : trimmed;
}
