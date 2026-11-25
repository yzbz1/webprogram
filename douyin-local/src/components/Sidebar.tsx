import React from 'react';
import {
  Compass,
  Flame,
  Hash,
  Heart,
  Images,
  Layers,
  UserCheck,
  Users,
} from 'lucide-react';
import { LibraryStats, NavTab } from '../types/douyin';
import { DouyinNoteIcon } from './DouyinLogo';

interface SidebarProps {
  activeTab: NavTab;
  activeTag: string | null;
  stats: LibraryStats | null;
  onSelectTab: (tab: NavTab) => void;
  onSelectTag: (tag: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  activeTag,
  stats,
  onSelectTab,
  onSelectTag,
}) => {
  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { id: 'recommend', label: '推荐', icon: <Flame className="w-[18px] h-[18px]" /> },
    {
      id: 'follow',
      label: '关注',
      icon: <UserCheck className="w-[18px] h-[18px]" />,
      badge: stats?.followedCount || 0,
    },
    {
      id: 'images',
      label: '图文',
      icon: <Images className="w-[18px] h-[18px]" />,
    },
    {
      id: 'authors',
      label: '全部博主',
      icon: <Users className="w-[18px] h-[18px]" />,
      badge: stats?.authorCount || 0,
    },
    {
      id: 'mix',
      label: '合集',
      icon: <Layers className="w-[18px] h-[18px]" />,
      badge: stats?.mixCount || 0,
    },
    {
      id: 'mine',
      label: '我的',
      icon: <Heart className="w-[18px] h-[18px]" />,
      badge: (stats?.likedCount || 0) + (stats?.collectedCount || 0),
    },
  ];

  return (
    <aside className="w-[72px] lg:w-[172px] shrink-0 h-full bg-[#060716] border-r border-white/[0.06] flex flex-col justify-between z-30">
      {/* Brand Header */}
      <div className="flex flex-col min-h-0 flex-1">
        <button
          type="button"
          onClick={() => onSelectTab('recommend')}
          className="h-16 px-3 lg:px-5 flex items-center justify-center lg:justify-start gap-2.5 cursor-pointer shrink-0 group"
        >
          <DouyinNoteIcon className="w-7 h-7 transition-transform group-hover:scale-105" />
          <div className="hidden lg:flex items-baseline gap-1.5">
            <span className="text-[19px] font-bold tracking-tight text-white">抖音</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-white/70">
              本地版
            </span>
          </div>
        </button>

        {/* Main Navigation */}
        <nav className="px-2 lg:px-3 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-center lg:justify-between px-2 lg:px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-white/[0.11] text-white font-semibold'
                    : 'text-white/65 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={active ? 'text-[#FE2C55]' : ''}>{item.icon}</span>
                  <span className="hidden lg:inline">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="hidden lg:inline text-[11px] tabular-nums text-white/45">
                    {item.badge > 999 ? '999+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="hidden lg:block mx-4 my-3.5 h-px bg-white/[0.07]" />

        {/* Hot Hashtags from local library */}
        <div className="hidden lg:flex flex-col flex-1 min-h-0 px-3">
          <div className="px-2 mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5" />
            <span>热门话题</span>
          </div>
          <div className="flex-1 overflow-y-auto dy-scroll space-y-0.5 pr-1">
            {(stats?.topTags || []).slice(0, 18).map((t) => {
              const selected = activeTab === 'tag' && activeTag === t.tag;
              return (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => onSelectTag(t.tag)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors cursor-pointer text-left ${
                    selected
                      ? 'bg-[#FE2C55]/20 text-[#FE2C55] font-medium'
                      : 'text-white/55 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="truncate flex items-center gap-1">
                    <Hash className="w-3 h-3 shrink-0 opacity-60" />
                    <span className="truncate">{t.tag}</span>
                  </span>
                  <span className="text-[10px] tabular-nums opacity-45 shrink-0">
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Local Library Stats */}
      <div className="hidden lg:block p-3.5 border-t border-white/[0.06] text-[11px] text-white/40 space-y-1">
        <div className="flex items-center justify-between">
          <span>本地作品库</span>
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {stats?.ready ? '已就绪' : '索引中'}
          </span>
        </div>
        <div className="tabular-nums text-white/60 font-medium">
          {(stats?.videoCount || 0).toLocaleString()} 视频 · {(stats?.imageCount || 0).toLocaleString()} 图文
        </div>
      </div>
    </aside>
  );
};
