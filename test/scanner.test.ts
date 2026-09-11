import { describe, expect, it } from 'vitest';
import { Scanner } from '../src/scanner.js';
import { TokenKind } from '../src/token.js';

/** Scan a whole pattern into `[kind, spelling]` pairs, stopping at EOT. */
function scanAll(source: string): Array<[TokenKind, string]> {
  const scanner = new Scanner(source);
  const tokens: Array<[TokenKind, string]> = [];
  let token = scanner.scan();
  while (token.kind !== TokenKind.EOT) {
    tokens.push([token.kind, token.spelling]);
    token = scanner.scan();
  }
  return tokens;
}

describe('Scanner', () => {
  it('scans separators, identifiers and wildcards', () => {
    expect(scanAll('/hello/how/**/you?/*.rb')).toEqual([
      [TokenKind.PathSeparator, '/'],
      [TokenKind.Identifier, 'hello'],
      [TokenKind.PathSeparator, '/'],
      [TokenKind.Identifier, 'how'],
      [TokenKind.PathSeparator, '/'],
      [TokenKind.DirectoryWildcard, '**'],
      [TokenKind.PathSeparator, '/'],
      [TokenKind.Identifier, 'you'],
      [TokenKind.CharacterWildcard, '?'],
      [TokenKind.PathSeparator, '/'],
      [TokenKind.Wildcard, '*'],
      [TokenKind.Identifier, '.rb'],
    ]);
  });

  it('scans character sets', () => {
    expect(scanAll('/dev/sd[abcd]1')).toEqual([
      [TokenKind.PathSeparator, '/'],
      [TokenKind.Identifier, 'dev'],
      [TokenKind.PathSeparator, '/'],
      [TokenKind.Identifier, 'sd'],
      [TokenKind.CharacterSetStart, '['],
      [TokenKind.Identifier, 'abcd'],
      [TokenKind.CharacterSetEnd, ']'],
      [TokenKind.Identifier, '1'],
    ]);
  });

  it('scans literal set punctuation', () => {
    expect(scanAll('/a,b}{')).toEqual([
      [TokenKind.PathSeparator, '/'],
      [TokenKind.Identifier, 'a'],
      [TokenKind.LiteralSetSeparator, ','],
      [TokenKind.Identifier, 'b'],
      [TokenKind.LiteralSetEnd, '}'],
      [TokenKind.LiteralSetStart, '{'],
    ]);
  });

  it('scans a windows drive root', () => {
    expect(scanAll('c:/a')).toEqual([
      [TokenKind.Identifier, 'c'],
      [TokenKind.WindowsRoot, ':'],
      [TokenKind.PathSeparator, '/'],
      [TokenKind.Identifier, 'a'],
    ]);
  });

  it('treats a backslash as a path separator', () => {
    expect(scanAll('a\\b')).toEqual([
      [TokenKind.Identifier, 'a'],
      [TokenKind.PathSeparator, '\\'],
      [TokenKind.Identifier, 'b'],
    ]);
  });

  it('accepts dots, spaces, underscores and hyphens inside identifiers', () => {
    expect(scanAll('a b.c-d_e')).toEqual([[TokenKind.Identifier, 'a b.c-d_e']]);
  });

  it('collapses `**` into a single directory wildcard token', () => {
    expect(scanAll('**')).toEqual([[TokenKind.DirectoryWildcard, '**']]);
  });

  it('returns EOT for an empty source', () => {
    expect(new Scanner('').scan().kind).toBe(TokenKind.EOT);
  });

  it('throws on an unsupported character', () => {
    expect(() => scanAll('a$b')).toThrow(/Stuck on '\$'/);
  });

  describe('peek', () => {
    it('returns the next token without consuming it', () => {
      const scanner = new Scanner('c:/a');

      expect(scanner.peek().kind).toBe(TokenKind.Identifier);
      expect(scanner.peek().kind).toBe(TokenKind.Identifier);
      expect(scanner.scan().spelling).toBe('c');
      expect(scanner.peek().kind).toBe(TokenKind.WindowsRoot);
      expect(scanner.scan().kind).toBe(TokenKind.WindowsRoot);
    });
  });
});
