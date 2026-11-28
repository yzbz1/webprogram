export type ViewMode = 'world' | 'map' | 'calm';

export type AtmospherePreset = 'night_rain' | 'sunset' | 'daylight';

export type CameraPreset = 'v15_chase' | 'cinematic_low' | 'top_down' | 'hood';

export type FsdProfile = 'Standard' | 'Hurry' | 'Mad Max';

export type TurnDirection = 'straight' | 'left' | 'right' | 'arrive';

export interface PaintColor {
  id: string;
  name: string;
  hex: number;
  cssHex: string;
  metalness: number;
  roughness: number;
}

export const TESLA_PAINTS: PaintColor[] = [
  {
    id: 'stealth_grey',
    name: '星空灰',
    hex: 0x3b424c,
    cssHex: '#4b5563',
    metalness: 0.72,
    roughness: 0.2,
  },
  {
    id: 'pearl_white',
    name: '珍珠白',
    hex: 0xebeef2,
    cssHex: '#f1f5f9',
    metalness: 0.35,
    roughness: 0.16,
  },
  {
    id: 'ultra_red',
    name: '烈焰红',
    hex: 0xb91c2e,
    cssHex: '#dc2626',
    metalness: 0.78,
    roughness: 0.18,
  },
  {
    id: 'deep_blue',
    name: '深海蓝',
    hex: 0x1d438a,
    cssHex: '#2563eb',
    metalness: 0.76,
    roughness: 0.2,
  },
  {
    id: 'solid_black',
    name: '纯黑',
    hex: 0x14171c,
    cssHex: '#18181b',
    metalness: 0.58,
    roughness: 0.16,
  },
];

export const ATMOSPHERE_LABELS: Record<AtmospherePreset, string> = {
  night_rain: '夜雨霓虹',
  sunset: '落日余晖',
  daylight: '晴朗白昼',
};

export const CAMERA_PRESET_LABELS: Record<CameraPreset, string> = {
  v15_chase: 'V15 实景视角',
  cinematic_low: '电影低角',
  top_down: '上帝俯视',
  hood: '前舱第一人称',
};

export interface DriveTelemetry {
  speedKmh: number;
  gear: 'P' | 'R' | 'N' | 'D';
  /** -1 (full regen) to +1 (full acceleration) */
  powerNormalized: number;
  steerAngle: number;
  fsdActive: boolean;
  fsdProfile: FsdProfile;
  turnSignal: 'off' | 'left' | 'right';
  braking: boolean;
  speedLimitKmh: number;
  nextTurnDir: TurnDirection;
  nextTurnDistM: number;
  streetName: string;
  etaMinutes: number;
  remainingKm: number;
  streakKm: number;
  destinationName: string;
  hasCustomWaypoint: boolean;
  egoX: number;
  egoZ: number;
  egoHeading: number;
}

export type GamepadAction =
  | 'toggle_fsd'
  | 'toggle_park'
  | 'toggle_dashcam'
  | 'cycle_camera'
  | 'signal_left'
  | 'signal_right'
  | 'cycle_atmosphere'
  | 'cycle_paint'
  | 'toggle_settings';

export interface InputSnapshot {
  connected: boolean;
  gamepadName: string;
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1 (negative = left, positive = right)
  lookX: number; // -1..1
  lookY: number; // -1..1
  handbrake: boolean;
  actions: GamepadAction[];
}
