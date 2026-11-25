import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Car, Eye, EyeOff, RotateCcw } from 'lucide-react';
import {
  CAMERA_LABELS,
  CameraAngle,
  CORE_CAMERAS,
  DashcamEvent,
  LayoutMode,
  VideoEnhanceSettings,
} from '../../types/dashcam';
import { formatTeslaDateTime } from '../../utils/teslaParser';
import { TeslaTopDownCarSvg } from '../icons/TeslaIcons';
import { DemoCameraCanvas } from './DemoCameraCanvas';

interface VideoStageProps {
  event: DashcamEvent | null;
  activeCamera: CameraAngle;
  layoutMode: LayoutMode;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  zoom: number;
  enhance: VideoEnhanceSettings;
  onSelectCamera: (cam: CameraAngle) => void;
  onToggleLayout: () => void;
  onTimeUpdate: (seconds: number) => void;
  onSegmentDurationResolved: (segmentIndex: number, actualDuration: number) => void;
  onPlaybackEnded: () => void;
  onZoomChange: (nextZoom: number) => void;
  registerMediaRef: (
    angle: CameraAngle,
    el: HTMLVideoElement | HTMLCanvasElement | null
  ) => void;
}

export const VideoStage: React.FC<VideoStageProps> = ({
  event,
  activeCamera,
  layoutMode,
  currentTime,
  isPlaying,
  playbackRate,
  zoom,
  enhance,
  onSelectCamera,
  onToggleLayout,
  onTimeUpdate,
  onSegmentDurationResolved,
  onPlaybackEnded,
  onZoomChange,
  registerMediaRef,
}) => {
  const [showHud, setShowHud] = useState(true);
  const [showCarMap, setShowCarMap] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragOrigin = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const videoElementsRef = useRef<Partial<Record<CameraAngle, HTMLVideoElement | null>>>({});

  // Reset pan when zoom resets to 1x
  useEffect(() => {
    if (zoom <= 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  // Determine which stitched 1-minute segment corresponds to `currentTime`
  const segmentState = useMemo(() => {
    if (!event || event.segments.length === 0) {
      return { index: 0, offsetStart: 0, localTime: 0, segment: null };
    }
    let acc = 0;
    for (let i = 0; i < event.segments.length; i++) {
      const seg = event.segments[i];
      if (currentTime < acc + seg.duration || i === event.segments.length - 1) {
        return {
          index: i,
          offsetStart: acc,
          localTime: Math.max(0, Math.min(seg.duration, currentTime - acc)),
          segment: seg,
        };
      }
      acc += seg.duration;
    }
    return {
      index: 0,
      offsetStart: 0,
      localTime: 0,
      segment: event.segments[0],
    };
  }, [event, currentTime]);

  // Manage Blob URLs lazily for ONLY the currently active segment (zero memory leak!)
  const [segmentUrls, setSegmentUrls] = useState<Partial<Record<CameraAngle, string>>>({});

  useEffect(() => {
    if (!event || event.isDemo || !segmentState.segment) {
      setSegmentUrls({});
      return;
    }
    const created: Partial<Record<CameraAngle, string>> = {};
    const cams = segmentState.segment.cameras;
    (Object.keys(cams) as CameraAngle[]).forEach((cam) => {
      const file = cams[cam];
      if (file) created[cam] = URL.createObjectURL(file);
    });
    setSegmentUrls(created);

    return () => {
      Object.values(created).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [event?.id, event?.isDemo, segmentState.index]);

  // Demo playback animation loop (smooth 60fps master clock)
  const lastFrameRef = useRef<number | null>(null);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  useEffect(() => {
    if (!event || !event.isDemo || !isPlaying) {
      lastFrameRef.current = null;
      return;
    }
    let rafId = 0;
    const tick = (now: number) => {
      if (lastFrameRef.current !== null) {
        const dt = ((now - lastFrameRef.current) / 1000) * playbackRate;
        const next = currentTimeRef.current + dt;
        if (next >= event.totalDuration) {
          onTimeUpdate(event.totalDuration);
          onPlaybackEnded();
          return;
        }
        onTimeUpdate(next);
      }
      lastFrameRef.current = now;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [event, isPlaying, playbackRate, onTimeUpdate, onPlaybackEnded]);

  // Sync real HTML5 <video> elements with play/pause, playbackRate, and localTime
  useEffect(() => {
    if (!event || event.isDemo) return;
    const allVideos = Object.entries(videoElementsRef.current) as [
      CameraAngle,
      HTMLVideoElement | null,
    ][];

    allVideos.forEach(([, vid]) => {
      if (!vid) return;
      vid.playbackRate = playbackRate;
      if (Math.abs(vid.currentTime - segmentState.localTime) > 0.25) {
        try {
          vid.currentTime = segmentState.localTime;
        } catch {
          // Video may still be loading metadata
        }
      }
      if (isPlaying && vid.paused) {
        vid.play().catch(() => {});
      } else if (!isPlaying && !vid.paused) {
        vid.pause();
      }
    });
  }, [
    event,
    isPlaying,
    playbackRate,
    segmentState.index,
    segmentState.localTime,
    segmentUrls,
    activeCamera,
    layoutMode,
  ]);

  const camerasToShow: CameraAngle[] = useMemo(() => {
    if (!event) return CORE_CAMERAS;
    return event.availableCameras.length > 0 ? event.availableCameras : CORE_CAMERAS;
  }, [event]);

  const masterCamera: CameraAngle = camerasToShow.includes(activeCamera)
    ? activeCamera
    : camerasToShow[0];

  const filterCss = useMemo(() => {
    const parts = [
      `brightness(${enhance.brightness}%)`,
      `contrast(${enhance.contrast}%)`,
      `saturate(${enhance.saturate}%)`,
    ];
    return parts.join(' ');
  }, [enhance]);

  const liveTimestamp = useMemo(() => {
    if (!event) return '';
    const d = new Date(event.startDate.getTime() + currentTime * 1000);
    return formatTeslaDateTime(d).fullStamp;
  }, [event, currentTime]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && layoutMode === 'quad') return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      onZoomChange(Math.min(4, Math.max(1, Number((zoom + delta).toFixed(2)))));
    },
    [zoom, layoutMode, onZoomChange]
  );

  const handlePointerDownStage = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    dragOrigin.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  const handlePointerMoveStage = (e: React.PointerEvent) => {
    if (!dragOrigin.current || zoom <= 1) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    setPan({
      x: Math.max(-420, Math.min(420, dragOrigin.current.px + dx)),
      y: Math.max(-260, Math.min(260, dragOrigin.current.py + dy)),
    });
  };

  const handlePointerUpStage = () => {
    dragOrigin.current = null;
  };

  const renderCameraMedia = (
    angle: CameraAngle,
    isMaster: boolean,
    isThumb = false
  ) => {
    if (!event) return null;

    if (event.isDemo && event.demoScene) {
      return (
        <DemoCameraCanvas
          scene={event.demoScene}
          camera={angle}
          currentTime={currentTime}
          width={isThumb ? 320 : 960}
          height={isThumb ? 200 : 600}
          className="w-full h-full object-cover"
          canvasRefCallback={
            isThumb ? undefined : (el) => registerMediaRef(angle, el)
          }
        />
      );
    }

    const src = segmentUrls[angle];
    if (!src) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 text-xs">
          <span>{CAMERA_LABELS[angle].zh}</span>
          <span className="text-[10px] opacity-60 mt-0.5">当前片段无此角度录像</span>
        </div>
      );
    }

    return (
      <video
        key={`${event.id}-${segmentState.index}-${angle}`}
        ref={(el) => {
          if (!isThumb) {
            videoElementsRef.current[angle] = el;
            registerMediaRef(angle, el);
          }
        }}
        src={src}
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-contain bg-black"
        onLoadedMetadata={(e) => {
          const vid = e.currentTarget;
          if (isMaster && Number.isFinite(vid.duration) && vid.duration > 1) {
            onSegmentDurationResolved(segmentState.index, vid.duration);
          }
          if (segmentState.localTime > 0.1) {
            vid.currentTime = Math.min(vid.duration || 60, segmentState.localTime);
          }
          vid.playbackRate = playbackRate;
          if (isPlaying) vid.play().catch(() => {});
        }}
        onTimeUpdate={(e) => {
          if (!isMaster) return;
          const vid = e.currentTarget;
          const stitchedTime = segmentState.offsetStart + vid.currentTime;
          onTimeUpdate(stitchedTime);
        }}
        onEnded={() => {
          if (!isMaster) return;
          if (segmentState.index < event.segments.length - 1) {
            // Seamlessly advance to next 1-minute stitched segment
            const nextStart =
              segmentState.offsetStart + (segmentState.segment?.duration ?? 60) + 0.05;
            onTimeUpdate(nextStart);
          } else {
            onPlaybackEnded();
          }
        }}
      />
    );
  };

  if (!event) {
    return (
      <div className="flex-1 bg-black flex items-center justify-center text-zinc-400 text-sm">
        请从左侧选择一段行车记录仪视频，或拖入本地 TeslaCam 文件夹
      </div>
    );
  }

  return (
    <div
      className="relative flex-1 bg-black overflow-hidden flex items-center justify-center"
      onWheel={handleWheel}
      onPointerDown={handlePointerDownStage}
      onPointerMove={handlePointerMoveStage}
      onPointerUp={handlePointerUpStage}
      onPointerLeave={handlePointerUpStage}
      style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
    >
      {/* === LAYOUT 1: TESLA CLASSIC SINGLE PRIMARY + LIVE MINI CAM SWITCHER === */}
      {layoutMode === 'single' ? (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              filter: filterCss,
            }}
          >
            {renderCameraMedia(masterCamera, true, false)}
          </div>

          {/* Right Floating Live Synchronized Multi-Camera Rail (Signature Tesla UI!) */}
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
            {camerasToShow.map((cam) => {
              const selected = cam === masterCamera;
              const isTriggerCam = event.triggerCamera === cam;
              return (
                <button
                  key={cam}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCamera(cam);
                  }}
                  title={`切换到 ${CAMERA_LABELS[cam].zh}摄像头`}
                  className={`relative w-[124px] sm:w-[148px] h-[74px] sm:h-[86px] rounded-xl overflow-hidden bg-zinc-950 transition-all cursor-pointer shadow-xl ${
                    selected
                      ? 'ring-2 ring-[#3E6AE1] scale-[1.03]'
                      : 'ring-1 ring-white/20 opacity-82 hover:opacity-100 hover:scale-[1.02]'
                  }`}
                >
                  {renderCameraMedia(cam, false, true)}

                  {/* Label Pill */}
                  <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white">
                      {CAMERA_LABELS[cam].zh}
                    </span>
                    {isTriggerCam && (
                      <span
                        className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]"
                        title="事件触发摄像头"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* === LAYOUT 2: 2x2 QUAD SYNCHRONIZED GRID VIEW === */
        <div
          className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1 p-1 bg-zinc-950"
          style={{ filter: filterCss }}
        >
          {camerasToShow.slice(0, 4).map((cam) => {
            const isMaster = cam === masterCamera;
            const isTriggerCam = event.triggerCamera === cam;
            return (
              <div
                key={cam}
                onClick={() => onSelectCamera(cam)}
                onDoubleClick={() => {
                  onSelectCamera(cam);
                  onToggleLayout();
                }}
                className={`relative rounded-lg overflow-hidden bg-black cursor-pointer transition-all ${
                  isMaster ? 'ring-2 ring-[#3E6AE1]' : 'ring-1 ring-white/10'
                }`}
              >
                {renderCameraMedia(cam, isMaster, false)}
                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-black/65 backdrop-blur-sm border border-white/10 flex items-center gap-1.5 text-[11px] font-semibold text-white">
                  <span>
                    {CAMERA_LABELS[cam].zh} · {CAMERA_LABELS[cam].en}
                  </span>
                  {isTriggerCam && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/85 text-[9px]">
                      触发源
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top-Left Tesla Telemetry / Timestamp HUD Overlay */}
      {showHud && (
        <div className="absolute top-3.5 left-3.5 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="px-3 py-1.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/10 text-white flex items-center gap-2.5 shadow-lg">
            {event.category === 'sentry' ? (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
            <span className="font-mono text-xs font-medium tabular-nums tracking-wide">
              {liveTimestamp}
            </span>
            <span className="text-white/30">|</span>
            <span className="text-xs font-semibold">
              {layoutMode === 'quad'
                ? '4 路同步监控'
                : `${CAMERA_LABELS[masterCamera].zh} · ${CAMERA_LABELS[masterCamera].en}`}
            </span>
            {event.segments.length > 1 && (
              <>
                <span className="text-white/30">|</span>
                <span className="text-[11px] text-white/75 tabular-nums">
                  片段 {segmentState.index + 1}/{event.segments.length}
                </span>
              </>
            )}
          </div>

          {zoom > 1 && (
            <button
              type="button"
              onClick={() => {
                onZoomChange(1);
                setPan({ x: 0, y: 0 });
              }}
              className="pointer-events-auto px-2.5 py-1.5 rounded-lg bg-blue-600/85 text-white text-xs font-semibold flex items-center gap-1 shadow-lg cursor-pointer hover:bg-blue-500"
            >
              <RotateCcw className="w-3 h-3" />
              {zoom.toFixed(1)}x 还原视角
            </button>
          )}
        </div>
      )}

      {/* Bottom-Left Interactive Top-Down Tesla Camera Angle Diagram (Toggleable) */}
      <div className="absolute bottom-3.5 left-3.5 z-20 flex items-end gap-2">
        <button
          type="button"
          onClick={() => setShowCarMap((v) => !v)}
          title="显示/隐藏 俯视车身镜头切换图"
          className={`p-2 rounded-lg backdrop-blur-md border transition-colors cursor-pointer ${
            showCarMap
              ? 'bg-blue-600/80 border-blue-400/50 text-white'
              : 'bg-black/60 border-white/15 text-white/80 hover:text-white'
          }`}
        >
          <Car className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setShowHud((v) => !v)}
          title="显示/隐藏 时间水印 HUD"
          className="p-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
        >
          {showHud ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        {showCarMap && (
          <div className="p-3 rounded-2xl bg-black/75 backdrop-blur-md border border-white/15 shadow-2xl flex flex-col items-center">
            <span className="text-[10px] text-white/70 mb-1">点击光束切换视角</span>
            <TeslaTopDownCarSvg
              className="w-24 h-36"
              activeCamera={masterCamera}
              sentryActive={event.category === 'sentry'}
              onSelectCamera={(cam) => onSelectCamera(cam)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
