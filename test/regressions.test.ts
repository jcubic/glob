import { describe, expect, it } from 'vitest';
import { match } from '../src/match.js';
import { Parser } from '../src/parser.js';

/**
 * Each of these was a known limitation carried over from the original
 * implementation. They are kept as regression tests so the fixes stay fixed.
 */
describe('regressions', () => {
  describe('the generated regex is anchored', () => {
    it('does not match a string that merely contains a match', () => {
      expect(match('/tmp/*.js', '/tmp/foo.jsx')).toBe(false);
      expect(match('/tmp/*.js', 'xxx/tmp/foo.js')).toBe(false);
      expect(match('/usr/lib', '/usr/lib64')).toBe(false);
      expect(match('/usr/lib', '/var/usr/lib')).toBe(false);
    });

    it('still matches the whole string', () => {
      expect(match('/tmp/*.js', '/tmp/foo.js')).toBe(true);
      expect(match('/usr/lib', '/usr/lib')).toBe(true);
    });
  });

  describe('`*` stops at a directory separator', () => {
    it('does not cross a separator', () => {
      expect(match('/tmp/*.js', '/tmp/a/foo.js')).toBe(false);
      expect(match('/tmp/*', '/tmp/a/b')).toBe(false);
    });

    it('matches within one segment', () => {
      expect(match('/tmp/*.js', '/tmp/foo.js')).toBe(true);
    });

    it('applies to `?` as well', () => {
      expect(match('/a/?', '/a/b')).toBe(true);
      expect(match('/a/?', '/a/')).toBe(false);
    });
  });

  describe('every dot in an identifier is escaped', () => {
    it('does not treat a later dot as a wildcard', () => {
      expect(match('/a/b.c.d', '/a/b.cXd')).toBe(false);
      expect(match('/a/b.c.d', '/a/bXc.d')).toBe(false);
      expect(match('/a/b.c.d.e', '/a/bXcXdXe')).toBe(false);
    });

    it('still matches real dots', () => {
      expect(match('/a/b.c.d', '/a/b.c.d')).toBe(true);
    });

    it('keeps `-` meaningful inside a character set', () => {
      expect(match('/a/[a-c].js', '/a/b.js')).toBe(true);
      expect(match('/a/[a-c].js', '/a/d.js')).toBe(false);
    });
  });

  describe('`**` matches zero directories', () => {
    it('matches with no directory in between', () => {
      expect(match('/a/**/b.js', '/a/b.js')).toBe(true);
      expect(match('/**/x.js', '/x.js')).toBe(true);
    });

    it('still matches one level or more', () => {
      expect(match('/a/**/b.js', '/a/x/b.js')).toBe(true);
      expect(match('/a/**/b.js', '/a/x/y/b.js')).toBe(true);
    });

    it('does not match a sibling that is not under the prefix', () => {
      expect(match('/a/**/b.js', '/c/b.js')).toBe(false);
    });

    it('covers everything below when trailing', () => {
      expect(match('/a/**', '/a')).toBe(true);
      expect(match('/a/**', '/a/b')).toBe(true);
      expect(match('/a/**', '/a/b/c')).toBe(true);
      expect(match('/a/**', '/b')).toBe(false);
    });
  });

  describe('relative patterns are supported', () => {
    it('parses instead of throwing "Expected EOT"', () => {
      expect(() => new Parser('*.js').parse()).not.toThrow();
      expect(() => new Parser('src/**/*.ts').parse()).not.toThrow();
    });

    it('matches a relative string', () => {
      expect(match('*.js', 'foo.js')).toBe(true);
      expect(match('*.js', 'foo.ts')).toBe(false);
      expect(match('src/*.ts', 'src/index.ts')).toBe(true);
      expect(match('src/*.ts', 'lib/index.ts')).toBe(false);
    });

    it('does not match an absolute string', () => {
      expect(match('src/*.ts', '/src/index.ts')).toBe(false);
    });

    it('supports `**` in a relative pattern', () => {
      expect(match('**/*.ts', 'index.ts')).toBe(true);
      expect(match('**/*.ts', 'src/index.ts')).toBe(true);
      expect(match('**/*.ts', 'src/deep/index.ts')).toBe(true);
    });

    it('round-trips through text()', () => {
      expect(new Parser('src/**/*.ts').parse().text()).toBe('src/**/*.ts');
    });
  });

  describe('an absolute path renders with a single separator', () => {
    it('no longer doubles the leading slash', () => {
      expect(new Parser('/usr/lib').parse().text()).toBe('/usr/lib');
      expect(new Parser('/').parse().text()).toBe('/');
      expect(new Parser('/hello/**/you?/*.rb').parse().text()).toBe('/hello/**/you?/*.rb');
    });

    it('keeps a windows drive intact', () => {
      expect(new Parser('c:/t*mp*').parse().text()).toBe('c:/t*mp*');
    });
  });

  describe('both separators are accepted in the subject string', () => {
    it('matches a windows path written with backslashes', () => {
      expect(match('c:/windows/*.dll', 'c:\\windows\\user32.dll')).toBe(true);
    });
  });
});
