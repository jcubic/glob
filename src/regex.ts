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

/**
 * Guards a path portion against starting with a dot. `**` is never written
 * with a leading dot, so every level it crosses carries one of these.
 */
export const NOT_DOT = '(?!\\.)';

/** `**` with more segments after it — consumes whole levels, separator included. */
export function globstar(dot: boolean): string {
  return `(?:${dot ? '' : NOT_DOT}${NOT_SEPARATOR}+${SEPARATOR})*`;
}

/** `**` at the end of a pattern — zero or more levels below what precedes it. */
export function globstarTrailing(dot: boolean): string {
  return `(?:${SEPARATOR}${dot ? '' : NOT_DOT}${NOT_SEPARATOR}+)*`;
}

const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** Escape every regex metacharacter in `text`. */
export function escapeRegExp(text: string): string {
  return text.replace(SPECIAL, '\\$&');
}
