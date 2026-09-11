import { describe, expect, it } from 'vitest';
import { fnmatch } from '../src/glob.js';

describe('fnmatch', () => {
  it('matches a literal path', () => {
    expect(fnmatch('/usr/lib', '/usr/lib')).toBe(true);
    expect(fnmatch('/usr/lib', '/usr/bin')).toBe(false);
  });

  it('matches `*` against a run of characters', () => {
    expect(fnmatch('/tmp/*.js', '/tmp/foo.js')).toBe(true);
    expect(fnmatch('/tmp/*.js', '/tmp/foo.ts')).toBe(false);
  });

  it('matches `?` against exactly one character', () => {
    expect(fnmatch('/a/?.txt', '/a/x.txt')).toBe(true);
    expect(fnmatch('/a/?.txt', '/a/xy.txt')).toBe(false);
  });

  it('matches a character set', () => {
    expect(fnmatch('/dev/sd[abcd]1', '/dev/sdb1')).toBe(true);
    expect(fnmatch('/dev/sd[abcd]1', '/dev/sde1')).toBe(false);
  });

  it('matches a literal set', () => {
    expect(fnmatch('/a/{foo,bar}.txt', '/a/foo.txt')).toBe(true);
    expect(fnmatch('/a/{foo,bar}.txt', '/a/bar.txt')).toBe(true);
    expect(fnmatch('/a/{foo,bar}.txt', '/a/baz.txt')).toBe(false);
  });

  it('matches `**` across directory levels', () => {
    expect(fnmatch('/a/**/b.js', '/a/x/y/b.js')).toBe(true);
  });

  it('does not treat a dot in the pattern as a wildcard', () => {
    expect(fnmatch('/a/b.c', '/a/bXc')).toBe(false);
  });

  it('performs no filesystem access, so patterns need not exist', () => {
    expect(fnmatch('/no/such/place/*.js', '/no/such/place/x.js')).toBe(true);
  });
});
