import React, { useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Maximize,
  Pause,
  Play,
  SlidersHorizontal,
  Sparkles,
  Square,
  Target,
  ZoomIn,
} from 'lucide-react';
import {
  DashcamEvent,
  LayoutMode,
  VideoEnhanceSettings,
} from '../../types/dashcam';
import { formatDuration } from '../../utils/teslaParser';
import { Skip15BackIcon, Skip15ForwardIcon } from '../icons/TeslaIcons';

interface PlaybackBarProps {
  event: DashcamEvent | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  layoutMode: LayoutMode;
  zoom: number;
  enhance: VideoEnhanceSettings;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (deltaSeconds: number) => void;
  onStepFrame: (direction: -1 | 1) => void;
  onCycleSpeed: () => void;
  onJumpToEvent: () => void;
  onToggleLayout: () => void;
  onCycleZoom: () => void;
  onChangeEnhance: (patch: Partial<VideoEnhanceSettings>) => void;
  onResetEnhance: () => void;
  onScreenshot: () => void;
  onToggleFullscreen: () => void;
}

export const PlaybackBar: React.FC<PlaybackBarProps> = ({
  event,
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  layoutMode,
  zoom,
  enhance,
  onTogglePlay,
  onSeek,
  onSkip,
  onStepFrame,
  onCycleSpeed,
  onJumpToEvent,
  onToggleLayout,
  onCycleZoom,
  onChangeEnhance,
  onResetEnhance,
  onScreenshot,
  onToggleFullscreen,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [hoverSec, setHoverSec] = useState<number | null>(null);
  const [hoverPct, setHoverPct] = useState(0);
  const [showEnhance, setShowEnhance] = useState(false);

  const safeDuration = Math.max(1, duration);
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));
  const eventDotPct =
    event?.eventOffsetSeconds !== undefined
      ? Math.min(99, Math.max(1, (event.eventOffsetSeconds / safeDuration) * 100))
      : null;

  // Segment divider positions (for multi-minute stitched Tesla events)
  const segmentMarks: number[] = [];
  if (event && event.segments.length > 1) {
    let acc = 0;
    for (let i = 0; i < event.segments.length - 1; i++) {
      acc += event.segments[i].duration;
      const pct = (acc / safeDuration) * 100;
      if (pct > 1 && pct < 99) segmentMarks.push(pct);
    }
  }

  const pointerToSeconds = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * safeDuration;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(pointerToSeconds(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverPct(ratio * 100);
    setHoverSec(ratio * safeDuration);
    if (e.buttons === 1) {
      onSeek(ratio * safeDuration);
    }
  };

  const isEnhanced =
    enhance.brightness !== 100 ||
    enhance.contrast !== 100 ||
    enhance.saturate !== 100 ||
    enhance.sharpness;

  return (
    <div
      className="relative px-4 sm:px-6 pt-3 pb-3.5 border-t shrink-0 select-none"
      style={{
        backgroundColor: 'var(--tesla-surface)',
        borderColor: 'var(--tesla-border)',
      }}
    >
      {/* Video Plate Enhancer Popover */}
      {showEnhance && (
        <div
          className="absolute right-6 bottom-[112px] w-72 rounded-2xl p-4 border shadow-2xl z-30"
          style={{
            backgroundColor: 'var(--tesla-surface)',
            borderColor: 'var(--tesla-border)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              车牌画质增强（实时滤镜）
            </span>
            <button
              type="button"
              onClick={onResetEnhance}
              className="text-[11px] text-blue-400 hover:underline cursor-pointer"
            >
              重置
            </button>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="opacity-75">亮度</span>
                <span className="tabular-nums opacity-65">{enhance.brightness}%</span>
              </div>
              <input
                type="range"
                min={60}
                max={200}
                value={enhance.brightness}
                onChange={(e) => onChangeEnhance({ brightness: Number(e.target.value) })}
                className="w-full tesla-slider"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="opacity-75">对比度</span>
                <span className="tabular-nums opacity-65">{enhance.contrast}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={220}
                value={enhance.contrast}
                onChange={(e) => onChangeEnhance({ contrast: Number(e.target.value) })}
                className="w-full tesla-slider"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="opacity-75">饱和度</span>
                <span className="tabular-nums opacity-65">{enhance.saturate}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={180}
                value={enhance.saturate}
                onChange={(e) => onChangeEnhance({ saturate: Number(e.target.value) })}
                className="w-full tesla-slider"
              />
            </div>
            <label className="flex items-center justify-between pt-1 cursor-pointer">
              <span className="opacity-85">夜间高反差车牌模式</span>
              <input
                type="checkbox"
                checked={enhance.sharpness}
                onChange={(e) =>
                  onChangeEnhance({
                    sharpness: e.target.checked,
                    brightness: e.target.checked ? 135 : 100,
                    contrast: e.target.checked ? 145 : 100,
                  })
                }
                className="accent-blue-500 w-4 h-4"
              />
            </label>
          </div>
        </div>
      )}

      {/* Timeline Row */}
      <div className="flex items-center gap-3 mb-2.5">
        <span className="text-[12px] font-medium tabular-nums w-11 text-right opacity-80">
          {formatDuration(currentTime)}
        </span>

        {/* Interactive Tesla Scrubber Track */}
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverSec(null)}
          className="relative flex-1 h-7 flex items-center cursor-pointer group"
        >
          {/* Hover Timestamp Bubble */}
          {hoverSec !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-zinc-900 text-white text-[11px] font-mono tabular-nums pointer-events-none shadow-lg border border-white/15"
              style={{ left: `${hoverPct}%` }}
            >
              {formatDuration(hoverSec)}
            </div>
          )}

          {/* Base Rail */}
          <div className="relative w-full h-[5px] rounded-full bg-zinc-500/30 overflow-visible group-hover:h-[6px] transition-all">
            {/* Played Fill */}
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full"
              style={{
                width: `${progressPct}%`,
                backgroundColor: 'var(--tesla-blue)',
              }}
            />

            {/* 1-Minute Stitched Segment Tick Marks */}
            {segmentMarks.map((pct, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-[2px] bg-black/55 pointer-events-none"
                style={{ left: `${pct}%` }}
              />
            ))}

            {/* Iconic Tesla Red Sentry / Event Trigger Dot */}
            {eventDotPct !== null && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToEvent();
                }}
                title={`事件触发点 ${formatDuration(event?.eventOffsetSeconds ?? 0)}（点击跳转）`}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#E31937] border-2 border-white shadow-[0_0_12px_rgba(227,25,55,0.9)] z-10 hover:scale-125 transition-transform cursor-pointer"
                style={{ left: `${eventDotPct}%` }}
              />
            )}

            {/* Scrubber Playhead Knob */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.55)] border-2 border-blue-500 z-20 pointer-events-none transition-transform group-hover:scale-110"
              style={{ left: `${progressPct}%` }}
            />
          </div>
        </div>

        <span className="text-[12px] font-medium tabular-nums w-11 opacity-60">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Transport Controls Row */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto tesla-scroll">
        {/* Left: Jump to Red Event Dot + Frame-by-Frame */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {eventDotPct !== null && (
            <button
              type="button"
              onClick={onJumpToEvent}
              title="跳转到红点触发前 5 秒 (E)"
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer shrink-0"
              style={{
                backgroundColor: 'rgba(227, 25, 55, 0.14)',
                color: '#ff4d67',
              }}
            >
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">跳至红点</span>
            </button>
          )}

          <div
            className="hidden lg:flex items-center rounded-lg overflow-hidden border shrink-0"
            style={{
              backgroundColor: 'var(--tesla-surface-elevated)',
              borderColor: 'var(--tesla-border)',
            }}
          >
            <button
              type="button"
              onClick={() => onStepFrame(-1)}
              title="上一帧 (,)"
              className="px-2 py-1.5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] px-1 opacity-60">逐帧</span>
            <button
              type="button"
              onClick={() => onStepFrame(1)}
              title="下一帧 (.)"
              className="px-2 py-1.5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Iconic Tesla -15s / Play-Pause / +15s */}
        <div className="flex items-center gap-2 sm:gap-6 shrink-0">
          <button
            type="button"
            onClick={() => onSkip(-15)}
            title="快退 15 秒"
            className="p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer opacity-85 hover:opacity-100"
          >
            <Skip15BackIcon className="w-7 h-7" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title="播放 / 暂停 (Space)"
            className="w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-lg"
            style={{
              backgroundColor: 'var(--tesla-text)',
              color: 'var(--tesla-bg)',
            }}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSkip(15)}
            title="快进 15 秒"
            className="p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer opacity-85 hover:opacity-100"
          >
            <Skip15ForwardIcon className="w-7 h-7" />
          </button>
        </div>

        {/* Right: Speed / Layout / Zoom / Plate Enhancer / Screenshot / Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={onCycleSpeed}
            title="切换播放倍速 (0.5x / 1x / 2x / 4x)"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer"
            style={{
              backgroundColor:
                playbackRate !== 1
                  ? 'rgba(62, 106, 225, 0.22)'
                  : 'var(--tesla-surface-elevated)',
              color: playbackRate !== 1 ? '#60a5fa' : 'var(--tesla-text)',
            }}
          >
            {playbackRate}x
          </button>

          <button
            type="button"
            onClick={onToggleLayout}
            title={layoutMode === 'single' ? '切换四路同屏视图 (G)' : '切换特斯拉单主视图 (G)'}
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{
              backgroundColor:
                layoutMode === 'quad'
                  ? 'rgba(62, 106, 225, 0.22)'
                  : 'var(--tesla-surface-elevated)',
              color: layoutMode === 'quad' ? '#60a5fa' : 'var(--tesla-text)',
            }}
          >
            {layoutMode === 'quad' ? (
              <Square className="w-4 h-4" />
            ) : (
              <Grid2x2 className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onCycleZoom}
            title="放大画面查看车牌 (支持滚轮缩放与拖拽)"
            className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium tabular-nums transition-colors cursor-pointer"
            style={{
              backgroundColor:
                zoom > 1 ? 'rgba(62, 106, 225, 0.22)' : 'var(--tesla-surface-elevated)',
              color: zoom > 1 ? '#60a5fa' : 'var(--tesla-text)',
            }}
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{zoom.toFixed(1)}x</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEnhance((s) => !s)}
            title="夜间车牌画质增强"
            className="hidden sm:flex p-2 rounded-lg transition-colors cursor-pointer"
            style={{
              backgroundColor:
                showEnhance || isEnhanced
                  ? 'rgba(62, 106, 225, 0.22)'
                  : 'var(--tesla-surface-elevated)',
              color: showEnhance || isEnhanced ? '#60a5fa' : 'var(--tesla-text)',
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onScreenshot}
            title="导出当前画面 PNG 截图 (S)"
            className="p-2 rounded-lg transition-colors cursor-pointer hover:opacity-90"
            style={{ backgroundColor: 'var(--tesla-surface-elevated)' }}
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            title="切换全屏显示 (F)"
            className="hidden md:flex p-2 rounded-lg transition-colors cursor-pointer hover:opacity-90"
            style={{ backgroundColor: 'var(--tesla-surface-elevated)' }}
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
