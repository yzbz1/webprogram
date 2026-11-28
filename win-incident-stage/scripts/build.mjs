import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import * as esbuild from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distAppDir = resolve(root, 'dist-app')
const assetsDir = resolve(root, 'assets')
const sampleDir = resolve(root, 'sample')

mkdirSync(distAppDir, { recursive: true })
mkdirSync(assetsDir, { recursive: true })
mkdirSync(sampleDir, { recursive: true })

// --- Minimal pure-Node PNG generator for Tray & App icons ---
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

function createStageIconPng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const pad = size * 0.06
  const radius = size * 0.24
  const innerMin = pad + radius
  const innerMax = size - 1 - pad - radius

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
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
      const t = y / size
      let r = Math.round(56 - t * 18)
      let g = Math.round(114 - t * 24)
      let b = Math.round(230 - t * 32)

      // Stage Manager visual motif: foreground window on left + 3 tilted mini cards on right
      const nx = x / size
      const ny = y / size
      const stageWin = nx >= 0.16 && nx <= 0.54 && ny >= 0.22 && ny <= 0.78
      const rail1 = nx >= 0.62 && nx <= 0.84 && ny >= 0.22 && ny <= 0.36
      const rail2 = nx >= 0.62 && nx <= 0.84 && ny >= 0.43 && ny <= 0.57
      const rail3 = nx >= 0.62 && nx <= 0.84 && ny >= 0.64 && ny <= 0.78

      if (stageWin || rail1 || rail2 || rail3) {
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
  ihdr[8] = 8
  ihdr[9] = 6
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync(resolve(assetsDir, 'tray-icon.png'), createStageIconPng(32))
writeFileSync(resolve(assetsDir, 'app-icon.png'), createStageIconPng(128))

// 1. Bundle excel-store + exceljs
await esbuild.build({
  entryPoints: [resolve(root, 'src/main/excel-store.ts')],
  outfile: resolve(distAppDir, 'excel-store.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  logLevel: 'info',
})

// 2. Bundle Electron Main
await esbuild.build({
  entryPoints: [resolve(root, 'src/main/main.ts')],
  outfile: resolve(distAppDir, 'main.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron', './excel-store.cjs', 'koffi'],
  logLevel: 'info',
})

copyFileSync(resolve(root, 'src/main/media-helper.ps1'), resolve(distAppDir, 'media-helper.ps1'))

// 3. Bundle Electron Preload
await esbuild.build({
  entryPoints: [resolve(root, 'src/main/preload.ts')],
  outfile: resolve(distAppDir, 'preload.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  logLevel: 'info',
})

// 4. Bundle React Stage Manager Renderer
await esbuild.build({
  entryPoints: [resolve(root, 'src/renderer/index.tsx')],
  outfile: resolve(distAppDir, 'renderer.js'),
  bundle: true,
  platform: 'browser',
  target: 'chrome120',
  format: 'iife',
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
})

// 5. Write transparent HTML shell
const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; media-src 'self' stage-audio: blob: data:; script-src 'self'; style-src 'self' 'unsafe-inline';" />
  <title>事件单前台调度台</title>
</head>
<body>
  <div id="root"></div>
  <script src="./renderer.js"></script>
</body>
</html>
`
writeFileSync(resolve(distAppDir, 'index.html'), html, 'utf8')

// 6. Ensure fallback sample Excel exists
const localSample = resolve(sampleDir, 'incidents.xlsx')
const siblingSample = resolve(root, '../dsh-plugin-incident-drawer/sample/incidents.xlsx')
if (!existsSync(localSample)) {
  if (existsSync(siblingSample)) {
    copyFileSync(siblingSample, localSample)
  } else {
    const require = createRequire(import.meta.url)
    const { createSampleWorkbook } = require(resolve(distAppDir, 'excel-store.cjs'))
    await createSampleWorkbook(localSample)
  }
}

console.log('Built win-incident-stage -> dist-app/ and assets/')
