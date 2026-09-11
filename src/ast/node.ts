/**
 * Common shape of every node in the glob AST.
 */
export interface GlobNode {
  /** The node rendered back as glob source text. */
  text(): string;
  /** The node rendered as a regular expression source string. */
  toString(): string;
  /** Whether matching this node requires filesystem expansion. */
  isWildcard(): boolean;
}
