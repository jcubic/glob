import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { glob, type GlobError } from '../src/glob.js';

/** Promise wrapper around the callback API, with results sorted for stable assertions. */
function globAsync(pattern: string, flags?: unknown): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const done = (error: GlobError | null, matches?: string[]): void => {
      if (error) {
        reject(error);
        return;
      }
      resolve((matches ?? []).toSorted());
    };

    if (flags === undefined) {
      glob(pattern, done);
    } else {
      glob(pattern, flags, done);
    }
  });
}

let root: string;

/** Turn absolute matches back into paths relative to the fixture root. */
function relative(matches: string[]): string[] {
  return matches.map((match) => path.relative(root, match)).toSorted();
}

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'bash-globe-'));

  await fs.mkdir(path.join(root, 'sub', 'nested'), { recursive: true });
  await fs.mkdir(path.join(root, 'other'), { recursive: true });

  await Promise.all([
    fs.writeFile(path.join(root, 'a.js'), ''),
    fs.writeFile(path.join(root, 'b.txt'), ''),
    fs.writeFile(path.join(root, 'sub', 'c.js'), ''),
    fs.writeFile(path.join(root, 'sub', 'nested', 'd.js'), ''),
    fs.writeFile(path.join(root, 'other', 'e.js'), ''),
  ]);
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('glob', () => {
  it('expands `*` within a single directory', async () => {
    expect(relative(await globAsync(`${root}/*.js`))).toEqual(['a.js']);
  });

  it('lists every entry for a bare `*`', async () => {
    expect(relative(await globAsync(`${root}/*`))).toEqual(['a.js', 'b.txt', 'other', 'sub']);
  });

  it('expands `**` across directory levels', async () => {
    expect(relative(await globAsync(`${root}/**/*.js`))).toEqual([
      'other/e.js',
      'sub/c.js',
      'sub/nested/d.js',
    ]);
  });

  it('expands a literal set', async () => {
    expect(relative(await globAsync(`${root}/{a,b}.*`))).toEqual(['a.js', 'b.txt']);
  });

  it('expands a character set', async () => {
    expect(relative(await globAsync(`${root}/[ab].*`))).toEqual(['a.js', 'b.txt']);
  });

  it('expands `?`', async () => {
    expect(relative(await globAsync(`${root}/?.js`))).toEqual(['a.js']);
  });

  it('descends through a literal directory before expanding', async () => {
    expect(relative(await globAsync(`${root}/sub/*.js`))).toEqual(['sub/c.js']);
  });

  it('returns an empty list when nothing matches', async () => {
    expect(await globAsync(`${root}/*.rb`)).toEqual([]);
  });

  it('accepts the legacy three-argument form with unused flags', async () => {
    expect(relative(await globAsync(`${root}/*.js`, 0))).toEqual(['a.js']);
  });

  it('reports an error for a directory that does not exist', async () => {
    await expect(globAsync(`${root}/nope/*.js`)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('throws synchronously when no callback is given', () => {
    // @ts-expect-error -- exercising the runtime guard
    expect(() => glob(`${root}/*.js`)).toThrow(/callback function is required/);
  });
});
