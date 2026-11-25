import React, { useEffect, useRef } from 'react';
import { CameraAngle, DemoSceneId } from '../../types/dashcam';

interface DemoCameraCanvasProps {
  scene: DemoSceneId;
  camera: CameraAngle;
  currentTime: number;
  width?: number;
  height?: number;
  className?: string;
  canvasRefCallback?: (el: HTMLCanvasElement | null) => void;
}

/**
 * High-fidelity procedural 4-angle Tesla Dashcam video simulator.
 * Deterministic render from (scene, camera, currentTime) so scrubbing,
 * speed control, frame stepping, and 4-cam synchronization work identically to real MP4s.
 */
export const DemoCameraCanvas: React.FC<DemoCameraCanvasProps> = ({
  scene,
  camera,
  currentTime,
  width = 960,
  height = 600,
  className = 'w-full h-full object-cover',
  canvasRefCallback,
}) => {
  const internalRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    canvasRefCallback?.(internalRef.current);
    return () => canvasRefCallback?.(null);
  }, [canvasRefCallback]);

  useEffect(() => {
    const canvas = internalRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    if (scene === 'sentry_garage') {
      drawSentryGarage(ctx, w, h, camera, currentTime);
    } else if (scene === 'highway_cutin') {
      drawHighwayCutin(ctx, w, h, camera, currentTime);
    } else if (scene === 'night_city') {
      drawNightCity(ctx, w, h, camera, currentTime);
    } else {
      drawRecentPark(ctx, w, h, camera, currentTime);
    }

    // Authentic Tesla HW3/HW4 camera optical traits:
    // Repeater cameras have slightly warmer RCCC/RCCB tint + sleek body fender edge!
    if (camera === 'left_repeater' || camera === 'right_repeater') {
      ctx.fillStyle = 'rgba(218, 154, 72, 0.08)';
      ctx.fillRect(0, 0, w, h);
      drawTeslaFenderOverlay(ctx, w, h, camera === 'left_repeater' ? 'left' : 'right');
    }

    // Subtle wide-angle vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Subtle film/sensor scan grain bar near top for realism
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, w, 2);

    ctx.restore();
  }, [scene, camera, currentTime]);

  return <canvas ref={internalRef} width={width} height={height} className={className} />;
};

function drawTeslaFenderOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  side: 'left' | 'right'
) {
  ctx.save();
  ctx.beginPath();
  if (side === 'left') {
    // Left repeater looks rearward along the left flank -> car body appears on the right edge
    ctx.moveTo(w, h * 0.28);
    ctx.quadraticCurveTo(w * 0.87, h * 0.45, w * 0.84, h);
    ctx.lineTo(w, h);
  } else {
    // Right repeater looks rearward along the right flank -> car body appears on the left edge
    ctx.moveTo(0, h * 0.28);
    ctx.quadraticCurveTo(w * 0.13, h * 0.45, w * 0.16, h);
    ctx.lineTo(0, h);
  }
  ctx.closePath();

  const grad = ctx.createLinearGradient(
    side === 'left' ? w * 0.82 : 0,
    h * 0.3,
    side === 'left' ? w : w * 0.18,
    h
  );
  grad.addColorStop(0, '#2a2d35');
  grad.addColorStop(0.5, '#191b20');
  grad.addColorStop(1, '#0b0c0f');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawSentryGarage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camera: CameraAngle,
  t: number
) {
  // Underground concrete garage backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#13161b');
  bg.addColorStop(0.46, '#1f242c');
  bg.addColorStop(0.48, '#232830');
  bg.addColorStop(1, '#12151a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const horizon = h * 0.47;

  // Ceiling fluorescent light strips
  for (let i = 0; i < 4; i++) {
    const lx = w * (0.12 + i * 0.26);
    const ly = h * (0.1 + (i % 2) * 0.05);
    const glow = ctx.createRadialGradient(lx, ly, 4, lx, ly, 120);
    glow.addColorStop(0, 'rgba(215, 232, 255, 0.42)');
    glow.addColorStop(1, 'rgba(215, 232, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lx - 130, ly - 50, 260, 140);
    ctx.fillStyle = '#e8f1ff';
    ctx.fillRect(lx - 42, ly - 3, 84, 5);
  }

  // Concrete pillars with yellow/black hazard stripes
  const drawPillar = (x: number, pw: number, label: string) => {
    ctx.fillStyle = '#2d333d';
    ctx.fillRect(x, h * 0.05, pw, h * 0.65);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(x, h * 0.42, pw, h * 0.14);
    ctx.fillStyle = '#18181b';
    for (let s = 0; s < 4; s++) {
      ctx.fillRect(x + s * (pw / 4), h * 0.42, pw / 9, h * 0.14);
    }
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(label, x + 8, h * 0.36);
  };

  // Epoxy floor painted parking lines
  ctx.strokeStyle = 'rgba(225, 230, 240, 0.38)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h);
  ctx.lineTo(w * 0.34, horizon + 15);
  ctx.moveTo(w * 0.88, h);
  ctx.lineTo(w * 0.66, horizon + 15);
  ctx.stroke();

  if (camera === 'front') {
    drawPillar(w * 0.14, 62, 'B2-048');
    drawPillar(w * 0.78, 62, 'B2-049');
    // Opposite parked sedan
    drawSimpleCar(ctx, w * 0.49, horizon + 36, 1.05, '#475569', false, '沪A·D8821');
    // Subtle Sentry flash reflex at t=72s (headlights pulse!)
    if (t >= 71.5 && t <= 73.2) {
      const pulse = Math.sin((t - 71.5) * Math.PI * 3) > 0 ? 0.28 : 0.05;
      ctx.fillStyle = `rgba(224, 242, 254, ${pulse})`;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (camera === 'left_repeater') {
    drawPillar(w * 0.22, 54, 'B2-047');
    // Adjacent dark SUV on the left
    drawSimpleCar(ctx, w * 0.3, horizon + 65, 1.25, '#334155', false, '沪A·F3109');

    // === SENTRY TRIGGER EVENT: Person walks by & inspects car at t=62..86s ===
    if (t >= 58 && t <= 92) {
      let progress = 0;
      let pausing = false;
      if (t < 70) {
        progress = (t - 58) / 12; // walking in 0 -> 0.55
        progress *= 0.55;
      } else if (t <= 76) {
        progress = 0.55 + Math.sin((t - 70) * 1.4) * 0.015; // pauses near driver window!
        pausing = true;
      } else {
        progress = 0.55 + ((t - 76) / 16) * 0.6; // walks away
      }

      const px = w * (0.18 + progress * 0.62);
      const scale = 0.72 + Math.sin(Math.min(1, progress) * Math.PI) * 0.48;
      const py = horizon + 125 + scale * 40;
      const walkCycle = pausing ? 0 : Math.sin(t * 7.5);

      drawPedestrian(ctx, px, py, scale, walkCycle, pausing);

      // Red Sentry AI detection box briefly near trigger moment (70..76s)
      if (t >= 70.2 && t <= 75.8) {
        ctx.save();
        ctx.strokeStyle = 'rgba(227, 25, 55, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(px - 38 * scale, py - 148 * scale, 76 * scale, 156 * scale);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(227, 25, 55, 0.88)';
        ctx.fillRect(px - 38 * scale, py - 170 * scale, 118, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillText('SENTRY · OBJECT', px - 33 * scale, py - 156 * scale);
        ctx.restore();
      }
    }
  } else if (camera === 'right_repeater') {
    drawPillar(w * 0.72, 54, 'B2-050');
    drawSimpleCar(ctx, w * 0.66, horizon + 65, 1.25, '#cbd5e1', false, '沪A·D1198');
  } else {
    // Rear view: garage driving lane + occasional passing car headlights
    drawPillar(w * 0.08, 48, 'EXIT →');
    drawPillar(w * 0.86, 48, 'B2');
    const passPhase = (t % 38) / 38;
    if (passPhase > 0.25 && passPhase < 0.65) {
      const carX = w * ((passPhase - 0.25) / 0.4);
      drawSimpleCar(ctx, carX, horizon + 45, 0.9, '#64748b', true, '');
      // Headlight beam on garage floor
      const beam = ctx.createRadialGradient(carX + 60, horizon + 55, 5, carX + 120, horizon + 65, 160);
      beam.addColorStop(0, 'rgba(255, 250, 220, 0.45)');
      beam.addColorStop(1, 'rgba(255, 250, 220, 0)');
      ctx.fillStyle = beam;
      ctx.fillRect(carX - 40, horizon - 20, 320, 190);
    }
  }
}

function drawHighwayCutin(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camera: CameraAngle,
  t: number
) {
  const horizon = h * 0.44;
  // Bright overcast daytime sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#5a7ea6');
  sky.addColorStop(0.65, '#9cb6cf');
  sky.addColorStop(1, '#d3dfe8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  // Distant Shanghai skyline silhouettes
  ctx.fillStyle = 'rgba(84, 102, 124, 0.42)';
  for (let i = 0; i < 18; i++) {
    const bx = ((i * 68) % (w + 60)) - 30;
    const bh = 28 + ((i * 37) % 75);
    ctx.fillRect(bx, horizon - bh, 42, bh);
  }

  // Asphalt road
  const road = ctx.createLinearGradient(0, horizon, 0, h);
  road.addColorStop(0, '#444b54');
  road.addColorStop(1, '#262a30');
  ctx.fillStyle = road;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Perspective lane lines scrolling smoothly with speed
  const speed = t >= 49 && t <= 56 ? 18 : 34; // slows down during cut-in!
  const scroll = (t * speed) % 100;

  if (camera === 'front' || camera === 'back') {
    const dir = camera === 'front' ? 1 : -1;
    // Highway guardrails
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.44, horizon);
    ctx.lineTo(-w * 0.12, h);
    ctx.moveTo(w * 0.56, horizon);
    ctx.lineTo(w * 1.12, h);
    ctx.stroke();

    // Dashed lane dividers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    for (let lane of [-0.04, 0.04]) {
      for (let i = 0; i < 9; i++) {
        const z0 = ((i * 12 + (dir > 0 ? scroll : 100 - scroll)) % 100) / 100;
        const z1 = Math.min(1, z0 + 0.055);
        const y0 = horizon + Math.pow(z0, 1.9) * (h - horizon);
        const y1 = horizon + Math.pow(z1, 1.9) * (h - horizon);
        const x0 = w * 0.5 + lane * w * (0.5 + Math.pow(z0, 1.4) * 5.2);
        const x1 = w * 0.5 + lane * w * (0.5 + Math.pow(z1, 1.4) * 5.2);
        ctx.lineWidth = 1.5 + z0 * 6;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }

    // Overhead highway gantry sign passing every 22s
    const gantryPhase = (t * 0.25) % 1;
    if (camera === 'front' && gantryPhase > 0.1 && gantryPhase < 0.92) {
      const gz = Math.pow(gantryPhase, 2.2);
      const gy = horizon - 18 - gz * 180;
      const gw = 120 + gz * 680;
      ctx.fillStyle = '#15803d';
      ctx.fillRect(w / 2 - gw / 2, gy, gw, 20 + gz * 50);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(w / 2 - gw / 2 + 3, gy + 3, gw - 6, 14 + gz * 50);
      if (gz > 0.25) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(10 + gz * 16)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('延安西路 · 虹桥枢纽 2km', w / 2, gy + 15 + gz * 28);
        ctx.textAlign = 'left';
      }
    }

    if (camera === 'front') {
      // === CUT-IN SEDAN EVENT around t=47..58s ===
      let cutX = w * 0.72;
      let cutScale = 0.75;
      let brakeLights = false;
      if (t >= 45 && t <= 62) {
        if (t < 52) {
          const p = (t - 45) / 7;
          cutX = w * (0.78 - p * 0.28);
          cutScale = 0.72 + p * 0.62;
          brakeLights = p > 0.55;
        } else if (t < 56) {
          cutX = w * 0.5;
          cutScale = 1.34 - ((t - 52) / 4) * 0.2;
          brakeLights = true;
        } else {
          const p = (t - 56) / 6;
          cutX = w * 0.5;
          cutScale = 1.14 - p * 0.45;
        }
        drawSimpleCar(ctx, cutX, horizon + 40 + cutScale * 75, cutScale, '#ea580c', false, '沪B·7K920', brakeLights);
      } else {
        // Normal distant traffic
        drawSimpleCar(ctx, w * 0.49, horizon + 55, 0.55, '#64748b', false, '沪A·90412');
      }
    } else {
      // Rear camera: following white SUV
      const wobble = Math.sin(t * 0.9) * 14;
      drawSimpleCar(ctx, w * 0.5 + wobble, horizon + 95, 0.92, '#e2e8f0', true, '沪C·52811');
    }
  } else {
    // Side repeater highway view
    const isRight = camera === 'right_repeater';
    // Scrolling road shoulder stripes
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const p = ((i * 15 + scroll) % 100) / 100;
      const y = horizon + Math.pow(p, 1.5) * (h - horizon);
      ctx.beginPath();
      ctx.moveTo(isRight ? w * 0.2 : w * 0.8, y);
      ctx.lineTo(isRight ? w * 0.9 : w * 0.1, y + 12);
      ctx.stroke();
    }
    // Right repeater shows the orange sedan overtaking right before cutting into front camera (41..48s)
    if (isRight && t >= 41 && t <= 49) {
      const p = (t - 41) / 8;
      const cx = w * (0.88 - p * 0.45);
      const cs = 0.55 + p * 0.9;
      drawSimpleCar(ctx, cx, horizon + 50 + cs * 50, cs, '#ea580c', true, '沪B·7K920');
    } else if (!isRight) {
      // Left repeater shows median barrier + passing car in opposite/left lane
      const p = (t * 0.22) % 1;
      drawSimpleCar(ctx, w * (0.15 + p * 0.5), horizon + 62 + p * 45, 0.6 + p * 0.5, '#3b82f6', true, '');
    }
  }
}

function drawNightCity(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camera: CameraAngle,
  t: number
) {
  const horizon = h * 0.46;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#040711');
  sky.addColorStop(1, '#111b33');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  // Illuminated skyscrapers
  for (let i = 0; i < 16; i++) {
    const bx = i * 64 - ((t * 4) % 64);
    const bh = 45 + ((i * 53) % 130);
    ctx.fillStyle = '#0d1426';
    ctx.fillRect(bx, horizon - bh, 50, bh);
    // Warm & cyan lit windows
    ctx.fillStyle = i % 3 === 0 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(253, 224, 71, 0.45)';
    for (let wy = horizon - bh + 10; wy < horizon - 10; wy += 16) {
      for (let wx = bx + 6; wx < bx + 42; wx += 12) {
        if ((wx + wy + i) % 5 !== 0) ctx.fillRect(wx, wy, 6, 7);
      }
    }
  }

  // Wet reflective dark asphalt
  const road = ctx.createLinearGradient(0, horizon, 0, h);
  road.addColorStop(0, '#13161f');
  road.addColorStop(1, '#090b10');
  ctx.fillStyle = road;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Moving streetlights & neon bokeh reflections
  const scroll = (t * 26) % 100;
  for (let i = 0; i < 6; i++) {
    const z = ((i * 18 + scroll) % 100) / 100;
    const scale = Math.pow(z, 1.7);
    const ly = horizon - 12 - scale * 170;
    const lxLeft = w * 0.42 - scale * w * 0.46;
    const lxRight = w * 0.58 + scale * w * 0.46;
    for (const lx of [lxLeft, lxRight]) {
      const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 18 + scale * 46);
      glow.addColorStop(0, 'rgba(255, 226, 158, 0.95)');
      glow.addColorStop(1, 'rgba(255, 196, 92, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lx, ly, 18 + scale * 46, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Lane markings
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.46, horizon);
  ctx.lineTo(w * 0.16, h);
  ctx.stroke();

  if (camera === 'front') {
    const bob = Math.sin(t * 1.4) * 10;
    drawSimpleCar(ctx, w * 0.51 + bob, horizon + 92, 0.96, '#1e293b', false, '沪A·D0915', true);
    // Red taillight reflection on wet street
    const redGlow = ctx.createRadialGradient(w * 0.51 + bob, horizon + 150, 5, w * 0.51 + bob, horizon + 180, 120);
    redGlow.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
    redGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = redGlow;
    ctx.fillRect(w * 0.3, horizon + 80, w * 0.4, 180);
  } else if (camera === 'back') {
    drawSimpleCar(ctx, w * 0.48, horizon + 88, 0.85, '#334155', true, '');
  } else {
    drawSimpleCar(ctx, w * 0.5, horizon + 100, 0.78, '#1e293b', true, '');
  }
}

function drawRecentPark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camera: CameraAngle,
  t: number
) {
  const horizon = h * 0.46;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#3b82f6');
  sky.addColorStop(1, '#bae6fd');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  // Modern Tesla Supercharger canopy / buildings
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(w * 0.1, horizon - 72, w * 0.8, 72);
  ctx.fillStyle = '#e31937';
  ctx.fillRect(w * 0.1, horizon - 78, w * 0.8, 8);

  // Asphalt lot
  ctx.fillStyle = '#374151';
  ctx.fillRect(0, horizon, w, h - horizon);

  // Supercharger stalls (white/red pillars)
  for (let i = 0; i < 4; i++) {
    const sx = w * (0.18 + i * 0.21);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(sx, horizon - 28, 28, 78);
    ctx.fillStyle = '#e31937';
    ctx.fillRect(sx + 6, horizon - 18, 16, 46);
    ctx.fillStyle = '#111827';
    ctx.fillRect(sx + 9, horizon - 10, 10, 32);
  }

  // Slow parking pull-in movement
  const drift = Math.sin(t * 0.45) * 18;
  if (camera === 'front' || camera === 'back') {
    drawSimpleCar(ctx, w * 0.72 + drift, horizon + 62, 0.88, '#f8fafc', camera === 'back', '沪A·D7777');
  } else {
    drawSimpleCar(ctx, w * 0.52 + drift, horizon + 74, 0.95, '#94a3b8', false, '沪A·D2048');
  }
}

function drawSimpleCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  color: string,
  facingUs: boolean,
  plate: string,
  brakeLights = false
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  ctx.beginPath();
  ctx.ellipse(0, 34, 88, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tires
  ctx.fillStyle = '#09090b';
  ctx.fillRect(-74, 14, 24, 24);
  ctx.fillRect(50, 14, 24, 24);

  // Lower body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-80, -22, 160, 44, 12);
  ctx.fill();

  // Cabin greenhouse
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-60, -20);
  ctx.lineTo(-42, -52);
  ctx.lineTo(42, -52);
  ctx.lineTo(60, -20);
  ctx.closePath();
  ctx.fill();

  // Rear/Front glass
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(-48, -22);
  ctx.lineTo(-35, -45);
  ctx.lineTo(35, -45);
  ctx.lineTo(48, -22);
  ctx.closePath();
  ctx.fill();

  // Lights
  if (facingUs) {
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(-70, -10, 26, 9);
    ctx.fillRect(44, -10, 26, 9);
  } else {
    ctx.fillStyle = brakeLights ? '#ff1e38' : '#b91c1c';
    ctx.fillRect(-72, -11, 28, 9);
    ctx.fillRect(44, -11, 28, 9);
    if (brakeLights) {
      // High-mount 3rd brake light + glow
      ctx.fillStyle = '#ff2a45';
      ctx.fillRect(-20, -45, 40, 4);
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 18;
      ctx.fillRect(-72, -11, 28, 9);
      ctx.fillRect(44, -11, 28, 9);
      ctx.shadowBlur = 0;
    }
  }

  // EV Green License Plate
  if (plate) {
    ctx.fillStyle = plate.includes('D') || plate.includes('F') ? '#22c55e' : '#2563eb';
    ctx.fillRect(-28, 1, 56, 15);
    ctx.fillStyle = plate.includes('D') || plate.includes('F') ? '#052e16' : '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(plate, 0, 12);
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

function drawPedestrian(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  walkCycle: number,
  pausing: boolean
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -48);
  ctx.lineTo(-8 + walkCycle * 14, -4);
  ctx.moveTo(6, -48);
  ctx.lineTo(8 - walkCycle * 14, -4);
  ctx.stroke();

  // Jacket torso
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(-18, -104, 36, 60, 12);
  ctx.fill();

  // Arms (raises arm slightly when peering into window!)
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-16, -96);
  ctx.lineTo(-22 - walkCycle * 8, -56);
  ctx.moveTo(16, -96);
  if (pausing) {
    ctx.lineTo(34, -106);
  } else {
    ctx.lineTo(22 + walkCycle * 8, -56);
  }
  ctx.stroke();

  // Head
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(0, -120, 13, 0, Math.PI * 2);
  ctx.fill();
  // Dark cap/hair
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, -124, 13, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
