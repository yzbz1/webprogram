import {
  DEFAULT_EXTENSION_SETTINGS,
  type BridgeHealthResponse,
  type ExtensionSettings,
  type SiteMatchMode,
  type ThemePreference,
} from '../shared/types.ts'

function normalizeSettings(raw: unknown): ExtensionSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_EXTENSION_SETTINGS
  const obj = raw as Partial<ExtensionSettings>
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_EXTENSION_SETTINGS.enabled,
    siteMode: obj.siteMode === 'only-listed' ? 'only-listed' : 'all-except',
    blockedHosts: Array.isArray(obj.blockedHosts)
      ? obj.blockedHosts.filter((x): x is string => typeof x === 'string')
      : [],
    allowedHosts: Array.isArray(obj.allowedHosts)
      ? obj.allowedHosts.filter((x): x is string => typeof x === 'string')
      : [],
    theme: obj.theme === 'dark' || obj.theme === 'light' ? obj.theme : 'system',
    bridgePort: typeof obj.bridgePort === 'number' && obj.bridgePort > 0 && obj.bridgePort <= 65535
      ? obj.bridgePort
      : DEFAULT_EXTENSION_SETTINGS.bridgePort,
  }
}

function parseLines(text: string): string[] {
  return text
    .split(/[\r\n,;]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

async function initPopup(): Promise<void> {
  const bridgeDot = document.getElementById('bridge-dot') as HTMLSpanElement
  const bridgeStatus = document.getElementById('bridge-status') as HTMLSpanElement
  const excelPathEl = document.getElementById('excel-path') as HTMLSpanElement
  const bridgeHintEl = document.getElementById('bridge-hint') as HTMLDivElement
  const btnRecheck = document.getElementById('btn-recheck') as HTMLButtonElement
  const chkEnabled = document.getElementById('chk-enabled') as HTMLInputElement
  const siteToggleRow = document.getElementById('site-toggle-row') as HTMLDivElement
  const currentHostEl = document.getElementById('current-host') as HTMLElement
  const btnToggleSite = document.getElementById('btn-toggle-site') as HTMLButtonElement
  const selSiteMode = document.getElementById('sel-site-mode') as HTMLSelectElement
  const domainsLabel = document.getElementById('domains-label') as HTMLDivElement
  const txtDomains = document.getElementById('txt-domains') as HTMLTextAreaElement
  const selTheme = document.getElementById('sel-theme') as HTMLSelectElement
  const numPort = document.getElementById('num-port') as HTMLInputElement
  const btnSave = document.getElementById('btn-save') as HTMLButtonElement
  const saveToast = document.getElementById('save-toast') as HTMLSpanElement

  let settings = normalizeSettings((await chrome.storage.local.get('settings'))?.settings)
  let activeHost = ''

  const refreshHealth = async (port: number) => {
    bridgeStatus.textContent = '检测中...'
    bridgeDot.className = 'dot'
    const res = (await chrome.runtime.sendMessage({ type: 'BRIDGE_HEALTH', port })) as BridgeHealthResponse | undefined
    if (res?.ok) {
      bridgeDot.className = 'dot ok'
      bridgeStatus.textContent = '已连接'
      excelPathEl.textContent = `Excel：${res.excelPath}`
      bridgeHintEl.style.display = 'none'
    } else {
      bridgeDot.className = 'dot err'
      bridgeStatus.textContent = '未连接'
      excelPathEl.textContent = '未连接到 127.0.0.1 本地 Excel 服务'
      bridgeHintEl.style.display = 'block'
    }
  }

  const renderDomainUi = () => {
    const mode = selSiteMode.value as SiteMatchMode
    if (mode === 'only-listed') {
      domainsLabel.textContent = '允许显示的域名（每行一个，支持 *.internal）'
      txtDomains.value = settings.allowedHosts.join('\n')
    } else {
      domainsLabel.textContent = '排除域名（每行一个，支持 *.example.com）'
      txtDomains.value = settings.blockedHosts.join('\n')
    }

    if (activeHost) {
      siteToggleRow.style.display = 'flex'
      currentHostEl.textContent = activeHost
      const inList = mode === 'only-listed'
        ? settings.allowedHosts.includes(activeHost)
        : settings.blockedHosts.includes(activeHost)
      if (mode === 'only-listed') {
        btnToggleSite.textContent = inList ? '从白名单移除' : '加入白名单'
      } else {
        btnToggleSite.textContent = inList ? '恢复在此站显示' : '在此站隐藏'
      }
    }
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const activeUrl = tabs[0]?.url
  if (activeUrl) {
    try {
      const u = new URL(activeUrl)
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        activeHost = u.hostname.toLowerCase()
      }
    } catch {
      // Ignore non-HTTP pages
    }
  }

  chkEnabled.checked = settings.enabled
  selSiteMode.value = settings.siteMode
  selTheme.value = settings.theme
  numPort.value = String(settings.bridgePort)
  renderDomainUi()
  void refreshHealth(settings.bridgePort)

  const saveSettings = async (next: ExtensionSettings, toastMsg = '已保存设置') => {
    settings = next
    await chrome.storage.local.set({ settings: next })
    renderDomainUi()
    saveToast.textContent = toastMsg
    window.setTimeout(() => {
      if (saveToast.textContent === toastMsg) saveToast.textContent = ''
    }, 2000)
  }

  chkEnabled.addEventListener('change', () => {
    void saveSettings({ ...settings, enabled: chkEnabled.checked })
  })

  selSiteMode.addEventListener('change', () => {
    const nextMode = selSiteMode.value as SiteMatchMode
    settings = { ...settings, siteMode: nextMode }
    renderDomainUi()
  })

  btnToggleSite.addEventListener('click', () => {
    if (!activeHost) return
    const mode = selSiteMode.value as SiteMatchMode
    if (mode === 'only-listed') {
      const exists = settings.allowedHosts.includes(activeHost)
      const nextList = exists
        ? settings.allowedHosts.filter(h => h !== activeHost)
        : [...settings.allowedHosts, activeHost]
      void saveSettings({ ...settings, siteMode: mode, allowedHosts: nextList })
    } else {
      const exists = settings.blockedHosts.includes(activeHost)
      const nextList = exists
        ? settings.blockedHosts.filter(h => h !== activeHost)
        : [...settings.blockedHosts, activeHost]
      void saveSettings({ ...settings, siteMode: mode, blockedHosts: nextList })
    }
  })

  btnSave.addEventListener('click', () => {
    const mode = selSiteMode.value as SiteMatchMode
    const domains = parseLines(txtDomains.value)
    const parsedPort = Number(numPort.value)
    const bridgePort = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
      ? parsedPort
      : settings.bridgePort
    const next: ExtensionSettings = {
      enabled: chkEnabled.checked,
      siteMode: mode,
      allowedHosts: mode === 'only-listed' ? domains : settings.allowedHosts,
      blockedHosts: mode === 'all-except' ? domains : settings.blockedHosts,
      theme: selTheme.value as ThemePreference,
      bridgePort,
    }
    void saveSettings(next).then(() => refreshHealth(bridgePort))
  })

  btnRecheck.addEventListener('click', () => {
    void refreshHealth(settings.bridgePort)
  })
}

void initPopup()
