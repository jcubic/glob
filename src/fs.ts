/**
 * The only thing {@link Glob} needs to know about a directory entry.
 *
 * Satisfied by Node's `fs.Stats`, ZenFS's `Stats` and LightningFS's stat object.
 */
export interface GlobStats {
  isDirectory(): boolean;
}

/**
 * The minimal filesystem {@link Glob} depends on: two promise-returning methods.
 *
 * Any library exposing these can be plugged in — `node:fs`, `@zenfs/core`,
 * `@isomorphic-git/lightning-fs`, `memfs`, or a hand written object.
 */
export interface GlobFsPromises {
  /** List the entry names of a directory. Names only, not full paths. */
  readdir(path: string): Promise<string[]>;
  /** Describe a single entry. Only `isDirectory()` is ever called. */
  stat(path: string): Promise<GlobStats>;
}

/**
 * A filesystem module that nests its promise API under `promises`, the shape
 * `node:fs`, ZenFS and LightningFS all use.
 */
export interface GlobFsModule {
  promises: GlobFsPromises;
}

/**
 * Anything accepted as the `fs` option of {@link Glob} — either the module
 * itself or its `promises` object.
 */
export type GlobFs = GlobFsModule | GlobFsPromises;

/** Narrow either accepted shape down to the two methods actually used. */
export function toPromises(fs: GlobFs): GlobFsPromises {
  const promises = (fs as Partial<GlobFsModule>).promises;

  if (promises && typeof promises.readdir === 'function') {
    return promises;
  }

  const flat = fs as Partial<GlobFsPromises>;
  if (typeof flat.readdir === 'function' && typeof flat.stat === 'function') {
    return flat as GlobFsPromises;
  }

  throw new TypeError(
    'Glob: the `fs` option must provide promise based `readdir` and `stat`, ' +
      'either directly or under `fs.promises`',
  );
}
