import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/main.tsx',
    'src/App.tsx',
    'src/components/**/*.tsx',
    'scripts/**/*.mjs',
    'index.html',
  ],
  project: ['src/**/*.{ts,tsx}'],
  ignore: [
    'src/**/*.test.*',
    'src/**/*.spec.*',
    'src/**/__tests__/**',
    'src/utils/translations.ts', // file dati, non componente
    'public/**',
    'src/pulltorefreshjs.d.ts', // dichiarazione tipi per pulltorefreshjs
  ],
  ignoreDependencies: [
    '@types/*',
    'vite',
    'typescript',
    // script / tooling
    'sharp',
    '@google/generative-ai',
    'tesseract.js',
  ],
  ignoreBinaries: ['wrangler'],
  ignoreExportsUsedInFile: true,
};

export default config;
