import { existsSync, watch, type FSWatcher } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import {
  API_ROUTE_PATH,
  type CreateSampleRequest,
  type DrawerSnapshot,
  type LoadRequest,
  type SaveBatchRequest,
  type SaveCellRequest,
  type SaveResult,
  type SetConfigRequest,
  type StatusCheckRequest,
  type StatusCheckResult,
} from '../shared/types.ts'
import { ConfigStore } from './config-store.ts'
import type * as ExcelStoreModule from './excel-store.ts'

const require = createRequire(import.meta.url)
const excelStore = require('./excel-store.cjs') as typeof ExcelStoreModule

export const name = 'incident-drawer'
export const inject = ['connection']

export interface PluginConfig {
  excelPath?: string
}

interface ConnectionFetchHost {
  fetch: {
    register(route: {
      path: string
      methods: readonly string[]
      requestBody: 'buffered' | 'streaming'
      fetch(request: Request): Promise<Response>
    }): () => Promise<void>
  }
}

interface HostContext {
  connection: ConnectionFetchHost
  effect(callback: () => void | (() => void), label?: string): () => void
  logger?: (name: string) => { warn(msg: string): void; info?(msg: string): void }
}

function jsonOk<T>(value: T): Response {
  return Response.json(
    { ok: true, value },
    { headers: { 'cache-control': 'no-store' } },
  )
}

function jsonErr(code: string, message: string, status = 400): Response {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { 'cache-control': 'no-store' } },
  )
}

export function apply(ctx: HostContext, pluginConfig?: PluginConfig): void {
  const configStore = new ConfigStore(pluginConfig?.excelPath)
  let currentVersion: string | null = null
  let watcher: FSWatcher | null = null
  let watchedDir = ''

  const refreshWatcher = (excelPath: string): void => {
    const dir = dirname(resolve(excelPath))
    if (watcher && watchedDir === dir) return
    watcher?.close()
    watcher = null
    watchedDir = dir
    if (!existsSync(dir)) return
    try {
      watcher = watch(dir, { persistent: false }, (_eventType, filename) => {
        if (!filename) return
        const targetName = resolve(excelPath).toLowerCase()
        if (resolve(dir, filename.toString()).toLowerCase() === targetName) {
          void excelStore.computeFileVersion(excelPath).then((ver) => {
            currentVersion = ver
          }).catch(() => undefined)
        }
      })
    } catch {
      watcher = null
    }
  }

  ctx.effect(() => () => {
    watcher?.close()
    watcher = null
  }, 'incident-drawer: file watcher')

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: API_ROUTE_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request: Request): Promise<Response> => {
          let body: unknown
          try {
            body = await request.json()
          } catch {
            return jsonErr('incident-drawer/bad-request', 'request body must be valid JSON', 400)
          }
          if (!body || typeof body !== 'object') {
            return jsonErr('incident-drawer/bad-request', 'invalid request envelope', 400)
          }

          const { endpoint, payload } = body as { endpoint?: unknown; payload?: unknown }
          if (typeof endpoint !== 'string' || endpoint.trim() === '') {
            return jsonErr('incident-drawer/bad-request', 'missing endpoint', 400)
          }

          const cfg = configStore.read()
          refreshWatcher(cfg.excelPath)

          try {
            switch (endpoint) {
              case 'load': {
                const req = (payload && typeof payload === 'object' ? payload : {}) as LoadRequest
                const sheetName = typeof req.sheetName === 'string' && req.sheetName.trim() !== ''
                  ? req.sheetName.trim()
                  : cfg.preferredSheet
                const snapshot: DrawerSnapshot = await excelStore.loadWorkbookData(cfg.excelPath, sheetName)
                currentVersion = snapshot.version
                return jsonOk(snapshot)
              }

              case 'check-status': {
                const req = (payload && typeof payload === 'object' ? payload : {}) as StatusCheckRequest
                const known = typeof req.knownVersion === 'string' || req.knownVersion === null
                  ? req.knownVersion
                  : currentVersion
                const status: StatusCheckResult = await excelStore.checkWorkbookStatus(cfg.excelPath, known)
                currentVersion = status.currentVersion
                return jsonOk(status)
              }

              case 'save-cell': {
                if (!payload || typeof payload !== 'object') {
                  return jsonErr('incident-drawer/bad-request', 'invalid save-cell payload', 400)
                }
                const req = payload as SaveCellRequest
                const res: SaveResult = await excelStore.saveCellsToWorkbook({
                  excelPath: cfg.excelPath,
                  sheetName: req.sheetName,
                  edits: [{ rowNumber: req.rowNumber, colIndex: req.colIndex, value: String(req.value ?? '') }],
                  expectedVersion: req.expectedVersion ?? null,
                  forceOverwrite: Boolean(req.forceOverwrite),
                })
                if (res.version) currentVersion = res.version
                return jsonOk(res)
              }

              case 'save-batch': {
                if (!payload || typeof payload !== 'object') {
                  return jsonErr('incident-drawer/bad-request', 'invalid save-batch payload', 400)
                }
                const req = payload as SaveBatchRequest
                const res: SaveResult = await excelStore.saveCellsToWorkbook({
                  excelPath: cfg.excelPath,
                  sheetName: req.sheetName,
                  edits: Array.isArray(req.edits) ? req.edits : [],
                  expectedVersion: req.expectedVersion ?? null,
                  forceOverwrite: Boolean(req.forceOverwrite),
                })
                if (res.version) currentVersion = res.version
                return jsonOk(res)
              }

              case 'set-config': {
                if (!payload || typeof payload !== 'object') {
                  return jsonErr('incident-drawer/bad-request', 'invalid set-config payload', 400)
                }
                const req = payload as SetConfigRequest
                if (typeof req.excelPath !== 'string' || req.excelPath.trim() === '') {
                  return jsonErr('incident-drawer/bad-request', 'excelPath must be a non-empty string', 400)
                }
                const { config: savedCfg } = configStore.write({
                  excelPath: req.excelPath,
                  ...(typeof req.preferredSheet === 'string' && req.preferredSheet.trim() !== ''
                    ? { preferredSheet: req.preferredSheet.trim() }
                    : {}),
                })
                refreshWatcher(savedCfg.excelPath)
                const snapshot = await excelStore.loadWorkbookData(savedCfg.excelPath, savedCfg.preferredSheet)
                currentVersion = snapshot.version
                return jsonOk(snapshot)
              }

              case 'create-sample': {
                const req = (payload && typeof payload === 'object' ? payload : {}) as CreateSampleRequest
                const targetPath = typeof req.excelPath === 'string' && req.excelPath.trim() !== ''
                  ? resolve(req.excelPath.trim())
                  : cfg.excelPath
                await excelStore.createSampleWorkbook(targetPath)
                const { config: savedCfg } = configStore.write({ excelPath: targetPath })
                refreshWatcher(savedCfg.excelPath)
                const snapshot = await excelStore.loadWorkbookData(savedCfg.excelPath)
                currentVersion = snapshot.version
                return jsonOk(snapshot)
              }

              default:
                return jsonErr('incident-drawer/not-found', `unknown endpoint: ${endpoint}`, 404)
            }
          } catch (error) {
            return jsonErr(
              'incident-drawer/internal',
              error instanceof Error ? error.message : String(error),
              500,
            )
          }
        },
      }),
    'incident-drawer: /api/incident-drawer route',
  )
}
