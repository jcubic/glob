import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Glob } from '../src/glob.js';
import { match } from '../src/match.js';

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
  await fs.promises.mkdir(path.join(root, '.hidden'), { recursive: true });

  await Promise.all([
    fs.promises.writeFile(path.join(root, 'a.js'), ''),
    fs.promises.writeFile(path.join(root, 'b.txt'), ''),
    fs.promises.writeFile(path.join(root, 'sub', 'c.js'), ''),
    fs.promises.writeFile(path.join(root, 'sub', 'nested', 'd.js'), ''),
    fs.promises.writeFile(path.join(root, 'other', 'e.js'), ''),
    fs.promises.writeFile(path.join(root, '.env'), ''),
    fs.promises.writeFile(path.join(root, '.hidden', 'f.js'), ''),
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

    describe('a pattern ending in a separator', () => {
      it('matches directories only, and keeps the separator bash prints', async () => {
        expect((await glob.expand(`${root}/*/`)).toSorted()).toEqual([
          `${root}/other/`,
          `${root}/sub/`,
        ]);
      });

      it('includes the directory a `**` starts from', async () => {
        expect((await glob.expand(`${root}/**/`)).toSorted()).toEqual([
          `${root}/`,
          `${root}/other/`,
          `${root}/sub/`,
          `${root}/sub/nested/`,
        ]);
      });

      it('descends a level per wildcard', async () => {
        expect(await glob.expand(`${root}/*/*/`)).toEqual([`${root}/sub/nested/`]);
      });

      it('resolves a literal directory', async () => {
        expect(await glob.expand(`${root}/sub/`)).toEqual([`${root}/sub/`]);
      });

      it('rejects a file, which is no directory however it is written', async () => {
        expect(await glob.expand(`${root}/a.js/`)).toEqual([]);
        expect(await glob.expand(`${root}/*.js/`)).toEqual([]);
      });
    });

    describe('an entry starting with a dot', () => {
      it('is not matched by a wildcard', async () => {
        expect(relative(await glob.expand(`${root}/*`))).toEqual(['a.js', 'b.txt', 'other', 'sub']);
        expect((await glob.expand(`${root}/*/`)).toSorted()).toEqual([
          `${root}/other/`,
          `${root}/sub/`,
        ]);
      });

      it('is matched by a segment written with a leading dot', async () => {
        expect(relative(await glob.expand(`${root}/.*`))).toEqual(['.env', '.hidden']);
        expect(relative(await glob.expand(`${root}/.[e]nv`))).toEqual(['.env']);
        expect((await glob.expand(`${root}/.*/`)).toSorted()).toEqual([`${root}/.hidden/`]);
      });

      it('needs that dot to be literal, as bash does', async () => {
        // bash leaves `[.]env` unmatched: a set is no explicit dot
        expect(await glob.expand(`${root}/[.]env`)).toEqual([]);
      });

      it('is judged the same way by match()', async () => {
        const pattern = `${root}/*`;

        expect((await glob.expand(pattern)).every((found) => match(pattern, found))).toBe(true);
        expect(match(pattern, `${root}/.env`)).toBe(false);
        expect(match(pattern, `${root}/.env`, { dot: true })).toBe(true);
      });

      it('is reachable as a literal directory', async () => {
        expect(relative(await glob.expand(`${root}/.hidden/*`))).toEqual(['.hidden/f.js']);
      });

      it('is not descended into by `**`', async () => {
        expect(relative(await glob.expand(`${root}/**/*.js`))).toEqual([
          'a.js',
          'other/e.js',
          'sub/c.js',
          'sub/nested/d.js',
        ]);
      });

      describe('with the dot option', () => {
        let dotted: Glob;

        beforeAll(() => {
          dotted = new Glob({ fs, dot: true });
        });

        it('is matched by a wildcard', async () => {
          expect(relative(await dotted.expand(`${root}/*`))).toEqual([
            '.env',
            '.hidden',
            'a.js',
            'b.txt',
            'other',
            'sub',
          ]);
        });

        it('is descended into by `**`', async () => {
          expect(relative(await dotted.expand(`${root}/**/*.js`))).toEqual([
            '.hidden/f.js',
            'a.js',
            'other/e.js',
            'sub/c.js',
            'sub/nested/d.js',
          ]);
        });

        it('is reported by a trailing separator', async () => {
          expect((await dotted.expand(`${root}/*/`)).toSorted()).toEqual([
            `${root}/.hidden/`,
            `${root}/other/`,
            `${root}/sub/`,
          ]);
        });

        it('lifts the restriction entirely, so even a set reaches it', async () => {
          // bash with `shopt -s dotglob` matches `[.]env` too
          expect(relative(await dotted.expand(`${root}/[.]env`))).toEqual(['.env']);
        });
      });
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

    it('matches directories only when it ends in a separator', async () => {
      const scoped = new Glob({ fs, cwd: root });

      expect((await scoped.expand('*/')).toSorted()).toEqual(['other/', 'sub/']);
      expect(await scoped.expand('*/*/')).toEqual(['sub/nested/']);
      expect(await scoped.expand('sub/')).toEqual(['sub/']);
      expect(await scoped.expand('a.js/')).toEqual([]);
      expect((await scoped.expand('./*/')).toSorted()).toEqual(['./other/', './sub/']);
    });

    it('keeps the separator on a `.` or `..` reached through a wildcard', async () => {
      const scoped = new Glob({ fs, cwd: root });

      expect((await scoped.expand('*/./')).toSorted()).toEqual(['other/./', 'sub/./']);
      expect((await scoped.expand('*/../')).toSorted()).toEqual(['other/../', 'sub/../']);
      expect(await scoped.expand('./')).toEqual(['./']);
    });

    it('omits the cwd from a `**` ending in a separator', async () => {
      const scoped = new Glob({ fs, cwd: root });

      // bash lists no `./` here, the same way a bare `**` lists no `.`
      expect((await scoped.expand('**/')).toSorted()).toEqual(['other/', 'sub/', 'sub/nested/']);
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
