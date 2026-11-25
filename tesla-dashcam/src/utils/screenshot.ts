import { CAMERA_LABELS, CameraAngle } from '../types/dashcam';

export function exportSnapshot(
  sources: { angle: CameraAngle; el: HTMLVideoElement | HTMLCanvasElement | null }[],
  timestampText: string,
  filePrefix: string
): boolean {
  const valid = sources.filter((s) => s.el !== null);
  if (valid.length === 0) return false;

  const isMulti = valid.length > 1;
  const tileW = 960;
  const tileH = 600;
  const cols = isMulti ? 2 : 1;
  const rows = isMulti ? Math.ceil(valid.length / 2) : 1;

  const canvas = document.createElement('canvas');
  canvas.width = cols * tileW;
  canvas.height = rows * tileH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  valid.forEach((item, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = col * tileW;
    const y = row * tileH;
    const el = item.el!;

    try {
      ctx.drawImage(el, x, y, tileW, tileH);
    } catch {
      // Ignore cross-origin or unready frames
    }

    // Subtle Tesla badge per camera
    ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.fillRect(x + 14, y + 14, 160, 28);
    ctx.fillStyle = '#f5f5f7';
    ctx.font = '600 13px Inter, sans-serif';
    const label = CAMERA_LABELS[item.angle];
    ctx.fillText(`${label.zh} · ${label.en}`, x + 24, y + 33);
  });

  // Timestamp watermark at bottom-right
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(canvas.width - 280, canvas.height - 40, 266, 28);
  ctx.fillStyle = '#ffffff';
  ctx.font = '500 13px monospace';
  ctx.fillText(`TESLACAM  ${timestampText}`, canvas.width - 268, canvas.height - 21);

  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = `TeslaCam_${filePrefix.replace(/[:\s/]+/g, '_')}.png`;
  link.click();
  return true;
}
