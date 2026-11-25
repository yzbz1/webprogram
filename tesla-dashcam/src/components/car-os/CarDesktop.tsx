import React from 'react';
import { MapPin, Navigation, Search, ShieldAlert, Zap } from 'lucide-react';
import { CarOsState, DashcamEvent } from '../../types/dashcam';
import { TeslaDashcamIcon, TeslaTopDownCarSvg } from '../icons/TeslaIcons';

interface CarDesktopProps {
  carState: CarOsState;
  activeEvent: DashcamEvent | null;
  sentryCount: number;
  onOpenDashcam: () => void;
  onOpenImport: () => void;
}

/**
 * Authentic Tesla V12 Car Infotainment Desktop (visible when Dashcam is minimized
 * or peeked behind the floating Dashcam Viewer window).
 */
export const CarDesktop: React.FC<CarDesktopProps> = ({
  carState,
  activeEvent,
  sentryCount,
  onOpenDashcam,
  onOpenImport,
}) => {
  const isDark = carState.theme === 'dark';

  return (
    <div className="relative flex-1 flex w-full h-full overflow-hidden">
      {/* Left 34%: Tesla Vehicle Status / Park Visualization Panel */}
      <section
        className="w-[34%] min-w-[290px] max-w-[440px] h-full flex flex-col justify-between p-6 border-r relative overflow-hidden"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 50% 48%, #1e212a 0%, #0d0e12 72%)'
            : 'radial-gradient(ellipse at 50% 48%, #ffffff 0%, #e5e7ec 78%)',
          borderColor: 'var(--tesla-border)',
        }}
      >
        {/* Top Parked Status & Sentry Badge */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[36px] font-light leading-none tracking-tight tabular-nums">
              0 <span className="text-sm font-normal opacity-55">km/h</span>
            </div>
            <div
              className="mt-1.5 text-xs font-medium flex items-center gap-1.5"
              style={{ color: 'var(--tesla-text-secondary)' }}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              驻车挡 · 准备就绪
            </div>
          </div>

          {carState.sentryEnabled && (
            <button
              type="button"
              onClick={onOpenDashcam}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-transform active:scale-95"
              style={{
                backgroundColor: 'rgba(227, 25, 55, 0.16)',
                color: '#ff4d67',
                border: '1px solid rgba(227, 25, 55, 0.3)',
              }}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{sentryCount} 条哨兵事件</span>
            </button>
          )}
        </div>

        {/* Center Top-Down Model 3 Visualization with Frunk / Trunk / Charge Port triggers */}
        <div className="relative flex-1 flex items-center justify-center my-2">
          {/* Parking bay floor lines */}
          <div
            className="absolute inset-x-10 inset-y-8 border-x-2 rounded-sm pointer-events-none"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
          />

          <div className="relative flex flex-col items-center">
            <span
              className="text-[11px] font-medium px-2.5 py-1 rounded-full mb-1"
              style={{
                backgroundColor: 'var(--tesla-surface-elevated)',
                color: 'var(--tesla-text-secondary)',
              }}
            >
              前备箱 · 已关闭
            </span>

            <TeslaTopDownCarSvg
              className="w-40 h-64 drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)]"
              sentryActive={carState.sentryEnabled}
            />

            <div className="flex items-center gap-3 mt-1">
              <span
                className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: 'var(--tesla-surface-elevated)',
                  color: 'var(--tesla-text-secondary)',
                }}
              >
                后备箱 · 已关闭
              </span>
              <span
                className="text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
                style={{
                  backgroundColor: 'var(--tesla-surface-elevated)',
                  color: '#22c55e',
                }}
              >
                <Zap className="w-3 h-3" />
                充电口
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Quick Action Card (Opens Dashcam / Import) */}
        <div
          className="rounded-2xl p-3.5 border flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--tesla-surface)',
            borderColor: 'var(--tesla-border)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 text-red-500 shrink-0">
              <TeslaDashcamIcon className="w-6 h-6" recording />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate">行车记录仪查看器</div>
              <div
                className="text-[11px] truncate"
                style={{ color: 'var(--tesla-text-secondary)' }}
              >
                {activeEvent ? activeEvent.locationLabel : '点击查看 4 路同步视频'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenDashcam}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0 cursor-pointer transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--tesla-blue)' }}
          >
            打开
          </button>
        </div>
      </section>

      {/* Right 66%: Stylized Tesla Navigation Map Backdrop */}
      <section
        className="flex-1 relative overflow-hidden"
        style={{
          backgroundColor: isDark ? '#161a22' : '#eaeef3',
        }}
      >
        {/* Clean Vector City Map Grid */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1000 700"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Water / Huangpu River curve */}
          <path
            d="M 640 -20 C 590 190, 740 310, 680 510 C 640 610, 720 680, 760 740 L 1040 740 L 1040 -20 Z"
            fill={isDark ? '#101827' : '#cfe0f5'}
          />
          {/* Urban Park blocks */}
          <rect
            x="160"
            y="140"
            width="140"
            height="110"
            rx="16"
            fill={isDark ? '#16241f' : '#d5eadb'}
          />
          <rect
            x="450"
            y="430"
            width="120"
            height="90"
            rx="14"
            fill={isDark ? '#16241f' : '#d5eadb'}
          />

          {/* Secondary street grid */}
          <g stroke={isDark ? '#232834' : '#ffffff'} strokeWidth="4">
            <line x1="0" y1="120" x2="1000" y2="120" />
            <line x1="0" y1="260" x2="1000" y2="260" />
            <line x1="0" y1="410" x2="1000" y2="410" />
            <line x1="0" y1="560" x2="1000" y2="560" />
            <line x1="140" y1="0" x2="140" y2="700" />
            <line x1="340" y1="0" x2="340" y2="700" />
            <line x1="540" y1="0" x2="540" y2="700" />
            <line x1="810" y1="0" x2="810" y2="700" />
          </g>

          {/* Major elevated highways */}
          <path
            d="M -20 330 Q 280 310, 520 340 T 1040 290"
            fill="none"
            stroke={isDark ? '#323a4c' : '#fde68a'}
            strokeWidth="12"
          />
          <path
            d="M 410 -20 Q 430 280, 415 720"
            fill="none"
            stroke={isDark ? '#2d3545' : '#fef08a'}
            strokeWidth="10"
          />

          {/* Active route highlight */}
          <path
            d="M 418 335 L 540 335 L 540 260"
            fill="none"
            stroke="#3e6ae1"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Vehicle Navigation Arrow */}
          <g transform="translate(540, 260)">
            <circle r="24" fill="rgba(62, 106, 225, 0.22)" />
            <circle r="11" fill="#3e6ae1" stroke="#ffffff" strokeWidth="2.5" />
          </g>
        </svg>

        {/* Top-left Tesla Navigation Search Bar */}
        <div
          className="absolute top-5 left-5 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg w-72 border backdrop-blur-md"
          style={{
            backgroundColor: isDark ? 'rgba(24, 25, 29, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            borderColor: 'var(--tesla-border)',
          }}
        >
          <Search className="w-4 h-4 opacity-60" />
          <span className="text-sm opacity-65">导航 · 搜索目的地</span>
        </div>

        {/* Floating Event Location Card on Map */}
        <div
          className="absolute bottom-6 right-6 max-w-sm rounded-2xl p-4 border shadow-xl backdrop-blur-md"
          style={{
            backgroundColor: isDark ? 'rgba(20, 21, 25, 0.9)' : 'rgba(255, 255, 255, 0.94)',
            borderColor: 'var(--tesla-border)',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <Navigation className="w-3 h-3 text-blue-400" />
                当前事件位置
              </div>
              <div className="text-sm font-medium mt-0.5">
                {activeEvent?.locationLabel || '上海 · 陆家嘴国金中心'}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--tesla-text-secondary)' }}>
                {activeEvent?.reasonLabel || '支持直接载入 TeslaCam U 盘目录'}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={onOpenDashcam}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--tesla-blue)' }}
                >
                  回到行车记录仪
                </button>
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor: 'var(--tesla-surface-elevated)',
                    color: 'var(--tesla-text)',
                  }}
                >
                  导入 U 盘录像
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
