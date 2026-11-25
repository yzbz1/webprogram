import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FeedContext, LibraryStats, MediaItem, MineSubTab, NavTab } from './types/douyin';
import { fetchStats, sendInteract } from './api/client';
import { Sidebar } from './components/Sidebar';
import { TopSearchBar } from './components/TopSearchBar';
import { FeedPlayer } from './components/FeedPlayer';
import { AuthorDrawer } from './components/AuthorDrawer';
import { GridBrowseView } from './components/GridBrowseView';

export function App() {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('recommend');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [feedContext, setFeedContext] = useState<FeedContext>({
    tab: 'recommend',
    label: '推荐',
  });
  const [feedVersion, setFeedVersion] = useState(1);

  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);
  const [drawerAuthor, setDrawerAuthor] = useState<string | null>(null);

  const [externalUpdateItem, setExternalUpdateItem] = useState<{
    id: string;
    patch: Partial<MediaItem>;
  } | null>(null);
  const [externalFollowUpdate, setExternalFollowUpdate] = useState<{
    authorName: string;
    followed: boolean;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const refreshStats = useCallback(() => {
    fetchStats()
      .then((s) => setStats(s))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
    // Poll briefly until initial 35k-item index finishes ready=true
    const id = window.setInterval(() => {
      fetchStats()
        .then((s) => {
          setStats(s);
          if (s.ready) window.clearInterval(id);
        })
        .catch(() => {});
    }, 800);
    return () => window.clearInterval(id);
  }, [refreshStats]);

  const openFeed = useCallback((ctx: FeedContext, tab: NavTab) => {
    setActiveTab(tab);
    setFeedContext(ctx);
    setFeedVersion((v) => v + 1);
  }, []);

  const handleSelectNavTab = (tab: NavTab) => {
    setActiveTag(null);
    setDrawerAuthor(null);
    if (tab === 'recommend') {
      openFeed({ tab: 'recommend', label: '推荐' }, 'recommend');
    } else if (tab === 'follow') {
      openFeed({ tab: 'follow', label: '我的关注' }, 'follow');
    } else if (tab === 'images') {
      openFeed({ tab: 'images', label: '图文精选' }, 'images');
    } else {
      setActiveTab(tab);
    }
  };

  const handleSelectTag = useCallback(
    (tag: string) => {
      setActiveTag(tag);
      setDrawerAuthor(null);
      openFeed({ tab: 'tag', label: `#${tag}`, tag }, 'tag');
    },
    [openFeed]
  );

  const handleSelectMix = useCallback(
    (mixName: string) => {
      setDrawerAuthor(null);
      openFeed({ tab: 'mix', label: `合集 · ${mixName}`, mix: mixName }, 'recommend');
    },
    [openFeed]
  );

  const handlePlayAuthor = useCallback(
    (authorName: string, startId?: string) => {
      openFeed(
        { tab: 'author', label: `@${authorName}`, author: authorName, startId },
        'recommend'
      );
    },
    [openFeed]
  );

  const handlePlayCollectionItem = useCallback(
    (mineTab: MineSubTab, itemId: string) => {
      const label =
        mineTab === 'liked' ? '我喜欢的' : mineTab === 'collected' ? '我的收藏' : '观看历史';
      openFeed({ tab: mineTab, label, startId: itemId }, 'recommend');
    },
    [openFeed]
  );

  const handlePlaySearchItem = useCallback(
    (item: MediaItem) => {
      openFeed(
        {
          tab: 'author',
          label: `@${item.authorName}`,
          author: item.authorName,
          startId: item.id,
        },
        'recommend'
      );
    },
    [openFeed]
  );

  const handleLike = useCallback(
    async (item: MediaItem, forceLike = false) => {
      const res = await sendInteract({ action: 'like', itemId: item.id, forceLike });
      const liked = Boolean(res.liked);
      setExternalUpdateItem({ id: item.id, patch: { liked } });
      refreshStats();
      if (!forceLike) showToast(liked ? '已点赞 ❤️（推荐算法已学习偏好）' : '已取消赞');
    },
    [refreshStats, showToast]
  );

  const handleCollect = useCallback(
    async (item: MediaItem) => {
      const res = await sendInteract({ action: 'collect', itemId: item.id });
      const collected = Boolean(res.collected);
      setExternalUpdateItem({ id: item.id, patch: { collected } });
      refreshStats();
      showToast(collected ? '已加入收藏 ⭐' : '已取消收藏');
    },
    [refreshStats, showToast]
  );

  const handleFollow = useCallback(
    async (authorName: string) => {
      const res = await sendInteract({ action: 'follow', authorName });
      const followed = Boolean(res.followed);
      setExternalFollowUpdate({ authorName, followed });
      refreshStats();
      showToast(followed ? `已关注 @${authorName}` : `已取消关注 @${authorName}`);
    },
    [refreshStats, showToast]
  );

  const isGridMode =
    activeTab === 'authors' ||
    activeTab === 'mix' ||
    activeTab === 'mine' ||
    activeTab === 'search';

  const drawerAuthorFollowed =
    activeItem?.authorName === drawerAuthor
      ? activeItem.followed
      : externalFollowUpdate?.authorName === drawerAuthor
        ? externalFollowUpdate.followed
        : false;

  return (
    <div className="w-screen h-screen bg-[#060716] text-white flex overflow-hidden relative">
      {/* Left Douyin Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        activeTag={activeTag}
        stats={stats}
        onSelectTab={handleSelectNavTab}
        onSelectTag={handleSelectTag}
      />

      {/* Top Floating Search Bar */}
      <TopSearchBar
        query={searchQuery}
        totalWorks={stats?.totalItems || 0}
        onSubmitSearch={(q) => {
          setSearchQuery(q);
          setDrawerAuthor(null);
          setActiveTab('search');
        }}
        onClearSearch={() => {
          setSearchQuery('');
          if (activeTab === 'search') setActiveTab('recommend');
        }}
      />

      {/* Main Content: Either Full-Screen Douyin Vertical Feed OR Grid Browse View */}
      <main className="flex-1 flex min-w-0 h-full overflow-hidden">
        {isGridMode ? (
          <GridBrowseView
            mode={activeTab as 'authors' | 'mix' | 'mine' | 'search'}
            stats={stats}
            searchQuery={searchQuery}
            onFollowAuthor={handleFollow}
            onPlayAuthor={handlePlayAuthor}
            onPlayMix={handleSelectMix}
            onPlayCollectionItem={handlePlayCollectionItem}
            onPlaySearchItem={handlePlaySearchItem}
            onClickTag={handleSelectTag}
          />
        ) : (
          <>
            <FeedPlayer
              feedContext={feedContext}
              feedKey={`${feedContext.tab}-${feedContext.author || ''}-${feedContext.tag || ''}-${feedContext.mix || ''}-${feedContext.startId || ''}-${feedVersion}`}
              onLike={handleLike}
              onCollect={handleCollect}
              onFollow={handleFollow}
              onOpenAuthor={(name) => setDrawerAuthor(name)}
              onToggleAuthorDrawer={() => {
                setDrawerAuthor((prev) => (prev ? null : activeItem?.authorName || null));
              }}
              onClickTag={handleSelectTag}
              onClickMix={handleSelectMix}
              onActiveItemChange={setActiveItem}
              onShowToast={showToast}
              externalUpdateItem={externalUpdateItem}
              externalFollowUpdate={externalFollowUpdate}
            />

            {/* Right Slide-out "TA 的作品" Drawer */}
            <AuthorDrawer
              authorName={drawerAuthor}
              activeItemId={activeItem?.id ?? null}
              followed={drawerAuthorFollowed}
              onClose={() => setDrawerAuthor(null)}
              onFollow={handleFollow}
              onPlayAuthorItem={(author, itemId) => handlePlayAuthor(author, itemId)}
            />
          </>
        )}
      </main>

      {/* Douyin Toast Pill */}
      {toast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/85 border border-white/15 text-xs font-medium text-white shadow-2xl backdrop-blur-md pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
