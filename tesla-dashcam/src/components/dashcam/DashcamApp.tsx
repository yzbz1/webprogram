import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  MapPin,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  CameraAngle,
  CORE_CAMERAS,
  DashcamEvent,
  LayoutMode,
  VideoEnhanceSettings,
} from '../../types/dashcam';
import {
  collectFromDataTransfer,
  formatTeslaDateTime,
  parseTeslaFiles,
} from '../../utils/teslaParser';
import { exportSnapshot } from '../../utils/screenshot';
import { TeslaDashcamIcon } from '../icons/TeslaIcons';
import { ClipsSidebar } from './ClipsSidebar';
import { PlaybackBar } from './PlaybackBar';
import { VideoStage } from './VideoStage';

interface DashcamAppProps {
  events: DashcamEvent[];
  activeEvent: DashcamEvent | null;
  isFullscreen: boolean;
  onSelectEvent: (ev: DashcamEvent) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEventSegmentDuration: (
    eventId: string,
    segmentIndex: number,
    actualDuration: number
  ) => void;
  onLoadedEvents: (events: DashcamEvent[], sourceLabel: string) => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onOpenImport: () => void;
  onShowToast: (msg: string) => void;
}

const SPEEDS = [0.5, 1, 2, 4];

const DEFAULT_ENHANCE: VideoEnhanceSettings = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  sharpness: false,
};

export const DashcamApp: React.FC<DashcamAppProps> = ({
  events,
  activeEvent,
  isFullscreen,
  onSelectEvent,
  onDeleteEvent,
  onUpdateEventSegmentDuration,
  onLoadedEvents,
  onToggleFullscreen,
  onClose,
  onOpenImport,
  onShowToast,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeCamera, setActiveCamera] = useState<CameraAngle>('front');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [enhance, setEnhance] = useState<VideoEnhanceSettings>(DEFAULT_ENHANCE);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const mediaRefs = useRef<
    Partial<Record<CameraAngle, HTMLVideoElement | HTMLCanvasElement | null>>
  >({});

  const registerMediaRef = useCallback(
    (angle: CameraAngle, el: HTMLVideoElement | HTMLCanvasElement | null) => {
      mediaRefs.current[angle] = el;
    },
    []
  );

  // When switching events: auto-select trigger camera & start ~8s before the red event dot (just like Tesla!)
  useEffect(() => {
    if (!activeEvent) return;
    if (
      activeEvent.triggerCamera &&
      activeEvent.availableCameras.includes(activeEvent.triggerCamera)
    ) {
      setActiveCamera(activeEvent.triggerCamera);
    } else {
      setActiveCamera(activeEvent.availableCameras[0] || 'front');
    }

    if (activeEvent.eventOffsetSeconds !== undefined) {
      setCurrentTime(Math.max(0, activeEvent.eventOffsetSeconds - 8));
    } else {
      setCurrentTime(0);
    }
    setZoom(1);
    setIsPlaying(true);
  }, [activeEvent?.id]);

  const totalDuration = activeEvent?.totalDuration ?? 60;

  const handleSeek = useCallback(
    (sec: number) => {
      const clamped = Math.max(0, Math.min(totalDuration, sec));
      setCurrentTime(clamped);
    },
    [totalDuration]
  );

  const handleSkip = useCallback(
    (delta: number) => {
      setCurrentTime((prev) => Math.max(0, Math.min(totalDuration, prev + delta)));
    },
    [totalDuration]
  );

  const handleStepFrame = useCallback(
    (dir: -1 | 1) => {
      setIsPlaying(false);
      // Tesla dashcam records at ~36fps (1/36 ≈ 0.028s); step 0.04s for clear visual inspection
      setCurrentTime((prev) =>
        Math.max(0, Math.min(totalDuration, Number((prev + dir * 0.04).toFixed(3))))
      );
    },
    [totalDuration]
  );

  const handleJumpToEvent = useCallback(() => {
    if (!activeEvent || activeEvent.eventOffsetSeconds === undefined) return;
    const target = Math.max(0, activeEvent.eventOffsetSeconds - 5);
    setCurrentTime(target);
    if (activeEvent.triggerCamera) {
      setActiveCamera(activeEvent.triggerCamera);
    }
    setIsPlaying(true);
    onShowToast('已跳转至红色事件触发点前 5 秒');
  }, [activeEvent, onShowToast]);

  const handleCycleSpeed = useCallback(() => {
    setPlaybackRate((prev) => {
      const idx = SPEEDS.indexOf(prev);
      const next = SPEEDS[(idx + 1) % SPEEDS.length];
      onShowToast(`播放速度：${next}x`);
      return next;
    });
  }, [onShowToast]);

  const handleCycleZoom = useCallback(() => {
    setZoom((prev) => {
      if (prev < 1.5) return 1.5;
      if (prev < 2.2) return 2.5;
      if (prev < 3.5) return 3.5;
      return 1;
    });
  }, []);

  const handleScreenshot = useCallback(() => {
    if (!activeEvent) return;
    const d = new Date(activeEvent.startDate.getTime() + currentTime * 1000);
    const stamp = formatTeslaDateTime(d).fullStamp;
    const targets: CameraAngle[] =
      layoutMode === 'quad' ? activeEvent.availableCameras.slice(0, 4) : [activeCamera];
    const ok = exportSnapshot(
      targets.map((angle) => ({ angle, el: mediaRefs.current[angle] ?? null })),
      stamp,
      `${activeEvent.folderName}_${layoutMode === 'quad' ? 'quad' : activeCamera}`
    );
    if (ok) {
      onShowToast(
        layoutMode === 'quad'
          ? '已保存 4 路合成高清截图 (PNG)'
          : '已保存当前镜头高清截图 (PNG)'
      );
    }
  }, [activeEvent, currentTime, layoutMode, activeCamera, onShowToast]);

  const handleSegmentDurationResolved = useCallback(
    (segmentIndex: number, actualDuration: number) => {
      if (!activeEvent) return;
      onUpdateEventSegmentDuration(activeEvent.id, segmentIndex, actualDuration);
    },
    [activeEvent, onUpdateEventSegmentDuration]
  );

  const handlePlaybackEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Global keyboard shortcuts (authentic power-user Tesla Dashcam controls)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSkip(e.shiftKey ? -15 : -5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkip(e.shiftKey ? 15 : 5);
      } else if (e.key === ',') {
        e.preventDefault();
        handleStepFrame(-1);
      } else if (e.key === '.') {
        e.preventDefault();
        handleStepFrame(1);
      } else if (e.key === '1') {
        setActiveCamera(CORE_CAMERAS[0]);
      } else if (e.key === '2') {
        setActiveCamera(CORE_CAMERAS[1]);
      } else if (e.key === '3') {
        setActiveCamera(CORE_CAMERAS[2]);
      } else if (e.key === '4') {
        setActiveCamera(CORE_CAMERAS[3]);
      } else if (e.key.toLowerCase() === 'g') {
        setLayoutMode((m) => (m === 'single' ? 'quad' : 'single'));
      } else if (e.key.toLowerCase() === 'e') {
        handleJumpToEvent();
      } else if (e.key.toLowerCase() === 'f') {
        onToggleFullscreen();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleScreenshot();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSkip, handleStepFrame, handleJumpToEvent, onToggleFullscreen, handleScreenshot]);

  // Drag & drop TeslaCam folder directly onto the Dashcam Viewer
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const items = await collectFromDataTransfer(e.dataTransfer);
    if (items.length === 0) return;
    const parsed = await parseTeslaFiles(items);
    if (parsed.length > 0) {
      onLoadedEvents(parsed, '拖放目录');
    } else {
      onShowToast('未在拖入的文件中检测到可播放的 MP4 录像');
    }
  };

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col transition-all duration-200 ${
        isFullscreen ? 'p-0' : 'p-2 sm:p-3.5 pb-2'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDraggingOver(false);
      }}
      onDrop={handleDrop}
    >
      {/* Tesla V12 Floating / Fullscreen App Shell */}
      <div
        className={`relative flex-1 flex flex-col overflow-hidden border transition-all ${
          isFullscreen ? 'rounded-none border-0' : 'rounded-2xl'
        }`}
        style={{
          backgroundColor: 'var(--tesla-surface)',
          borderColor: 'var(--tesla-border)',
          boxShadow: isFullscreen ? 'none' : 'var(--tesla-shadow)',
        }}
      >
        {/* Top Grab Pill (Tesla V12 App Window Handle) */}
        {!isFullscreen && (
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-zinc-500/35 pointer-events-none z-30" />
        )}

        {/* Dashcam Header Bar */}
        <div
          className="h-13 px-3.5 sm:px-4 flex items-center justify-between gap-3 border-b shrink-0"
          style={{
            backgroundColor: 'var(--tesla-surface)',
            borderColor: 'var(--tesla-border)',
          }}
        >
          {/* Left: Sidebar Toggle + App Title + Active Event Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((s) => !s)}
              title={sidebarOpen ? '收起片段列表' : '展开片段列表'}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <TeslaDashcamIcon className="w-5 h-5" recording />
              <span className="text-sm font-semibold tracking-tight">行车记录仪</span>
            </div>

            {activeEvent && (
              <div className="hidden md:flex items-center gap-2 min-w-0 pl-2 border-l border-white/10">
                {activeEvent.category === 'sentry' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/18 text-red-400 text-[11px] font-semibold shrink-0">
                    <ShieldAlert className="w-3 h-3" /> 哨兵模式
                  </span>
                )}
                <span className="text-xs font-medium truncate flex items-center gap-1 opacity-85">
                  <MapPin className="w-3 h-3 opacity-60 shrink-0" />
                  {activeEvent.locationLabel}
                </span>
                <span className="text-xs opacity-50 truncate hidden xl:inline">
                  · {activeEvent.reasonLabel}
                </span>
              </div>
            )}
          </div>

          {/* Right: Import USB + Fullscreen + Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenImport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--tesla-surface-elevated)',
                color: 'var(--tesla-text)',
              }}
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">打开 TeslaCam</span>
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullscreen ? '退出全屏窗口' : '铺满车机屏幕'}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="最小化到车机桌面"
              className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Main Content: Clips Sidebar + Video Stage */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {sidebarOpen && (
            <ClipsSidebar
              events={events}
              activeEventId={activeEvent?.id ?? null}
              onSelectEvent={onSelectEvent}
              onDeleteEvent={onDeleteEvent}
              onOpenImport={onOpenImport}
            />
          )}

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <VideoStage
              event={activeEvent}
              activeCamera={activeCamera}
              layoutMode={layoutMode}
              currentTime={currentTime}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              zoom={zoom}
              enhance={enhance}
              onSelectCamera={setActiveCamera}
              onToggleLayout={() =>
                setLayoutMode((m) => (m === 'single' ? 'quad' : 'single'))
              }
              onTimeUpdate={setCurrentTime}
              onSegmentDurationResolved={handleSegmentDurationResolved}
              onPlaybackEnded={handlePlaybackEnded}
              onZoomChange={setZoom}
              registerMediaRef={registerMediaRef}
            />

            <PlaybackBar
              event={activeEvent}
              currentTime={currentTime}
              duration={totalDuration}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              layoutMode={layoutMode}
              zoom={zoom}
              enhance={enhance}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onSeek={handleSeek}
              onSkip={handleSkip}
              onStepFrame={handleStepFrame}
              onCycleSpeed={handleCycleSpeed}
              onJumpToEvent={handleJumpToEvent}
              onToggleLayout={() =>
                setLayoutMode((m) => (m === 'single' ? 'quad' : 'single'))
              }
              onCycleZoom={handleCycleZoom}
              onChangeEnhance={(patch) => setEnhance((e) => ({ ...e, ...patch }))}
              onResetEnhance={() => setEnhance(DEFAULT_ENHANCE)}
              onScreenshot={handleScreenshot}
              onToggleFullscreen={onToggleFullscreen}
            />
          </div>
        </div>

        {/* Drag & Drop Full Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed border-blue-500 rounded-2xl pointer-events-none">
            <UploadCloud className="w-14 h-14 text-blue-400 mb-3" />
            <div className="text-lg font-semibold text-white">
              松手立即载入 TeslaCam 文件夹或 MP4 视频
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              自动解析哨兵模式、行车记录仪、最近录像及 4 路同步镜头
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
