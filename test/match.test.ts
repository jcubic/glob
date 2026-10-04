import { describe, expect, it } from 'vitest';
import { match } from '../src/match.js';

describe('match', () => {
  it('matches a literal path', () => {
    expect(match('/usr/lib', '/usr/lib')).toBe(true);
    expect(match('/usr/lib', '/usr/bin')).toBe(false);
  });

  it('matches `*` against a run of characters', () => {
    expect(match('/tmp/*.js', '/tmp/foo.js')).toBe(true);
    expect(match('/tmp/*.js', '/tmp/foo.ts')).toBe(false);
  });

  it('matches `?` against exactly one character', () => {
    expect(match('/a/?.txt', '/a/x.txt')).toBe(true);
    expect(match('/a/?.txt', '/a/xy.txt')).toBe(false);
  });

  it('matches a character set', () => {
    expect(match('/dev/sd[abcd]1', '/dev/sdb1')).toBe(true);
    expect(match('/dev/sd[abcd]1', '/dev/sde1')).toBe(false);
  });

  it('matches a literal set', () => {
    expect(match('/a/{foo,bar}.txt', '/a/foo.txt')).toBe(true);
    expect(match('/a/{foo,bar}.txt', '/a/bar.txt')).toBe(true);
    expect(match('/a/{foo,bar}.txt', '/a/baz.txt')).toBe(false);
  });

  it('matches `**` across directory levels', () => {
    expect(match('/a/**/b.js', '/a/x/y/b.js')).toBe(true);
  });

  it('does not treat a dot in the pattern as a wildcard', () => {
    expect(match('/a/b.c', '/a/bXc')).toBe(false);
  });

  it('requires the trailing separator a pattern was written with', () => {
    // so a `*/` match round trips: every path expand() reports for it, this
    // accepts
    expect(match('/a/*/', '/a/b/')).toBe(true);
    expect(match('/a/*/', '/a/b')).toBe(false);
  });

  describe('a path portion starting with a dot', () => {
    it('is not matched by a wildcard, the same rule expand() follows', () => {
      expect(match('*', '.env')).toBe(false);
      expect(match('/a/*', '/a/.env')).toBe(false);
      expect(match('/a/**/*.js', '/a/.hidden/f.js')).toBe(false);
      expect(match('/a/**', '/a/.hidden')).toBe(false);
    });

    it('is matched by a segment written with a leading dot', () => {
      expect(match('.*', '.env')).toBe(true);
      expect(match('.[e]nv', '.env')).toBe(true);
      expect(match('/a/.*', '/a/.env')).toBe(true);
    });

    it('needs that dot to be literal, as bash does', () => {
      expect(match('[.]env', '.env')).toBe(false);
    });

    it('leaves a visible path alone', () => {
      expect(match('*', 'a.js')).toBe(true);
      expect(match('/a/**/*.js', '/a/sub/f.js')).toBe(true);
    });

    it('is matched with the dot option', () => {
      expect(match('*', '.env', { dot: true })).toBe(true);
      expect(match('/a/**/*.js', '/a/.hidden/f.js', { dot: true })).toBe(true);
      expect(match('/a/**', '/a/.hidden', { dot: true })).toBe(true);
      expect(match('[.]env', '.env', { dot: true })).toBe(true);
    });
  });

  it('performs no filesystem access, so patterns need not exist', () => {
    expect(match('/no/such/place/*.js', '/no/such/place/x.js')).toBe(true);
  });
});
