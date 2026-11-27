import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ExcelJS from 'exceljs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const tempDir = mkdtempSync(join(os.tmpdir(), 'chrome-incident-drawer-test-'))
const tempExcel = join(tempDir, 'shared-incidents.xlsx')
const tempConfig = join(tempDir, 'incident-drawer-config.json')
process.env.DSH_INCIDENT_DRAWER_CONFIG = tempConfig

const require = createRequire(import.meta.url)
const bridgeExcel = require(resolve(root, 'bridge/excel-store.cjs'))

async function runTests() {
  let closeServer = null
  try {
    // 1. Verify built extension bundle artifacts & Shadow DOM + click-through invariants
    for (const rel of [
      'extension/manifest.json',
      'extension/background.js',
      'extension/content.js',
      'extension/popup.html',
      'extension/popup.js',
      'extension/icons/icon-16.png',
      'extension/icons/icon-48.png',
      'extension/icons/icon-128.png',
      'bridge/server.mjs',
      'bridge/excel-store.cjs',
      'sample/incidents.xlsx',
    ]) {
      assert.equal(existsSync(resolve(root, rel)), true, `Missing build artifact: ${rel}`)
    }

    const contentCode = readFileSync(resolve(root, 'extension/content.js'), 'utf8')
    assert.ok(contentCode.includes('attachShadow'), 'content.js must isolate UI in Shadow DOM')
    assert.ok(contentCode.includes('pointer-events: none !important'), 'content.js must preserve click-through')

    // Verify portable CRLF ASCII batch scripts
    for (const bat of ['start-bridge.bat', 'stop-bridge.bat']) {
      const raw = readFileSync(resolve(root, bat), 'utf8')
      assert.ok(raw.includes('\r\n'), `${bat} must use CRLF line endings`)
      assert.equal(/[^\x00-\x7F]/.test(raw), false, `${bat} must be pure ASCII`)
      assert.equal(/[A-Za-z]:\\/.test(raw), false, `${bat} must not hardcode drive paths`)
    }

    // 2. Boot bridge server on ephemeral port 0
    const { startBridgeServer } = await import(pathToFileURL(resolve(root, 'bridge/server.mjs')).href)
    const now = new Date()
    const todaySheet = bridgeExcel.getTodaySheetName(now)
    await bridgeExcel.createSampleWorkbook(tempExcel, now)

    const srv = await startBridgeServer({
      port: 0,
      configFilePath: tempConfig,
      initialExcelPath: tempExcel,
      pidFilePath: null,
    })
    closeServer = srv.close
    const baseUrl = `http://${srv.host}:${srv.port}`

    // 3. Health & security checks (CORS / Origin / Client Header)
    const healthRes = await fetch(`${baseUrl}/health`)
    assert.equal(healthRes.status, 200)
    const healthJson = await healthRes.json()
    assert.equal(healthJson.ok, true)
    assert.equal(healthJson.excelPath, tempExcel)

    const evilOriginRes = await fetch(`${baseUrl}/api/incident-drawer`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
        'x-incident-drawer-client': 'chrome-ext',
      },
      body: JSON.stringify({ endpoint: 'load', payload: {} }),
    })
    assert.equal(evilOriginRes.status, 403, 'must reject arbitrary web origins')

    const missingHeaderRes = await fetch(`${baseUrl}/api/incident-drawer`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'chrome-extension://abcdef',
      },
      body: JSON.stringify({ endpoint: 'load', payload: {} }),
    })
    assert.equal(missingHeaderRes.status, 403, 'must require custom extension header')

    const callApi = async (endpoint, payload = {}) => {
      const r = await fetch(`${baseUrl}/api/incident-drawer`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'chrome-extension://abcdef',
          'x-incident-drawer-client': 'chrome-ext',
        },
        body: JSON.stringify({ endpoint, payload }),
      })
      assert.equal(r.status, 200)
      return r.json()
    }

    // 4. Test Chrome <-> DSH shared Excel & shared config synchronization
    const load1 = await callApi('load')
    assert.equal(load1.ok, true)
    assert.equal(load1.value.rows.length, 10)
    assert.equal(load1.value.activeSheet, todaySheet)

    // Chrome edits cell -> verify via DSH's own excel-store.cjs if present
    const save1 = await callApi('save-cell', {
      sheetName: todaySheet,
      rowNumber: 2,
      colIndex: 6,
      value: 'Chrome 侧修改同步给 DSH',
      expectedVersion: load1.value.version,
    })
    assert.equal(save1.ok, true)
    assert.equal(save1.value.saved, true)

    const dshExcelStorePath = resolve(root, '../dsh-plugin-incident-drawer/lib/excel-store.cjs')
    if (existsSync(dshExcelStorePath)) {
      const dshExcel = require(dshExcelStorePath)
      const dshSnap = await dshExcel.loadWorkbookData(tempExcel, undefined, now)
      assert.equal(dshSnap.rows[0].cells[4], 'Chrome 侧修改同步给 DSH')

      // Now DSH writes cell -> Chrome detects stale & conflict!
      const dshSave = await dshExcel.saveCellsToWorkbook({
        excelPath: tempExcel,
        sheetName: todaySheet,
        edits: [{ rowNumber: 3, colIndex: 4, value: 'DSH 侧更新状态' }],
        expectedVersion: dshSnap.version,
      })
      assert.equal(dshSave.saved, true)

      const staleCheck = await callApi('check-status', { knownVersion: save1.value.version })
      assert.equal(staleCheck.ok, true)
      assert.equal(staleCheck.value.stale, true)

      const conflictSave = await callApi('save-cell', {
        sheetName: todaySheet,
        rowNumber: 2,
        colIndex: 4,
        value: 'Chrome 旧版本保存应被拦截',
        expectedVersion: save1.value.version,
      })
      assert.equal(conflictSave.ok, true)
      assert.equal(conflictSave.value.saved, false)
      assert.equal(conflictSave.value.conflict, true)

      const forceSave = await callApi('save-cell', {
        sheetName: todaySheet,
        rowNumber: 2,
        colIndex: 4,
        value: 'Chrome 确认覆盖后状态',
        expectedVersion: save1.value.version,
        forceOverwrite: true,
      })
      assert.equal(forceSave.ok, true)
      assert.equal(forceSave.value.saved, true)
    }

    // 5. Test shared config update + dynamic custom headers (4 cols)
    const customExcel = join(tempDir, 'custom4.xlsx')
    const wbCustom = new ExcelJS.Workbook()
    const ws = wbCustom.addWorksheet(todaySheet)
    ws.addRow(['单号', '客户', '优先级', '备注'])
    ws.addRow(['ORD-101', '核心银行', 'P1', '需要立即跟进'])
    await wbCustom.xlsx.writeFile(customExcel)

    const setCfg = await callApi('set-config', { excelPath: customExcel })
    assert.equal(setCfg.ok, true)
    assert.deepEqual(Array.from(setCfg.value.headers), ['单号', '客户', '优先级', '备注'])
    assert.equal(setCfg.value.rows[0].cells.length, 3)

    console.log('ALL CHROME BRIDGE & SHARED-EXCEL TESTS PASSED!')
  } finally {
    if (closeServer) await closeServer()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

await runTests()
