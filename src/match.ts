import { Parser } from './parser.js';

/**
 * Test whether `str` matches `pattern`.
 *
 * Pure string work — no filesystem is touched, so this runs anywhere.
 *
 * @param pattern glob pattern
 * @param str string to test
 */
export function match(pattern: string, str: string): boolean {
  const path = new Parser(pattern).parse();
  const re = new RegExp(path.toString());

  return re.test(str);
}
