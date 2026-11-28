/** Crisp inline SVG icons for Windows Stage Manager Workspace & Desktop Widgets. */

import type { ShortcutActionType } from '../shared/types.ts'

export function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      className={spinning ? 'stg-spin' : undefined}
      aria-hidden="true"
    >
      <path
        d="M13.5 8a5.5 5.5 0 1 1-1.35-3.61M13.5 2.75v2.75h-2.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SettingsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M8 1.8v1.3M8 12.9v1.3M14.2 8h-1.3M3.1 8H1.8M12.38 3.62l-.92.92M4.54 11.46l-.92.92M12.38 12.38l-.92-.92M4.54 4.54l-.92-.92"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CollapseRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.25 4.25L10 8l-3.75 3.75M11.75 4.25v7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PeekLeftIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3.5L5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 3.5h6.5V10M12.2 3.8L4.2 11.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function WarnIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.3L14.2 13H1.8L8 2.3z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M8 6.3v3.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r="0.7" fill="currentColor" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.3l3.1 3.1 6-6.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.2v9.6M3.2 8h9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 4.5h9M6.2 4.5V3.2h3.6v1.3M5 4.5l.6 8.3h4.8l.6-8.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PrevTrackIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="2.6" y="3.2" width="1.8" height="9.6" rx="0.9" />
      <path d="M12.6 3.5a.8.8 0 0 1 1.2.7v7.6a.8.8 0 0 1-1.2.7L5.8 8.7a.8.8 0 0 1 0-1.4l6.8-3.8z" />
    </svg>
  )
}

export function NextTrackIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="11.6" y="3.2" width="1.8" height="9.6" rx="0.9" />
      <path d="M3.4 3.5a.8.8 0 0 0-1.2.7v7.6a.8.8 0 0 0 1.2.7l6.8-3.8a.8.8 0 0 0 0-1.4L3.4 3.5z" />
    </svg>
  )
}

export function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.6 3.3a.85.85 0 0 1 1.28-.73l7.3 4.7a.85.85 0 0 1 0 1.44l-7.3 4.7A.85.85 0 0 1 4.6 12.7V3.3z" />
    </svg>
  )
}

export function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="4" y="3.2" width="2.8" height="9.6" rx="1.1" />
      <rect x="9.2" y="3.2" width="2.8" height="9.6" rx="1.1" />
    </svg>
  )
}

export function MusicNoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 17.5V6.6l9-2v10.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.8" cy="17.5" r="2.3" fill="currentColor" />
      <circle cx="15.8" cy="15.5" r="2.3" fill="currentColor" />
    </svg>
  )
}

export function TrafficLightGlyph({ actionType }: { actionType: ShortcutActionType }) {
  switch (actionType) {
    case 'hotkey':
      return (
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M5.5 6V4.5a1.5 1.5 0 1 0-1.5 1.5h8a1.5 1.5 0 1 0-1.5-1.5V6M5.5 10v1.5A1.5 1.5 0 1 1 4 10h8a1.5 1.5 0 1 1-1.5 1.5V10M5.5 6h5v4h-5V6z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'url':
      return (
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M5 11L11 5M6.5 5H11v4.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'path':
    case 'open-excel':
      return (
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2.5 5h4l1.3 1.5h5.7v6h-11V5z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        </svg>
      )
    case 'settings':
      return (
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="2" />
          <path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      )
    case 'todos':
      return (
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4.2 8.2l2.6 2.6 5-5.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'refresh':
      return (
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M13 8a5 5 0 1 1-1.3-3.4M13 2.5v2.6h-2.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'toggle-hide':
      return (
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 8h9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )
  }
}
