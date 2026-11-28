/** Shared IPC, Excel snapshot, widget, local music, and desktop Stage Manager preference types. */

export interface IncidentRow {
  readonly rowNumber: number
  readonly idText: string
  readonly hyperlink: string | null
  readonly cells: readonly string[]
}

export interface DrawerSnapshot {
  readonly excelPath: string
  readonly exists: boolean
  readonly sheets: readonly string[]
  readonly activeSheet: string | null
  readonly todaySheetName: string
  readonly matchedToday: boolean
  readonly headers: readonly string[]
  readonly rows: readonly IncidentRow[]
  readonly version: string | null
  readonly totalDataRows: number
  readonly categoryOptions?: Readonly<Record<string, readonly string[]>>
  readonly error?: string
}

export interface StatusCheckResult {
  readonly exists: boolean
  readonly stale: boolean
  readonly currentVersion: string | null
  readonly sheets?: readonly string[]
  readonly error?: string
}

export interface CellEdit {
  readonly rowNumber: number
  readonly colIndex: number
  readonly value: string
}

export interface SaveResult {
  readonly saved: boolean
  readonly version: string | null
  readonly conflict?: boolean
  readonly currentVersion?: string | null
  readonly locked?: boolean
  readonly error?: string
}

export interface LoadRequest {
  readonly sheetName?: string
}

export interface StatusCheckRequest {
  readonly knownVersion: string | null
}

export interface SaveCellRequest {
  readonly sheetName: string
  readonly rowNumber: number
  readonly colIndex: number
  readonly value: string
  readonly expectedVersion: string | null
  readonly forceOverwrite?: boolean
}

export interface SaveBatchRequest {
  readonly sheetName: string
  readonly edits: readonly CellEdit[]
  readonly expectedVersion: string | null
  readonly forceOverwrite?: boolean
}

export interface SetConfigRequest {
  readonly excelPath: string
  readonly preferredSheet?: string
}

export interface CreateSampleRequest {
  readonly excelPath?: string
}

export type ThemePreference = 'system' | 'light' | 'dark'

export type ShortcutActionType =
  | 'hotkey'
  | 'url'
  | 'path'
  | 'open-excel'
  | 'settings'
  | 'todos'
  | 'refresh'
  | 'toggle-hide'

export type TrafficLightId = 'red' | 'yellow' | 'green'

export interface TrafficLightShortcut {
  readonly id: TrafficLightId
  readonly label: string
  readonly actionType: ShortcutActionType
  readonly target: string
}

export interface TodoItem {
  readonly id: string
  readonly text: string
  readonly done: boolean
}

export type InputActivityEvent =
  | { readonly type: 'key'; readonly hand: 'left' | 'right' | 'both' }
  | { readonly type: 'mouse'; readonly nx: number; readonly ny: number }

export type MediaPlaybackStatus = 'playing' | 'paused' | 'idle'
export type MusicSourceMode = 'smtc' | 'local' | 'web'

export interface MediaState {
  readonly available: boolean
  readonly hasSession: boolean
  readonly title: string
  readonly artist: string
  readonly status: MediaPlaybackStatus
  readonly thumbnailDataUrl: string | null
}

export interface LocalTrackInfo {
  readonly index: number
  readonly fileName: string
  readonly title: string
  readonly artist: string
  readonly streamUrl: string
  readonly coverDataUrl: string | null
}

export interface LocalMusicLibrary {
  readonly folderPath: string
  readonly tracks: readonly LocalTrackInfo[]
}

export interface DesktopPreferences {
  readonly theme: ThemePreference
  readonly resolvedTheme: 'light' | 'dark'
  readonly alwaysOnTop: boolean
  readonly displayId: number | null
  readonly hidden: boolean
  readonly stageWidth: number
  readonly showCat: boolean
  readonly showPlayer: boolean
  readonly musicSource: MusicSourceMode
  readonly musicFolder: string
  readonly musicWebUrl: string
  readonly musicVolume: number
  readonly trafficLights: readonly TrafficLightShortcut[]
  readonly todos: readonly TodoItem[]
  readonly todoIntervalMinutes: number
}

export interface StageApi {
  invoke<T>(endpoint: string, payload?: unknown): Promise<T>
  setInteractive(interactive: boolean): void
  openExternal(url: string): Promise<boolean>
  openPath(target: string): Promise<boolean>
  triggerHotkey(combo: string): Promise<boolean>
  openBoundExcel(): Promise<boolean>
  pickExcelFile(): Promise<DrawerSnapshot | null>
  pickAnyFile(): Promise<string | null>
  getPrefs(): Promise<DesktopPreferences>
  updatePrefs(patch: Partial<Omit<DesktopPreferences, 'resolvedTheme'>>): Promise<DesktopPreferences>
  onWindowBlur(cb: () => void): () => void
  onPrefsChanged(cb: (prefs: DesktopPreferences) => void): () => void
  onTriggerRefresh(cb: () => void): () => void
  onInputActivity(cb: (evt: InputActivityEvent) => void): () => void
  getMediaState(): Promise<MediaState>
  onMediaState(cb: (state: MediaState) => void): () => void
  mediaControl(action: 'prev' | 'next' | 'toggle'): Promise<boolean>
  getLocalMusic(): Promise<LocalMusicLibrary>
  onLocalMusicChanged(cb: (lib: LocalMusicLibrary) => void): () => void
  pickMusicFolder(): Promise<LocalMusicLibrary | null>
  openMusicFolder(): Promise<boolean>
  showMusicContextMenu(): Promise<void>
  adjustSystemVolume(direction: 'up' | 'down', steps?: number): Promise<boolean>
  setMusicVolume(volume: number): Promise<number>
  getWebMusicState(): Promise<MediaState>
  onWebMusicState(cb: (state: MediaState) => void): () => void
  webMusicControl(action: 'prev' | 'next' | 'toggle'): Promise<boolean>
  openWebMusicWindow(url?: string): Promise<boolean>
  hideWebMusicWindow(): Promise<void>
  clearWebMusicSession(): Promise<boolean>
}

declare global {
  interface Window {
    stageApi: StageApi
  }
}
