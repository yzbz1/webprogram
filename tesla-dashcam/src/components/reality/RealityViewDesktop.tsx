import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  CornerUpLeft,
  CornerUpRight,
  Gamepad2,
  Globe2,
  HardDrive,
  Map as MapIcon,
  MapPin,
  Moon,
  Pause,
  Play,
  ShieldAlert,
  SkipBack,
  SkipForward,
  Sparkles,
  Sun,
  Sunset,
  X,
} from 'lucide-react';
import { CarOsState, DashcamEvent } from '../../types/dashcam';
import {
  ATMOSPHERE_LABELS,
  AtmospherePreset,
  CAMERA_PRESET_LABELS,
  CameraPreset,
  DriveTelemetry,
  FsdProfile,
  GamepadAction,
  TESLA_PAINTS,
  ViewMode,
} from '../../types/realityView';
import { TeslaDashcamIcon } from '../icons/TeslaIcons';
import { RealityWorldEngine } from './RealityWorldEngine';

interface RealityViewDesktopProps {
  carState: CarOsState;
  activeEvent: DashcamEvent | null;
  sentryCount: number;
  paused: boolean;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onTelemetryChange: (telemetry: DriveTelemetry) => void;
  onGamepadChange: (connected: boolean, name: string) => void;
  onOpenDashcam: () => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onShowToast: (msg: string) => void;
}

const FSD_PROFILES: FsdProfile[] = ['Standard', 'Hurry', 'Mad Max'];
const ATMOSPHERES: AtmospherePreset[] = ['night_rain', 'sunset', 'daylight'];
const CAMERAS: CameraPreset[] = ['v15_chase', 'cinematic_low', 'top_down', 'hood'];

const TRACKS = [
  { title: 'Midnight City', artist: 'M83 · Synthwave Radio', duration: 243 },
  { title: 'Blinding Lights', artist: 'The Weeknd · After Hours', duration: 200 },
  { title: 'Nightcall', artist: 'Kavinsky · Drive OST', duration: 258 },
];

export const RealityViewDesktop: React.FC<RealityViewDesktopProps> = ({
  carState,
  activeEvent,
  sentryCount,
  paused,
  viewMode,
  onChangeViewMode,
  onTelemetryChange,
  onGamepadChange,
  onOpenDashcam,
  onOpenImport,
  onOpenSettings,
  onShowToast,
}) => {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RealityWorldEngine | null>(null);

  const [atmosphere, setAtmosphere] = useState<AtmospherePreset>('night_rain');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('v15_chase');
  const [paintIdx, setPaintIdx] = useState(0);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState('');
  const [showControlsHelp, setShowControlsHelp] = useState(false);

  // Media widget state
  const [trackIdx, setTrackIdx] = useState(0);
  const [mediaPlaying, setMediaPlaying] = useState(true);
  const [mediaSec, setMediaSec] = useState(64);

  const [telemetry, setTelemetry] = useState<DriveTelemetry>({
    speedKmh: 40,
    gear: 'D',
    powerNormalized: 0.2,
    steerAngle: 0,
    fsdActive: true,
    fsdProfile: 'Standard',
    turnSignal: 'off',
    braking: false,
    speedLimitKmh: 50,
    nextTurnDir: 'right',
    nextTurnDistM: 88,
    streetName: '世纪大道',
    etaMinutes: 6,
    remainingKm: 2.1,
    streakKm: 1.8,
    destinationName: '陆家嘴国金中心',
    hasCustomWaypoint: false,
    egoX: -3.5,
    egoZ: -88,
    egoHeading: 0,
  });

  // Stable refs for callbacks used inside engine loop
  const handlersRef = useRef({
    onTelemetryChange,
    onGamepadChange,
    onOpenDashcam,
    onOpenSettings,
    onShowToast,
  });
  handlersRef.current = {
    onTelemetryChange,
    onGamepadChange,
    onOpenDashcam,
    onOpenSettings,
    onShowToast,
  };

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const engine = new RealityWorldEngine(host, {
      onTelemetry: (t) => {
        setTelemetry(t);
        handlersRef.current.onTelemetryChange(t);
      },
      onGamepadChange: (conn, name) => {
        setGamepadConnected(conn);
        setGamepadName(name);
        handlersRef.current.onGamepadChange(conn, name);
      },
      onToast: (msg) => handlersRef.current.onShowToast(msg),
      onAction: (action: GamepadAction) => {
        if (action === 'toggle_dashcam') {
          handlersRef.current.onOpenDashcam();
        } else if (action === 'toggle_settings') {
          handlersRef.current.onOpenSettings();
        } else if (action === 'cycle_camera') {
          setCameraPreset((prev) => {
            const next = CAMERAS[(CAMERAS.indexOf(prev) + 1) % CAMERAS.length];
            engine.setCameraPreset(next);
            handlersRef.current.onShowToast(`视角：${CAMERA_PRESET_LABELS[next]}`);
            return next;
          });
        } else if (action === 'cycle_atmosphere') {
          setAtmosphere((prev) => {
            const next = ATMOSPHERES[(ATMOSPHERES.indexOf(prev) + 1) % ATMOSPHERES.length];
            engine.applyAtmosphere(next);
            handlersRef.current.onShowToast(`环境：${ATMOSPHERE_LABELS[next]}`);
            return next;
          });
        } else if (action === 'cycle_paint') {
          setPaintIdx((prev) => {
            const next = (prev + 1) % TESLA_PAINTS.length;
            engine.setPaint(TESLA_PAINTS[next]);
            handlersRef.current.onShowToast(`车漆：${TESLA_PAINTS[next].name}`);
            return next;
          });
        }
      },
    });

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Pause 3D render & keyboard driving when Dashcam modal is open or Map mode hides 3D
  useEffect(() => {
    engineRef.current?.setPaused(paused || viewMode === 'map');
  }, [paused, viewMode]);

  // Subtle media progress tick
  useEffect(() => {
    if (!mediaPlaying) return;
    const id = window.setInterval(() => {
      setMediaSec((s) => (s + 1) % TRACKS[trackIdx].duration);
    }, 1000);
    return () => clearInterval(id);
  }, [mediaPlaying, trackIdx]);

  const handleAtmosphereSelect = (preset: AtmospherePreset) => {
    setAtmosphere(preset);
    engineRef.current?.applyAtmosphere(preset);
    onShowToast(`环境已切换：${ATMOSPHERE_LABELS[preset]}`);
  };

  const handleCameraSelect = (preset: CameraPreset) => {
    setCameraPreset(preset);
    engineRef.current?.setCameraPreset(preset);
    onShowToast(`视角：${CAMERA_PRESET_LABELS[preset]}`);
  };

  const handlePaintSelect = (idx: number) => {
    setPaintIdx(idx);
    engineRef.current?.setPaint(TESLA_PAINTS[idx]);
  };

  const handleToggleFsd = () => {
    const next = !telemetry.fsdActive;
    engineRef.current?.setFsdActive(next);
    onShowToast(next ? 'FSD V15 自动驾驶已接管' : '已切换为手动驾驶（WASD / 手柄）');
  };

  const handleCycleFsdProfile = () => {
    const next = FSD_PROFILES[(FSD_PROFILES.indexOf(telemetry.fsdProfile) + 1) % FSD_PROFILES.length];
    engineRef.current?.setFsdProfile(next);
    onShowToast(`FSD 驾驶风格：${next}`);
  };

  const track = TRACKS[trackIdx];
  const powerPct = Math.min(100, Math.abs(telemetry.powerNormalized) * 100);
  const isRegen = telemetry.powerNormalized < -0.04;

  const renderTurnIcon = () => {
    if (telemetry.nextTurnDir === 'left') return <CornerUpLeft className="w-7 h-7 text-white" />;
    if (telemetry.nextTurnDir === 'right') return <CornerUpRight className="w-7 h-7 text-white" />;
    if (telemetry.nextTurnDir === 'arrive') return <MapPin className="w-7 h-7 text-[#38bdf8]" />;
    return <ArrowUp className="w-7 h-7 text-white" />;
  };

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden bg-[#060811] select-none">
      {/* === 1. FULL-BLEED 3D TESLA FSD V15 REALITY VIEW CANVAS === */}
      <div
        ref={canvasHostRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
          viewMode === 'world' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* === 2. FULL-SCREEN NAVIGATION MAP MODE (V15 Map View) === */}
      {viewMode === 'map' && (
        <div className="absolute inset-0 bg-[#131823] overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice">
            <rect width="1000" height="700" fill="#121722" />
            <path
              d="M 680 -20 C 640 200, 790 340, 720 550 C 690 640, 740 700, 780 740 L 1040 740 L 1040 -20 Z"
              fill="#0d1729"
            />
            {[-176, -88, 0, 88, 176].map((r) => {
              const p = 500 + r * 1.4;
              const pz = 350 + r * 1.4;
              return (
                <g key={r}>
                  <line x1={p} y1="0" x2={p} y2="700" stroke="#262e40" strokeWidth="10" />
                  <line x1="0" y1={pz} x2="1000" y2={pz} stroke="#262e40" strokeWidth="10" />
                </g>
              );
            })}
            {/* Live Ego Car Pin */}
            <g
              transform={`translate(${500 + telemetry.egoX * 1.4}, ${350 + telemetry.egoZ * 1.4}) rotate(${
                (-telemetry.egoHeading * 180) / Math.PI
              })`}
            >
              <circle r="22" fill="rgba(46, 123, 255, 0.25)" />
              <polygon points="0,-13 10,10 0,5 -10,10" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
            </g>
          </svg>
        </div>
      )}

      {/* === 3. TESLA V15 CALM MODE BACKDROP === */}
      {viewMode === 'calm' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 50% 42%, #131926 0%, #06070c 78%)',
          }}
        >
          <div className="text-[112px] font-extralight tracking-tight leading-none tabular-nums text-white/95">
            {telemetry.speedKmh}
          </div>
          <div className="text-sm uppercase tracking-[0.25em] text-white/45 mt-2">
            km/h · 宁静模式 (Calm Mode)
          </div>
        </div>
      )}

      {/* Subtle top & bottom edge legibility gradients over 3D world */}
      {viewMode === 'world' && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/65 via-black/25 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        </>
      )}

      {/* === 4. UPPER-LEFT TESLA FSD V15 DRIVING TELEMETRY + INLINE TURN-BY-TURN === */}
      <div className="pointer-events-none absolute top-4 left-4 sm:left-6 flex items-start gap-6 z-20">
        {/* Speed + Power Bar + FSD Pill + Speed Limit */}
        <div className="pointer-events-auto flex flex-col items-start">
          {/* Speed Readout */}
          <div className="flex items-baseline gap-2 drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
            <span className="text-[54px] sm:text-[62px] font-extralight leading-none tracking-tight text-white tabular-nums">
              {telemetry.speedKmh}
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-wider text-white/70">KM/H</span>
              <span
                className={`text-xs font-bold ${
                  telemetry.gear === 'R'
                    ? 'text-amber-400'
                    : telemetry.gear === 'P'
                      ? 'text-rose-400'
                      : 'text-white/85'
                }`}
              >
                {telemetry.gear}
              </span>
            </div>
          </div>

          {/* Tesla Power / Regen Horizontal Bar */}
          <div className="w-36 h-[3px] bg-white/15 rounded-full overflow-hidden mt-1.5 mb-3 flex">
            <div className="w-1/2 flex justify-end">
              {isRegen && (
                <div
                  className="h-full bg-emerald-400 transition-all duration-100"
                  style={{ width: `${powerPct}%` }}
                />
              )}
            </div>
            <div className="w-1/2 flex justify-start">
              {!isRegen && (
                <div
                  className="h-full bg-white transition-all duration-100"
                  style={{ width: `${powerPct}%` }}
                />
              )}
            </div>
          </div>

          {/* FSD V15 Engagement Pill */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleFsd}
              title="点击开启/退出 FSD V15 自动驾驶 (F / 手柄 A)"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
                telemetry.fsdActive
                  ? 'bg-[#1d4ed8]/35 border-[#3b82f6]/65 text-white'
                  : 'bg-black/55 border-white/15 text-white/80 hover:bg-black/75'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  telemetry.fsdActive ? 'bg-[#2e7bff] text-white' : 'bg-white/15 text-white/75'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
                  <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.1" />
                  <path d="M5 10.5H19M12 10.5V20" stroke="currentColor" strokeWidth="2.1" />
                </svg>
              </span>
              <span>{telemetry.fsdActive ? 'Self-Driving' : 'Start Self-Driving'}</span>
            </button>

            {telemetry.fsdActive && (
              <button
                type="button"
                onClick={handleCycleFsdProfile}
                title="切换 FSD 驾驶风格"
                className="px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-black/50 border border-white/15 text-[#93c5fd] hover:bg-black/70 backdrop-blur-md cursor-pointer"
              >
                {telemetry.fsdProfile}
              </button>
            )}
          </div>

          {telemetry.fsdActive && (
            <div className="mt-1 text-[11px] text-white/70 pl-1 drop-shadow">
              Street · {telemetry.streakKm.toFixed(1)} km Streak
            </div>
          )}

          {/* Classic White Speed Limit Sign + Blinking Turn Signals */}
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="w-11 rounded-md bg-white text-black px-1 py-1 text-center shadow-lg border border-black/15">
              <div className="text-[7px] font-extrabold leading-tight tracking-tighter">SPEED</div>
              <div className="text-[7px] font-extrabold leading-tight tracking-tighter">LIMIT</div>
              <div className="text-[16px] font-extrabold leading-none mt-0.5 tabular-nums">
                {telemetry.speedLimitKmh}
              </div>
            </div>

            {telemetry.turnSignal !== 'off' && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/60 text-emerald-400 animate-pulse">
                {telemetry.turnSignal === 'left' ? (
                  <ArrowLeft className="w-4 h-4 stroke-[3]" />
                ) : (
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inline Turn-by-Turn Navigation Prompt (Right of Speedometer, matching V15!) */}
        {viewMode !== 'calm' && (
          <div className="hidden sm:flex items-start gap-3 pt-1.5 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            <div className="w-10 h-10 rounded-xl bg-black/35 backdrop-blur-md border border-white/10 flex items-center justify-center">
              {renderTurnIcon()}
            </div>
            <div>
              <div className="text-xl font-semibold text-white leading-tight tabular-nums">
                {telemetry.nextTurnDistM} m
              </div>
              <div className="text-xs font-medium text-white/80 mt-0.5">{telemetry.streetName}</div>
            </div>
          </div>
        )}
      </div>

      {/* === 5. TOP-RIGHT REALITY CONTROLS (Atmosphere, Camera Angle, Paint, Gamepad Status) === */}
      <div className="absolute top-4 right-4 sm:right-6 z-20 flex flex-wrap items-center justify-end gap-2">
        {/* Gamepad / Controls Pill */}
        <button
          type="button"
          onClick={() => setShowControlsHelp((s) => !s)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
            gamepadConnected
              ? 'bg-emerald-500/25 border-emerald-400/55 text-emerald-300'
              : 'bg-black/55 border-white/15 text-white/85 hover:bg-black/75'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>{gamepadConnected ? `手柄已连接` : '手柄 / WASD 驾驶'}</span>
        </button>

        {/* Atmosphere Switcher */}
        <div className="hidden md:flex items-center p-1 rounded-full bg-black/55 backdrop-blur-md border border-white/15 shadow-lg">
          {ATMOSPHERES.map((preset) => {
            const active = atmosphere === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleAtmosphereSelect(preset)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                  active ? 'bg-white text-black font-semibold' : 'text-white/75 hover:text-white'
                }`}
              >
                {preset === 'night_rain' && <Moon className="w-3 h-3" />}
                {preset === 'sunset' && <Sunset className="w-3 h-3" />}
                {preset === 'daylight' && <Sun className="w-3 h-3" />}
                <span>{ATMOSPHERE_LABELS[preset]}</span>
              </button>
            );
          })}
        </div>

        {/* Camera Angle Switcher */}
        <button
          type="button"
          onClick={() => {
            const next = CAMERAS[(CAMERAS.indexOf(cameraPreset) + 1) % CAMERAS.length];
            handleCameraSelect(next);
          }}
          title="切换 3D 渲染视角 (V / 手柄 Y)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-white cursor-pointer shadow-lg"
        >
          <Camera className="w-3.5 h-3.5 text-sky-400" />
          <span>{CAMERA_PRESET_LABELS[cameraPreset]}</span>
        </button>

        {/* Quick Car Paint Swatches */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 shadow-lg">
          {TESLA_PAINTS.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePaintSelect(idx)}
              title={`车漆：${p.name}`}
              className={`w-3.5 h-3.5 rounded-full cursor-pointer transition-transform ${
                paintIdx === idx ? 'ring-2 ring-white scale-125' : 'opacity-75 hover:opacity-100'
              }`}
              style={{ backgroundColor: p.cssHex }}
            />
          ))}
        </div>
      </div>

      {/* Gamepad & Keyboard Legend Popover */}
      {showControlsHelp && (
        <div className="absolute top-14 right-4 sm:right-6 w-80 rounded-2xl bg-[#111520]/95 backdrop-blur-xl border border-white/15 p-4 shadow-2xl z-30 text-xs">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Gamepad2 className="w-4 h-4 text-emerald-400" />
              游戏级手柄 &amp; 键鼠驾驶说明
            </span>
            <button
              type="button"
              onClick={() => setShowControlsHelp(false)}
              className="p-1 rounded-full hover:bg-white/10 text-white/60 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {gamepadConnected && (
            <div className="mb-2.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] truncate">
              当前设备：{gamepadName}
            </div>
          )}
          <div className="space-y-1.5 text-white/80">
            <div className="flex justify-between">
              <span className="text-white/55">油门 / 刹车倒车</span>
              <span className="font-mono">RT / LT 或 W / S</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">模拟转向</span>
              <span className="font-mono">左摇杆 或 A / D</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">360° 视角环视 / 缩放</span>
              <span className="font-mono">右摇杆 / 鼠标拖拽+滚轮</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">切换 FSD V15 自动驾驶</span>
              <span className="font-mono">手柄 A / 键盘 F</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">手刹 / 驻车挡</span>
              <span className="font-mono">手柄 B / Space / P</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">打开行车记录仪查看器</span>
              <span className="font-mono">手柄 X</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">切换视角 / 昼夜环境</span>
              <span className="font-mono">手柄 Y / 十字键 或 V / T</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">Tap-to-Navigate 导航</span>
              <span className="font-mono">直接点击 3D 路面</span>
            </div>
          </div>
        </div>
      )}

      {/* === 6. LOWER FLOATING V15 CARDS ROW (View Toggle + Media Card + Trip/Dashcam Card) === */}
      <div className="pointer-events-none absolute inset-x-4 sm:inset-x-6 bottom-4 z-20 flex flex-wrap lg:flex-nowrap items-end justify-between gap-3">
        {/* Bottom-Left: Map/World Toggle + Calm Mode */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeViewMode(viewMode === 'map' ? 'world' : 'map')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black/65 hover:bg-black/80 backdrop-blur-xl border border-white/15 text-xs font-semibold text-white cursor-pointer shadow-xl"
          >
            {viewMode === 'map' ? (
              <>
                <Globe2 className="w-4 h-4 text-sky-400" />
                <span>World</span>
              </>
            ) : (
              <>
                <MapIcon className="w-4 h-4 text-sky-400" />
                <span>Map</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onChangeViewMode(viewMode === 'calm' ? 'world' : 'calm')}
            title="切换 V15 宁静极简模式 (Calm Mode)"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-xl border text-xs font-semibold cursor-pointer shadow-xl transition-colors ${
              viewMode === 'calm'
                ? 'bg-blue-600/80 border-blue-400/60 text-white'
                : 'bg-black/65 hover:bg-black/80 border-white/15 text-white/85'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span className="hidden sm:inline">宁静</span>
          </button>
        </div>

        {/* Bottom-Center: Frosted Glass Tesla V15 Media Card */}
        {viewMode !== 'calm' && (
          <div className="pointer-events-auto hidden md:flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl bg-black/62 backdrop-blur-xl border border-white/12 shadow-2xl min-w-[310px] max-w-[390px] flex-1">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-rose-500 flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{track.title}</div>
              <div className="text-[11px] text-white/55 truncate">{track.artist}</div>
              <div className="mt-1.5 h-1 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-white/85 rounded-full transition-all"
                  style={{ width: `${(mediaSec / track.duration) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTrackIdx((i) => (i - 1 + TRACKS.length) % TRACKS.length);
                  setMediaSec(0);
                }}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 cursor-pointer"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMediaPlaying((p) => !p)}
                className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer"
              >
                {mediaPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrackIdx((i) => (i + 1) % TRACKS.length);
                  setMediaSec(0);
                }}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom-Right: Frosted Glass V15 Trip Summary + Dashcam Quick Launch Card */}
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-black/68 backdrop-blur-xl border border-white/14 shadow-2xl">
          <div className="hidden sm:block min-w-[140px] pr-3 border-r border-white/10">
            <div className="flex items-center justify-between text-xs font-semibold text-white">
              <span>{telemetry.etaMinutes} 分钟后到达</span>
              <span className="text-white/60 tabular-nums">{telemetry.remainingKm} km</span>
            </div>
            <div className="text-[11px] text-white/65 truncate mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-sky-400 shrink-0" />
              <span>{telemetry.destinationName}</span>
            </div>
            {telemetry.hasCustomWaypoint && (
              <button
                type="button"
                onClick={() => engineRef.current?.clearWaypoint()}
                className="mt-1 text-[10px] text-rose-400 hover:underline cursor-pointer"
              >
                End Trip · 清除导航点
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDashcam}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#2563eb] hover:bg-[#3b82f6] text-white text-xs font-semibold cursor-pointer transition-colors shadow-lg"
            >
              <TeslaDashcamIcon className="w-4 h-4" recording />
              <span>行车记录仪</span>
              {sentryCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-[10px] font-bold flex items-center gap-0.5">
                  <ShieldAlert className="w-2.5 h-2.5" />
                  {sentryCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenImport}
              title={activeEvent ? `当前事件：${activeEvent.locationLabel}` : '导入 TeslaCam U 盘'}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
            >
              <HardDrive className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
