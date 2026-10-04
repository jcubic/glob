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

    // the walk works in whole paths, so a relative pattern has its base taken
    // back off the results at the end
    const root = segments[0];
    const base = root instanceof Root && root.isRelative ? root.text() : '';

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

    // normalised once, so every directory the walk sees is free of a trailing
    // separator and can be reported as a match as-is
    const from = normalizeDirectory(start);

    // nothing to expand — the pattern either names an existing path or matches
    // nothing at all
    if (segments.length === 0) {
      return (await this.#exists(from)) ? relativize([from], base) : [];
    }

    return relativize(await this.#walk(from, segments), base);
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
    const [segment, ...rest] = segments as [Segment, ...Segment[]];

    return this.#collect(dir, segment, rest, await this.#fs.readdir(dir));
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
  async #collect(
    dir: string,
    segment: Segment,
    rest: Segment[],
    entries: string[],
  ): Promise<string[]> {
    const results: string[] = [];

    if (segment instanceof WildcardSegment) {
      const [next, ...beyond] = rest;

      if (next === undefined) {
        // `**` last: everything from here down, this directory included
        results.push(dir);
      } else {
        // `**` matches zero levels, so the rest of the pattern applies here too
        results.push(...(await this.#collect(dir, next, beyond, entries)));
      }

      await Promise.all(
        entries.map(async (entry) => {
          const file = withSlash(dir) + entry;

          if (await this.#isDirectory(file)) {
            // ...and one level or more, by descending with the `**` retained
            results.push(...(await this.#subwalk(file, [segment, ...rest])));
          } else if (next === undefined) {
            results.push(file);
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
        return [file];
      }

      return this.#subwalk(file, rest);
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

/**
 * Report matches the way the pattern was written: a relative pattern was
 * anchored to `base` before the walk, so `base` comes back off here.
 *
 * The base matching a result exactly is the start directory itself, which a
 * trailing `**` reports — bash does not list `.` for it, so neither do we.
 */
function relativize(matches: string[], base: string): string[] {
  if (base === '') {
    return matches;
  }

  const results: string[] = [];

  for (const match of matches) {
    const rest = withoutBase(match, base);
    if (rest !== '') {
      results.push(rest);
    }
  }

  return results;
}

function withoutBase(match: string, base: string): string {
  // a base written with a trailing separator ('/project/') anchored the walk
  // just as well, so the separators between the two are skipped rather than
  // counted
  let end = base.length;
  while (end > 0 && isSeparator(base[end - 1] as string)) {
    end -= 1;
  }

  const prefix = base.slice(0, end);
  if (!match.startsWith(prefix)) {
    return match;
  }

  let start = prefix.length;
  while (start < match.length && isSeparator(match[start] as string)) {
    start += 1;
  }

  // the base has to end on a separator, or it is a different name that merely
  // begins the same way — '/proj' against '/project/a.js'
  if (start === prefix.length && start !== match.length) {
    return match;
  }

  return match.slice(start);
}

function isSeparator(c: string): boolean {
  return c === '/' || c === '\\';
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
