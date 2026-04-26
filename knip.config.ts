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
  /**
   * Molti `src/utils/*.ts` espongono helper per uso incrociato o futuro: knip non risolve
   * tutti i call graph. Layout/Tenant: hook + tipi re-export intenzionali.
   */
  ignoreIssues: {
    'src/utils/**/*.ts': ['exports', 'types', 'duplicates', 'nsExports', 'nsTypes', 'namespaceMembers', 'enumMembers'],
    'src/context/LayoutPresetContext.tsx': ['exports', 'types', 'duplicates', 'nsExports'],
    'src/context/TenantContext.tsx': ['exports', 'types', 'duplicates', 'nsExports'],
  },
  ignoreExportsUsedInFile: true,
};

export default config;
