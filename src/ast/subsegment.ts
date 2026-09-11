import type { GlobNode } from './node.js';

/**
 * Base class for every node that can appear *inside* a single path segment.
 */
export abstract class SubSegment implements GlobNode {
  abstract text(): string;
  abstract toString(): string;

  isWildcard(): boolean {
    return false;
  }
}
