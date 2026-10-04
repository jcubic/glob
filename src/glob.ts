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
   * An absolute pattern yields absolute paths. A relative one yields paths
   * relative to `cwd`, the way a shell reports them — the base the pattern was
   * anchored to is not part of the answer.
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
    //
    // two paths are built at once: `start`, which the filesystem is asked
    // about, and `name`, the same place as the caller will see it. they differ
    // by the cwd a relative pattern was anchored to, which is the caller's
    // base and so no part of the answer
    let start = '';
    let name = '';
    let separator = false;
    let named = false;
    let relative = false;

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
        relative = segment.isRelative;
        // an absolute pattern is reported as written, so there the two paths
        // are one and the same
        name = relative ? '' : start;
        named = !relative;
        continue;
      }

      if (separator) {
        start += '/';
      }
      start += segment.text();
      separator = true;

      if (named) {
        name += '/';
      }
      name += segment.text();
      named = true;
    }

    // normalised once, so every directory the walk sees is free of a trailing
    // separator and can be reported as a match as-is
    const from = normalizeDirectory(start);
    // an empty name is the cwd itself, which stands for no prefix at all
    const shown = relative ? name : from;

    // nothing to expand — the pattern either names an existing path or matches
    // nothing at all
    if (segments.length === 0) {
      return (await this.#exists(from)) ? [shown] : [];
    }

    return this.#walk(from, shown, segments);
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

  /**
   * Walk `dir`, reporting whatever matches under the name `as` — the same
   * directory as the caller asked for it, which for a relative pattern is the
   * empty string for the cwd itself.
   */
  async #walk(dir: string, as: string, segments: Segment[]): Promise<string[]> {
    const [segment, ...rest] = segments as [Segment, ...Segment[]];

    return this.#collect(dir, as, segment, rest, await this.#fs.readdir(dir));
  }

  /** A branch we cannot read simply contributes no matches. */
  async #subwalk(dir: string, as: string, segments: Segment[]): Promise<string[]> {
    try {
      return await this.#walk(dir, as, segments);
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
  async #collect(
    dir: string,
    as: string,
    segment: Segment,
    rest: Segment[],
    entries: string[],
  ): Promise<string[]> {
    const results: string[] = [];

    if (segment instanceof WildcardSegment) {
      const [next, ...beyond] = rest;

      if (next === undefined) {
        // `**` last: everything from here down, this directory included —
        // except the cwd itself, which bash does not list as `.` either
        if (as !== '') {
          results.push(as);
        }
      } else {
        // `**` matches zero levels, so the rest of the pattern applies here too
        results.push(...(await this.#collect(dir, as, next, beyond, entries)));
      }

      await Promise.all(
        entries.map(async (entry) => {
          const file = withSlash(dir) + entry;

          if (await this.#isDirectory(file)) {
            // ...and one level or more, by descending with the `**` retained
            results.push(...(await this.#subwalk(file, join(as, entry), [segment, ...rest])));
          } else if (next === undefined) {
            results.push(join(as, entry));
          }
        }),
      );

      return results;
    }

    // `.` and `..` name a directory that no listing reports, so they are a
    // move rather than something to match an entry against. only the literal
    // text counts: bash does not expand `[.]` or `{.,x}` onto them either
    const text = segment.text();
    if (text === '.' || text === '..') {
      const file = withSlash(dir) + text;

      if (rest.length === 0) {
        return [join(as, text)];
      }

      return this.#subwalk(file, join(as, text), rest);
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
          results.push(join(as, entry));
          return;
        }

        if (await this.#isDirectory(file)) {
          results.push(...(await this.#subwalk(file, join(as, entry), rest)));
        }
      }),
    );

    return results;
  }
}

/**
 * Name an entry of `dir`, where an empty `dir` is the cwd of a relative
 * pattern and contributes no prefix of its own.
 */
function join(dir: string, entry: string): string {
  return dir === '' ? entry : withSlash(dir) + entry;
}

function withSlash(s: string): string {
  if (s.endsWith('/') || s.endsWith('\\')) {
    return s;
  }

  return `${s}/`;
}

/**
 * The directory a walk starts from.
 *
 * A root contributes no separator of its own — POSIX contributes nothing at
 * all, a drive contributes `c:` — so the bare roots need one putting back
 * before they name a readable directory.
 */
function normalizeDirectory(s: string): string {
  if (s === '') {
    return '/';
  }

  return s.endsWith(':') ? `${s}/` : s;
}
