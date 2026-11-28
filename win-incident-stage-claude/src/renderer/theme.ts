/**
 * Aurora Glass design tokens shared by every renderer surface.
 *
 * IMPORTANT: the Electron window is transparent, so `backdrop-filter` can NOT blur the
 * desktop behind the overlay — it only blurs other page content. Surfaces therefore stay
 * fairly opaque and fake "glass" through layered sheen, inner rim highlights, grain and
 * soft multi-layer shadows instead of relying on real blur.
 */

const NOISE_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"

export const THEME_CSS = /* css */ `
@property --st-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

html, body, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

.st-root {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
  font-family: var(--st-font);
  font-size: 13px;
  line-height: 1.45;
  color: var(--st-text-1);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  interpolate-size: allow-keywords;

  /* ---------- Typography ---------- */
  --st-font: "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif;
  --st-font-display: "Segoe UI Variable Display", "Segoe UI", "PingFang SC", "Microsoft YaHei UI", system-ui, sans-serif;
  --st-mono: "Cascadia Mono", "Cascadia Code", "JetBrains Mono", Consolas, monospace;

  /* ---------- Surfaces (light) ---------- */
  --st-surface: rgba(251, 251, 254, 0.9);
  --st-surface-strong: rgba(255, 255, 255, 0.97);
  --st-surface-soft: rgba(246, 247, 252, 0.84);
  --st-surface-sunken: rgba(235, 237, 245, 0.78);
  --st-surface-sunken-hover: rgba(228, 231, 241, 0.92);
  --st-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.18) 38%, rgba(255, 255, 255, 0) 60%);
  --st-noise: url("${NOISE_SVG}");
  --st-noise-opacity: 0.05;
  --st-stroke: rgba(18, 24, 48, 0.08);
  --st-stroke-strong: rgba(18, 24, 48, 0.15);
  --st-rim: rgba(255, 255, 255, 0.95);
  --st-fill-hover: rgba(18, 24, 48, 0.05);
  --st-fill-press: rgba(18, 24, 48, 0.1);

  /* ---------- Text ---------- */
  --st-text-1: #0e1322;
  --st-text-2: rgba(14, 19, 34, 0.7);
  --st-text-3: rgba(14, 19, 34, 0.48);
  --st-text-4: rgba(14, 19, 34, 0.3);
  --st-text-on-accent: #ffffff;

  /* ---------- Accent & tones ---------- */
  --st-accent: #5b5bf0;
  --st-accent-2: #2f8cff;
  --st-accent-soft: rgba(91, 91, 240, 0.12);
  --st-accent-ring: rgba(91, 91, 240, 0.34);
  --st-accent-grad: linear-gradient(135deg, #3f8cff 0%, #6a5cff 55%, #9b5cff 100%);
  --st-ok: #1fb866;
  --st-ok-soft: rgba(31, 184, 102, 0.14);
  --st-warn: #f08c00;
  --st-warn-soft: rgba(255, 159, 10, 0.16);
  --st-err: #f0443a;
  --st-err-soft: rgba(240, 68, 58, 0.13);
  --st-info: #14a9d8;
  --st-info-soft: rgba(20, 169, 216, 0.14);

  /* macOS traffic lights */
  --st-tl-red: #ff5f57;
  --st-tl-yellow: #febc2e;
  --st-tl-green: #28c840;

  /* Holographic sci-fi palette (todo widgets) */
  --st-holo: #19c6e6;
  --st-holo-2: #8b7bff;
  --st-holo-glow: rgba(25, 198, 230, 0.35);
  --st-holo-surface: rgba(232, 250, 255, 0.82);
  --st-holo-text: #06364a;

  /* ---------- Elevation ---------- */
  --st-shadow-sm: 0 1px 2px rgba(10, 14, 32, 0.06), 0 3px 10px -2px rgba(10, 14, 32, 0.1);
  --st-shadow-md: 0 2px 6px rgba(10, 14, 32, 0.06), 0 12px 30px -8px rgba(10, 14, 32, 0.22);
  --st-shadow-lg: 0 3px 10px rgba(10, 14, 32, 0.06), 0 24px 56px -14px rgba(10, 14, 32, 0.32), 0 50px 100px -30px rgba(10, 14, 32, 0.22);
  --st-shadow-accent: 0 10px 30px -8px rgba(91, 91, 240, 0.5);

  /* ---------- Shape ---------- */
  --st-r-xs: 7px;
  --st-r-sm: 10px;
  --st-r-md: 14px;
  --st-r-lg: 20px;
  --st-r-xl: 26px;

  /* ---------- Motion ---------- */
  --st-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --st-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --st-ease-emph: cubic-bezier(0.2, 0, 0, 1);
  /* gentle spring (~2% overshoot) — panels, cards */
  --st-spring: linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001 85.9%, 1);
  /* bouncy spring (~16% overshoot) — dots, badges, small toggles */
  --st-spring-bouncy: linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1);
  --st-dur-1: 120ms;
  --st-dur-2: 220ms;
  --st-dur-3: 360ms;
  --st-dur-4: 560ms;
  --st-dur-spring: 680ms;
}

.st-root *,
.st-root *::before,
.st-root *::after {
  box-sizing: border-box;
}

.st-root button,
.st-root input,
.st-root select,
.st-root textarea {
  font: inherit;
  color: inherit;
}

.st-root button {
  -webkit-tap-highlight-color: transparent;
}

.st-root :focus-visible {
  outline: 2px solid var(--st-accent-ring);
  outline-offset: 2px;
}

/* ---------- Dark theme ---------- */
.st-root[data-theme='dark'] {
  --st-surface: rgba(28, 30, 38, 0.9);
  --st-surface-strong: rgba(34, 36, 46, 0.97);
  --st-surface-soft: rgba(36, 38, 48, 0.84);
  --st-surface-sunken: rgba(14, 15, 21, 0.62);
  --st-surface-sunken-hover: rgba(20, 22, 30, 0.78);
  --st-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.025) 38%, rgba(255, 255, 255, 0) 60%);
  --st-noise-opacity: 0.07;
  --st-stroke: rgba(255, 255, 255, 0.08);
  --st-stroke-strong: rgba(255, 255, 255, 0.15);
  --st-rim: rgba(255, 255, 255, 0.14);
  --st-fill-hover: rgba(255, 255, 255, 0.07);
  --st-fill-press: rgba(255, 255, 255, 0.12);

  --st-text-1: #f3f4f8;
  --st-text-2: rgba(243, 244, 248, 0.72);
  --st-text-3: rgba(243, 244, 248, 0.5);
  --st-text-4: rgba(243, 244, 248, 0.3);

  --st-accent: #8c8aff;
  --st-accent-2: #4ea3ff;
  --st-accent-soft: rgba(140, 138, 255, 0.16);
  --st-accent-ring: rgba(140, 138, 255, 0.42);
  --st-accent-grad: linear-gradient(135deg, #4c96ff 0%, #7d6bff 55%, #b072ff 100%);
  --st-ok: #34d880;
  --st-ok-soft: rgba(52, 216, 128, 0.16);
  --st-warn: #ffb340;
  --st-warn-soft: rgba(255, 179, 64, 0.16);
  --st-err: #ff6b61;
  --st-err-soft: rgba(255, 107, 97, 0.16);
  --st-info: #5ad2ff;
  --st-info-soft: rgba(90, 210, 255, 0.16);

  --st-holo: #3ee0ff;
  --st-holo-2: #a598ff;
  --st-holo-glow: rgba(62, 224, 255, 0.4);
  --st-holo-surface: rgba(6, 24, 38, 0.82);
  --st-holo-text: #c9f6ff;

  --st-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 12px -2px rgba(0, 0, 0, 0.36);
  --st-shadow-md: 0 2px 6px rgba(0, 0, 0, 0.3), 0 14px 34px -8px rgba(0, 0, 0, 0.55);
  --st-shadow-lg: 0 3px 10px rgba(0, 0, 0, 0.32), 0 26px 60px -14px rgba(0, 0, 0, 0.66), 0 50px 110px -30px rgba(0, 0, 0, 0.5);
  --st-shadow-accent: 0 10px 30px -8px rgba(125, 107, 255, 0.55);
}

/* ---------- Reusable glass recipe ----------
 * Apply .st-glass to any floating surface. It layers: opaque-ish tint, top sheen,
 * film grain and a 1px inner rim highlight, plus a hairline outer stroke.
 */
.st-glass {
  position: relative;
  isolation: isolate;
  background: var(--st-surface);
  border: 1px solid var(--st-stroke);
  box-shadow: var(--st-shadow-md), inset 0 1px 0 var(--st-rim);
  backdrop-filter: blur(24px) saturate(170%);
}

.st-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
  background: var(--st-sheen);
}

.st-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
  background-image: var(--st-noise);
  background-size: 140px 140px;
  opacity: var(--st-noise-opacity);
  mix-blend-mode: overlay;
}

/* ---------- Shared keyframes ---------- */
@keyframes st-spin {
  to { transform: rotate(360deg); }
}

@keyframes st-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes st-pop-in {
  from { opacity: 0; transform: scale(0.92); filter: blur(6px); }
  to { opacity: 1; transform: scale(1); filter: blur(0); }
}

@keyframes st-rise-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); filter: blur(4px); }
  to { opacity: 1; transform: none; filter: blur(0); }
}

@keyframes st-pulse-ring {
  0% { box-shadow: 0 0 0 0 var(--st-pulse-color, var(--st-accent-ring)); }
  70% { box-shadow: 0 0 0 7px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

@keyframes st-breathe {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

@keyframes st-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}

@keyframes st-draw-check {
  from { stroke-dashoffset: 18; }
  to { stroke-dashoffset: 0; }
}

@keyframes st-border-spin {
  to { --st-angle: 360deg; }
}

.st-spin {
  animation: st-spin 0.9s linear infinite;
  transform-origin: 50% 50%;
}

@media (prefers-reduced-motion: reduce) {
  .st-root *,
  .st-root *::before,
  .st-root *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
`
