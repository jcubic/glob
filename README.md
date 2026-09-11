# glob

[![CI](https://github.com/jcubic/glob/actions/workflows/test.yml/badge.svg)](https://github.com/jcubic/glob/actions/workflows/test.yml)

Glob implementation in pure TypeScript, with no runtime dependencies.

## What is a glob?

A glob is a pattern-matching syntax that shells use. Like when you do `rm *.js`, the `*.js` is a
glob.

See: http://en.wikipedia.org/wiki/Glob_(programming) for more info.

## Supported environments

The library is written against `node:fs` only, so it runs anywhere Node does:

- Windows
- Macintosh OS X (Darwin)
- FreeBSD
- NetBSD
- Linux
- Solaris

Requires Node.js 20.19 or newer.

## Why another glob library?

From all of my searching I have not been able to find a glob utility that works on Windows and
\*nix. If you need something that works on all platforms... This is what you need.

This is also a pure JavaScript implementation.

## Installation

```bash
npm install bash-globe
```

## Usage

The package ships both ESM and CommonJS builds, with TypeScript types for each:

```js
import { glob, fnmatch } from '@jcubic/glob';
```

```js
const { glob, fnmatch } = require('@jcubic/glob');
```

## Pattern syntax

| Pattern  | Matches                                              |
| -------- | ---------------------------------------------------- |
| `*`      | any run of characters                                |
| `?`      | exactly one character                                |
| `**`     | any number of directory levels                       |
| `[abcd]` | one character from the set                           |
| `{a,b}`  | any one of the comma separated alternatives          |
| `/`, `\` | path separator — both are accepted on every platform |
| `c:/`    | a Windows drive root                                 |

Patterns must be absolute — either POSIX (`/usr/lib/*.so`) or a Windows drive (`c:/windows/*.dll`).

## API

### glob

Search through the filesystem asynchronously.

#### Params

- `pattern`: `string`
- `flags`: Optional — currently unused, but accepted so this works as a drop-in replacement
- `cb`: `(error: Error | null, matches?: string[]) => void`

#### Example

```js
glob(pattern, flags, function (error, matches) {
  // if an error occurred, it's in error.
  // otherwise, "matches" is an array of filenames.
});

glob(pattern, function (error, matches) {
  // if an error occurred, it's in error.
  // otherwise, "matches" is an array of filenames.
});
```

Promises are not built in, but the callback is Node-style, so `util.promisify` works:

```js
import { promisify } from 'node:util';

const globAsync = promisify(glob);
const matches = await globAsync('/usr/lib/*.so');
```

### fnmatch

Test if a string matches a pattern. No I/O is performed.

#### Params

- `pattern`: `string`
- `str`: `string` to test

#### Example

```js
const isMatch = fnmatch(pattern, str);
```

### Parser internals

The scanner, parser and AST are exported as well, for callers that want the parsed pattern rather
than the matches:

```js
import { Parser, Scanner, Token, TokenKind, Ast } from 'bash-globe';

const path = new Parser('/hello/**/you?/*.rb').parse();

path.text(); //=> '//hello/**/you?/*.rb'
path.toString(); //=> '/hello/.*/you.{1}/.*\\.rb'
path.items[3] instanceof Ast.WildcardSegment; //=> true
```

## Known limitations

These behaviours are inherited from the original implementation and are pinned by
`test/known-issues.test.ts`:

- the generated regular expression is not anchored, so `fnmatch('/tmp/*.js', '/tmp/foo.jsx')` is
  `true`
- `*` compiles to `.*` and therefore crosses `/`
- only the first `.` of an identifier is escaped, so `b.c.d` compiles to `b\.c.d`
- a leading `**` always consumes at least one directory level, unlike bash's `globstar`
- relative patterns are not supported and throw `Expected EOT`

## Development

```bash
npm install       # install the toolchain
npm test          # run the vitest suite
npm run test:watch
npm run test:coverage
npm run build     # bundle ESM + CJS + types with tsdown
npm run check     # format check, lint, typecheck and test — what CI runs
```

| Tool       | Purpose                    |
| ---------- | -------------------------- |
| TypeScript | source language and types  |
| tsdown     | ESM + CJS + `.d.ts` bundle |
| Vitest     | test runner and coverage   |
| oxlint     | linting                    |
| Prettier   | formatting                 |

## License

Copyright (c) 2026 [Jakub T. Jankiewicz](https://jakub.jankiewicz.org/)<br/>
Copyright (c) 2013 Kevin Thompson

Released under the MIT License. See [LICENSE](https://github.com/jcubic/glob/blob/master/LICENSE) for details.
