import { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
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

// 3b. Bundle Web Music Setup Preload
await esbuild.build({
  entryPoints: [resolve(root, 'src/main/web-music-preload.ts')],
  outfile: resolve(distAppDir, 'web-music-preload.cjs'),
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

// 5b. Write built-in Web Music launcher start page (supports any http/https music website + persistent login)
const webMusicStartHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" />
  <title>球体网页音乐中心</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei UI", sans-serif;
      background:
        radial-gradient(circle at 20% 20%, rgba(245, 158, 11, 0.16), transparent 42%),
        radial-gradient(circle at 80% 30%, rgba(56, 189, 248, 0.16), transparent 45%),
        #0b1120;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 560px;
      padding: 28px;
      border-radius: 20px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      background: rgba(15, 23, 42, 0.84);
      backdrop-filter: blur(20px);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    }
    h1 { margin: 0 0 8px; font-size: 20px; font-weight: 700; }
    p { margin: 0 0 18px; font-size: 13px; line-height: 1.6; color: #94a3b8; }
    .row { display: flex; gap: 10px; margin-bottom: 12px; }
    input {
      flex: 1;
      height: 40px;
      padding: 0 12px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.32);
      background: rgba(2, 6, 23, 0.65);
      color: #f8fafc;
      font-size: 13px;
      outline: none;
    }
    input:focus { border-color: #38bdf8; }
    button {
      height: 40px;
      padding: 0 16px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      background: rgba(30, 41, 59, 0.9);
      color: #f8fafc;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    button.primary {
      border-color: transparent;
      background: linear-gradient(135deg, #0284c7, #0ea5e9);
    }
    button:hover { filter: brightness(1.08); }
    .hint {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(30, 41, 59, 0.55);
      font-size: 12px;
      line-height: 1.65;
      color: #cbd5e1;
    }
    .foot {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #94a3b8;
    }
    .err { min-height: 18px; font-size: 12px; color: #fda4af; }
  </style>
</head>
<body>
  <div class="card">
    <h1>网页音乐网站（球内独立登录 · 持久化保存）</h1>
    <p>输入任意可在线听歌的网站地址并登录账号；点窗口右上角关闭「×」后会隐藏到桌面悬浮球后台继续播放，登录状态自动保留。</p>
    <div class="row">
      <input id="urlInput" type="text" placeholder="例如 https://music.163.com 或你的私人音乐站地址" />
      <button id="goBtn" class="primary" type="button">进入并登录</button>
    </div>
    <div id="errBox" class="err"></div>
    <div class="hint">
      • 支持任意 Web 音乐站（云音乐、QQ音乐、YouTube Music、Spotify、自建 Navidrome/Jellyfin 等）<br/>
      • 回到桌面后：鼠标放球上<strong>上下滚轮</strong>即可调音量并同步升降液态水位；左键播放/暂停，两侧上一首/下一首
    </div>
    <div class="foot">
      <span id="statusText">会话空间：persist:stage-web-music</span>
      <button id="clearBtn" type="button">清除已保存登录</button>
    </div>
  </div>
  <script>
    const input = document.getElementById('urlInput');
    const goBtn = document.getElementById('goBtn');
    const clearBtn = document.getElementById('clearBtn');
    const errBox = document.getElementById('errBox');
    const statusText = document.getElementById('statusText');

    async function boot() {
      if (!window.stageWebMusicSetup) return;
      const saved = await window.stageWebMusicSetup.getHomeUrl();
      if (saved) input.value = saved;
      input.focus();
    }

    async function submitUrl() {
      errBox.textContent = '';
      if (!window.stageWebMusicSetup) return;
      const res = await window.stageWebMusicSetup.openUrl(input.value);
      if (!res.ok) {
        errBox.textContent = res.error || '无法打开该网址';
      }
    }

    goBtn.addEventListener('click', () => { void submitUrl(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void submitUrl();
    });
    clearBtn.addEventListener('click', async () => {
      if (!window.stageWebMusicSetup) return;
      const ok = await window.stageWebMusicSetup.clearSession();
      statusText.textContent = ok ? '已清除网页音乐 Cookie 与缓存' : '清除失败';
    });
    void boot();
  </script>
</body>
</html>
`
writeFileSync(resolve(distAppDir, 'web-music-start.html'), webMusicStartHtml, 'utf8')

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

// 7. Keep pre-built portable bundle synchronized so start-desktop scripts never run stale payloads
const portableAppDir = resolve(root, 'release/win-incident-stage-portable/resources/app')
if (existsSync(portableAppDir)) {
  cpSync(distAppDir, join(portableAppDir, 'dist-app'), { recursive: true, force: true })
  cpSync(assetsDir, join(portableAppDir, 'assets'), { recursive: true, force: true })
  cpSync(sampleDir, join(portableAppDir, 'sample'), { recursive: true, force: true })
  if (existsSync(resolve(root, 'README.md'))) {
    copyFileSync(resolve(root, 'README.md'), join(portableAppDir, 'README.md'))
  }
  console.log('Synced built payload -> release/win-incident-stage-portable/resources/app/')
}

console.log('Built win-incident-stage -> dist-app/ and assets/')
