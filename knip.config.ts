import type { KnipConfig } from 'knip';

/** Vite risolve gli entry reali; senza plugin Knip segnerebbe quasi tutto `src/` come non usato. */
const config: KnipConfig = {
  vite: {
    config: 'scripts/vite.config.mjs',
  },
  project: ['src/**/*.{ts,tsx}'],
  ignore: ['src/**/*.test.*', 'src/**/*.spec.*'],
  ignoreDependencies: ['@types/*'],
};

export default config;
