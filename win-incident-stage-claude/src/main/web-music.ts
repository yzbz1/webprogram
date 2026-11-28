import { app, BrowserWindow, Menu, session } from 'electron'
import { join } from 'node:path'
import type { MediaState } from '../shared/types.ts'
import { sanitizeMusicWebUrl } from './config-store.ts'

export const WEB_MUSIC_PARTITION = 'persist:stage-web-music'

const EMPTY_WEB_MEDIA: MediaState = {
  available: true,
  hasSession: false,
  title: '',
  artist: '',
  status: 'idle',
  thumbnailDataUrl: null,
}

interface RawWebMediaSnapshot {
  hasSession: boolean
  title: string
  artist: string
  playing: boolean
  artworkUrl: string
}

export interface WebMusicCallbacks {
  getHomeUrl: () => string
  getVolume: () => number
  onHomeUrlChange: (url: string, switchToWebMode?: boolean) => void
  onStateChange: (state: MediaState) => void
}

const BRIDGE_BOOTSTRAP_SCRIPT = `(() => {
  if (window.__stageWebMusicBridge) return true;
  const handlers = new Map();
  let targetVol = 0.65;

  try {
    const ms = navigator.mediaSession;
    if (ms && typeof ms.setActionHandler === 'function') {
      const orig = ms.setActionHandler.bind(ms);
      ms.setActionHandler = function (action, handler) {
        if (typeof handler === 'function') handlers.set(action, handler);
        else handlers.delete(action);
        return orig(action, handler);
      };
    }
  } catch {}

  function collectMediaElements(root, acc) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    try {
      const list = root.querySelectorAll('audio, video');
      for (let i = 0; i < list.length; i += 1) acc.push(list[i]);
      const all = root.querySelectorAll('*');
      for (let i = 0; i < all.length; i += 1) {
        const sr = all[i].shadowRoot;
        if (sr) collectMediaElements(sr, acc);
      }
    } catch {}
  }

  function getAllMedia() {
    const acc = [];
    collectMediaElements(document, acc);
    try {
      for (let i = 0; i < window.frames.length; i += 1) {
        try {
          if (window.frames[i] && window.frames[i].document) {
            collectMediaElements(window.frames[i].document, acc);
          }
        } catch {}
      }
    } catch {}
    return acc;
  }

  function enforceVolume(v) {
    targetVol = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.65));
    const list = getAllMedia();
    for (const el of list) {
      try {
        if (Math.abs(el.volume - targetVol) > 0.01) {
          el.volume = targetVol;
        }
        el.muted = targetVol === 0;
      } catch {}
    }
  }

  const onMediaEvent = (e) => {
    const t = e && e.target;
    if (t && (t.tagName === 'AUDIO' || t.tagName === 'VIDEO')) {
      try {
        if (Math.abs(t.volume - targetVol) > 0.01) t.volume = targetVol;
        t.muted = targetVol === 0;
      } catch {}
    }
  };
  document.addEventListener('play', onMediaEvent, true);
  document.addEventListener('loadedmetadata', onMediaEvent, true);

  function clickBySelectors(selectors) {
    const roots = [document];
    try {
      for (let i = 0; i < window.frames.length; i += 1) {
        try {
          if (window.frames[i] && window.frames[i].document) roots.push(window.frames[i].document);
        } catch {}
      }
    } catch {}
    for (const root of roots) {
      for (const sel of selectors) {
        try {
          const btns = root.querySelectorAll(sel);
          for (const btn of btns) {
            if (!btn || btn.disabled) continue;
            const rect = typeof btn.getBoundingClientRect === 'function' ? btn.getBoundingClientRect() : null;
            if (rect && rect.width === 0 && rect.height === 0) continue;
            btn.click();
            return true;
          }
        } catch {}
      }
    }
    return false;
  }

  function readArtworkFromPage() {
    const og = document.querySelector('meta[property="og:image"], meta[name="og:image"]');
    if (og) {
      const content = og.getAttribute('content') || '';
      if (content) return content;
    }
    const imgs = document.querySelectorAll('img');
    for (const img of imgs) {
      try {
        const cls = (img.className || '') + ' ' + (img.alt || '');
        if (/cover|album|artwork|poster|封面/i.test(cls) && img.currentSrc) {
          return img.currentSrc;
        }
      } catch {}
    }
    return '';
  }

  window.__stageWebMusicBridge = {
    setVolume(v01) {
      enforceVolume(v01);
      return true;
    },
    getSnapshot() {
      const media = getAllMedia();
      const anyPlaying = media.some((el) => !el.paused && !el.ended);
      let msTitle = '';
      let msArtist = '';
      let msArtwork = '';
      let msState = 'none';
      try {
        const ms = navigator.mediaSession;
        if (ms) {
          msState = ms.playbackState || 'none';
          const md = ms.metadata;
          if (md) {
            msTitle = md.title || '';
            msArtist = md.artist || md.album || '';
            if (Array.isArray(md.artwork) && md.artwork.length > 0) {
              const best = md.artwork[md.artwork.length - 1];
              if (best && best.src) msArtwork = best.src;
            }
          }
        }
      } catch {}

      const cleanDocTitle = (document.title || '')
        .replace(/\s*[-–|·]\s*(网易云音乐|QQ音乐|酷狗音乐|酷我音乐|Spotify|YouTube Music).*$/i, '')
        .trim();

      const artworkUrl = msArtwork || readArtworkFromPage();
      const playing = anyPlaying || msState === 'playing';
      const hasSession =
        media.length > 0 ||
        msTitle !== '' ||
        msState === 'playing' ||
        msState === 'paused' ||
        handlers.size > 0;

      return {
        hasSession,
        title: msTitle || cleanDocTitle,
        artist: msArtist,
        playing,
        artworkUrl,
      };
    },
    control(action) {
      const media = getAllMedia();
      const isCurrentlyPlaying =
        media.some((el) => !el.paused && !el.ended) ||
        (navigator.mediaSession && navigator.mediaSession.playbackState === 'playing');

      if (action === 'toggle') {
        const fn = handlers.get(isCurrentlyPlaying ? 'pause' : 'play');
        if (typeof fn === 'function') {
          try { fn(); return true; } catch {}
        }
        const primary = media.find((el) => !el.paused) || media.find((el) => Boolean(el.currentSrc || el.src));
        if (primary) {
          try {
            if (primary.paused) void primary.play();
            else primary.pause();
            return true;
          } catch {}
        }
        return clickBySelectors([
          '[aria-label*="暂停" i]',
          '[aria-label*="Pause" i]',
          '[aria-label*="播放" i]',
          '[aria-label*="Play" i]',
          '[title*="暂停" i]',
          '[title*="播放" i]',
          '[title*="Play" i]',
          '[title*="Pause" i]',
          'button[class*="play" i]',
          '.play-btn',
          '.btn-play',
        ]);
      }

      if (action === 'prev') {
        const fn = handlers.get('previoustrack');
        if (typeof fn === 'function') {
          try { fn(); return true; } catch {}
        }
        return clickBySelectors([
          '[aria-label*="上一" i]',
          '[aria-label*="Previous" i]',
          '[title*="上一" i]',
          '[title*="Previous" i]',
          'button[class*="prev" i]',
          '.prev-btn',
        ]);
      }

      if (action === 'next') {
        const fn = handlers.get('nexttrack');
        if (typeof fn === 'function') {
          try { fn(); return true; } catch {}
        }
        return clickBySelectors([
          '[aria-label*="下一" i]',
          '[aria-label*="Next" i]',
          '[title*="下一" i]',
          '[title*="Next" i]',
          'button[class*="next" i]',
          '.next-btn',
        ]);
      }

      return false;
    },
  };
  return true;
})();`

function getCleanChromeUserAgent(): string {
  return app.userAgentFallback.replace(/\sElectron\/[^\s]+/g, '')
}

function isRemoteHttpUrl(rawUrl: string): boolean {
  return /^https?:\/\//i.test(rawUrl)
}

export class WebMusicManager {
  private win: BrowserWindow | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private pollInFlight = false
  private quitting = false
  private state: MediaState = { ...EMPTY_WEB_MEDIA }
  private artworkCache = new Map<string, string>()

  constructor(
    private readonly appRoot: string,
    private readonly callbacks: WebMusicCallbacks,
  ) {}

  getState(): MediaState {
    return this.state
  }

  setQuitting(): void {
    this.quitting = true
  }

  private emitState(next: MediaState): void {
    const changed =
      next.hasSession !== this.state.hasSession ||
      next.title !== this.state.title ||
      next.artist !== this.state.artist ||
      next.status !== this.state.status ||
      next.thumbnailDataUrl !== this.state.thumbnailDataUrl
    this.state = next
    if (changed) {
      this.callbacks.onStateChange(next)
    }
  }

  private startPageUrl(): string {
    return join(this.appRoot, 'dist-app', 'web-music-start.html')
  }

  private createWindow(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) {
      return this.win
    }

    const cleanUa = getCleanChromeUserAgent()
    const win = new BrowserWindow({
      width: 1040,
      height: 700,
      minWidth: 720,
      minHeight: 500,
      title: '网页音乐播放器（关闭窗口将继续在后台球体播放）',
      icon: join(this.appRoot, 'assets', 'app-icon.png'),
      backgroundColor: '#0f172a',
      show: false,
      webPreferences: {
        partition: WEB_MUSIC_PARTITION,
        preload: join(this.appRoot, 'dist-app', 'web-music-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false,
      },
    })

    win.webContents.userAgent = cleanUa

    // Allow OAuth/QR login popups inside the same persistent session partition
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (isRemoteHttpUrl(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 920,
            height: 680,
            autoHideMenuBar: true,
            backgroundColor: '#ffffff',
            webPreferences: {
              partition: WEB_MUSIC_PARTITION,
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          },
        }
      }
      return { action: 'deny' }
    })

    win.webContents.on('did-create-window', (childWin) => {
      childWin.webContents.userAgent = cleanUa
    })

    win.webContents.on('did-finish-load', () => {
      void this.injectBridgeAndVolume()
      void this.refreshStateNow()
    })

    win.webContents.on('did-navigate-in-page', () => {
      void this.refreshStateNow()
    })

    win.webContents.on('media-started-playing', () => {
      void this.applyVolumeToWindow()
      void this.refreshStateNow()
    })

    win.webContents.on('media-paused', () => {
      void this.refreshStateNow()
    })

    win.webContents.on('page-title-updated', () => {
      void this.refreshStateNow()
    })

    // Closing the window hides it so playback & login session continue seamlessly in the orb
    win.on('close', (e) => {
      if (this.quitting) return
      e.preventDefault()
      win.hide()
    })

    win.on('closed', () => {
      if (this.win === win) {
        this.win = null
      }
      this.stopPolling()
      this.emitState({ ...EMPTY_WEB_MEDIA })
    })

    this.buildWindowMenu(win)
    this.win = win
    this.startPolling()
    return win
  }

  private buildWindowMenu(win: BrowserWindow): void {
    const menu = Menu.buildFromTemplate([
      {
        label: '← 后退',
        click: () => {
          if (win.webContents.navigationHistory.canGoBack()) {
            win.webContents.navigationHistory.goBack()
          }
        },
      },
      {
        label: '→ 前进',
        click: () => {
          if (win.webContents.navigationHistory.canGoForward()) {
            win.webContents.navigationHistory.goForward()
          }
        },
      },
      {
        label: '⟳ 刷新',
        click: () => {
          win.webContents.reload()
        },
      },
      {
        label: '🏠 音乐主页',
        click: () => {
          const home = sanitizeMusicWebUrl(this.callbacks.getHomeUrl())
          if (home) {
            void win.loadURL(home, { userAgent: getCleanChromeUserAgent() })
          } else {
            void win.loadFile(this.startPageUrl())
          }
        },
      },
      {
        label: '🔗 更换网址',
        click: () => {
          void win.loadFile(this.startPageUrl())
        },
      },
      {
        label: '📌 设当前页为主页',
        click: () => {
          const current = sanitizeMusicWebUrl(win.webContents.getURL())
          if (current) {
            this.callbacks.onHomeUrlChange(current, true)
          }
        },
      },
      {
        label: '📥 隐藏到球体后台播放',
        click: () => {
          win.hide()
        },
      },
      {
        label: '🧹 清除登录缓存',
        click: () => {
          void this.clearSession().then(() => {
            if (!win.isDestroyed()) {
              win.webContents.reload()
            }
          })
        },
      },
    ])
    win.setMenu(menu)
  }

  async openWindow(explicitUrl?: string, forceStartPage = false): Promise<boolean> {
    const win = this.createWindow()
    const normalizedExplicit = sanitizeMusicWebUrl(explicitUrl)
    const homeUrl = sanitizeMusicWebUrl(this.callbacks.getHomeUrl())

    if (forceStartPage) {
      await win.loadFile(this.startPageUrl())
    } else if (normalizedExplicit) {
      this.callbacks.onHomeUrlChange(normalizedExplicit, true)
      await win.loadURL(normalizedExplicit, { userAgent: getCleanChromeUserAgent() })
    } else {
      const current = win.webContents.getURL()
      if (!current) {
        if (homeUrl) {
          await win.loadURL(homeUrl, { userAgent: getCleanChromeUserAgent() })
        } else {
          await win.loadFile(this.startPageUrl())
        }
      }
    }

    if (!win.isDestroyed()) {
      win.show()
      win.focus()
    }
    return true
  }

  async openStartPage(): Promise<boolean> {
    return this.openWindow(undefined, true)
  }

  hideWindow(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.hide()
    }
  }

  async setVolume(volume0to100: number): Promise<void> {
    if (!this.win || this.win.isDestroyed()) return
    const v01 = Math.max(0, Math.min(1, volume0to100 / 100))
    const url = this.win.webContents.getURL()
    if (!isRemoteHttpUrl(url)) return
    try {
      await this.win.webContents.executeJavaScript(
        `if (!window.__stageWebMusicBridge) { ${BRIDGE_BOOTSTRAP_SCRIPT} } window.__stageWebMusicBridge && window.__stageWebMusicBridge.setVolume(${v01});`,
      )
    } catch {
      // Ignore during navigation
    }
  }

  async control(action: 'prev' | 'next' | 'toggle'): Promise<boolean> {
    if (!this.win || this.win.isDestroyed()) {
      const homeUrl = sanitizeMusicWebUrl(this.callbacks.getHomeUrl())
      await this.openWindow(homeUrl || undefined, !homeUrl)
      return true
    }

    const url = this.win.webContents.getURL()
    if (!isRemoteHttpUrl(url)) {
      await this.openWindow(undefined, true)
      return false
    }

    try {
      const handled = (await this.win.webContents.executeJavaScript(
        `if (!window.__stageWebMusicBridge) { ${BRIDGE_BOOTSTRAP_SCRIPT} } window.__stageWebMusicBridge ? window.__stageWebMusicBridge.control(${JSON.stringify(action)}) : false;`,
      )) as boolean
      setTimeout(() => {
        void this.refreshStateNow()
      }, 220)
      return Boolean(handled)
    } catch {
      return false
    }
  }

  async clearSession(): Promise<boolean> {
    this.artworkCache.clear()
    try {
      const s = session.fromPartition(WEB_MUSIC_PARTITION)
      await s.clearStorageData()
      await s.clearCache()
      return true
    } catch {
      return false
    }
  }

  destroy(): void {
    this.stopPolling()
    const w = this.win
    this.win = null
    if (w && !w.isDestroyed()) {
      w.destroy()
    }
    this.emitState({ ...EMPTY_WEB_MEDIA })
  }

  private async applyVolumeToWindow(): Promise<void> {
    await this.setVolume(this.callbacks.getVolume())
  }

  private async injectBridgeAndVolume(): Promise<void> {
    if (!this.win || this.win.isDestroyed()) return
    const url = this.win.webContents.getURL()
    if (!isRemoteHttpUrl(url)) return
    try {
      await this.win.webContents.executeJavaScript(BRIDGE_BOOTSTRAP_SCRIPT)
      await this.applyVolumeToWindow()
    } catch {
      // Ignore navigation race
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => {
      void this.refreshStateNow()
    }, 1000)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async resolveArtworkDataUrl(artworkUrl: string): Promise<string | null> {
    if (!artworkUrl) return null
    if (artworkUrl.startsWith('data:image/')) return artworkUrl
    const cached = this.artworkCache.get(artworkUrl)
    if (cached) return cached
    if (!isRemoteHttpUrl(artworkUrl) || !this.win || this.win.isDestroyed()) return null

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await this.win.webContents.session.fetch(artworkUrl, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timer))

      if (!res.ok) return null
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      if (!contentType.startsWith('image/')) return null
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.byteLength === 0 || buf.byteLength > 2 * 1024 * 1024) return null

      const dataUrl = `data:${contentType.split(';')[0]};base64,${buf.toString('base64')}`
      if (this.artworkCache.size >= 40) {
        const oldest = this.artworkCache.keys().next().value
        if (oldest) this.artworkCache.delete(oldest)
      }
      this.artworkCache.set(artworkUrl, dataUrl)
      return dataUrl
    } catch {
      return null
    }
  }

  private async refreshStateNow(): Promise<void> {
    if (this.pollInFlight || !this.win || this.win.isDestroyed()) return
    const url = this.win.webContents.getURL()
    if (!isRemoteHttpUrl(url)) {
      this.emitState({
        available: true,
        hasSession: false,
        title: '',
        artist: '',
        status: 'idle',
        thumbnailDataUrl: null,
      })
      return
    }

    this.pollInFlight = true
    try {
      const audible = this.win.webContents.isCurrentlyAudible()
      const raw = (await this.win.webContents.executeJavaScript(
        `if (!window.__stageWebMusicBridge) { ${BRIDGE_BOOTSTRAP_SCRIPT} } window.__stageWebMusicBridge ? window.__stageWebMusicBridge.getSnapshot() : null;`,
      )) as RawWebMediaSnapshot | null

      if (!raw) return
      const isPlaying = audible || raw.playing
      const thumbnailDataUrl = await this.resolveArtworkDataUrl(raw.artworkUrl)
      this.emitState({
        available: true,
        hasSession: raw.hasSession || audible,
        title: raw.title || '',
        artist: raw.artist || '',
        status: isPlaying ? 'playing' : raw.hasSession ? 'paused' : 'idle',
        thumbnailDataUrl,
      })
    } catch {
      // Ignore transient frame unload during navigation
    } finally {
      this.pollInFlight = false
    }
  }
}
