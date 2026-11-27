import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import * as esbuild from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bridgeDir = resolve(root, 'bridge')
const extDir = resolve(root, 'extension')
const iconsDir = resolve(extDir, 'icons')
const sampleDir = resolve(root, 'sample')

mkdirSync(bridgeDir, { recursive: true })
mkdirSync(iconsDir, { recursive: true })
mkdirSync(sampleDir, { recursive: true })

// --- Minimal pure-Node PNG generator for crisp extension icons ---
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  }
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function createIconPng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const pad = size * 0.08
  const radius = size * 0.24
  const innerMin = pad + radius
  const innerMax = size - 1 - pad - radius

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0 // PNG filter type None
    for (let x = 0; x < size; x += 1) {
      const idx = rowStart + 1 + x * 4
      const dx = x < innerMin ? innerMin - x : x > innerMax ? x - innerMax : 0
      const dy = y < innerMin ? innerMin - y : y > innerMax ? y - innerMax : 0
      const dist = Math.hypot(dx, dy)
      if (dist > radius + 0.8) {
        raw[idx] = 0
        raw[idx + 1] = 0
        raw[idx + 2] = 0
        raw[idx + 3] = 0
        continue
      }

      const alpha = dist <= radius - 0.5 ? 255 : Math.max(0, Math.min(255, Math.round((radius + 0.8 - dist) / 1.3 * 255)))
      // Cobalt blue gradient (#4176E6 -> #305CC2)
      const t = y / size
      let r = Math.round(65 - t * 17)
      let g = Math.round(118 - t * 24)
      let b = Math.round(230 - t * 34)

      // Draw crisp right-docked drawer bars (1st expanded bar, 3 compact right tabs)
      const nx = x / size
      const ny = y / size
      const bar1 = ny >= 0.24 && ny <= 0.36 && nx >= 0.22 && nx <= 0.84
      const bar2 = ny >= 0.42 && ny <= 0.52 && nx >= 0.46 && nx <= 0.84
      const bar3 = ny >= 0.58 && ny <= 0.68 && nx >= 0.46 && nx <= 0.84
      const bar4 = ny >= 0.74 && ny <= 0.82 && nx >= 0.46 && nx <= 0.84
      if (bar1 || bar2 || bar3 || bar4) {
        r = 255
        g = 255
        b = 255
      }

      raw[idx] = r
      raw[idx + 1] = g
      raw[idx + 2] = b
      raw[idx + 3] = alpha
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [16, 48, 128]) {
  writeFileSync(resolve(iconsDir, `icon-${size}.png`), createIconPng(size))
}

// --- 1. Bundle bridge excel-store + exceljs ---
await esbuild.build({
  entryPoints: [resolve(root, 'src/bridge/excel-store.ts')],
  outfile: resolve(bridgeDir, 'excel-store.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  logLevel: 'info',
})

// --- 2. Bundle bridge server ---
await esbuild.build({
  entryPoints: [resolve(root, 'src/bridge/server.ts')],
  outfile: resolve(bridgeDir, 'server.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external: ['./excel-store.cjs'],
  logLevel: 'info',
})

// --- 3. Bundle Chrome MV3 extension scripts ---
await esbuild.build({
  entryPoints: [resolve(root, 'src/extension/background.ts')],
  outfile: resolve(extDir, 'background.js'),
  bundle: true,
  platform: 'browser',
  target: 'chrome116',
  format: 'esm',
  logLevel: 'info',
})

await esbuild.build({
  entryPoints: [resolve(root, 'src/extension/content.tsx')],
  outfile: resolve(extDir, 'content.js'),
  bundle: true,
  platform: 'browser',
  target: 'chrome116',
  format: 'iife',
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
})

await esbuild.build({
  entryPoints: [resolve(root, 'src/extension/popup.ts')],
  outfile: resolve(extDir, 'popup.js'),
  bundle: true,
  platform: 'browser',
  target: 'chrome116',
  format: 'iife',
  logLevel: 'info',
})

// --- 4. Ensure fallback sample Excel exists ---
const localSample = resolve(sampleDir, 'incidents.xlsx')
const siblingSample = resolve(root, '../dsh-plugin-incident-drawer/sample/incidents.xlsx')
if (!existsSync(localSample)) {
  if (existsSync(siblingSample)) {
    copyFileSync(siblingSample, localSample)
  } else {
    const require = createRequire(import.meta.url)
    const { createSampleWorkbook } = require(resolve(bridgeDir, 'excel-store.cjs'))
    await createSampleWorkbook(localSample)
  }
}

console.log('Built chrome-incident-drawer -> bridge/ and extension/')
