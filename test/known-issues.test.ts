import { describe, expect, it } from 'vitest';
import { match } from '../src/match.js';
import { Parser } from '../src/parser.js';

/**
 * Behaviour that differs from what bash does, carried over from the original
 * implementation. `it.fails` asserts the test still fails — when one of these is
 * fixed the corresponding case turns red, which is the signal to drop the marker.
 */
describe('known issues', () => {
  it.fails('should anchor the generated regex', () => {
    // `/tmp/.*\.js` is used unanchored, so any string *containing* a match passes
    expect(match('/tmp/*.js', '/tmp/foo.jsx')).toBe(false);
    expect(match('/tmp/*.js', 'xxx/tmp/foo.js')).toBe(false);
  });

  it.fails('should stop `*` at a directory separator', () => {
    // `*` compiles to `.*`, which happily crosses `/`
    expect(match('/tmp/*.js', '/tmp/a/foo.js')).toBe(false);
  });

  it.fails('should escape every dot in an identifier, not just the first', () => {
    // Identifier#toString uses a non-global replace, so `b.c.d` becomes `b\.c.d`
    expect(match('/a/b.c.d', '/a/b.cXd')).toBe(false);
  });

  it.fails('should match zero directories for a leading `**`', () => {
    // bash's globstar matches `/a/b.js`; here `**` always consumes a level
    expect(match('/a/**/b.js', '/a/b.js')).toBe(true);
  });

  it.fails('should support patterns relative to the working directory', () => {
    // parseRoot() builds a cwd Root but never consumes a token, so parse() then
    // trips over its own "Expected EOT" check
    expect(() => new Parser('*.js').parse()).not.toThrow();
  });

  it('renders an absolute path with a doubled separator', () => {
    // Root#text() returns '/' and Path#text() joins on '/' again
    expect(new Parser('/usr/lib').parse().text()).toBe('//usr/lib');
  });
});
