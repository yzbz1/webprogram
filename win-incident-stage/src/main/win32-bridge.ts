import { createRequire } from 'node:module'

interface User32Api {
  getAsyncKeyState: (vKey: number) => number
  keybdEvent: (bVk: number, bScan: number, dwFlags: number, dwExtraInfo: number) => void
}

const VK_MEDIA_NEXT_TRACK = 0xb0
const VK_MEDIA_PREV_TRACK = 0xb1
const VK_MEDIA_PLAY_PAUSE = 0xb3
const KEYEVENTF_EXTENDEDKEY = 0x0001
const KEYEVENTF_KEYUP = 0x0002

const VK_MODIFIER_MAP: Record<string, number> = {
  CTRL: 0x11,
  CONTROL: 0x11,
  LCTRL: 0xa2,
  RCTRL: 0xa3,
  ALT: 0x12,
  OPTION: 0x12,
  LALT: 0xa4,
  RALT: 0xa5,
  SHIFT: 0x10,
  LSHIFT: 0xa0,
  RSHIFT: 0xa1,
  WIN: 0x5b,
  LWIN: 0x5b,
  META: 0x5b,
  SUPER: 0x5b,
  CMD: 0x5b,
  RWIN: 0x5c,
}

const VK_KEY_MAP: Record<string, number> = {
  BACKSPACE: 0x08,
  BKSP: 0x08,
  TAB: 0x09,
  ENTER: 0x0d,
  RETURN: 0x0d,
  PAUSE: 0x13,
  CAPSLOCK: 0x14,
  ESC: 0x1b,
  ESCAPE: 0x1b,
  SPACE: 0x20,
  SPACEBAR: 0x20,
  PAGEUP: 0x21,
  PGUP: 0x21,
  PAGEDOWN: 0x22,
  PGDN: 0x22,
  END: 0x23,
  HOME: 0x24,
  LEFT: 0x25,
  ARROWLEFT: 0x25,
  UP: 0x26,
  ARROWUP: 0x26,
  RIGHT: 0x27,
  ARROWRIGHT: 0x27,
  DOWN: 0x28,
  ARROWDOWN: 0x28,
  PRINTSCREEN: 0x2c,
  PRTSC: 0x2c,
  SNAPSHOT: 0x2c,
  INSERT: 0x2d,
  INS: 0x2d,
  DELETE: 0x2e,
  DEL: 0x2e,
  MUTE: 0xad,
  VOLUMEDOWN: 0xae,
  VOLUMEUP: 0xaf,
  NEXT: 0xb0,
  PREV: 0xb1,
  PLAYPAUSE: 0xb3,
  ';': 0xba,
  SEMICOLON: 0xba,
  '=': 0xbb,
  EQUAL: 0xbb,
  PLUS: 0xbb,
  ',': 0xbc,
  COMMA: 0xbc,
  '-': 0xbd,
  MINUS: 0xbd,
  '.': 0xbe,
  PERIOD: 0xbe,
  '/': 0xbf,
  SLASH: 0xbf,
  '`': 0xc0,
  BACKQUOTE: 0xc0,
  '[': 0xdb,
  BRACKETLEFT: 0xdb,
  '\\': 0xdc,
  BACKSLASH: 0xdc,
  ']': 0xdd,
  BRACKETRIGHT: 0xdd,
  "'": 0xde,
  QUOTE: 0xde,
}

const EXTENDED_VKS = new Set([
  0x5b, // VK_LWIN
  0x5c, // VK_RWIN
  0x21, 0x22, 0x23, 0x24, // PgUp, PgDn, End, Home
  0x25, 0x26, 0x27, 0x28, // Arrows
  0x2c, // PrintScreen
  0x2d, 0x2e, // Ins, Del
  0xa3, 0xa5, // RCtrl, RAlt
])

let cachedApi: User32Api | null | undefined

function loadUser32(): User32Api | null {
  if (cachedApi !== undefined) return cachedApi
  if (process.platform !== 'win32') {
    cachedApi = null
    return null
  }
  try {
    const req = typeof require === 'function' ? require : createRequire(__filename)
    const koffi = req('koffi') as {
      load: (lib: string) => {
        func: (decl: string) => (...args: number[]) => number
      }
    }
    const user32 = koffi.load('user32.dll')
    const getAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)')
    const keybdEvent = user32.func('void __stdcall keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr dwExtraInfo)')
    cachedApi = {
      getAsyncKeyState: (vKey: number) => getAsyncKeyState(vKey),
      keybdEvent: (bVk: number, bScan: number, dwFlags: number, dwExtraInfo: number) => {
        keybdEvent(bVk, bScan, dwFlags, dwExtraInfo)
      },
    }
    return cachedApi
  } catch {
    cachedApi = null
    return null
  }
}

function resolveKeyVk(token: string): number | null {
  const upper = token.trim().toUpperCase()
  if (!upper) return null
  if (Object.hasOwn(VK_KEY_MAP, upper)) return VK_KEY_MAP[upper]
  if (/^[A-Z0-9]$/.test(upper)) return upper.charCodeAt(0)
  const fMatch = /^F([1-9]|1\d|2[0-4])$/.exec(upper)
  if (fMatch) {
    return 0x6f + Number.parseInt(fMatch[1], 10)
  }
  return null
}

export function isWin32Available(): boolean {
  return loadUser32() !== null
}

export function getAsyncKeyState(vk: number): number {
  const api = loadUser32()
  if (!api) return 0
  return api.getAsyncKeyState(vk)
}

export function sendMediaKey(action: 'prev' | 'next' | 'toggle'): boolean {
  const api = loadUser32()
  if (!api) return false
  const vk =
    action === 'prev'
      ? VK_MEDIA_PREV_TRACK
      : action === 'next'
        ? VK_MEDIA_NEXT_TRACK
        : VK_MEDIA_PLAY_PAUSE
  try {
    api.keybdEvent(vk, 0, 0, 0)
    api.keybdEvent(vk, 0, KEYEVENTF_KEYUP, 0)
    return true
  } catch {
    return false
  }
}

export async function sendHotkeyCombo(combo: string): Promise<boolean> {
  const api = loadUser32()
  if (!api || typeof combo !== 'string') return false

  const rawParts = combo
    .split('+')
    .map(p => p.trim())
    .filter(Boolean)
  if (rawParts.length === 0) return false

  const modifiers: number[] = []
  const keys: number[] = []

  for (const part of rawParts) {
    const upper = part.toUpperCase()
    if (Object.hasOwn(VK_MODIFIER_MAP, upper)) {
      const modVk = VK_MODIFIER_MAP[upper]
      if (!modifiers.includes(modVk)) modifiers.push(modVk)
      continue
    }
    const keyVk = resolveKeyVk(part)
    if (keyVk === null) return false
    keys.push(keyVk)
  }

  if (modifiers.length === 0 && keys.length === 0) return false

  const pressKey = (vk: number, up: boolean) => {
    const ext = EXTENDED_VKS.has(vk) ? KEYEVENTF_EXTENDEDKEY : 0
    api.keybdEvent(vk, 0, ext | (up ? KEYEVENTF_KEYUP : 0), 0)
  }

  try {
    for (const mod of modifiers) pressKey(mod, false)
    for (const k of keys) pressKey(k, false)
    await new Promise(resolve => setTimeout(resolve, 28))
    for (let i = keys.length - 1; i >= 0; i -= 1) pressKey(keys[i], true)
    for (let i = modifiers.length - 1; i >= 0; i -= 1) pressKey(modifiers[i], true)
    return true
  } catch {
    return false
  }
}
