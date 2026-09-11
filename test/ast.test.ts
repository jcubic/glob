import { describe, expect, it } from 'vitest';
import { Parser } from '../src/parser.js';
import { TokenKind, type WildcardKind } from '../src/token.js';
import {
  CharacterSet,
  Identifier,
  LiteralSet,
  Root,
  Segment,
  SubSegment,
  Wildcard,
  WildcardSegment,
} from '../src/ast/index.js';

describe('AST', () => {
  describe('text()', () => {
    it('renders an identifier verbatim', () => {
      expect(new Identifier('README.md').text()).toBe('README.md');
    });

    it('renders a character set with its brackets', () => {
      expect(new CharacterSet(new Identifier('abcd')).text()).toBe('[abcd]');
    });

    it('renders a literal set with its braces and commas', () => {
      const set = new LiteralSet([new Identifier('foo'), new Identifier('bar')]);

      expect(set.text()).toBe('{foo,bar}');
    });

    it('renders both wildcard kinds', () => {
      expect(new Wildcard(TokenKind.Wildcard).text()).toBe('*');
      expect(new Wildcard(TokenKind.CharacterWildcard).text()).toBe('?');
      expect(new WildcardSegment().text()).toBe('**');
    });

    it('joins the sub segments of a segment', () => {
      const segment = new Segment([
        new Identifier('you'),
        new Wildcard(TokenKind.CharacterWildcard),
      ]);

      expect(segment.text()).toBe('you?');
    });

    it('round-trips a whole pattern', () => {
      expect(new Parser('c:/a/**/sd[abcd]1/{foo,bar}.txt').parse().text()).toBe(
        'c:/a/**/sd[abcd]1/{foo,bar}.txt',
      );
    });
  });

  describe('Root', () => {
    it('describes a posix root', () => {
      const root = new Root();

      expect(root.text()).toBe('/');
      expect(root.toString()).toBe('');
      expect(root.isWildcard()).toBe(false);
    });

    it('describes a windows drive root', () => {
      const root = new Root(new Identifier('c'));

      expect(root.text()).toBe('c:');
      expect(root.toString()).toBe('c:');
    });

    it('describes a working-directory root', () => {
      const root = new Root('/home/user');

      expect(root.text()).toBe('/home/user');
      expect(root.toString()).toBe('/home/user');
    });
  });

  describe('isWildcard()', () => {
    it('is true for the constructs that need filesystem expansion', () => {
      expect(new CharacterSet(new Identifier('ab')).isWildcard()).toBe(true);
      expect(new LiteralSet([new Identifier('a')]).isWildcard()).toBe(true);
      expect(new Wildcard(TokenKind.Wildcard).isWildcard()).toBe(true);
      expect(new WildcardSegment().isWildcard()).toBe(true);
    });

    it('is false for literal text', () => {
      expect(new Identifier('abc').isWildcard()).toBe(false);
      expect(new Segment([new Identifier('abc')]).isWildcard()).toBe(false);
    });

    it('is false by default for a sub segment', () => {
      class Custom extends SubSegment {
        text(): string {
          return 'custom';
        }
        override toString(): string {
          return 'custom';
        }
      }

      expect(new Custom().isWildcard()).toBe(false);
    });

    it('bubbles up from a sub segment to its path', () => {
      expect(new Parser('/a/b').parse().isWildcard()).toBe(false);
      expect(new Parser('/a/*.js').parse().isWildcard()).toBe(true);
    });
  });

  describe('Wildcard with an unsupported kind', () => {
    const bogus = new Wildcard(TokenKind.Identifier as WildcardKind);

    it('throws from text()', () => {
      expect(() => bogus.text()).toThrow(/NotImplemented/);
    });

    it('throws from toString()', () => {
      expect(() => bogus.toString()).toThrow(/NotImplemented/);
    });
  });
});
