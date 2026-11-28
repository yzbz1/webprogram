import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import ExcelJS from 'exceljs'
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
export const SAMPLE_HEADERS: readonly [string, string, string, string, string, string] = [
  '事件单号',
  '标题',
  '紧急程度',
  '处理状态',
  '负责人',
  '处理进展',
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

export function resolveTargetSheet(
  workbook: ExcelJS.Workbook,
  requestedSheetName?: string,
  now: Date = new Date(),
): {
  sheetNames: string[]
  activeSheetName: string | null
  matchedToday: boolean
} {
  const sheetNames = workbook.worksheets.map(ws => ws.name)
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
    { width: 22 },
    { width: 32 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 40 },
  ]

  const headerRow = wsToday.addRow([...SAMPLE_HEADERS])
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFF3FA' },
  }

  const sampleRows: Array<{
    id: string
    url: string | null
    formulaLink?: boolean
    cols: [string, string, string, string, string]
  }> = [
    {
      id: `INC-${today}-01`,
      url: `https://itsm.company.internal/tickets/INC-${today}-01`,
      cols: ['核心网关连接池超时告警', 'P1 紧急', '处理中', '张伟', '已定位慢查询 SQL，正在灰度回滚索引变更并临时扩容连接池'],
    },
    {
      id: `INC-${today}-02`,
      url: `https://itsm.company.internal/tickets/INC-${today}-02`,
      formulaLink: true,
      cols: ['内网 SSO 单点登录回调 502', 'P1 紧急', '待处理', '李敏', '等待认证中心提供网关日志与证书链核验结果'],
    },
    {
      id: `INC-${today}-03`,
      url: `https://itsm.company.internal/tickets/INC-${today}-03`,
      cols: ['报表导出服务内存持续上涨', 'P2 高', '处理中', '王强', '已采集堆转储文件，初步怀疑 Excel 流式导出未及时释放'],
    },
    {
      id: `INC-${today}-04`,
      url: `https://itsm.company.internal/tickets/INC-${today}-04`,
      cols: ['消息队列积压消费延迟 > 5 分钟', 'P2 高', '待处理', '赵雪', '需核查下游风控接口超时配置'],
    },
    {
      id: `INC-${today}-05`,
      url: `https://itsm.company.internal/tickets/INC-${today}-05`,
      cols: ['测试环境 K8s Ingress 证书即将到期', 'P3 中', '待确认', '陈晨', '已申请自动续签，待验证生效状态'],
    },
    {
      id: `INC-${today}-06`,
      url: `https://itsm.company.internal/tickets/INC-${today}-06`,
      cols: ['财务对账定时任务昨日重试成功', 'P3 中', '观察中', '张伟', '补跑任务完成，观察今晚零点批次'],
    },
    {
      id: `INC-${today}-07`,
      url: null,
      cols: ['内部知识库全文检索偶发分词偏差', 'P4 低', '待处理', '李敏', '未附带外部工单链接，仅内部分析记录'],
    },
    {
      id: `INC-${today}-08`,
      url: `https://itsm.company.internal/tickets/INC-${today}-08`,
      cols: ['OA 审批附件预览偶现水印错位', 'P3 中', '处理中', '王强', '前端已复现，正在调整 PDF Canvas DPI 缩放'],
    },
    {
      id: `INC-${today}-09`,
      url: `https://itsm.company.internal/tickets/INC-${today}-09`,
      cols: ['内网 GitLab Runner 磁盘剩余低于 15%', 'P2 高', '待处理', '赵雪', '计划今晚清理过期构建缓存镜像'],
    },
    {
      id: `INC-${today}-10`,
      url: `https://itsm.company.internal/tickets/INC-${today}-10`,
      cols: ['CDN 静态资源回源耗时波动', 'P3 中', '观察中', '陈晨', '已切换备用回源节点，指标恢复平稳'],
    },
    {
      id: `INC-${today}-11`,
      url: `https://itsm.company.internal/tickets/INC-${today}-11`,
      cols: ['第 11 条单据（验证面板只加载前 10 条且写回不丢此行）', 'P4 低', '待处理', '备选池', '本行仅用于保留校验'],
    },
    {
      id: `INC-${today}-12`,
      url: `https://itsm.company.internal/tickets/INC-${today}-12`,
      cols: ['第 12 条单据（验证无损回写）', 'P4 低', '待处理', '备选池', '保留原始数据与格式'],
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

  const wsPrev = workbook.addWorksheet(yesterday)
  wsPrev.addRow([...SAMPLE_HEADERS])
  wsPrev.addRow([`INC-${yesterday}-01`, '昨日历史遗留单据 1', 'P2 高', '已完成', '张伟', '已归档'])
  wsPrev.addRow([`INC-${yesterday}-02`, '昨日历史遗留单据 2', 'P3 中', '已完成', '李敏', '已归档'])

  await workbook.xlsx.writeFile(resolvedPath)
  return resolvedPath
}
