import { Scanner } from './scanner.js';
import { Token, TokenKind, type WildcardKind } from './token.js';
import {
  CharacterSet,
  Identifier,
  LiteralSet,
  Path,
  Root,
  Segment,
  SubSegment,
  Wildcard,
  WildcardSegment,
} from './ast/index.js';

/**
 * Options accepted by the {@link Parser} constructor.
 */
export interface ParserOptions {
  /**
   * Directory a relative pattern is anchored to. Supplied by the caller rather
   * than read from `process.cwd()`, so the parser stays platform independent.
   */
  cwd?: string | undefined;
}

/**
 * Recursive-descent parser that turns a glob pattern into a {@link Path} AST.
 */
export class Parser {
  private scanner: Scanner | undefined;
  private currentToken: Token = new Token(TokenKind.EOT, '');
  private readonly cwd: string | undefined;

  constructor(pattern?: string, options?: ParserOptions) {
    if (pattern) {
      this.scanner = new Scanner(pattern);
    }
    this.cwd = options?.cwd;
  }

  /**
   * Parse the pattern given to the constructor, or `text` when provided.
   */
  parse(text?: string): Path {
    if (text) {
      this.scanner = new Scanner(text);
    }

    this.acceptIt();
    const path = this.parsePath();
    if (this.currentToken.kind !== TokenKind.EOT) {
      throw new SyntaxError('Expected EOT');
    }

    return path;
  }

  private accept(expectedKind: TokenKind): void {
    if (this.currentToken.kind === expectedKind) {
      this.acceptIt();
      return;
    }

    throw new SyntaxError('Parser error Unexpected kind detected.');
  }

  private acceptIt(): void {
    if (this.scanner === undefined) {
      throw new Error('No source text was provided');
    }
    this.currentToken = this.scanner.scan();
  }

  private parseIdentifier(): Identifier {
    if (this.currentToken.kind === TokenKind.Identifier) {
      const identifier = new Identifier(this.currentToken.spelling);
      this.acceptIt();
      return identifier;
    }

    throw new SyntaxError('Unable to parse Identifier');
  }

  private parseLiteralSet(): LiteralSet {
    const items: Identifier[] = [];
    this.accept(TokenKind.LiteralSetStart);
    items.push(this.parseIdentifier());

    while (this.currentToken.kind === TokenKind.LiteralSetSeparator) {
      this.acceptIt();
      items.push(this.parseIdentifier());
    }
    this.accept(TokenKind.LiteralSetEnd);
    return new LiteralSet(items);
  }

  private parseCharacterSet(): CharacterSet {
    this.accept(TokenKind.CharacterSetStart);
    const characterSet = this.parseIdentifier();
    this.accept(TokenKind.CharacterSetEnd);
    return new CharacterSet(characterSet);
  }

  private parseWildcard(type: WildcardKind): Wildcard {
    this.accept(type);
    return new Wildcard(type);
  }

  /** Parse the next sub segment, or return undefined once the segment ends. */
  private parseSubSegment(): SubSegment | undefined {
    switch (this.currentToken.kind) {
      case TokenKind.Identifier:
        return this.parseIdentifier();
      case TokenKind.CharacterSetStart:
        return this.parseCharacterSet();
      case TokenKind.LiteralSetStart:
        return this.parseLiteralSet();
      case TokenKind.CharacterWildcard:
      case TokenKind.Wildcard:
        return this.parseWildcard(this.currentToken.kind);
      default:
        return undefined;
    }
  }

  private parseSegment(): Segment {
    if (this.currentToken.kind === TokenKind.DirectoryWildcard) {
      this.acceptIt();
      return new WildcardSegment();
    }

    const items: SubSegment[] = [];
    for (let item = this.parseSubSegment(); item !== undefined; item = this.parseSubSegment()) {
      items.push(item);
    }

    return new Segment(items);
  }

  private parseRoot(): Root {
    // don't eat the separator, so the segment loop can see it
    if (this.currentToken.kind === TokenKind.PathSeparator) {
      return new Root();
    }

    if (
      this.currentToken.kind === TokenKind.Identifier &&
      this.currentToken.spelling.length === 1 &&
      this.scanner?.peek().kind === TokenKind.WindowsRoot
    ) {
      const ident = this.parseIdentifier();
      this.accept(TokenKind.WindowsRoot);
      return new Root(ident);
    }

    // a relative pattern, anchored to the caller supplied cwd. the empty string
    // stands for "no base", which is what keeps a root of this kind distinct
    // from the POSIX one
    return new Root(this.cwd ?? '');
  }

  private parsePath(): Path {
    const root = this.parseRoot();
    const items: Segment[] = [root];

    // a relative pattern opens with a segment rather than a separator, so the
    // first one is not introduced by the loop below
    if (root.isRelative && this.currentToken.kind !== TokenKind.PathSeparator) {
      items.push(this.parseSegment());
    }

    while (this.currentToken.kind === TokenKind.PathSeparator) {
      this.acceptIt();
      items.push(this.parseSegment());
    }

    return new Path(items);
  }
}
