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

    it('expands `**` across directory levels, including zero of them', async () => {
      // bash with globstar lists a.js here too, because `**` may match nothing
      expect(relative(await glob.expand(`${root}/**/*.js`))).toEqual([
        'a.js',
        'other/e.js',
        'sub/c.js',
        'sub/nested/d.js',
      ]);
    });

    it('expands a trailing `**` to everything below, the directory included', async () => {
      expect(relative(await glob.expand(`${root}/**`))).toEqual([
        '',
        'a.js',
        'b.txt',
        'other',
        'other/e.js',
        'sub',
        'sub/c.js',
        'sub/nested',
        'sub/nested/d.js',
      ]);
    });

    it('does not let `*` cross a directory separator', async () => {
      expect(relative(await glob.expand(`${root}/*.js`))).toEqual(['a.js']);
      expect(await glob.expand(`${root}/*/nested/*.js`)).toEqual([`${root}/sub/nested/d.js`]);
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

  describe('a relative pattern', () => {
    it('resolves against the cwd option, and reports matches relative to it', async () => {
      const scoped = new Glob({ fs, cwd: root });

      expect((await scoped.expand('*.js')).toSorted()).toEqual(['a.js']);
      expect((await scoped.expand('sub/*.js')).toSorted()).toEqual(['sub/c.js']);
    });

    it('strips the cwd even when the pattern names no wildcard', async () => {
      const scoped = new Glob({ fs, cwd: root });

      expect(await scoped.expand('sub/c.js')).toEqual(['sub/c.js']);
      expect(await scoped.expand('missing.js')).toEqual([]);
    });

    it('tolerates a cwd written with a trailing separator', async () => {
      const scoped = new Glob({ fs, cwd: `${root}/` });

      expect((await scoped.expand('*.js')).toSorted()).toEqual(['a.js']);
    });

    it('supports `**` relative to the cwd', async () => {
      const scoped = new Glob({ fs, cwd: root });

      expect((await scoped.expand('**/*.js')).toSorted()).toEqual([
        'a.js',
        'other/e.js',
        'sub/c.js',
        'sub/nested/d.js',
      ]);
    });

    it('omits the cwd itself from a trailing `**`', async () => {
      const scoped = new Glob({ fs, cwd: root });

      // bash lists everything below, but never `.` for the directory itself
      expect((await scoped.expand('**')).toSorted()).toEqual([
        'a.js',
        'b.txt',
        'other',
        'other/e.js',
        'sub',
        'sub/c.js',
        'sub/nested',
        'sub/nested/d.js',
      ]);
    });

    it('keeps a leading `./` the way bash does', async () => {
      const scoped = new Glob({ fs, cwd: root });

      expect((await scoped.expand('./*.js')).toSorted()).toEqual(['./a.js']);
      expect((await scoped.expand('./**/*.js')).toSorted()).toEqual([
        './a.js',
        './other/e.js',
        './sub/c.js',
        './sub/nested/d.js',
      ]);
    });

    it('keeps a leading `../` the way bash does', async () => {
      const scoped = new Glob({ fs, cwd: `${root}/sub` });

      expect((await scoped.expand('../*')).toSorted()).toEqual([
        '../a.js',
        '../b.txt',
        '../other',
        '../sub',
      ]);
      expect((await scoped.expand('../*.js')).toSorted()).toEqual(['../a.js']);
    });

    it('resolves a bare `.` and `..`', async () => {
      const scoped = new Glob({ fs, cwd: `${root}/sub` });

      expect(await scoped.expand('.')).toEqual(['.']);
      expect(await scoped.expand('..')).toEqual(['..']);
    });

    it('resolves `.` and `..` reached through a wildcard', async () => {
      const scoped = new Glob({ fs, cwd: root });

      // readdir never reports `.` or `..`, so these only work if the walk
      // treats them as a move rather than as an entry to match
      expect((await scoped.expand('*/../*.js')).toSorted()).toEqual([
        'other/../a.js',
        'sub/../a.js',
      ]);
      expect((await scoped.expand('*/.')).toSorted()).toEqual(['other/.', 'sub/.']);
      expect((await scoped.expand('sub/./*')).toSorted()).toEqual(['sub/./c.js', 'sub/./nested']);
      expect((await scoped.expand('**/..')).toSorted()).toEqual([
        '..',
        'other/..',
        'sub/..',
        'sub/nested/..',
      ]);
    });

    it('leaves an absolute pattern absolute', async () => {
      const scoped = new Glob({ fs, cwd: root });

      // the cwd anchors relative patterns only, so it is not stripped here
      expect(await scoped.expand(`${root}/sub/*.js`)).toEqual([`${root}/sub/c.js`]);
    });

    it('defaults the cwd to the process working directory marker', async () => {
      const scoped = new Glob({ fs });

      // no cwd given, so patterns resolve against '.' — which is stripped too
      expect(await scoped.expand('package.json')).toEqual(['package.json']);
    });

    it('adds no prefix at all when the cwd is empty', async () => {
      const bare = new Glob({ fs, cwd: '' });

      expect(await bare.expand('package.json')).toEqual(['package.json']);
      expect((await bare.expand('src/*.ts')).toSorted()).toContain('src/glob.ts');
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
