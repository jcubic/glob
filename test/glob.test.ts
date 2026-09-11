import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Glob } from '../src/glob.js';

let root: string;
let glob: Glob;

/** Turn absolute matches back into paths relative to the fixture root. */
function relative(matches: string[]): string[] {
  return matches.map((match) => path.relative(root, match)).toSorted();
}

beforeAll(async () => {
  root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jcubic-glob-'));
  glob = new Glob({ fs });

  await fs.promises.mkdir(path.join(root, 'sub', 'nested'), { recursive: true });
  await fs.promises.mkdir(path.join(root, 'other'), { recursive: true });

  await Promise.all([
    fs.promises.writeFile(path.join(root, 'a.js'), ''),
    fs.promises.writeFile(path.join(root, 'b.txt'), ''),
    fs.promises.writeFile(path.join(root, 'sub', 'c.js'), ''),
    fs.promises.writeFile(path.join(root, 'sub', 'nested', 'd.js'), ''),
    fs.promises.writeFile(path.join(root, 'other', 'e.js'), ''),
  ]);
});

afterAll(async () => {
  await fs.promises.rm(root, { recursive: true, force: true });
});

describe('Glob', () => {
  describe('expand', () => {
    it('expands `*` within a single directory', async () => {
      expect(relative(await glob.expand(`${root}/*.js`))).toEqual(['a.js']);
    });

    it('lists every entry for a bare `*`', async () => {
      expect(relative(await glob.expand(`${root}/*`))).toEqual(['a.js', 'b.txt', 'other', 'sub']);
    });

    it('expands `**` across directory levels', async () => {
      expect(relative(await glob.expand(`${root}/**/*.js`))).toEqual([
        'other/e.js',
        'sub/c.js',
        'sub/nested/d.js',
      ]);
    });

    it('expands a literal set', async () => {
      expect(relative(await glob.expand(`${root}/{a,b}.*`))).toEqual(['a.js', 'b.txt']);
    });

    it('expands a character set', async () => {
      expect(relative(await glob.expand(`${root}/[ab].*`))).toEqual(['a.js', 'b.txt']);
    });

    it('expands `?`', async () => {
      expect(relative(await glob.expand(`${root}/?.js`))).toEqual(['a.js']);
    });

    it('descends through a literal directory before expanding', async () => {
      expect(relative(await glob.expand(`${root}/sub/*.js`))).toEqual(['sub/c.js']);
    });

    it('resolves to an empty list when nothing matches', async () => {
      await expect(glob.expand(`${root}/*.rb`)).resolves.toEqual([]);
    });

    it('rejects when the directory to search does not exist', async () => {
      await expect(glob.expand(`${root}/nope/*.js`)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    describe('a pattern with no wildcard', () => {
      it('resolves to the path when it exists', async () => {
        await expect(glob.expand(`${root}/a.js`)).resolves.toEqual([`${root}/a.js`]);
        await expect(glob.expand(`${root}/sub`)).resolves.toEqual([`${root}/sub`]);
      });

      it('resolves to an empty list when it does not', async () => {
        await expect(glob.expand(`${root}/missing.js`)).resolves.toEqual([]);
      });
    });
  });

  describe('constructor', () => {
    it('accepts a filesystem module with a `promises` property', () => {
      expect(() => new Glob({ fs })).not.toThrow();
    });

    it('accepts a bare promise based filesystem', async () => {
      const bare = new Glob({ fs: { readdir: fs.promises.readdir, stat: fs.promises.stat } });

      expect(relative(await bare.expand(`${root}/*.js`))).toEqual(['a.js']);
    });

    it('requires the `fs` option', () => {
      // @ts-expect-error -- exercising the runtime guard
      expect(() => new Glob({})).toThrow(/`fs` option is required/);
      // @ts-expect-error -- exercising the runtime guard
      expect(() => new Glob()).toThrow(/`fs` option is required/);
    });

    it('rejects an object that is not a filesystem', () => {
      // @ts-expect-error -- exercising the runtime guard
      expect(() => new Glob({ fs: { readFile: () => {} } })).toThrow(
        /promise based `readdir` and `stat`/,
      );
    });
  });
});
