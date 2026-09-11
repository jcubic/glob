/**
 * Regex fragments shared by the AST nodes.
 *
 * Both `/` and `\` count as separators everywhere, so a pattern written with
 * one matches a path written with the other.
 */

/** Matches either path separator. */
export const SEPARATOR = '[/\\\\]';

/** Matches any character that is not a path separator. */
export const NOT_SEPARATOR = '[^/\\\\]';

/** `**` with more segments after it — consumes whole levels, separator included. */
export const GLOBSTAR = `(?:${NOT_SEPARATOR}+${SEPARATOR})*`;

/** `**` at the end of a pattern — zero or more levels below what precedes it. */
export const GLOBSTAR_TRAILING = `(?:${SEPARATOR}${NOT_SEPARATOR}+)*`;

const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** Escape every regex metacharacter in `text`. */
export function escapeRegExp(text: string): string {
  return text.replace(SPECIAL, '\\$&');
}
