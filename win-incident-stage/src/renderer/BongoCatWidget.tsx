import { useEffect, useMemo, useRef, useState } from 'react'
import type { InputActivityEvent, TodoItem } from '../shared/types.ts'
import { CheckIcon, CloseIcon, PlusIcon, TrashIcon } from './icons.tsx'

interface BongoCatWidgetProps {
  readonly todos: readonly TodoItem[]
  readonly todoIntervalMinutes: number
  readonly playerVisible: boolean
  readonly stageOpen: boolean
  readonly selectedTodoIndex: number
  readonly previewSignal: number
  readonly onSelectTodoIndex: (idx: number) => void
  readonly onToggleStage: () => void
}

interface HoloTodoStageCardProps {
  readonly todos: readonly TodoItem[]
  readonly todoIntervalMinutes: number
  readonly selectedTodoIndex: number
  readonly onSelectTodoIndex: (idx: number) => void
  readonly onUpdateTodos: (nextTodos: TodoItem[], nextInterval?: number) => void
  readonly onClose: () => void
}

const ROTATE_MS = 6000

export function BongoCatWidget({
  todos,
  todoIntervalMinutes,
  playerVisible,
  stageOpen,
  selectedTodoIndex,
  previewSignal,
  onSelectTodoIndex,
  onToggleStage,
}: BongoCatWidgetProps) {
  const [cardHovered, setCardHovered] = useState(false)
  const [holoPulse, setHoloPulse] = useState(false)

  const [leftPawDown, setLeftPawDown] = useState(false)
  const [rightPawDown, setRightPawDown] = useState(false)
  const [mousePos, setMousePos] = useState<{ nx: number; ny: number }>({ nx: 0.5, ny: 0.5 })
  const [keyPulseIdx, setKeyPulseIdx] = useState(0)

  const leftTimerRef = useRef<number | null>(null)
  const rightTimerRef = useRef<number | null>(null)
  const pulseTimerRef = useRef<number | null>(null)

  const pendingTodos = useMemo(() => todos.filter(t => !t.done), [todos])
  const pendingCount = pendingTodos.length

  // Keyboard + Mouse live tracking from Main process (cat itself never shifts on hover/click)
  useEffect(() => {
    const triggerHand = (hand: 'left' | 'right' | 'both') => {
      if (hand === 'left' || hand === 'both') {
        setLeftPawDown(true)
        if (leftTimerRef.current !== null) window.clearTimeout(leftTimerRef.current)
        leftTimerRef.current = window.setTimeout(() => {
          setLeftPawDown(false)
          leftTimerRef.current = null
        }, 115)
      }
      if (hand === 'right' || hand === 'both') {
        setRightPawDown(true)
        if (rightTimerRef.current !== null) window.clearTimeout(rightTimerRef.current)
        rightTimerRef.current = window.setTimeout(() => {
          setRightPawDown(false)
          rightTimerRef.current = null
        }, 115)
      }
      setKeyPulseIdx(n => (n + 1) % 7)
    }

    const offInput = window.stageApi.onInputActivity((evt: InputActivityEvent) => {
      if (evt.type === 'key') {
        triggerHand(evt.hand)
      } else {
        setMousePos({ nx: evt.nx, ny: evt.ny })
      }
    })

    const onLocalKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const rightKeys = new Set(['y', 'u', 'i', 'o', 'p', 'h', 'j', 'k', 'l', 'n', 'm', 'Enter', 'Backspace', 'Shift', 'Control'])
      triggerHand(rightKeys.has(e.key) ? 'right' : 'left')
    }
    window.addEventListener('keydown', onLocalKeyDown)

    return () => {
      offInput()
      window.removeEventListener('keydown', onLocalKeyDown)
      if (leftTimerRef.current !== null) window.clearTimeout(leftTimerRef.current)
      if (rightTimerRef.current !== null) window.clearTimeout(rightTimerRef.current)
      if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current)
    }
  }, [])

  const triggerHoloFlash = () => {
    setHoloPulse(true)
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current)
    pulseTimerRef.current = window.setTimeout(() => {
      setHoloPulse(false)
      pulseTimerRef.current = null
    }, 3200)
  }

  // Hourly auto-rotate highlight across pending todos
  useEffect(() => {
    if (todoIntervalMinutes <= 0 || pendingCount === 0) return
    const ms = todoIntervalMinutes * 60_000
    const timer = window.setInterval(() => {
      onSelectTodoIndex((selectedTodoIndex + 1) % pendingCount)
      triggerHoloFlash()
    }, ms)
    return () => window.clearInterval(timer)
  }, [todoIntervalMinutes, pendingCount, selectedTodoIndex, onSelectTodoIndex])

  // Gentle rotation when user triggers preview from settings
  useEffect(() => {
    if (previewSignal <= 0) return
    triggerHoloFlash()
    if (pendingCount > 1) {
      const rot = window.setInterval(() => {
        onSelectTodoIndex((selectedTodoIndex + 1) % pendingCount)
      }, ROTATE_MS)
      const stop = window.setTimeout(() => window.clearInterval(rot), ROTATE_MS * 2)
      return () => {
        window.clearInterval(rot)
        window.clearTimeout(stop)
      }
    }
  }, [previewSignal, pendingCount, selectedTodoIndex, onSelectTodoIndex])

  const safeIdx = pendingCount > 0 ? selectedTodoIndex % pendingCount : 0
  const currentTodo = pendingTodos[safeIdx] ?? null
  const isTyping = leftPawDown || rightPawDown
  const eyeDx = (mousePos.nx - 0.5) * 2.2
  const eyeDy = (mousePos.ny - 0.5) * 1.6

  return (
    <div className="stg-cat-dock" data-player={playerVisible ? 'true' : 'false'}>
      {/* Stage-Manager Holographic Mini Todo Card right in front of the Bongo Cat */}
      <div className="stg-holo-rail">
        <div
          className="stg-holo-mini-card"
          role="button"
          tabIndex={0}
          data-interactive="true"
          data-active={stageOpen ? 'true' : undefined}
          data-hovered={cardHovered ? 'true' : undefined}
          data-pulse={holoPulse ? 'true' : undefined}
          title={currentTodo ? `待办 (${safeIdx + 1}/${pendingCount}): ${currentTodo.text}\n点击展开全息待办面板` : '点击添加或管理待办事项'}
          onMouseEnter={() => setCardHovered(true)}
          onMouseLeave={() => setCardHovered(false)}
          onClick={onToggleStage}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleStage()
            }
          }}
        >
          <span className="stg-holo-corner-badge">
            {pendingCount > 0 ? pendingCount : '0'}
          </span>

          <div className="stg-holo-mini-top">
            <span className="stg-holo-mini-tag">
              {pendingCount > 0 ? `待办 ${safeIdx + 1}/${pendingCount}` : '待办清单'}
            </span>
            <span className="stg-holo-mini-dot" />
          </div>

          <div className="stg-holo-mini-preview">
            {currentTodo ? currentTodo.text : '全部完成 · 点击管理待办'}
          </div>
        </div>
      </div>

      {/* Stationary Classic Meme Bongo Cat matching user's reference (never moves/rotates on click/hover) */}
      <button
        type="button"
        className="stg-cat-trigger"
        data-interactive="true"
        title="键盘小猫 · 点击展开或收起面前全息待办卡片"
        onClick={onToggleStage}
      >
        <svg className="stg-cat-svg" viewBox="0 0 92 78" width="84" height="71" aria-hidden="true">
          <defs>
            <linearGradient id="stg-cat-desk-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#eef2f8" />
            </linearGradient>
          </defs>

          {/* Chubby White Cat Body & Pointy Ears (kept full proportion, docked tighter to screen edge) */}
          <path
            d="M16 45 C20 30, 29 21, 38 17 L36 6 C36 4, 39 4, 41 7 L47 14 C55 12, 65 13, 73 17 L80 9 C82 7, 85 8, 84 12 L81 24 C87 30, 90 40, 89 54 L14 45 Z"
            fill="#ffffff"
            stroke="#16181d"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Solid black dot eyes with subtle mouse glance */}
          <g transform={`translate(${eyeDx}, ${eyeDy})`}>
            <circle cx="46" cy="31" r="2.6" fill="#16181d" />
            <circle cx="66" cy="34.5" r="2.6" fill="#16181d" />
          </g>

          {/* Classic :3 / w cat mouth */}
          {isTyping ? (
            <path
              d="M50.5 32.8 Q53 36.8 55.8 33.4 Q57.8 37.6 61.2 34.2"
              fill="none"
              stroke="#16181d"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d="M50.5 32.5 Q53.2 35.8 55.8 33.2 Q58 36.4 61.2 33.8"
              fill="none"
              stroke="#16181d"
              strokeWidth="2.0"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Compact tilted white desktop plate */}
          <path
            d="M3 40 L90 53 L90 77 L3 77 Z"
            fill="url(#stg-cat-desk-grad)"
            stroke="#16181d"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />

          {/* Left raised paw with pink toe beans */}
          <g
            className="stg-cat-paw"
            transform={leftPawDown ? 'translate(-3, 10) rotate(-14 27 40)' : 'translate(0, 0)'}
          >
            <path
              d="M17 44 C15 31, 22 24, 29 25 C36 26, 39 34, 36 47 Z"
              fill="#ffffff"
              stroke="#16181d"
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            <ellipse cx="27" cy="38.2" rx="3.1" ry="2.4" fill="#ff9eb5" />
            <circle cx="23" cy="32.6" r="1.35" fill="#ff9eb5" />
            <circle cx="27.2" cy="31" r="1.35" fill="#ff9eb5" />
            <circle cx="31.2" cy="32.9" r="1.35" fill="#ff9eb5" />
          </g>

          {/* Right raised paw with pink toe beans */}
          <g
            className="stg-cat-paw"
            transform={rightPawDown ? 'translate(-4, 10) rotate(12 72 47)' : 'translate(0, 0)'}
          >
            <path
              d="M62 50 C61 36, 68 30, 75 32 C82 34, 84 42, 80 53 Z"
              fill="#ffffff"
              stroke="#16181d"
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            <ellipse cx="72" cy="44.8" rx="3.1" ry="2.4" fill="#ff9eb5" />
            <circle cx="68" cy="39.2" r="1.35" fill="#ff9eb5" />
            <circle cx="72.4" cy="37.7" r="1.35" fill="#ff9eb5" />
            <circle cx="76.5" cy="39.8" r="1.35" fill="#ff9eb5" />
          </g>

          {/* Compressed Slanted Hand-Drawn Keycaps (Arrows + Circular R + ctrl/shift) */}
          <g transform="translate(5, 44) rotate(8.5)">
            <rect
              x="13"
              y="2"
              width="9.5"
              height="7"
              rx="1.8"
              fill={leftPawDown && keyPulseIdx === 0 ? 'rgba(56, 189, 248, 0.38)' : '#ffffff'}
              stroke="#16181d"
              strokeWidth="1.3"
            />
            <rect
              x="2"
              y="10.2"
              width="9.5"
              height="7"
              rx="1.8"
              fill={leftPawDown && keyPulseIdx === 1 ? 'rgba(56, 189, 248, 0.38)' : '#ffffff'}
              stroke="#16181d"
              strokeWidth="1.3"
            />
            <rect
              x="13"
              y="10.2"
              width="9.5"
              height="7"
              rx="1.8"
              fill={leftPawDown && keyPulseIdx === 2 ? 'rgba(56, 189, 248, 0.38)' : '#ffffff'}
              stroke="#16181d"
              strokeWidth="1.3"
            />
            <rect
              x="24"
              y="10.2"
              width="9.5"
              height="7"
              rx="1.8"
              fill={leftPawDown && keyPulseIdx === 3 ? 'rgba(56, 189, 248, 0.38)' : '#ffffff'}
              stroke="#16181d"
              strokeWidth="1.3"
            />

            <ellipse
              cx="45.5"
              cy="11.5"
              rx="7.6"
              ry="5.8"
              fill={isTyping && keyPulseIdx === 4 ? 'rgba(56, 189, 248, 0.38)' : '#ffffff'}
              stroke="#16181d"
              strokeWidth="1.4"
            />
            <text
              x="45.5"
              y="14"
              textAnchor="middle"
              fontSize="7.4"
              fontWeight="800"
              fill="#16181d"
              fontFamily="Segoe UI, sans-serif"
            >
              R
            </text>

            <rect
              x="57.5"
              y="4.2"
              width="19"
              height="7.2"
              rx="1.8"
              fill={rightPawDown && keyPulseIdx === 5 ? 'rgba(56, 189, 248, 0.38)' : '#ffffff'}
              stroke="#16181d"
              strokeWidth="1.3"
            />
            <text x="67" y="9.8" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#16181d" fontFamily="Segoe UI, sans-serif">
              ctrl
            </text>

            <rect
              x="57.5"
              y="13"
              width="21.5"
              height="7.2"
              rx="1.8"
              fill={rightPawDown && keyPulseIdx === 6 ? 'rgba(56, 189, 248, 0.38)' : '#ffffff'}
              stroke="#16181d"
              strokeWidth="1.3"
            />
            <text x="68.2" y="18.5" textAnchor="middle" fontSize="5.2" fontWeight="700" fill="#16181d" fontFamily="Segoe UI, sans-serif">
              shift
            </text>
          </g>
        </svg>
      </button>
    </div>
  )
}

export function HoloTodoStageCard({
  todos,
  todoIntervalMinutes,
  selectedTodoIndex,
  onSelectTodoIndex,
  onUpdateTodos,
  onClose,
}: HoloTodoStageCardProps) {
  const [newTodoText, setNewTodoText] = useState('')
  const pendingCount = useMemo(() => todos.filter(t => !t.done).length, [todos])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleAdd = () => {
    const trimmed = newTodoText.trim()
    if (!trimmed) return
    onUpdateTodos([
      ...todos,
      { id: `todo-${Date.now().toString(36)}`, text: trimmed.slice(0, 120), done: false },
    ])
    setNewTodoText('')
  }

  let pendingCursor = -1

  return (
    <div className="stg-holo-stage-card" data-interactive="true">
      <div className="stg-holo-scanlines" aria-hidden="true" />

      <div className="stg-holo-stage-head">
        <span className="stg-holo-chip">HOLO</span>
        <span className="stg-holo-stage-title">
          待办全息屏幕 · 未完成 {pendingCount}/{todos.length}
        </span>
        <button
          type="button"
          className="stg-icon-btn"
          title="收起全息待办屏幕"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="stg-holo-stage-body">
        <div className="stg-settings-input-row">
          <input
            type="text"
            className="stg-input"
            value={newTodoText}
            placeholder="输入新的待办事项，回车投射到全息卡片..."
            onChange={e => setNewTodoText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd()
            }}
          />
          <button type="button" className="stg-btn" data-primary="true" onClick={handleAdd}>
            <PlusIcon />
            <span>添加</span>
          </button>
        </div>

        <div className="stg-holo-todo-list">
          {todos.length === 0 && (
            <div className="stg-todo-empty">暂无待办事项，添加一条就会显示在小猫面前的全息小卡上</div>
          )}
          {todos.map((item) => {
            if (!item.done) pendingCursor += 1
            const idxForPending = !item.done ? pendingCursor : -1
            const isPinned = idxForPending >= 0 && pendingCount > 0 && idxForPending === selectedTodoIndex % pendingCount

            return (
              <div
                key={item.id}
                className="stg-holo-todo-row"
                data-done={item.done ? 'true' : undefined}
                data-pinned={isPinned ? 'true' : undefined}
                onClick={() => {
                  if (idxForPending >= 0) onSelectTodoIndex(idxForPending)
                }}
              >
                <button
                  type="button"
                  className="stg-todo-check"
                  data-done={item.done ? 'true' : undefined}
                  title={item.done ? '标为未完成' : '标为已完成'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateTodos(todos.map(t => (t.id === item.id ? { ...t, done: !t.done } : t)))
                  }}
                >
                  {item.done && <CheckIcon />}
                </button>
                <span className="stg-todo-text" title={item.text}>
                  {item.text}
                </span>
                {isPinned && <span className="stg-holo-Pin">当前展示</span>}
                <button
                  type="button"
                  className="stg-bubble-icon-btn"
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateTodos(todos.filter(t => t.id !== item.id))
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            )
          })}
        </div>

        <div className="stg-holo-stage-foot">
          <span className="stg-holo-hint">点击未完成项可切换小猫面前小卡展示</span>
          <select
            className="stg-select"
            style={{ width: 136 }}
            value={todoIntervalMinutes}
            onChange={e => onUpdateTodos([...todos], Number(e.target.value))}
          >
            <option value={60}>每 60 分钟轮播</option>
            <option value={30}>每 30 分钟轮播</option>
            <option value={15}>每 15 分钟轮播</option>
            <option value={120}>每 120 分钟轮播</option>
            <option value={0}>仅手动切换</option>
          </select>
        </div>
      </div>
    </div>
  )
}
