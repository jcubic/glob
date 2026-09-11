import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Glob } from '../src/glob.js';
import { match } from '../src/match.js';
import type { GlobFsPromises } from '../src/fs.js';

function fail(code: string, message: string): never {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  throw error;
}

/**
 * A filesystem in ~25 lines, implementing nothing but `readdir` and `stat`.
 *
 * If the library works against this, it works against ZenFS, LightningFS or
 * anything else meeting the same interface.
 */
function createMemoryFs(files: string[]): GlobFsPromises {
  const children = new Map<string, Set<string>>();
  const directories = new Set<string>(['/']);

  for (const file of files) {
    const parts = file.split('/').filter(Boolean);
    let dir = '/';

    parts.forEach((name, index) => {
      const entries = children.get(dir) ?? new Set<string>();
      entries.add(name);
      children.set(dir, entries);

      dir = dir === '/' ? `/${name}` : `${dir}/${name}`;
      if (index < parts.length - 1) {
        directories.add(dir);
      }
    });
  }

  const normalize = (target: string): string => target.replace(/\/+$/, '') || '/';

  return {
    async readdir(target) {
      const dir = normalize(target);
      if (!directories.has(dir)) {
        fail('ENOENT', `no such directory: ${dir}`);
      }
      return [...(children.get(dir) ?? [])];
    },
    async stat(target) {
      const entry = normalize(target);
      const isDirectory = directories.has(entry);
      if (!isDirectory && !files.includes(entry)) {
        fail('ENOENT', `no such file: ${entry}`);
      }
      return { isDirectory: () => isDirectory };
    },
  };
}

const FILES = [
  '/project/a.js',
  '/project/b.txt',
  '/project/sub/c.js',
  '/project/sub/nested/d.js',
  '/project/other/e.js',
  '/project/my.dir/f.js',
];

const DIRECTORIES = [
  '/project',
  '/project/sub',
  '/project/sub/nested',
  '/project/other',
  '/project/my.dir',
];

const memoryFs = createMemoryFs(FILES);

describe('platform independence', () => {
  const glob = new Glob({ fs: memoryFs });

  it('expands `*` against a filesystem that is not node:fs', async () => {
    await expect(glob.expand('/project/*.js')).resolves.toEqual(['/project/a.js']);
  });

  it('expands `**` against a filesystem that is not node:fs', async () => {
    const matches = await glob.expand('/project/**/*.js');

    expect(matches.toSorted()).toEqual([
      '/project/a.js',
      '/project/my.dir/f.js',
      '/project/other/e.js',
      '/project/sub/c.js',
      '/project/sub/nested/d.js',
    ]);
  });

  it('starts the search from a literal directory containing a dot', async () => {
    // the literal prefix is a path, so it must not be regex escaped to `my\.dir`
    await expect(glob.expand('/project/my.dir/*.js')).resolves.toEqual(['/project/my.dir/f.js']);
  });

  it('expands a literal set against a filesystem that is not node:fs', async () => {
    const matches = await glob.expand('/project/{a,b}.*');

    expect(matches.toSorted()).toEqual(['/project/a.js', '/project/b.txt']);
  });

  it('propagates the filesystem error for a missing directory', async () => {
    await expect(glob.expand('/project/nope/*.js')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  /**
   * `expand` prunes the walk segment by segment while `match` compiles one
   * regex for the whole path — two separate code paths that must not drift
   * apart. Searching the tree has to give the same answer as filtering every
   * path in it.
   */
  describe('expand agrees with match', () => {
    const everything = [...FILES, ...DIRECTORIES].toSorted();

    const patterns = [
      '/project/*.js',
      '/project/*',
      '/project/*.rb',
      '/project/**/*.js',
      '/project/**',
      '/project/sub/**',
      '/project/{a,b}.*',
      '/project/[ab].*',
      '/project/?.js',
      '/project/sub/*.js',
      '/project/*/nested/*.js',
      '/project/**/nested/*.js',
      '/project/my.dir/*.js',
      '/project/**/*.txt',
    ];

    it.each(patterns)('%s', async (pattern) => {
      const expanded = (await glob.expand(pattern)).toSorted();
      const filtered = everything.filter((entry) => match(pattern, entry));

      expect(expanded).toEqual(filtered);
    });
  });

  describe('the source', () => {
    const sources = fs
      .readdirSync('src', { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('.ts'))
      .map((entry) => path.join('src', entry));

    it('has files to check', () => {
      expect(sources.length).toBeGreaterThan(5);
    });

    it.each(sources)('%s imports nothing platform specific', (file) => {
      const code = fs
        .readFileSync(file, 'utf8')
        .replaceAll(/\/\*[\s\S]*?\*\//g, '') // block comments
        .replaceAll(/\/\/.*$/gm, ''); //        line comments

      expect(code).not.toMatch(/\bfrom\s+['"](?:node:|fs|path|os)/);
      expect(code).not.toMatch(/\brequire\s*\(/);
      expect(code).not.toMatch(/\bprocess\s*\./);
      expect(code).not.toMatch(/\b__dirname\b/);
    });
  });
});
