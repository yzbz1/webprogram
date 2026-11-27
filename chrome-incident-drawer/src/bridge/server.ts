import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  API_ROUTE_PATH,
  CLIENT_HEADER_NAME,
  CLIENT_HEADER_VALUE,
  DEFAULT_BRIDGE_PORT,
  HEALTH_ROUTE_PATH,
  type CreateSampleRequest,
  type LoadRequest,
  type SaveBatchRequest,
  type SaveCellRequest,
  type SetConfigRequest,
  type StatusCheckRequest,
} from '../shared/types.ts'
import { ConfigStore } from './config-store.ts'
import type * as ExcelStoreModule from './excel-store.ts'

const require = createRequire(import.meta.url)
const excelStore = require('./excel-store.cjs') as typeof ExcelStoreModule

const MAX_BODY_BYTES = 1024 * 1024

export interface BridgeServerOptions {
  port?: number
  host?: string
  configFilePath?: string
  initialExcelPath?: string
  pidFilePath?: string | null
}

function isAllowedOrigin(origin: string): boolean {
  if (origin.startsWith('chrome-extension://')) return true
  try {
    const u = new URL(origin)
    return (u.hostname === '127.0.0.1' || u.hostname === 'localhost') && u.protocol === 'http:'
  } catch {
    return false
  }
}

function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin
  if (typeof origin === 'string' && isAllowedOrigin(origin)) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('vary', 'Origin')
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
    res.setHeader('access-control-allow-headers', `content-type, ${CLIENT_HEADER_NAME}`)
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES) {
      throw new Error('Request body exceeds 1MB limit')
    }
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks, size).toString('utf8')
  return JSON.parse(text)
}

export async function startBridgeServer(options: BridgeServerOptions = {}): Promise<{
  server: Server
  port: number
  host: string
  close: () => Promise<void>
}> {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? Number(process.env.BRIDGE_PORT ?? DEFAULT_BRIDGE_PORT)
  const configStore = new ConfigStore(options.initialExcelPath, options.configFilePath)

  const server = createServer(async (req, res) => {
    try {
      applyCorsHeaders(req, res)

      const origin = req.headers.origin
      if (typeof origin === 'string' && !isAllowedOrigin(origin)) {
        sendJson(res, 403, { ok: false, error: 'Forbidden origin' })
        return
      }

      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
      }

      const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname

      if (pathname === HEALTH_ROUTE_PATH && req.method === 'GET') {
        const cfg = configStore.read()
        sendJson(res, 200, {
          ok: true,
          service: 'chrome-incident-drawer-bridge',
          version: '1.0.0',
          pid: process.pid,
          excelPath: cfg.excelPath,
        })
        return
      }

      if (pathname === API_ROUTE_PATH && req.method === 'POST') {
        const clientTag = req.headers[CLIENT_HEADER_NAME]
        if (clientTag !== CLIENT_HEADER_VALUE) {
          sendJson(res, 403, { ok: false, error: 'Missing or invalid client header' })
          return
        }

        let body: unknown
        try {
          body = await readJsonBody(req)
        } catch {
          sendJson(res, 400, { ok: false, error: 'Invalid JSON request body' })
          return
        }

        if (!body || typeof body !== 'object') {
          sendJson(res, 400, { ok: false, error: 'Invalid request envelope' })
          return
        }

        const { endpoint, payload } = body as { endpoint?: unknown; payload?: unknown }
        if (typeof endpoint !== 'string' || endpoint.trim() === '') {
          sendJson(res, 400, { ok: false, error: 'Missing endpoint' })
          return
        }

        const cfg = configStore.read()

        switch (endpoint) {
          case 'load': {
            const reqPayload = (payload && typeof payload === 'object' ? payload : {}) as LoadRequest
            const sheetName = typeof reqPayload.sheetName === 'string' && reqPayload.sheetName.trim() !== ''
              ? reqPayload.sheetName.trim()
              : cfg.preferredSheet
            const snapshot = await excelStore.loadWorkbookData(cfg.excelPath, sheetName)
            sendJson(res, 200, { ok: true, value: snapshot })
            return
          }

          case 'check-status': {
            const reqPayload = (payload && typeof payload === 'object' ? payload : {}) as StatusCheckRequest
            const known = typeof reqPayload.knownVersion === 'string' || reqPayload.knownVersion === null
              ? reqPayload.knownVersion
              : null
            const status = await excelStore.checkWorkbookStatus(cfg.excelPath, known)
            sendJson(res, 200, { ok: true, value: status })
            return
          }

          case 'save-cell': {
            if (!payload || typeof payload !== 'object') {
              sendJson(res, 400, { ok: false, error: 'Invalid save-cell payload' })
              return
            }
            const reqPayload = payload as SaveCellRequest
            const result = await excelStore.saveCellsToWorkbook({
              excelPath: cfg.excelPath,
              sheetName: reqPayload.sheetName,
              edits: [{ rowNumber: reqPayload.rowNumber, colIndex: reqPayload.colIndex, value: String(reqPayload.value ?? '') }],
              expectedVersion: reqPayload.expectedVersion ?? null,
              forceOverwrite: Boolean(reqPayload.forceOverwrite),
            })
            sendJson(res, 200, { ok: true, value: result })
            return
          }

          case 'save-batch': {
            if (!payload || typeof payload !== 'object') {
              sendJson(res, 400, { ok: false, error: 'Invalid save-batch payload' })
              return
            }
            const reqPayload = payload as SaveBatchRequest
            const result = await excelStore.saveCellsToWorkbook({
              excelPath: cfg.excelPath,
              sheetName: reqPayload.sheetName,
              edits: Array.isArray(reqPayload.edits) ? reqPayload.edits : [],
              expectedVersion: reqPayload.expectedVersion ?? null,
              forceOverwrite: Boolean(reqPayload.forceOverwrite),
            })
            sendJson(res, 200, { ok: true, value: result })
            return
          }

          case 'set-config': {
            if (!payload || typeof payload !== 'object') {
              sendJson(res, 400, { ok: false, error: 'Invalid set-config payload' })
              return
            }
            const reqPayload = payload as SetConfigRequest
            if (typeof reqPayload.excelPath !== 'string' || reqPayload.excelPath.trim() === '') {
              sendJson(res, 400, { ok: false, error: 'excelPath must be a non-empty string' })
              return
            }
            const { config: savedCfg } = configStore.write({
              excelPath: reqPayload.excelPath,
              ...(typeof reqPayload.preferredSheet === 'string' && reqPayload.preferredSheet.trim() !== ''
                ? { preferredSheet: reqPayload.preferredSheet.trim() }
                : {}),
            })
            const snapshot = await excelStore.loadWorkbookData(savedCfg.excelPath, savedCfg.preferredSheet)
            sendJson(res, 200, { ok: true, value: snapshot })
            return
          }

          case 'create-sample': {
            const reqPayload = (payload && typeof payload === 'object' ? payload : {}) as CreateSampleRequest
            const targetPath = typeof reqPayload.excelPath === 'string' && reqPayload.excelPath.trim() !== ''
              ? resolve(reqPayload.excelPath.trim())
              : cfg.excelPath
            await excelStore.createSampleWorkbook(targetPath)
            const { config: savedCfg } = configStore.write({ excelPath: targetPath })
            const snapshot = await excelStore.loadWorkbookData(savedCfg.excelPath)
            sendJson(res, 200, { ok: true, value: snapshot })
            return
          }

          default:
            sendJson(res, 404, { ok: false, error: `Unknown endpoint: ${endpoint}` })
            return
        }
      }

      sendJson(res, 404, { ok: false, error: 'Not found' })
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, host, () => {
      server.removeListener('error', rejectListen)
      resolveListen()
    })
  })

  const boundPort = (server.address() as AddressInfo).port
  const pidPath = options.pidFilePath === null
    ? null
    : options.pidFilePath ?? join(dirname(fileURLToPath(import.meta.url)), '.bridge.pid')

  if (pidPath) {
    try {
      mkdirSync(dirname(pidPath), { recursive: true })
      writeFileSync(pidPath, String(process.pid), 'ascii')
    } catch {
      // Ignore PID write failures
    }
  }

  const cleanupPid = () => {
    if (pidPath && existsSync(pidPath)) {
      try {
        rmSync(pidPath, { force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  const close = async () => {
    cleanupPid()
    await new Promise<void>((resolveClose) => {
      server.close(() => resolveClose())
    })
  }

  return { server, port: boundPort, host, close }
}

const isEntry = (() => {
  try {
    return resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
})()

if (isEntry) {
  const { port, host, close } = await startBridgeServer({
    pidFilePath: process.env.BRIDGE_NO_PID === '1' ? null : undefined,
  })
  console.log(`[chrome-incident-drawer-bridge] listening on http://${host}:${port}`)

  const shutdown = () => {
    void close().finally(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('exit', () => {
    try {
      const pidPath = join(dirname(fileURLToPath(import.meta.url)), '.bridge.pid')
      if (existsSync(pidPath)) rmSync(pidPath, { force: true })
    } catch {
      // Ignore
    }
  })
}
