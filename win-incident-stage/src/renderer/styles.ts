/** iPadOS Stage Manager 3D floating workspace + Desktop Widgets styles. */

export const STAGE_CSS = `
html, body, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: transparent !important;
  overflow: hidden;
  user-select: none;
}

.stg-root {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: var(--stg-label-1);

  --stg-glass-bg: rgba(250, 252, 255, 0.84);
  --stg-rail-glass: rgba(252, 253, 255, 0.82);
  --stg-rail-hover-glass: rgba(255, 255, 255, 0.94);
  --stg-input-bg: rgba(255, 255, 255, 0.92);
  --stg-input-hover-bg: rgba(243, 245, 249, 0.96);
  --stg-rim: rgba(255, 255, 255, 0.72);
  --stg-border: rgba(15, 23, 42, 0.14);
  --stg-border-soft: rgba(15, 23, 42, 0.08);
  --stg-border-input: rgba(15, 23, 42, 0.16);
  --stg-accent: rgb(56, 114, 230);
  --stg-label-1: rgb(15, 17, 21);
  --stg-label-2: rgb(88, 94, 102);
  --stg-label-3: rgb(129, 135, 144);
  --stg-hover-fill: rgba(15, 23, 42, 0.06);
  --stg-warn-fg: rgb(176, 92, 10);
  --stg-warn-bg: rgba(254, 245, 231, 0.95);
  --stg-warn-border: rgb(245, 158, 11);
  --stg-ok-fg: rgb(22, 163, 74);
  --stg-err-fg: rgb(220, 38, 38);
  --stg-err-bg: rgba(239, 68, 68, 0.10);
  --stg-shadow-rail: -8px 10px 24px rgba(15, 23, 42, 0.18), -2px 3px 8px rgba(15, 23, 42, 0.08);
  --stg-shadow-rail-hover: -14px 16px 34px rgba(15, 23, 42, 0.24), -3px 5px 12px rgba(15, 23, 42, 0.10);
  --stg-shadow-stage: -18px 26px 64px rgba(15, 23, 42, 0.24), -4px 8px 20px rgba(15, 23, 42, 0.10);
  --stg-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

.stg-root,
.stg-root * {
  box-sizing: border-box;
}

.stg-root[data-theme='dark'] {
  --stg-glass-bg: rgba(34, 36, 42, 0.86);
  --stg-rail-glass: rgba(40, 42, 48, 0.80);
  --stg-rail-hover-glass: rgba(50, 52, 60, 0.94);
  --stg-input-bg: rgba(22, 23, 28, 0.92);
  --stg-input-hover-bg: rgba(44, 46, 54, 0.95);
  --stg-rim: rgba(255, 255, 255, 0.18);
  --stg-border: rgba(255, 255, 255, 0.16);
  --stg-border-soft: rgba(255, 255, 255, 0.10);
  --stg-border-input: rgba(255, 255, 255, 0.20);
  --stg-accent: rgb(110, 166, 255);
  --stg-label-1: rgb(245, 246, 249);
  --stg-label-2: rgb(194, 199, 208);
  --stg-label-3: rgb(146, 152, 164);
  --stg-hover-fill: rgba(255, 255, 255, 0.09);
  --stg-warn-fg: rgb(251, 191, 36);
  --stg-warn-bg: rgba(92, 56, 10, 0.92);
  --stg-warn-border: rgba(245, 158, 11, 0.65);
  --stg-err-fg: rgb(248, 113, 113);
  --stg-err-bg: rgba(127, 29, 29, 0.42);
  --stg-shadow-rail: -10px 12px 28px rgba(0, 0, 0, 0.48), -2px 4px 10px rgba(0, 0, 0, 0.28);
  --stg-shadow-rail-hover: -16px 20px 40px rgba(0, 0, 0, 0.60), -4px 6px 14px rgba(0, 0, 0, 0.34);
  --stg-shadow-stage: -20px 28px 68px rgba(0, 0, 0, 0.65), -4px 8px 22px rgba(0, 0, 0, 0.36);
}

/* Hidden Zen Peek ear */
.stg-peek {
  pointer-events: auto;
  position: fixed;
  top: 44px;
  right: 0;
  width: 18px;
  height: 48px;
  padding: 0;
  border: 1px solid var(--stg-border);
  border-right: none;
  border-radius: 11px 0 0 11px;
  background: var(--stg-rail-glass);
  backdrop-filter: blur(20px) saturate(180%);
  color: var(--stg-label-2);
  box-shadow: var(--stg-shadow-rail);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.72;
  transition: width 180ms var(--stg-ease), opacity 180ms ease;
}

.stg-peek:hover {
  width: 26px;
  opacity: 1;
  color: var(--stg-label-1);
}

.stg-peek-dot {
  position: absolute;
  top: 6px;
  left: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

/* Top Floating Control Pill + macOS Traffic Lights Bar */
.stg-top-area {
  position: fixed;
  top: 10px;
  right: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  z-index: 46;
  pointer-events: none;
}

.stg-toolbar-shell {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  pointer-events: none;
}

.stg-toolbar {
  position: relative;
  z-index: 2;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 30px;
  padding: 0 7px 0 9px;
  border-radius: 12px;
  border: 1px solid var(--stg-border);
  background: var(--stg-glass-bg);
  backdrop-filter: blur(22px) saturate(180%);
  box-shadow: var(--stg-shadow-rail), inset 0 1px 0 var(--stg-rim);
  opacity: 0.90;
  transition: opacity 160ms ease, transform 180ms var(--stg-ease);
}

.stg-toolbar:hover,
.stg-toolbar[data-active='true'] {
  opacity: 1;
}

/* Left-docked 3 separated traffic lights tucked directly under the 20261128 control */
.stg-lights-dock {
  position: relative;
  z-index: 1;
  margin-left: 11px;
  margin-top: -5px;
  padding: 2px 6px 10px 4px;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: gap 220ms var(--stg-ease);
}

.stg-lights-dock[data-expanded='true'] {
  gap: 9px;
  padding-bottom: 16px;
}

.stg-light-dot {
  position: relative;
  width: 12px;
  height: 12px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.78);
  transform: translateY(-2px) scale(0.84);
  opacity: 0.92;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45), 0 1px 3px rgba(0, 0, 0, 0.24);
  transition:
    transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 160ms ease,
    box-shadow 180ms ease,
    filter 140ms ease;
}

.stg-light-dot:nth-of-type(1) { transition-delay: 0ms; }
.stg-light-dot:nth-of-type(2) { transition-delay: 35ms; }
.stg-light-dot:nth-of-type(3) { transition-delay: 70ms; }

.stg-light-dot[data-color='red'] { background: linear-gradient(145deg, #ff6d66, #ff453a); }
.stg-light-dot[data-color='yellow'] { background: linear-gradient(145deg, #ffd252, #f5b301); }
.stg-light-dot[data-color='green'] { background: linear-gradient(145deg, #3bd653, #24b33b); }

.stg-light-dot svg {
  opacity: 0;
  transition: opacity 140ms ease;
}

.stg-lights-dock[data-expanded='true'] .stg-light-dot {
  transform: translateY(10px) scale(1.08);
  opacity: 1;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.52), 0 4px 10px rgba(0, 0, 0, 0.28);
}

.stg-lights-dock[data-expanded='true'] .stg-light-dot svg {
  opacity: 0.92;
}

.stg-lights-dock[data-expanded='true'] .stg-light-dot:hover {
  transform: translateY(10px) scale(1.24);
  filter: brightness(1.08);
  transition-delay: 0ms;
}

.stg-light-tip {
  position: absolute;
  right: calc(100% + 6px);
  top: 15px;
  transform: translateY(-50%);
  pointer-events: none;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--stg-border);
  background: var(--stg-glass-bg);
  backdrop-filter: blur(16px);
  color: var(--stg-label-1);
  font-size: 10.5px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
}

.stg-status-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 7px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--stg-label-2);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 140ms ease, color 140ms ease;
}

.stg-status-btn:hover {
  background: var(--stg-hover-fill);
  color: var(--stg-label-1);
}

.stg-status-btn[data-state='dirty'] {
  background: rgba(56, 114, 230, 0.15);
  color: var(--stg-accent);
}

.stg-status-btn[data-state='error'] {
  background: var(--stg-err-bg);
  color: var(--stg-err-fg);
}

.stg-status-btn[data-state='saved'] {
  color: var(--stg-ok-fg);
}

.stg-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--stg-label-3);
}

.stg-dot[data-tone='ok'] { background: var(--stg-ok-fg); }
.stg-dot[data-tone='busy'] { background: var(--stg-accent); animation: stg-pulse 1s infinite ease-in-out; }
.stg-dot[data-tone='warn'] { background: var(--stg-warn-border); }
.stg-dot[data-tone='err'] { background: var(--stg-err-fg); }
.stg-dot[data-tone='accent'] { background: var(--stg-accent); }

@keyframes stg-pulse {
  0%, 100% { opacity: 0.45; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.12); }
}

.stg-icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--stg-label-2);
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.stg-icon-btn:hover {
  background: var(--stg-hover-fill);
  color: var(--stg-label-1);
}

.stg-badge-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--stg-warn-border);
}

.stg-spin {
  animation: stg-spin 0.8s linear infinite;
}

@keyframes stg-spin {
  to { transform: rotate(360deg); }
}

/* Alert & Conflict Banner */
.stg-banner {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  max-width: 360px;
  border-radius: 11px;
  border: 1px solid var(--stg-warn-border);
  background: var(--stg-warn-bg);
  backdrop-filter: blur(20px) saturate(170%);
  color: var(--stg-warn-fg);
  font-size: 11.5px;
  line-height: 1.35;
  box-shadow: var(--stg-shadow-rail);
}

.stg-banner[data-tone='error'] {
  border-color: var(--stg-err-fg);
  background: var(--stg-glass-bg);
  color: var(--stg-err-fg);
}

.stg-banner-text {
  flex: 1;
  min-width: 0;
}

.stg-banner-actions {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
}

.stg-mini-pill {
  height: 21px;
  padding: 0 8px;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.stg-mini-pill:hover {
  background: var(--stg-hover-fill);
}

.stg-mini-pill[data-primary='true'] {
  background: var(--stg-accent);
  border-color: var(--stg-accent);
  color: #fff;
}

/* Settings Popover */
.stg-settings {
  pointer-events: auto;
  width: 368px;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  padding: 13px 14px;
  border-radius: 14px;
  border: 1px solid var(--stg-border);
  background: var(--stg-glass-bg);
  backdrop-filter: blur(26px) saturate(185%);
  box-shadow: var(--stg-shadow-stage), inset 0 1px 0 var(--stg-rim);
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
}

.stg-settings-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  font-weight: 600;
}

.stg-tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 9px;
  background: var(--stg-hover-fill);
}

.stg-tab {
  flex: 1;
  height: 25px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--stg-label-2);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.stg-tab[data-active='true'] {
  background: var(--stg-input-bg);
  color: var(--stg-label-1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.stg-settings-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stg-settings-label {
  font-size: 11px;
  color: var(--stg-label-2);
  display: flex;
  justify-content: space-between;
}

.stg-settings-input-row {
  display: flex;
  gap: 6px;
}

.stg-toggle-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 9px;
  border: 1px solid var(--stg-border-soft);
  background: var(--stg-hover-fill);
  cursor: pointer;
}

.stg-toggle-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.stg-toggle-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--stg-label-1);
}

.stg-toggle-sub {
  font-size: 10.5px;
  color: var(--stg-label-3);
}

.stg-switch {
  position: relative;
  width: 34px;
  height: 19px;
  border-radius: 999px;
  border: none;
  padding: 0;
  flex: none;
  cursor: pointer;
  background: var(--stg-border-input);
  transition: background 160ms ease;
}

.stg-switch[data-on='true'] {
  background: var(--stg-accent);
}

.stg-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
  transition: transform 160ms var(--stg-ease);
}

.stg-switch[data-on='true'] .stg-switch-thumb {
  transform: translateX(15px);
}

.stg-shortcut-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 9px;
  border-radius: 9px;
  border: 1px solid var(--stg-border-soft);
  background: var(--stg-hover-fill);
}

.stg-shortcut-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--stg-label-2);
}

.stg-dot-sample {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}

.stg-dot-sample[data-color='red'] { background: #ff5f57; }
.stg-dot-sample[data-color='yellow'] { background: #febc2e; }
.stg-dot-sample[data-color='green'] { background: #28c840; }

.stg-hotkey-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.stg-hotkey-chip {
  height: 20px;
  padding: 0 6px;
  border-radius: 5px;
  border: 1px solid var(--stg-border);
  background: var(--stg-input-bg);
  color: var(--stg-label-2);
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
}

.stg-hotkey-chip:hover {
  border-color: var(--stg-accent);
  color: var(--stg-label-1);
}

.stg-hotkey-chip[data-active='true'] {
  border-color: var(--stg-accent);
  background: rgba(56, 114, 230, 0.16);
  color: var(--stg-accent);
  font-weight: 600;
}

.stg-input,
.stg-select {
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--stg-border-input);
  border-radius: 7px;
  background: var(--stg-input-bg);
  color: var(--stg-label-1);
  font-family: inherit;
  font-size: 12px;
  outline: none;
}

.stg-input:focus,
.stg-select:focus {
  box-shadow: 0 0 0 2px rgba(56, 114, 230, 0.25);
  border-color: var(--stg-accent);
}

.stg-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--stg-border-input);
  border-radius: 7px;
  background: var(--stg-input-bg);
  color: var(--stg-label-1);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.stg-btn:hover {
  background: var(--stg-hover-fill);
}

.stg-btn[data-primary='true'] {
  background: var(--stg-accent);
  border-color: var(--stg-accent);
  color: #fff;
}

/* =========================================================
 * iPadOS Stage Manager Right-Edge 3D Rail
 * ========================================================= */
.stg-rail-wrap {
  position: fixed;
  top: 76px;
  right: 0;
  bottom: var(--stg-rail-bottom, 180px);
  width: 256px;
  padding: 8px 12px 18px 34px;
  overflow-y: auto;
  overflow-x: visible;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
  pointer-events: none;
  perspective: 920px;
  perspective-origin: 100% 50%;
  scrollbar-width: none;
}

.stg-rail-wrap::-webkit-scrollbar {
  display: none;
}

.stg-mini-card {
  pointer-events: auto;
  position: relative;
  flex: none;
  width: 106px;
  min-height: 44px;
  padding: 6px 9px 6px 14px;
  border-radius: 13px;
  border: 1px solid var(--stg-border);
  background: var(--stg-rail-glass);
  backdrop-filter: blur(22px) saturate(185%);
  box-shadow: var(--stg-shadow-rail), inset 0 1px 0 var(--stg-rim);
  transform-origin: right center;
  transform: rotateY(-20deg) translateZ(0);
  transform-style: preserve-3d;
  overflow: visible;
  cursor: pointer;
  opacity: 0.88;
  transition:
    transform 230ms var(--stg-ease),
    width 230ms var(--stg-ease),
    background 160ms ease,
    box-shadow 230ms var(--stg-ease),
    opacity 160ms ease,
    border-color 160ms ease;
}

.stg-mini-card[data-hovered='true'] {
  width: 192px;
  background: var(--stg-rail-hover-glass);
  transform: translateX(-16px) rotateY(-4deg) scale(1.06);
  box-shadow: var(--stg-shadow-rail-hover), inset 0 1px 0 var(--stg-rim);
  opacity: 1;
  z-index: 25;
}

.stg-mini-card[data-active='true'] {
  border-color: var(--stg-accent);
  background: var(--stg-rail-hover-glass);
  transform: translateX(-8px) rotateY(-8deg);
  box-shadow: 0 0 0 1.5px var(--stg-accent), var(--stg-shadow-rail-hover);
  opacity: 1;
  z-index: 20;
}

.stg-mini-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.stg-mini-id {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--stg-label-1);
}

.stg-mini-link {
  flex: none;
  color: var(--stg-accent);
  display: inline-flex;
  opacity: 0.85;
}

.stg-mini-preview {
  margin-top: 3px;
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--stg-label-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stg-mini-card[data-hovered='true'] .stg-mini-preview {
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* iPad Stage Manager bottom-left corner app-icon badge */
.stg-corner-badge {
  position: absolute;
  left: -6px;
  bottom: -4px;
  width: 19px;
  height: 19px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.stg-corner-badge[data-tone='err'] { background: linear-gradient(135deg, #f43f5e, #dc2626); }
.stg-corner-badge[data-tone='warn'] { background: linear-gradient(135deg, #fbbf24, #d97706); }
.stg-corner-badge[data-tone='ok'] { background: linear-gradient(135deg, #34d399, #16a34a); }
.stg-corner-badge[data-tone='accent'] { background: linear-gradient(135deg, #60a5fa, #3b6fe0); }

/* =========================================================
 * Foreground "On Stage" Floating Card
 * ========================================================= */
.stg-stage-card {
  pointer-events: auto;
  position: fixed;
  top: 76px;
  right: 132px;
  width: var(--stg-stage-width, 344px);
  max-height: calc(100vh - 96px);
  border-radius: 18px;
  border: 1px solid var(--stg-border);
  background: var(--stg-glass-bg);
  backdrop-filter: blur(28px) saturate(190%);
  box-shadow: var(--stg-shadow-stage), inset 0 1px 0 var(--stg-rim);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 35;
  animation: stg-stage-in 240ms var(--stg-ease);
}

@keyframes stg-stage-in {
  from {
    opacity: 0;
    transform: translateX(22px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

.stg-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 7px;
  cursor: ew-resize;
  z-index: 10;
  touch-action: none;
}

.stg-resize-handle:hover::after,
.stg-stage-card[data-resizing='true'] .stg-resize-handle::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 20px;
  bottom: 20px;
  width: 2.5px;
  border-radius: 2px;
  background: var(--stg-accent);
  opacity: 0.7;
}

.stg-stage-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 10px 8px 14px;
  border-bottom: 1px solid var(--stg-border-soft);
}

.stg-stage-id {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--stg-label-1);
  user-select: text;
  cursor: text;
}

.stg-open-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 9px;
  border: none;
  border-radius: 7px;
  background: rgba(56, 114, 230, 0.14);
  color: var(--stg-accent);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.stg-open-link:hover:not(:disabled) {
  background: rgba(56, 114, 230, 0.24);
}

.stg-open-link:disabled {
  background: transparent;
  color: var(--stg-label-3);
  opacity: 0.45;
  cursor: not-allowed;
}

.stg-stage-form {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 11px 13px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
}

.stg-stage-form::-webkit-scrollbar {
  width: 4px;
}

.stg-stage-form::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: var(--stg-border);
}

.stg-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stg-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stg-field-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--stg-label-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stg-field-state {
  font-size: 10.5px;
  color: var(--stg-label-3);
  white-space: nowrap;
}

.stg-field-state[data-state='saved'] { color: var(--stg-ok-fg); }
.stg-field-state[data-state='saving'] { color: var(--stg-accent); }
.stg-field-state[data-state='error'] { color: var(--stg-err-fg); }

.stg-textarea {
  width: 100%;
  min-height: 28px;
  max-height: 280px;
  padding: 5px 8px;
  border: 1px solid var(--stg-border-input);
  border-radius: 8px;
  background: var(--stg-input-bg);
  color: var(--stg-label-1);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 19px;
  resize: none;
  overflow-y: hidden;
  outline: none;
  user-select: text;
  transition: box-shadow 180ms ease, background 150ms ease, border-color 180ms ease;
}

.stg-textarea:hover {
  background: var(--stg-input-hover-bg);
}

.stg-textarea:focus {
  background: var(--stg-input-bg);
  border-color: var(--stg-accent);
  box-shadow: 0 0 0 2px rgba(56, 114, 230, 0.22);
}

.stg-textarea[data-flash='saved'] {
  border-color: var(--stg-ok-fg);
  box-shadow: 0 0 0 1px var(--stg-ok-fg);
}

.stg-textarea[data-flash='error'] {
  border-color: var(--stg-err-fg);
  box-shadow: 0 0 0 1px var(--stg-err-fg);
}

.stg-field-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  color: var(--stg-err-fg);
}

.stg-retry-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--stg-accent);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  white-space: nowrap;
}

.stg-empty-card {
  pointer-events: auto;
  width: 268px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--stg-border);
  background: var(--stg-glass-bg);
  backdrop-filter: blur(22px) saturate(180%);
  box-shadow: var(--stg-shadow-rail);
  font-size: 12px;
  line-height: 1.5;
  color: var(--stg-label-2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* =========================================================
 * Stationary Classic Bongo Cat (~60% protrusion) + Stage-Manager Holographic Todo Screen
 * ========================================================= */
.stg-cat-dock {
  position: fixed;
  right: -4px;
  bottom: 88px;
  z-index: 42;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.stg-cat-dock[data-player='false'] {
  bottom: 14px;
}

.stg-holo-rail {
  width: 248px;
  padding: 2px 14px 2px 34px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  perspective: 920px;
  perspective-origin: 100% 50%;
  pointer-events: none;
}

.stg-holo-mini-card {
  pointer-events: auto;
  position: relative;
  width: 106px;
  min-height: 44px;
  padding: 6px 9px 6px 14px;
  border-radius: 13px;
  border: 1px solid rgba(56, 189, 248, 0.56);
  background:
    repeating-linear-gradient(
      0deg,
      rgba(56, 189, 248, 0.08) 0px,
      rgba(56, 189, 248, 0.08) 1px,
      transparent 1px,
      transparent 4px
    ),
    linear-gradient(145deg, rgba(224, 247, 255, 0.58), rgba(186, 230, 253, 0.36));
  backdrop-filter: blur(18px) saturate(190%);
  box-shadow:
    -8px 10px 24px rgba(14, 165, 233, 0.24),
    0 0 18px rgba(56, 189, 248, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  transform-origin: right center;
  transform: rotateY(-20deg) translateZ(0);
  transform-style: preserve-3d;
  overflow: visible;
  cursor: pointer;
  opacity: 0.94;
  transition:
    transform 230ms var(--stg-ease),
    width 230ms var(--stg-ease),
    background 160ms ease,
    box-shadow 230ms var(--stg-ease),
    border-color 160ms ease;
}

.stg-root[data-theme='dark'] .stg-holo-mini-card {
  border-color: rgba(56, 189, 248, 0.62);
  background:
    repeating-linear-gradient(
      0deg,
      rgba(56, 189, 248, 0.10) 0px,
      rgba(56, 189, 248, 0.10) 1px,
      transparent 1px,
      transparent 4px
    ),
    linear-gradient(145deg, rgba(12, 34, 58, 0.68), rgba(14, 52, 82, 0.48));
  box-shadow:
    -10px 12px 28px rgba(0, 0, 0, 0.45),
    0 0 22px rgba(34, 211, 238, 0.30),
    inset 0 1px 0 rgba(125, 211, 252, 0.45);
}

/* Faint holographic projection cone connecting down to Bongo Cat's keyboard */
.stg-holo-mini-card::after {
  content: '';
  position: absolute;
  left: 14%;
  right: 14%;
  bottom: -9px;
  height: 9px;
  background: linear-gradient(to bottom, rgba(56, 189, 248, 0.36), transparent);
  clip-path: polygon(12% 0%, 88% 0%, 72% 100%, 28% 100%);
  pointer-events: none;
}

.stg-holo-mini-card[data-hovered='true'] {
  width: 192px;
  transform: translateX(-16px) rotateY(-4deg) scale(1.06);
  box-shadow:
    -14px 16px 34px rgba(14, 165, 233, 0.30),
    0 0 24px rgba(56, 189, 248, 0.44),
    inset 0 1px 0 rgba(255, 255, 255, 0.80);
  opacity: 1;
  z-index: 25;
}

.stg-holo-mini-card[data-active='true'] {
  border-color: rgb(34, 211, 238);
  transform: translateX(-8px) rotateY(-8deg);
  box-shadow:
    0 0 0 1.5px rgba(34, 211, 238, 0.85),
    0 0 26px rgba(34, 211, 238, 0.48);
  opacity: 1;
  z-index: 20;
}

.stg-holo-mini-card[data-pulse='true'] {
  box-shadow:
    0 0 0 2px rgba(56, 189, 248, 0.9),
    0 0 28px rgba(34, 211, 238, 0.65);
}

.stg-holo-corner-badge {
  position: absolute;
  left: -6px;
  bottom: -4px;
  width: 19px;
  height: 19px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: linear-gradient(135deg, #22d3ee, #0284c7);
  box-shadow: 0 3px 10px rgba(14, 165, 233, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.stg-holo-mini-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
}

.stg-holo-mini-tag {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: rgb(2, 132, 199);
}

.stg-root[data-theme='dark'] .stg-holo-mini-tag {
  color: rgb(103, 232, 249);
}

.stg-holo-mini-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(34, 211, 238);
  box-shadow: 0 0 8px rgba(34, 211, 238, 0.95);
}

.stg-holo-mini-preview {
  margin-top: 2px;
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--stg-label-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stg-holo-mini-card[data-hovered='true'] .stg-holo-mini-preview {
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Stationary Bongo Cat: never rotates or shifts on hover/click */
.stg-cat-trigger {
  pointer-events: auto;
  position: relative;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  filter: drop-shadow(-3px 6px 10px rgba(0, 0, 0, 0.24));
}

.stg-cat-svg {
  display: block;
}

.stg-cat-paw {
  transition: transform 70ms ease-out;
}

/* Foreground Holographic Todo Stage Card (same position as .stg-stage-card) */
.stg-holo-stage-card {
  pointer-events: auto;
  position: fixed;
  top: 76px;
  right: 132px;
  width: var(--stg-stage-width, 344px);
  max-height: calc(100vh - 96px);
  border-radius: 18px;
  border: 1px solid rgba(56, 189, 248, 0.58);
  background:
    linear-gradient(155deg, rgba(226, 246, 255, 0.72), rgba(240, 249, 255, 0.54));
  backdrop-filter: blur(22px) saturate(195%);
  box-shadow:
    -18px 24px 60px rgba(14, 165, 233, 0.22),
    0 0 32px rgba(56, 189, 248, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 36;
  animation: stg-stage-in 240ms var(--stg-ease);
}

.stg-root[data-theme='dark'] .stg-holo-stage-card {
  border-color: rgba(56, 189, 248, 0.56);
  background:
    linear-gradient(155deg, rgba(10, 28, 48, 0.74), rgba(14, 42, 68, 0.58));
  box-shadow:
    -20px 28px 66px rgba(0, 0, 0, 0.62),
    0 0 34px rgba(34, 211, 238, 0.24),
    inset 0 1px 0 rgba(125, 211, 252, 0.35);
}

.stg-holo-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(56, 189, 248, 0.05) 0px,
    rgba(56, 189, 248, 0.05) 1px,
    transparent 1px,
    transparent 5px
  );
  z-index: 0;
}

.stg-holo-stage-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 8px 10px 8px 14px;
  border-bottom: 1px solid rgba(56, 189, 248, 0.26);
}

.stg-holo-chip {
  padding: 1px 6px;
  border-radius: 5px;
  border: 1px solid rgba(56, 189, 248, 0.62);
  background: rgba(56, 189, 248, 0.16);
  color: rgb(2, 132, 199);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.8px;
}

.stg-root[data-theme='dark'] .stg-holo-chip {
  color: rgb(103, 232, 249);
}

.stg-holo-stage-title {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--stg-label-1);
}

.stg-holo-stage-body {
  position: relative;
  z-index: 1;
  padding: 12px 13px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stg-holo-todo-list {
  max-height: 290px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scrollbar-width: thin;
}

.stg-holo-todo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 9px;
  border: 1px solid rgba(56, 189, 248, 0.20);
  background: rgba(255, 255, 255, 0.38);
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}

.stg-root[data-theme='dark'] .stg-holo-todo-row {
  background: rgba(15, 36, 58, 0.50);
}

.stg-holo-todo-row:hover {
  border-color: rgba(56, 189, 248, 0.56);
}

.stg-holo-todo-row[data-pinned='true'] {
  border-color: rgb(34, 211, 238);
  box-shadow: 0 0 12px rgba(34, 211, 238, 0.24);
}

.stg-holo-todo-row[data-done='true'] .stg-todo-text {
  text-decoration: line-through;
  color: var(--stg-label-3);
}

.stg-holo-Pin {
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.22);
  color: rgb(2, 132, 199);
  font-size: 9.5px;
  font-weight: 600;
  white-space: nowrap;
}

.stg-root[data-theme='dark'] .stg-holo-Pin {
  color: rgb(103, 232, 249);
}

.stg-holo-stage-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid rgba(56, 189, 248, 0.18);
}

.stg-holo-hint {
  font-size: 10.5px;
  color: var(--stg-label-2);
}

.stg-bubble-icon-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--stg-label-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.stg-bubble-icon-btn:hover {
  background: var(--stg-hover-fill);
  color: var(--stg-label-1);
}

.stg-todo-list {
  max-height: 185px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  scrollbar-width: thin;
}

.stg-todo-empty {
  padding: 8px 4px;
  font-size: 11px;
  color: var(--stg-label-3);
  text-align: center;
}

.stg-todo-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 7px;
  border-radius: 8px;
  background: var(--stg-hover-fill);
}

.stg-todo-check {
  width: 17px;
  height: 17px;
  padding: 0;
  flex: none;
  border-radius: 5px;
  border: 1px solid var(--stg-border-input);
  background: var(--stg-input-bg);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.stg-todo-check[data-done='true'] {
  background: var(--stg-ok-fg);
  border-color: var(--stg-ok-fg);
}

.stg-todo-text {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: var(--stg-label-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stg-todo-row[data-done='true'] .stg-todo-text {
  text-decoration: line-through;
  color: var(--stg-label-3);
}

/* =========================================================
 * Water-Droplet Floating Music Player + Black-Hole Hover Halo
 * ========================================================= */
.stg-orb-dock {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 45;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.stg-orb-tooltip {
  pointer-events: none;
  max-width: 230px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--stg-border);
  background: var(--stg-glass-bg);
  backdrop-filter: blur(20px) saturate(185%);
  box-shadow: var(--stg-shadow-rail);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--stg-label-1);
  animation: stg-stage-in 180ms var(--stg-ease);
}

.stg-orb-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--stg-label-3);
}

.stg-orb-status-dot[data-playing='true'] {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.85);
}

.stg-orb-track {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stg-drop-cluster {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 6px 6px 4px;
  transition: gap 240ms var(--stg-ease);
}

.stg-drop-cluster[data-hovered='true'] {
  gap: 10px;
}

.stg-drop-side {
  width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: width 240ms var(--stg-ease), opacity 180ms ease, transform 240ms var(--stg-ease);
}

.stg-drop-left {
  transform: translateX(8px) scale(0.84);
}

.stg-drop-right {
  transform: translateX(-8px) scale(0.84);
}

.stg-drop-cluster[data-hovered='true'] .stg-drop-side {
  width: 28px;
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0) scale(1);
}

.stg-orb-mini-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  flex: none;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.36);
  background: var(--stg-glass-bg);
  backdrop-filter: blur(20px) saturate(190%);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.55);
  color: var(--stg-label-1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 140ms var(--stg-ease), background 140ms ease;
}

.stg-orb-mini-btn:hover {
  transform: scale(1.1);
  background: var(--stg-rail-hover-glass);
}

/* Chromatic-Horizon Glass Sphere: shrinks when idle, enlarges on hover with Black-Hole halo */
.stg-drop-sphere {
  position: relative;
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: width 260ms var(--stg-ease), height 260ms var(--stg-ease), filter 220ms ease;
  filter: drop-shadow(0 5px 12px rgba(15, 23, 42, 0.34));
}

.stg-drop-cluster[data-hovered='true'] .stg-drop-sphere {
  width: 58px;
  height: 58px;
  filter: drop-shadow(0 0 18px rgba(249, 115, 22, 0.45));
}

/* Black-hole photon ring + relativistic accretion halo (shown on hover) */
.stg-blackhole-halo {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 74px;
  height: 74px;
  margin-left: -37px;
  margin-top: -37px;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  transform: scale(0.55);
  background:
    radial-gradient(circle, rgba(2, 6, 23, 0.85) 36%, rgba(255, 247, 237, 0.92) 48%, rgba(249, 115, 22, 0.80) 58%, rgba(129, 140, 248, 0.35) 72%, transparent 78%),
    conic-gradient(
      from 0deg,
      rgba(255, 247, 237, 0.92),
      rgba(245, 158, 11, 0.88),
      rgba(234, 88, 12, 0.78),
      rgba(99, 102, 241, 0.72),
      rgba(255, 247, 237, 0.92)
    );
  filter: blur(2.2px);
  transition: opacity 240ms ease, transform 280ms var(--stg-ease);
}

.stg-blackhole-disk {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 84px;
  height: 24px;
  margin-left: -42px;
  margin-top: -12px;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  transform: rotate(-14deg) scale(0.55);
  background: radial-gradient(ellipse at center, transparent 36%, rgba(254, 215, 170, 0.82) 56%, rgba(249, 115, 22, 0.56) 72%, transparent 82%);
  filter: blur(1.8px);
  transition: opacity 240ms ease, transform 280ms var(--stg-ease);
}

.stg-drop-cluster[data-hovered='true'] .stg-blackhole-halo {
  opacity: 0.94;
  transform: scale(1);
  animation: stg-blackhole-spin 5.5s linear infinite;
}

.stg-drop-cluster[data-hovered='true'] .stg-blackhole-disk {
  opacity: 0.88;
  transform: rotate(-14deg) scale(1);
}

@keyframes stg-blackhole-spin {
  to { transform: scale(1) rotate(360deg); }
}

.stg-drop-body {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #141820;
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, 0.52),
    inset 0 -5px 10px rgba(15, 23, 42, 0.42);
}

.stg-horizon-orb {
  width: 100%;
  height: 100%;
  display: block;
}

.stg-drop-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 240ms ease;
  display: block;
}

.stg-drop-cover[data-visible='true'] {
  opacity: 1;
}

.stg-drop-meniscus {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(ellipse 62% 28% at 48% 16%, rgba(255, 255, 255, 0.34), transparent 72%),
    radial-gradient(ellipse 72% 24% at 50% 90%, rgba(255, 255, 255, 0.24), transparent 78%);
}

.stg-drop-play-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(15, 23, 42, 0.34);
  opacity: 0;
  transition: opacity 160ms ease;
}

.stg-drop-sphere:hover .stg-drop-play-overlay {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .stg-mini-card,
  .stg-holo-mini-card,
  .stg-holo-stage-card,
  .stg-stage-card,
  .stg-peek,
  .stg-toolbar,
  .stg-lights-dock,
  .stg-light-dot,
  .stg-cat-paw,
  .stg-drop-sphere,
  .stg-drop-side,
  .stg-blackhole-halo,
  .stg-blackhole-disk {
    transition: none !important;
    animation: none !important;
  }
}
`
