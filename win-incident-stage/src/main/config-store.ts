import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type {
  MusicSourceMode,
  ShortcutActionType,
  ThemePreference,
  TodoItem,
  TrafficLightId,
  TrafficLightShortcut,
} from '../shared/types.ts'

export interface IncidentDrawerConfig {
  excelPath: string
  preferredSheet?: string
}

export interface StoredDesktopPrefs {
  theme: ThemePreference
  alwaysOnTop: boolean
  displayId: number | null
  hidden: boolean
  stageWidth: number
  showCat: boolean
  showPlayer: boolean
  musicSource: MusicSourceMode
  musicFolder: string
  musicWebUrl: string
  musicVolume: number
  trafficLights: TrafficLightShortcut[]
  todos: TodoItem[]
  todoIntervalMinutes: number
}

const VALID_LIGHT_IDS: readonly TrafficLightId[] = ['red', 'yellow', 'green']
const VALID_ACTION_TYPES: ReadonlySet<ShortcutActionType> = new Set([
  'hotkey',
  'url',
  'path',
  'open-excel',
  'settings',
  'todos',
  'refresh',
  'toggle-hide',
])

export const DEFAULT_TRAFFIC_LIGHTS: readonly TrafficLightShortcut[] = [
  { id: 'red', label: '区域截屏', actionType: 'hotkey', target: 'Win+Shift+S' },
  { id: 'yellow', label: '显示桌面', actionType: 'hotkey', target: 'Win+D' },
  { id: 'green', label: '剪贴板历史', actionType: 'hotkey', target: 'Win+V' },
]

function isUntouchedLegacyLights(input: unknown): boolean {
  if (!Array.isArray(input) || input.length !== 3) return false
  const [r, y, g] = input as Array<Partial<TrafficLightShortcut>>
  return (
    r?.id === 'red' && r?.actionType === 'settings' && (r?.target ?? '') === '' &&
    y?.id === 'yellow' && y?.actionType === 'todos' && (y?.target ?? '') === '' &&
    g?.id === 'green' && g?.actionType === 'url' && g?.target === 'https://cn.bing.com'
  )
}

export const DEFAULT_TODOS: readonly TodoItem[] = [
  { id: 'todo-default-1', text: '检查今日高优事件单处理进度', done: false },
  { id: 'todo-default-2', text: '下班前确认 Excel 日报已同步更新', done: false },
]

export const DEFAULT_DESKTOP_PREFS: StoredDesktopPrefs = {
  theme: 'system',
  alwaysOnTop: true,
  displayId: null,
  hidden: false,
  stageWidth: 344,
  showCat: true,
  showPlayer: true,
  musicSource: 'smtc',
  musicFolder: '',
  musicWebUrl: '',
  musicVolume: 65,
  trafficLights: DEFAULT_TRAFFIC_LIGHTS.map(item => ({ ...item })),
  todos: DEFAULT_TODOS.map(item => ({ ...item })),
  todoIntervalMinutes: 60,
}

export function sanitizeTrafficLights(input: unknown): TrafficLightShortcut[] {
  const byId = new Map<TrafficLightId, TrafficLightShortcut>()
  for (const def of DEFAULT_TRAFFIC_LIGHTS) {
    byId.set(def.id, { ...def })
  }
  if (!Array.isArray(input) || isUntouchedLegacyLights(input)) {
    return VALID_LIGHT_IDS.map(id => byId.get(id)!)
  }
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const rec = raw as Partial<TrafficLightShortcut>
    if (rec.id !== 'red' && rec.id !== 'yellow' && rec.id !== 'green') continue
    const fallback = byId.get(rec.id)!
    const actionType: ShortcutActionType =
      typeof rec.actionType === 'string' && VALID_ACTION_TYPES.has(rec.actionType as ShortcutActionType)
        ? (rec.actionType as ShortcutActionType)
        : fallback.actionType
    const label =
      typeof rec.label === 'string' && rec.label.trim() !== ''
        ? rec.label.trim().slice(0, 24)
        : fallback.label
    const target = typeof rec.target === 'string' ? rec.target.trim().slice(0, 512) : ''
    byId.set(rec.id, { id: rec.id, label, actionType, target })
  }
  return VALID_LIGHT_IDS.map(id => byId.get(id)!)
}

export function sanitizeTodos(input: unknown): TodoItem[] {
  if (!Array.isArray(input)) {
    return DEFAULT_TODOS.map(item => ({ ...item }))
  }
  const seen = new Set<string>()
  const result: TodoItem[] = []
  for (let i = 0; i < input.length && result.length < 30; i += 1) {
    const raw = input[i]
    if (!raw || typeof raw !== 'object') continue
    const rec = raw as Partial<TodoItem>
    const text = typeof rec.text === 'string' ? rec.text.trim().slice(0, 120) : ''
    if (!text) continue
    let id = typeof rec.id === 'string' && rec.id.trim() !== '' ? rec.id.trim().slice(0, 48) : `todo-${i + 1}`
    while (seen.has(id)) {
      id = `${id}-${i + 1}`
    }
    seen.add(id)
    result.push({
      id,
      text,
      done: Boolean(rec.done),
    })
  }
  return result
}

export function sanitizeMusicSource(input: unknown, fallbackFolder = ''): MusicSourceMode {
  if (input === 'smtc' || input === 'local' || input === 'web') return input
  return fallbackFolder.trim() !== '' ? 'local' : 'smtc'
}

export function sanitizeMusicVolume(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return DEFAULT_DESKTOP_PREFS.musicVolume
  }
  return Math.min(100, Math.max(0, Math.round(input)))
}

export function sanitizeMusicWebUrl(input: unknown): string {
  if (typeof input !== 'string') return ''
  const trimmed = input.trim().slice(0, 512)
  if (!trimmed) return ''
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

export function sanitizeTodoInterval(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return DEFAULT_DESKTOP_PREFS.todoIntervalMinutes
  }
  const rounded = Math.round(input)
  if (rounded <= 0) return 0
  return Math.min(240, Math.max(5, rounded))
}

export function resolveDefaultSamplePath(baseDir: string): string {
  const siblingDshSample = resolve(baseDir, '../dsh-plugin-incident-drawer/sample/incidents.xlsx')
  if (existsSync(siblingDshSample)) {
    return siblingDshSample
  }
  const siblingChromeSample = resolve(baseDir, '../chrome-incident-drawer/sample/incidents.xlsx')
  if (existsSync(siblingChromeSample)) {
    return siblingChromeSample
  }
  return resolve(baseDir, 'sample/incidents.xlsx')
}

export function resolveDshHomeDir(): string {
  return process.env.DSH_HOME || join(os.homedir(), '.dsh')
}

export function resolveConfigFilePath(): string {
  if (process.env.DSH_INCIDENT_DRAWER_CONFIG) {
    return resolve(process.env.DSH_INCIDENT_DRAWER_CONFIG)
  }
  return join(resolveDshHomeDir(), 'incident-drawer-config.json')
}

export function resolveDesktopPrefsFilePath(): string {
  if (process.env.STAGE_PREFS_PATH) {
    return resolve(process.env.STAGE_PREFS_PATH)
  }
  return join(resolveDshHomeDir(), 'win-incident-stage-prefs.json')
}

export class ConfigStore {
  private memoryFallback: IncidentDrawerConfig | null = null

  constructor(
    private readonly baseDir: string,
    private readonly configFilePath: string = resolveConfigFilePath(),
  ) {}

  /** Always read fresh from disk so DSH, Chrome, and Windows Desktop stay synchronized. */
  read(): IncidentDrawerConfig {
    try {
      if (existsSync(this.configFilePath)) {
        const raw = JSON.parse(readFileSync(this.configFilePath, 'utf8')) as Partial<IncidentDrawerConfig>
        if (typeof raw.excelPath === 'string' && raw.excelPath.trim() !== '') {
          const loaded: IncidentDrawerConfig = {
            excelPath: raw.excelPath.trim(),
            ...(typeof raw.preferredSheet === 'string' && raw.preferredSheet.trim() !== ''
              ? { preferredSheet: raw.preferredSheet.trim() }
              : {}),
          }
          this.memoryFallback = loaded
          return loaded
        }
      }
    } catch {
      // Fallback
    }
    if (this.memoryFallback !== null) {
      return { ...this.memoryFallback }
    }
    const fallback: IncidentDrawerConfig = {
      excelPath: resolveDefaultSamplePath(this.baseDir),
    }
    this.memoryFallback = fallback
    return { ...fallback }
  }

  write(next: IncidentDrawerConfig): { persisted: boolean; config: IncidentDrawerConfig } {
    const clean: IncidentDrawerConfig = {
      excelPath: resolve(next.excelPath.trim()),
      ...(next.preferredSheet && next.preferredSheet.trim() !== ''
        ? { preferredSheet: next.preferredSheet.trim() }
        : {}),
    }
    this.memoryFallback = clean
    try {
      mkdirSync(dirname(this.configFilePath), { recursive: true })
      writeFileSync(this.configFilePath, JSON.stringify(clean, null, 2) + '\n', 'utf8')
      return { persisted: true, config: { ...clean } }
    } catch {
      return { persisted: false, config: { ...clean } }
    }
  }
}

export class DesktopPrefsStore {
  constructor(private readonly prefsFilePath: string = resolveDesktopPrefsFilePath()) {}

  read(): StoredDesktopPrefs {
    try {
      if (existsSync(this.prefsFilePath)) {
        const raw = JSON.parse(readFileSync(this.prefsFilePath, 'utf8')) as Partial<StoredDesktopPrefs>
        return {
          theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system',
          alwaysOnTop: typeof raw.alwaysOnTop === 'boolean' ? raw.alwaysOnTop : DEFAULT_DESKTOP_PREFS.alwaysOnTop,
          displayId: typeof raw.displayId === 'number' ? raw.displayId : null,
          hidden: typeof raw.hidden === 'boolean' ? raw.hidden : false,
          stageWidth:
            typeof raw.stageWidth === 'number' && raw.stageWidth >= 300 && raw.stageWidth <= 540
              ? raw.stageWidth
              : DEFAULT_DESKTOP_PREFS.stageWidth,
          showCat: typeof raw.showCat === 'boolean' ? raw.showCat : DEFAULT_DESKTOP_PREFS.showCat,
          showPlayer: typeof raw.showPlayer === 'boolean' ? raw.showPlayer : DEFAULT_DESKTOP_PREFS.showPlayer,
          musicFolder: typeof raw.musicFolder === 'string' ? raw.musicFolder.trim().slice(0, 512) : '',
          musicSource: sanitizeMusicSource(
            raw.musicSource,
            typeof raw.musicFolder === 'string' ? raw.musicFolder : '',
          ),
          musicWebUrl: sanitizeMusicWebUrl(raw.musicWebUrl),
          musicVolume: sanitizeMusicVolume(raw.musicVolume),
          trafficLights: sanitizeTrafficLights(raw.trafficLights),
          todos: sanitizeTodos(raw.todos),
          todoIntervalMinutes: sanitizeTodoInterval(raw.todoIntervalMinutes),
        }
      }
    } catch {
      // Fallback
    }
    return {
      ...DEFAULT_DESKTOP_PREFS,
      trafficLights: DEFAULT_TRAFFIC_LIGHTS.map(item => ({ ...item })),
      todos: DEFAULT_TODOS.map(item => ({ ...item })),
    }
  }

  write(next: StoredDesktopPrefs): void {
    try {
      mkdirSync(dirname(this.prefsFilePath), { recursive: true })
      writeFileSync(this.prefsFilePath, JSON.stringify(next, null, 2) + '\n', 'utf8')
    } catch {
      // Ignore write failures
    }
  }
}
