import { SubSegment } from './subsegment.js';
import { escapeRegExp } from '../regex.js';

/**
 * A literal run of characters, e.g. `README.md` in `doc/README.md`.
 */
export class Identifier extends SubSegment {
  constructor(readonly value: string) {
    super();
  }

  text(): string {
    return this.value;
  }

  override isWildcard(): boolean {
    return false;
  }

  /**
   * Every metacharacter is escaped — except `-`, which is literal outside a
   * character class and has to stay meaningful inside one so that ranges like
   * `[a-z]` keep working.
   */
  override toString(): string {
    return escapeRegExp(this.text());
  }
}
