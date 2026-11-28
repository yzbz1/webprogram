/** Styles for the liquid-glass Aurora MusicOrb dock, pearl sphere, tooltip, and volume HUD. */

export const ORB_CSS = /* css */ `
/* =========================================================
 * Aurora Liquid-Glass Music Orb Dock
 * ========================================================= */
.st-orb-dock {
  --st-orb-cyan: var(--st-holo);
  --st-orb-azure: var(--st-accent-2);
  --st-orb-iris: var(--st-accent);
  --st-orb-violet: var(--st-holo-2);
  --st-orb-white: var(--st-text-on-accent);

  --st-orb-dome-top: var(--st-surface-strong);
  --st-orb-dome-mid: color-mix(in srgb, var(--st-surface-sunken) 84%, var(--st-holo-surface));
  --st-orb-dome-edge: color-mix(in srgb, var(--st-text-1) 16%, var(--st-surface-sunken));
  --st-orb-shell-stroke: color-mix(in srgb, var(--st-rim) 82%, var(--st-stroke-strong));
  --st-orb-scrim: color-mix(in srgb, var(--st-text-1) 62%, transparent);
  --st-orb-hud-track: color-mix(in srgb, var(--st-text-on-accent) 22%, transparent);
  --st-orb-shadow-idle:
    var(--st-shadow-md),
    0 6px 18px -4px color-mix(in srgb, var(--st-accent) 28%, transparent);
  --st-orb-shadow-playing:
    var(--st-shadow-md),
    0 0 18px -2px color-mix(in srgb, var(--st-holo) 44%, transparent),
    0 6px 22px -4px color-mix(in srgb, var(--st-accent) 46%, transparent);
  --st-orb-shadow-hover:
    var(--st-shadow-lg),
    0 0 26px -2px color-mix(in srgb, var(--st-holo) 48%, transparent),
    0 10px 30px -6px color-mix(in srgb, var(--st-accent) 56%, transparent);
  --st-orb-caustic-opacity: 0.48;
  --st-orb-caustic-playing: 0.85;
  --st-orb-wave-back-opacity: 0.32;
  --st-orb-wave-front-opacity: 0.72;
  --st-orb-wave-glow-opacity: 0.42;
  --st-orb-meniscus-opacity: 0.78;
  --st-orb-core-opacity: 0.24;

  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 45;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.st-root[data-theme='dark'] .st-orb-dock {
  --st-orb-dome-top: color-mix(in srgb, var(--st-surface-strong) 92%, var(--st-accent));
  --st-orb-dome-mid: color-mix(in srgb, var(--st-surface) 88%, var(--st-holo-surface));
  --st-orb-dome-edge: color-mix(in srgb, var(--st-surface) 94%, var(--st-holo));
  --st-orb-shell-stroke: color-mix(in srgb, var(--st-rim) 92%, var(--st-holo));
  --st-orb-scrim: color-mix(in srgb, var(--st-surface-strong) 78%, transparent);
  --st-orb-caustic-opacity: 0.68;
  --st-orb-caustic-playing: 0.98;
  --st-orb-wave-back-opacity: 0.38;
  --st-orb-wave-front-opacity: 0.78;
  --st-orb-wave-glow-opacity: 0.55;
  --st-orb-meniscus-opacity: 0.86;
  --st-orb-core-opacity: 0.34;
}

/* ---------- Floating Pill Tooltip ---------- */
.st-orb-dock .st-orb-tooltip {
  position: absolute;
  bottom: calc(100% + 9px);
  right: 0;
  pointer-events: none;
  max-width: 248px;
  padding: 5px 10px 5px 9px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--st-text-1);
  opacity: 0;
  visibility: hidden;
  transform: translateY(7px) scale(0.95);
  filter: blur(5px);
  transform-origin: right bottom;
  transition:
    opacity 150ms var(--st-ease-out),
    transform 150ms var(--st-ease-out),
    filter 150ms var(--st-ease-out),
    visibility 0s linear 150ms;
}

.st-orb-dock .st-orb-tooltip[data-visible='true'] {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
  filter: blur(0);
  transition:
    opacity var(--st-dur-2) var(--st-ease-out),
    transform var(--st-dur-4) var(--st-spring),
    filter var(--st-dur-3) var(--st-ease-out),
    visibility 0s;
}

.st-orb-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--st-text-3);
  transition: background var(--st-dur-2) var(--st-ease-out), box-shadow var(--st-dur-2) var(--st-ease-out);
}

.st-orb-status-dot[data-playing='true'] {
  --st-pulse-color: var(--st-holo-glow);
  background: var(--st-holo);
  box-shadow: 0 0 8px var(--st-holo-glow);
  animation: st-pulse-ring 2s var(--st-ease-out) infinite;
}

.st-orb-track {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--st-text-1);
}

.st-orb-vol-badge {
  flex: none;
  padding: 1.5px 6.5px;
  border-radius: 999px;
  font-family: var(--st-mono);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: var(--st-accent-soft);
  color: var(--st-accent);
  transition:
    transform var(--st-dur-4) var(--st-spring-bouncy),
    background var(--st-dur-1) var(--st-ease-out),
    color var(--st-dur-1) var(--st-ease-out),
    box-shadow var(--st-dur-2) var(--st-ease-out);
}

.st-orb-vol-badge[data-active='true'] {
  transform: scale(1.08);
  background: var(--st-info-soft);
  color: var(--st-info);
  box-shadow: 0 0 10px -2px var(--st-holo-glow);
}

/* ---------- Cluster & Side Controls ---------- */
.st-orb-cluster {
  position: relative;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 3px;
  transition: gap var(--st-dur-4) var(--st-spring);
}

.st-orb-cluster[data-hovered='true'] {
  gap: 10px;
}

.st-orb-cluster[data-playing='true'] {
  --st-orb-wave-back-opacity: 0.48;
  --st-orb-wave-front-opacity: 0.96;
  --st-orb-wave-glow-opacity: 0.85;
  --st-orb-meniscus-opacity: 1;
  --st-orb-core-opacity: 0.56;
}

.st-orb-side {
  position: relative;
  z-index: 1;
  width: 0;
  min-width: 0;
  flex: 0 0 auto;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    width var(--st-dur-4) var(--st-spring),
    opacity 130ms var(--st-ease-out),
    visibility 0s linear 140ms;
}

.st-orb-cluster[data-hovered='true'] .st-orb-side {
  width: 28px;
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition:
    width var(--st-dur-4) var(--st-spring),
    opacity var(--st-dur-2) var(--st-ease-out),
    visibility 0s;
}

.st-orb-mini-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  flex: none;
  border-radius: 50%;
  color: var(--st-text-1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition:
    transform 140ms var(--st-ease-out),
    opacity 120ms var(--st-ease-out),
    background var(--st-dur-1) var(--st-ease-out),
    border-color var(--st-dur-1) var(--st-ease-out),
    box-shadow var(--st-dur-2) var(--st-ease-out);
}

.st-orb-left .st-orb-mini-btn {
  transform: translateX(18px) scale(0.38);
}

.st-orb-right .st-orb-mini-btn {
  transform: translateX(-18px) scale(0.38);
}

.st-orb-cluster[data-hovered='true'] .st-orb-mini-btn {
  opacity: 1;
  transform: translateX(0) scale(1);
  transition:
    transform var(--st-dur-spring) var(--st-spring-bouncy),
    opacity var(--st-dur-2) var(--st-ease-out),
    background var(--st-dur-1) var(--st-ease-out),
    border-color var(--st-dur-1) var(--st-ease-out),
    box-shadow var(--st-dur-2) var(--st-ease-out);
}

.st-orb-cluster[data-hovered='true'] .st-orb-left .st-orb-mini-btn {
  transition-delay: 35ms, 35ms, 0s, 0s, 0s;
}

.st-orb-cluster[data-hovered='true'] .st-orb-right .st-orb-mini-btn {
  transition-delay: 85ms, 85ms, 0s, 0s, 0s;
}

.st-orb-cluster[data-hovered='true'] .st-orb-mini-btn:hover {
  transform: translateX(0) scale(1.12);
  background: var(--st-surface-strong);
  border-color: var(--st-stroke-strong);
  box-shadow: var(--st-shadow-md), 0 0 14px -2px var(--st-accent-ring), inset 0 1px 0 var(--st-rim);
  transition-delay: 0s;
}

.st-orb-cluster[data-hovered='true'] .st-orb-mini-btn:active {
  transform: translateX(0) scale(0.94);
  transition-duration: 90ms;
  transition-delay: 0s;
}

/* ---------- Central Pearl Sphere ---------- */
.st-orb-sphere {
  position: relative;
  z-index: 2;
  width: 38px;
  height: 38px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    width var(--st-dur-4) var(--st-spring),
    height var(--st-dur-4) var(--st-spring);
}

.st-orb-cluster[data-hovered='true'] .st-orb-sphere {
  width: 60px;
  height: 60px;
}

/* Soft caustic puddle directly under the droplet */
.st-orb-caustic {
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 82%;
  height: 11px;
  transform: translateX(-50%) scale(0.92);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  opacity: var(--st-orb-caustic-opacity);
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--st-holo) 65%, transparent) 0%,
    color-mix(in srgb, var(--st-accent) 42%, transparent) 48%,
    transparent 76%
  );
  filter: blur(4px);
  transition:
    opacity var(--st-dur-3) var(--st-ease-out),
    transform var(--st-dur-4) var(--st-spring);
}

.st-orb-cluster[data-playing='true'] .st-orb-caustic {
  opacity: var(--st-orb-caustic-playing);
  transform: translateX(-50%) scale(1.06);
}

.st-orb-cluster[data-hovered='true'] .st-orb-caustic {
  opacity: 0.96;
  transform: translateX(-50%) scale(1.14);
}

/* Rotating conic accretion aura (blooms on hover with a spring) */
.st-orb-halo {
  position: absolute;
  inset: -11px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  scale: 0.54;
  rotate: 0deg;
  background: conic-gradient(
    from 0deg,
    color-mix(in srgb, var(--st-holo) 88%, transparent) 0deg,
    color-mix(in srgb, var(--st-accent-2) 72%, transparent) 75deg,
    color-mix(in srgb, var(--st-accent) 82%, transparent) 160deg,
    color-mix(in srgb, var(--st-holo-2) 86%, transparent) 245deg,
    color-mix(in srgb, var(--st-holo) 88%, transparent) 360deg
  );
  -webkit-mask-image: radial-gradient(circle, transparent 48%, var(--st-text-on-accent) 58%, var(--st-text-on-accent) 66%, transparent 76%);
  mask-image: radial-gradient(circle, transparent 48%, var(--st-text-on-accent) 58%, var(--st-text-on-accent) 66%, transparent 76%);
  filter: blur(2.5px);
  transition:
    opacity var(--st-dur-2) var(--st-ease-out),
    scale var(--st-dur-4) var(--st-spring);
}

.st-orb-cluster[data-hovered='true'] .st-orb-halo {
  opacity: 0.9;
  scale: 1;
  animation: st-orb-halo-spin 5.4s linear infinite;
}

@keyframes st-orb-halo-spin {
  from { rotate: 0deg; }
  to { rotate: 360deg; }
}

/* Subtle audio-reactive-looking breathing aura when playing */
.st-orb-audio-aura {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  transform: scale(0.88);
  background: radial-gradient(
    circle,
    transparent 52%,
    color-mix(in srgb, var(--st-holo) 45%, transparent) 66%,
    color-mix(in srgb, var(--st-holo-2) 32%, transparent) 80%,
    transparent 96%
  );
  transition: opacity var(--st-dur-3) var(--st-ease-out), transform var(--st-dur-3) var(--st-ease-out);
}

.st-orb-cluster[data-playing='true'] .st-orb-audio-aura {
  animation: st-orb-cadence 2.4s var(--st-ease-in-out) infinite;
}

@keyframes st-orb-cadence {
  0%, 100% {
    opacity: 0.36;
    transform: scale(0.95);
  }
  22% {
    opacity: 0.85;
    transform: scale(1.07);
  }
  44% {
    opacity: 0.48;
    transform: scale(0.99);
  }
  66% {
    opacity: 0.78;
    transform: scale(1.05);
  }
  84% {
    opacity: 0.42;
    transform: scale(0.97);
  }
}

/* Subtle outer refraction ring */
.st-orb-refraction {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 1;
  opacity: 0.45;
  background: conic-gradient(
    from 215deg,
    color-mix(in srgb, var(--st-orb-white) 80%, transparent) 0deg,
    color-mix(in srgb, var(--st-holo) 58%, transparent) 95deg,
    color-mix(in srgb, var(--st-holo-2) 52%, transparent) 210deg,
    color-mix(in srgb, var(--st-orb-white) 75%, transparent) 360deg
  );
  -webkit-mask: linear-gradient(var(--st-text-on-accent) 0 0) content-box, linear-gradient(var(--st-text-on-accent) 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(var(--st-text-on-accent) 0 0) content-box, linear-gradient(var(--st-text-on-accent) 0 0);
  mask-composite: exclude;
  padding: 1px;
  transition: opacity var(--st-dur-2) var(--st-ease-out), transform var(--st-dur-4) var(--st-spring);
}

.st-orb-cluster[data-hovered='true'] .st-orb-refraction,
.st-orb-cluster[data-playing='true'] .st-orb-refraction {
  opacity: 0.92;
}

/* Glass body container */
.st-orb-body {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--st-orb-shell-stroke);
  background: var(--st-surface-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--st-orb-shadow-idle);
  transition:
    transform 110ms var(--st-ease-out),
    box-shadow var(--st-dur-3) var(--st-ease-out),
    border-color var(--st-dur-2) var(--st-ease-out);
}

.st-orb-cluster[data-playing='true'] .st-orb-body {
  box-shadow: var(--st-orb-shadow-playing);
}

.st-orb-cluster[data-hovered='true'] .st-orb-body {
  box-shadow: var(--st-orb-shadow-hover);
}

.st-orb-sphere:active .st-orb-body {
  transform: scale(0.94);
}

/* ---------- Liquid Pearl SVG ---------- */
.st-orb-pearl-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.st-orb-stop-dome-top { stop-color: var(--st-orb-dome-top); }
.st-orb-stop-dome-mid { stop-color: var(--st-orb-dome-mid); }
.st-orb-stop-dome-edge { stop-color: var(--st-orb-dome-edge); }

.st-orb-stop-cyan { stop-color: var(--st-orb-cyan); }
.st-orb-stop-azure { stop-color: var(--st-orb-azure); }
.st-orb-stop-iris { stop-color: var(--st-orb-iris); }
.st-orb-stop-violet { stop-color: var(--st-orb-violet); }
.st-orb-stop-white { stop-color: var(--st-orb-white); }
.st-orb-stop-rim-shadow { stop-color: var(--st-orb-dome-edge); }

.st-orb-core-glow {
  opacity: var(--st-orb-core-opacity);
  transition: opacity var(--st-dur-3) var(--st-ease-out);
}

.st-orb-water-level {
  transition: transform 280ms var(--st-ease-out);
}

.st-orb-wave-back-group {
  opacity: var(--st-orb-wave-back-opacity);
  transition: opacity var(--st-dur-3) var(--st-ease-out);
}

.st-orb-wave-front-group {
  opacity: var(--st-orb-wave-front-opacity);
  transition: opacity var(--st-dur-3) var(--st-ease-out);
}

.st-orb-wave-subglow {
  opacity: var(--st-orb-wave-glow-opacity);
  transition: opacity var(--st-dur-3) var(--st-ease-out);
}

.st-orb-wave-meniscus {
  opacity: var(--st-orb-meniscus-opacity);
  transition: opacity var(--st-dur-3) var(--st-ease-out);
}

.st-orb-wave-front {
  animation: st-orb-wave-flow 8.4s linear infinite;
  animation-play-state: paused;
}

.st-orb-wave-back {
  animation: st-orb-wave-flow-rev 12.2s linear infinite;
  animation-play-state: paused;
}

.st-orb-cluster[data-hovered='true'] .st-orb-wave-front,
.st-orb-cluster[data-hovered='true'] .st-orb-wave-back {
  animation-play-state: running;
}

.st-orb-cluster[data-playing='true'] .st-orb-wave-front {
  animation-duration: 2.5s;
  animation-play-state: running;
}

.st-orb-cluster[data-playing='true'] .st-orb-wave-back {
  animation-duration: 4.1s;
  animation-play-state: running;
}

@keyframes st-orb-wave-flow {
  from { transform: translateX(0px); }
  to { transform: translateX(-100px); }
}

@keyframes st-orb-wave-flow-rev {
  from { transform: translateX(-120px); }
  to { transform: translateX(0px); }
}

/* ---------- Album Cover & Glass Optical Overlays ---------- */
.st-orb-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  opacity: 0;
  transform: scale(1.08);
  transition:
    opacity var(--st-dur-3) var(--st-ease-out),
    transform var(--st-dur-3) var(--st-ease-out),
    filter var(--st-dur-2) var(--st-ease-out);
  display: block;
}

.st-orb-cover[data-visible='true'] {
  opacity: 1;
  transform: scale(1);
}

.st-orb-cover[data-visible='true'][data-dimmed='true'] {
  opacity: 0.22;
  filter: blur(2px);
}

/* Specular top-left glint, catchlight, bottom bounce & glass rim */
.st-orb-glass-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 44% 22% at 34% 18%,
      color-mix(in srgb, var(--st-orb-white) 72%, transparent) 0%,
      color-mix(in srgb, var(--st-orb-white) 16%, transparent) 58%,
      transparent 100%
    ),
    radial-gradient(
      circle at 24% 28%,
      color-mix(in srgb, var(--st-orb-white) 58%, transparent) 0%,
      transparent 14%
    ),
    radial-gradient(
      ellipse 68% 24% at 50% 90%,
      color-mix(in srgb, var(--st-holo) 34%, var(--st-orb-white)) 0%,
      transparent 78%
    );
  box-shadow:
    inset 0 1.5px 3px color-mix(in srgb, var(--st-orb-white) 68%, transparent),
    inset 0 -4px 8px color-mix(in srgb, var(--st-accent) 24%, transparent);
}

/* ---------- Hover Play / Pause Overlay ---------- */
.st-orb-play-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--st-text-on-accent);
  background: var(--st-orb-scrim);
  opacity: 0;
  transform: scale(0.92);
  pointer-events: none;
  transition:
    opacity var(--st-dur-1) var(--st-ease-out),
    transform var(--st-dur-2) var(--st-spring-bouncy);
}

.st-orb-play-overlay[data-paused='true'] svg {
  transform: translateX(0.75px);
}

.st-orb-sphere:hover .st-orb-play-overlay:not([data-vol-hud='true']),
.st-orb-sphere:focus-visible .st-orb-play-overlay:not([data-vol-hud='true']) {
  opacity: 1;
  transform: scale(1);
}

/* ---------- Volume HUD Ring Arc & Readout ---------- */
.st-orb-vol-hud {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--st-orb-scrim);
  color: var(--st-text-on-accent);
  pointer-events: none;
  opacity: 0;
  transform: scale(0.92);
  transition:
    opacity var(--st-dur-1) var(--st-ease-out),
    transform var(--st-dur-2) var(--st-ease-out);
}

.st-orb-vol-hud[data-visible='true'] {
  opacity: 1;
  transform: scale(1);
}

.st-orb-hud-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.st-orb-hud-track {
  fill: none;
  stroke: var(--st-orb-hud-track);
  stroke-width: 6.5;
}

.st-orb-hud-arc {
  fill: none;
  stroke-width: 6.5;
  stroke-linecap: round;
  transition:
    stroke-dashoffset 130ms var(--st-ease-out),
    opacity 120ms var(--st-ease-out);
}

.st-orb-hud-label {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  line-height: 1;
  font-family: var(--st-mono);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 3px color-mix(in srgb, var(--st-text-1) 45%, transparent);
}

.st-orb-hud-num {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.st-orb-hud-pct {
  display: none;
  font-size: 9px;
  font-weight: 600;
  opacity: 0.78;
  margin-left: 0.5px;
}

.st-orb-hud-mute {
  font-family: var(--st-font);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.st-orb-cluster[data-hovered='true'] .st-orb-hud-num {
  font-size: 16.5px;
}

.st-orb-cluster[data-hovered='true'] .st-orb-hud-pct {
  display: inline;
}

.st-orb-cluster[data-hovered='true'] .st-orb-hud-mute {
  font-size: 12px;
}

/* ---------- Reduced Motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .st-orb-tooltip,
  .st-orb-status-dot,
  .st-orb-vol-badge,
  .st-orb-cluster,
  .st-orb-side,
  .st-orb-mini-btn,
  .st-orb-sphere,
  .st-orb-caustic,
  .st-orb-halo,
  .st-orb-audio-aura,
  .st-orb-refraction,
  .st-orb-body,
  .st-orb-water-level,
  .st-orb-wave-front,
  .st-orb-wave-back,
  .st-orb-cover,
  .st-orb-play-overlay,
  .st-orb-vol-hud,
  .st-orb-hud-arc {
    animation: none !important;
    transition-duration: 1ms !important;
    transition-delay: 0ms !important;
  }
}
`
