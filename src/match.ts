import { Parser } from './parser.js';

/**
 * Options accepted by {@link match}.
 */
export interface MatchOptions {
  /**
   * Let a wildcard match a path portion starting with a `.`. Defaults to
   * `false`, the same as the `dot` option of `Glob`. A portion written with a
   * leading dot matches those either way.
   */
  dot?: boolean | undefined;
}

/**
 * Test whether `str` matches `pattern`.
 *
 * Pure string work — no filesystem is touched, so this runs anywhere.
 *
 * @param pattern glob pattern
 * @param str string to test
 * @param options matching options
 */
export function match(pattern: string, str: string, options?: MatchOptions): boolean {
  const path = new Parser(pattern).parse();
  const re = new RegExp(path.toString({ dot: options?.dot ?? false }));

  return re.test(str);
}
