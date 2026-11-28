import { screen } from 'electron'
import type { InputActivityEvent } from '../shared/types.ts'
import { getAsyncKeyState, isWin32Available } from './win32-bridge.ts'

// Privacy-safe hand-side virtual key groups (no text or key names are ever recorded)
const LEFT_HAND_VKS = [
  0x1b, 0x09, 0x14, 0xa0, 0xa2, 0xa4, // Esc, Tab, Caps, LShift, LCtrl, LAlt
  0x31, 0x32, 0x33, 0x34, 0x35, // 1-5
  0x51, 0x57, 0x45, 0x52, 0x54, // Q W E R T
  0x41, 0x53, 0x44, 0x46, 0x47, // A S D F G
  0x5a, 0x58, 0x43, 0x56, 0x42, // Z X C V B
] as const

const RIGHT_HAND_VKS = [
  0x36, 0x37, 0x38, 0x39, 0x30, // 6-0
  0x08, 0x0d, 0xa1, 0xa3, 0xa5, // Backspace, Enter, RShift, RCtrl, RAlt
  0x25, 0x26, 0x27, 0x28, // Arrow keys
  0x59, 0x55, 0x49, 0x4f, 0x50, // Y U I O P
  0x48, 0x4a, 0x4b, 0x4c, // H J K L
  0x4e, 0x4d, // N M
  0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf, 0xdb, 0xdc, 0xdd, 0xde, // Punctuation
] as const

const VK_SPACE = 0x20

export class InputMonitor {
  private enabled = false
  private mouseTimer: NodeJS.Timeout | null = null
  private keyTimer: NodeJS.Timeout | null = null
  private listener: ((evt: InputActivityEvent) => void) | null = null
  private lastMouseX = -9999
  private lastMouseY = -9999
  private prevDown = new Uint8Array(256)
  private keySweepInitialized = false
  private alternateHand: 'left' | 'right' = 'right'

  start(listener: (evt: InputActivityEvent) => void): void {
    this.listener = listener
    if (this.enabled) {
      this.ensureTimers()
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (enabled) {
      this.ensureTimers()
    } else {
      this.clearTimers()
    }
  }

  stop(): void {
    this.enabled = false
    this.clearTimers()
    this.listener = null
  }

  private clearTimers(): void {
    if (this.mouseTimer) {
      clearInterval(this.mouseTimer)
      this.mouseTimer = null
    }
    if (this.keyTimer) {
      clearInterval(this.keyTimer)
      this.keyTimer = null
    }
    this.keySweepInitialized = false
    this.prevDown.fill(0)
  }

  private ensureTimers(): void {
    if (!this.listener || !this.enabled) return

    if (!this.mouseTimer) {
      this.mouseTimer = setInterval(() => {
        if (!this.enabled || !this.listener) return
        try {
          const pt = screen.getCursorScreenPoint()
          if (Math.abs(pt.x - this.lastMouseX) < 3 && Math.abs(pt.y - this.lastMouseY) < 3) {
            return
          }
          this.lastMouseX = pt.x
          this.lastMouseY = pt.y
          const display = screen.getDisplayNearestPoint(pt)
          const { x, y, width, height } = display.bounds
          const nx = width > 0 ? Math.min(1, Math.max(0, (pt.x - x) / width)) : 0.5
          const ny = height > 0 ? Math.min(1, Math.max(0, (pt.y - y) / height)) : 0.5
          this.listener({ type: 'mouse', nx, ny })
        } catch {
          // Ignore transient cursor query errors
        }
      }, 65)
    }

    if (!this.keyTimer && isWin32Available()) {
      this.keySweepInitialized = false
      this.prevDown.fill(0)
      this.keyTimer = setInterval(() => {
        if (!this.enabled || !this.listener) return
        let leftHit = false
        let rightHit = false

        const sampleGroup = (vks: readonly number[]): boolean => {
          let hit = false
          for (let i = 0; i < vks.length; i += 1) {
            const vk = vks[i]
            const state = getAsyncKeyState(vk)
            const isDown = (state & 0x8000) !== 0
            const toggledSinceLast = (state & 0x0001) !== 0
            const wasDown = this.prevDown[vk] === 1
            this.prevDown[vk] = isDown ? 1 : 0
            if (this.keySweepInitialized && ((isDown && !wasDown) || (toggledSinceLast && !wasDown))) {
              hit = true
            }
          }
          return hit
        }

        if (sampleGroup(LEFT_HAND_VKS)) leftHit = true
        if (sampleGroup(RIGHT_HAND_VKS)) rightHit = true

        // Handle Spacebar by alternating hands smoothly
        const spaceState = getAsyncKeyState(VK_SPACE)
        const spaceDown = (spaceState & 0x8000) !== 0
        const spaceToggled = (spaceState & 0x0001) !== 0
        const spaceWasDown = this.prevDown[VK_SPACE] === 1
        this.prevDown[VK_SPACE] = spaceDown ? 1 : 0
        if (this.keySweepInitialized && ((spaceDown && !spaceWasDown) || (spaceToggled && !spaceWasDown))) {
          this.alternateHand = this.alternateHand === 'left' ? 'right' : 'left'
          if (this.alternateHand === 'left') leftHit = true
          else rightHit = true
        }

        if (!this.keySweepInitialized) {
          this.keySweepInitialized = true
          return
        }

        if (leftHit && rightHit) {
          this.listener({ type: 'key', hand: 'both' })
        } else if (leftHit) {
          this.listener({ type: 'key', hand: 'left' })
        } else if (rightHit) {
          this.listener({ type: 'key', hand: 'right' })
        }
      }, 55)
    }
  }
}
