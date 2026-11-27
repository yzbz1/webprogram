import { API_CLIENT_ROUTE } from '../shared/types.ts'
import { IncidentDrawer } from './IncidentDrawer.tsx'
import { DRAWER_CSS, DRAWER_PLUGIN_ID, DRAWER_STYLE_ID } from './styles.ts'

export const inject = ['slots']

interface ApiEnvelope<T> {
  readonly ok: boolean
  readonly value?: T
  readonly error?: {
    readonly code?: string
    readonly message?: string
  }
}

interface ClientContext {
  slots: {
    inject(slotName: string, factory: () => () => void): () => void
    register(
      options: {
        name: string
        id: string
        locale?: string
        inject?: () => Record<string, unknown>
      },
      component: unknown,
    ): () => void
  }
  effect(callback: () => void | (() => void), label?: string): () => void
}

function mountStyles(): () => void {
  if (typeof document === 'undefined') return () => undefined
  const existing = document.querySelector(`style[data-plugin-css=${JSON.stringify(DRAWER_STYLE_ID)}]`)
  if (existing) return () => undefined
  const tag = document.createElement('style')
  tag.dataset.plugin = DRAWER_PLUGIN_ID
  tag.dataset.pluginCss = DRAWER_STYLE_ID
  tag.textContent = DRAWER_CSS
  document.head.appendChild(tag)
  return () => {
    tag.remove()
  }
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => mountStyles(), 'incident-drawer: styles')

  const rpcCall = async <T,>(
    endpoint: string,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<T> => {
    const response = await fetch(API_CLIENT_ROUTE, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint, payload }),
      ...(signal ? { signal } : {}),
    })
    let data: ApiEnvelope<T> | null = null
    try {
      data = (await response.json()) as ApiEnvelope<T>
    } catch {
      data = null
    }
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error?.message || `请求 ${endpoint} 失败 (HTTP ${response.status})`)
    }
    return data.value as T
  }

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'incident-drawer',
        inject: () => ({ rpcCall }),
      },
      IncidentDrawer,
    ),
  )
}
