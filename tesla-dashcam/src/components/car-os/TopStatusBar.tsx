import React, { useEffect, useState } from 'react';
import { Bluetooth, Gamepad2, HardDrive, Lock, Unlock, User, Wifi, Signal } from 'lucide-react';
import { CarOsState } from '../../types/dashcam';
import {
  TeslaBatteryIcon,
  TeslaDashcamIcon,
  TeslaSentryIcon,
} from '../icons/TeslaIcons';

interface TopStatusBarProps {
  carState: CarOsState;
  usbLoaded: boolean;
  usbClipCount: number;
  gamepadConnected?: boolean;
  onToggleBatteryUnit: () => void;
  onToggleLock: () => void;
  onToggleSentry: () => void;
  onOpenDashcam: () => void;
  onOpenImport: () => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  carState,
  usbLoaded,
  usbClipCount,
  gamepadConnected = false,
  onToggleBatteryUnit,
  onToggleLock,
  onToggleSentry,
  onOpenDashcam,
  onOpenImport,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  const gears: Array<CarOsState['gear']> = ['P', 'R', 'N', 'D'];

  return (
    <header
      className="h-11 px-4 flex items-center justify-between shrink-0 z-30 border-b transition-colors"
      style={{
        backgroundColor: 'var(--tesla-bg)',
        borderColor: 'var(--tesla-border)',
      }}
    >
      {/* Left: Gear Bar (P R N D) + Battery */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-wider">
          {gears.map((g) => (
            <span
              key={g}
              className="transition-colors"
              style={{
                color:
                  carState.gear === g ? 'var(--tesla-text)' : 'var(--tesla-text-muted)',
                opacity: carState.gear === g ? 1 : 0.45,
              }}
            >
              {g}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onToggleBatteryUnit}
          title="点击切换电量百分比 / 续航里程"
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
        >
          <span className="text-[13px] font-medium tabular-nums">
            {carState.showPercent
              ? `${carState.batteryPercent}%`
              : `${carState.rangeKm} km`}
          </span>
          <TeslaBatteryIcon percent={carState.batteryPercent} className="w-7 h-3.5" />
        </button>

        {/* USB / Demo Status pill */}
        <button
          type="button"
          onClick={onOpenImport}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer"
          style={{
            backgroundColor: usbLoaded
              ? 'rgba(34, 197, 94, 0.14)'
              : 'var(--tesla-surface-elevated)',
            color: usbLoaded ? '#22c55e' : 'var(--tesla-text-secondary)',
          }}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>
            {usbLoaded ? `TeslaCam USB · ${usbClipCount} 条事件` : '演示模式 · 点击载入本地 U 盘'}
          </span>
        </button>
      </div>

      {/* Center / Right: Tesla Status Icons */}
      <div className="flex items-center gap-3.5 text-[13px]">
        <button
          type="button"
          onClick={onToggleLock}
          title={carState.locked ? '车辆已锁定' : '车辆已解锁'}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          {carState.locked ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Unlock className="w-4 h-4 text-amber-400" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenDashcam}
          title="行车记录仪录制中"
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <TeslaDashcamIcon className="w-5 h-5" recording />
        </button>

        <button
          type="button"
          onClick={onToggleSentry}
          title={carState.sentryEnabled ? '哨兵模式已开启' : '哨兵模式已关闭'}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <TeslaSentryIcon
            className={`w-5 h-5 ${carState.sentryEnabled ? 'animate-sentry' : ''}`}
            active={carState.sentryEnabled}
          />
        </button>

        <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px]" style={{ color: 'var(--tesla-text-secondary)' }}>
          <User className="w-3.5 h-3.5" />
          <span>Model Y</span>
        </div>

        {gamepadConnected && (
          <span
            title="游戏手柄已连接"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-medium"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>手柄</span>
          </span>
        )}

        <span className="font-medium tabular-nums text-[13px]">{timeStr}</span>
        <span
          className="hidden sm:inline tabular-nums text-[13px]"
          style={{ color: 'var(--tesla-text-secondary)' }}
        >
          18°C
        </span>

        <div
          className="hidden sm:flex items-center gap-2 ml-1"
          style={{ color: 'var(--tesla-text-secondary)' }}
        >
          <span className="text-[10px] font-semibold tracking-tight opacity-80">5G</span>
          <Signal className="w-3.5 h-3.5" />
          <Wifi className="w-3.5 h-3.5" />
          <Bluetooth className="w-3.5 h-3.5 opacity-80" />
        </div>
      </div>
    </header>
  );
};
