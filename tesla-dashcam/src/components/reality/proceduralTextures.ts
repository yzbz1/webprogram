import * as THREE from 'three';
import { AtmospherePreset } from '../../types/realityView';

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Generates realistic asphalt diffuse, roughness (with wet puddles for night reflections),
 * and bump textures using deterministic procedural noise.
 */
export function createAsphaltTextures(isWet: boolean): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const diffCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  diffCanvas.width = roughCanvas.width = bumpCanvas.width = size;
  diffCanvas.height = roughCanvas.height = bumpCanvas.height = size;

  const dCtx = diffCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;

  const dImg = dCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);

  const rand = seededRand(4219);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const grain = rand();
      // Smooth low-frequency puddle waves
      const wave =
        Math.sin((x / size) * Math.PI * 4) * Math.cos((y / size) * Math.PI * 4) +
        0.5 * Math.sin(((x + y) / size) * Math.PI * 6);
      const isPuddle = isWet && wave > 0.38;

      const baseTone = isWet ? (isPuddle ? 20 : 30) : 44;
      const delta = (grain - 0.5) * (isPuddle ? 8 : 22);
      const v = Math.max(10, Math.min(95, Math.round(baseTone + delta)));

      dImg.data[idx] = v;
      dImg.data[idx + 1] = v + 1;
      dImg.data[idx + 2] = v + 4;
      dImg.data[idx + 3] = 255;

      // Roughness: dark (low value) = glossy wet reflection; bright = matte asphalt
      const roughVal = isWet
        ? isPuddle
          ? 18 + Math.round(grain * 14)
          : 118 + Math.round(grain * 50)
        : 185 + Math.round(grain * 55);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = roughVal;
      rImg.data[idx + 3] = 255;

      const bumpVal = isPuddle ? 126 : Math.round(110 + grain * 45);
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bumpVal;
      bImg.data[idx + 3] = 255;
    }
  }

  dCtx.putImageData(dImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  // Subtle tire wear streaks
  dCtx.fillStyle = isWet ? 'rgba(10,12,16,0.22)' : 'rgba(22,24,28,0.16)';
  dCtx.fillRect(size * 0.2, 0, size * 0.14, size);
  dCtx.fillRect(size * 0.66, 0, size * 0.14, size);

  const configure = (c: HTMLCanvasElement, srgb = false) => {
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(36, 36);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  return {
    map: configure(diffCanvas, true),
    roughnessMap: configure(roughCanvas, false),
    bumpMap: configure(bumpCanvas, false),
  };
}

/**
 * Generates textured concrete sidewalk tiles.
 */
export function createSidewalkTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4e525c';
  ctx.fillRect(0, 0, size, size);

  const rand = seededRand(9012);
  for (let i = 0; i < 4500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const c = 66 + Math.floor(rand() * 26);
    ctx.fillStyle = `rgb(${c},${c + 1},${c + 4})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Paving slab seams
  ctx.strokeStyle = 'rgba(20, 22, 28, 0.45)';
  ctx.lineWidth = 2;
  for (let p = 0; p <= size; p += 64) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates multi-story urban facade textures (diffuse + emissive lit windows/storefronts).
 */
export function createBuildingFacadeTextures(
  styleIndex: number,
  isNight: boolean
): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const w = 256;
  const h = 512;
  const diff = document.createElement('canvas');
  const emis = document.createElement('canvas');
  diff.width = emis.width = w;
  diff.height = emis.height = h;

  const dCtx = diff.getContext('2d')!;
  const eCtx = emis.getContext('2d')!;

  const palettes = [
    { wall: '#282c36', trim: '#1d2028', glow: '#ffd996' }, // Dark urban stone + warm interior
    { wall: '#3c2b26', trim: '#291c18', glow: '#ffcf87' }, // Downtown brick storefront
    { wall: '#1f2c3d', trim: '#15202e', glow: '#bae6fd' }, // Modern glass tower
    { wall: '#34363d', trim: '#23252b', glow: '#fde68a' }, // Concrete mid-rise
  ];
  const pal = palettes[styleIndex % palettes.length];
  const rand = seededRand(100 + styleIndex * 77);

  dCtx.fillStyle = pal.wall;
  dCtx.fillRect(0, 0, w, h);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);

  // Floor ledges
  const rows = 9;
  const cols = 5;
  const padX = 16;
  const cellW = (w - padX * 2) / cols;
  const cellH = (h - 76) / rows;

  for (let r = 0; r < rows; r++) {
    const y = 16 + r * cellH;
    dCtx.fillStyle = pal.trim;
    dCtx.fillRect(0, y + cellH - 5, w, 4);

    for (let c = 0; c < cols; c++) {
      const x = padX + c * cellW + 5;
      const winW = cellW - 10;
      const winH = cellH - 14;
      const lit = isNight ? rand() > 0.34 : rand() > 0.78;

      dCtx.fillStyle = lit ? pal.glow : '#111622';
      dCtx.fillRect(x, y + 3, winW, winH);

      // Subtle window frame
      dCtx.strokeStyle = pal.trim;
      dCtx.lineWidth = 2;
      dCtx.strokeRect(x, y + 3, winW, winH);

      if (lit) {
        const bright = 0.5 + rand() * 0.5;
        eCtx.fillStyle = pal.glow;
        eCtx.globalAlpha = bright;
        eCtx.fillRect(x + 1, y + 4, winW - 2, winH - 2);
        eCtx.globalAlpha = 1;
      }
    }
  }

  // Ground-floor glowing retail storefront & neon sign band
  const shopY = h - 62;
  dCtx.fillStyle = '#151821';
  dCtx.fillRect(0, shopY, w, 62);
  dCtx.fillStyle = isNight ? '#ffe3b3' : '#334155';
  dCtx.fillRect(14, shopY + 14, w - 28, 42);
  if (isNight) {
    eCtx.fillStyle = '#ffdca8';
    eCtx.fillRect(14, shopY + 14, w - 28, 42);
    const neonColors = ['#38bdf8', '#f43f5e', '#fbbf24', '#2dd4bf'];
    const neon = neonColors[styleIndex % neonColors.length];
    dCtx.fillStyle = neon;
    dCtx.fillRect(20, shopY + 2, w - 40, 7);
    eCtx.fillStyle = neon;
    eCtx.fillRect(20, shopY + 2, w - 40, 7);
  }

  const map = new THREE.CanvasTexture(diff);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const emissiveMap = new THREE.CanvasTexture(emis);
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.ClampToEdgeWrapping;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  return { map, emissiveMap };
}

/**
 * Generates soft radial glow sprite texture for streetlamps, brake bounce, and headlights.
 */
export function createGlowSpriteTexture(innerColor = 'rgba(255,255,255,1)'): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.35, innerColor.replace(/[\d.]+\)$/, '0.45)'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates an HDR-like PMREM environment map for realistic clearcoat car paint & glass roof reflections.
 */
export function createProceduralEnvMap(
  renderer: THREE.WebGLRenderer,
  atmosphere: AtmospherePreset
): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();

  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 512;
  skyCanvas.height = 256;
  const ctx = skyCanvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  if (atmosphere === 'night_rain') {
    grad.addColorStop(0, '#070b18');
    grad.addColorStop(0.45, '#16213e');
    grad.addColorStop(0.55, '#2b3252');
    grad.addColorStop(1, '#090b10');
  } else if (atmosphere === 'sunset') {
    grad.addColorStop(0, '#1e3a5f');
    grad.addColorStop(0.42, '#c2593f');
    grad.addColorStop(0.54, '#ffb56b');
    grad.addColorStop(1, '#262328');
  } else {
    grad.addColorStop(0, '#1d65c1');
    grad.addColorStop(0.46, '#87c5f5');
    grad.addColorStop(0.55, '#dbeafe');
    grad.addColorStop(1, '#374151');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Specular highlight strips (simulates overhead streetlamps & city neon reflections on car clearcoat)
  if (atmosphere === 'night_rain') {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#7dd3fc' : i % 2 === 0 ? '#fde68a' : '#fb7185';
      ctx.fillRect(i * 32 + 8, 108 + (i % 3) * 8, 10, 6);
    }
  } else {
    // Bright sun specular disc
    ctx.fillStyle = atmosphere === 'sunset' ? '#fff3d6' : '#ffffff';
    ctx.beginPath();
    ctx.arc(380, atmosphere === 'sunset' ? 112 : 64, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  const envTex = new THREE.CanvasTexture(skyCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  envScene.background = envTex;

  const rt = pmrem.fromScene(envScene, 0.04);
  envTex.dispose();
  pmrem.dispose();
  return rt.texture;
}
