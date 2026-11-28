import { contextBridge, ipcRenderer } from 'electron'
import type {
  DesktopPreferences,
  DrawerSnapshot,
  InputActivityEvent,
  LocalMusicLibrary,
  MediaState,
  StageApi,
} from '../shared/types.ts'

const api: StageApi = {
  invoke<T>(endpoint: string, payload?: unknown): Promise<T> {
    return ipcRenderer.invoke('stage:api', endpoint, payload) as Promise<T>
  },

  setInteractive(interactive: boolean): void {
    ipcRenderer.send('stage:set-interactive', Boolean(interactive))
  },

  openExternal(url: string): Promise<boolean> {
    return ipcRenderer.invoke('stage:open-external', url) as Promise<boolean>
  },

  openPath(target: string): Promise<boolean> {
    return ipcRenderer.invoke('stage:open-path', target) as Promise<boolean>
  },

  triggerHotkey(combo: string): Promise<boolean> {
    return ipcRenderer.invoke('stage:trigger-hotkey', combo) as Promise<boolean>
  },

  openBoundExcel(): Promise<boolean> {
    return ipcRenderer.invoke('stage:open-bound-excel') as Promise<boolean>
  },

  pickExcelFile(): Promise<DrawerSnapshot | null> {
    return ipcRenderer.invoke('stage:pick-excel') as Promise<DrawerSnapshot | null>
  },

  pickAnyFile(): Promise<string | null> {
    return ipcRenderer.invoke('stage:pick-any-file') as Promise<string | null>
  },

  getPrefs(): Promise<DesktopPreferences> {
    return ipcRenderer.invoke('stage:get-prefs') as Promise<DesktopPreferences>
  },

  updatePrefs(patch: Partial<Omit<DesktopPreferences, 'resolvedTheme'>>): Promise<DesktopPreferences> {
    return ipcRenderer.invoke('stage:update-prefs', patch) as Promise<DesktopPreferences>
  },

  onWindowBlur(cb: () => void): () => void {
    const handler = () => cb()
    ipcRenderer.on('stage:window-blur', handler)
    return () => ipcRenderer.removeListener('stage:window-blur', handler)
  },

  onPrefsChanged(cb: (prefs: DesktopPreferences) => void): () => void {
    const handler = (_event: unknown, prefs: DesktopPreferences) => cb(prefs)
    ipcRenderer.on('stage:prefs-changed', handler)
    return () => ipcRenderer.removeListener('stage:prefs-changed', handler)
  },

  onTriggerRefresh(cb: () => void): () => void {
    const handler = () => cb()
    ipcRenderer.on('stage:trigger-refresh', handler)
    return () => ipcRenderer.removeListener('stage:trigger-refresh', handler)
  },

  onInputActivity(cb: (evt: InputActivityEvent) => void): () => void {
    const handler = (_event: unknown, evt: InputActivityEvent) => cb(evt)
    ipcRenderer.on('stage:input-activity', handler)
    return () => ipcRenderer.removeListener('stage:input-activity', handler)
  },

  getMediaState(): Promise<MediaState> {
    return ipcRenderer.invoke('stage:get-media-state') as Promise<MediaState>
  },

  onMediaState(cb: (state: MediaState) => void): () => void {
    const handler = (_event: unknown, state: MediaState) => cb(state)
    ipcRenderer.on('stage:media-state', handler)
    return () => ipcRenderer.removeListener('stage:media-state', handler)
  },

  mediaControl(action: 'prev' | 'next' | 'toggle'): Promise<boolean> {
    return ipcRenderer.invoke('stage:media-control', action) as Promise<boolean>
  },

  getLocalMusic(): Promise<LocalMusicLibrary> {
    return ipcRenderer.invoke('stage:get-local-music') as Promise<LocalMusicLibrary>
  },

  onLocalMusicChanged(cb: (lib: LocalMusicLibrary) => void): () => void {
    const handler = (_event: unknown, lib: LocalMusicLibrary) => cb(lib)
    ipcRenderer.on('stage:local-music-changed', handler)
    return () => ipcRenderer.removeListener('stage:local-music-changed', handler)
  },

  pickMusicFolder(): Promise<LocalMusicLibrary | null> {
    return ipcRenderer.invoke('stage:pick-music-folder') as Promise<LocalMusicLibrary | null>
  },

  openMusicFolder(): Promise<boolean> {
    return ipcRenderer.invoke('stage:open-music-folder') as Promise<boolean>
  },

  showMusicContextMenu(): Promise<void> {
    return ipcRenderer.invoke('stage:music-context-menu') as Promise<void>
  },

  adjustSystemVolume(direction: 'up' | 'down', steps?: number): Promise<boolean> {
    return ipcRenderer.invoke('stage:adjust-system-volume', direction, steps) as Promise<boolean>
  },

  setMusicVolume(volume: number): Promise<number> {
    return ipcRenderer.invoke('stage:set-music-volume', volume) as Promise<number>
  },

  getWebMusicState(): Promise<MediaState> {
    return ipcRenderer.invoke('stage:get-web-music-state') as Promise<MediaState>
  },

  onWebMusicState(cb: (state: MediaState) => void): () => void {
    const handler = (_event: unknown, state: MediaState) => cb(state)
    ipcRenderer.on('stage:web-music-state', handler)
    return () => ipcRenderer.removeListener('stage:web-music-state', handler)
  },

  webMusicControl(action: 'prev' | 'next' | 'toggle'): Promise<boolean> {
    return ipcRenderer.invoke('stage:web-music-control', action) as Promise<boolean>
  },

  openWebMusicWindow(url?: string): Promise<boolean> {
    return ipcRenderer.invoke('stage:open-web-music', url) as Promise<boolean>
  },

  hideWebMusicWindow(): Promise<void> {
    return ipcRenderer.invoke('stage:hide-web-music') as Promise<void>
  },

  clearWebMusicSession(): Promise<boolean> {
    return ipcRenderer.invoke('stage:clear-web-music-session') as Promise<boolean>
  },
}

contextBridge.exposeInMainWorld('stageApi', api)
