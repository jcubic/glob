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
   * Directory that relative patterns resolve against.
   *
   * Relative patterns are not supported yet (see the README), so this is
   * currently only recorded on the parsed root.
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
  readonly #cwd: string | undefined;

  constructor(options: GlobOptions) {
    if (!options?.fs) {
      throw new TypeError('Glob: the `fs` option is required');
    }

    this.#fs = toPromises(options.fs);
    this.#cwd = options.cwd;
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
    const literal: string[] = [];

    // the leading literal segments are not searched, they are where we start.
    // they are taken as source text, not as the compiled regex, so that a
    // directory like `my.dir` is not turned into `my\.dir`
    while (segments.length > 0) {
      const segment = segments.shift() as Segment;
      if (segment.isWildcard()) {
        segments.unshift(segment);
        break;
      }
      literal.push(segment instanceof Root ? segment.toString() : segment.text());
    }

    const root = literal.join('/');

    // nothing to expand — the pattern either names an existing path or matches
    // nothing at all
    if (segments.length === 0) {
      return (await this.#exists(root)) ? [root] : [];
    }

    return this.#walk(withSlash(root), segments);
  }

  async #exists(path: string): Promise<boolean> {
    try {
      await this.#fs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async #walk(dir: string, segments: Segment[]): Promise<string[]> {
    const list = await this.#fs.readdir(dir);

    const rest = [...segments];
    const segment = rest.shift() as Segment;
    const re = new RegExp(segment.toString());

    // `**` can span several levels, so put it back and deal with it per entry
    const directoryWildcard = segment instanceof WildcardSegment;
    if (directoryWildcard) {
      rest.unshift(segment);
    }

    const results: string[] = [];

    await Promise.all(
      list.map(async (entry) => {
        const matched = re.test(entry);
        const file = withSlash(dir) + entry;

        if (await this.#isDirectory(file)) {
          let min = 0;

          if (directoryWildcard) {
            // recurse keeping the `**`, so it can consume another level
            results.push(...(await this.#subwalk(file, rest.slice(0))));
            min++;
          }

          // ...and recurse without it
          if (rest.length > min && (min === 1 || matched)) {
            results.push(...(await this.#subwalk(file, rest.slice(min))));
            return;
          }
        }

        if (matched && rest.length === 0) {
          results.push(file);
        }
      }),
    );

    return results;
  }

  async #isDirectory(path: string): Promise<boolean> {
    try {
      return (await this.#fs.stat(path)).isDirectory();
    } catch {
      return false;
    }
  }

  /** A branch we cannot read simply contributes no matches. */
  async #subwalk(dir: string, segments: Segment[]): Promise<string[]> {
    try {
      return await this.#walk(dir, segments);
    } catch {
      return [];
    }
  }
}

function withSlash(s: string): string {
  if (s.endsWith('/') || s.endsWith('\\')) {
    return s;
  }

  return `${s}/`;
}
