/** Shadow DOM isolated CSS replicating the DeepSeek Harness native floating drawer style. */

export const DRAWER_CSS = `
:host {
  all: initial;
}

.idw-root {
  position: fixed;
  top: 64px;
  right: 0;
  bottom: 40px;
  z-index: 2147483640;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: var(--idw-label-1);

  --idw-hairline: 0.5px;
  --idw-glass-bg: rgba(252, 253, 254, 0.88);
  --idw-tab-bg: rgb(255, 255, 255);
  --idw-tab-hover-bg: rgb(249, 250, 251);
  --idw-input-bg: rgb(255, 255, 255);
  --idw-input-hover-bg: rgb(245, 246, 247);
  --idw-border: rgba(15, 23, 42, 0.13);
  --idw-border-soft: rgba(15, 23, 42, 0.09);
  --idw-border-input: rgba(15, 23, 42, 0.16);
  --idw-accent: rgb(65, 118, 230);
  --idw-label-1: rgb(15, 17, 21);
  --idw-label-2: rgb(97, 102, 107);
  --idw-label-3: rgb(129, 133, 140);
  --idw-hover-fill: rgba(15, 23, 42, 0.06);
  --idw-warn-fg: rgb(180, 95, 12);
  --idw-warn-bg: rgb(254, 245, 231);
  --idw-warn-border: rgb(245, 158, 11);
  --idw-ok-fg: rgb(34, 197, 94);
  --idw-err-fg: rgb(220, 38, 38);
  --idw-err-bg: rgba(239, 68, 68, 0.08);
  --idw-shadow-tab: -2px 2px 8px rgba(15, 23, 42, 0.06);
  --idw-shadow-hover: -8px 10px 26px rgba(15, 23, 42, 0.14), -2px 3px 8px rgba(15, 23, 42, 0.06);
  --idw-shadow-expanded: -14px 18px 44px rgba(15, 23, 42, 0.18), -3px 6px 14px rgba(15, 23, 42, 0.08);
  --idw-shadow-popover: -10px 14px 36px rgba(15, 23, 42, 0.16), -2px 4px 12px rgba(15, 23, 42, 0.06);
  --idw-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

.idw-root,
.idw-root * {
  box-sizing: border-box;
}

@media (max-resolution: 1.25dppx) {
  .idw-root {
    --idw-hairline: 1px;
  }
}

.idw-root[data-theme='dark'] {
  --idw-glass-bg: rgba(40, 41, 46, 0.86);
  --idw-tab-bg: rgb(35, 35, 36);
  --idw-tab-hover-bg: rgb(44, 44, 46);
  --idw-input-bg: rgb(24, 24, 27);
  --idw-input-hover-bg: rgb(48, 49, 54);
  --idw-border: rgba(255, 255, 255, 0.16);
  --idw-border-soft: rgba(255, 255, 255, 0.12);
  --idw-border-input: rgba(255, 255, 255, 0.2);
  --idw-accent: rgb(122, 170, 255);
  --idw-label-1: rgb(245, 246, 248);
  --idw-label-2: rgb(196, 200, 208);
  --idw-label-3: rgb(148, 154, 164);
  --idw-hover-fill: rgba(255, 255, 255, 0.08);
  --idw-warn-fg: rgb(251, 191, 36);
  --idw-warn-bg: rgba(120, 74, 12, 0.52);
  --idw-warn-border: rgba(245, 158, 11, 0.6);
  --idw-err-fg: rgb(248, 113, 113);
  --idw-err-bg: rgba(127, 29, 29, 0.36);
  --idw-shadow-tab: -2px 2px 10px rgba(0, 0, 0, 0.34);
  --idw-shadow-hover: -8px 10px 28px rgba(0, 0, 0, 0.48), -2px 4px 10px rgba(0, 0, 0, 0.28);
  --idw-shadow-expanded: -14px 18px 48px rgba(0, 0, 0, 0.62), -3px 6px 16px rgba(0, 0, 0, 0.36);
  --idw-shadow-popover: -12px 16px 40px rgba(0, 0, 0, 0.56);
}

/* Zen Peek ear when drawer is hidden */
.idw-peek {
  pointer-events: auto;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 44px;
  margin-top: 4px;
  padding: 0;
  border: var(--idw-hairline) solid var(--idw-border);
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: var(--idw-glass-bg);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  color: var(--idw-label-2);
  box-shadow: var(--idw-shadow-tab);
  cursor: pointer;
  opacity: 0.72;
  transition: width 180ms var(--idw-ease), opacity 180ms ease, background 150ms ease;
}

.idw-peek:hover {
  width: 24px;
  opacity: 1;
  color: var(--idw-label-1);
}

.idw-peek-dot {
  position: absolute;
  top: 5px;
  left: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

/* Top compact floating toolbar */
.idw-toolbar {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 6px 0 8px;
  border: var(--idw-hairline) solid var(--idw-border-soft);
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: var(--idw-glass-bg);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  box-shadow: var(--idw-shadow-tab);
  opacity: 0.88;
  transition: opacity 160ms ease, box-shadow 180ms ease;
}

.idw-toolbar:hover,
.idw-toolbar[data-active='true'] {
  opacity: 1;
  box-shadow: var(--idw-shadow-hover);
}

.idw-status-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 7px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--idw-label-2);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: background 140ms ease, color 140ms ease;
}

.idw-status-btn:hover {
  background: var(--idw-hover-fill);
  color: var(--idw-label-1);
}

.idw-status-btn[data-state='dirty'] {
  background: rgba(65, 118, 230, 0.14);
  color: var(--idw-accent);
}

.idw-status-btn[data-state='error'] {
  background: var(--idw-err-bg);
  color: var(--idw-err-fg);
}

.idw-status-btn[data-state='saved'] {
  color: var(--idw-ok-fg);
}

.idw-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--idw-label-3);
}

.idw-dot[data-tone='ok'] { background: var(--idw-ok-fg); }
.idw-dot[data-tone='busy'] { background: var(--idw-accent); animation: idw-pulse 1s infinite ease-in-out; }
.idw-dot[data-tone='warn'] { background: var(--idw-warn-border); }
.idw-dot[data-tone='err'] { background: var(--idw-err-fg); }
.idw-dot[data-tone='accent'] { background: var(--idw-accent); }

@keyframes idw-pulse {
  0%, 100% { opacity: 0.45; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}

.idw-icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--idw-label-2);
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.idw-icon-btn:hover {
  background: var(--idw-hover-fill);
  color: var(--idw-label-1);
}

.idw-icon-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.idw-badge-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--idw-warn-border);
}

.idw-spin {
  animation: idw-spin 0.8s linear infinite;
}

@keyframes idw-spin {
  to { transform: rotate(360deg); }
}

/* Alert / Conflict / Offline Banners */
.idw-banner {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 6px 10px 6px 11px;
  max-width: 340px;
  border: var(--idw-hairline) solid var(--idw-warn-border);
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: var(--idw-warn-bg);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  color: var(--idw-warn-fg);
  font-size: 11.5px;
  line-height: 1.35;
  box-shadow: var(--idw-shadow-hover);
}

.idw-banner[data-tone='error'] {
  border-color: var(--idw-err-fg);
  background: var(--idw-glass-bg);
  color: var(--idw-err-fg);
}

.idw-banner-text {
  flex: 1;
  min-width: 0;
}

.idw-banner-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.idw-mini-pill {
  height: 20px;
  padding: 0 7px;
  border: var(--idw-hairline) solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 140ms ease;
}

.idw-mini-pill:hover {
  background: var(--idw-hover-fill);
}

.idw-mini-pill[data-primary='true'] {
  background: var(--idw-accent);
  border-color: var(--idw-accent);
  color: #fff;
}

/* Settings Popover */
.idw-settings {
  pointer-events: auto;
  width: 320px;
  max-width: calc(100vw - 24px);
  margin-top: 6px;
  padding: 12px 13px;
  border: var(--idw-hairline) solid var(--idw-border);
  border-right: none;
  border-radius: 12px 0 0 12px;
  background: var(--idw-glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow: var(--idw-shadow-popover);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 50;
}

.idw-settings-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--idw-label-1);
}

.idw-settings-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.idw-settings-label {
  font-size: 11px;
  color: var(--idw-label-2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.idw-settings-input-row {
  display: flex;
  gap: 6px;
}

.idw-input,
.idw-select {
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: var(--idw-hairline) solid var(--idw-border-input);
  border-radius: 6px;
  background: var(--idw-input-bg);
  color: var(--idw-label-1);
  font-family: inherit;
  font-size: 12px;
  outline: none;
  transition: box-shadow 140ms ease, background 140ms ease;
}

.idw-input:focus,
.idw-select:focus {
  box-shadow: inset 0 0 0 1px var(--idw-accent), 0 0 0 2px rgba(65, 118, 230, 0.18);
}

.idw-btn {
  height: 28px;
  padding: 0 10px;
  border: var(--idw-hairline) solid var(--idw-border-input);
  border-radius: 6px;
  background: var(--idw-input-bg);
  color: var(--idw-label-1);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 140ms ease;
}

.idw-btn:hover {
  background: var(--idw-hover-fill);
}

.idw-btn[data-primary='true'] {
  background: var(--idw-accent);
  border-color: var(--idw-accent);
  color: #fff;
}

/* Ticket stack container */
.idw-list {
  pointer-events: none !important;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  margin-top: 8px;
  padding: 4px 0 14px 28px;
  overflow-y: auto;
  overflow-x: visible;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  scrollbar-width: none;
}

.idw-list::-webkit-scrollbar {
  display: none;
}

/* Ticket card (collapsed -> hover pill -> click-expanded card) */
.idw-card {
  pointer-events: auto;
  position: relative;
  flex: none;
  width: 74px;
  border: var(--idw-hairline) solid var(--idw-border);
  border-right: none;
  border-radius: 8px 0 0 8px;
  background: var(--idw-tab-bg);
  box-shadow: var(--idw-shadow-tab);
  opacity: 0.84;
  overflow: hidden;
  transition:
    width 220ms var(--idw-ease),
    border-radius 220ms var(--idw-ease),
    background 160ms ease,
    box-shadow 220ms var(--idw-ease),
    opacity 160ms ease,
    border-color 160ms ease;
}

.idw-card[data-state='hover'] {
  width: var(--idw-hover-width, 224px);
  border-radius: 12px 0 0 12px;
  background: var(--idw-tab-hover-bg);
  box-shadow: var(--idw-shadow-hover);
  opacity: 1;
  z-index: 44;
}

.idw-card[data-state='expanded'] {
  width: var(--idw-expanded-width, 328px);
  border-radius: 14px 0 0 14px;
  border-color: rgba(65, 118, 230, 0.45);
  background: var(--idw-glass-bg);
  backdrop-filter: blur(24px) saturate(185%);
  -webkit-backdrop-filter: blur(24px) saturate(185%);
  box-shadow: var(--idw-shadow-expanded);
  opacity: 1;
  z-index: 46;
}

.idw-card[data-resizing='true'] {
  transition: none !important;
}

.idw-card[data-state='expanded']::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2.5px;
  border-radius: 0 2px 2px 0;
  background: var(--idw-accent);
  pointer-events: none;
}

.idw-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 7px;
  cursor: ew-resize;
  z-index: 5;
  touch-action: none;
}

.idw-resize-handle:hover::after,
.idw-card[data-resizing='true'] .idw-resize-handle::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 16px;
  bottom: 16px;
  width: 2px;
  border-radius: 2px;
  background: var(--idw-accent);
  opacity: 0.65;
}

.idw-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px 0 10px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.idw-card[data-state='hover'] .idw-card-head {
  height: 28px;
  padding: 0 10px 0 12px;
}

.idw-card[data-state='expanded'] .idw-card-head {
  height: 36px;
  padding: 0 10px 0 14px;
  border-bottom: var(--idw-hairline) solid var(--idw-border-soft);
}

.idw-id-short {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--idw-label-2);
}

.idw-id-full {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--idw-label-1);
}

.idw-card[data-state='expanded'] .idw-id-full {
  user-select: text;
  cursor: text;
}

.idw-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.idw-hover-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--idw-label-3);
  opacity: 0;
  animation: idw-fade-in 150ms 50ms ease forwards;
}

@keyframes idw-fade-in {
  to { opacity: 1; }
}

.idw-open-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: rgba(65, 118, 230, 0.12);
  color: var(--idw-accent);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 140ms ease;
}

.idw-open-link:hover:not(:disabled) {
  background: rgba(65, 118, 230, 0.22);
}

.idw-open-link:disabled {
  background: transparent;
  color: var(--idw-label-3);
  opacity: 0.45;
  cursor: not-allowed;
}

.idw-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--idw-label-3);
  transition: transform 220ms var(--idw-ease);
}

.idw-card[data-state='expanded'] .idw-chevron {
  transform: rotate(180deg);
}

.idw-accordion {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 240ms var(--idw-ease);
}

.idw-card[data-state='expanded'] .idw-accordion {
  grid-template-rows: 1fr;
}

.idw-accordion-inner {
  overflow: hidden;
  min-height: 0;
}

.idw-form {
  max-height: min(68vh, calc(100vh - 200px));
  overflow-y: auto;
  padding: 10px 12px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  scrollbar-width: thin;
}

.idw-form::-webkit-scrollbar {
  width: 4px;
}

.idw-form::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: var(--idw-border);
}

.idw-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.idw-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.idw-field-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--idw-label-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.idw-field-state {
  font-size: 10.5px;
  color: var(--idw-label-3);
  white-space: nowrap;
}

.idw-field-state[data-state='saved'] { color: var(--idw-ok-fg); }
.idw-field-state[data-state='saving'] { color: var(--idw-accent); }
.idw-field-state[data-state='error'] { color: var(--idw-err-fg); }

.idw-textarea {
  width: 100%;
  min-height: 28px;
  max-height: 280px;
  padding: 5px 8px;
  border: var(--idw-hairline) solid var(--idw-border-input);
  border-radius: 6px;
  background: var(--idw-input-bg);
  color: var(--idw-label-1);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 19px;
  resize: none;
  overflow-y: hidden;
  outline: none;
  transition: box-shadow 180ms ease, background 150ms ease, border-color 180ms ease;
}

.idw-textarea:hover {
  background: var(--idw-input-hover-bg);
}

.idw-textarea:focus {
  background: var(--idw-input-bg);
  box-shadow: inset 0 0 0 1px var(--idw-accent), 0 0 0 2px rgba(65, 118, 230, 0.18);
}

.idw-textarea[data-flash='saved'] {
  box-shadow: inset 0 0 0 1px var(--idw-ok-fg);
}

.idw-textarea[data-flash='error'] {
  border-color: var(--idw-err-fg);
  box-shadow: inset 0 0 0 1px var(--idw-err-fg);
}

.idw-field-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  color: var(--idw-err-fg);
}

.idw-retry-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--idw-accent);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  white-space: nowrap;
}

.idw-empty-card {
  pointer-events: auto;
  width: 268px;
  padding: 12px 14px;
  border: var(--idw-hairline) solid var(--idw-border);
  border-right: none;
  border-radius: 12px 0 0 12px;
  background: var(--idw-glass-bg);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  box-shadow: var(--idw-shadow-hover);
  font-size: 12px;
  line-height: 1.5;
  color: var(--idw-label-2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .idw-card,
  .idw-accordion,
  .idw-peek,
  .idw-toolbar {
    transition: none !important;
  }
}
`
