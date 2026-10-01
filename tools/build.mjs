/**
 * Build script — two bundles into lib/:
 *
 *   lib/index.js   host entry, plain ESM for the Node runtime
 *                  (@deepseek-ai/* stay external: the profile provides them)
 *
 *   lib/client.js  browser entry wrapped in the harness ModuleLoader format:
 *                  window.__ModuleLoader__.load({ id, factory(require) })
 *                  (react and @deepseek-ai/* resolve through the loader)
 *
 * panel.css ships as a text module (no CSS pipeline — injected as <style>).
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

mkdirSync('lib', { recursive: true })

await build({
  entryPoints: ['src/host/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  external: ['@deepseek-ai/*'],
  logLevel: 'info',
})

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  jsx: 'automatic',
  external: ['react', 'react/*', '@deepseek-ai/*'],
  loader: { '.css': 'text' },
  banner: {
    js: `window.__ModuleLoader__.load({id:'${pkg.name}',factory:function(require){var module={exports:{}};var exports=module.exports;`,
  },
  footer: {
    js: `;return module.exports;}});`,
  },
  logLevel: 'info',
})
