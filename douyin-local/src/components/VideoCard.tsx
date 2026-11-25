import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Eye,
  EyeOff,
  FolderOpen,
  Heart,
  Layers,
  Maximize,
  Pause,
  Play,
  Plus,
  Repeat,
  Star,
  User,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { MediaItem } from '../types/douyin';
import { mediaUrl, revealInExplorer, sendInteract } from '../api/client';
import { AuthorAvatar } from './DouyinLogo';

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  rot: number;
}

interface VideoCardProps {
  item: MediaItem;
  isActive: boolean;
  shouldPreload: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  autoPlayNext: boolean;
  cleanMode: boolean;
  onToggleMute: () => void;
  onVolumeChange: (v: number) => void;
  onPlaybackRateChange: (r: number) => void;
  onToggleAutoPlayNext: () => void;
  onToggleCleanMode: () => void;
  onToggleFullscreen: () => void;
  onAutoNext: () => void;
  onLike: (item: MediaItem, forceLike?: boolean) => void;
  onCollect: (item: MediaItem) => void;
  onFollow: (authorName: string) => void;
  onOpenAuthor: (authorName: string) => void;
  onClickTag: (tag: string) => void;
  onClickMix: (mixName: string) => void;
  onShowToast: (msg: string) => void;
  controlRef?: React.MutableRefObject<VideoCardHandle | null>;
}

export interface VideoCardHandle {
  togglePlay: () => void;
  seekDelta: (sec: number) => void;
  stepSlide: (dir: -1 | 1) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2, 3];

function formatSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  item,
  isActive,
  shouldPreload,
  muted,
  volume,
  playbackRate,
  autoPlayNext,
  cleanMode,
  onToggleMute,
  onVolumeChange,
  onPlaybackRateChange,
  onToggleAutoPlayNext,
  onToggleCleanMode,
  onToggleFullscreen,
  onAutoNext,
  onLike,
  onCollect,
  onFollow,
  onOpenAuthor,
  onClickTag,
  onClickMix,
  onShowToast,
  controlRef,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPct, setHoverPct] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Image carousel state (for Douyin 图文 posts)
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);

  // Gesture states: double-tap hearts + long-press 2x speed
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [likeBounce, setLikeBounce] = useState(false);
  const [longPressBoost, setLongPressBoost] = useState(false);
  const [expandDesc, setExpandDesc] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showVolumePop, setShowVolumePop] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const clickTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const activeStartTimeRef = useRef<number>(0);
  const finishSignaledRef = useRef(false);

  const effectiveRate = longPressBoost ? 2.0 : playbackRate;
  const isImagePost = item.mediaType === 'images';
  const primarySrc = useMemo(() => mediaUrl(item.files[0] || ''), [item.files]);

  // Reset state when item changes
  useEffect(() => {
    setSlideIndex(0);
    setSlideProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setMediaError(false);
    setExpandDesc(false);
    finishSignaledRef.current = false;
  }, [item.id]);

  // Sync play/pause & implicit algorithm signal when card enters/leaves Active state
  useEffect(() => {
    const vid = videoRef.current;
    const bgVid = bgVideoRef.current;

    if (isActive) {
      activeStartTimeRef.current = Date.now();
      finishSignaledRef.current = false;
      sendInteract({ action: 'view', itemId: item.id }).catch(() => {});

      if (!isImagePost && vid) {
        vid.currentTime = 0;
        vid.muted = muted;
        vid.volume = volume;
        vid.playbackRate = effectiveRate;
        const p = vid.play();
        if (p) {
          p.then(() => setIsPlaying(true)).catch(() => {
            // Browser autoplay policy fallback: retry muted so video never stalls!
            vid.muted = true;
            vid.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          });
        }
        if (bgVid) {
          bgVid.currentTime = 0;
          bgVid.muted = true;
          bgVid.playbackRate = effectiveRate;
          bgVid.play().catch(() => {});
        }
      } else if (isImagePost) {
        setIsPlaying(true);
      }
    } else {
      // Leaving active slot: emit quick-skip negative signal if swiped away in < 1.5s
      if (activeStartTimeRef.current > 0) {
        const dwellMs = Date.now() - activeStartTimeRef.current;
        if (dwellMs > 200 && dwellMs < 1500 && !finishSignaledRef.current) {
          sendInteract({ action: 'signal', itemId: item.id, kind: 'skip' }).catch(() => {});
        }
        activeStartTimeRef.current = 0;
      }
      if (vid) {
        vid.pause();
        vid.currentTime = 0;
      }
      if (bgVid) {
        bgVid.pause();
        bgVid.currentTime = 0;
      }
    }
  }, [isActive, item.id, isImagePost]);

  // Sync volume, mute, playbackRate dynamically
  useEffect(() => {
    const vid = videoRef.current;
    const bgVid = bgVideoRef.current;
    if (vid) {
      vid.muted = muted;
      vid.volume = volume;
      vid.playbackRate = effectiveRate;
    }
    if (bgVid) {
      bgVid.playbackRate = effectiveRate;
    }
  }, [muted, volume, effectiveRate]);

  // Image carousel auto-advance loop (3.5s per slide, authentic Douyin photo post UX!)
  useEffect(() => {
    if (!isActive || !isImagePost || !isPlaying) return;
    const slideDurationMs = 3500 / effectiveRate;
    let start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const pct = Math.min(100, ((now - start) / slideDurationMs) * 100);
      setSlideProgress(pct);
      if (pct >= 100) {
        if (slideIndex < item.files.length - 1) {
          setSlideIndex((i) => i + 1);
          start = now;
        } else {
          if (!finishSignaledRef.current) {
            finishSignaledRef.current = true;
            sendInteract({ action: 'signal', itemId: item.id, kind: 'finish' }).catch(() => {});
          }
          if (autoPlayNext) {
            onAutoNext();
            return;
          }
          setSlideIndex(0);
          start = now;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isActive, isImagePost, isPlaying, slideIndex, item.files.length, effectiveRate, autoPlayNext, onAutoNext, item.id]);

  const togglePlay = useCallback(() => {
    if (isImagePost) {
      setIsPlaying((p) => !p);
      return;
    }
    const vid = videoRef.current;
    const bgVid = bgVideoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().then(() => setIsPlaying(true)).catch(() => {});
      bgVid?.play().catch(() => {});
    } else {
      vid.pause();
      bgVid?.pause();
      setIsPlaying(false);
    }
  }, [isImagePost]);

  const seekTo = useCallback((sec: number) => {
    const vid = videoRef.current;
    const bgVid = bgVideoRef.current;
    if (!vid || !duration) return;
    const clamped = Math.max(0, Math.min(duration, sec));
    vid.currentTime = clamped;
    if (bgVid) bgVid.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const seekDelta = useCallback(
    (delta: number) => {
      if (isImagePost) {
        setSlideIndex((prev) =>
          Math.max(0, Math.min(item.files.length - 1, prev + (delta > 0 ? 1 : -1)))
        );
        return;
      }
      seekTo((videoRef.current?.currentTime || currentTime) + delta);
    },
    [isImagePost, item.files.length, seekTo, currentTime]
  );

  // Expose imperative controls to FeedPlayer keyboard shortcuts
  useEffect(() => {
    if (!isActive || !controlRef) return;
    controlRef.current = {
      togglePlay,
      seekDelta,
      stepSlide: (dir) => {
        setSlideIndex((prev) => Math.max(0, Math.min(item.files.length - 1, prev + dir)));
      },
    };
    return () => {
      if (controlRef.current) controlRef.current = null;
    };
  }, [isActive, controlRef, togglePlay, seekDelta, item.files.length]);

  const spawnHeart = (clientX: number, clientY: number, containerRect: DOMRect) => {
    const id = Date.now() + Math.random();
    const x = clientX - containerRect.left;
    const y = clientY - containerRect.top;
    const rot = Math.round((Math.random() - 0.5) * 44);
    setHearts((prev) => [...prev, { id, x, y, rot }]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, 900);
  };

  // Unified Douyin Pointer Gesture Handler: Single Click = Play/Pause, Double Click = HeartBurst Like, Long Press = 2x Speed
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setLongPressBoost(true);
    }, 320);
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressTriggeredRef.current) {
      setLongPressBoost(false);
      longPressTriggeredRef.current = false;
      return;
    }

    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();

    if (now - lastTapTimeRef.current < 260) {
      // Double Tap -> Douyin Floating Heart & Like!
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      spawnHeart(e.clientX, e.clientY, rect);
      setLikeBounce(true);
      setTimeout(() => setLikeBounce(false), 380);
      onLike(item, true);
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
      clickTimerRef.current = window.setTimeout(() => {
        togglePlay();
        clickTimerRef.current = null;
      }, 240);
    }
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressTriggeredRef.current) {
      setLongPressBoost(false);
      longPressTriggeredRef.current = false;
    }
  };

  // Parse caption text into prose + clickable #hashtags
  const captionParts = useMemo(() => {
    const text = item.desc || '';
    if (!text) return [];
    return text.split(/(#[^\s#@,，。！？!?]+)/g).filter(Boolean);
  }, [item.desc]);

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="relative w-full h-full bg-[#060716] overflow-hidden flex flex-col">
      {/* === MAIN VISUAL STAGE === */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-black"
        onPointerDown={handleStagePointerDown}
        onPointerUp={handleStagePointerUp}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
      >
        {/* Ambient Blurred Backdrop (Signature Douyin Web aesthetic for portrait videos!) */}
        {!isImagePost && shouldPreload && !mediaError && (
          <video
            ref={bgVideoRef}
            src={primarySrc}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-125 blur-[56px] opacity-35 saturate-150 pointer-events-none"
          />
        )}
        {isImagePost && item.files[slideIndex] && (
          <img
            src={mediaUrl(item.files[slideIndex])}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-125 blur-[56px] opacity-35 saturate-150 pointer-events-none"
          />
        )}

        {/* Primary Media: Video OR Image Carousel */}
        {isImagePost ? (
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <img
              src={mediaUrl(item.files[slideIndex] || item.files[0])}
              alt={item.desc || item.authorName}
              draggable={false}
              className="w-full h-full object-contain select-none shadow-2xl"
            />

            {/* Top Segmented Story Progress Bars (Authentic Douyin 图文 indicator!) */}
            {item.files.length > 1 && !cleanMode && (
              <div className="absolute top-16 inset-x-0 flex justify-center px-6 z-20 pointer-events-none">
                <div className="w-full max-w-md flex items-center gap-1.5">
                  {item.files.map((_, idx) => (
                    <div
                      key={idx}
                      className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden"
                    >
                      <div
                        className="h-full bg-white rounded-full transition-[width] duration-75"
                        style={{
                          width:
                            idx < slideIndex
                              ? '100%'
                              : idx === slideIndex
                                ? `${slideProgress}%`
                                : '0%',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Left / Right Slide Controls */}
            {item.files.length > 1 && (
              <>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlideIndex((i) => (i > 0 ? i - 1 : item.files.length - 1));
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlideIndex((i) => (i + 1) % item.files.length);
                  }}
                  className="absolute right-20 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute top-20 right-20 z-20 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-[11px] font-medium tabular-nums text-white/90">
                  图文 {slideIndex + 1} / {item.files.length}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {shouldPreload && !mediaError ? (
              <video
                ref={videoRef}
                src={primarySrc}
                loop={!autoPlayNext}
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (Number.isFinite(d)) setDuration(d);
                }}
                onTimeUpdate={(e) => {
                  if (isSeeking) return;
                  const vid = e.currentTarget;
                  setCurrentTime(vid.currentTime);
                  if (vid.buffered.length > 0 && vid.duration > 0) {
                    const end = vid.buffered.end(vid.buffered.length - 1);
                    setBufferedPct(Math.min(100, (end / vid.duration) * 100));
                  }
                  // Trigger positive finish signal at 80% watch completion
                  if (
                    isActive &&
                    !finishSignaledRef.current &&
                    vid.duration > 2 &&
                    vid.currentTime / vid.duration >= 0.8
                  ) {
                    finishSignaledRef.current = true;
                    sendInteract({ action: 'signal', itemId: item.id, kind: 'finish' }).catch(() => {});
                  }
                }}
                onEnded={() => {
                  if (autoPlayNext && isActive) {
                    onAutoNext();
                  }
                }}
                onError={() => setMediaError(true)}
                className="relative z-10 w-full h-full object-contain"
              />
            ) : mediaError ? (
              <div className="relative z-10 flex flex-col items-center text-white/60 text-sm gap-2 px-6 text-center">
                <p>无法播放此视频文件（可能已被移动或编码不受支持）</p>
                <code className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded">
                  {item.files[0]}
                </code>
              </div>
            ) : (
              <div className="relative z-10 w-full h-full bg-black" />
            )}
          </>
        )}

        {/* Long-press 2.0x Speed Pill */}
        {longPressBoost && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 flex items-center gap-1.5 text-xs font-semibold text-white pointer-events-none shadow-xl">
            <Zap className="w-3.5 h-3.5 text-[#FACE15] fill-current" />
            <span>2.0x 倍速播放中 &gt;&gt;</span>
          </div>
        )}

        {/* Center Paused Indicator */}
        {!isPlaying && isActive && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/35 backdrop-blur-xs flex items-center justify-center">
              <Play className="w-10 h-10 text-white/85 fill-white/85 ml-1" />
            </div>
          </div>
        )}

        {/* Double-Tap Floating Hearts Layer */}
        {hearts.map((h) => (
          <div
            key={h.id}
            className="absolute z-30 pointer-events-none animate-dy-heart"
            style={
              {
                left: h.x,
                top: h.y,
                '--heart-rot': `${h.rot}deg`,
              } as React.CSSProperties
            }
          >
            <Heart className="w-24 h-24 text-[#FE2C55] fill-[#FE2C55] drop-shadow-[0_6px_22px_rgba(254,44,85,0.65)]" />
          </div>
        ))}

        {/* Bottom Gradient Legibility Scrim */}
        {!cleanMode && (
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none z-10" />
        )}

        {/* === RIGHT FLOATING DOUYIN INTERACTION RAIL === */}
        {!cleanMode && (
          <div
            className="absolute right-4 sm:right-6 bottom-6 z-20 flex flex-col items-center gap-5"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {/* Creator Avatar + Red Follow Badge */}
            <div className="relative mb-1">
              <button
                type="button"
                onClick={() => onOpenAuthor(item.authorName)}
                title={`查看 @${item.authorName} 的全部 ${item.authorWorkCount} 个作品 (R)`}
                className="block cursor-pointer transition-transform hover:scale-105"
              >
                <AuthorAvatar name={item.authorName} size="md" />
              </button>
              <button
                type="button"
                onClick={() => onFollow(item.authorName)}
                title={item.followed ? '已关注（点击取消）(G)' : '关注博主 (G)'}
                className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center shadow-md transition-all cursor-pointer ${
                  item.followed
                    ? 'bg-emerald-500 text-white scale-90'
                    : 'bg-[#FE2C55] text-white hover:scale-110'
                }`}
              >
                {item.followed ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                )}
              </button>
            </div>

            {/* Like Button */}
            <button
              type="button"
              onClick={() => {
                setLikeBounce(true);
                setTimeout(() => setLikeBounce(false), 380);
                onLike(item, false);
              }}
              title="点赞 / 取消赞 (Z)"
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <Heart
                className={`w-8 h-8 transition-transform group-hover:scale-110 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] ${
                  likeBounce ? 'animate-like-bounce' : ''
                } ${
                  item.liked ? 'text-[#FE2C55] fill-[#FE2C55]' : 'text-white fill-white/10'
                }`}
              />
              <span className="text-[12px] font-medium text-white/90 drop-shadow">
                {item.liked ? '已赞' : '点赞'}
              </span>
            </button>

            {/* Collect Button */}
            <button
              type="button"
              onClick={() => onCollect(item)}
              title="收藏 / 取消收藏 (C)"
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <Star
                className={`w-8 h-8 transition-transform group-hover:scale-110 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] ${
                  item.collected
                    ? 'text-[#FACE15] fill-[#FACE15]'
                    : 'text-white fill-white/10'
                }`}
              />
              <span className="text-[12px] font-medium text-white/90 drop-shadow">
                {item.collected ? '已藏' : '收藏'}
              </span>
            </button>

            {/* Author Works Drawer */}
            <button
              type="button"
              onClick={() => onOpenAuthor(item.authorName)}
              title="查看 TA 的全部作品 (R)"
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center group-hover:bg-white/25 transition-colors">
                <User className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] font-medium text-white/90 tabular-nums drop-shadow">
                {item.authorWorkCount}作品
              </span>
            </button>

            {/* Open in Explorer */}
            <button
              type="button"
              onClick={() => {
                revealInExplorer(item.files[0]);
                onShowToast('已在资源管理器中定位本地文件');
              }}
              title="在文件夹中定位原文件"
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center group-hover:bg-white/25 transition-colors">
                <FolderOpen className="w-4 h-4 text-white" />
              </div>
              <span className="text-[11px] font-medium text-white/85 drop-shadow">定位</span>
            </button>

            {/* Rotating Douyin Vinyl Music Disc */}
            <div
              className="mt-1 w-11 h-11 rounded-full bg-gradient-to-tr from-zinc-900 via-zinc-700 to-zinc-900 p-1.5 border border-white/20 shadow-xl flex items-center justify-center animate-dy-disc"
              style={{ animationPlayState: isPlaying && isActive ? 'running' : 'paused' }}
            >
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#FE2C55] to-[#25F4EE] flex items-center justify-center">
                <Disc3 className="w-4 h-4 text-black/80" />
              </div>
            </div>
          </div>
        )}

        {/* === BOTTOM-LEFT CAPTION & HASHTAGS OVERLAY === */}
        {!cleanMode && (
          <div
            className="absolute left-5 sm:left-7 bottom-5 z-20 max-w-[68%] sm:max-w-[58%] space-y-2"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {/* Mix pill if part of a Douyin Mix */}
            {item.mixName && (
              <button
                type="button"
                onClick={() => onClickMix(item.mixName!)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 backdrop-blur-md text-[12px] font-medium text-white cursor-pointer transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-[#FACE15]" />
                <span>合集 · {item.mixName}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
              </button>
            )}

            {/* @Author + Date */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenAuthor(item.authorName)}
                className="text-[17px] font-bold text-white hover:underline cursor-pointer drop-shadow"
              >
                @{item.authorName}
              </button>
              {item.date && (
                <span className="text-[13px] text-white/65 tabular-nums drop-shadow">
                  · {item.date}
                </span>
              )}
              {isImagePost && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#25F4EE]/20 text-[#25F4EE] font-semibold">
                  图文 {item.files.length}P
                </span>
              )}
            </div>

            {/* Caption + Clickable Hashtags */}
            {captionParts.length > 0 && (
              <div
                onClick={() => setExpandDesc((e) => !e)}
                className={`text-[14px] leading-relaxed text-white/92 drop-shadow cursor-pointer ${
                  expandDesc ? '' : 'line-clamp-2'
                }`}
              >
                {captionParts.map((part, i) =>
                  part.startsWith('#') ? (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClickTag(part.slice(1));
                      }}
                      className="text-[#FACE15] hover:text-[#25F4EE] font-medium mr-1.5 cursor-pointer transition-colors"
                    >
                      {part}
                    </button>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* === DOUYIN WEB BOTTOM PLAYER CONTROL BAR === */}
      <div
        className={`relative z-30 bg-[#0b0d1b]/95 border-t border-white/[0.06] transition-opacity ${
          cleanMode ? 'opacity-20 hover:opacity-100' : 'opacity-100'
        }`}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {/* Ultra-slim Hover-Expandable Progress Scrubber */}
        {!isImagePost && (
          <div
            ref={progressRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setIsSeeking(true);
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              seekTo(ratio * duration);
            }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              setHoverPct(ratio * 100);
              setHoverTime(ratio * duration);
              if (e.buttons === 1) seekTo(ratio * duration);
            }}
            onPointerUp={() => setIsSeeking(false)}
            onPointerLeave={() => {
              setHoverTime(null);
              setIsSeeking(false);
            }}
            className="group relative h-3 -mt-1.5 flex items-center cursor-pointer"
          >
            {hoverTime !== null && duration > 0 && (
              <div
                className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/85 text-white text-[11px] font-mono tabular-nums pointer-events-none border border-white/15"
                style={{ left: `${hoverPct}%` }}
              >
                {formatSec(hoverTime)}
              </div>
            )}
            <div className="relative w-full h-[2.5px] group-hover:h-[5px] bg-white/18 transition-all">
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/25"
                style={{ width: `${bufferedPct}%` }}
              />
              <div
                className="absolute left-0 top-0 bottom-0 bg-white group-hover:bg-[#FE2C55] transition-colors"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Controls Row */}
        <div className="h-11 px-4 flex items-center justify-between text-[12px] text-white/80">
          {/* Left: Play/Pause + Time */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              title="播放 / 暂停 (Space)"
              className="p-1.5 rounded-lg hover:bg-white/10 text-white cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            {isImagePost ? (
              <span className="tabular-nums text-white/65">
                图文轮播 · {slideIndex + 1} / {item.files.length}
              </span>
            ) : (
              <span className="tabular-nums font-mono text-[12px] text-white/75">
                {formatSec(currentTime)} <span className="opacity-40">/</span> {formatSec(duration)}
              </span>
            )}
          </div>

          {/* Right: Auto-Next (连播) / Clean Screen / Speed / Volume / Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Auto-Next Toggle Switch (Authentic Douyin Web 连播) */}
            <button
              type="button"
              onClick={onToggleAutoPlayNext}
              title="播完自动切下一条 / 单曲循环 (K)"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
            >
              <Repeat className={`w-3.5 h-3.5 ${autoPlayNext ? 'text-[#FE2C55]' : 'opacity-65'}`} />
              <span className={autoPlayNext ? 'text-white font-medium' : 'opacity-70'}>
                {autoPlayNext ? '连播' : '单循'}
              </span>
              <span
                className={`w-7 h-3.5 rounded-full p-0.5 flex items-center transition-colors ${
                  autoPlayNext ? 'bg-[#FE2C55] justify-end' : 'bg-white/20 justify-start'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
              </span>
            </button>

            {/* Clean Screen (清屏 J) */}
            <button
              type="button"
              onClick={onToggleCleanMode}
              title="清屏模式 (J)"
              className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer ${
                cleanMode ? 'text-[#25F4EE]' : 'opacity-75 hover:opacity-100'
              }`}
            >
              {cleanMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>清屏</span>
            </button>

            {/* Playback Speed Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu((s) => !s)}
                className="px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer tabular-nums font-medium"
              >
                {playbackRate === 1 ? '倍速' : `${playbackRate}x`}
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 py-1.5 w-20 rounded-xl bg-[#1a1c2a] border border-white/10 shadow-2xl flex flex-col">
                  {SPEEDS.map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => {
                        onPlaybackRateChange(sp);
                        setShowSpeedMenu(false);
                      }}
                      className={`py-1.5 text-center text-xs tabular-nums hover:bg-white/10 cursor-pointer ${
                        playbackRate === sp ? 'text-[#FE2C55] font-bold' : 'text-white/80'
                      }`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume Control */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumePop(true)}
              onMouseLeave={() => setShowVolumePop(false)}
            >
              <button
                type="button"
                onClick={onToggleMute}
                title="静音 / 取消静音 (M)"
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[#FE2C55]" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              {showVolumePop && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-3 py-3 rounded-xl bg-[#1a1c2a] border border-white/10 shadow-2xl flex flex-col items-center gap-2">
                  <span className="text-[10px] tabular-nums opacity-70">
                    {muted ? 0 : Math.round(volume * 100)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(e) => onVolumeChange(Number(e.target.value))}
                    className="w-20 accent-[#FE2C55] cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={onToggleFullscreen}
              title="全屏 (F)"
              className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
