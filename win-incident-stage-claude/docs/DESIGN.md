# Aurora Stage — Design Brief

`win-incident-stage-claude` is a ground-up visual rebuild of `../win-incident-stage`
(Electron, Windows-only). **Functionality and IPC contracts are identical**; the goal is a
markedly more beautiful, cohesive, and alive UI: refined glass, a single token system,
and physically-plausible spring motion.

## 1. Runtime constraints (read first)

- The Electron window is **680px wide, full work-area height, docked to the right edge,
  fully transparent and frameless**. Everything is `position: fixed` relative to the right / bottom.
- Empty areas are **mouse click-through**. Any element that must receive the mouse MUST carry
  `data-interactive="true"` (the workspace hit-tests `closest('[data-interactive="true"]')`).
  Keep hit regions tight — do not put `data-interactive` on large invisible wrappers.
- `backdrop-filter` **cannot blur the desktop** (transparent window). Surfaces stay fairly opaque
  and fake glass with sheen + rim + grain + soft layered shadows. Use the `.st-glass` recipe from `theme.ts`.
- Chromium 134 (Electron 35): `linear()` easing, `@property`, `:has()`, `interpolate-size`,
  View Transitions, container queries are all available.
- No network, no external fonts/images. Inline SVG only. CSP: `img-src 'self' data:`, inline styles allowed.
- SVG `id`s must be globally unique — prefix them (`st-orb-…`, `st-cat-…`).
- Respect `prefers-reduced-motion` (theme.ts already clamps durations globally).
- Infinite animations must be cheap (transform / opacity only) — this overlay sits on top of
  the user's work all day. Pause decorative loops when idle where sensible.

## 2. Tokens (`src/renderer/theme.ts`)

Use **only** `--st-*` variables for color, shadow, radius, motion. Theme switch is
`.st-root[data-theme='dark']`. Key tokens:

| Group | Tokens |
| --- | --- |
| Surface | `--st-surface`, `--st-surface-strong`, `--st-surface-soft`, `--st-surface-sunken(-hover)`, `--st-sheen`, `--st-noise`, `--st-stroke(-strong)`, `--st-rim` |
| Text | `--st-text-1..4`, `--st-text-on-accent` |
| Accent | `--st-accent`, `--st-accent-2`, `--st-accent-soft`, `--st-accent-ring`, `--st-accent-grad` |
| Tones | `--st-ok`, `--st-warn`, `--st-err`, `--st-info` (+ `-soft`) |
| Traffic | `--st-tl-red`, `--st-tl-yellow`, `--st-tl-green` |
| Holo | `--st-holo`, `--st-holo-2`, `--st-holo-glow`, `--st-holo-surface`, `--st-holo-text` |
| Elevation | `--st-shadow-sm/md/lg`, `--st-shadow-accent` |
| Radius | `--st-r-xs 7` · `sm 10` · `md 14` · `lg 20` · `xl 26` |
| Motion | `--st-ease-out`, `--st-ease-in-out`, `--st-ease-emph`, `--st-spring` (gentle), `--st-spring-bouncy`, `--st-dur-1..4`, `--st-dur-spring` (use springs with ≥ 560ms) |

Shared keyframes: `st-spin`, `st-fade-in`, `st-pop-in`, `st-rise-in`, `st-pulse-ring`,
`st-breathe`, `st-shake`, `st-draw-check`, `st-border-spin` (animates `--st-angle` for conic borders).

## 3. Layout contract

| Region | Position | z-index |
| --- | --- | --- |
| Top area (toolbar, traffic lights, banners, settings sheet) | `top:12px; right:12px` | 46 |
| Music orb dock | `right:14px; bottom:14px`; sphere 38px → 60px on hover | 45 |
| Cat dock (holo mini card above the cat) | `right:-4px; bottom:96px` (or `bottom:16px` when player hidden) | 42 |
| Foreground holo todo screen | `top:84px; right:136px; width:var(--st-stage-width)` | 36 |
| Foreground incident stage card | `top:84px; right:136px; width:var(--st-stage-width)` | 35 |
| 3D rail of mini cards | right edge, `top:84px; bottom:var(--st-rail-bottom)` | 30 |

Mini cards (rail + holo mini card) share one silhouette: **width 112px, min-height 48px,
radius 14px, `transform-origin: right center; rotateY(-18deg)` in a `perspective: 900px`
parent**, swinging to `rotateY(-3deg) translateX(-16px)` and widening to ~196px on hover.

## 4. Motion language

1. **Springs, not linear fades.** Position/scale use `var(--st-spring)`; tiny elements use `--st-spring-bouncy`.
2. **Enter = rise + de-blur** (`st-rise-in` / `st-pop-in`), exit fast (≤ 160ms, ease-out).
3. **Shared-element morph**: clicking a rail card morphs it into the foreground stage card via the View Transitions API.
4. **State is light**: saving → shimmering accent; saved → green check draws itself; conflict → amber breathe; error → micro shake.
5. **Depth on hover**: lift (translate / scale ≤ 1.06) + stronger shadow + rim brightening. Never jitter layout.

## 5. Component ownership

| File | Owner | Exports |
| --- | --- | --- |
| `theme.ts`, `icons.tsx`, `StageWorkspace.tsx`, `workspace-styles.ts`, `index.tsx` | lead | — |
| `MusicOrb.tsx`, `orb-styles.ts` | orb designer | `MusicOrb` (props `MusicOrbProps`), `ORB_CSS` |
| `BongoCatWidget.tsx`, `cat-styles.ts` | cat designer | `BongoCatWidget`, `HoloTodoStageCard`, `CAT_CSS` |

Component class prefixes: `st-orb-*`, `st-cat-*`, `st-holo-*`. Workspace uses `st-*` for everything else.
Shared form atoms available from the workspace stylesheet: `.st-input`, `.st-btn` (`data-variant="primary|ghost|danger"`),
`.st-select`, `.st-icon-btn`, `.st-check` (round checkbox, `data-done`), `.st-chip`.
