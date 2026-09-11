# glob

[![CI](https://github.com/jcubic/glob/actions/workflows/test.yml/badge.svg)](https://github.com/jcubic/glob/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/jcubic/glob/badge.svg?branch=master)](https://coveralls.io/github/jcubic/glob?branch=master)

Isomorphic glob implementation in pure TypeScript, with no runtime dependencies.

## What is a glob?

A glob is a pattern-matching syntax that shells use. Like when you do `rm *.js`, the `*.js` is a
glob.

See: http://en.wikipedia.org/wiki/Glob_(programming) for more info.

## Isomorphic and platform independent

The library imports nothing platform specific — no `node:fs`, no `node:path`, no `process`. The
filesystem is a constructor argument, so the same build runs unchanged in Node.js, in the browser,
in Deno, in Bun, in a service worker or in an edge runtime.

That means there is no default filesystem: you always pass one in. In return, you are never limited
to the real one — an in-memory tree, a zip archive, a remote API or a git checkout all work equally
well as long as they meet the small interface below.

`match()` needs no filesystem at all and is pure string work, so it runs anywhere with no setup.

## Why another glob library?

From all of my searching I have not been able to find a glob utility that works on Windows and
\*nix. If you need something that works on all platforms... This is what you need. Windows, macOS,
FreeBSD, NetBSD, Linux and Solaris are all handled by the same code, because paths are parsed rather
than delegated to a platform API — `/` and `\` are both accepted as separators everywhere, and
`c:/` is understood as a drive root.

## The `fs` interface

This is the whole contract. Two promise-returning methods, one of which is only ever asked whether
an entry is a directory:

```ts
interface GlobStats {
  isDirectory(): boolean;
}

interface GlobFsPromises {
  readdir(path: string): Promise<string[]>; // entry names, not full paths
  stat(path: string): Promise<GlobStats>;
}
```

`Glob` accepts either an object with those two methods, or a module that nests them under
`promises` — which is the shape `node:fs`, ZenFS and LightningFS all already have:

```ts
interface GlobFsModule {
  promises: GlobFsPromises;
}

type GlobFs = GlobFsModule | GlobFsPromises;
```

So both of these are valid:

```js
new Glob({ fs }); //          a module, using fs.promises
new Glob({ fs: fs.promises }); // the promise API on its own
```

`readdir` is expected to reject for a path that is not a readable directory, and `stat` to reject
for a path that does not exist. Nothing else is called — no `readFile`, no `open`, no watchers.

## Installation

```bash
npm install isomorphic-glob
```

## Usage

The package ships both ESM and CommonJS builds, with TypeScript types for each.

```js
import { Glob, match } from 'isomorphic-glob';
import fs from 'node:fs';

const glob = new Glob({ fs });

const files = await glob.expand('/usr/lib/*.so');

const isMatch = match('/usr/lib/*.so', '/usr/lib/libc.so');
```

```js
const { Glob, match } = require('isomorphic-glob');
```

### In the browser

Any browser filesystem works. With [ZenFS](https://github.com/zen-fs/core):

```js
import { configureSingle, fs } from '@zenfs/core';
import { IndexedDB } from '@zenfs/dom';
import { Glob } from 'isomorphic-glob';

await configureSingle({ backend: IndexedDB });

const glob = new Glob({ fs });
const files = await glob.expand('/project/**/*.js');
```

With [LightningFS](https://github.com/isomorphic-git/lightning-fs):

```js
import FS from '@isomorphic-git/lightning-fs';
import { Glob } from 'isomorphic-glob';

const fs = new FS('my-project');

const glob = new Glob({ fs });
const files = await glob.expand('/project/**/*.js');
```

Or with no library at all — anything implementing the two methods will do:

```js
const glob = new Glob({
  fs: {
    async readdir(path) {
      /* ... */
    },
    async stat(path) {
      /* ... */
    },
  },
});
```

Some filesystems type `readdir` more broadly than this library does — [memfs](https://github.com/streamich/memfs),
for instance, returns `Dirent[] | string[]`. Those work at runtime but need a cast to satisfy
TypeScript:

```ts
new Glob({ fs: memfs as unknown as GlobFs });
```

## Pattern syntax

| Pattern  | Matches                                              |
| -------- | ---------------------------------------------------- |
| `*`      | any run of characters                                |
| `?`      | exactly one character                                |
| `**`     | any number of directory levels, including none       |
| `[abcd]` | one character from the set                           |
| `{a,b}`  | any one of the comma separated alternatives          |
| `/`, `\` | path separator — both are accepted on every platform |
| `c:/`    | a Windows drive root                                 |

A pattern may be absolute — POSIX (`/usr/lib/*.so`) or a Windows drive (`c:/windows/*.dll`) — or
relative (`src/**/*.ts`), in which case it resolves against `cwd`.

## API

### new Glob(options)

| Option | Type     | Description                                                     |
| ------ | -------- | --------------------------------------------------------------- |
| `fs`   | `GlobFs` | **Required.** The filesystem to search.                         |
| `cwd`  | `string` | Directory relative patterns resolve against. Defaults to `'.'`. |

Throws a `TypeError` if `fs` is missing or does not provide `readdir` and `stat`.

### glob.expand(pattern)

Find every path matching `pattern`. Returns `Promise<string[]>`.

```js
const files = await glob.expand('/project/**/*.js');
```

- Rejects with the underlying filesystem error if the directory the search starts from cannot be
  read.
- A directory that cannot be read _during_ the walk contributes no matches instead of failing the
  whole search.
- A pattern containing no wildcard resolves to `[pattern]` if that path exists, or `[]` if it does
  not.
- The order of the result is not specified. Sort it if you need a stable order.

### match(pattern, str)

Test whether `str` matches `pattern`. Returns `boolean`. No filesystem is touched, so this needs no
`Glob` instance and runs in any environment.

```js
const isMatch = match('/dev/sd[abcd]1', '/dev/sdb1');
```

### Parser internals

The scanner, parser and AST are exported as well, for callers that want the parsed pattern rather
than the matches:

```js
import { Parser, Scanner, Token, TokenKind, Ast } from 'isomorphic-glob';

const path = new Parser('/hello/**/you?/*.rb').parse();

path.text(); //=> '/hello/**/you?/*.rb'
path.toString(); //=> '^[/\\]hello[/\\](?:[^/\\]+[/\\])*you[^/\\][/\\][^/\\]*\.rb$'
path.items[2] instanceof Ast.WildcardSegment; //=> true
```

`Path#toString()` returns an **anchored** expression, so `new RegExp(path.toString())` behaves the
same way `match()` does.

## Matching rules

Matching follows bash with `globstar` enabled. `test/regressions.test.ts` pins each rule, and the
expansion results are verified against real bash output.

- **Patterns are anchored.** They match a whole path, not a substring, so `/tmp/*.js` rejects
  `/tmp/foo.jsx` and `xxx/tmp/foo.js`.
- **`*` and `?` stop at a separator.** `/tmp/*.js` does not match `/tmp/a/foo.js`. Use `**` to
  cross directory levels.
- **`**` matches zero or more levels.** `/a/**/b.js` matches `/a/b.js` as well as `/a/x/y/b.js`. A
  trailing `**` covers everything below, the directory itself included — the same set bash lists.
- **Literal text is escaped.** Every `.` in a pattern is a real dot, so `b.c.d` does not match
  `b.cXd`. Inside a character set `-` stays meaningful, so `[a-z]` is still a range.
- **Either separator matches either separator.** `c:/windows/*.dll` matches
  `c:\windows\user32.dll`, on every platform.

### Relative patterns

A pattern without a leading `/` or drive is relative, and resolves against `cwd`:

```js
const glob = new Glob({ fs, cwd: '/home/user/project' });

await glob.expand('src/**/*.ts');
```

`match()` compares a relative pattern against a relative string, with no `cwd` involved:

```js
match('src/*.ts', 'src/index.ts'); //=> true
match('src/*.ts', '/src/index.ts'); //=> false
```

## Development

```bash
npm install       # install the toolchain
npm test          # run the vitest suite
npm run test:watch
npm run test:coverage  # writes coverage/lcov.info, the report CI sends to Coveralls
npm run build     # bundle ESM + CJS + types with tsdown
npm run check     # format check, lint, typecheck and test — what CI runs
```

CI runs the suite on every Node version in the matrix and uploads each run's `lcov.info` to
[Coveralls](https://coveralls.io/github/jcubic/glob) as a parallel build, which a final job closes
so the reports are merged into one result.

| Tool       | Purpose                    |
| ---------- | -------------------------- |
| TypeScript | source language and types  |
| tsdown     | ESM + CJS + `.d.ts` bundle |
| Vitest     | test runner and coverage   |
| oxlint     | linting                    |
| Prettier   | formatting                 |

`test/isomorphic.test.ts` runs the suite against a hand written in-memory filesystem and asserts
that no file under `src/` imports a platform specific module, so the isomorphic guarantee is
enforced rather than just documented.

## License

Copyright (c) 2026 [Jakub T. Jankiewicz](https://jakub.jankiewicz.org/)<br/>
Copyright (c) 2013 Kevin Thompson

Released under the MIT License. See [LICENSE](https://github.com/jcubic/glob/blob/master/LICENSE)
for details.
