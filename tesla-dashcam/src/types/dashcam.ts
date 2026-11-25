export type CameraAngle =
  | 'front'
  | 'back'
  | 'left_repeater'
  | 'right_repeater'
  | 'left_pillar'
  | 'right_pillar';

export const CORE_CAMERAS: CameraAngle[] = [
  'front',
  'back',
  'left_repeater',
  'right_repeater',
];

export const ALL_CAMERAS: CameraAngle[] = [
  'front',
  'back',
  'left_repeater',
  'right_repeater',
  'left_pillar',
  'right_pillar',
];

export const CAMERA_LABELS: Record<CameraAngle, { zh: string; shortZh: string; en: string }> = {
  front: { zh: '前视', shortZh: '前', en: 'FRONT' },
  back: { zh: '后视', shortZh: '后', en: 'REAR' },
  left_repeater: { zh: '左侧翼子板', shortZh: '左', en: 'LEFT' },
  right_repeater: { zh: '右侧翼子板', shortZh: '右', en: 'RIGHT' },
  left_pillar: { zh: '左B柱', shortZh: '左B', en: 'L-PILLAR' },
  right_pillar: { zh: '右B柱', shortZh: '右B', en: 'R-PILLAR' },
};

export type ClipCategory = 'sentry' | 'saved' | 'recent';

export type LayoutMode = 'single' | 'quad';

export type DemoSceneId =
  | 'sentry_garage'
  | 'highway_cutin'
  | 'night_city'
  | 'recent_park';

export interface EventJson {
  timestamp?: string;
  city?: string;
  est_lat?: string;
  est_lon?: string;
  reason?: string;
  camera?: string;
}

export interface VideoSegment {
  id: string;
  timestampKey: string;
  startDate: Date;
  /** Duration in seconds (initialized to 60s or inferred gap, updated on metadata load) */
  duration: number;
  cameras: Partial<Record<CameraAngle, File>>;
}

export interface DashcamEvent {
  id: string;
  category: ClipCategory;
  folderName: string;
  startDate: Date;
  totalDuration: number;
  segments: VideoSegment[];
  availableCameras: CameraAngle[];
  eventJson?: EventJson;
  /** Offset in seconds from event start where the red trigger dot appears */
  eventOffsetSeconds?: number;
  triggerCamera?: CameraAngle;
  thumbFile?: File;
  thumbUrl?: string;
  locationLabel: string;
  reasonLabel: string;
  isDemo?: boolean;
  demoScene?: DemoSceneId;
}

export interface VideoEnhanceSettings {
  brightness: number; // 100 = normal
  contrast: number; // 100 = normal
  saturate: number; // 100 = normal
  sharpness: boolean;
}

export interface CarOsState {
  theme: 'dark' | 'light';
  gear: 'P' | 'R' | 'N' | 'D';
  batteryPercent: number;
  rangeKm: number;
  showPercent: boolean;
  locked: boolean;
  sentryEnabled: boolean;
  driverTemp: number;
  passengerTemp: number;
  driverSeatHeat: 0 | 1 | 2 | 3;
  passengerSeatHeat: 0 | 1 | 2 | 3;
  volume: number;
  displayBrightness: number; // 40..100
  bezelMode: boolean;
}
