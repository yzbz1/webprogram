import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const libDir = resolve(root, 'lib')

mkdirSync(libDir, { recursive: true })

// 1. Bundle excel-store + exceljs into self-contained CJS helper (zero runtime deps)
await esbuild.build({
  entryPoints: [resolve(root, 'src/host/excel-store.ts')],
  outfile: resolve(libDir, 'excel-store.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  logLevel: 'info',
})

// 2. Bundle Host plugin entry as ESM
await esbuild.build({
  entryPoints: [resolve(root, 'src/host/index.ts')],
  outfile: resolve(libDir, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external: ['./excel-store.cjs'],
  logLevel: 'info',
})

// 3. Bundle Client plugin entry and wrap in DSH __ModuleLoader__ lazy CJS factory
const clientResult = await esbuild.build({
  entryPoints: [resolve(root, 'src/client/index.tsx')],
  bundle: true,
  write: false,
  platform: 'browser',
  target: 'es2022',
  format: 'cjs',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
})

const rawClientCode = clientResult.outputFiles[0]?.text ?? ''
const wrappedClientCode = [
  `window.__ModuleLoader__.load({`,
  `  id: ${JSON.stringify(pkg.name)},`,
  `  factory: (require) => {`,
  `    var module = { exports: {} };`,
  `    var exports = module.exports;`,
  `    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });`,
  rawClientCode,
  `    return module.exports;`,
  `  }`,
  `});`,
  '',
].join('\n')

writeFileSync(resolve(libDir, 'client.js'), wrappedClientCode, 'utf8')
console.log(`Built plugin "${pkg.name}" -> lib/index.js, lib/excel-store.cjs, lib/client.js`)
