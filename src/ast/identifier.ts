import { SubSegment } from './subsegment.js';

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

  override toString(): string {
    return this.text().replace(/\./, '\\.');
  }
}
