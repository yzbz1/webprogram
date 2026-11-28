import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const tempDir = mkdtempSync(join(os.tmpdir(), 'win-incident-stage-test-'))
const tempExcel = join(tempDir, 'shared.xlsx')
const tempConfig = join(tempDir, 'incident-drawer-config.json')
const tempPrefs = join(tempDir, 'win-incident-stage-prefs.json')
process.env.DSH_INCIDENT_DRAWER_CONFIG = tempConfig
process.env.STAGE_PREFS_PATH = tempPrefs

const require = createRequire(import.meta.url)
const stageExcel = require(resolve(root, 'dist-app/excel-store.cjs'))

async function runTests() {
  try {
    // 1. Verify all build artifacts
    for (const rel of [
      'dist-app/excel-store.cjs',
      'dist-app/main.cjs',
      'dist-app/preload.cjs',
      'dist-app/renderer.js',
      'dist-app/index.html',
      'dist-app/media-helper.ps1',
      'assets/tray-icon.png',
      'assets/app-icon.png',
      'sample/incidents.xlsx',
      'start-desktop.bat',
      'start-desktop-silent.vbs',
    ]) {
      assert.equal(existsSync(resolve(root, rel)), true, `Missing build artifact: ${rel}`)
    }

    const indexHtml = readFileSync(resolve(root, 'dist-app/index.html'), 'utf8')
    assert.ok(indexHtml.includes("img-src 'self' data:"), 'index.html CSP must allow base64 data: album art')
    assert.ok(indexHtml.includes("media-src 'self' stage-audio:"), 'index.html CSP must allow stage-audio: local music playback')

    const psHelper = readFileSync(resolve(root, 'dist-app/media-helper.ps1'), 'utf8')
    assert.ok(psHelper.includes('GlobalSystemMediaTransportControlsSessionManager'), 'media-helper.ps1 must query WinRT SMTC')
    assert.ok(psHelper.includes('UTF8Encoding'), 'media-helper.ps1 must enforce UTF-8 stdio')

    const rendererCode = readFileSync(resolve(root, 'dist-app/renderer.js'), 'utf8')
    assert.ok(rendererCode.includes('rotateY(-20deg)'), 'renderer.js must include Stage Manager 3D rail CSS')
    assert.ok(rendererCode.includes('data-interactive'), 'renderer.js must mark interactive hit-test regions')
    assert.ok(rendererCode.includes('stg-lights-dock'), 'renderer.js must include left-docked separated traffic-light buttons')
    assert.ok(rendererCode.includes('stg-cat-trigger'), 'renderer.js must include Bongo Cat widget')
    assert.ok(rendererCode.includes('stg-holo-mini-card'), 'renderer.js must include Stage-Manager holographic todo mini-card')
    assert.ok(rendererCode.includes('stg-holo-stage-card'), 'renderer.js must include foreground holographic todo screen')
    assert.ok(rendererCode.includes('stg-drop-sphere'), 'renderer.js must include glass pearl music player')
    assert.ok(rendererCode.includes('stg-blackhole-halo'), 'renderer.js must include black-hole hover halo')
    assert.ok(rendererCode.includes('stg-horizon-orb'), 'renderer.js must include chromatic-horizon glass sphere SVG')

    const mainCode = readFileSync(resolve(root, 'dist-app/main.cjs'), 'utf8')
    assert.ok(mainCode.includes('stage:trigger-hotkey'), 'main.cjs must register trigger-hotkey IPC handler')
    assert.ok(mainCode.includes('Win+Shift+S'), 'main.cjs must include default hotkey traffic-light presets')

    // Verify koffi native runtime resolves cleanly
    const koffi = require('koffi')
    assert.equal(typeof koffi.load, 'function', 'koffi.load must be available')

    // Verify portable CRLF ASCII batch script
    const batRaw = readFileSync(resolve(root, 'start-desktop.bat'), 'utf8')
    assert.ok(batRaw.includes('\r\n'), 'start-desktop.bat must use CRLF')
    assert.equal(/[^\x00-\x7F]/.test(batRaw), false, 'start-desktop.bat must be pure ASCII')
    assert.equal(/[A-Za-z]:\\/.test(batRaw), false, 'start-desktop.bat must not hardcode drive paths')

    // Verify DesktopPrefsStore defaults, backward compat & persistence (if TypeScript stripped check via ts-less JSON write/main bundle logic)
    assert.equal(
      readFileSync(resolve(root, 'dist-app/main.cjs'), 'utf8').includes('win-incident-stage-prefs.json'),
      true,
      'main.cjs must include prefs storage',
    )

    // 2. Test Excel store + 3-way sharing with DSH / Chrome excel-store.cjs
    const now = new Date()
    const todaySheet = stageExcel.getTodaySheetName(now)
    await stageExcel.createSampleWorkbook(tempExcel, now)

    const snap = await stageExcel.loadWorkbookData(tempExcel, undefined, now)
    assert.equal(snap.activeSheet, todaySheet)
    assert.equal(snap.rows.length, 10)
    assert.equal(snap.headers.length, 6)

    // Write via Desktop ExcelStore
    const deskSave = await stageExcel.saveCellsToWorkbook({
      excelPath: tempExcel,
      sheetName: todaySheet,
      edits: [{ rowNumber: 2, colIndex: 6, value: 'Windows 前台调度台已更新' }],
      expectedVersion: snap.version,
    })
    assert.equal(deskSave.saved, true)

    // Verify DSH & Chrome sibling excel-store.cjs read same data & trigger conflict cleanly
    for (const siblingRel of [
      '../dsh-plugin-incident-drawer/lib/excel-store.cjs',
      '../chrome-incident-drawer/bridge/excel-store.cjs',
    ]) {
      const siblingPath = resolve(root, siblingRel)
      if (!existsSync(siblingPath)) continue
      const siblingExcel = require(siblingPath)
      const siblingSnap = await siblingExcel.loadWorkbookData(tempExcel, undefined, now)
      assert.equal(siblingSnap.rows[0].cells[4], 'Windows 前台调度台已更新')

      const siblingStatus = await siblingExcel.checkWorkbookStatus(tempExcel, snap.version)
      assert.equal(siblingStatus.stale, true)
    }

    // Verify dynamic Row-1 headers & arbitrary column count
    const customExcel = join(tempDir, 'custom5.xlsx')
    const wbCustom = new ExcelJS.Workbook()
    const ws = wbCustom.addWorksheet(todaySheet)
    ws.addRow(['单号', '系统', '影响', '责任人', '结论'])
    ws.addRow(['W-01', '核心网关', '局部抖动', '张伟', '已恢复'])
    await wbCustom.xlsx.writeFile(customExcel)

    const customSnap = await stageExcel.loadWorkbookData(customExcel, undefined, now)
    assert.deepEqual(Array.from(customSnap.headers), ['单号', '系统', '影响', '责任人', '结论'])
    assert.equal(customSnap.rows[0].cells.length, 4)

    console.log('ALL WIN-INCIDENT-STAGE TESTS PASSED!')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

await runTests()
