import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  BridgeApiResponse,
  CellEdit,
  DrawerSnapshot,
  IncidentRow,
  SaveResult,
  StatusCheckResult,
} from '../shared/types.ts'
import {
  DEFAULT_SERVICE_CATEGORIES,
  evaluateSla,
  isServiceCategoryHeader,
  isServiceSubCategoryHeader,
  isSlaHeader,
} from '../shared/sla.ts'
import {
  ChevronDownIcon,
  CollapseRightIcon,
  ExternalLinkIcon,
  PeekLeftIcon,
  RefreshIcon,
  SettingsIcon,
  WarnIcon,
} from './icons.tsx'

export class BridgeOfflineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BridgeOfflineError'
  }
}

export async function callExtensionApi<T>(endpoint: string, payload: unknown): Promise<T> {
  const res = (await chrome.runtime.sendMessage({
    type: 'INCIDENT_API',
    endpoint,
    payload,
  })) as BridgeApiResponse<T> | undefined

  if (!res) {
    throw new BridgeOfflineError('扩展后台服务暂未响应，请重试')
  }
  if (!res.ok) {
    if (res.offline) {
      throw new BridgeOfflineError(res.error)
    }
    throw new Error(res.error)
  }
  return res.value
}

export interface IncidentDrawerProps {
  theme: 'light' | 'dark'
  apiCall?: <T>(endpoint: string, payload: unknown) => Promise<T>
}

const WIDTH_STORAGE_KEY = 'dsh.incident-drawer.width'
const HIDDEN_STORAGE_KEY = 'dsh.incident-drawer.hidden'
const DEFAULT_EXPANDED_WIDTH = 328
const MIN_EXPANDED_WIDTH = 280
const MAX_EXPANDED_WIDTH = 540
const POLL_INTERVAL_MS = 4000
const HOVER_IN_DELAY_MS = 110
const HOVER_OUT_DELAY_MS = 160
const MAX_TEXTAREA_HEIGHT = 280

type FieldSaveState = 'saving' | 'saved' | 'error'

function readFallbackWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY)
    const parsed = raw ? Number(raw) : NaN
    if (Number.isFinite(parsed) && parsed >= MIN_EXPANDED_WIDTH && parsed <= MAX_EXPANDED_WIDTH) {
      return parsed
    }
  } catch {
    // Ignore
  }
  return DEFAULT_EXPANDED_WIDTH
}

function readFallbackHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function cellKey(rowNumber: number, colIndex: number): string {
  return `${rowNumber}:${colIndex}`
}

function shortenTicketId(idText: string): string {
  const trimmed = idText.trim()
  if (trimmed.length <= 7) return trimmed
  const tailMatch = /(?:^|[-_#])([A-Za-z]?\d{1,4})$/.exec(trimmed)
  if (tailMatch) return `#${tailMatch[1]}`
  return trimmed.slice(-6)
}

function getStatusTone(row: IncidentRow): 'ok' | 'err' | 'warn' | 'accent' {
  const text = row.cells.join(' ')
  if (/已完成|已关闭|已解决|done|closed|resolved/i.test(text)) return 'ok'
  if (/p0|p1|紧急|严重|critical|urgent|blocker/i.test(text)) return 'err'
  if (/p2|高|待处理|待确认|high|pending/i.test(text)) return 'warn'
  return 'accent'
}

function collectDirtyEdits(
  snapshot: DrawerSnapshot | null,
  drafts: Record<string, string>,
): CellEdit[] {
  if (!snapshot) return []
  const edits: CellEdit[] = []
  for (const row of snapshot.rows) {
    for (let colOffset = 0; colOffset < row.cells.length; colOffset += 1) {
      const colIndex = colOffset + 2
      const key = cellKey(row.rowNumber, colIndex)
      if (Object.hasOwn(drafts, key) && drafts[key] !== row.cells[colOffset]) {
        edits.push({ rowNumber: row.rowNumber, colIndex, value: drafts[key] })
      }
    }
  }
  return edits
}

function syncTextareaHeight(el: HTMLTextAreaElement): void {
  el.style.height = '0px'
  const rawHeight = el.scrollHeight
  const nextHeight = Math.min(Math.max(rawHeight, 28), MAX_TEXTAREA_HEIGHT)
  el.style.height = `${nextHeight}px`
  el.style.overflowY = rawHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
}

function AutoTextarea({
  value,
  flash,
  placeholder,
  ariaLabel,
  onChange,
  onBlur,
  onKeyDown,
}: {
  value: string
  flash?: 'saved' | 'error'
  placeholder?: string
  ariaLabel: string
  onChange: (next: string) => void
  onBlur: (currentValue: string) => void
  onKeyDown: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    if (ref.current) syncTextareaHeight(ref.current)
  }, [value])

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      syncTextareaHeight(el)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [])

  return (
    <textarea
      ref={ref}
      rows={1}
      className="idw-textarea"
      aria-label={ariaLabel}
      data-flash={flash}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onBlur(e.currentTarget.value)}
      onKeyDown={onKeyDown}
    />
  )
}

export function IncidentDrawer({ theme, apiCall = callExtensionApi }: IncidentDrawerProps) {
  const [snapshot, setSnapshot] = useState<DrawerSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [bridgeOffline, setBridgeOffline] = useState(false)
  const [hidden, setHidden] = useState(readFallbackHidden)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pathInput, setPathInput] = useState('')
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [expandedWidth, setExpandedWidth] = useState(readFallbackWidth)
  const [resizing, setResizing] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldSaveState>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [stale, setStale] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [confirmRefresh, setConfirmRefresh] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [globalSavedPulse, setGlobalSavedPulse] = useState(false)

  const snapshotRef = useRef<DrawerSnapshot | null>(null)
  const draftsRef = useRef<Record<string, string>>({})
  const versionRef = useRef<string | null>(null)
  const conflictRef = useRef(false)
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const hoverInTimerRef = useRef<number | null>(null)
  const hoverOutTimerRef = useRef<number | null>(null)
  const flashTimersRef = useRef<Map<string, number>>(new Map())
  const savedPulseTimerRef = useRef<number | null>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  snapshotRef.current = snapshot
  draftsRef.current = drafts
  conflictRef.current = conflict

  const dirtyEdits = useMemo(() => collectDirtyEdits(snapshot, drafts), [snapshot, drafts])
  const hasDirty = dirtyEdits.length > 0
  const hasSaving = Object.values(fieldStatus).some(s => s === 'saving')
  const hasFieldError = Object.values(fieldStatus).some(s => s === 'error')
  const categoryOptions = snapshot?.categoryOptions ?? DEFAULT_SERVICE_CATEGORIES
  const slaColOffset = useMemo(() => {
    const idx = (snapshot?.headers ?? []).findIndex((h, i) => i > 0 && isSlaHeader(h))
    return idx > 0 ? idx - 1 : -1
  }, [snapshot?.headers])
  const categoryColOffset = useMemo(() => {
    const idx = (snapshot?.headers ?? []).findIndex((h, i) => i > 0 && isServiceCategoryHeader(h))
    return idx > 0 ? idx - 1 : -1
  }, [snapshot?.headers])
  const subCategoryColOffset = useMemo(() => {
    const idx = (snapshot?.headers ?? []).findIndex((h, i) => i > 0 && isServiceSubCategoryHeader(h))
    return idx > 0 ? idx - 1 : -1
  }, [snapshot?.headers])
  const nowDate = useMemo(() => new Date(nowTick), [nowTick])

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const getCellDisplayValue = useCallback((row: IncidentRow, colOffset: number): string => {
    if (colOffset < 0 || colOffset >= row.cells.length) return ''
    const k = cellKey(row.rowNumber, colOffset + 2)
    return Object.hasOwn(drafts, k) ? drafts[k] : (row.cells[colOffset] ?? '')
  }, [drafts])

  const getRowSla = useCallback((row: IncidentRow) => {
    if (slaColOffset < 0) return null
    return evaluateSla(getCellDisplayValue(row, slaColOffset), nowDate)
  }, [getCellDisplayValue, nowDate, slaColOffset])

  // Load shared width/hidden state from chrome.storage.local
  useEffect(() => {
    try {
      void chrome.storage.local.get(['drawerWidth', 'drawerHidden']).then((res) => {
        if (typeof res.drawerWidth === 'number' && res.drawerWidth >= MIN_EXPANDED_WIDTH && res.drawerWidth <= MAX_EXPANDED_WIDTH) {
          setExpandedWidth(res.drawerWidth)
        }
        if (typeof res.drawerHidden === 'boolean') {
          setHidden(res.drawerHidden)
        }
      }).catch(() => undefined)
    } catch {
      // Ignore outside extension env
    }
  }, [])

  const clearHoverTimers = useCallback(() => {
    if (hoverInTimerRef.current !== null) {
      window.clearTimeout(hoverInTimerRef.current)
      hoverInTimerRef.current = null
    }
    if (hoverOutTimerRef.current !== null) {
      window.clearTimeout(hoverOutTimerRef.current)
      hoverOutTimerRef.current = null
    }
  }, [])

  useEffect(() => () => {
    clearHoverTimers()
    for (const timer of flashTimersRef.current.values()) {
      window.clearTimeout(timer)
    }
    if (savedPulseTimerRef.current !== null) {
      window.clearTimeout(savedPulseTimerRef.current)
    }
  }, [clearHoverTimers])

  const triggerGlobalSavedPulse = useCallback(() => {
    setGlobalSavedPulse(true)
    if (savedPulseTimerRef.current !== null) {
      window.clearTimeout(savedPulseTimerRef.current)
    }
    savedPulseTimerRef.current = window.setTimeout(() => {
      setGlobalSavedPulse(false)
      savedPulseTimerRef.current = null
    }, 2600)
  }, [])

  const markFieldSaved = useCallback((key: string) => {
    const prevTimer = flashTimersRef.current.get(key)
    if (prevTimer !== undefined) window.clearTimeout(prevTimer)
    setFieldStatus(prev => ({ ...prev, [key]: 'saved' }))
    const timer = window.setTimeout(() => {
      flashTimersRef.current.delete(key)
      setFieldStatus(prev => {
        if (prev[key] !== 'saved') return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, 900)
    flashTimersRef.current.set(key, timer)
  }, [])

  const applySnapshot = useCallback((next: DrawerSnapshot) => {
    snapshotRef.current = next
    versionRef.current = next.version
    setSnapshot(next)
    setPathInput(next.excelPath)
    setDrafts({})
    setFieldStatus({})
    setFieldErrors({})
    setStale(false)
    setConflict(false)
    setConfirmRefresh(false)
    setBannerError(null)
    setBridgeOffline(false)
    setExpandedRow(prev => (prev !== null && next.rows.some(r => r.rowNumber === prev) ? prev : null))
  }, [])

  const loadData = useCallback(async (sheetName?: string) => {
    setLoading(true)
    setBannerError(null)
    try {
      const next = await apiCall<DrawerSnapshot>('load', sheetName ? { sheetName } : {})
      applySnapshot(next)
    } catch (err) {
      if (err instanceof BridgeOfflineError) {
        setBridgeOffline(true)
      } else {
        setBannerError(err instanceof Error ? err.message : '加载事件单失败')
      }
    } finally {
      setLoading(false)
    }
  }, [apiCall, applySnapshot])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const checkStatus = useCallback(async () => {
    if (loading) return
    if (bridgeOffline || !snapshotRef.current) {
      try {
        const next = await apiCall<DrawerSnapshot>('load', {})
        applySnapshot(next)
      } catch {
        // Still offline
      }
      return
    }
    if (!snapshotRef.current.exists) return
    try {
      const res = await apiCall<StatusCheckResult>('check-status', {
        knownVersion: versionRef.current,
      })
      setBridgeOffline(false)
      if (res.stale) {
        setStale(true)
        if (collectDirtyEdits(snapshotRef.current, draftsRef.current).length > 0) {
          setConflict(true)
        }
      }
    } catch (err) {
      if (err instanceof BridgeOfflineError) {
        setBridgeOffline(true)
      }
    }
  }, [apiCall, applySnapshot, bridgeOffline, loading])

  useEffect(() => {
    if (hidden) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkStatus()
      }
    }, POLL_INTERVAL_MS)
    const onFocus = () => {
      void checkStatus()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [checkStatus, hidden])

  const enqueueSave = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = saveQueueRef.current.catch(() => undefined).then(task)
    saveQueueRef.current = next
    return next
  }, [])

  const saveCell = useCallback((
    rowNumber: number,
    colIndex: number,
    value: string,
    forceOverwrite = false,
  ): Promise<boolean> => {
    return enqueueSave(async () => {
      const snap = snapshotRef.current
      if (!snap || !snap.activeSheet) return false
      const targetRow = snap.rows.find(r => r.rowNumber === rowNumber)
      if (!targetRow) return false

      const committed = targetRow.cells[colIndex - 2]
      const key = cellKey(rowNumber, colIndex)
      if (value === committed && fieldStatus[key] !== 'error') {
        setDrafts(prev => {
          if (!Object.hasOwn(prev, key)) return prev
          const copy = { ...prev }
          delete copy[key]
          return copy
        })
        return true
      }

      if (conflictRef.current && !forceOverwrite) {
        setFieldStatus(prev => ({ ...prev, [key]: 'error' }))
        setFieldErrors(prev => ({ ...prev, [key]: 'Excel 已更新，请先刷新或选择覆盖' }))
        return false
      }

      setFieldStatus(prev => ({ ...prev, [key]: 'saving' }))
      setFieldErrors(prev => {
        if (!Object.hasOwn(prev, key)) return prev
        const copy = { ...prev }
        delete copy[key]
        return copy
      })

      try {
        const res = await apiCall<SaveResult>('save-cell', {
          sheetName: snap.activeSheet,
          rowNumber,
          colIndex,
          value,
          expectedVersion: versionRef.current,
          forceOverwrite,
        })
        setBridgeOffline(false)

        if (res.saved) {
          versionRef.current = res.version
          setSnapshot(prev => {
            if (!prev) return prev
            const updatedRows = prev.rows.map(row => {
              if (row.rowNumber !== rowNumber) return row
              const nextCells = [...row.cells]
              nextCells[colIndex - 2] = value
              return { ...row, cells: nextCells }
            })
            return { ...prev, rows: updatedRows, version: res.version }
          })
          setDrafts(prev => {
            if (prev[key] !== value) return prev
            const copy = { ...prev }
            delete copy[key]
            return copy
          })
          setStale(false)
          setConflict(false)
          setBannerError(null)
          markFieldSaved(key)
          triggerGlobalSavedPulse()
          return true
        }

        if (res.conflict) {
          setStale(true)
          setConflict(true)
          setFieldStatus(prev => ({ ...prev, [key]: 'error' }))
          setFieldErrors(prev => ({ ...prev, [key]: '硬盘 Excel 已更新，自动保存已暂停' }))
          return false
        }

        setFieldStatus(prev => ({ ...prev, [key]: 'error' }))
        setFieldErrors(prev => ({ ...prev, [key]: res.error ?? '保存失败' }))
        return false
      } catch (err) {
        if (err instanceof BridgeOfflineError) {
          setBridgeOffline(true)
        }
        setFieldStatus(prev => ({ ...prev, [key]: 'error' }))
        setFieldErrors(prev => ({ ...prev, [key]: err instanceof Error ? err.message : '保存失败' }))
        return false
      }
    })
  }, [apiCall, enqueueSave, fieldStatus, markFieldSaved, triggerGlobalSavedPulse])

  const saveAllDirty = useCallback((forceOverwrite = false): Promise<boolean> => {
    return enqueueSave(async () => {
      const snap = snapshotRef.current
      if (!snap || !snap.activeSheet) return false
      const edits = collectDirtyEdits(snap, draftsRef.current)
      if (edits.length === 0) {
        setBannerError(null)
        return true
      }

      if (conflictRef.current && !forceOverwrite) {
        return false
      }

      setFieldStatus(prev => {
        const next = { ...prev }
        for (const edit of edits) next[cellKey(edit.rowNumber, edit.colIndex)] = 'saving'
        return next
      })

      try {
        const res = await apiCall<SaveResult>('save-batch', {
          sheetName: snap.activeSheet,
          edits,
          expectedVersion: versionRef.current,
          forceOverwrite,
        })
        setBridgeOffline(false)

        if (res.saved) {
          versionRef.current = res.version
          const editMap = new Map(edits.map(e => [cellKey(e.rowNumber, e.colIndex), e.value]))
          setSnapshot(prev => {
            if (!prev) return prev
            const updatedRows = prev.rows.map(row => {
              const nextCells = [...row.cells]
              let touched = false
              for (let colOffset = 0; colOffset < row.cells.length; colOffset += 1) {
                const k = cellKey(row.rowNumber, colOffset + 2)
                const v = editMap.get(k)
                if (v !== undefined) {
                  nextCells[colOffset] = v
                  touched = true
                }
              }
              return touched ? { ...row, cells: nextCells } : row
            })
            return { ...prev, rows: updatedRows, version: res.version }
          })
          setDrafts(prev => {
            const copy = { ...prev }
            for (const edit of edits) {
              const k = cellKey(edit.rowNumber, edit.colIndex)
              if (copy[k] === edit.value) delete copy[k]
            }
            return copy
          })
          setFieldErrors(prev => {
            const copy = { ...prev }
            for (const edit of edits) delete copy[cellKey(edit.rowNumber, edit.colIndex)]
            return copy
          })
          for (const edit of edits) {
            markFieldSaved(cellKey(edit.rowNumber, edit.colIndex))
          }
          setStale(false)
          setConflict(false)
          setBannerError(null)
          triggerGlobalSavedPulse()
          return true
        }

        if (res.conflict) {
          setStale(true)
          setConflict(true)
          setFieldStatus(prev => {
            const next = { ...prev }
            for (const edit of edits) next[cellKey(edit.rowNumber, edit.colIndex)] = 'error'
            return next
          })
          return false
        }

        setFieldStatus(prev => {
          const next = { ...prev }
          for (const edit of edits) next[cellKey(edit.rowNumber, edit.colIndex)] = 'error'
          return next
        })
        setBannerError(res.error ?? '保存失败')
        return false
      } catch (err) {
        if (err instanceof BridgeOfflineError) {
          setBridgeOffline(true)
        }
        setBannerError(err instanceof Error ? err.message : '保存失败')
        return false
      }
    })
  }, [apiCall, enqueueSave, markFieldSaved, triggerGlobalSavedPulse])

  const saveEditsBatch = useCallback((edits: readonly CellEdit[]): Promise<boolean> => {
    if (edits.length === 0) return Promise.resolve(true)
    if (edits.length === 1) {
      return saveCell(edits[0].rowNumber, edits[0].colIndex, edits[0].value, false)
    }
    return enqueueSave(async () => {
      const snap = snapshotRef.current
      if (!snap || !snap.activeSheet) return false
      if (conflictRef.current) return false

      setFieldStatus(prev => {
        const next = { ...prev }
        for (const edit of edits) next[cellKey(edit.rowNumber, edit.colIndex)] = 'saving'
        return next
      })
      try {
        const res = await apiCall<SaveResult>('save-batch', {
          sheetName: snap.activeSheet,
          edits,
          expectedVersion: versionRef.current,
          forceOverwrite: false,
        })
        if (res.saved) {
          versionRef.current = res.version
          const editMap = new Map(edits.map(e => [cellKey(e.rowNumber, e.colIndex), e.value]))
          setSnapshot(prev => {
            if (!prev) return prev
            const updatedRows = prev.rows.map(r => {
              const nextCells = [...r.cells]
              let touched = false
              for (let c = 0; c < r.cells.length; c += 1) {
                const v = editMap.get(cellKey(r.rowNumber, c + 2))
                if (v !== undefined) {
                  nextCells[c] = v
                  touched = true
                }
              }
              return touched ? { ...r, cells: nextCells } : r
            })
            return { ...prev, rows: updatedRows, version: res.version }
          })
          setDrafts(prev => {
            const copy = { ...prev }
            for (const edit of edits) {
              const k = cellKey(edit.rowNumber, edit.colIndex)
              if (copy[k] === edit.value) delete copy[k]
            }
            return copy
          })
          for (const edit of edits) markFieldSaved(cellKey(edit.rowNumber, edit.colIndex))
          setStale(false)
          setConflict(false)
          setBannerError(null)
          triggerGlobalSavedPulse()
          return true
        }
        if (res.conflict) {
          setStale(true)
          setConflict(true)
        }
        setFieldStatus(prev => {
          const next = { ...prev }
          for (const edit of edits) next[cellKey(edit.rowNumber, edit.colIndex)] = 'error'
          return next
        })
        return false
      } catch (err) {
        if (err instanceof BridgeOfflineError) {
          setBridgeOffline(true)
        }
        setBannerError(err instanceof Error ? err.message : '保存失败')
        return false
      }
    })
  }, [apiCall, enqueueSave, markFieldSaved, saveCell, triggerGlobalSavedPulse])

  const handleRefreshClick = useCallback(() => {
    if (hasDirty && !stale) {
      setConfirmRefresh(true)
      return
    }
    void loadData(snapshotRef.current?.activeSheet ?? undefined)
  }, [hasDirty, loadData, stale])

  const handleToggleHidden = useCallback((nextHidden: boolean) => {
    setHidden(nextHidden)
    setSettingsOpen(false)
    try {
      localStorage.setItem(HIDDEN_STORAGE_KEY, nextHidden ? '1' : '0')
    } catch {
      // Ignore
    }
    try {
      void chrome.storage.local.set({ drawerHidden: nextHidden })
    } catch {
      // Ignore
    }
  }, [])

  const handleRowMouseEnter = useCallback((rowNumber: number) => {
    if (expandedRow === rowNumber) return
    clearHoverTimers()
    if (hoveredRow !== null) {
      setHoveredRow(rowNumber)
      return
    }
    hoverInTimerRef.current = window.setTimeout(() => {
      hoverInTimerRef.current = null
      setHoveredRow(rowNumber)
    }, HOVER_IN_DELAY_MS)
  }, [clearHoverTimers, expandedRow, hoveredRow])

  const handleRowMouseLeave = useCallback((rowNumber: number) => {
    clearHoverTimers()
    hoverOutTimerRef.current = window.setTimeout(() => {
      hoverOutTimerRef.current = null
      setHoveredRow(prev => (prev === rowNumber ? null : prev))
    }, HOVER_OUT_DELAY_MS)
  }, [clearHoverTimers])

  const handleToggleExpand = useCallback((rowNumber: number) => {
    if (window.getSelection()?.toString()) return
    clearHoverTimers()
    setHoveredRow(null)
    if (expandedRow === rowNumber) {
      setExpandedRow(null)
      return
    }
    if (document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur()
    }
    setExpandedRow(rowNumber)
    window.setTimeout(() => {
      cardRefs.current.get(rowNumber)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 250)
  }, [clearHoverTimers, expandedRow])

  const handleOpenHyperlink = useCallback((e: ReactMouseEvent, url: string | null) => {
    e.stopPropagation()
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const handleStartResize = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = expandedWidth
    setResizing(true)

    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX
      const maxAllowed = Math.min(MAX_EXPANDED_WIDTH, Math.max(MIN_EXPANDED_WIDTH, window.innerWidth - 80))
      const clamped = Math.round(Math.min(maxAllowed, Math.max(MIN_EXPANDED_WIDTH, startWidth + delta)))
      setExpandedWidth(clamped)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setResizing(false)
      setExpandedWidth(current => {
        try {
          localStorage.setItem(WIDTH_STORAGE_KEY, String(current))
        } catch {
          // Ignore
        }
        try {
          void chrome.storage.local.set({ drawerWidth: current })
        } catch {
          // Ignore
        }
        return current
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [expandedWidth])

  const handleApplyPath = useCallback(async () => {
    const trimmed = pathInput.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      const next = await apiCall<DrawerSnapshot>('set-config', { excelPath: trimmed })
      applySnapshot(next)
      setSettingsOpen(false)
    } catch (err) {
      if (err instanceof BridgeOfflineError) setBridgeOffline(true)
      setBannerError(err instanceof Error ? err.message : '更新路径失败')
    } finally {
      setLoading(false)
    }
  }, [apiCall, applySnapshot, pathInput])

  const handleSwitchSheet = useCallback(async (nextSheet: string) => {
    if (!nextSheet) return
    if (hasDirty && !conflict) {
      const ok = await saveAllDirty(false)
      if (!ok) return
    }
    setLoading(true)
    try {
      const next = await apiCall<DrawerSnapshot>('set-config', {
        excelPath: snapshotRef.current?.excelPath ?? pathInput.trim(),
        preferredSheet: nextSheet,
      })
      applySnapshot(next)
    } catch (err) {
      if (err instanceof BridgeOfflineError) setBridgeOffline(true)
      setBannerError(err instanceof Error ? err.message : '切换工作表失败')
    } finally {
      setLoading(false)
    }
  }, [apiCall, applySnapshot, conflict, hasDirty, pathInput, saveAllDirty])

  const handleCreateSample = useCallback(async () => {
    setLoading(true)
    try {
      const next = await apiCall<DrawerSnapshot>('create-sample', {
        excelPath: pathInput.trim() || undefined,
      })
      applySnapshot(next)
      setSettingsOpen(false)
    } catch (err) {
      if (err instanceof BridgeOfflineError) setBridgeOffline(true)
      setBannerError(err instanceof Error ? err.message : '生成示例 Excel 失败')
    } finally {
      setLoading(false)
    }
  }, [apiCall, applySnapshot, pathInput])

  if (hidden) {
    const alertDotColor = hasFieldError || conflict || bridgeOffline
      ? 'var(--idw-err-fg)'
      : stale
        ? 'var(--idw-warn-border)'
        : hasDirty
          ? 'var(--idw-accent)'
          : null

    return (
      <div className="idw-root" data-theme={theme} style={{ pointerEvents: 'none' }}>
        <button
          type="button"
          className="idw-peek"
          title="展开右侧事件单面板"
          onClick={() => handleToggleHidden(false)}
        >
          {alertDotColor && <span className="idw-peek-dot" style={{ background: alertDotColor }} />}
          <PeekLeftIcon />
        </button>
      </div>
    )
  }

  let statusBtnState: 'idle' | 'dirty' | 'error' | 'saved' = 'idle'
  let statusDotTone: 'ok' | 'busy' | 'warn' | 'err' | 'accent' = 'ok'
  let statusLabel = '已保存'

  if (loading) {
    statusDotTone = 'busy'
    statusLabel = '连接中'
  } else if (bridgeOffline) {
    statusBtnState = 'error'
    statusDotTone = 'err'
    statusLabel = '服务未启动'
  } else if (hasSaving) {
    statusDotTone = 'busy'
    statusLabel = '保存中'
  } else if (conflict) {
    statusBtnState = 'error'
    statusDotTone = 'warn'
    statusLabel = '有冲突'
  } else if (hasFieldError || bannerError) {
    statusBtnState = 'error'
    statusDotTone = 'err'
    statusLabel = '重试保存'
  } else if (hasDirty) {
    statusBtnState = 'dirty'
    statusDotTone = 'accent'
    statusLabel = `保存(${dirtyEdits.length})`
  } else if (globalSavedPulse) {
    statusBtnState = 'saved'
    statusDotTone = 'ok'
    statusLabel = '已保存'
  } else if (snapshot?.activeSheet) {
    statusDotTone = stale ? 'warn' : 'ok'
    statusLabel = snapshot.activeSheet
  }

  const rootVars = {
    '--idw-expanded-width': `${expandedWidth}px`,
    pointerEvents: 'none',
  } as React.CSSProperties

  return (
    <div className="idw-root" data-theme={theme} style={rootVars}>
      {/* Top compact floating toolbar */}
      <div
        className="idw-toolbar"
        data-active={String(settingsOpen || hasDirty || stale || hasFieldError || bridgeOffline)}
      >
        <button
          type="button"
          className="idw-status-btn"
          data-state={statusBtnState}
          title={
            bridgeOffline
              ? '点击尝试重新连接本地 Excel 服务'
              : hasDirty || hasFieldError
                ? '点击立即保存修改到 Excel'
                : '当前自动保存状态（失焦自动保存，与 DSH 共享同一份 Excel）'
          }
          onClick={() => {
            if (bridgeOffline) {
              void loadData(snapshotRef.current?.activeSheet ?? undefined)
            } else if (hasDirty || hasFieldError) {
              void saveAllDirty(false)
            } else {
              void checkStatus()
            }
          }}
        >
          <span className="idw-dot" data-tone={statusDotTone} />
          <span>{statusLabel}</span>
        </button>

        <button
          type="button"
          className="idw-icon-btn"
          title={stale ? '检测到硬盘 Excel 已更新，点击刷新' : '从硬盘刷新 Excel'}
          disabled={loading}
          onClick={handleRefreshClick}
        >
          <RefreshIcon spinning={loading} />
          {stale && <span className="idw-badge-dot" />}
        </button>

        {!bridgeOffline && (
          <button
            type="button"
            className="idw-icon-btn"
            title="Excel 路径与日期工作表设置"
            onClick={() => setSettingsOpen(v => !v)}
          >
            <SettingsIcon />
          </button>
        )}

        <button
          type="button"
          className="idw-icon-btn"
          title="收起至右边缘"
          onClick={() => handleToggleHidden(true)}
        >
          <CollapseRightIcon />
        </button>
      </div>

      {/* Offline Bridge Hint */}
      {bridgeOffline && (
        <div className="idw-banner" data-tone="error">
          <WarnIcon />
          <span className="idw-banner-text">
            未检测到本地 Excel 服务（请双击启动 start-bridge-silent.vbs）
          </span>
          <button
            type="button"
            className="idw-mini-pill"
            data-primary="true"
            onClick={() => void loadData(snapshot?.activeSheet ?? undefined)}
          >
            重连
          </button>
        </div>
      )}

      {/* Confirm refresh when local unsaved drafts exist */}
      {!bridgeOffline && confirmRefresh && (
        <div className="idw-banner">
          <WarnIcon />
          <span className="idw-banner-text">当前有未保存修改，刷新将丢弃未落盘内容</span>
          <div className="idw-banner-actions">
            <button
              type="button"
              className="idw-mini-pill"
              data-primary="true"
              onClick={() => {
                setConfirmRefresh(false)
                void loadData(snapshot?.activeSheet ?? undefined)
              }}
            >
              刷新
            </button>
            <button
              type="button"
              className="idw-mini-pill"
              onClick={() => setConfirmRefresh(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Stale / Conflict Banner */}
      {!bridgeOffline && !confirmRefresh && (stale || conflict) && (
        <div className="idw-banner" data-tone={conflict ? 'error' : undefined}>
          <WarnIcon />
          <span className="idw-banner-text">
            {conflict
              ? '硬盘 Excel 已有更新，存在本地修改，自动保存已暂停'
              : '检测到 Excel 已更新，当前非最新数据，请先刷新'}
          </span>
          <div className="idw-banner-actions">
            <button
              type="button"
              className="idw-mini-pill"
              data-primary={!conflict}
              onClick={() => void loadData(snapshot?.activeSheet ?? undefined)}
            >
              {conflict ? '放弃并刷新' : '刷新'}
            </button>
            {conflict && (
              <button
                type="button"
                className="idw-mini-pill"
                data-primary="true"
                onClick={() => void saveAllDirty(true)}
              >
                覆盖保存
              </button>
            )}
          </div>
        </div>
      )}

      {/* Transient error banner */}
      {!bridgeOffline && bannerError && !conflict && (
        <div className="idw-banner" data-tone="error">
          <WarnIcon />
          <span className="idw-banner-text">{bannerError}</span>
          <button
            type="button"
            className="idw-mini-pill"
            onClick={() => setBannerError(null)}
          >
            关闭
          </button>
        </div>
      )}

      {/* Settings Popover */}
      {!bridgeOffline && settingsOpen && (
        <div className="idw-settings">
          <div className="idw-settings-title">
            <span>事件单数据源设置（与 DSH 共享）</span>
            <button
              type="button"
              className="idw-mini-pill"
              onClick={() => setSettingsOpen(false)}
            >
              关闭
            </button>
          </div>

          <div className="idw-settings-row">
            <div className="idw-settings-label">
              <span>工作表（默认匹配当日 {snapshot?.todaySheetName ?? ''}）</span>
              {snapshot && <span>共 {snapshot.totalDataRows} 条 · 展示前 {snapshot.rows.length} 条</span>}
            </div>
            <select
              className="idw-select"
              value={snapshot?.activeSheet ?? ''}
              disabled={!snapshot || snapshot.sheets.length === 0}
              onChange={e => void handleSwitchSheet(e.target.value)}
            >
              {!snapshot?.activeSheet && (
                <option value="">请选择工作表...</option>
              )}
              {(snapshot?.sheets ?? []).map(name => (
                <option key={name} value={name}>
                  {name}{name === snapshot?.todaySheetName ? '（今日）' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="idw-settings-row">
            <div className="idw-settings-label">
              <span>本地 Excel 文件路径 (.xlsx)</span>
            </div>
            <div className="idw-settings-input-row">
              <input
                type="text"
                className="idw-input"
                value={pathInput}
                placeholder="例如 D:\Tickets\incidents.xlsx"
                onChange={e => setPathInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void handleApplyPath()
                }}
              />
              <button
                type="button"
                className="idw-btn"
                data-primary="true"
                onClick={() => void handleApplyPath()}
              >
                应用
              </button>
            </div>
          </div>

          <div className="idw-settings-input-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--idw-label-3)' }}>
              展开卡片左边缘可拖拽调整宽度 ({expandedWidth}px)
            </span>
            <button
              type="button"
              className="idw-btn"
              onClick={() => void handleCreateSample()}
            >
              生成示例表
            </button>
          </div>
        </div>
      )}

      {/* Incident List */}
      <div className="idw-list">
        {!bridgeOffline && snapshot && (!snapshot.exists || snapshot.rows.length === 0) && (
          <div className="idw-empty-card">
            <div>{snapshot.error ?? `工作表 "${snapshot.activeSheet ?? ''}" 暂无事件单数据`}</div>
            <div className="idw-banner-actions">
              {!snapshot.exists && (
                <button
                  type="button"
                  className="idw-btn"
                  data-primary="true"
                  onClick={() => void handleCreateSample()}
                >
                  生成示例 Excel
                </button>
              )}
              <button
                type="button"
                className="idw-btn"
                onClick={() => setSettingsOpen(true)}
              >
                打开设置
              </button>
            </div>
          </div>
        )}

        {(snapshot?.rows ?? []).map((row) => {
          const isExpanded = expandedRow === row.rowNumber
          const isHovered = !isExpanded && hoveredRow === row.rowNumber
          const cardState = isExpanded ? 'expanded' : isHovered ? 'hover' : 'collapsed'
          const rowSla = getRowSla(row)
          const rowHasDirty = row.cells.some((cellVal, colOffset) => {
            const k = cellKey(row.rowNumber, colOffset + 2)
            return Object.hasOwn(drafts, k) && drafts[k] !== cellVal
          })
          const dotTone = rowSla ? rowSla.tone : (rowHasDirty ? 'accent' : getStatusTone(row))

          return (
            <div
              key={row.rowNumber}
              ref={(el) => {
                if (el) cardRefs.current.set(row.rowNumber, el)
                else cardRefs.current.delete(row.rowNumber)
              }}
              className="idw-card"
              data-state={cardState}
              data-resizing={isExpanded && resizing ? 'true' : undefined}
              onMouseEnter={() => handleRowMouseEnter(row.rowNumber)}
              onMouseLeave={() => handleRowMouseLeave(row.rowNumber)}
            >
              {isExpanded && (
                <div
                  className="idw-resize-handle"
                  title="左右拖拽调整卡片宽度"
                  onPointerDown={handleStartResize}
                />
              )}

              <div
                className="idw-card-head"
                onClick={() => handleToggleExpand(row.rowNumber)}
                title={cardState === 'collapsed' ? (rowSla ? `${row.idText}\nSLA: ${rowSla.label}` : row.idText) : undefined}
              >
                <span
                  className="idw-dot"
                  data-tone={dotTone}
                  title={rowSla ? `SLA: ${rowSla.label}` : undefined}
                />

                {cardState === 'collapsed' ? (
                  <span className="idw-id-short">{shortenTicketId(row.idText)}</span>
                ) : (
                  <span className="idw-id-full" title={row.idText}>
                    {row.idText}
                  </span>
                )}

                {isHovered && (
                  <span className="idw-hover-hint">
                    {rowSla && (
                      <span className="idw-mini-sla" data-tone={rowSla.tone}>
                        {rowSla.shortLabel}
                      </span>
                    )}
                    {row.hyperlink && <ExternalLinkIcon />}
                    <ChevronDownIcon />
                  </span>
                )}

                {isExpanded && (
                  <div className="idw-head-actions">
                    <button
                      type="button"
                      className="idw-open-link"
                      disabled={!row.hyperlink}
                      title={row.hyperlink ?? '该事件单未配置超链接'}
                      onClick={e => handleOpenHyperlink(e, row.hyperlink)}
                    >
                      <ExternalLinkIcon />
                      <span>打开</span>
                    </button>
                    <span className="idw-chevron" title="收起">
                      <ChevronDownIcon />
                    </span>
                  </div>
                )}
              </div>

              <div className="idw-accordion">
                <div className="idw-accordion-inner">
                  {isExpanded && (
                    <div className="idw-form">
                      {(() => {
                        const hasCategoryPair = categoryColOffset >= 0 && subCategoryColOffset >= 0
                        const firstCategoryOffset = hasCategoryPair
                          ? Math.min(categoryColOffset, subCategoryColOffset)
                          : -1
                        const secondCategoryOffset = hasCategoryPair
                          ? Math.max(categoryColOffset, subCategoryColOffset)
                          : -1

                        const renderCategoryDropdown = (offset: number, isParent: boolean) => {
                          const colIndex = offset + 2
                          const key = cellKey(row.rowNumber, colIndex)
                          const headerName = snapshot?.headers[colIndex - 1] ?? (isParent ? '服务分类' : '服务子分类')
                          const value = getCellDisplayValue(row, offset)
                          const status = fieldStatus[key]
                          const errText = fieldErrors[key]
                          const flash = status === 'saved' || status === 'error' ? status : undefined

                          const parentValue = categoryColOffset >= 0 ? getCellDisplayValue(row, categoryColOffset).trim() : ''
                          const baseOptions = isParent
                            ? Object.keys(categoryOptions)
                            : (parentValue ? (categoryOptions[parentValue] ?? []) : [])
                          const optionList =
                            value.trim() !== '' && !baseOptions.includes(value.trim())
                              ? [value.trim(), ...baseOptions]
                              : baseOptions

                          return (
                            <div key={key} className="idw-field">
                              <div className="idw-field-head">
                                <span className="idw-field-label" title={headerName}>
                                  {headerName}
                                </span>
                                {status === 'saving' && (
                                  <span className="idw-field-state" data-state="saving">保存中...</span>
                                )}
                                {status === 'saved' && (
                                  <span className="idw-field-state" data-state="saved">已保存</span>
                                )}
                              </div>

                              <select
                                className="idw-select"
                                aria-label={headerName}
                                data-flash={flash}
                                disabled={!isParent && !parentValue}
                                value={value.trim()}
                                onChange={(e) => {
                                  const nextVal = e.target.value
                                  if (isParent) {
                                    const nextSubs = categoryOptions[nextVal] ?? []
                                    const subColIdx = subCategoryColOffset + 2
                                    const subKey = cellKey(row.rowNumber, subColIdx)
                                    const curSub = subCategoryColOffset >= 0 ? getCellDisplayValue(row, subCategoryColOffset).trim() : ''
                                    const resetSub = subCategoryColOffset >= 0 && curSub !== '' && !nextSubs.includes(curSub)

                                    setDrafts(prev => ({
                                      ...prev,
                                      [key]: nextVal,
                                      ...(resetSub ? { [subKey]: '' } : {}),
                                    }))

                                    const edits: CellEdit[] = [{ rowNumber: row.rowNumber, colIndex, value: nextVal }]
                                    if (resetSub) {
                                      edits.push({ rowNumber: row.rowNumber, colIndex: subColIdx, value: '' })
                                    }
                                    void saveEditsBatch(edits)
                                  } else {
                                    setDrafts(prev => ({ ...prev, [key]: nextVal }))
                                    void saveCell(row.rowNumber, colIndex, nextVal, false)
                                  }
                                }}
                              >
                                <option value="">
                                  {isParent ? '选择服务分类...' : parentValue ? '选择服务子分类...' : '请先选服务分类'}
                                </option>
                                {optionList.map(opt => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>

                              {errText && (
                                <div className="idw-field-error">
                                  <span>{errText}</span>
                                  <button
                                    type="button"
                                    className="idw-retry-link"
                                    onClick={() => void saveCell(row.rowNumber, colIndex, value, conflict)}
                                  >
                                    {conflict ? '强制覆盖' : '重试'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        }

                        return row.cells.map((cellValue, colOffset) => {
                          if (hasCategoryPair && colOffset === secondCategoryOffset) {
                            return null
                          }
                          if (hasCategoryPair && colOffset === firstCategoryOffset) {
                            return (
                              <div key={`cat-pair-${row.rowNumber}`} className="idw-field-pair">
                                {renderCategoryDropdown(categoryColOffset, true)}
                                {renderCategoryDropdown(subCategoryColOffset, false)}
                              </div>
                            )
                          }

                          const colIndex = colOffset + 2
                          const key = cellKey(row.rowNumber, colIndex)
                          const headerName = snapshot?.headers[colIndex - 1] ?? `列 ${colIndex}`
                          const value = Object.hasOwn(drafts, key)
                            ? drafts[key]
                            : cellValue
                          const status = fieldStatus[key]
                          const errText = fieldErrors[key]
                          const flash = status === 'saved' || status === 'error' ? status : undefined
                          const cellSla = colOffset === slaColOffset ? evaluateSla(value, nowDate) : null

                          return (
                            <div key={key} className="idw-field">
                              <div className="idw-field-head">
                                <span className="idw-field-label" title={headerName}>
                                  {headerName}
                                </span>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  {cellSla && (
                                    <span className="idw-sla-pill" data-tone={cellSla.tone}>
                                      {cellSla.label}
                                    </span>
                                  )}
                                  {status === 'saving' && (
                                    <span className="idw-field-state" data-state="saving">保存中...</span>
                                  )}
                                  {status === 'saved' && (
                                    <span className="idw-field-state" data-state="saved">已保存</span>
                                  )}
                                </div>
                              </div>

                              <AutoTextarea
                                ariaLabel={headerName}
                                value={value}
                                flash={flash}
                                placeholder={`输入${headerName}...`}
                                onChange={(nextVal) => {
                                  setDrafts(prev => ({ ...prev, [key]: nextVal }))
                                  if (fieldStatus[key] === 'error') {
                                    setFieldStatus(prev => {
                                      const copy = { ...prev }
                                      delete copy[key]
                                      return copy
                                    })
                                  }
                                }}
                                onBlur={(currentVal) => {
                                  void saveCell(row.rowNumber, colIndex, currentVal, false)
                                }}
                                onKeyDown={(e) => {
                                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                                    e.preventDefault()
                                    void saveCell(row.rowNumber, colIndex, e.currentTarget.value, false)
                                  } else if (e.key === 'Escape') {
                                    e.currentTarget.blur()
                                  }
                                }}
                              />

                              {errText && (
                                <div className="idw-field-error">
                                  <span>{errText}</span>
                                  <button
                                    type="button"
                                    className="idw-retry-link"
                                    onClick={() => void saveCell(row.rowNumber, colIndex, value, conflict)}
                                  >
                                    {conflict ? '强制覆盖' : '重试'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
