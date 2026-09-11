import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'node',
  target: 'node20.19',
  dts: true,
  sourcemap: true,
  clean: true,
  publint: true,
});
