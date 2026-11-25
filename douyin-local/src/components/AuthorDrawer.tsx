import React, { useEffect, useState } from 'react';
import { Check, Images, Loader2, Play, Plus, X } from 'lucide-react';
import { MediaItem } from '../types/douyin';
import { fetchFeed, mediaUrl } from '../api/client';
import { AuthorAvatar } from './DouyinLogo';

interface AuthorDrawerProps {
  authorName: string | null;
  activeItemId: string | null;
  followed: boolean;
  onClose: () => void;
  onFollow: (authorName: string) => void;
  onPlayAuthorItem: (authorName: string, itemId: string) => void;
}

export const AuthorDrawer: React.FC<AuthorDrawerProps> = ({
  authorName,
  activeItemId,
  followed,
  onClose,
  onFollow,
  onPlayAuthorItem,
}) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!authorName) return;
    let cancelled = false;
    setLoading(true);
    setItems([]);

    fetchFeed({ tab: 'author', label: authorName, author: authorName }, { limit: 30, offset: 0 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setHasMore(res.hasMore);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authorName]);

  if (!authorName) return null;

  const loadMore = async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const res = await fetchFeed(
        { tab: 'author', label: authorName, author: authorName },
        { limit: 30, offset: items.length }
      );
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="fixed right-0 top-0 bottom-0 xl:static w-[320px] sm:w-[360px] xl:w-[390px] shrink-0 h-full bg-[#121420]/98 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-40 shadow-2xl xl:shadow-none">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.07] space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white/90">TA 的作品</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/65 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AuthorAvatar name={authorName} size="md" />
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-white truncate">{authorName}</div>
              <div className="text-xs text-white/50 tabular-nums mt-0.5">
                共 {total.toLocaleString()} 个本地作品
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onFollow(authorName)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
              followed
                ? 'bg-white/10 text-white/80 hover:bg-white/15'
                : 'bg-[#FE2C55] text-white hover:bg-[#ff3c62]'
            }`}
          >
            {followed ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>已关注</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>关注</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3-Column Portrait Works Grid (Authentic Douyin Web Right Drawer!) */}
      <div className="flex-1 overflow-y-auto dy-scroll p-2.5">
        {loading && items.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-2 text-white/50 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-[#FE2C55]" />
            <span>正在加载 TA 的作品...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {items.map((it) => {
                const isCurrent = it.id === activeItemId;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onPlayAuthorItem(authorName, it.id)}
                    className={`group relative aspect-[3/4] rounded-lg overflow-hidden bg-zinc-900 cursor-pointer text-left border transition-all ${
                      isCurrent
                        ? 'border-[#FE2C55] ring-2 ring-[#FE2C55]/50'
                        : 'border-white/5 hover:border-white/25'
                    }`}
                  >
                    {it.mediaType === 'images' ? (
                      <img
                        src={mediaUrl(it.files[0])}
                        alt={it.desc}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <video
                        src={`${mediaUrl(it.files[0])}#t=0.5`}
                        muted
                        preload="metadata"
                        playsInline
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}

                    {/* Playing indicator */}
                    {isCurrent && (
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#FE2C55] text-[9px] font-bold text-white">
                        播放中
                      </div>
                    )}

                    {/* Image badge */}
                    {it.mediaType === 'images' && (
                      <div className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white">
                        <Images className="w-3 h-3" />
                      </div>
                    )}

                    {/* Bottom date + hover play */}
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                      <div className="text-[10px] text-white/90 line-clamp-1">
                        {it.desc || it.date}
                      </div>
                      <div className="text-[9px] text-white/55 tabular-nums flex items-center justify-between mt-0.5">
                        <span>{it.date}</span>
                        <Play className="w-2.5 h-2.5 fill-current opacity-80" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <button
                type="button"
                disabled={loading}
                onClick={loadMore}
                className="w-full mt-3 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-xs font-medium text-white/80 cursor-pointer transition-colors disabled:opacity-50"
              >
                {loading ? '加载中...' : `加载更多（已显示 ${items.length} / ${total}）`}
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
