import { Token, TokenKind } from './token.js';

const ALPHA_NUMERIC = /^[0-9a-zA-Z. _-]$/;

/**
 * Turns a glob pattern into a stream of {@link Token}s.
 */
export class Scanner {
  private sourceIndex = 0;
  private currentCharacter: string | undefined;
  private currentSpelling = '';

  constructor(private readonly source: string) {
    this.currentCharacter = this.source[this.sourceIndex];
  }

  /** Scan the next token and advance past it. */
  scan(): Token {
    this.currentSpelling = '';
    const kind = this.scanToken();

    return new Token(kind, this.currentSpelling);
  }

  /** Scan the next token without advancing. */
  peek(): Token {
    const index = this.sourceIndex;
    const token = this.scan();
    this.sourceIndex = index;
    this.currentCharacter = this.source[this.sourceIndex];
    return token;
  }

  private takeIt(): void {
    this.currentSpelling += this.currentCharacter;
    this.currentCharacter = this.source[++this.sourceIndex];
  }

  private isAlphaNumeric(character: string | undefined): boolean {
    return character !== undefined && ALPHA_NUMERIC.test(character);
  }

  private scanToken(): TokenKind {
    if (this.isAlphaNumeric(this.currentCharacter)) {
      while (this.isAlphaNumeric(this.currentCharacter)) {
        this.takeIt();
      }
      return TokenKind.Identifier;
    }

    switch (this.currentCharacter) {
      case '*':
        this.takeIt();
        if (this.currentCharacter === '*') {
          this.takeIt();
          return TokenKind.DirectoryWildcard;
        }
        return TokenKind.Wildcard;

      case '?':
        this.takeIt();
        return TokenKind.CharacterWildcard;

      case '[':
        this.takeIt();
        return TokenKind.CharacterSetStart;

      case ']':
        this.takeIt();
        return TokenKind.CharacterSetEnd;

      case '{':
        this.takeIt();
        return TokenKind.LiteralSetStart;

      case ',':
        this.takeIt();
        return TokenKind.LiteralSetSeparator;

      case '}':
        this.takeIt();
        return TokenKind.LiteralSetEnd;

      case '/':
      case '\\':
        this.takeIt();
        return TokenKind.PathSeparator;

      case ':':
        this.takeIt();
        return TokenKind.WindowsRoot;

      case undefined:
        return TokenKind.EOT;

      default:
        throw new SyntaxError(`Unable to scan for next token. Stuck on '${this.currentCharacter}'`);
    }
  }
}
