/**
 * Kinds of tokens produced by the {@link Scanner}.
 */
export const TokenKind = {
  /** `*` */
  Wildcard: 0,
  /** `?` */
  CharacterWildcard: 1,
  /** `**` */
  DirectoryWildcard: 2,
  /** `[` */
  CharacterSetStart: 3,
  /** `]` */
  CharacterSetEnd: 4,
  /** `{` */
  LiteralSetStart: 5,
  /** `,` */
  LiteralSetSeparator: 6,
  /** `}` */
  LiteralSetEnd: 7,
  /** `/` or `\` */
  PathSeparator: 8,
  /** letters, numbers, `.`, ` `, `_` and `-` */
  Identifier: 9,
  /** `:` as in `c:/` */
  WindowsRoot: 10,
  /** end of text */
  EOT: 100,
} as const;

export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];

/** A wildcard kind that can appear inside a single path segment. */
export type WildcardKind = typeof TokenKind.Wildcard | typeof TokenKind.CharacterWildcard;

/**
 * A single lexical token: its kind plus the exact source text it was scanned from.
 */
export class Token {
  constructor(
    readonly kind: TokenKind,
    readonly spelling: string,
  ) {}
}
