import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  net,
  protocol,
  screen,
  shell,
  Tray,
  type Display,
} from 'electron'
import type {
  CreateSampleRequest,
  DesktopPreferences,
  LoadRequest,
  SaveBatchRequest,
  SaveCellRequest,
  SetConfigRequest,
  StatusCheckRequest,
} from '../shared/types.ts'
import {
  ConfigStore,
  DesktopPrefsStore,
  sanitizeTodoInterval,
  sanitizeTodos,
  sanitizeTrafficLights,
  type StoredDesktopPrefs,
} from './config-store.ts'
import type * as ExcelStoreModule from './excel-store.ts'
import { InputMonitor } from './input-monitor.ts'
import { LocalMusicStore } from './local-music.ts'
import { MediaMonitor } from './media-monitor.ts'
import { sendHotkeyCombo } from './win32-bridge.ts'

const OVERLAY_WINDOW_WIDTH = 680

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'stage-audio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])

const isSmokeTest = process.env.STAGE_SMOKE_TEST === '1'

if (!isSmokeTest) {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
  }
}

const appRoot = app.getAppPath()
// eslint-disable-next-line @typescript-eslint/no-require-imports
const excelStore = require(join(appRoot, 'dist-app', 'excel-store.cjs')) as typeof ExcelStoreModule

const configStore = new ConfigStore(appRoot)
const prefsStore = new DesktopPrefsStore()
const inputMonitor = new InputMonitor()
const mediaMonitor = new MediaMonitor(appRoot)
const localMusicStore = new LocalMusicStore()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let storedPrefs: StoredDesktopPrefs = prefsStore.read()
let lastInteractive: boolean | null = null

localMusicStore.loadFolder(storedPrefs.musicFolder)

function resolveTheme(prefs: StoredDesktopPrefs): 'light' | 'dark' {
  if (prefs.theme === 'light' || prefs.theme === 'dark') return prefs.theme
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function getFullPrefs(): DesktopPreferences {
  return {
    ...storedPrefs,
    resolvedTheme: resolveTheme(storedPrefs),
  }
}

function broadcastPrefs(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stage:prefs-changed', getFullPrefs())
  }
}

function broadcastLocalMusic(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stage:local-music-changed', localMusicStore.getLibrary())
  }
}

function syncWidgetsRuntime(): void {
  const active = !isSmokeTest && !storedPrefs.hidden
  inputMonitor.setEnabled(active && storedPrefs.showCat)
  mediaMonitor.setEnabled(active && storedPrefs.showPlayer && storedPrefs.musicFolder.trim() === '')
}

function resolveTargetDisplay(): Display {
  const displays = screen.getAllDisplays()
  if (storedPrefs.displayId !== null) {
    const matched = displays.find(d => d.id === storedPrefs.displayId)
    if (matched) return matched
  }
  return screen.getPrimaryDisplay()
}

function positionOverlayWindow(win: BrowserWindow): void {
  const display = resolveTargetDisplay()
  const { x, y, width, height } = display.workArea
  const winWidth = Math.min(OVERLAY_WINDOW_WIDTH, width)
  win.setBounds({
    x: x + width - winWidth,
    y,
    width: winWidth,
    height,
  })
}

function applyAlwaysOnTop(win: BrowserWindow): void {
  win.setAlwaysOnTop(storedPrefs.alwaysOnTop, 'floating')
}

function setMousePassThrough(win: BrowserWindow, interactive: boolean): void {
  if (lastInteractive === interactive) return
  lastInteractive = interactive
  win.setIgnoreMouseEvents(!interactive, { forward: true })
}

function updatePrefs(patch: Partial<StoredDesktopPrefs>): DesktopPreferences {
  const prevMusicFolder = storedPrefs.musicFolder
  storedPrefs = { ...storedPrefs, ...patch }
  prefsStore.write(storedPrefs)

  if (storedPrefs.musicFolder !== prevMusicFolder) {
    localMusicStore.loadFolder(storedPrefs.musicFolder)
    broadcastLocalMusic()
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    applyAlwaysOnTop(mainWindow)
    positionOverlayWindow(mainWindow)
    if (storedPrefs.hidden) {
      setMousePassThrough(mainWindow, false)
    }
  }
  syncWidgetsRuntime()
  rebuildTrayMenu()
  broadcastPrefs()
  return getFullPrefs()
}

function toggleHidden(): void {
  const nextHidden = !storedPrefs.hidden
  updatePrefs({ hidden: nextHidden })
  if (!nextHidden && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.showInactive()
  }
}

async function pickMusicFolder() {
  const result = await dialog.showOpenDialog({
    title: '选择本地音乐播放文件夹',
    defaultPath: storedPrefs.musicFolder || undefined,
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const pickedFolder = result.filePaths[0]
  updatePrefs({ musicFolder: pickedFolder })
  return localMusicStore.getLibrary()
}

async function openMusicFolder(): Promise<boolean> {
  if (!storedPrefs.musicFolder.trim()) {
    const picked = await pickMusicFolder()
    return picked !== null
  }
  try {
    const errMsg = await shell.openPath(storedPrefs.musicFolder)
    return errMsg === ''
  } catch {
    return false
  }
}

function rebuildTrayMenu(): void {
  if (!tray) return
  const displays = screen.getAllDisplays()
  const activeDisplay = resolveTargetDisplay()
  const loginSettings = app.getLoginItemSettings()

  const menu = Menu.buildFromTemplate([
    {
      label: storedPrefs.hidden ? '展开前台调度面板' : '贴边收起面板',
      click: () => toggleHidden(),
    },
    {
      label: '刷新 Excel 数据',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stage:trigger-refresh')
        }
      },
    },
    {
      label: '选择绑定 Excel 文件...',
      click: async () => {
        const snap = await openExcelPicker()
        if (snap && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stage:trigger-refresh')
        }
      },
    },
    { type: 'separator' },
    {
      label: '显示键盘小猫（含全息待办）',
      type: 'checkbox',
      checked: storedPrefs.showCat,
      click: () => updatePrefs({ showCat: !storedPrefs.showCat }),
    },
    {
      label: '显示水滴播放器',
      type: 'checkbox',
      checked: storedPrefs.showPlayer,
      click: () => updatePrefs({ showPlayer: !storedPrefs.showPlayer }),
    },
    {
      label: '选择本地音乐播放文件夹...',
      click: () => {
        void pickMusicFolder()
      },
    },
    { type: 'separator' },
    {
      label: '显示在屏幕',
      submenu: displays.map((d, idx) => ({
        label: `显示器 ${idx + 1} (${d.size.width}×${d.size.height})${d.id === screen.getPrimaryDisplay().id ? ' [主屏]' : ''}`,
        type: 'radio',
        checked: d.id === activeDisplay.id,
        click: () => {
          updatePrefs({ displayId: d.id })
        },
      })),
    },
    {
      label: '主题外观',
      submenu: [
        {
          label: '跟随系统',
          type: 'radio',
          checked: storedPrefs.theme === 'system',
          click: () => updatePrefs({ theme: 'system' }),
        },
        {
          label: '浅色磨砂',
          type: 'radio',
          checked: storedPrefs.theme === 'light',
          click: () => updatePrefs({ theme: 'light' }),
        },
        {
          label: '深色磨砂',
          type: 'radio',
          checked: storedPrefs.theme === 'dark',
          click: () => updatePrefs({ theme: 'dark' }),
        },
      ],
    },
    {
      label: '全局置顶悬浮',
      type: 'checkbox',
      checked: storedPrefs.alwaysOnTop,
      click: () => updatePrefs({ alwaysOnTop: !storedPrefs.alwaysOnTop }),
    },
    {
      label: '开机自动启动',
      type: 'checkbox',
      checked: loginSettings.openAtLogin,
      click: () => {
        app.setLoginItemSettings({ openAtLogin: !loginSettings.openAtLogin })
        rebuildTrayMenu()
      },
    },
    { type: 'separator' },
    {
      label: '退出事件单前台调度',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(menu)
}

async function openExcelPicker() {
  const cfg = configStore.read()
  const result = await dialog.showOpenDialog({
    title: '选择共享的事件单 Excel 文件',
    defaultPath: cfg.excelPath,
    filters: [{ name: 'Excel 工作簿 (*.xlsx)', extensions: ['xlsx'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const pickedPath = result.filePaths[0]
  const { config: saved } = configStore.write({ excelPath: pickedPath })
  return excelStore.loadWorkbookData(saved.excelPath, saved.preferredSheet)
}

function normalizeHttpUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function createWindow(): void {
  const display = resolveTargetDisplay()
  const { x, y, width, height } = display.workArea
  const winWidth = Math.min(OVERLAY_WINDOW_WIDTH, width)

  mainWindow = new BrowserWindow({
    x: x + width - winWidth,
    y,
    width: winWidth,
    height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: storedPrefs.alwaysOnTop,
    focusable: true,
    backgroundColor: '#00000000',
    show: !isSmokeTest,
    webPreferences: {
      preload: join(appRoot, 'dist-app', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  applyAlwaysOnTop(mainWindow)
  mainWindow.setIgnoreMouseEvents(true, { forward: true })
  lastInteractive = false

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      setMousePassThrough(mainWindow, false)
      mainWindow.webContents.send('stage:window-blur')
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  void mainWindow.loadFile(join(appRoot, 'dist-app', 'index.html'))

  if (isSmokeTest) {
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        await new Promise(r => setTimeout(r, 250))
        const res = (await mainWindow?.webContents.executeJavaScript(
          'Promise.all([window.stageApi.invoke("load", {}), window.stageApi.getPrefs(), window.stageApi.getLocalMusic()])',
        )) as [{ rows?: unknown[]; activeSheet?: string | null }, DesktopPreferences, { folderPath: string }]
        const [loadRes, prefsRes, musicRes] = res
        if (
          typeof prefsRes?.showCat !== 'boolean' ||
          typeof prefsRes?.showPlayer !== 'boolean' ||
          typeof prefsRes?.musicFolder !== 'string' ||
          !Array.isArray(prefsRes?.trafficLights) ||
          prefsRes.trafficLights.length !== 3 ||
          typeof musicRes?.folderPath !== 'string'
        ) {
          throw new Error('DesktopPreferences missing new widget fields')
        }
        console.log(
          `ELECTRON_SMOKE_OK rows=${loadRes?.rows?.length ?? -1} activeSheet=${loadRes?.activeSheet ?? 'null'} showCat=${prefsRes.showCat} showPlayer=${prefsRes.showPlayer} lights=${prefsRes.trafficLights.length}`,
        )
        app.exit(0)
      } catch (err) {
        console.error('ELECTRON_SMOKE_FAILED:', err)
        app.exit(1)
      }
    })
  }
}

function registerIpcHandlers(): void {
  ipcMain.on('stage:set-interactive', (_event, interactive: boolean) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    setMousePassThrough(mainWindow, Boolean(interactive))
  })

  ipcMain.handle('stage:get-prefs', () => getFullPrefs())

  ipcMain.handle('stage:update-prefs', (_event, patch: Partial<StoredDesktopPrefs>) => {
    const cleanPatch: Partial<StoredDesktopPrefs> = {}
    if (patch.theme === 'system' || patch.theme === 'light' || patch.theme === 'dark') {
      cleanPatch.theme = patch.theme
    }
    if (typeof patch.alwaysOnTop === 'boolean') cleanPatch.alwaysOnTop = patch.alwaysOnTop
    if (typeof patch.hidden === 'boolean') cleanPatch.hidden = patch.hidden
    if (patch.displayId === null || typeof patch.displayId === 'number') {
      cleanPatch.displayId = patch.displayId
    }
    if (typeof patch.stageWidth === 'number' && patch.stageWidth >= 300 && patch.stageWidth <= 540) {
      cleanPatch.stageWidth = Math.round(patch.stageWidth)
    }
    if (typeof patch.showCat === 'boolean') cleanPatch.showCat = patch.showCat
    if (typeof patch.showPlayer === 'boolean') cleanPatch.showPlayer = patch.showPlayer
    if (typeof patch.musicFolder === 'string') {
      cleanPatch.musicFolder = patch.musicFolder.trim().slice(0, 512)
    }
    if (Array.isArray(patch.trafficLights)) {
      cleanPatch.trafficLights = sanitizeTrafficLights(patch.trafficLights)
    }
    if (Array.isArray(patch.todos)) {
      cleanPatch.todos = sanitizeTodos(patch.todos)
    }
    if (typeof patch.todoIntervalMinutes === 'number') {
      cleanPatch.todoIntervalMinutes = sanitizeTodoInterval(patch.todoIntervalMinutes)
    }
    return updatePrefs(cleanPatch)
  })

  ipcMain.handle('stage:open-external', async (_event, rawUrl: string) => {
    if (typeof rawUrl !== 'string') return false
    const safeUrl = normalizeHttpUrl(rawUrl)
    if (!safeUrl) return false
    try {
      await shell.openExternal(safeUrl)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('stage:open-path', async (_event, rawPath: string) => {
    if (typeof rawPath !== 'string') return false
    const trimmed = rawPath.trim()
    if (!trimmed) return false
    try {
      const errMsg = await shell.openPath(trimmed)
      return errMsg === ''
    } catch {
      return false
    }
  })

  ipcMain.handle('stage:trigger-hotkey', async (_event, rawCombo: string) => {
    if (typeof rawCombo !== 'string' || !rawCombo.trim()) return false
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
      mainWindow.blur()
      await new Promise(r => setTimeout(r, 45))
    }
    return sendHotkeyCombo(rawCombo)
  })

  ipcMain.handle('stage:open-bound-excel', async () => {
    const cfg = configStore.read()
    try {
      const errMsg = await shell.openPath(cfg.excelPath)
      return errMsg === ''
    } catch {
      return false
    }
  })

  ipcMain.handle('stage:pick-excel', () => openExcelPicker())

  ipcMain.handle('stage:pick-any-file', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择快捷启动文件或应用',
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('stage:get-media-state', () => mediaMonitor.getState())

  ipcMain.handle('stage:media-control', (_event, action: 'prev' | 'next' | 'toggle') => {
    if (action !== 'prev' && action !== 'next' && action !== 'toggle') return false
    return mediaMonitor.control(action)
  })

  ipcMain.handle('stage:get-local-music', () => localMusicStore.getLibrary())

  ipcMain.handle('stage:pick-music-folder', () => pickMusicFolder())

  ipcMain.handle('stage:open-music-folder', () => openMusicFolder())

  ipcMain.handle('stage:music-context-menu', async () => {
    if (!storedPrefs.musicFolder.trim()) {
      await pickMusicFolder()
      return
    }
    if (!mainWindow || mainWindow.isDestroyed()) return
    const menu = Menu.buildFromTemplate([
      {
        label: '打开播放文件夹',
        click: () => {
          void openMusicFolder()
        },
      },
      {
        label: '更换播放文件夹...',
        click: () => {
          void pickMusicFolder()
        },
      },
      {
        label: '刷新曲目列表',
        click: () => {
          localMusicStore.loadFolder(storedPrefs.musicFolder)
          broadcastLocalMusic()
        },
      },
      { type: 'separator' },
      {
        label: '切换回系统媒体模式 (SMTC)',
        click: () => {
          updatePrefs({ musicFolder: '' })
        },
      },
    ])
    menu.popup({ window: mainWindow })
  })

  ipcMain.handle('stage:api', async (_event, endpoint: string, payload: unknown) => {
    const cfg = configStore.read()
    switch (endpoint) {
      case 'load': {
        const req = (payload && typeof payload === 'object' ? payload : {}) as LoadRequest
        const sheetName = typeof req.sheetName === 'string' && req.sheetName.trim() !== ''
          ? req.sheetName.trim()
          : cfg.preferredSheet
        return excelStore.loadWorkbookData(cfg.excelPath, sheetName)
      }

      case 'check-status': {
        const req = (payload && typeof payload === 'object' ? payload : {}) as StatusCheckRequest
        const known = typeof req.knownVersion === 'string' || req.knownVersion === null
          ? req.knownVersion
          : null
        return excelStore.checkWorkbookStatus(cfg.excelPath, known)
      }

      case 'save-cell': {
        const req = payload as SaveCellRequest
        return excelStore.saveCellsToWorkbook({
          excelPath: cfg.excelPath,
          sheetName: req.sheetName,
          edits: [{ rowNumber: req.rowNumber, colIndex: req.colIndex, value: String(req.value ?? '') }],
          expectedVersion: req.expectedVersion ?? null,
          forceOverwrite: Boolean(req.forceOverwrite),
        })
      }

      case 'save-batch': {
        const req = payload as SaveBatchRequest
        return excelStore.saveCellsToWorkbook({
          excelPath: cfg.excelPath,
          sheetName: req.sheetName,
          edits: Array.isArray(req.edits) ? req.edits : [],
          expectedVersion: req.expectedVersion ?? null,
          forceOverwrite: Boolean(req.forceOverwrite),
        })
      }

      case 'set-config': {
        const req = payload as SetConfigRequest
        if (typeof req?.excelPath !== 'string' || req.excelPath.trim() === '') {
          throw new Error('excelPath must be a non-empty string')
        }
        const { config: savedCfg } = configStore.write({
          excelPath: req.excelPath,
          ...(typeof req.preferredSheet === 'string' && req.preferredSheet.trim() !== ''
            ? { preferredSheet: req.preferredSheet.trim() }
            : {}),
        })
        return excelStore.loadWorkbookData(savedCfg.excelPath, savedCfg.preferredSheet)
      }

      case 'create-sample': {
        const req = (payload && typeof payload === 'object' ? payload : {}) as CreateSampleRequest
        const targetPath = typeof req.excelPath === 'string' && req.excelPath.trim() !== ''
          ? resolve(req.excelPath.trim())
          : cfg.excelPath
        await excelStore.createSampleWorkbook(targetPath)
        const { config: savedCfg } = configStore.write({ excelPath: targetPath })
        return excelStore.loadWorkbookData(savedCfg.excelPath)
      }

      default:
        throw new Error(`Unknown IPC endpoint: ${endpoint}`)
    }
  })
}

void app.whenReady().then(() => {
  protocol.handle('stage-audio', (request) => {
    try {
      const parsed = new URL(request.url)
      const indexStr = parsed.pathname.replace(/^\/+/, '').split('/')[0]
      const idx = Number.parseInt(indexStr, 10)
      const filePath = localMusicStore.resolveTrackPath(idx)
      if (!filePath) {
        return new Response('Track not found', { status: 404 })
      }
      return net.fetch(pathToFileURL(filePath).toString(), { headers: request.headers })
    } catch {
      return new Response('Bad track URL', { status: 400 })
    }
  })

  registerIpcHandlers()
  createWindow()

  inputMonitor.start((evt) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stage:input-activity', evt)
    }
  })
  mediaMonitor.start((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stage:media-state', state)
    }
  })
  syncWidgetsRuntime()

  if (!isSmokeTest) {
    const iconPath = join(appRoot, 'assets', 'tray-icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    tray = new Tray(icon)
    tray.setToolTip('事件单前台调度台（与 DSH / Chrome 共享 Excel）')
    tray.on('click', () => toggleHidden())
    rebuildTrayMenu()

    try {
      globalShortcut.register('Alt+Shift+E', () => toggleHidden())
    } catch {
      // Ignore shortcut collision
    }
  }

  nativeTheme.on('updated', () => {
    if (storedPrefs.theme === 'system') {
      broadcastPrefs()
    }
  })

  const reposition = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      positionOverlayWindow(mainWindow)
    }
    rebuildTrayMenu()
  }
  screen.on('display-metrics-changed', reposition)
  screen.on('display-added', reposition)
  screen.on('display-removed', reposition)
})

app.on('second-instance', () => {
  if (storedPrefs.hidden) {
    updatePrefs({ hidden: false })
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.showInactive()
  }
})

app.on('will-quit', () => {
  inputMonitor.stop()
  mediaMonitor.stop()
  globalShortcut.unregisterAll()
})
