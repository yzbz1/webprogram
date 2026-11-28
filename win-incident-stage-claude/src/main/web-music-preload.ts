import { contextBridge, ipcRenderer } from 'electron'

export interface WebMusicStartApi {
  getHomeUrl(): Promise<string>
  openUrl(rawUrl: string): Promise<{ ok: boolean; error?: string }>
  clearSession(): Promise<boolean>
}

// Restrict bridge strictly to the bundled local start page; remote http/https sites receive zero Electron APIs.
if (window.location.protocol === 'file:') {
  const api: WebMusicStartApi = {
    getHomeUrl(): Promise<string> {
      return ipcRenderer.invoke('stage:web-music-start-get-url') as Promise<string>
    },
    openUrl(rawUrl: string): Promise<{ ok: boolean; error?: string }> {
      return ipcRenderer.invoke('stage:web-music-start-open-url', rawUrl) as Promise<{
        ok: boolean
        error?: string
      }>
    },
    clearSession(): Promise<boolean> {
      return ipcRenderer.invoke('stage:clear-web-music-session') as Promise<boolean>
    },
  }
  contextBridge.exposeInMainWorld('stageWebMusicSetup', api)
}
