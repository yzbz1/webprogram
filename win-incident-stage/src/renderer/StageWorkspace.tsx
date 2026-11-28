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
  CellEdit,
  DesktopPreferences,
  DrawerSnapshot,
  IncidentRow,
  SaveResult,
  ShortcutActionType,
  StatusCheckResult,
  TodoItem,
  TrafficLightShortcut,
} from '../shared/types.ts'
import { BongoCatWidget, HoloTodoStageCard } from './BongoCatWidget.tsx'
import {
  CheckIcon,
  CloseIcon,
  CollapseRightIcon,
  ExternalLinkIcon,
  PeekLeftIcon,
  PlusIcon,
  RefreshIcon,
  SettingsIcon,
  TrafficLightGlyph,
  TrashIcon,
  WarnIcon,
} from './icons.tsx'
import { SiriMusicOrb } from './SiriMusicOrb.tsx'

const POLL_INTERVAL_MS = 4000
const HOVER_IN_DELAY_MS = 90
const HOVER_OUT_DELAY_MS = 160
const MIN_STAGE_WIDTH = 300
const MAX_STAGE_WIDTH = 540
const MAX_TEXTAREA_HEIGHT = 280

type FieldSaveState = 'saving' | 'saved' | 'error'
type SettingsTab = 'general' | 'shortcuts' | 'todos'

const DEFAULT_SHORTCUTS: readonly TrafficLightShortcut[] = [
  { id: 'red', label: '区域截屏', actionType: 'hotkey', target: 'Win+Shift+S' },
  { id: 'yellow', label: '显示桌面', actionType: 'hotkey', target: 'Win+D' },
  { id: 'green', label: '剪贴板历史', actionType: 'hotkey', target: 'Win+V' },
]

const HOTKEY_PRESETS: readonly string[] = [
  'Win+Shift+S',
  'Win+D',
  'Win+V',
  'Win+E',
  'Alt+Tab',
  'Ctrl+Shift+Esc',
]

function formatRecordedHotkey(e: ReactKeyboardEvent<HTMLInputElement>): string | null {
  const ignoreOnly = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS'])
  if (ignoreOnly.has(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Win')

  const specialMap: Record<string, string> = {
    ' ': 'Space',
    Escape: 'Esc',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Delete: 'Delete',
    Insert: 'Insert',
    Backspace: 'Backspace',
    Enter: 'Enter',
    Tab: 'Tab',
  }

  let keyName = specialMap[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
  if (e.code === 'PrintScreen') keyName = 'PrintScreen'
  if (parts.length === 0 && !/^F([1-9]|1\d|2[0-4])$/i.test(keyName) && keyName !== 'PrintScreen') {
    return null
  }
  parts.push(keyName)
  return parts.join('+')
}

function cellKey(rowNumber: number, colIndex: number): string {
  return `${rowNumber}:${colIndex}`
}

function shortenTicketId(idText: string): string {
  const trimmed = idText.trim()
  if (trimmed.length <= 8) return trimmed
  const tailMatch = /(?:^|[-_#])([A-Za-z]?\d{1,4})$/.exec(trimmed)
  if (tailMatch) return `#${tailMatch[1]}`
  return trimmed.slice(-7)
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
      className="stg-textarea"
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

export function StageWorkspace() {
  const [snapshot, setSnapshot] = useState<DrawerSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<DesktopPreferences>({
    theme: 'system',
    resolvedTheme: 'light',
    alwaysOnTop: true,
    displayId: null,
    hidden: false,
    stageWidth: 344,
    showCat: true,
    showPlayer: true,
    musicFolder: '',
    trafficLights: DEFAULT_SHORTCUTS,
    todos: [],
    todoIntervalMinutes: 60,
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [pathInput, setPathInput] = useState('')
  const [shortcutDrafts, setShortcutDrafts] = useState<TrafficLightShortcut[]>([...DEFAULT_SHORTCUTS])
  const [hoveredLightId, setHoveredLightId] = useState<string | null>(null)
  const [lightsExpanded, setLightsExpanded] = useState(false)
  const [todoStageOpen, setTodoStageOpen] = useState(false)
  const [selectedTodoIndex, setSelectedTodoIndex] = useState(0)
  const [bubblePreviewSignal, setBubblePreviewSignal] = useState(0)
  const [settingsTodoInput, setSettingsTodoInput] = useState('')

  const [activeRowNumber, setActiveRowNumber] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [stageWidth, setStageWidth] = useState(344)
  const [resizing, setResizing] = useState(false)

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
  const resizingRef = useRef(false)
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const hoverInTimerRef = useRef<number | null>(null)
  const hoverOutTimerRef = useRef<number | null>(null)
  const lightsLeaveTimerRef = useRef<number | null>(null)
  const flashTimersRef = useRef<Map<string, number>>(new Map())
  const savedPulseTimerRef = useRef<number | null>(null)

  snapshotRef.current = snapshot
  draftsRef.current = drafts
  conflictRef.current = conflict
  resizingRef.current = resizing

  const dirtyEdits = useMemo(() => collectDirtyEdits(snapshot, drafts), [snapshot, drafts])
  const hasDirty = dirtyEdits.length > 0
  const hasSaving = Object.values(fieldStatus).some(s => s === 'saving')
  const hasFieldError = Object.values(fieldStatus).some(s => s === 'error')
  const activeRow = useMemo(
    () => (activeRowNumber === null ? null : snapshot?.rows.find(r => r.rowNumber === activeRowNumber) ?? null),
    [activeRowNumber, snapshot],
  )

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

  const setLightsHoverWithGrace = useCallback((enter: boolean) => {
    if (lightsLeaveTimerRef.current !== null) {
      window.clearTimeout(lightsLeaveTimerRef.current)
      lightsLeaveTimerRef.current = null
    }
    if (enter) {
      setLightsExpanded(true)
    } else {
      lightsLeaveTimerRef.current = window.setTimeout(() => {
        lightsLeaveTimerRef.current = null
        setLightsExpanded(false)
        setHoveredLightId(null)
      }, 180)
    }
  }, [])

  useEffect(() => () => {
    clearHoverTimers()
    if (lightsLeaveTimerRef.current !== null) {
      window.clearTimeout(lightsLeaveTimerRef.current)
    }
    for (const timer of flashTimersRef.current.values()) {
      window.clearTimeout(timer)
    }
    if (savedPulseTimerRef.current !== null) {
      window.clearTimeout(savedPulseTimerRef.current)
    }
  }, [clearHoverTimers])

  // Global transparent click-through hit-testing
  useEffect(() => {
    let lastInteractive: boolean | null = null
    const pushInteractive = (next: boolean) => {
      if (lastInteractive === next) return
      lastInteractive = next
      window.stageApi.setInteractive(next)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (resizingRef.current) {
        pushInteractive(true)
        return
      }
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const hit = Boolean(el?.closest('[data-interactive="true"]'))
      pushInteractive(hit)
    }

    const onMouseLeave = () => {
      if (!resizingRef.current) pushInteractive(false)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('mouseleave', onMouseLeave)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

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
    setActiveRowNumber(prev => (prev !== null && next.rows.some(r => r.rowNumber === prev) ? prev : null))
  }, [])

  const loadData = useCallback(async (sheetName?: string) => {
    setLoading(true)
    setBannerError(null)
    try {
      const next = await window.stageApi.invoke<DrawerSnapshot>('load', sheetName ? { sheetName } : {})
      applySnapshot(next)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : '加载事件单失败')
    } finally {
      setLoading(false)
    }
  }, [applySnapshot])

  useEffect(() => {
    void window.stageApi.getPrefs().then((p) => {
      setPrefs(p)
      setStageWidth(p.stageWidth)
      setShortcutDrafts(p.trafficLights.map(item => ({ ...item })))
    })
    void loadData()

    const offPrefs = window.stageApi.onPrefsChanged((p) => {
      setPrefs(p)
      setStageWidth(p.stageWidth)
      setShortcutDrafts(p.trafficLights.map(item => ({ ...item })))
      if (!p.showCat) {
        setTodoStageOpen(false)
      }
    })
    const offBlur = window.stageApi.onWindowBlur(() => {
      if (document.activeElement instanceof HTMLTextAreaElement) {
        document.activeElement.blur()
      }
    })
    const offRefresh = window.stageApi.onTriggerRefresh(() => {
      void loadData(snapshotRef.current?.activeSheet ?? undefined)
    })
    return () => {
      offPrefs()
      offBlur()
      offRefresh()
    }
  }, [loadData])

  const checkStatus = useCallback(async () => {
    if (loading || !snapshotRef.current?.exists) return
    try {
      const res = await window.stageApi.invoke<StatusCheckResult>('check-status', {
        knownVersion: versionRef.current,
      })
      if (res.stale) {
        setStale(true)
        if (collectDirtyEdits(snapshotRef.current, draftsRef.current).length > 0) {
          setConflict(true)
        }
      }
    } catch {
      // Ignore transient poll errors
    }
  }, [loading])

  useEffect(() => {
    if (prefs.hidden) return
    const timer = window.setInterval(() => {
      void checkStatus()
    }, POLL_INTERVAL_MS)
    const onFocus = () => {
      void checkStatus()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [checkStatus, prefs.hidden])

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
        const res = await window.stageApi.invoke<SaveResult>('save-cell', {
          sheetName: snap.activeSheet,
          rowNumber,
          colIndex,
          value,
          expectedVersion: versionRef.current,
          forceOverwrite,
        })

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
        setFieldStatus(prev => ({ ...prev, [key]: 'error' }))
        setFieldErrors(prev => ({ ...prev, [key]: err instanceof Error ? err.message : '保存失败' }))
        return false
      }
    })
  }, [enqueueSave, fieldStatus, markFieldSaved, triggerGlobalSavedPulse])

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
        const res = await window.stageApi.invoke<SaveResult>('save-batch', {
          sheetName: snap.activeSheet,
          edits,
          expectedVersion: versionRef.current,
          forceOverwrite,
        })

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
        setBannerError(err instanceof Error ? err.message : '保存失败')
        return false
      }
    })
  }, [enqueueSave, markFieldSaved, triggerGlobalSavedPulse])

  const handleRefreshClick = useCallback(() => {
    if (hasDirty && !stale) {
      setConfirmRefresh(true)
      return
    }
    void loadData(snapshotRef.current?.activeSheet ?? undefined)
  }, [hasDirty, loadData, stale])

  const handleToggleHidden = useCallback((nextHidden: boolean) => {
    setSettingsOpen(false)
    setTodoStageOpen(false)
    if (nextHidden) {
      window.stageApi.setInteractive(false)
    }
    void window.stageApi.updatePrefs({ hidden: nextHidden })
  }, [])

  const handleToggleTodoStage = useCallback(() => {
    clearHoverTimers()
    if (document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur()
    }
    setActiveRowNumber(null)
    setTodoStageOpen(prev => !prev)
  }, [clearHoverTimers])

  const handleExecuteTrafficLight = useCallback(async (light: TrafficLightShortcut) => {
    switch (light.actionType) {
      case 'hotkey': {
        if (!light.target.trim()) {
          setSettingsTab('shortcuts')
          setSettingsOpen(true)
          return
        }
        const ok = await window.stageApi.triggerHotkey(light.target)
        if (!ok) setBannerError(`无效快捷键或无法发送：${light.target}`)
        return
      }
      case 'url': {
        if (!light.target.trim()) {
          setSettingsTab('shortcuts')
          setSettingsOpen(true)
          return
        }
        const ok = await window.stageApi.openExternal(light.target)
        if (!ok) setBannerError(`无法打开网址：${light.target}`)
        return
      }
      case 'path': {
        if (!light.target.trim()) {
          setSettingsTab('shortcuts')
          setSettingsOpen(true)
          return
        }
        const ok = await window.stageApi.openPath(light.target)
        if (!ok) setBannerError(`无法打开路径：${light.target}`)
        return
      }
      case 'open-excel': {
        const ok = await window.stageApi.openBoundExcel()
        if (!ok) setBannerError('无法打开绑定的 Excel 文件')
        return
      }
      case 'settings': {
        setSettingsTab('general')
        setSettingsOpen(v => !v)
        return
      }
      case 'todos': {
        if (prefs.showCat) {
          handleToggleTodoStage()
        } else {
          setSettingsTab('todos')
          setSettingsOpen(true)
        }
        return
      }
      case 'refresh': {
        handleRefreshClick()
        return
      }
      case 'toggle-hide': {
        handleToggleHidden(true)
        return
      }
    }
  }, [handleRefreshClick, handleToggleHidden, handleToggleTodoStage, prefs.showCat])

  const handleUpdateTodos = useCallback((nextTodos: TodoItem[], nextInterval?: number) => {
    void window.stageApi.updatePrefs({
      todos: nextTodos,
      ...(typeof nextInterval === 'number' ? { todoIntervalMinutes: nextInterval } : {}),
    })
  }, [])

  const handleSaveShortcuts = useCallback(() => {
    void window.stageApi.updatePrefs({ trafficLights: shortcutDrafts }).then(() => {
      triggerGlobalSavedPulse()
    })
  }, [shortcutDrafts, triggerGlobalSavedPulse])

  const handleRailMouseEnter = useCallback((rowNumber: number) => {
    clearHoverTimers()
    if (hoveredRow !== null) {
      setHoveredRow(rowNumber)
      return
    }
    hoverInTimerRef.current = window.setTimeout(() => {
      hoverInTimerRef.current = null
      setHoveredRow(rowNumber)
    }, HOVER_IN_DELAY_MS)
  }, [clearHoverTimers, hoveredRow])

  const handleRailMouseLeave = useCallback((rowNumber: number) => {
    clearHoverTimers()
    hoverOutTimerRef.current = window.setTimeout(() => {
      hoverOutTimerRef.current = null
      setHoveredRow(prev => (prev === rowNumber ? null : prev))
    }, HOVER_OUT_DELAY_MS)
  }, [clearHoverTimers])

  const handleSelectStage = useCallback((rowNumber: number) => {
    clearHoverTimers()
    if (document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur()
    }
    setTodoStageOpen(false)
    setActiveRowNumber(prev => (prev === rowNumber ? null : rowNumber))
  }, [clearHoverTimers])

  const handleOpenHyperlink = useCallback((e: ReactMouseEvent, url: string | null) => {
    e.stopPropagation()
    if (!url) return
    void window.stageApi.openExternal(url)
  }, [])

  const handleStartResize = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = stageWidth
    setResizing(true)

    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX
      const clamped = Math.round(Math.min(MAX_STAGE_WIDTH, Math.max(MIN_STAGE_WIDTH, startWidth + delta)))
      setStageWidth(clamped)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setResizing(false)
      setStageWidth(current => {
        void window.stageApi.updatePrefs({ stageWidth: current })
        return current
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [stageWidth])

  const handleApplyPath = useCallback(async () => {
    const trimmed = pathInput.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      const next = await window.stageApi.invoke<DrawerSnapshot>('set-config', { excelPath: trimmed })
      applySnapshot(next)
      setSettingsOpen(false)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : '更新路径失败')
    } finally {
      setLoading(false)
    }
  }, [applySnapshot, pathInput])

  const handleBrowseExcel = useCallback(async () => {
    const picked = await window.stageApi.pickExcelFile()
    if (picked) {
      applySnapshot(picked)
      setSettingsOpen(false)
    }
  }, [applySnapshot])

  const handleSwitchSheet = useCallback(async (nextSheet: string) => {
    if (!nextSheet) return
    if (hasDirty && !conflict) {
      const ok = await saveAllDirty(false)
      if (!ok) return
    }
    setLoading(true)
    try {
      const next = await window.stageApi.invoke<DrawerSnapshot>('set-config', {
        excelPath: snapshotRef.current?.excelPath ?? pathInput.trim(),
        preferredSheet: nextSheet,
      })
      applySnapshot(next)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : '切换工作表失败')
    } finally {
      setLoading(false)
    }
  }, [applySnapshot, conflict, hasDirty, pathInput, saveAllDirty])

  const handleCreateSample = useCallback(async () => {
    setLoading(true)
    try {
      const next = await window.stageApi.invoke<DrawerSnapshot>('create-sample', {
        excelPath: pathInput.trim() || undefined,
      })
      applySnapshot(next)
      setSettingsOpen(false)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : '生成示例 Excel 失败')
    } finally {
      setLoading(false)
    }
  }, [applySnapshot, pathInput])

  if (prefs.hidden) {
    const alertDotColor = hasFieldError || conflict
      ? 'var(--stg-err-fg)'
      : stale
        ? 'var(--stg-warn-border)'
        : hasDirty
          ? 'var(--stg-accent)'
          : null

    return (
      <div className="stg-root" data-theme={prefs.resolvedTheme}>
        <button
          type="button"
          className="stg-peek"
          data-interactive="true"
          title="展开事件单前台调度台 (Alt+Shift+E)"
          onClick={() => handleToggleHidden(false)}
        >
          {alertDotColor && <span className="stg-peek-dot" style={{ background: alertDotColor }} />}
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
    statusLabel = '加载中'
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

  const railBottomOffset = prefs.showCat && prefs.showPlayer
    ? 212
    : prefs.showCat
      ? 134
      : prefs.showPlayer
        ? 92
        : 18

  const rootVars = {
    '--stg-stage-width': `${stageWidth}px`,
    '--stg-rail-bottom': `${railBottomOffset}px`,
  } as React.CSSProperties

  const hoveredLight = prefs.trafficLights.find(l => l.id === hoveredLightId) ?? null

  return (
    <div className="stg-root" data-theme={prefs.resolvedTheme} style={rootVars}>
      {/* Top Floating Control Pill + Left-Docked Separated macOS Traffic Lights */}
      <div className="stg-top-area">
        <div className="stg-toolbar-shell">
          <div
            className="stg-toolbar"
            data-interactive="true"
            data-active={String(settingsOpen || hasDirty || stale || hasFieldError)}
          >
            <button
              type="button"
              className="stg-status-btn"
              data-state={statusBtnState}
              title={hasDirty || hasFieldError ? '点击立即保存修改到 Excel' : '失焦自动保存 · 悬停下方展开快捷红绿灯'}
              onMouseEnter={() => setLightsHoverWithGrace(true)}
              onMouseLeave={() => setLightsHoverWithGrace(false)}
              onClick={() => {
                if (hasDirty || hasFieldError) {
                  void saveAllDirty(false)
                } else {
                  void checkStatus()
                }
              }}
            >
              <span className="stg-dot" data-tone={statusDotTone} />
              <span>{statusLabel}</span>
            </button>

            <button
              type="button"
              className="stg-icon-btn"
              title={stale ? '检测到硬盘 Excel 已更新，点击刷新' : '从硬盘刷新 Excel'}
              disabled={loading}
              onClick={handleRefreshClick}
            >
              <RefreshIcon spinning={loading} />
              {stale && <span className="stg-badge-dot" />}
            </button>

            <button
              type="button"
              className="stg-icon-btn"
              title="工作表、挂件与快捷设置"
              onClick={() => setSettingsOpen(v => !v)}
            >
              <SettingsIcon />
            </button>

            <button
              type="button"
              className="stg-icon-btn"
              title="贴边收起 (Alt+Shift+E)"
              onClick={() => handleToggleHidden(true)}
            >
              <CollapseRightIcon />
            </button>
          </div>

          {/* Left-Docked Separated Traffic Lights directly under 20261128 */}
          <div
            className="stg-lights-dock"
            data-interactive="true"
            data-expanded={lightsExpanded ? 'true' : undefined}
            onMouseEnter={() => setLightsHoverWithGrace(true)}
            onMouseLeave={() => setLightsHoverWithGrace(false)}
          >
            {hoveredLight && lightsExpanded && (
              <span className="stg-light-tip">
                {hoveredLight.actionType === 'hotkey' && hoveredLight.target
                  ? `${hoveredLight.label} (${hoveredLight.target})`
                  : hoveredLight.label}
              </span>
            )}
            {prefs.trafficLights.map(light => (
              <button
                key={light.id}
                type="button"
                className="stg-light-dot"
                data-color={light.id}
                aria-label={light.label}
                title={light.target ? `${light.label} (${light.target}) · 右键自定义` : `${light.label} · 右键自定义`}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setHoveredLightId(light.id)}
                onMouseLeave={() => setHoveredLightId(prev => (prev === light.id ? null : prev))}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSettingsTab('shortcuts')
                  setSettingsOpen(true)
                }}
                onClick={() => void handleExecuteTrafficLight(light)}
              >
                <TrafficLightGlyph actionType={light.actionType} />
              </button>
            ))}
          </div>
        </div>

        {confirmRefresh && (
          <div className="stg-banner" data-interactive="true">
            <WarnIcon />
            <span className="stg-banner-text">当前有未保存修改，刷新将丢弃未落盘内容</span>
            <div className="stg-banner-actions">
              <button
                type="button"
                className="stg-mini-pill"
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
                className="stg-mini-pill"
                onClick={() => setConfirmRefresh(false)}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {!confirmRefresh && (stale || conflict) && (
          <div className="stg-banner" data-interactive="true" data-tone={conflict ? 'error' : undefined}>
            <WarnIcon />
            <span className="stg-banner-text">
              {conflict
                ? '硬盘 Excel 已有更新，存在本地修改，自动保存已暂停'
                : '检测到 Excel 已更新，当前非最新数据，请先刷新'}
            </span>
            <div className="stg-banner-actions">
              <button
                type="button"
                className="stg-mini-pill"
                data-primary={!conflict}
                onClick={() => void loadData(snapshot?.activeSheet ?? undefined)}
              >
                {conflict ? '放弃并刷新' : '刷新'}
              </button>
              {conflict && (
                <button
                  type="button"
                  className="stg-mini-pill"
                  data-primary="true"
                  onClick={() => void saveAllDirty(true)}
                >
                  覆盖保存
                </button>
              )}
            </div>
          </div>
        )}

        {bannerError && !conflict && (
          <div className="stg-banner" data-interactive="true" data-tone="error">
            <WarnIcon />
            <span className="stg-banner-text">{bannerError}</span>
            <button
              type="button"
              className="stg-mini-pill"
              onClick={() => setBannerError(null)}
            >
              关闭
            </button>
          </div>
        )}

        {settingsOpen && (
          <div className="stg-settings" data-interactive="true">
            <div className="stg-settings-title">
              <span>调度台设置（三端共享 Excel）</span>
              <button
                type="button"
                className="stg-mini-pill"
                onClick={() => setSettingsOpen(false)}
              >
                关闭
              </button>
            </div>

            <div className="stg-tabs">
              <button
                type="button"
                className="stg-tab"
                data-active={settingsTab === 'general' ? 'true' : undefined}
                onClick={() => setSettingsTab('general')}
              >
                表格与挂件
              </button>
              <button
                type="button"
                className="stg-tab"
                data-active={settingsTab === 'shortcuts' ? 'true' : undefined}
                onClick={() => setSettingsTab('shortcuts')}
              >
                红绿灯快捷
              </button>
              <button
                type="button"
                className="stg-tab"
                data-active={settingsTab === 'todos' ? 'true' : undefined}
                onClick={() => setSettingsTab('todos')}
              >
                待办提醒
              </button>
            </div>

            {settingsTab === 'general' && (
              <>
                <div className="stg-settings-row">
                  <div className="stg-settings-label">
                    <span>工作表（默认匹配当日 {snapshot?.todaySheetName ?? ''}）</span>
                    {snapshot && <span>共 {snapshot.totalDataRows} 条 · 展示前 {snapshot.rows.length} 条</span>}
                  </div>
                  <select
                    className="stg-select"
                    value={snapshot?.activeSheet ?? ''}
                    disabled={!snapshot || snapshot.sheets.length === 0}
                    onChange={e => void handleSwitchSheet(e.target.value)}
                  >
                    {!snapshot?.activeSheet && <option value="">请选择工作表...</option>}
                    {(snapshot?.sheets ?? []).map(name => (
                      <option key={name} value={name}>
                        {name}{name === snapshot?.todaySheetName ? '（今日）' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="stg-settings-row">
                  <div className="stg-settings-label">
                    <span>本地 Excel 文件路径 (.xlsx)</span>
                  </div>
                  <div className="stg-settings-input-row">
                    <input
                      type="text"
                      className="stg-input"
                      value={pathInput}
                      placeholder="例如 D:\Tickets\incidents.xlsx"
                      onChange={e => setPathInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void handleApplyPath()
                      }}
                    />
                    <button type="button" className="stg-btn" onClick={() => void handleBrowseExcel()}>
                      浏览...
                    </button>
                    <button
                      type="button"
                      className="stg-btn"
                      data-primary="true"
                      onClick={() => void handleApplyPath()}
                    >
                      应用
                    </button>
                  </div>
                </div>

                <div
                  className="stg-toggle-card"
                  onClick={() => void window.stageApi.updatePrefs({ showCat: !prefs.showCat })}
                >
                  <div className="stg-toggle-meta">
                    <span className="stg-toggle-title">显示键盘小猫</span>
                    <span className="stg-toggle-sub">小猫原地拍键盘互动，面前悬浮全息待办小卡（点击弹出全息大卡）</span>
                  </div>
                  <button
                    type="button"
                    className="stg-switch"
                    role="switch"
                    aria-checked={prefs.showCat}
                    data-on={prefs.showCat ? 'true' : undefined}
                    onClick={e => {
                      e.stopPropagation()
                      void window.stageApi.updatePrefs({ showCat: !prefs.showCat })
                    }}
                  >
                    <span className="stg-switch-thumb" />
                  </button>
                </div>

                <div
                  className="stg-toggle-card"
                  onClick={() => void window.stageApi.updatePrefs({ showPlayer: !prefs.showPlayer })}
                >
                  <div className="stg-toggle-meta">
                    <span className="stg-toggle-title">显示水滴播放器</span>
                    <span className="stg-toggle-sub">平时缩小为水滴，悬停放大现黑洞光晕；左/右切歌，右键管理播放文件夹</span>
                  </div>
                  <button
                    type="button"
                    className="stg-switch"
                    role="switch"
                    aria-checked={prefs.showPlayer}
                    data-on={prefs.showPlayer ? 'true' : undefined}
                    onClick={e => {
                      e.stopPropagation()
                      void window.stageApi.updatePrefs({ showPlayer: !prefs.showPlayer })
                    }}
                  >
                    <span className="stg-switch-thumb" />
                  </button>
                </div>

                {prefs.showPlayer && (
                  <div className="stg-settings-row">
                    <div className="stg-settings-label">
                      <span>本地音乐播放文件夹（留空则监听系统媒体）</span>
                    </div>
                    <div className="stg-settings-input-row">
                      <input
                        type="text"
                        className="stg-input"
                        readOnly
                        value={prefs.musicFolder || '当前使用系统媒体控制 (SMTC)'}
                        title={prefs.musicFolder}
                      />
                      <button type="button" className="stg-btn" onClick={() => void window.stageApi.pickMusicFolder()}>
                        选择...
                      </button>
                      {prefs.musicFolder && (
                        <button
                          type="button"
                          className="stg-btn"
                          onClick={() => void window.stageApi.updatePrefs({ musicFolder: '' })}
                        >
                          清除
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="stg-settings-input-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--stg-label-3)' }}>
                    宽 {stageWidth}px · 快捷键 Alt+Shift+E
                  </span>
                  <button type="button" className="stg-btn" onClick={() => void handleCreateSample()}>
                    生成示例表
                  </button>
                </div>
              </>
            )}

            {settingsTab === 'shortcuts' && (
              <>
                {shortcutDrafts.map((item, idx) => {
                  const needsTarget =
                    item.actionType === 'hotkey' || item.actionType === 'url' || item.actionType === 'path'
                  const colorTitle = item.id === 'red' ? '红灯（左）' : item.id === 'yellow' ? '黄灯（中）' : '绿灯（右）'
                  return (
                    <div key={item.id} className="stg-shortcut-card">
                      <div className="stg-shortcut-head">
                        <span className="stg-dot-sample" data-color={item.id} />
                        <span>{colorTitle}</span>
                      </div>

                      <div className="stg-settings-input-row">
                        <input
                          type="text"
                          className="stg-input"
                          style={{ width: 112, flex: 'none' }}
                          value={item.label}
                          placeholder="提示名称"
                          onChange={e => {
                            const next = [...shortcutDrafts]
                            next[idx] = { ...item, label: e.target.value }
                            setShortcutDrafts(next)
                          }}
                        />
                        <select
                          className="stg-select"
                          value={item.actionType}
                          onChange={e => {
                            const actionType = e.target.value as ShortcutActionType
                            const next = [...shortcutDrafts]
                            next[idx] = { ...item, actionType }
                            setShortcutDrafts(next)
                          }}
                        >
                          <option value="hotkey">触发快捷键组合</option>
                          <option value="url">打开网址</option>
                          <option value="path">打开应用/文件</option>
                          <option value="open-excel">打开当前 Excel</option>
                          <option value="settings">打开设置面板</option>
                          <option value="todos">打开待办提醒</option>
                          <option value="refresh">刷新表格数据</option>
                          <option value="toggle-hide">贴边收起窗口</option>
                        </select>
                      </div>

                      {needsTarget && (
                        <div className="stg-settings-input-row">
                          <input
                            type="text"
                            className="stg-input"
                            value={item.target}
                            placeholder={
                              item.actionType === 'hotkey'
                                ? '按下快捷键录制或输入如 Win+Shift+S'
                                : item.actionType === 'url'
                                  ? 'https://...'
                                  : '本地程序或文件路径'
                            }
                            onChange={e => {
                              const next = [...shortcutDrafts]
                              next[idx] = { ...item, target: e.target.value }
                              setShortcutDrafts(next)
                            }}
                            onKeyDown={e => {
                              if (item.actionType !== 'hotkey') return
                              const recorded = formatRecordedHotkey(e)
                              if (!recorded) return
                              e.preventDefault()
                              const next = [...shortcutDrafts]
                              next[idx] = { ...item, target: recorded }
                              setShortcutDrafts(next)
                            }}
                          />
                          {item.actionType === 'path' && (
                            <button
                              type="button"
                              className="stg-btn"
                              onClick={async () => {
                                const picked = await window.stageApi.pickAnyFile()
                                if (!picked) return
                                const next = [...shortcutDrafts]
                                next[idx] = { ...item, target: picked }
                                setShortcutDrafts(next)
                              }}
                            >
                              选择
                            </button>
                          )}
                        </div>
                      )}

                      {item.actionType === 'hotkey' && (
                        <div className="stg-hotkey-chips">
                          {HOTKEY_PRESETS.map(preset => (
                            <button
                              key={preset}
                              type="button"
                              className="stg-hotkey-chip"
                              data-active={item.target === preset ? 'true' : undefined}
                              onClick={() => {
                                const next = [...shortcutDrafts]
                                next[idx] = { ...item, target: preset }
                                setShortcutDrafts(next)
                              }}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                <div className="stg-settings-input-row" style={{ justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="stg-btn"
                    data-primary="true"
                    onClick={handleSaveShortcuts}
                  >
                    保存红绿灯配置
                  </button>
                </div>
              </>
            )}

            {settingsTab === 'todos' && (
              <>
                <div className="stg-settings-input-row">
                  <input
                    type="text"
                    className="stg-input"
                    value={settingsTodoInput}
                    placeholder="添加待办提醒事项（回车新增）..."
                    onChange={e => setSettingsTodoInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && settingsTodoInput.trim()) {
                        handleUpdateTodos([
                          ...prefs.todos,
                          { id: `todo-${Date.now().toString(36)}`, text: settingsTodoInput.trim().slice(0, 120), done: false },
                        ])
                        setSettingsTodoInput('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="stg-btn"
                    data-primary="true"
                    onClick={() => {
                      if (!settingsTodoInput.trim()) return
                      handleUpdateTodos([
                        ...prefs.todos,
                        { id: `todo-${Date.now().toString(36)}`, text: settingsTodoInput.trim().slice(0, 120), done: false },
                      ])
                      setSettingsTodoInput('')
                    }}
                  >
                    <PlusIcon />
                  </button>
                </div>

                <div className="stg-todo-list">
                  {prefs.todos.length === 0 && (
                    <div className="stg-todo-empty">暂无待办提醒事项</div>
                  )}
                  {prefs.todos.map(item => (
                    <div key={item.id} className="stg-todo-row" data-done={item.done ? 'true' : undefined}>
                      <button
                        type="button"
                        className="stg-todo-check"
                        data-done={item.done ? 'true' : undefined}
                        onClick={() =>
                          handleUpdateTodos(prefs.todos.map(t => (t.id === item.id ? { ...t, done: !t.done } : t)))
                        }
                      >
                        {item.done && <CheckIcon />}
                      </button>
                      <span className="stg-todo-text" title={item.text}>
                        {item.text}
                      </span>
                      <button
                        type="button"
                        className="stg-bubble-icon-btn"
                        onClick={() => handleUpdateTodos(prefs.todos.filter(t => t.id !== item.id))}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="stg-settings-input-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <select
                    className="stg-select"
                    style={{ width: 154 }}
                    value={prefs.todoIntervalMinutes}
                    onChange={e => handleUpdateTodos([...prefs.todos], Number(e.target.value))}
                  >
                    <option value={60}>每 60 分钟自动轮播</option>
                    <option value={30}>每 30 分钟自动轮播</option>
                    <option value={15}>每 15 分钟自动轮播</option>
                    <option value={120}>每 120 分钟自动轮播</option>
                    <option value={0}>仅手动切换</option>
                  </select>

                  <button
                    type="button"
                    className="stg-btn"
                    disabled={!prefs.showCat}
                    title={prefs.showCat ? '弹出面前全息待办屏幕' : '请先在「表格与挂件」开启键盘小猫'}
                    onClick={() => {
                      setSettingsOpen(false)
                      setBubblePreviewSignal(s => s + 1)
                      setActiveRowNumber(null)
                      setTodoStageOpen(true)
                    }}
                  >
                    弹出全息屏幕
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right-Edge 3D Stage Manager Rail */}
      <div className="stg-rail-wrap">
        {snapshot && (!snapshot.exists || snapshot.rows.length === 0) && (
          <div className="stg-empty-card" data-interactive="true">
            <div>{snapshot.error ?? `工作表 "${snapshot.activeSheet ?? ''}" 暂无事件单数据`}</div>
            <div className="stg-banner-actions">
              {!snapshot.exists && (
                <button
                  type="button"
                  className="stg-btn"
                  data-primary="true"
                  onClick={() => void handleCreateSample()}
                >
                  生成示例 Excel
                </button>
              )}
              <button
                type="button"
                className="stg-btn"
                onClick={() => setSettingsOpen(true)}
              >
                打开设置
              </button>
            </div>
          </div>
        )}

        {(snapshot?.rows ?? []).map((row, idx) => {
          const isActive = activeRowNumber === row.rowNumber
          const isHovered = hoveredRow === row.rowNumber
          const tone = getStatusTone(row)
          const rowHasDirty = row.cells.some((cellVal, colOffset) => {
            const k = cellKey(row.rowNumber, colOffset + 2)
            return Object.hasOwn(drafts, k) && drafts[k] !== cellVal
          })
          const previewText = row.cells.find(c => c.trim() !== '') ?? '（点击展开编辑详情）'

          return (
            <div
              key={row.rowNumber}
              className="stg-mini-card"
              data-interactive="true"
              data-active={isActive ? 'true' : undefined}
              data-hovered={isHovered ? 'true' : undefined}
              onMouseEnter={() => handleRailMouseEnter(row.rowNumber)}
              onMouseLeave={() => handleRailMouseLeave(row.rowNumber)}
              onClick={() => handleSelectStage(row.rowNumber)}
              title={isHovered ? undefined : `${row.idText}\n${previewText}`}
            >
              <span
                className="stg-corner-badge"
                data-tone={rowHasDirty ? 'accent' : tone}
              >
                {idx + 1}
              </span>

              <div className="stg-mini-top">
                <span className="stg-mini-id">
                  {isHovered || isActive ? row.idText : shortenTicketId(row.idText)}
                </span>
                {row.hyperlink && (
                  <span className="stg-mini-link" title="包含超链接">
                    <ExternalLinkIcon />
                  </span>
                )}
              </div>

              <div className="stg-mini-preview">{previewText}</div>
            </div>
          )
        })}
      </div>

      {/* Foreground "On Stage" Incident Ticket Editing Card */}
      {activeRow && (
        <div
          key={activeRow.rowNumber}
          className="stg-stage-card"
          data-interactive="true"
          data-resizing={resizing ? 'true' : undefined}
        >
          <div
            className="stg-resize-handle"
            title="左右拖拽调整卡片宽度"
            onPointerDown={handleStartResize}
          />

          <div className="stg-stage-head">
            <span
              className="stg-dot"
              data-tone={
                activeRow.cells.some((c, i) => {
                  const k = cellKey(activeRow.rowNumber, i + 2)
                  return Object.hasOwn(drafts, k) && drafts[k] !== c
                })
                  ? 'accent'
                  : getStatusTone(activeRow)
              }
            />
            <span className="stg-stage-id" title={activeRow.idText}>
              {activeRow.idText}
            </span>
            <button
              type="button"
              className="stg-open-link"
              disabled={!activeRow.hyperlink}
              title={activeRow.hyperlink ?? '该事件单未配置超链接'}
              onClick={e => handleOpenHyperlink(e, activeRow.hyperlink)}
            >
              <ExternalLinkIcon />
              <span>打开</span>
            </button>
            <button
              type="button"
              className="stg-icon-btn"
              title="关闭当前前台卡片"
              onClick={() => {
                if (document.activeElement instanceof HTMLTextAreaElement) {
                  document.activeElement.blur()
                }
                setActiveRowNumber(null)
              }}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="stg-stage-form">
            {activeRow.cells.map((cellValue, colOffset) => {
              const colIndex = colOffset + 2
              const key = cellKey(activeRow.rowNumber, colIndex)
              const headerName = snapshot?.headers[colIndex - 1] ?? `列 ${colIndex}`
              const value = Object.hasOwn(drafts, key) ? drafts[key] : cellValue
              const status = fieldStatus[key]
              const errText = fieldErrors[key]
              const flash = status === 'saved' || status === 'error' ? status : undefined

              return (
                <div key={key} className="stg-field">
                  <div className="stg-field-head">
                    <span className="stg-field-label" title={headerName}>
                      {headerName}
                    </span>
                    {status === 'saving' && (
                      <span className="stg-field-state" data-state="saving">保存中...</span>
                    )}
                    {status === 'saved' && (
                      <span className="stg-field-state" data-state="saved">已保存</span>
                    )}
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
                      void saveCell(activeRow.rowNumber, colIndex, currentVal, false)
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                        e.preventDefault()
                        void saveCell(activeRow.rowNumber, colIndex, e.currentTarget.value, false)
                      } else if (e.key === 'Escape') {
                        e.currentTarget.blur()
                        setActiveRowNumber(null)
                      }
                    }}
                  />

                  {errText && (
                    <div className="stg-field-error">
                      <span>{errText}</span>
                      <button
                        type="button"
                        className="stg-retry-link"
                        onClick={() => void saveCell(activeRow.rowNumber, colIndex, value, conflict)}
                      >
                        {conflict ? '强制覆盖' : '重试'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Foreground Holographic Todo Stage Card (pops out just like Stage Manager cards above) */}
      {prefs.showCat && todoStageOpen && (
        <HoloTodoStageCard
          todos={prefs.todos}
          todoIntervalMinutes={prefs.todoIntervalMinutes}
          selectedTodoIndex={selectedTodoIndex}
          onSelectTodoIndex={setSelectedTodoIndex}
          onUpdateTodos={handleUpdateTodos}
          onClose={() => setTodoStageOpen(false)}
        />
      )}

      {/* Stationary Bongo Cat + Holographic Stage Manager Todo Mini-Card */}
      {prefs.showCat && (
        <BongoCatWidget
          todos={prefs.todos}
          todoIntervalMinutes={prefs.todoIntervalMinutes}
          playerVisible={prefs.showPlayer}
          stageOpen={todoStageOpen}
          selectedTodoIndex={selectedTodoIndex}
          previewSignal={bubblePreviewSignal}
          onSelectTodoIndex={setSelectedTodoIndex}
          onToggleStage={handleToggleTodoStage}
        />
      )}

      {/* Water-Droplet Black-Hole Floating Music Player */}
      {prefs.showPlayer && <SiriMusicOrb />}
    </div>
  )
}
