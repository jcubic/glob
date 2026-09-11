import { TokenKind, type WildcardKind } from '../token.js';
import { SubSegment } from './subsegment.js';

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

  override toString(): string {
    switch (this.type) {
      case TokenKind.Wildcard:
        return '.*';
      case TokenKind.CharacterWildcard:
        return '.{1}';
      default:
        throw new Error('NotImplemented');
    }
  }
}
