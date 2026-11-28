import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import ExcelJS from 'exceljs'
import {
  DEFAULT_SERVICE_CATEGORIES,
  addWorkingHours,
  computeWorkingHoursRemaining,
  evaluateSla,
  formatLocalDateTime,
} from '../shared/sla.ts'
export { computeWorkingHoursRemaining, evaluateSla }
import type {
  CellEdit,
  DrawerSnapshot,
  IncidentRow,
  SaveResult,
  StatusCheckResult,
} from '../shared/types.ts'

export const MAX_ROWS = 10
export const MAX_SCAN_COLS = 30
export const MAX_EDITABLE_COL = 50
export const CATEGORY_DICT_SHEET_NAMES: ReadonlySet<string> = new Set([
  '服务分类字典',
  '分类字典',
])
export const SAMPLE_HEADERS: readonly string[] = [
  '事件单号',
  '标题',
  '问题描述',
  '服务分类',
  '服务子分类',
  '解决方案：',
  'SLA 到期时间',
  '提单人',
  '处理群组（welink群）',
]

const LOCK_ERROR_CODES = new Set(['EBUSY', 'EPERM', 'EACCES'])
const writeQueues = new Map<string, Promise<unknown>>()

function withPathLock<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const key = resolve(filePath).toLowerCase()
  const prev = writeQueues.get(key) ?? Promise.resolve()
  const next = prev.catch(() => undefined).then(task)
  const tracked = next.finally(() => {
    if (writeQueues.get(key) === tracked) {
      writeQueues.delete(key)
    }
  })
  writeQueues.set(key, tracked)
  return next
}

export function getTodaySheetName(now: Date = new Date()): string {
  const y = String(now.getFullYear())
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

export function getTodayDateCandidates(now: Date = new Date()): string[] {
  const y = String(now.getFullYear())
  const mNum = now.getMonth() + 1
  const dNum = now.getDate()
  const m = String(mNum).padStart(2, '0')
  const d = String(dNum).padStart(2, '0')
  return [
    `${y}${m}${d}`,
    `${y}-${m}-${d}`,
    `${y}.${m}.${d}`,
    `${y}_${m}_${d}`,
    `${y}/${m}/${d}`,
    `${m}${d}`,
    `${m}-${d}`,
    `${mNum}.${dNum}`,
    `${mNum}月${dNum}日`,
    `${m}月${d}日`,
  ]
}

export async function computeFileVersion(excelPath: string): Promise<string | null> {
  if (!existsSync(excelPath)) return null
  const [st, buf] = await Promise.all([stat(excelPath), readFile(excelPath)])
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16)
  return `${Math.trunc(st.mtimeMs)}:${st.size}:${hash}`
}

function sanitizeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
  } catch {
    return null
  }
  return null
}

function formatRichText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value && typeof value === 'object' && Array.isArray((value as { richText?: unknown[] }).richText)) {
    return ((value as { richText: Array<{ text?: unknown }> }).richText)
      .map(part => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
  }
  return ''
}

function formatDateValue(date: Date): string {
  const y = String(date.getUTCFullYear())
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const hh = date.getUTCHours()
  const mm = date.getUTCMinutes()
  const ss = date.getUTCSeconds()
  if (hh === 0 && mm === 0 && ss === 0) {
    return `${y}-${m}-${d}`
  }
  return `${y}-${m}-${d} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return formatDateValue(value)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj.richText)) return formatRichText(obj)
    if ('hyperlink' in obj) {
      const text = formatRichText(obj.text)
      if (text) return text
      return typeof obj.hyperlink === 'string' ? obj.hyperlink : ''
    }
    if ('formula' in obj || 'sharedFormula' in obj) {
      return formatCellValue(obj.result)
    }
    if ('error' in obj) return String(obj.error)
    if ('text' in obj) return formatRichText(obj.text)
  }
  return String(value)
}

const HYPERLINK_FORMULA_RE = /^\s*=?\s*HYPERLINK\s*\(\s*["']([^"']+)["']\s*(?:[,;]\s*["']([^"']*)["']\s*)?\)\s*$/i

export function parseTicketCell(cell: ExcelJS.Cell): { idText: string; hyperlink: string | null } {
  const val = cell.value as unknown
  const cellLevelLink = sanitizeHttpUrl((cell as unknown as { hyperlink?: unknown }).hyperlink)

  if (val && typeof val === 'object' && !(val instanceof Date)) {
    const obj = val as Record<string, unknown>
    if ('hyperlink' in obj) {
      const link = sanitizeHttpUrl(obj.hyperlink) ?? cellLevelLink
      const text = formatRichText(obj.text).trim() || link || ''
      return { idText: text, hyperlink: link }
    }
    if (typeof obj.formula === 'string') {
      const match = HYPERLINK_FORMULA_RE.exec(obj.formula)
      if (match) {
        const link = sanitizeHttpUrl(match[1]) ?? cellLevelLink
        const resultText = formatCellValue(obj.result).trim()
        const label = resultText || (match[2] ?? '').trim() || link || ''
        return { idText: label, hyperlink: link }
      }
      const resultText = formatCellValue(obj.result).trim()
      return {
        idText: resultText,
        hyperlink: cellLevelLink ?? sanitizeHttpUrl(resultText),
      }
    }
    if (Array.isArray(obj.richText)) {
      const text = formatRichText(obj).trim()
      return {
        idText: text,
        hyperlink: cellLevelLink ?? sanitizeHttpUrl(text),
      }
    }
  }

  const plain = formatCellValue(val).trim()
  if (plain) {
    const match = HYPERLINK_FORMULA_RE.exec(plain)
    if (match) {
      const link = sanitizeHttpUrl(match[1]) ?? cellLevelLink
      const label = (match[2] ?? '').trim() || link || ''
      return { idText: label, hyperlink: link }
    }
  }
  return {
    idText: plain,
    hyperlink: cellLevelLink ?? sanitizeHttpUrl(plain),
  }
}

function extractCategoryOptions(workbook: ExcelJS.Workbook): Record<string, readonly string[]> {
  for (const name of CATEGORY_DICT_SHEET_NAMES) {
    const dictWs = workbook.getWorksheet(name)
    if (!dictWs) continue
    const parsed: Record<string, string[]> = {}
    const maxCol = Math.min(Math.max(dictWs.columnCount, 1), 30)
    const headerRow = dictWs.getRow(1)
    for (let c = 1; c <= maxCol; c += 1) {
      const parent = formatCellValue(headerRow.getCell(c).value).trim()
      if (!parent) continue
      const subs: string[] = []
      for (let r = 2; r <= dictWs.rowCount; r += 1) {
        const sub = formatCellValue(dictWs.getRow(r).getCell(c).value).trim()
        if (sub && !subs.includes(sub)) {
          subs.push(sub)
        }
      }
      if (subs.length > 0) {
        parsed[parent] = subs
      }
    }
    if (Object.keys(parsed).length > 0) {
      return parsed
    }
  }
  return DEFAULT_SERVICE_CATEGORIES
}

export function resolveTargetSheet(
  workbook: ExcelJS.Workbook,
  requestedSheetName?: string,
  now: Date = new Date(),
): {
  sheetNames: string[]
  activeSheetName: string | null
  matchedToday: boolean
} {
  const sheetNames = workbook.worksheets
    .map(ws => ws.name)
    .filter(name => !CATEGORY_DICT_SHEET_NAMES.has(name.trim()))
  const candidates = getTodayDateCandidates(now).map(c => c.toLowerCase())

  if (requestedSheetName && requestedSheetName.trim() !== '') {
    const target = requestedSheetName.trim()
    const exact = sheetNames.find(name => name === target)
      ?? sheetNames.find(name => name.trim().toLowerCase() === target.toLowerCase())
    if (exact) {
      return {
        sheetNames,
        activeSheetName: exact,
        matchedToday: candidates.includes(exact.trim().toLowerCase()),
      }
    }
  }

  for (const candidate of candidates) {
    const found = sheetNames.find(name => name.trim().toLowerCase() === candidate)
    if (found) {
      return {
        sheetNames,
        activeSheetName: found,
        matchedToday: true,
      }
    }
  }

  return {
    sheetNames,
    activeSheetName: null,
    matchedToday: false,
  }
}

export async function loadWorkbookData(
  excelPath: string,
  requestedSheetName?: string,
  now: Date = new Date(),
): Promise<DrawerSnapshot> {
  const resolvedPath = resolve(excelPath)
  const todaySheetName = getTodaySheetName(now)

  if (!existsSync(resolvedPath)) {
    return {
      excelPath: resolvedPath,
      exists: false,
      sheets: [],
      activeSheet: null,
      todaySheetName,
      matchedToday: false,
      headers: [],
      rows: [],
      version: null,
      totalDataRows: 0,
      error: `未找到 Excel 文件：${resolvedPath}`,
    }
  }

  try {
    const version = await computeFileVersion(resolvedPath)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(resolvedPath)

    const { sheetNames, activeSheetName, matchedToday } = resolveTargetSheet(
      workbook,
      requestedSheetName,
      now,
    )

    if (!activeSheetName) {
      return {
        excelPath: resolvedPath,
        exists: true,
        sheets: sheetNames,
        activeSheet: null,
        todaySheetName,
        matchedToday: false,
        headers: [],
        rows: [],
        version,
        totalDataRows: 0,
        error: sheetNames.length === 0
          ? 'Excel 工作簿中没有任何工作表'
          : `未找到当日工作表 "${todaySheetName}"，可在右上角设置中选择其他工作表`,
      }
    }

    const ws = workbook.getWorksheet(activeSheetName)
    if (!ws) {
      return {
        excelPath: resolvedPath,
        exists: true,
        sheets: sheetNames,
        activeSheet: null,
        todaySheetName,
        matchedToday: false,
        headers: [],
        rows: [],
        version,
        totalDataRows: 0,
        error: `无法读取工作表 "${activeSheetName}"`,
      }
    }

    const headerRow = ws.getRow(1)
    const probeUpperCol = Math.min(Math.max(ws.columnCount, headerRow.cellCount, 2), MAX_SCAN_COLS)
    let colCount = 0
    for (let c = 1; c <= probeUpperCol; c += 1) {
      if (formatCellValue(headerRow.getCell(c).value).trim() !== '') {
        colCount = c
      }
    }

    const rawRows: Array<{
      rowNumber: number
      idText: string
      hyperlink: string | null
      values: string[]
    }> = []
    let totalDataRows = 0

    for (let r = 2; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r)
      const ticket = parseTicketCell(row.getCell(1))
      const rowUpper = Math.min(Math.max(probeUpperCol, row.cellCount), MAX_SCAN_COLS)
      const values: string[] = []
      let lastNonEmptyCol = ticket.idText !== '' || ticket.hyperlink !== null ? 1 : 0

      for (let c = 2; c <= rowUpper; c += 1) {
        const text = formatCellValue(row.getCell(c).value)
        values.push(text)
        if (text.trim() !== '') {
          lastNonEmptyCol = c
        }
      }

      if (lastNonEmptyCol === 0) continue

      totalDataRows += 1
      if (rawRows.length < MAX_ROWS) {
        if (lastNonEmptyCol > colCount) {
          colCount = lastNonEmptyCol
        }
        rawRows.push({
          rowNumber: r,
          idText: ticket.idText || `行 ${r}`,
          hyperlink: ticket.hyperlink,
          values,
        })
      }
    }

    colCount = Math.max(colCount, 2)

    const headers: string[] = []
    for (let c = 1; c <= colCount; c += 1) {
      const headerText = formatCellValue(headerRow.getCell(c).value).trim()
      headers.push(headerText || (c === 1 ? '事件单号' : `列 ${c}`))
    }

    const rows: IncidentRow[] = rawRows.map(item => {
      const cells: string[] = []
      for (let offset = 0; offset < colCount - 1; offset += 1) {
        cells.push(item.values[offset] ?? '')
      }
      return {
        rowNumber: item.rowNumber,
        idText: item.idText,
        hyperlink: item.hyperlink,
        cells,
      }
    })

    return {
      excelPath: resolvedPath,
      exists: true,
      sheets: sheetNames,
      activeSheet: activeSheetName,
      todaySheetName,
      matchedToday,
      headers,
      rows,
      version,
      totalDataRows,
      categoryOptions: extractCategoryOptions(workbook),
    }
  } catch (error) {
    return {
      excelPath: resolvedPath,
      exists: true,
      sheets: [],
      activeSheet: null,
      todaySheetName,
      matchedToday: false,
      headers: [],
      rows: [],
      version: null,
      totalDataRows: 0,
      error: `读取 Excel 失败：${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

export async function checkWorkbookStatus(
  excelPath: string,
  knownVersion: string | null,
): Promise<StatusCheckResult> {
  const resolvedPath = resolve(excelPath)
  try {
    const currentVersion = await computeFileVersion(resolvedPath)
    if (currentVersion === null) {
      return {
        exists: false,
        stale: knownVersion !== null,
        currentVersion: null,
      }
    }
    const stale = knownVersion !== null && currentVersion !== knownVersion
    return {
      exists: true,
      stale,
      currentVersion,
    }
  } catch (error) {
    return {
      exists: existsSync(resolvedPath),
      stale: false,
      currentVersion: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function saveCellsToWorkbook(params: {
  excelPath: string
  sheetName: string
  edits: readonly CellEdit[]
  expectedVersion: string | null
  forceOverwrite?: boolean
}): Promise<SaveResult> {
  const resolvedPath = resolve(params.excelPath)
  if (!params.sheetName || params.sheetName.trim() === '') {
    return { saved: false, version: null, error: '未指定工作表名称' }
  }
  if (!Array.isArray(params.edits) || params.edits.length === 0) {
    return { saved: true, version: params.expectedVersion }
  }
  for (const edit of params.edits) {
    if (!Number.isInteger(edit.rowNumber) || edit.rowNumber < 2) {
      return { saved: false, version: null, error: `非法行号：${String(edit.rowNumber)}` }
    }
    if (!Number.isInteger(edit.colIndex) || edit.colIndex < 2 || edit.colIndex > MAX_EDITABLE_COL) {
      return {
        saved: false,
        version: null,
        error: edit.colIndex === 1
          ? '第 1 列（事件单号）为只读字段，不允许修改'
          : `非法列号：${String(edit.colIndex)}`,
      }
    }
  }

  return withPathLock(resolvedPath, async () => {
    if (!existsSync(resolvedPath)) {
      return {
        saved: false,
        version: null,
        error: `Excel 文件不存在：${resolvedPath}`,
      }
    }

    const currentVersion = await computeFileVersion(resolvedPath)
    if (
      params.expectedVersion !== null &&
      currentVersion !== null &&
      currentVersion !== params.expectedVersion &&
      !params.forceOverwrite
    ) {
      return {
        saved: false,
        version: currentVersion,
        conflict: true,
        currentVersion,
        error: '检测到硬盘 Excel 已被外部更新，当前数据不是最新，请先刷新获取最新数据',
      }
    }

    try {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(resolvedPath)
      const ws = workbook.getWorksheet(params.sheetName)
      if (!ws) {
        return {
          saved: false,
          version: currentVersion,
          error: `保存失败：工作表 "${params.sheetName}" 已不存在，请刷新`,
        }
      }

      for (const edit of params.edits) {
        const cell = ws.getRow(edit.rowNumber).getCell(edit.colIndex)
        cell.value = edit.value
      }

      await workbook.xlsx.writeFile(resolvedPath)
      const nextVersion = await computeFileVersion(resolvedPath)
      return {
        saved: true,
        version: nextVersion,
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | null)?.code
      if (code && LOCK_ERROR_CODES.has(code)) {
        return {
          saved: false,
          version: currentVersion,
          locked: true,
          error: 'Excel 文件正被其他程序占用（可能正用 Excel 软件打开），请关闭后重试保存',
        }
      }
      return {
        saved: false,
        version: currentVersion,
        error: `保存 Excel 失败：${error instanceof Error ? error.message : String(error)}`,
      }
    }
  })
}

export function applyCategoryDictionary(
  workbook: ExcelJS.Workbook,
  targetSheet: ExcelJS.Worksheet,
  categoryColIndex: number,
  subCategoryColIndex: number,
  maxRow = 30,
): void {
  const existing = workbook.getWorksheet('服务分类字典')
  if (existing) {
    workbook.removeWorksheet(existing.id)
  }

  const dictWs = workbook.addWorksheet('服务分类字典')
  const parents = Object.keys(DEFAULT_SERVICE_CATEGORIES)
  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

  parents.forEach((parent, idx) => {
    const colNum = idx + 1
    const colLetter = colLetters[idx]
    const headCell = dictWs.getRow(1).getCell(colNum)
    headCell.value = parent
    headCell.font = { bold: true }
    dictWs.getColumn(colNum).width = 18

    const subs = DEFAULT_SERVICE_CATEGORIES[parent] ?? []
    subs.forEach((sub, subIdx) => {
      dictWs.getRow(subIdx + 2).getCell(colNum).value = sub
    })

    if (colLetter && subs.length > 0) {
      workbook.definedNames.add(`'服务分类字典'!$${colLetter}$2:$${colLetter}$${subs.length + 1}`, parent)
    }
  })

  const lastParentCol = colLetters[Math.max(0, parents.length - 1)] ?? 'D'
  const parentFormula = `'服务分类字典'!$A$1:$${lastParentCol}$1`
  const catColLetter = colLetters[categoryColIndex - 1] ?? 'D'

  for (let r = 2; r <= maxRow; r += 1) {
    targetSheet.getRow(r).getCell(categoryColIndex).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [parentFormula],
    }
    targetSheet.getRow(r).getCell(subCategoryColIndex).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=INDIRECT(${catColLetter}${r})`],
    }
  }
}

export async function createSampleWorkbook(excelPath: string, now: Date = new Date()): Promise<string> {
  const resolvedPath = resolve(excelPath)
  await mkdir(dirname(resolvedPath), { recursive: true })

  const today = getTodaySheetName(now)
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const yesterday = getTodaySheetName(yesterdayDate)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'win-incident-stage'
  workbook.created = now

  const wsToday = workbook.addWorksheet(today)
  wsToday.columns = [
    { width: 20 },
    { width: 30 },
    { width: 36 },
    { width: 15 },
    { width: 17 },
    { width: 34 },
    { width: 19 },
    { width: 12 },
    { width: 22 },
  ]

  const headerRow = wsToday.addRow([...SAMPLE_HEADERS])
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFF3FA' },
  }

  const sla = (workHours: number) => formatLocalDateTime(addWorkingHours(now, workHours))

  const sampleRows: Array<{
    id: string
    url: string | null
    formulaLink?: boolean
    cols: [string, string, string, string, string, string, string, string]
  }> = [
    {
      id: `INC-${today}-01`,
      url: `https://itsm.company.internal/tickets/INC-${today}-01`,
      cols: ['[CI]核心网关连接池超时告警', '业务请求间歇性 504，连接池等待队列打满', '基础架构', '网络与网关', '正在灰度回滚索引变更并临时扩容连接池', sla(1.8), '张伟', '核心网络保障群'],
    },
    {
      id: `INC-${today}-02`,
      url: `https://itsm.company.internal/tickets/INC-${today}-02`,
      formulaLink: true,
      cols: ['内网 SSO 单点登录回调 502', '部分部门登录跳转认证中心返回 502', '应用系统', '单点登录与认证', '等待认证中心提供网关日志与证书链核验', sla(3.2), '李敏', '统一认证支持群'],
    },
    {
      id: `INC-${today}-03`,
      url: `https://itsm.company.internal/tickets/INC-${today}-03`,
      cols: ['报表导出服务内存持续上涨', '大批量导出触发 OldGen 频繁 FullGC', '应用系统', '财务与报表', '已采集堆转储，排查 Excel 流式释放', sla(5.5), '王强', '财务系统运维群'],
    },
    {
      id: `INC-${today}-04`,
      url: `https://itsm.company.internal/tickets/INC-${today}-04`,
      cols: ['消息队列积压消费延迟 > 5 分钟', '风控回调超时导致消费者线程阻塞', '中间件与数据', '消息队列', '核查下游风控接口超时配置并扩消费者', sla(6.8), '赵雪', '中间件SRE群'],
    },
    {
      id: `INC-${today}-05`,
      url: `https://itsm.company.internal/tickets/INC-${today}-05`,
      cols: ['测试环境 K8s Ingress 证书即将到期', '域名证书将在 3 个工作日内过期', '基础架构', '容器与证书', '已申请自动续签，待验证生效状态', sla(11.0), '陈晨', '云原生平台群'],
    },
    {
      id: `INC-${today}-06`,
      url: `https://itsm.company.internal/tickets/INC-${today}-06`,
      cols: ['财务对账定时任务昨日重试成功', '夜间批次短暂超时后自动重试完成', '发布与运维', '定时任务调度', '补跑任务完成，继续观察今晚批次', sla(14.5), '张伟', '财务系统运维群'],
    },
    {
      id: `INC-${today}-07`,
      url: null,
      cols: ['内部知识库全文检索偶发分词偏差', '专有名词检索命中率偏低（无外链）', '中间件与数据', '缓存与检索', '准备补充自定义分词词典灰度验证', sla(18.0), '李敏', '知识库研发群'],
    },
    {
      id: `INC-${today}-08`,
      url: `https://itsm.company.internal/tickets/INC-${today}-08`,
      cols: ['OA 审批附件预览偶现水印错位', '高分屏浏览器下 PDF 渲染比例偏移', '应用系统', 'OA与审批流', '前端已复现，正在调整 PDF Canvas DPI 缩放', sla(7.4), '王强', '办公平台支持群'],
    },
    {
      id: `INC-${today}-09`,
      url: `https://itsm.company.internal/tickets/INC-${today}-09`,
      cols: ['内网 GitLab Runner 磁盘剩余低于 15%', '构建机镜像缓存持续增长触发预警', '发布与运维', 'CI/CD流水线', '计划今晚清理过期构建缓存镜像', sla(2.6), '赵雪', '效能平台运维群'],
    },
    {
      id: `INC-${today}-10`,
      url: `https://itsm.company.internal/tickets/INC-${today}-10`,
      cols: ['CDN 静态资源回源耗时波动', '华东边缘节点回源偶发抖动', '发布与运维', 'CDN与静态资源', '已切换备用回源节点，指标恢复平稳', sla(12.0), '陈晨', '核心网络保障群'],
    },
    {
      id: `INC-${today}-11`,
      url: `https://itsm.company.internal/tickets/INC-${today}-11`,
      cols: ['第 11 条单据（验证面板只加载前 10 条且写回不丢此行）', '本行仅用于保留校验', '基础架构', '服务器与磁盘', '保留校验', sla(20.0), '备选池', '备选支持群'],
    },
    {
      id: `INC-${today}-12`,
      url: `https://itsm.company.internal/tickets/INC-${today}-12`,
      cols: ['第 12 条单据（验证无损回写）', '保留原始数据与格式', '中间件与数据', '数据库与SQL', '保留校验', sla(24.0), '备选池', '备选支持群'],
    },
  ]

  for (const item of sampleRows) {
    const row = wsToday.addRow([item.id, ...item.cols])
    const cell = row.getCell(1)
    if (item.url && item.formulaLink) {
      cell.value = {
        formula: `HYPERLINK("${item.url}", "${item.id}")`,
        result: item.id,
      }
      cell.font = { color: { argb: 'FF2563EB' }, underline: true }
    } else if (item.url) {
      cell.value = {
        text: item.id,
        hyperlink: item.url,
      }
      cell.font = { color: { argb: 'FF2563EB' }, underline: true }
    }
  }

  applyCategoryDictionary(workbook, wsToday, 4, 5, 30)

  const wsPrev = workbook.addWorksheet(yesterday)
  wsPrev.addRow([...SAMPLE_HEADERS])
  wsPrev.addRow([`INC-${yesterday}-01`, '昨日历史遗留单据 1', '历史记录归档', '应用系统', 'OA与审批流', '已归档', sla(10.0), '张伟', '办公平台支持群'])
  wsPrev.addRow([`INC-${yesterday}-02`, '昨日历史遗留单据 2', '历史记录归档', '基础架构', '网络与网关', '已归档', sla(12.0), '李敏', '核心网络保障群'])

  await workbook.xlsx.writeFile(resolvedPath)
  return resolvedPath
}
