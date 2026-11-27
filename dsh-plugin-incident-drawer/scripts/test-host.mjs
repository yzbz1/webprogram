import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'
import ExcelJS from 'exceljs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const tempDir = mkdtempSync(join(os.tmpdir(), 'dsh-incident-drawer-test-'))
const tempExcel = join(tempDir, 'incidents.xlsx')
const tempConfig = join(tempDir, 'config.json')
process.env.DSH_INCIDENT_DRAWER_CONFIG = tempConfig

const require = createRequire(import.meta.url)
const excelStore = require(resolve(root, 'lib/excel-store.cjs'))

async function runTests() {
  try {
    // 1. Create sample Excel and test today's YYYYMMDD sheet + max 10 rows + hyperlinks
    const now = new Date()
    const todaySheet = excelStore.getTodaySheetName(now)
    await excelStore.createSampleWorkbook(tempExcel, now)

    const wbModify = new ExcelJS.Workbook()
    await wbModify.xlsx.readFile(tempExcel)
    const wsToday = wbModify.getWorksheet(todaySheet)
    assert.ok(wsToday, 'today sheet should exist')
    wsToday.getRow(5).getCell(1).value = 'https://itsm.company.internal/tickets/DIRECT-URL-04'
    await wbModify.xlsx.writeFile(tempExcel)

    const snap1 = await excelStore.loadWorkbookData(tempExcel, undefined, now)
    assert.equal(snap1.exists, true)
    assert.equal(snap1.activeSheet, todaySheet)
    assert.equal(snap1.matchedToday, true)
    assert.equal(snap1.headers.length, 6)
    assert.equal(snap1.rows.length, 10, 'should load only first 10 rows')
    assert.equal(snap1.totalDataRows, 12, 'totalDataRows should reflect all 12 rows')

    // Verify all 3 hyperlink types
    assert.equal(snap1.rows[0].hyperlink, `https://itsm.company.internal/tickets/INC-${todaySheet}-01`)
    assert.equal(snap1.rows[1].hyperlink, `https://itsm.company.internal/tickets/INC-${todaySheet}-02`)
    assert.equal(snap1.rows[3].hyperlink, 'https://itsm.company.internal/tickets/DIRECT-URL-04')
    assert.equal(snap1.rows[6].hyperlink, null)

    // 2. Test Host plugin fetch route end-to-end
    const hostPlugin = await import(pathToFileURL(resolve(root, 'lib/index.js')).href)
    assert.equal(hostPlugin.name, 'incident-drawer')
    assert.deepEqual(hostPlugin.inject, ['connection'])

    let registeredRoute = null
    const cleanups = []
    const mockHostCtx = {
      connection: {
        fetch: {
          register(route) {
            assert.equal(route.path, '/api/incident-drawer')
            assert.deepEqual(route.methods, ['POST'])
            registeredRoute = route
            return async () => { registeredRoute = null }
          },
        },
      },
      effect(cb) {
        const dispose = cb()
        if (typeof dispose === 'function') cleanups.push(dispose)
        return () => {}
      },
    }

    hostPlugin.apply(mockHostCtx, { excelPath: tempExcel })
    assert.ok(registeredRoute, 'Fetch route should be registered')

    const callHost = async (endpoint, payload) => {
      const req = new Request('http://127.0.0.1/api/incident-drawer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint, payload }),
      })
      const res = await registeredRoute.fetch(req)
      return res.json()
    }

    const loadRes = await callHost('load', {})
    assert.equal(loadRes.ok, true)
    assert.equal(loadRes.value.rows.length, 10)

    // Reject editing Column 1 (read-only)
    const col1Res = await callHost('save-cell', {
      sheetName: todaySheet,
      rowNumber: 2,
      colIndex: 1,
      value: 'HACKED',
      expectedVersion: loadRes.value.version,
    })
    assert.equal(col1Res.ok, true)
    assert.equal(col1Res.value.saved, false)
    assert.match(col1Res.value.error, /只读/)

    // Edit Column 6 (row 2) and verify lossless write-back
    const editRes = await callHost('save-cell', {
      sheetName: todaySheet,
      rowNumber: 2,
      colIndex: 6,
      value: '已通过自动化测试更新进展',
      expectedVersion: loadRes.value.version,
    })
    assert.equal(editRes.ok, true)
    assert.equal(editRes.value.saved, true)
    assert.ok(editRes.value.version && editRes.value.version !== loadRes.value.version)

    const wbCheck = new ExcelJS.Workbook()
    await wbCheck.xlsx.readFile(tempExcel)
    const wsCheck = wbCheck.getWorksheet(todaySheet)
    assert.equal(wsCheck.getRow(2).getCell(6).value, '已通过自动化测试更新进展')
    assert.deepEqual(wsCheck.getRow(2).getCell(1).value, {
      text: `INC-${todaySheet}-01`,
      hyperlink: `https://itsm.company.internal/tickets/INC-${todaySheet}-01`,
    })
    assert.equal(wsCheck.getRow(12).getCell(2).value, '第 11 条单据（验证面板只加载前 10 条且写回不丢此行）')
    assert.equal(wbCheck.worksheets.length, 2, 'yesterday sheet should remain intact')

    // 3. External file modification -> check-status stale + save conflict + forceOverwrite
    const staleExpected = editRes.value.version
    wsCheck.getRow(3).getCell(4).value = '外部系统已关闭'
    await wbCheck.xlsx.writeFile(tempExcel)

    const statusRes = await callHost('check-status', { knownVersion: staleExpected })
    assert.equal(statusRes.ok, true)
    assert.equal(statusRes.value.stale, true)

    const conflictRes = await callHost('save-cell', {
      sheetName: todaySheet,
      rowNumber: 2,
      colIndex: 4,
      value: '本地冲突修改',
      expectedVersion: staleExpected,
    })
    assert.equal(conflictRes.ok, true)
    assert.equal(conflictRes.value.saved, false)
    assert.equal(conflictRes.value.conflict, true)

    const forceRes = await callHost('save-cell', {
      sheetName: todaySheet,
      rowNumber: 2,
      colIndex: 4,
      value: '强制覆盖后状态',
      expectedVersion: staleExpected,
      forceOverwrite: true,
    })
    assert.equal(forceRes.ok, true)
    assert.equal(forceRes.value.saved, true)

    // 3b. Dynamic Row 1 headers & arbitrary column count (4 cols + 8 cols, no hardcoded header names)
    const customExcel = join(tempDir, 'custom-cols.xlsx')
    const wbCustom = new ExcelJS.Workbook()
    const ws4 = wbCustom.addWorksheet(todaySheet)
    ws4.addRow(['工单编号', '业务模块', '影响范围', '当前备注'])
    ws4.addRow(['REQ-001', '结算网关', '华东集群', '多行备注\n第二行详情'])
    const ws8 = wbCustom.addWorksheet('custom8')
    ws8.addRow(['单号', '字段A', '字段B', '字段C', '字段D', '字段E', '字段F', '字段G'])
    ws8.addRow(['T-801', 'a', 'b', 'c', 'd', 'e', 'f', 'g'])
    await wbCustom.xlsx.writeFile(customExcel)

    const snap4 = await excelStore.loadWorkbookData(customExcel, undefined, now)
    assert.deepEqual(Array.from(snap4.headers), ['工单编号', '业务模块', '影响范围', '当前备注'])
    assert.equal(snap4.rows[0].cells.length, 3)
    assert.equal(snap4.rows[0].cells[2], '多行备注\n第二行详情')

    const snap8 = await excelStore.loadWorkbookData(customExcel, 'custom8', now)
    assert.deepEqual(Array.from(snap8.headers), ['单号', '字段A', '字段B', '字段C', '字段D', '字段E', '字段F', '字段G'])
    assert.equal(snap8.rows[0].cells.length, 7)

    const saveCol7 = await excelStore.saveCellsToWorkbook({
      excelPath: customExcel,
      sheetName: 'custom8',
      edits: [{ rowNumber: 2, colIndex: 7, value: '已更新字段F' }],
      expectedVersion: snap8.version,
    })
    assert.equal(saveCol7.saved, true)
    const snap8After = await excelStore.loadWorkbookData(customExcel, 'custom8', now)
    assert.equal(snap8After.rows[0].cells[5], '已更新字段F')

    // 4. Verify Client bundle loads via window.__ModuleLoader__.load and registers shell.overlay
    const clientCode = readFileSync(resolve(root, 'lib/client.js'), 'utf8')
    let registeredFactory = null
    const mockStyleTags = []
    const mockDocument = {
      head: {
        appendChild(el) { mockStyleTags.push(el) },
      },
      createElement(tagName) {
        return {
          tagName: tagName.toUpperCase(),
          dataset: {},
          textContent: '',
          remove() {},
        }
      },
      querySelector() { return null },
    }
    const sandbox = {
      window: {
        __ModuleLoader__: {
          load({ id, factory }) {
            assert.equal(id, 'dsh-plugin-incident-drawer')
            registeredFactory = factory
          },
        },
      },
      document: mockDocument,
      console,
      Object,
    }
    vm.runInNewContext(clientCode, sandbox)
    assert.ok(registeredFactory, 'client.js must call window.__ModuleLoader__.load')

    const clientExports = registeredFactory((specifier) => {
      if (specifier === 'react') return require('react')
      if (specifier === 'react/jsx-runtime') return require('react/jsx-runtime')
      throw new Error(`Unexpected external require in client bundle: ${specifier}`)
    })
    assert.deepEqual(Array.from(clientExports.inject), ['slots'])

    const registeredSlots = []
    const effectDisposers = []
    const mockClientCtx = {
      slots: {
        inject(slotName, fn) {
          assert.equal(slotName, 'shell.overlay')
          return fn()
        },
        register(options, component) {
          registeredSlots.push({ options, component })
          return () => {}
        },
      },
      effect(cb) {
        const d = cb()
        if (typeof d === 'function') effectDisposers.push(d)
        return () => {}
      },
    }

    clientExports.apply(mockClientCtx)
    assert.equal(registeredSlots.length, 1)
    assert.equal(registeredSlots[0].options.name, 'shell.overlay')
    assert.equal(registeredSlots[0].options.id, 'incident-drawer')
    assert.equal(mockStyleTags.length, 1)
    assert.equal(mockStyleTags[0].dataset.plugin, 'dsh-plugin-incident-drawer')
    assert.ok(mockStyleTags[0].textContent.includes('pointer-events: none !important'))

    for (const d of [...effectDisposers, ...cleanups]) d()
    writeFileSync(join(tempDir, 'done.txt'), 'ok', 'utf8')
    console.log('ALL TESTS PASSED!')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

await runTests()
