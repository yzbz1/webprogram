import {
  API_ROUTE_PATH,
  CLIENT_HEADER_NAME,
  CLIENT_HEADER_VALUE,
  DEFAULT_BRIDGE_PORT,
  HEALTH_ROUTE_PATH,
  type BridgeApiResponse,
  type BridgeHealthResponse,
} from '../shared/types.ts'

async function getBridgePort(): Promise<number> {
  try {
    const res = await chrome.storage.local.get('settings')
    const port = Number((res?.settings as { bridgePort?: unknown } | undefined)?.bridgePort)
    if (Number.isInteger(port) && port > 0 && port <= 65535) {
      return port
    }
  } catch {
    // Use default port
  }
  return DEFAULT_BRIDGE_PORT
}

async function callBridgeApi(endpoint: string, payload: unknown): Promise<BridgeApiResponse<unknown>> {
  const port = await getBridgePort()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`http://127.0.0.1:${port}${API_ROUTE_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CLIENT_HEADER_NAME]: CLIENT_HEADER_VALUE,
      },
      body: JSON.stringify({ endpoint, payload }),
      signal: controller.signal,
    })

    let data: { ok?: boolean; value?: unknown; error?: string } | null = null
    try {
      data = (await res.json()) as { ok?: boolean; value?: unknown; error?: string }
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error || `请求失败 (HTTP ${res.status})`,
      }
    }
    return { ok: true, value: data.value }
  } catch (err) {
    return {
      ok: false,
      offline: true,
      error: err instanceof Error && err.name === 'AbortError'
        ? '本地 Excel 服务响应超时'
        : '未连接到本地 Excel 服务，请启动 start-bridge-silent.vbs',
    }
  } finally {
    clearTimeout(timer)
  }
}

async function checkBridgeHealth(explicitPort?: number): Promise<BridgeHealthResponse> {
  const port = explicitPort && explicitPort > 0 && explicitPort <= 65535
    ? explicitPort
    : await getBridgePort()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)

  try {
    const res = await fetch(`http://127.0.0.1:${port}${HEALTH_ROUTE_PATH}`, {
      method: 'GET',
      signal: controller.signal,
    })
    if (!res.ok) {
      return { ok: false, offline: true, error: `HTTP ${res.status}` }
    }
    const data = (await res.json()) as BridgeHealthResponse
    return data
  } catch {
    return { ok: false, offline: true, error: '本地服务未运行' }
  } finally {
    clearTimeout(timer)
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false
  const msg = message as { type?: string; endpoint?: string; payload?: unknown; port?: number }

  if (msg.type === 'INCIDENT_API' && typeof msg.endpoint === 'string') {
    void callBridgeApi(msg.endpoint, msg.payload).then(sendResponse)
    return true
  }

  if (msg.type === 'BRIDGE_HEALTH') {
    void checkBridgeHealth(typeof msg.port === 'number' ? msg.port : undefined).then(sendResponse)
    return true
  }

  return false
})
