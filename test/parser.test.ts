import { describe, expect, it } from 'vitest';
import { Parser } from '../src/parser.js';
import { Identifier, Root, Segment, WildcardSegment } from '../src/ast/index.js';

function parse(pattern: string) {
  return new Parser(pattern).parse();
}

/** Either separator is accepted, so they appear as a class in the compiled regex. */
const SEP = '[/\\\\]';
const NOT_SEP = '[^/\\\\]';

describe('Parser', () => {
  it('parses a plain absolute path into a root plus one segment per component', () => {
    const path = parse('/usr/lib');

    expect(path.items).toHaveLength(3);
    expect(path.items[0]).toBeInstanceOf(Root);
    expect(path.items.map((item) => item.text())).toEqual(['', 'usr', 'lib']);
    expect(path.text()).toBe('/usr/lib');
    expect(path.toString()).toBe(`^${SEP}usr${SEP}lib$`);
  });

  it('compiles wildcards to their regex equivalents', () => {
    expect(parse('/usr/*.js').toString()).toBe(`^${SEP}usr${SEP}${NOT_SEP}*\\.js$`);
    expect(parse('/a/?.js').toString()).toBe(`^${SEP}a${SEP}${NOT_SEP}\\.js$`);
  });

  it('compiles a character set to a regex character class', () => {
    expect(parse('/dev/sd[abcd]1').toString()).toBe(`^${SEP}dev${SEP}sd[abcd]1$`);
  });

  it('compiles a literal set to a regex alternation', () => {
    expect(parse('/a/{foo,bar}.txt').toString()).toBe(`^${SEP}a${SEP}(foo|bar)\\.txt$`);
  });

  it('parses `**` into a WildcardSegment', () => {
    const path = parse('/hello/how/**/you/*.rb');

    expect(path.items[3]).toBeInstanceOf(WildcardSegment);
    expect(path.items[3]?.text()).toBe('**');
    expect(path.toString()).toBe(
      `^${SEP}hello${SEP}how${SEP}(?:${NOT_SEP}+${SEP})*you${SEP}${NOT_SEP}*\\.rb$`,
    );
  });

  it('parses a windows drive as the root', () => {
    const path = parse('c:/t*mp*');
    const root = path.items[0] as Root;

    expect(root).toBeInstanceOf(Root);
    expect(root.value).toBeInstanceOf(Identifier);
    expect(root.text()).toBe('c:');
    expect(path.toString()).toBe(`^c:${SEP}t${NOT_SEP}*mp${NOT_SEP}*$`);
  });

  it('treats backslashes as separators', () => {
    expect(parse('/a\\b\\c').text()).toBe('/a/b/c');
    expect(parse('/a\\b\\c').toString()).toBe(`^${SEP}a${SEP}b${SEP}c$`);
  });

  describe('a relative pattern', () => {
    it('parses into a relative root plus its segments', () => {
      const path = parse('src/*.ts');
      const root = path.items[0] as Root;

      expect(root.isRelative).toBe(true);
      expect(path.items.map((item) => item.text())).toEqual(['', 'src', '*.ts']);
      expect(path.toString()).toBe(`^src${SEP}${NOT_SEP}*\\.ts$`);
    });

    it('parses a bare segment', () => {
      expect(parse('*.js').toString()).toBe(`^${NOT_SEP}*\\.js$`);
    });

    it('anchors to the supplied cwd', () => {
      const path = new Parser('*.js', { cwd: '/home/user' }).parse();

      expect(path.text()).toBe('/home/user/*.js');
      // the cwd is a caller supplied literal, so it is escaped rather than
      // reinterpreted — only separators written in the pattern are flexible
      expect(path.toString()).toBe(`^/home/user${SEP}${NOT_SEP}*\\.js$`);
    });

    it('escapes regex metacharacters in the cwd', () => {
      const path = new Parser('*.js', { cwd: '/home/a.b' }).parse();

      expect(path.toString()).toBe(`^/home/a\\.b${SEP}${NOT_SEP}*\\.js$`);
    });
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

    expect(parser.parse('/a/*.js').toString()).toBe(`^${SEP}a${SEP}${NOT_SEP}*\\.js$`);
    expect(parser.parse('/b/*.ts').toString()).toBe(`^${SEP}b${SEP}${NOT_SEP}*\\.ts$`);
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
