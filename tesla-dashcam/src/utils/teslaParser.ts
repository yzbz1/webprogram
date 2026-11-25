import {
  ALL_CAMERAS,
  CameraAngle,
  ClipCategory,
  DashcamEvent,
  EventJson,
  VideoSegment,
} from '../types/dashcam';

const TESLA_VIDEO_REGEX =
  /^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})-(front|back|left_repeater|right_repeater|left_pillar|right_pillar)\.mp4$/i;

const FOLDER_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/;

export function parseTeslaTimestamp(key: string): Date {
  const m = key.match(FOLDER_DATE_REGEX);
  if (!m) {
    const fallback = new Date(key);
    return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
  }
  const [, y, mo, d, h, mi, s] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s)
  );
}

export function mapEventJsonCamera(code?: string): CameraAngle | undefined {
  switch (String(code ?? '').trim()) {
    case '0':
    case '1':
    case '2':
      return 'front';
    case '3':
    case '4':
      return 'left_repeater';
    case '5':
    case '6':
      return 'right_repeater';
    case '7':
      return 'back';
    default:
      return undefined;
  }
}

export function translateTeslaReason(reason?: string, category?: ClipCategory): string {
  if (!reason) {
    if (category === 'sentry') return '哨兵模式触发事件';
    if (category === 'saved') return '行车记录仪手动保存';
    return '循环录制片段';
  }
  const r = reason.toLowerCase();
  if (r.includes('sentry_aware_object_detection')) return '哨兵 · 检测到靠近物体';
  if (r.includes('sentry_aware_accel')) return '哨兵 · 检测到车辆震动';
  if (r.includes('sentry_aware_door')) return '哨兵 · 车门把手触碰';
  if (r.includes('sentry')) return '哨兵模式事件';
  if (r.includes('honk')) return '鸣笛自动保存';
  if (r.includes('aeb') || r.includes('emergency')) return '紧急制动自动保存';
  if (r.includes('dashcam_icon') || r.includes('launcher') || r.includes('panel_save')) {
    return '手动点击保存';
  }
  return reason.replace(/_/g, ' ');
}

interface RawFileItem {
  file: File;
  relativePath: string; // normalized with forward slashes
}

function detectCategory(pathParts: string[]): ClipCategory {
  const joined = pathParts.map((p) => p.toLowerCase());
  if (joined.some((p) => p === 'sentryclips' || p.includes('sentry'))) return 'sentry';
  if (joined.some((p) => p === 'savedclips' || p.includes('saved'))) return 'saved';
  if (joined.some((p) => p === 'recentclips' || p.includes('recent'))) return 'recent';
  return 'saved';
}

function getEventGroupKey(pathParts: string[], category: ClipCategory, fileName: string): string {
  // Expected: [.../TeslaCam/]SentryClips/2025-11-25_18-42-15/2025-11-25_18-33-00-front.mp4
  if (category === 'recent') {
    return '__recent__';
  }
  if (pathParts.length >= 2) {
    const parent = pathParts[pathParts.length - 2];
    if (FOLDER_DATE_REGEX.test(parent)) {
      return `${category}/${parent}`;
    }
    const lowerParent = parent.toLowerCase();
    if (!['teslacam', 'savedclips', 'sentryclips', 'recentclips'].includes(lowerParent)) {
      return `${category}/${parent}`;
    }
  }
  // Loose files without event subfolder: group by date prefix or filename
  const match = fileName.match(TESLA_VIDEO_REGEX);
  if (match) {
    return `${category}/loose_${match[1].slice(0, 10)}`;
  }
  return `${category}/loose_${fileName}`;
}

async function readEventJson(file: File): Promise<EventJson | undefined> {
  try {
    const text = await file.text();
    return JSON.parse(text) as EventJson;
  } catch {
    return undefined;
  }
}

function buildSegmentsFromMap(
  segmentMap: Map<string, Partial<Record<CameraAngle, File>>>
): VideoSegment[] {
  const keys = Array.from(segmentMap.keys()).sort();
  const segments: VideoSegment[] = keys.map((key) => ({
    id: key,
    timestampKey: key,
    startDate: parseTeslaTimestamp(key),
    duration: 60,
    cameras: segmentMap.get(key)!,
  }));

  // Refine estimated duration using consecutive timestamps when close (15s..65s)
  for (let i = 0; i < segments.length - 1; i++) {
    const diffSec = Math.round(
      (segments[i + 1].startDate.getTime() - segments[i].startDate.getTime()) / 1000
    );
    if (diffSec >= 5 && diffSec <= 65) {
      segments[i].duration = diffSec;
    }
  }
  return segments;
}

function collectAvailableCameras(segments: VideoSegment[]): CameraAngle[] {
  const set = new Set<CameraAngle>();
  for (const seg of segments) {
    for (const cam of ALL_CAMERAS) {
      if (seg.cameras[cam]) set.add(cam);
    }
  }
  return ALL_CAMERAS.filter((c) => set.has(c));
}

export async function parseTeslaFiles(items: RawFileItem[]): Promise<DashcamEvent[]> {
  type GroupBucket = {
    category: ClipCategory;
    folderName: string;
    segmentMap: Map<string, Partial<Record<CameraAngle, File>>>;
    looseVideos: File[];
    eventJsonFile?: File;
    thumbFile?: File;
  };

  const groups = new Map<string, GroupBucket>();

  for (const { file, relativePath } of items) {
    const norm = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = norm.split('/').filter(Boolean);
    const fileName = parts[parts.length - 1] || file.name;
    const lowerName = fileName.toLowerCase();

    // Skip hidden / macOS resource fork files
    if (fileName.startsWith('.') || fileName.startsWith('._')) continue;

    const category = detectCategory(parts);
    const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(lowerName);
    const isEventJson = lowerName === 'event.json';
    const isThumb = lowerName === 'thumb.png' || lowerName === 'thumb.jpg';

    if (!isVideo && !isEventJson && !isThumb) continue;

    const groupKey = getEventGroupKey(parts, category, fileName);
    let bucket = groups.get(groupKey);
    if (!bucket) {
      const folderName =
        groupKey === '__recent__'
          ? 'RecentClips'
          : groupKey.includes('/')
            ? groupKey.split('/').slice(1).join('/')
            : groupKey;
      bucket = {
        category,
        folderName,
        segmentMap: new Map(),
        looseVideos: [],
      };
      groups.set(groupKey, bucket);
    }

    if (isEventJson) {
      bucket.eventJsonFile = file;
      continue;
    }
    if (isThumb) {
      bucket.thumbFile = file;
      continue;
    }

    const teslaMatch = fileName.match(TESLA_VIDEO_REGEX);
    if (teslaMatch) {
      const [, tsKey, rawCam] = teslaMatch;
      const cam = rawCam.toLowerCase() as CameraAngle;
      let seg = bucket.segmentMap.get(tsKey);
      if (!seg) {
        seg = {};
        bucket.segmentMap.set(tsKey, seg);
      }
      seg[cam] = file;
    } else {
      bucket.looseVideos.push(file);
    }
  }

  const events: DashcamEvent[] = [];

  for (const [key, bucket] of groups.entries()) {
    // Handle RecentClips by splitting into continuous sessions (gap > 5 min)
    if (key === '__recent__' && bucket.segmentMap.size > 0) {
      const allSegs = buildSegmentsFromMap(bucket.segmentMap);
      const sessions: VideoSegment[][] = [];
      let current: VideoSegment[] = [];

      for (const seg of allSegs) {
        if (current.length === 0) {
          current.push(seg);
        } else {
          const prev = current[current.length - 1];
          const gapSec = (seg.startDate.getTime() - prev.startDate.getTime()) / 1000;
          if (gapSec > 300) {
            sessions.push(current);
            current = [seg];
          } else {
            current.push(seg);
          }
        }
      }
      if (current.length > 0) sessions.push(current);

      sessions.forEach((segs, idx) => {
        const totalDuration = segs.reduce((sum, s) => sum + s.duration, 0);
        const startDate = segs[0].startDate;
        events.push({
          id: `recent-${segs[0].timestampKey}-${idx}`,
          category: 'recent',
          folderName: segs[0].timestampKey,
          startDate,
          totalDuration,
          segments: segs,
          availableCameras: collectAvailableCameras(segs),
          locationLabel: '本地行车循环录像',
          reasonLabel: `最近录制 · ${segs.length} 段连续视频`,
        });
      });
      continue;
    }

    if (bucket.segmentMap.size > 0) {
      const segments = buildSegmentsFromMap(bucket.segmentMap);
      const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
      const eventJson = bucket.eventJsonFile
        ? await readEventJson(bucket.eventJsonFile)
        : undefined;

      const startDate = segments[0].startDate;
      let eventOffsetSeconds: number | undefined;
      if (eventJson?.timestamp) {
        const eventTime = new Date(eventJson.timestamp);
        if (!Number.isNaN(eventTime.getTime())) {
          let offset = 0;
          let matched = false;
          for (const seg of segments) {
            const diff = (eventTime.getTime() - seg.startDate.getTime()) / 1000;
            if (diff >= 0 && diff <= seg.duration + 10) {
              eventOffsetSeconds = Math.min(totalDuration - 1, Math.max(0, offset + diff));
              matched = true;
              break;
            }
            offset += seg.duration;
          }
          if (!matched) {
            const rawDiff = (eventTime.getTime() - startDate.getTime()) / 1000;
            if (rawDiff >= 0 && rawDiff <= totalDuration) {
              eventOffsetSeconds = rawDiff;
            } else {
              eventOffsetSeconds = Math.max(0, totalDuration - 60);
            }
          }
        }
      } else if (bucket.category !== 'recent') {
        // Default Tesla trigger position is near the final ~1 minute of a 10-min clip
        eventOffsetSeconds = Math.max(0, totalDuration - Math.min(60, totalDuration * 0.15));
      }

      const city = eventJson?.city?.trim();
      const coords =
        eventJson?.est_lat && eventJson?.est_lon
          ? `${Number(eventJson.est_lat).toFixed(4)}, ${Number(eventJson.est_lon).toFixed(4)}`
          : undefined;

      events.push({
        id: `${bucket.category}-${bucket.folderName}-${startDate.getTime()}`,
        category: bucket.category,
        folderName: bucket.folderName,
        startDate,
        totalDuration,
        segments,
        availableCameras: collectAvailableCameras(segments),
        eventJson,
        eventOffsetSeconds,
        triggerCamera: mapEventJsonCamera(eventJson?.camera),
        thumbFile: bucket.thumbFile,
        thumbUrl: bucket.thumbFile ? URL.createObjectURL(bucket.thumbFile) : undefined,
        locationLabel: city || coords || (bucket.category === 'sentry' ? '哨兵驻车地点' : '本地 USB 剪辑'),
        reasonLabel: translateTeslaReason(eventJson?.reason, bucket.category),
      });
    }

    // Fallback for arbitrary non-Tesla-named local video files
    if (bucket.looseVideos.length > 0) {
      for (const file of bucket.looseVideos) {
        const startDate = new Date(file.lastModified || Date.now());
        const seg: VideoSegment = {
          id: `loose-${file.name}`,
          timestampKey: file.name,
          startDate,
          duration: 60,
          cameras: { front: file },
        };
        events.push({
          id: `loose-${file.name}-${file.lastModified}`,
          category: bucket.category,
          folderName: file.name.replace(/\.[^.]+$/, ''),
          startDate,
          totalDuration: 60,
          segments: [seg],
          availableCameras: ['front'],
          locationLabel: '本地导入视频',
          reasonLabel: file.name,
        });
      }
    }
  }

  // Sort newest first (just like Tesla Dashcam Viewer)
  events.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  return events;
}

export async function collectFromFileList(fileList: FileList): Promise<RawFileItem[]> {
  const result: RawFileItem[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    result.push({ file, relativePath: rel });
  }
  return result;
}

export async function collectFromDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  prefix = ''
): Promise<RawFileItem[]> {
  const result: RawFileItem[] = [];
  const basePath = prefix ? `${prefix}/${dirHandle.name}` : dirHandle.name;

  // @ts-expect-error values() async iterator is supported in Chromium File System Access API
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const file = await (entry as FileSystemFileHandle).getFile();
      result.push({ file, relativePath: `${basePath}/${entry.name}` });
    } else if (entry.kind === 'directory') {
      const nested = await collectFromDirectoryHandle(
        entry as FileSystemDirectoryHandle,
        basePath
      );
      result.push(...nested);
    }
  }
  return result;
}

export async function collectFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<RawFileItem[]> {
  const result: RawFileItem[] = [];

  async function traverseEntry(entry: FileSystemEntry, pathPrefix: string): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      await new Promise<void>((resolve) => {
        fileEntry.file(
          (file) => {
            result.push({ file, relativePath: `${pathPrefix}${file.name}` });
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const readAll = async (): Promise<FileSystemEntry[]> => {
        const entries: FileSystemEntry[] = [];
        while (true) {
          const batch = await new Promise<FileSystemEntry[]>((resolve) => {
            reader.readEntries(
              (b) => resolve(b),
              () => resolve([])
            );
          });
          if (batch.length === 0) break;
          entries.push(...batch);
        }
        return entries;
      };
      const children = await readAll();
      for (const child of children) {
        await traverseEntry(child, `${pathPrefix}${entry.name}/`);
      }
    }
  }

  const items = Array.from(dataTransfer.items || []);
  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => Boolean(e));

  if (entries.length > 0) {
    for (const entry of entries) {
      await traverseEntry(entry, '');
    }
    return result;
  }

  return collectFromFileList(dataTransfer.files);
}

export function formatDuration(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatTeslaDateTime(date: Date): {
  dateLabel: string;
  timeLabel: string;
  fullStamp: string;
} {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return {
    dateLabel: `${Number(mo)}月${Number(d)}日`,
    timeLabel: `${h}:${mi}`,
    fullStamp: `${y}-${mo}-${d} ${h}:${mi}:${s}`,
  };
}
