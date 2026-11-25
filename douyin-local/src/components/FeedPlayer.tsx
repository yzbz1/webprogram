import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import { FeedContext, MediaItem } from '../types/douyin';
import { fetchFeed, mediaUrl } from '../api/client';
import { VideoCard, VideoCardHandle } from './VideoCard';

interface FeedPlayerProps {
  feedContext: FeedContext;
  feedKey: string;
  onLike: (item: MediaItem, forceLike?: boolean) => Promise<void>;
  onCollect: (item: MediaItem) => Promise<void>;
  onFollow: (authorName: string) => Promise<void>;
  onOpenAuthor: (authorName: string) => void;
  onToggleAuthorDrawer: () => void;
  onClickTag: (tag: string) => void;
  onClickMix: (mixName: string) => void;
  onActiveItemChange: (item: MediaItem | null) => void;
  onShowToast: (msg: string) => void;
  externalUpdateItem?: { id: string; patch: Partial<MediaItem> } | null;
  externalFollowUpdate?: { authorName: string; followed: boolean } | null;
}

export const FeedPlayer: React.FC<FeedPlayerProps> = ({
  feedContext,
  feedKey,
  onLike,
  onCollect,
  onFollow,
  onOpenAuthor,
  onToggleAuthorDrawer,
  onClickTag,
  onClickMix,
  onActiveItemChange,
  onShowToast,
  externalUpdateItem,
  externalFollowUpdate,
}) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Persistent player preferences
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [cleanMode, setCleanMode] = useState(false);

  // Smooth drag-to-swipe offset
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isAnimatingSnap, setIsAnimatingSnap] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeCardRef = useRef<VideoCardHandle | null>(null);
  const wheelLockUntilRef = useRef(0);
  const fetchingMoreRef = useRef(false);
  const nextOffsetRef = useRef(0);
  const seenIdsRef = useRef<string[]>([]);

  // Initial load whenever feedContext changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);
    setActiveIndex(0);
    seenIdsRef.current = [];
    nextOffsetRef.current = 0;

    fetchFeed(feedContext, { limit: 15, offset: 0 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotalCount(res.total);
        setHasMore(res.hasMore);
        seenIdsRef.current = res.items.map((i) => i.id);
        nextOffsetRef.current = (res.startIndex ?? 0) + res.items.length;
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feedKey]);

  // Apply external like/collect/follow updates cleanly
  useEffect(() => {
    if (!externalUpdateItem) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === externalUpdateItem.id ? { ...it, ...externalUpdateItem.patch } : it
      )
    );
  }, [externalUpdateItem]);

  useEffect(() => {
    if (!externalFollowUpdate) return;
    setItems((prev) =>
      prev.map((it) =>
        it.authorName === externalFollowUpdate.authorName
          ? { ...it, followed: externalFollowUpdate.followed }
          : it
      )
    );
  }, [externalFollowUpdate]);

  const activeItem = items[activeIndex] ?? null;

  useEffect(() => {
    onActiveItemChange(activeItem);
  }, [activeItem, onActiveItemChange]);

  // Infinite load more when approaching end of loaded buffer (within 5 videos!)
  const loadMore = useCallback(async () => {
    if (fetchingMoreRef.current || !hasMore) return;
    fetchingMoreRef.current = true;
    try {
      const res = await fetchFeed(
        { ...feedContext, startId: undefined },
        {
          limit: 15,
          offset: nextOffsetRef.current,
          excludeIds: seenIdsRef.current,
        }
      );
      if (res.items.length > 0) {
        setItems((prev) => {
          const existing = new Set(prev.map((p) => p.id));
          const unique = res.items.filter((i) => !existing.has(i.id));
          return [...prev, ...unique];
        });
        seenIdsRef.current.push(...res.items.map((i) => i.id));
        nextOffsetRef.current += res.items.length;
      }
      setHasMore(res.hasMore && res.items.length > 0);
    } finally {
      fetchingMoreRef.current = false;
    }
  }, [feedContext, hasMore]);

  useEffect(() => {
    if (items.length > 0 && activeIndex >= items.length - 5 && hasMore) {
      loadMore();
    }
  }, [activeIndex, items.length, hasMore, loadMore]);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev < items.length - 1) return prev + 1;
      onShowToast(hasMore ? '正在加载更多推荐...' : '已经刷到当前列表底部啦');
      return prev;
    });
  }, [items.length, hasMore, onShowToast]);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev > 0) return prev - 1;
      onShowToast('已经是第一条视频啦');
      return prev;
    });
  }, [onShowToast]);

  // Authentic Douyin Mouse Wheel Gesture (debounced single-step swipe, immune to trackpad inertia!)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const now = Date.now();
      if (now < wheelLockUntilRef.current) return;
      if (Math.abs(e.deltaY) < 24) return;
      wheelLockUntilRef.current = now + 420;
      if (e.deltaY > 0) goNext();
      else goPrev();
    },
    [goNext, goPrev]
  );

  // Touch swipe support for mobile/tablet touchscreens
  const touchStartYRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    setIsAnimatingSnap(false);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const dy = e.touches[0].clientY - touchStartYRef.current;
    setDragOffsetY(Math.max(-220, Math.min(220, dy)));
  };
  const handleTouchEnd = () => {
    if (touchStartYRef.current === null) return;
    setIsAnimatingSnap(true);
    if (dragOffsetY < -70) goNext();
    else if (dragOffsetY > 70) goPrev();
    setDragOffsetY(0);
    touchStartYRef.current = null;
  };

  const handleToggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Full Douyin Web Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      if (e.key === 'ArrowDown' || key === 's') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowUp' || key === 'w') {
        e.preventDefault();
        goPrev();
      } else if (e.code === 'Space') {
        e.preventDefault();
        activeCardRef.current?.togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        activeCardRef.current?.seekDelta(5);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        activeCardRef.current?.seekDelta(-5);
      } else if (key === 'z' && activeItem) {
        onLike(activeItem, false);
      } else if (key === 'c' && activeItem) {
        onCollect(activeItem);
      } else if (key === 'g' && activeItem) {
        onFollow(activeItem.authorName);
      } else if (key === 'j') {
        setCleanMode((v) => {
          onShowToast(!v ? '已开启清屏模式 (按 J 退出)' : '已退出清屏模式');
          return !v;
        });
      } else if (key === 'k') {
        setAutoPlayNext((v) => {
          onShowToast(!v ? '已开启自动连播' : '已切换为单曲循环');
          return !v;
        });
      } else if (key === 'm') {
        setMuted((v) => !v);
      } else if (key === 'r') {
        onToggleAuthorDrawer();
      } else if (key === 'f') {
        handleToggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    goNext,
    goPrev,
    activeItem,
    onLike,
    onCollect,
    onFollow,
    onToggleAuthorDrawer,
    handleToggleFullscreen,
    onShowToast,
  ]);

  // Empty or Loading States
  if (loading) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-[#060716] text-white/70 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#FE2C55]" />
        <div className="text-sm">正在加载本地视频流...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-[#060716] text-white/60 gap-3 px-6 text-center">
        <div className="text-base font-semibold text-white/85">
          「{feedContext.label}」暂时没有作品
        </div>
        <p className="text-xs text-white/45 max-w-sm">
          {feedContext.tab === 'follow'
            ? '在推荐流中点击博主头像下方的红色「+」号关注后，TA 的全部作品会出现在这里。'
            : '可以去推荐页刷视频，双击点赞或点击星标收藏。'}
        </p>
      </div>
    );
  }

  // Virtual 3-slot window: render only [activeIndex - 1, activeIndex, activeIndex + 1]
  // Plus a hidden background prefetcher for [activeIndex + 2] for instant zero-lag swipes!
  const visibleSlots = [activeIndex - 1, activeIndex, activeIndex + 1].filter(
    (idx) => idx >= 0 && idx < items.length
  );
  const prefetchItem = items[activeIndex + 2];

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative flex-1 min-w-0 h-full bg-[#060716] overflow-hidden select-none"
    >
      {/* Top Context Pill (shows current channel when browsing Tag / Author / Mix / Follow) */}
      {!cleanMode && feedContext.tab !== 'recommend' && (
        <div className="absolute top-16 left-5 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/12 text-xs text-white/90 pointer-events-none">
          <span className="font-semibold">{feedContext.label}</span>
          <span className="text-white/45 tabular-nums">
            {activeIndex + 1} / {totalCount}
          </span>
        </div>
      )}

      {/* Virtual Vertical Sliding Stage */}
      <div className="relative w-full h-full">
        {visibleSlots.map((idx) => {
          const item = items[idx];
          const offsetSlides = idx - activeIndex;
          const isCurrent = idx === activeIndex;
          return (
            <div
              key={`${feedKey}-${item.id}`}
              className="absolute inset-0 w-full h-full"
              style={{
                transform: `translate3d(0, calc(${offsetSlides * 100}% + ${dragOffsetY}px), 0)`,
                transition:
                  dragOffsetY !== 0 && !isAnimatingSnap
                    ? 'none'
                    : 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
                zIndex: isCurrent ? 2 : 1,
              }}
            >
              <VideoCard
                item={item}
                isActive={isCurrent}
                shouldPreload={Math.abs(offsetSlides) <= 1}
                muted={muted}
                volume={volume}
                playbackRate={playbackRate}
                autoPlayNext={autoPlayNext}
                cleanMode={cleanMode}
                onToggleMute={() => setMuted((m) => !m)}
                onVolumeChange={(v) => {
                  setVolume(v);
                  if (v > 0 && muted) setMuted(false);
                }}
                onPlaybackRateChange={(r) => {
                  setPlaybackRate(r);
                  onShowToast(`已切换 ${r}x 倍速`);
                }}
                onToggleAutoPlayNext={() =>
                  setAutoPlayNext((v) => {
                    onShowToast(!v ? '已开启自动连播' : '已切换为单曲循环');
                    return !v;
                  })
                }
                onToggleCleanMode={() => setCleanMode((v) => !v)}
                onToggleFullscreen={handleToggleFullscreen}
                onAutoNext={goNext}
                onLike={onLike}
                onCollect={onCollect}
                onFollow={onFollow}
                onOpenAuthor={onOpenAuthor}
                onClickTag={onClickTag}
                onClickMix={onClickMix}
                onShowToast={onShowToast}
                controlRef={isCurrent ? activeCardRef : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Silent Preloader for Next+1 Video */}
      {prefetchItem && prefetchItem.mediaType === 'video' && (
        <video
          key={`prefetch-${prefetchItem.id}`}
          src={mediaUrl(prefetchItem.files[0])}
          preload="metadata"
          muted
          className="hidden"
        />
      )}

      {/* Signature Douyin Web Floating Up/Down Switch Capsule (Top-Right, clear of action rail on all heights) */}
      {!cleanMode && (
        <div className="hidden sm:flex flex-col items-center gap-1.5 absolute right-4 sm:right-6 top-20 z-30">
          <div className="flex flex-col rounded-full bg-white/[0.09] hover:bg-white/[0.14] backdrop-blur-md border border-white/10 p-1 shadow-lg transition-colors">
            <button
              type="button"
              onClick={goPrev}
              disabled={activeIndex === 0}
              title="上一条 (↑ / W)"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/15 disabled:opacity-30 cursor-pointer transition-colors"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              title="下一条 (↓ / S)"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/15 cursor-pointer transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
          {feedContext.tab === 'recommend' && (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                seenIdsRef.current = [];
                fetchFeed(feedContext, { limit: 15 })
                  .then((res) => {
                    setItems(res.items);
                    setActiveIndex(0);
                    seenIdsRef.current = res.items.map((i) => i.id);
                    onShowToast('已为你刷新一批新推荐');
                  })
                  .finally(() => setLoading(false));
              }}
              title="换一批推荐"
              className="mt-1 w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] backdrop-blur-md border border-white/10 flex items-center justify-center text-white/75 hover:text-white cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
