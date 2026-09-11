import { describe, expect, it } from 'vitest';
import { Parser } from '../src/parser.js';
import { Identifier, Root, Segment, WildcardSegment } from '../src/ast/index.js';

function parse(pattern: string) {
  return new Parser(pattern).parse();
}

describe('Parser', () => {
  it('parses a plain absolute path into a root plus one segment per component', () => {
    const path = parse('/usr/lib');

    expect(path.items).toHaveLength(3);
    expect(path.items[0]).toBeInstanceOf(Root);
    expect(path.items.map((item) => item.text())).toEqual(['/', 'usr', 'lib']);
    expect(path.toString()).toBe('/usr/lib');
  });

  it('compiles wildcards to their regex equivalents', () => {
    expect(parse('/usr/*.js').toString()).toBe('/usr/.*\\.js');
    expect(parse('/a/?.js').toString()).toBe('/a/.{1}\\.js');
  });

  it('compiles a character set to a regex character class', () => {
    expect(parse('/dev/sd[abcd]1').toString()).toBe('/dev/sd[abcd]1');
  });

  it('compiles a literal set to a regex alternation', () => {
    expect(parse('/a/{foo,bar}.txt').toString()).toBe('/a/(foo|bar)\\.txt');
  });

  it('parses `**` into a WildcardSegment', () => {
    const path = parse('/hello/how/**/you/*.rb');

    expect(path.items[3]).toBeInstanceOf(WildcardSegment);
    expect(path.items[3]?.text()).toBe('**');
    expect(path.toString()).toBe('/hello/how/.*/you/.*\\.rb');
  });

  it('parses a windows drive as the root', () => {
    const path = parse('c:/t*mp*');
    const root = path.items[0] as Root;

    expect(root).toBeInstanceOf(Root);
    expect(root.value).toBeInstanceOf(Identifier);
    expect(root.text()).toBe('c:');
    expect(path.toString()).toBe('c:/t.*mp.*');
  });

  it('treats backslashes as separators', () => {
    expect(parse('/a\\b\\c').toString()).toBe('/a/b/c');
  });

  it('reports which segments need filesystem expansion', () => {
    const path = parse('/hello/how/**/you?/*.rb');

    expect(path.items.map((item) => item.isWildcard())).toEqual([
      false, // root
      false, // hello
      false, // how
      true, //  **
      true, //  you?
      true, //  *.rb
    ]);
  });

  it('can be reused by passing the pattern to parse()', () => {
    const parser = new Parser();

    expect(parser.parse('/a/*.js').toString()).toBe('/a/.*\\.js');
    expect(parser.parse('/b/*.ts').toString()).toBe('/b/.*\\.ts');
  });

  it('throws when no source text was provided', () => {
    expect(() => new Parser().parse()).toThrow(/No source text was provided/);
  });

  it('throws on an unterminated character set', () => {
    expect(() => parse('/a/[abc')).toThrow(/Unexpected kind detected/);
  });

  it('throws on an unterminated literal set', () => {
    expect(() => parse('/a/{foo,bar')).toThrow(/Unexpected kind detected/);
  });

  describe('Segment', () => {
    it('is not a wildcard when it holds only identifiers', () => {
      expect(new Segment([new Identifier('abc')]).isWildcard()).toBe(false);
    });

    it('is empty for the trailing separator in `/`', () => {
      const path = parse('/');

      expect(path.items).toHaveLength(2);
      expect(path.items[1]?.text()).toBe('');
    });
  });
});
