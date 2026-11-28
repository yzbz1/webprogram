import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Map,
  MoreHorizontal,
  Music2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CarOsState } from '../../types/dashcam';
import {
  TeslaCarDockIcon,
  TeslaDashcamIcon,
  TeslaSeatHeaterIcon,
  TeslaSentryIcon,
} from '../icons/TeslaIcons';

interface BottomDockProps {
  carState: CarOsState;
  dashcamOpen: boolean;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onToggleDashcam: () => void;
  onShowMap: () => void;
  onOpenImport: () => void;
  onToggleSentry: () => void;
  onAdjustTemp: (side: 'driver' | 'passenger', delta: number) => void;
  onCycleSeatHeat: (side: 'driver' | 'passenger') => void;
  onAdjustVolume: (delta: number) => void;
  onShowToast: (msg: string) => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  carState,
  dashcamOpen,
  settingsOpen,
  onToggleSettings,
  onToggleDashcam,
  onShowMap,
  onOpenImport,
  onToggleSentry,
  onAdjustTemp,
  onCycleSeatHeat,
  onAdjustVolume,
  onShowToast,
}) => {
  return (
    <footer
      className="h-[68px] px-4 md:px-6 flex items-center justify-between shrink-0 z-40 border-t transition-colors"
      style={{
        backgroundColor: 'var(--tesla-dock)',
        borderColor: 'var(--tesla-border)',
      }}
    >
      {/* Far Left: Tesla Car Controls Button */}
      <div className="flex items-center gap-3 md:gap-6">
        <button
          type="button"
          onClick={onToggleSettings}
          title="车辆与显示设置"
          className={`relative p-2.5 rounded-xl transition-all cursor-pointer ${
            settingsOpen
              ? 'bg-blue-500/20 text-blue-400'
              : 'hover:bg-white/10 opacity-90 hover:opacity-100'
          }`}
        >
          <TeslaCarDockIcon className="w-8 h-6" />
          {settingsOpen && (
            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-blue-500" />
          )}
        </button>

        {/* Driver HVAC Temp + Seat Heater */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCycleSeatHeat('driver')}
            title={`主驾座椅加热：${carState.driverSeatHeat === 0 ? '关闭' : `${carState.driverSeatHeat} 档`}`}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <TeslaSeatHeaterIcon level={carState.driverSeatHeat} className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onAdjustTemp('driver', -0.5)}
              className="p-1.5 rounded-lg hover:bg-white/10 opacity-65 hover:opacity-100 cursor-pointer"
              aria-label="降低主驾温度"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="w-12 text-center text-[17px] font-medium tabular-nums">
              {carState.driverTemp.toFixed(1)}°
            </span>
            <button
              type="button"
              onClick={() => onAdjustTemp('driver', 0.5)}
              className="p-1.5 rounded-lg hover:bg-white/10 opacity-65 hover:opacity-100 cursor-pointer"
              aria-label="升高主驾温度"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Center App Launcher Dock (Authentic Tesla V12 Dock Icons) */}
      <nav className="flex items-center gap-2 sm:gap-4 md:gap-5">
        {/* Dashcam Viewer (Primary App) */}
        <DockAppButton
          active={dashcamOpen}
          label="行车记录仪"
          onClick={onToggleDashcam}
          iconBg="linear-gradient(145deg, #27272a, #18181b)"
        >
          <TeslaDashcamIcon className="w-6 h-6 text-white" recording />
        </DockAppButton>

        {/* V15 Reality View / Map Desktop */}
        <DockAppButton
          active={!dashcamOpen}
          label="V15 实景主屏"
          onClick={onShowMap}
          iconBg="linear-gradient(145deg, #2563eb, #1d4ed8)"
        >
          <Map className="w-5 h-5 text-white" />
        </DockAppButton>

        {/* Import TeslaCam USB */}
        <DockAppButton
          active={false}
          label="导入 U 盘"
          onClick={onOpenImport}
          iconBg="linear-gradient(145deg, #059669, #047857)"
        >
          <FolderOpen className="w-5 h-5 text-white" />
        </DockAppButton>

        {/* Sentry Toggle */}
        <DockAppButton
          active={false}
          label="哨兵模式"
          onClick={onToggleSentry}
          iconBg="linear-gradient(145deg, #3f151b, #1c0b0e)"
        >
          <TeslaSentryIcon className="w-6 h-6 text-white" active={carState.sentryEnabled} />
        </DockAppButton>

        {/* Media Placeholder */}
        <DockAppButton
          active={false}
          label="媒体"
          onClick={() => onShowToast('特斯拉行车记录仪视频无音轨，媒体已保持静音')}
          iconBg="linear-gradient(145deg, #ea580c, #c2410c)"
        >
          <Music2 className="w-5 h-5 text-white" />
        </DockAppButton>

        {/* App Drawer */}
        <button
          type="button"
          onClick={onToggleSettings}
          title="车机设置与快捷键"
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer opacity-75 hover:opacity-100"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </nav>

      {/* Far Right: Passenger HVAC + Volume Control */}
      <div className="flex items-center gap-3 md:gap-5">
        <div className="hidden lg:flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onAdjustTemp('passenger', -0.5)}
              className="p-1.5 rounded-lg hover:bg-white/10 opacity-65 hover:opacity-100 cursor-pointer"
              aria-label="降低副驾温度"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="w-12 text-center text-[17px] font-medium tabular-nums">
              {carState.passengerTemp.toFixed(1)}°
            </span>
            <button
              type="button"
              onClick={() => onAdjustTemp('passenger', 0.5)}
              className="p-1.5 rounded-lg hover:bg-white/10 opacity-65 hover:opacity-100 cursor-pointer"
              aria-label="升高副驾温度"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onCycleSeatHeat('passenger')}
            title={`副驾座椅加热：${
              carState.passengerSeatHeat === 0 ? '关闭' : `${carState.passengerSeatHeat} 档`
            }`}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <TeslaSeatHeaterIcon
              level={carState.passengerSeatHeat}
              flipped
              className="w-6 h-6"
            />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAdjustVolume(-1)}
            className="p-1.5 rounded-lg hover:bg-white/10 opacity-65 hover:opacity-100 cursor-pointer"
            aria-label="减小音量"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div
            className="flex items-center gap-1 px-1.5"
            title={`提示音音量 ${carState.volume}/10`}
          >
            {carState.volume === 0 ? (
              <VolumeX className="w-5 h-5 opacity-60" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
            <span className="hidden sm:inline text-xs tabular-nums opacity-65 w-4 text-center">
              {carState.volume}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onAdjustVolume(1)}
            className="p-1.5 rounded-lg hover:bg-white/10 opacity-65 hover:opacity-100 cursor-pointer"
            aria-label="增大音量"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};

interface DockAppButtonProps {
  active: boolean;
  label: string;
  iconBg: string;
  onClick: () => void;
  children: React.ReactNode;
}

const DockAppButton: React.FC<DockAppButtonProps> = ({
  active,
  label,
  iconBg,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    className="group relative flex flex-col items-center justify-center cursor-pointer"
  >
    <div
      className="w-10 h-10 rounded-[11px] flex items-center justify-center shadow-md transition-transform duration-150 group-hover:scale-105 group-active:scale-95 border border-white/10"
      style={{ background: iconBg }}
    >
      {children}
    </div>
    <span
      className={`absolute -bottom-2 w-1.5 h-1.5 rounded-full transition-opacity ${
        active ? 'bg-blue-500 opacity-100' : 'opacity-0'
      }`}
    />
  </button>
);
