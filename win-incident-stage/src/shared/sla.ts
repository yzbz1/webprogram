/** Service category defaults and working-hours SLA calculation (Mon-Fri 08:30-18:00). */

export const DEFAULT_SERVICE_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  基础架构: ['网络与网关', '服务器与磁盘', '容器与证书'],
  应用系统: ['单点登录与认证', 'OA与审批流', '财务与报表'],
  中间件与数据: ['消息队列', '数据库与SQL', '缓存与检索'],
  发布与运维: ['CI/CD流水线', 'CDN与静态资源', '定时任务调度'],
}

const WORK_START_MIN = 8 * 60 + 30 // 08:30
const WORK_END_MIN = 18 * 60 // 18:00
const MS_PER_MIN = 60_000
const MS_PER_HOUR = 3_600_000

export function isServiceCategoryHeader(header: string): boolean {
  const h = header.trim()
  return h.includes('服务分类') && !h.includes('子分类')
}

export function isServiceSubCategoryHeader(header: string): boolean {
  const h = header.trim()
  return h.includes('服务子分类') || h.includes('子分类')
}

export function isSlaHeader(header: string): boolean {
  return /sla|到期时间/i.test(header.trim())
}

export function parseLocalDateTime(raw: string): Date | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const match =
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(
      trimmed,
    )
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = match[4] !== undefined ? Number(match[4]) : 18
  const minute = match[5] !== undefined ? Number(match[5]) : 0
  const second = match[6] !== undefined ? Number(match[6]) : 0

  if (
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null
  }

  const d = new Date(year, month - 1, day, hour, minute, second, 0)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null
  }
  return d
}

export function formatLocalDateTime(date: Date): string {
  const y = String(date.getFullYear())
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function sumWorkingMsBetween(startMs: number, endMs: number): number {
  if (endMs <= startMs) return 0
  const cursor = new Date(startMs)
  cursor.setHours(0, 0, 0, 0)

  let totalMs = 0
  for (let days = 0; days < 366; days += 1) {
    const dayStartMs = cursor.getTime()
    if (dayStartMs >= endMs) break

    const dow = cursor.getDay() // 0 = Sun, 6 = Sat
    if (dow >= 1 && dow <= 5) {
      const workStart = dayStartMs + WORK_START_MIN * MS_PER_MIN
      const workEnd = dayStartMs + WORK_END_MIN * MS_PER_MIN
      const overlapStart = Math.max(startMs, workStart)
      const overlapEnd = Math.min(endMs, workEnd)
      if (overlapEnd > overlapStart) {
        totalMs += overlapEnd - overlapStart
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return totalMs
}

/**
 * Computes remaining working hours between `now` and `deadline`,
 * counting only Mon-Fri 08:30-18:00 (negative if already past deadline).
 */
export function computeWorkingHoursRemaining(deadline: Date, now: Date = new Date()): number {
  const startMs = now.getTime()
  const endMs = deadline.getTime()
  if (endMs === startMs) return 0
  if (endMs > startMs) {
    return sumWorkingMsBetween(startMs, endMs) / MS_PER_HOUR
  }
  return -(sumWorkingMsBetween(endMs, startMs) / MS_PER_HOUR)
}

/** Advances `start` by `hours` working hours (Mon-Fri 08:30-18:00). Negative values move backward. */
export function addWorkingHours(start: Date, hours: number): Date {
  if (hours === 0) return new Date(start.getTime())
  const forward = hours > 0
  let remainingMs = Math.abs(hours) * MS_PER_HOUR
  const cursor = new Date(start.getTime())

  for (let step = 0; step < 500 && remainingMs > 0; step += 1) {
    const dayBase = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0, 0, 0, 0)
    const dow = dayBase.getDay()
    if (dow >= 1 && dow <= 5) {
      const workStart = dayBase.getTime() + WORK_START_MIN * MS_PER_MIN
      const workEnd = dayBase.getTime() + WORK_END_MIN * MS_PER_MIN
      if (forward) {
        const segStart = Math.max(cursor.getTime(), workStart)
        if (segStart < workEnd) {
          const avail = workEnd - segStart
          if (remainingMs <= avail) {
            return new Date(segStart + remainingMs)
          }
          remainingMs -= avail
        }
      } else {
        const segEnd = Math.min(cursor.getTime(), workEnd)
        if (segEnd > workStart) {
          const avail = segEnd - workStart
          if (remainingMs <= avail) {
            return new Date(segEnd - remainingMs)
          }
          remainingMs -= avail
        }
      }
    }
    if (forward) {
      dayBase.setDate(dayBase.getDate() + 1)
      cursor.setTime(dayBase.getTime() + WORK_START_MIN * MS_PER_MIN)
    } else {
      dayBase.setDate(dayBase.getDate() - 1)
      cursor.setTime(dayBase.getTime() + WORK_END_MIN * MS_PER_MIN)
    }
  }
  return cursor
}

export interface SlaEvaluation {
  readonly deadline: Date
  readonly remainingHours: number
  readonly tone: 'err' | 'warn' | 'ok'
  readonly label: string
  readonly shortLabel: string
}

export function evaluateSla(rawValue: string, now: Date = new Date()): SlaEvaluation | null {
  const deadline = parseLocalDateTime(rawValue)
  if (!deadline) return null

  const remainingHours = computeWorkingHoursRemaining(deadline, now)
  const tone: 'err' | 'warn' | 'ok' =
    remainingHours < 4 ? 'err' : remainingHours <= 8 ? 'warn' : 'ok'

  let label: string
  let shortLabel: string
  if (deadline.getTime() <= now.getTime()) {
    label = '已超时'
    shortLabel = '超时'
  } else if (remainingHours < 0.1) {
    label = '即将到期'
    shortLabel = '0.1h'
  } else {
    const rounded = remainingHours.toFixed(1)
    label = `工作剩余 ${rounded}h`
    shortLabel = `${rounded}h`
  }

  return { deadline, remainingHours, tone, label, shortLabel }
}
