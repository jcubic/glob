import { TokenKind, type WildcardKind } from '../token.js';
import { SubSegment } from './subsegment.js';
import { NOT_SEPARATOR } from '../regex.js';

/**
 * A single-segment wildcard: `*` (any run of characters) or `?` (one character).
 */
export class Wildcard extends SubSegment {
  constructor(readonly type: WildcardKind) {
    super();
  }

  text(): string {
    switch (this.type) {
      case TokenKind.Wildcard:
        return '*';
      case TokenKind.CharacterWildcard:
        return '?';
      default:
        throw new Error('NotImplemented');
    }
  }

  override isWildcard(): boolean {
    return true;
  }

  /** Neither wildcard crosses a directory separator — that is what `**` is for. */
  override toString(): string {
    switch (this.type) {
      case TokenKind.Wildcard:
        return `${NOT_SEPARATOR}*`;
      case TokenKind.CharacterWildcard:
        return NOT_SEPARATOR;
      default:
        throw new Error('NotImplemented');
    }
  }
}
