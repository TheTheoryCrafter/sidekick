// Builds everything that ships, then checks the size budget.
//   dist/sidekick.mjs        ES module (npm "sidekick-pet")
//   dist/react.mjs           React wrapper ("sidekick-pet/react"), "use client"
//   dist/pets/<id>.mjs       each bundled pet as data ("sidekick-pet/pets/<id>")
//   dist/sidekick.js         single script-tag build (IIFE, minified)
//   dist/pets/<id>/          pet folders for the script tag and static hosting
//   dist/types/              TypeScript declarations
import { execFileSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const dist = resolve(root, 'dist');
/** gzip budget for the script-tag build (pets not included). The .mjs keeps whitespace for consumers' bundlers, so it is only reported. */
const BUDGET = { 'sidekick.js': 20 * 1024 };

rmSync(dist, { recursive: true, force: true });

const petModules = readdirSync(resolve(root, 'src/pets')).filter((f) => f.endsWith('.ts')).map((f) => f.slice(0, -3));

const common = { root, configFile: false, logLevel: 'warn', publicDir: false };

await build({
  ...common,
  build: {
    outDir: dist,
    emptyOutDir: false,
    target: 'es2019',
    minify: 'esbuild',
    assetsInlineLimit: Infinity,
    lib: {
      entry: {
        sidekick: resolve(root, 'src/index.ts'),
        react: resolve(root, 'src/react.ts'),
        ...Object.fromEntries(petModules.map((p) => [`pets/${p}`, resolve(root, `src/pets/${p}.ts`)])),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.mjs`,
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
      output: {
        chunkFileNames: 'chunks/[name]-[hash].mjs',
        banner: (chunk) => (chunk.name === 'react' ? '"use client";' : ''),
      },
    },
  },
});

await build({
  ...common,
  build: {
    outDir: dist,
    emptyOutDir: false,
    target: 'es2019',
    minify: 'esbuild',
    lib: {
      entry: resolve(root, 'src/entries/script.ts'),
      formats: ['iife'],
      name: 'SidekickScript',
      fileName: () => 'sidekick.js',
    },
  },
});

cpSync(resolve(root, 'pets'), resolve(dist, 'pets'), { recursive: true });

execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', resolve(root, 'tsconfig.build.json')], { stdio: 'inherit' });

// Size report and budget.
let over = false;
const rows = ['sidekick.js', 'sidekick.mjs', 'react.mjs', ...petModules.map((p) => `pets/${p}.mjs`)].map((f) => {
  const buf = readFileSync(resolve(dist, f));
  const gz = gzipSync(buf, { level: 9 }).length;
  const budget = BUDGET[f];
  if (budget && gz > budget) over = true;
  return `${f.padEnd(28)} ${(statSync(resolve(dist, f)).size / 1024).toFixed(1).padStart(7)} kB  gzip ${(gz / 1024).toFixed(1).padStart(6)} kB${budget ? `  (budget ${(budget / 1024).toFixed(0)} kB)` : ''}`;
});
console.log(rows.join('\n'));
if (over) {
  console.error('Size budget exceeded.');
  process.exit(1);
}
