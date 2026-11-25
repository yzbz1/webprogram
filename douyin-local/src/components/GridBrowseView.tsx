import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Heart,
  Images,
  Layers,
  Loader2,
  Play,
  Plus,
  Search,
  Star,
  Video,
} from 'lucide-react';
import {
  AuthorSummary,
  LibraryStats,
  MediaItem,
  MineSubTab,
} from '../types/douyin';
import { fetchAuthors, fetchFeed, mediaUrl, searchWorks } from '../api/client';
import { AuthorAvatar } from './DouyinLogo';

interface GridBrowseViewProps {
  mode: 'authors' | 'mix' | 'mine' | 'search';
  stats: LibraryStats | null;
  searchQuery: string;
  onFollowAuthor: (name: string) => void;
  onPlayAuthor: (authorName: string, startId?: string) => void;
  onPlayMix: (mixName: string) => void;
  onPlayCollectionItem: (tab: MineSubTab, itemId: string) => void;
  onPlaySearchItem: (item: MediaItem) => void;
  onClickTag: (tag: string) => void;
}

export const GridBrowseView: React.FC<GridBrowseViewProps> = ({
  mode,
  stats,
  searchQuery,
  onFollowAuthor,
  onPlayAuthor,
  onPlayMix,
  onPlayCollectionItem,
  onPlaySearchItem,
  onClickTag,
}) => {
  // Authors state
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [authorQuery, setAuthorQuery] = useState('');
  const [authorSort, setAuthorSort] = useState<'count' | 'recent' | 'followed'>('count');
  const [loadingAuthors, setLoadingAuthors] = useState(false);

  // Mine state (liked / collected / history)
  const [mineTab, setMineTab] = useState<MineSubTab>('liked');
  const [mineItems, setMineItems] = useState<MediaItem[]>([]);
  const [mineTotal, setMineTotal] = useState(0);
  const [loadingMine, setLoadingMine] = useState(false);

  // Search state
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    if (mode !== 'authors') return;
    let cancelled = false;
    setLoadingAuthors(true);
    fetchAuthors(authorQuery, authorSort)
      .then((res) => {
        if (!cancelled) {
          setAuthors(res.authors);
          setLoadingAuthors(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingAuthors(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, authorQuery, authorSort, stats?.followedCount]);

  useEffect(() => {
    if (mode !== 'mine') return;
    let cancelled = false;
    setLoadingMine(true);
    fetchFeed({ tab: mineTab, label: mineTab }, { limit: 48, offset: 0 })
      .then((res) => {
        if (!cancelled) {
          setMineItems(res.items);
          setMineTotal(res.total);
          setLoadingMine(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingMine(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, mineTab, stats?.likedCount, stats?.collectedCount, stats?.historyCount]);

  useEffect(() => {
    if (mode !== 'search') return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }
    let cancelled = false;
    setLoadingSearch(true);
    searchWorks(searchQuery, 0, 48)
      .then((res) => {
        if (!cancelled) {
          setSearchResults(res.items);
          setSearchTotal(res.total);
          setSearchHasMore(res.hasMore);
          setLoadingSearch(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingSearch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, searchQuery]);

  const loadMoreSearch = async () => {
    if (!searchHasMore || loadingSearch) return;
    setLoadingSearch(true);
    try {
      const res = await searchWorks(searchQuery, searchResults.length, 48);
      setSearchResults((prev) => [...prev, ...res.items]);
      setSearchHasMore(res.hasMore);
    } finally {
      setLoadingSearch(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto dy-scroll bg-[#060716] pt-16 px-5 sm:px-8 pb-10">
      {/* === AUTHORS DIRECTORY (235 Creators) === */}
      {mode === 'authors' && (
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">
                全部博主 <span className="text-sm font-normal text-white/45 ml-1">({authors.length})</span>
              </h1>
              <p className="text-xs text-white/50 mt-0.5">
                来自 J:\GitProject\DouzyDownload 的全部创作者，点击任意博主立即连刷 TA 的作品
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.07] border border-white/10">
                <Search className="w-3.5 h-3.5 text-white/50" />
                <input
                  type="text"
                  value={authorQuery}
                  onChange={(e) => setAuthorQuery(e.target.value)}
                  placeholder="筛选博主昵称..."
                  className="bg-transparent text-xs outline-none w-36 text-white placeholder:text-white/40"
                />
              </div>

              <div className="flex rounded-xl bg-white/[0.07] p-1 text-xs">
                {(
                  [
                    ['count', '作品最多'],
                    ['recent', '最近更新'],
                    ['followed', '已关注优先'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAuthorSort(key)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      authorSort === key ? 'bg-[#FE2C55] text-white font-semibold' : 'text-white/65 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingAuthors ? (
            <div className="py-24 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#FE2C55]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {authors.map((a) => (
                <div
                  key={a.name}
                  onClick={() => onPlayAuthor(a.name)}
                  className="group rounded-2xl bg-[#121422] hover:bg-[#191c2f] border border-white/[0.07] hover:border-white/20 p-4 transition-all cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AuthorAvatar name={a.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate group-hover:text-[#FE2C55] transition-colors">
                        {a.name}
                      </div>
                      <div className="text-[11px] text-white/45 mt-0.5 tabular-nums">
                        更新于 {a.latestDate || '未知'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px]">
                    <div className="flex items-center gap-2.5 text-white/65 tabular-nums">
                      <span className="flex items-center gap-1">
                        <Video className="w-3 h-3 text-[#25F4EE]" />
                        {a.videoCount}
                      </span>
                      {a.imageCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Images className="w-3 h-3 text-[#FACE15]" />
                          {a.imageCount}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFollowAuthor(a.name);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                        a.followed
                          ? 'bg-white/10 text-white/75'
                          : 'bg-[#FE2C55]/20 text-[#FE2C55] hover:bg-[#FE2C55] hover:text-white'
                      }`}
                    >
                      {a.followed ? (
                        <>
                          <Check className="w-3 h-3" /> 已关注
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" /> 关注
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === MIX COLLECTIONS === */}
      {mode === 'mix' && (
        <div className="max-w-6xl mx-auto space-y-5">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#FACE15]" />
              本地合集
            </h1>
            <p className="text-xs text-white/50 mt-0.5">
              自动识别各博主 mix 目录下的系列合集，连续沉浸追更
            </p>
          </div>

          {(stats?.mixes || []).length === 0 ? (
            <div className="py-20 text-center text-sm text-white/50">暂无合集目录</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(stats?.mixes || []).map((m) => (
                <button
                  key={`${m.authorName}-${m.name}`}
                  type="button"
                  onClick={() => onPlayMix(m.name)}
                  className="group rounded-2xl bg-[#121422] hover:bg-[#1a1d31] border border-white/[0.08] overflow-hidden text-left cursor-pointer transition-all flex items-center gap-4 p-4"
                >
                  <div className="w-20 h-28 rounded-xl overflow-hidden bg-zinc-900 shrink-0 relative">
                    {m.coverFile && (
                      <video
                        src={`${mediaUrl(m.coverFile)}#t=0.5`}
                        muted
                        preload="metadata"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white fill-white/90" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FACE15]/20 text-[#FACE15]">
                      合集
                    </span>
                    <div className="text-base font-bold text-white truncate">{m.name}</div>
                    <div className="text-xs text-white/55">@{m.authorName}</div>
                    <div className="text-xs text-white/45 tabular-nums">共 {m.count} 集视频</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === MINE (LIKES / COLLECTS / HISTORY) === */}
      {mode === 'mine' && (
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {(
                [
                  ['liked', '我喜欢的', Heart, stats?.likedCount || 0],
                  ['collected', '我的收藏', Star, stats?.collectedCount || 0],
                  ['history', '观看历史', Clock, stats?.historyCount || 0],
                ] as const
              ).map(([id, label, Icon, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMineTab(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    mineTab === id
                      ? 'bg-white text-black'
                      : 'bg-white/[0.07] text-white/70 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  <span className="text-xs opacity-65 tabular-nums">{count}</span>
                </button>
              ))}
            </div>
            <span className="text-xs text-white/45">
              本地持久化保存 · 共 {mineTotal} 条记录
            </span>
          </div>

          {loadingMine ? (
            <div className="py-24 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#FE2C55]" />
            </div>
          ) : mineItems.length === 0 ? (
            <div className="py-24 text-center text-white/45 text-sm">
              这里还是空的，去推荐页双击点赞或收藏喜欢的视频吧！
            </div>
          ) : (
            <WorkCardGrid
              items={mineItems}
              onClickItem={(it) => onPlayCollectionItem(mineTab, it.id)}
              onClickTag={onClickTag}
            />
          )}
        </div>
      )}

      {/* === SEARCH RESULTS === */}
      {mode === 'search' && (
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">
              搜索「<span className="text-[#FE2C55]">{searchQuery}</span>」
              <span className="text-xs font-normal text-white/50 ml-2 tabular-nums">
                找到 {searchTotal.toLocaleString()} 个相关作品
              </span>
            </h1>
          </div>

          {loadingSearch && searchResults.length === 0 ? (
            <div className="py-24 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#FE2C55]" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-24 text-center text-white/50 text-sm">
              没有找到匹配的作品，试试搜索其他博主名、关键词或 #话题标签
            </div>
          ) : (
            <>
              <WorkCardGrid
                items={searchResults}
                onClickItem={onPlaySearchItem}
                onClickTag={onClickTag}
              />
              {searchHasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    disabled={loadingSearch}
                    onClick={loadMoreSearch}
                    className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                  >
                    {loadingSearch ? '加载中...' : '加载更多搜索结果'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const WorkCardGrid: React.FC<{
  items: MediaItem[];
  onClickItem: (item: MediaItem) => void;
  onClickTag: (tag: string) => void;
}> = ({ items, onClickItem, onClickTag }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
    {items.map((it) => (
      <div
        key={it.id}
        onClick={() => onClickItem(it)}
        className="group rounded-xl overflow-hidden bg-[#121422] border border-white/[0.07] hover:border-white/25 transition-all cursor-pointer flex flex-col"
      >
        <div className="relative aspect-[3/4] bg-zinc-950 overflow-hidden">
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

          {it.mediaType === 'images' && (
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/65 text-[10px] font-medium text-white flex items-center gap-1">
              <Images className="w-3 h-3" /> {it.files.length}
            </span>
          )}

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Play className="w-9 h-9 text-white fill-white/90 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>

          <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] text-white/85 drop-shadow">
            <span className="truncate font-medium">@{it.authorName}</span>
            <span className="tabular-nums opacity-75 shrink-0">{it.date}</span>
          </div>
        </div>

        <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
          <div className="text-xs text-white/85 line-clamp-2 leading-snug">
            {it.desc || '无标题作品'}
          </div>
          {it.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {it.tags.slice(0, 2).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClickTag(t);
                  }}
                  className="text-[10px] text-[#FACE15]/90 hover:text-[#25F4EE] truncate max-w-full cursor-pointer"
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
);
