import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { MediaState } from '../shared/types.ts'
import { sendMediaKey } from './win32-bridge.ts'

const INITIAL_MEDIA_STATE: MediaState = {
  available: process.platform === 'win32',
  hasSession: false,
  title: '',
  artist: '',
  status: 'idle',
  thumbnailDataUrl: null,
}

interface HelperStateMessage {
  type: 'state'
  available: boolean
  hasSession: boolean
  title: string
  artist: string
  status: 'playing' | 'paused' | 'idle'
  thumbnailDataUrl: string | null
}

interface HelperAckMessage {
  type: 'ack'
  action: 'prev' | 'next' | 'toggle'
  ok: boolean
}

type HelperMessage = HelperStateMessage | HelperAckMessage

export class MediaMonitor {
  private enabled = false
  private proc: ChildProcess | null = null
  private stdoutBuffer = ''
  private state: MediaState = { ...INITIAL_MEDIA_STATE }
  private listener: ((state: MediaState) => void) | null = null
  private pendingAcks: Array<{
    action: 'prev' | 'next' | 'toggle'
    resolve: (ok: boolean) => void
    timer: NodeJS.Timeout
  }> = []

  constructor(private readonly appRoot: string) {}

  start(listener: (state: MediaState) => void): void {
    this.listener = listener
    if (this.enabled) {
      this.spawnWorker()
    }
  }

  getState(): MediaState {
    return this.state
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (enabled) {
      this.spawnWorker()
    } else {
      this.killWorker()
      this.updateState({ ...INITIAL_MEDIA_STATE })
    }
  }

  stop(): void {
    this.enabled = false
    this.killWorker()
    this.listener = null
  }

  async control(action: 'prev' | 'next' | 'toggle'): Promise<boolean> {
    const worker = this.proc
    if (!worker || !worker.stdin || worker.killed || !this.state.hasSession) {
      return sendMediaKey(action)
    }

    const ackOk = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAcks = this.pendingAcks.filter(item => item.resolve !== resolve)
        resolve(false)
      }, 950)
      this.pendingAcks.push({ action, resolve, timer })
      try {
        worker.stdin?.write(`${action}\n`)
      } catch {
        clearTimeout(timer)
        this.pendingAcks = this.pendingAcks.filter(item => item.resolve !== resolve)
        resolve(false)
      }
    })

    if (ackOk) return true
    return sendMediaKey(action)
  }

  private updateState(next: MediaState): void {
    this.state = next
    if (this.listener) {
      this.listener(next)
    }
  }

  private spawnWorker(): void {
    if (this.proc || process.platform !== 'win32' || !this.enabled) return
    const scriptPath = join(this.appRoot, 'dist-app', 'media-helper.ps1')
    if (!existsSync(scriptPath)) {
      this.updateState({ ...INITIAL_MEDIA_STATE, available: false })
      return
    }

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
      },
    )

    this.proc = child
    this.stdoutBuffer = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString('utf8')
      let idx = this.stdoutBuffer.indexOf('\n')
      while (idx !== -1) {
        const line = this.stdoutBuffer.slice(0, idx).trim()
        this.stdoutBuffer = this.stdoutBuffer.slice(idx + 1)
        if (line) {
          this.handleLine(line)
        }
        idx = this.stdoutBuffer.indexOf('\n')
      }
    })

    child.on('error', () => {
      if (this.proc === child) {
        this.proc = null
      }
      this.flushPendingAcks(false)
    })

    child.on('exit', () => {
      if (this.proc === child) {
        this.proc = null
      }
      this.flushPendingAcks(false)
    })
  }

  private handleLine(line: string): void {
    try {
      const msg = JSON.parse(line) as HelperMessage
      if (msg.type === 'state') {
        const status = msg.status === 'playing' || msg.status === 'paused' ? msg.status : 'idle'
        this.updateState({
          available: Boolean(msg.available),
          hasSession: Boolean(msg.hasSession),
          title: typeof msg.title === 'string' ? msg.title : '',
          artist: typeof msg.artist === 'string' ? msg.artist : '',
          status,
          thumbnailDataUrl: typeof msg.thumbnailDataUrl === 'string' ? msg.thumbnailDataUrl : null,
        })
      } else if (msg.type === 'ack') {
        const idx = this.pendingAcks.findIndex(item => item.action === msg.action)
        if (idx !== -1) {
          const [entry] = this.pendingAcks.splice(idx, 1)
          clearTimeout(entry.timer)
          entry.resolve(Boolean(msg.ok))
        }
      }
    } catch {
      // Ignore malformed lines
    }
  }

  private flushPendingAcks(value: boolean): void {
    for (const entry of this.pendingAcks) {
      clearTimeout(entry.timer)
      entry.resolve(value)
    }
    this.pendingAcks = []
  }

  private killWorker(): void {
    this.flushPendingAcks(false)
    const child = this.proc
    this.proc = null
    if (!child) return
    try {
      child.stdin?.end()
    } catch {
      // Ignore
    }
    try {
      if (!child.killed) {
        child.kill()
      }
    } catch {
      // Ignore
    }
  }
}
