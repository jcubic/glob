import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // no platform specific imports — the bundle runs in Node and in the browser
  platform: 'neutral',
  target: ['node20.19', 'es2023'],
  dts: true,
  sourcemap: true,
  clean: true,
  // publint runs as its own script, not from here. tsdown's built-in check
  // shells out to `npm pack`, which inherits `npm_config_dry_run` from an outer
  // `npm publish --dry-run` and so writes no tarball for tsdown to find.
});
