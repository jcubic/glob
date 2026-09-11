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

  it('performs no filesystem access, so patterns need not exist', () => {
    expect(match('/no/such/place/*.js', '/no/such/place/x.js')).toBe(true);
  });
});
