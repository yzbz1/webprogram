import { createRoot, type Root } from 'react-dom/client'
import {
  DEFAULT_EXTENSION_SETTINGS,
  type ExtensionSettings,
} from '../shared/types.ts'
import { IncidentDrawer } from './IncidentDrawer.tsx'
import { DRAWER_CSS } from './styles.ts'

const HOST_ELEMENT_ID = 'dsh-incident-drawer-chrome-host'

function hostMatchesPattern(hostname: string, pattern: string): boolean {
  const host = hostname.trim().toLowerCase()
  const rule = pattern.trim().toLowerCase()
  if (!host || !rule) return false
  if (rule.startsWith('*.')) {
    const suffix = rule.slice(2)
    return host === suffix || host.endsWith(`.${suffix}`)
  }
  return host === rule
}

function shouldShowOnHostname(hostname: string, settings: ExtensionSettings): boolean {
  if (!settings.enabled) return false
  if (settings.siteMode === 'only-listed') {
    return settings.allowedHosts.some(rule => hostMatchesPattern(hostname, rule))
  }
  return !settings.blockedHosts.some(rule => hostMatchesPattern(hostname, rule))
}

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

function mountExtension(): void {
  if (typeof document === 'undefined' || !document.body) return
  if (document.getElementById(HOST_ELEMENT_ID)) return

  const hostEl = document.createElement('div')
  hostEl.id = HOST_ELEMENT_ID
  hostEl.style.cssText = 'position:fixed;inset:0;z-index:2147483640;pointer-events:none;background:transparent;'
  const shadow = hostEl.attachShadow({ mode: 'open' })

  const styleEl = document.createElement('style')
  styleEl.textContent = DRAWER_CSS
  shadow.appendChild(styleEl)

  const mountNode = document.createElement('div')
  shadow.appendChild(mountNode)
  document.documentElement.appendChild(hostEl)

  let root: Root | null = null
  let currentSettings: ExtensionSettings = DEFAULT_EXTENSION_SETTINGS
  const darkMedia = window.matchMedia('(prefers-color-scheme: dark)')

  const renderState = () => {
    const active = shouldShowOnHostname(window.location.hostname, currentSettings)
    if (!active) {
      if (root) {
        root.unmount()
        root = null
      }
      hostEl.style.display = 'none'
      return
    }

    hostEl.style.display = 'block'
    const resolvedTheme: 'light' | 'dark' = currentSettings.theme === 'system'
      ? (darkMedia.matches ? 'dark' : 'light')
      : currentSettings.theme

    if (!root) {
      root = createRoot(mountNode)
    }
    root.render(<IncidentDrawer theme={resolvedTheme} />)
  }

  darkMedia.addEventListener('change', renderState)

  void chrome.storage.local.get('settings').then((res) => {
    currentSettings = normalizeSettings(res?.settings)
    renderState()
  }).catch(() => {
    renderState()
  })

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.settings) return
    currentSettings = normalizeSettings(changes.settings.newValue)
    renderState()
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountExtension, { once: true })
} else {
  mountExtension()
}
